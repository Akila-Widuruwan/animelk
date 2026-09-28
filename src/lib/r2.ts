import { AwsClient } from "aws4fetch";
import { Readable as NodeReadable, Transform } from "node:stream";
import { createReadStream } from "node:fs";

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicUrl: string;
}

export function getR2Config(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  const publicUrl = process.env.R2_PUBLIC_URL;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicUrl) {
    return null;
  }
  return { accountId, accessKeyId, secretAccessKey, bucket, publicUrl };
}

export function publicObjectUrl(config: R2Config, key: string): string {
  return `${config.publicUrl.replace(/\/+$/, "")}/${key.replace(/^\/+/, "")}`;
}

export function sanitizeObjectKey(raw: string): string {
  const key = raw
    .trim()
    .replace(/^\/+/, "")
    .replace(/\.\./g, "")
    .replace(/[^\w.\-/\u00C0-\u024F]+/g, "-");
  return key || `video-${Date.now()}.mp4`;
}

export async function signUpload(
  config: R2Config,
  key: string,
  contentType: string,
  expiresSeconds = 3600
): Promise<{ url: string; method: string; headers: Record<string, string> }> {
  const client = new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
  });
  const url = new URL(
    `https://${config.accountId}.r2.cloudflarestorage.com/${config.bucket}/${encodeURIComponent(key).replace(/%2F/g, "/")}`
  );
  url.searchParams.set("X-Amz-Expires", String(expiresSeconds));

  const signed = await client.sign(
    new Request(url, {
      method: "PUT",
      headers: { "Content-Type": contentType },
    }),
    { aws: { signQuery: true } }
  );

  const headers: Record<string, string> = {};
  signed.headers.forEach((value, name) => {
    headers[name] = value;
  });

  return { url: signed.url, method: signed.method, headers };
}

const MULTIPART_MIN = 5 * 1024 * 1024;

function clientFor(config: R2Config): AwsClient {
  return new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
  });
}

function objectUrl(config: R2Config, key: string, query = ""): URL {
  return new URL(
    `https://${config.accountId}.r2.cloudflarestorage.com/${config.bucket}/${encodeURIComponent(key).replace(/%2F/g, "/")}${query}`
  );
}

async function signedFetch(
  client: AwsClient,
  method: string,
  url: URL,
  extraHeaders: Record<string, string> = {},
  body?: NodeReadable | string
): Promise<Response> {
  const headers: Record<string, string> = {
    "X-Amz-Content-Sha256": "UNSIGNED-PAYLOAD",
    ...extraHeaders,
  };
  const req = new Request(url, {
    method,
    headers,
    ...(body ? { body: body as unknown as BodyInit, duplex: "half" } : {}),
  } as RequestInit);
  const signed = await client.sign(req);
  return fetch(signed.url, {
    method,
    headers: signed.headers,
    ...(body ? { body: body as unknown as BodyInit, duplex: "half" } : {}),
  } as unknown as RequestInit);
}

