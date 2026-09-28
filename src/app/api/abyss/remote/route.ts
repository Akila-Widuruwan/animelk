import { createClient } from "@supabase/supabase-js";
import { isAdminRequest } from "@/lib/admin-auth";
import { createWriteStream, createReadStream } from "node:fs";
import { stat, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable, PassThrough } from "node:stream";
import { pipeline } from "node:stream/promises";
import WebSocket from "ws";

export const dynamic = "force-dynamic";
export const maxDuration = 600;

interface AbyssCfg {
  api_key?: string;
  session_cookie?: string;
}

async function getAbyssSettings(): Promise<AbyssCfg | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  const sb = createClient(url, anon);
  const { data } = await sb
    .from("settings")
    .select("value")
    .eq("key", "abyss_upload")
    .single();
  return ((data as { value?: AbyssCfg } | null)?.value as AbyssCfg) ?? null;
}

function deriveFilename(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    const last = u.pathname.split("/").filter(Boolean).pop();
    if (last) return decodeURIComponent(last);
  } catch {
    // ignore
  }
  return "video.mp4";
}

/** Instant remote upload — abyss's servers fetch the URL directly (WebSocket + session cookie). */
function remoteUploadViaSocket(sourceUrl: string, cookie: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket("wss://dash.abyss.to/api/media/remote/url", {
      headers: {
        Cookie: cookie,
        Origin: "https://dash.abyss.to",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      },
    });
    const timeout = setTimeout(() => {
      ws.terminate();
      reject(new Error("Remote upload timed out after 10 minutes"));
    }, 600000);

    ws.on("open", () => {
      ws.send(JSON.stringify({ action: "remote", url: sourceUrl }));
    });
    ws.on("message", (raw) => {
      let msg: { action?: string; data?: Record<string, unknown>; message?: string };
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (msg.action === "complete") {
        clearTimeout(timeout);
        ws.close();
        resolve(msg.data ?? msg);
      } else if (msg.action === "error") {
        clearTimeout(timeout);
        ws.close();
        reject(new Error(msg.message || "Remote upload failed"));
      }
    });
    ws.on("error", (e) => {
      clearTimeout(timeout);
      reject(new Error(e.message || "WebSocket error"));
    });
    ws.on("close", (code) => {
      if (code !== 1000 && code !== 1005) {
        clearTimeout(timeout);
        reject(new Error(`WebSocket closed unexpectedly (${code})`));
      }
    });
  });
}

export async function POST(request: Request) {
  if (!(await isAdminRequest(request))) {
    return Response.json({ ok: false, error: "Admin login required" }, { status: 401 });
  }

  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }
  const sourceUrl = (body.url || "").trim();
  if (!/^https?:\/\//i.test(sourceUrl)) {
    return Response.json({ ok: false, error: "Provide a valid direct http(s) video link" }, { status: 400 });
  }

  const settings = await getAbyssSettings();
  if (!settings) {
    return Response.json(
      { ok: false, error: "Abyss settings missing — configure Admin → Settings → Abyss.to Upload API." },
      { status: 503 }
    );
  }

  // ---- preferred: instant remote upload with session cookie ----
  if (settings.session_cookie) {
    try {
      const result = await remoteUploadViaSocket(sourceUrl, settings.session_cookie);
      const id =
        (result.id as string) ||
        (result.slug as string) ||
        (typeof (result as Record<string, unknown>).result === "string"
          ? ((result as Record<string, string>).result as string)
          : undefined) ||
        (typeof (result as Record<string, unknown>).data === "object"
          ? ((result as { data: Record<string, string> }).data.id ||
            (result as { data: Record<string, string> }).data.slug)
          : undefined);
      if (!id) {
        return Response.json(
          { ok: false, error: "Remote upload finished but no id/slug in the response", details: result },
          { status: 502 }
        );
      }
      return Response.json({
        ok: true,
        slug: id,
        embedUrl: `https://player.abyssplayer.com/${id}`,
        details: result,
        method: "remote",
      });
    } catch (e) {
      return Response.json(
        {
          ok: false,
          error: e instanceof Error ? e.message : "Remote upload failed",
          hint: "Your session cookie may have expired — update it in Admin → Settings.",
        },
        { status: 502 }
      );
    }
  }

  // ---- fallback: download on server + multipart upload with API key ----
  if (!settings.api_key) {
    return Response.json(
      { ok: false, error: "Abyss API key missing — set it in Admin → Settings → Abyss.to Upload API." },
      { status: 503 }
    );
  }

  const tmpPath = join(tmpdir(), `animelk-abyss-${Date.now()}-${Math.random().toString(36).slice(2)}.part`);
  try {
    const res = await fetch(sourceUrl, {
      redirect: "follow",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(600000),
    });
    if (!res.ok || !res.body) {
      return Response.json(
        { ok: false, error: `Download failed (${res.status}) — is it a public direct link?` },
        { status: 502 }
      );
    }
    await pipeline(Readable.fromWeb(res.body as never), createWriteStream(tmpPath));
    const size = (await stat(tmpPath)).size;
    if (size === 0) {
      return Response.json({ ok: false, error: "Downloaded file was empty" }, { status: 502 });
    }

    const rawName = deriveFilename(sourceUrl);
    const name = rawName.toLowerCase().endsWith(".mp4") ? rawName : rawName.split(".")[0] + ".mp4";
    const boundary = `----animelk${Date.now()}${Math.random().toString(36).slice(2)}`;
    const header = Buffer.from(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="${name.replace(/"/g, "")}"\r\n` +
        `Content-Type: video/mp4\r\n\r\n`
    );
    const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
    const bodyStream = new PassThrough();
    bodyStream.write(header);
    const fileStream = createReadStream(tmpPath);
    fileStream.on("data", (c) => bodyStream.write(c));
    fileStream.on("end", () => bodyStream.end(footer));
    fileStream.on("error", () => bodyStream.destroy());

    const uploadRes = await fetch(`https://up.hydrax.net/${settings.api_key}`, {
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": String(header.length + size + footer.length),
        "User-Agent": "Mozilla/5.0",
      },
      body: bodyStream as unknown as BodyInit,
      // @ts-expect-error Node stream duplex
      duplex: "half",
      signal: AbortSignal.timeout(600000),
    });

    const text = await uploadRes.text();
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text.slice(0, 500) };
    }

    if (!uploadRes.ok) {
      return Response.json(
        { ok: false, error: `Abyss upload failed (${uploadRes.status})`, details: parsed },
        { status: 502 }
      );
    }

    const slug =
      (parsed.slug as string) ||
      (typeof (parsed.data as Record<string, unknown> | undefined)?.slug === "string"
        ? ((parsed.data as Record<string, string>).slug as string)
        : undefined);
    const urlIframe = parsed.urlIframe as string | undefined;

    if (!slug && !urlIframe) {
      return Response.json(
        { ok: false, error: "Upload succeeded but no slug in the response", details: parsed },
        { status: 502 }
      );
    }

    return Response.json({
      ok: true,
      slug,
      embedUrl: urlIframe || `https://player.abyssplayer.com/${slug}`,
      details: parsed,
      method: "file",
    });
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : "Upload failed" },
      { status: 500 }
    );
  } finally {
    unlink(tmpPath).catch(() => {});
  }
}
