import { isAdminRequest } from "@/lib/admin-auth";
import { getR2Config, publicObjectUrl, sanitizeObjectKey, signUpload } from "@/lib/r2";

export const dynamic = "force-dynamic";

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

  let body: { filename?: string; contentType?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const filename = sanitizeObjectKey(body.filename || "");
  const contentType = body.contentType || "video/mp4";

  const signed = await signUpload(config, filename, contentType);

  return Response.json({
    ok: true,
    upload: signed,
    filename,
    publicUrl: publicObjectUrl(config, filename),
  });
}