export async function uploadFileToR2(
  config: R2Config,
  key: string,
  contentType: string,
  filePath: string,
  size: number,
  onProgress?: (uploaded: number) => void
): Promise<{ key: string; publicUrl: string }> {
  const client = clientFor(config);

  if (size <= MULTIPART_MIN) {
    // ---------- single PUT ----------
    let uploaded = 0;
    const counter = new Transform({
      transform(chunk: Buffer, _enc, cb) {
        uploaded += chunk.length;
        onProgress?.(uploaded);
        cb(null, chunk);
      },
    });
    const body = createReadStream(filePath).pipe(counter);
    const res = await signedFetch(client, "PUT", objectUrl(config, key), {
      "Content-Type": contentType,
      "Content-Length": String(size),
    }, body);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`R2 upload failed (${res.status}): ${text.slice(0, 200)}`);
    }
    return { key, publicUrl: publicObjectUrl(config, key) };
  }

  // ---------- multipart upload ----------
  const init = await signedFetch(client, "POST", objectUrl(config, key, "?uploads"));
  if (!init.ok) {
    const text = await init.text().catch(() => "");
    throw new Error(`R2 multipart init failed (${init.status}): ${text.slice(0, 200)}`);
  }
  const initXml = await init.text();
  const uploadId = (initXml.match(/<UploadId>([^<]+)<\/UploadId>/) || [])[1];
  if (!uploadId) throw new Error("R2 multipart init: no UploadId returned");

  const concurrency = Math.max(
    1,
    Math.min(16, Number(process.env.R2_UPLOAD_CONCURRENCY) || 4)
  );
  const partSize = Math.max(MULTIPART_MIN, Math.ceil(size / 10000));
  const totalParts = Math.ceil(size / partSize);
  const etags: string[] = new Array(totalParts);
  let uploadedBytes = 0;

  const uploadPart = async (n: number): Promise<void> => {
    const start = (n - 1) * partSize;
    const end = Math.min(n * partSize, size) - 1;
    const partLen = end - start + 1;

    for (let attempt = 1; attempt <= 3; attempt++) {
      let partBytes = 0;
      const counter = new Transform({
        transform(chunk: Buffer, _enc, cb) {
          partBytes += chunk.length;
          onProgress?.(uploadedBytes + partBytes);
          cb(null, chunk);
        },
      });
      const body = createReadStream(filePath, { start, end }).pipe(counter);
      try {
        const res = await signedFetch(
          client,
          "PUT",
          objectUrl(config, key, `?partNumber=${n}&uploadId=${uploadId}`),
          { "Content-Type": "application/octet-stream", "Content-Length": String(partLen) },
          body
        );
        if (res.ok) {
          const etag = res.headers.get("etag")?.replace(/"/g, "");
          if (!etag) throw new Error(`part ${n} missing ETag`);
          etags[n - 1] = etag;
          uploadedBytes += partLen;
          onProgress?.(uploadedBytes);
          return;
        }
        const text = await res.text().catch(() => "");
        throw new Error(`part ${n} failed (${res.status}): ${text.slice(0, 120)}`);
      } catch (e) {
        if (attempt === 3) {
          await signedFetch(
            client,
            "DELETE",
            objectUrl(config, key, `?uploadId=${uploadId}`)
          ).catch(() => {});
          throw e;
        }
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }
    }
  };

  let nextPart = 1;
  const worker = async () => {
    while (true) {
      const n = nextPart++;
      if (n > totalParts) return;
      await uploadPart(n);
    }
  };

  try {
    await Promise.all(Array.from({ length: Math.min(concurrency, totalParts) }, worker));

    const partsXml =
      "<CompleteMultipartUpload>" +
      etags
        .map((e, i) => `<Part><PartNumber>${i + 1}</PartNumber><ETag>${e}</ETag></Part>`)
        .join("") +
      "</CompleteMultipartUpload>";
    const complete = await signedFetch(
      client,
      "POST",
      objectUrl(config, key, `?uploadId=${uploadId}`),
      { "Content-Type": "application/xml" },
      partsXml
    );
    if (!complete.ok) {
      const text = await complete.text().catch(() => "");
      throw new Error(`R2 multipart complete failed (${complete.status}): ${text.slice(0, 200)}`);
    }
  } catch (e) {
    await signedFetch(client, "DELETE", objectUrl(config, key, `?uploadId=${uploadId}`)).catch(
      () => {}
    );
    throw e;
  }

  return { key, publicUrl: publicObjectUrl(config, key) };
}

export function contentTypeForFilename(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    mp4: "video/mp4",
    m4v: "video/x-m4v",
    mkv: "video/x-matroska",
    webm: "video/webm",
    mov: "video/quicktime",
    avi: "video/x-msvideo",
    mpeg: "video/mpeg",
    ogv: "video/ogg",
  };
  return map[ext] ?? "application/octet-stream";
}
