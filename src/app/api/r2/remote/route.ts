import { isAdminRequest } from "@/lib/admin-auth";
import {
  contentTypeForFilename,
  getR2Config,
  sanitizeObjectKey,
  uploadFileToR2,
} from "@/lib/r2";
import { createWriteStream } from "node:fs";
import { stat, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

export const dynamic = "force-dynamic";

export const maxDuration = 600;

const encoder = new TextEncoder();

function sse(
  controller: ReadableStreamDefaultController<Uint8Array>,
  event: string,
  data: Record<string, unknown>
) {
  controller.enqueue(
    encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  );
}

function deriveFilename(rawUrl: string, fallback: string | undefined): string {
  if (fallback && fallback.trim()) return fallback.trim();
  try {
    const u = new URL(rawUrl);
    const last = u.pathname.split("/").filter(Boolean).pop();
    if (last) return decodeURIComponent(last);
  } catch {
    // invalid URL — handled by caller
  }
  return "video.mp4";
}

export async function POST(request: Request) {
  const config = getR2Config();
  if (!config) {
    return Response.json(
      { ok: false, error: "R2 is not configured. Add R2_* variables to your environment." },
      { status: 503 }
    );
  }

  if (!(await isAdminRequest(request))) {
    return Response.json({ ok: false, error: "Admin login required" }, { status: 401 });
  }

  let body: { url?: string; filename?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const sourceUrl = (body.url || "").trim();
  if (!/^https?:\/\//i.test(sourceUrl)) {
    return Response.json(
      { ok: false, error: "Provide a valid direct http(s) video link" },
      { status: 400 }
    );
  }

  const filename = sanitizeObjectKey(deriveFilename(sourceUrl, body.filename));
  const contentType = contentTypeForFilename(filename);
  const tmpPath = join(tmpdir(), `animelk-${Date.now()}-${Math.random().toString(36).slice(2)}.part`);

  const abort = new AbortController();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const started = Date.now();
      try {
        sse(controller, "start", { filename });

        // ---------- 1) download with progress ----------
        const res = await fetch(sourceUrl, {
          redirect: "follow",
          signal: abort.signal,
          headers: {
            "user-agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
          },
        });
        if (!res.ok || !res.body) {
          sse(controller, "error", {
            message: `Download failed (${res.status}) — is it a public direct link?`,
          });
          return controller.close();
        }
        const total = Number(res.headers.get("content-length")) || 0;

        let downloaded = 0;
        let lastEmit = 0;
        const downloadCounter = new Transform({
          transform(chunk: Buffer, _enc, cb) {
            downloaded += chunk.length;
            const now = Date.now();
            if (now - lastEmit > 300) {
              lastEmit = now;
              sse(controller, "download", { bytes: downloaded, total });
            }
            cb(null, chunk);
          },
        });

        await pipeline(Readable.fromWeb(res.body as never), downloadCounter, createWriteStream(tmpPath));

        const size = (await stat(tmpPath)).size;
        if (size === 0) {
          sse(controller, "error", { message: "Downloaded file was empty" });
          return controller.close();
        }
        sse(controller, "download", { bytes: size, total: size });

        // ---------- 2) upload with progress ----------
        sse(controller, "upload-start", { size });

        const result = await uploadFileToR2(
          config,
          filename,
          contentType,
          tmpPath,
          size,
          (uploaded) => {
            const now = Date.now();
            if (now - lastEmit > 300) {
              lastEmit = now;
              sse(controller, "upload", { bytes: uploaded, total: size });
            }
          }
        );
        sse(controller, "upload", { bytes: size, total: size });

        sse(controller, "done", {
          filename: result.key,
          publicUrl: result.publicUrl,
          size,
          seconds: Math.round((Date.now() - started) / 1000),
        });
        controller.close();
      } catch (e) {
        sse(controller, "error", {
          message: e instanceof Error ? e.message : "Upload failed",
        });
        controller.close();
      } finally {
        unlink(tmpPath).catch(() => {});
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
