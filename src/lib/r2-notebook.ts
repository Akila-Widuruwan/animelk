import { downloadNotebook } from "./hardsub-notebook";

export interface R2Target {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicUrl: string;
}

export interface AbyssTarget {
  apiKey: string;
  uploadBase: string;
}

export interface TransferNotebookOptions {
  videoUrl: string;
  filename: string;
  r2: R2Target | null;
  abyss: AbyssTarget | null;
}

function pyString(s: string): string {
  return JSON.stringify(s);
}

export function buildTransferNotebook(opts: TransferNotebookOptions): string {
  const { videoUrl, filename, r2, abyss } = opts;
  const endpoint = r2
    ? `https://${r2.accountId.replace(/^https?:\/\//, "").replace(/\/$/, "")}.r2.cloudflarestorage.com`
    : "";

  const cells: unknown[] = [];

  cells.push({
    cell_type: "markdown",
    metadata: {},
    source:
      "# ANIMELK — remote transfer\n\nRuns entirely on Google's servers — your device/connection is not used.\n1. Downloads the direct video link\n2. Fixes container/audio for browser playback (MKV → MP4, DDP → AAC)\n" +
      (r2 ? "3. Uploads to Cloudflare R2 with parallel multipart\n" : "") +
      (abyss ? `${r2 ? "4" : "3"}. Remote-uploads to abyss.to with your API key\n` : "") +
      (r2 ? `\nFinal step: copy the printed ${r2.publicUrl.replace(/\/+$/, "")}/... URL into the episode.` : "\nFinal step: copy the printed embed URL into the episode."),
  });

  const configLines = [
    "VIDEO_URL = " + pyString(videoUrl) + "\n",
    "FILENAME = " + pyString(filename || "video.mp4") + "\n",
  ];
  if (r2) {
    configLines.push(
      "R2_ENDPOINT = " + pyString(endpoint) + "\n",
      "R2_BUCKET = " + pyString(r2.bucket) + "\n",
      "R2_PUBLIC = " + pyString(r2.publicUrl.replace(/\/+$/, "")) + "\n",
      "R2_ACCESS_KEY = " + pyString(r2.accessKeyId) + "\n",
      "R2_SECRET_KEY = " + pyString(r2.secretAccessKey) + "\n"
    );
  }
  if (abyss) {
    configLines.push(
      "ABYSS_KEY = " + pyString(abyss.apiKey) + "\n",
      "ABYSS_BASE = " + pyString(abyss.uploadBase || "https://up.hydrax.net") + "\n"
    );
  }
  configLines.push("\n", "print('configured:', FILENAME)\n");
  cells.push({
    cell_type: "code",
    execution_count: null,
    metadata: {},
    outputs: [],
    source: configLines,
  });

  cells.push({
    cell_type: "code",
    execution_count: null,
    metadata: {},
    outputs: [],
    source: [
      "# install dependencies\n",
      "!pip install -q " + (r2 ? "boto3 " : "") + "requests\n",
      "print('deps ready')\n",
    ],
  });

  cells.push({
    cell_type: "code",
    execution_count: null,
    metadata: {},
    outputs: [],
    source: [
      "import requests, os, sys\n",
      "import json\n",
      "print('downloading from:', VIDEO_URL)\n",
      "r = requests.get(VIDEO_URL, stream=True, timeout=600, headers={'User-Agent': 'Mozilla/5.0'})\n",
      "r.raise_for_status()\n",
      "total = int(r.headers.get('content-length') or 0)\n",
      "done = 0\n",
      "with open('video.bin', 'wb') as f:\n",
      "    for chunk in r.iter_content(2 * 1024 * 1024):\n",
      "        f.write(chunk)\n",
      "        done += len(chunk)\n",
      "        if total:\n",
      "            print(f'  downloaded {done/1e6:.1f}/{total/1e6:.1f} MB', end='\\r')\n",
      "print()\n",
      "size = os.path.getsize('video.bin')\n",
      "print(f'download complete: {size/1e6:.1f} MB')\n",
      "\n",
      "# sanity check: what file did the link actually point to?\n",
      "from urllib.parse import urlparse, unquote\n",
      "src_name = unquote(urlparse(VIDEO_URL).path.split('/')[-1])\n",
      "print('source file name:', src_name or '(unknown)')\n",
      "if src_name and src_name.lower() != FILENAME.lower():\n",
      "    print('!! WARNING: the link is for \"' + src_name + '\" but FILENAME is \"' + FILENAME + '\" — check the link or fix the filename!')\n",
    ],
  });

  cells.push({
    cell_type: "code",
    execution_count: null,
    metadata: {},
    outputs: [],
    source: [
      "# --- container + audio fix ---\n",
      "# Browsers cannot play MKV containers or E-AC-3/DTS audio. Remux to MP4 with AAC audio\n",
      "# (video stream is copied — no quality loss). Subtitle/attachment streams are dropped.\n",
      "import subprocess\n",
      "\n",
      "probe = subprocess.run(\n",
      "    ['ffprobe', '-v', 'error', '-show_entries', 'format=format_name:stream=codec_name,codec_type', '-of', 'json', 'video.bin'],\n",
      "    capture_output=True, text=True,\n",
      ")\n",
      "try:\n",
      "    info = json.loads(probe.stdout)\n",
      "    fmt = info.get('format', {}).get('format_name', '')\n",
      "    audio_codecs = [s.get('codec_name') for s in info.get('streams', []) if s.get('codec_type') == 'audio']\n",
      "except Exception:\n",
      "    fmt, audio_codecs = '', []\n",
      "\n",
      "print('container:', fmt or '(unknown)')\n",
      "print('audio codecs:', audio_codecs)\n",
      "\n",
      "is_mp4 = 'mp4' in fmt\n",
      "audio_ok = all(c in ('aac', 'mp3') for c in audio_codecs) if audio_codecs else True\n",
      "\n",
      "if not (is_mp4 and audio_ok):\n",
      "    print('remuxing to MP4 + AAC audio...')\n",
      "    conv = subprocess.run(\n",
      "        ['ffmpeg', '-y', '-i', 'video.bin', '-map', '0:v:0', '-map', '0:a?',\n",
      "         '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', 'video.fixed.mp4'],\n",
      "        capture_output=True,\n",
      "    )\n",
      "    if conv.returncode == 0:\n",
      "        os.replace('video.fixed.mp4', 'video.bin')\n",
      "        print('done: MP4 with AAC audio')\n",
      "    else:\n",
      "        print('ffmpeg failed:')\n",
      "        print(conv.stderr.decode()[-600:])\n",
      "        raise SystemExit('fix the file and try again')\n",
      "else:\n",
      "    print('already browser-compatible (MP4 + AAC)')\n",
    ],
  });

  if (r2) {
    cells.push({
      cell_type: "code",
      execution_count: null,
      metadata: {},
      outputs: [],
      source: [
        "# --- upload to Cloudflare R2 (parallel multipart) ---\n",
        "from boto3.s3.transfer import TransferConfig\n",
        "import boto3\n",
        "\n",
        "class Progress:\n",
        "    def __init__(self):\n",
        "        self.n = 0\n",
        "    def __call__(self, b):\n",
        "        self.n += b\n",
        "        print(f'  uploaded {self.n/1e6:.1f} MB', end='\\r')\n",
        "\n",
        "s3 = boto3.client(\n",
        "    's3',\n",
        "    endpoint_url=R2_ENDPOINT,\n",
        "    aws_access_key_id=R2_ACCESS_KEY,\n",
        "    aws_secret_access_key=R2_SECRET_KEY,\n",
        "    region_name='auto',\n",
        ")\n",
        "cfg = TransferConfig(\n",
        "    multipart_threshold=8 * 1024 * 1024,\n",
        "    multipart_chunksize=8 * 1024 * 1024,\n",
        "    max_concurrency=16,\n",
        "    use_threads=True,\n",
        ")\n",
        "print('uploading to R2...')\n",
        "s3.upload_file('video.bin', R2_BUCKET, FILENAME, ExtraArgs={'ContentType': 'video/mp4'}, Config=cfg, Callback=Progress())\n",
        "print()\n",
        "print('R2 DONE:', R2_PUBLIC + '/' + FILENAME)\n",
        "DIRECT_URL = R2_PUBLIC + '/' + FILENAME\n",
      ],
    });
  }

  if (abyss && !r2) {
    // abyss.to accepts direct multipart file uploads — nothing else needed
  }

  if (abyss) {
    cells.push({
      cell_type: "code",
      execution_count: null,
      metadata: {},
      outputs: [],
      source: [
        "# --- direct file upload to abyss.to ---\n",
        "# API: POST up.hydrax.net/{apiKey}  (multipart form field \"file\")  ->  {\"slug\": \"file-id\"}\n",
        "print('uploading to abyss.to...')\n",
        "name = FILENAME if FILENAME.lower().endswith('.mp4') else FILENAME.rsplit('.', 1)[0] + '.mp4'\n",
        "with open('video.bin', 'rb') as f:\n",
        "    r = requests.post(ABYSS_BASE.rstrip('/') + '/' + ABYSS_KEY, files={'file': (name, f, 'video/mp4')}, timeout=600)\n",
        "print('abyss status:', r.status_code)\n",
        "try:\n",
        "    resp = r.json()\n",
        "except Exception:\n",
        "    resp = {'raw': r.text[:1000]}\n",
        "print(json.dumps(resp, indent=2)[:2000])\n",
        "\n",
        "slug = resp.get('slug') if isinstance(resp, dict) else None\n",
        "if slug:\n",
        "    print('ABYSS DONE — EMBED URL: https://player.abyssplayer.com/' + slug)\n",
        "    print('Paste this into the episode Video URL.')\n",
        "else:\n",
        "    print('No slug in response — check the API key / base URL above.')\n",
      ],
    });
  }

  return JSON.stringify(
    {
      cells,
      metadata: {
        colab: { provenance: [], name: `transfer-${filename}.ipynb` },
        kernelspec: { name: "python3", display_name: "Python 3" },
        language_info: { name: "python" },
      },
      nbformat: 4,
      nbformat_minor: 0,
    },
    null,
    1
  );
}

export function buildTransferScript(opts: TransferNotebookOptions): string {
  const { videoUrl, filename, r2, abyss } = opts;
  const endpoint = r2
    ? `https://${r2.accountId.replace(/^https?:\/\//, "").replace(/\/$/, "")}.r2.cloudflarestorage.com`
    : "";

  const lines: string[] = [];
  lines.push(
    "# ANIMELK local transfer script — run on YOUR machine (no Colab needed).",
    "# Requires:  pip install requests boto3   +   ffmpeg/ffprobe in PATH (winget install ffmpeg)",
    "#            https://ffmpeg.org/download.html",
    "",
    "import requests, os, sys, json, subprocess",
    "",
    "VIDEO_URL = " + pyString(videoUrl),
    "FILENAME = " + pyString(filename || "video.mp4")
  );
  if (r2) {
    lines.push(
      "R2_ENDPOINT = " + pyString(endpoint),
      "R2_BUCKET = " + pyString(r2.bucket),
      "R2_PUBLIC = " + pyString(r2.publicUrl.replace(/\/+$/, "")),
      "R2_ACCESS_KEY = " + pyString(r2.accessKeyId),
      "R2_SECRET_KEY = " + pyString(r2.secretAccessKey)
    );
  }
  if (abyss) {
    lines.push(
      "ABYSS_KEY = " + pyString(abyss.apiKey),
      "ABYSS_BASE = " + pyString(abyss.uploadBase || "https://up.hydrax.net")
    );
  }
  lines.push(
    "",
    "# ---------- 1) download ----------",
    "print('downloading from:', VIDEO_URL)",
    "r = requests.get(VIDEO_URL, stream=True, timeout=600, headers={'User-Agent': 'Mozilla/5.0'})",
    "r.raise_for_status()",
    "total = int(r.headers.get('content-length') or 0)",
    "done = 0",
    "with open('video.bin', 'wb') as f:",
    "    for chunk in r.iter_content(2 * 1024 * 1024):",
    "        f.write(chunk)",
    "        done += len(chunk)",
    "        if total:",
    "            print(f'  downloaded {done/1e6:.1f}/{total/1e6:.1f} MB', end='\\r')",
    "print()",
    "print(f'download complete: {os.path.getsize(\"video.bin\")/1e6:.1f} MB')",
    "",
    "# sanity check: what file did the link actually point to?",
    "from urllib.parse import urlparse, unquote",
    "src_name = unquote(urlparse(VIDEO_URL).path.split('/')[-1])",
    "print('source file name:', src_name or '(unknown)')",
    "if src_name and src_name.lower() != FILENAME.lower():",
    "    print('!! WARNING: the link is for \"' + src_name + '\" but FILENAME is \"' + FILENAME + '\" — check the link or fix the filename!')",
    "",
    "# ---------- 2) container/audio fix (MKV -> MP4, DDP -> AAC) ----------",
    "def ensure_ffmpeg():",
    "    if subprocess.run(['ffmpeg', '-version'], capture_output=True).returncode == 0:",
    "        return",
    "    print('ffmpeg not found — installing...')",
    "    if sys.platform.startswith('linux'):",
    "        r = subprocess.run(['sudo', 'apt-get', 'install', '-y', 'ffmpeg'], capture_output=True)",
    "        if r.returncode != 0:",
    "            print('auto-install failed, run manually:  sudo apt-get update && sudo apt-get install -y ffmpeg')",
    "            sys.exit(1)",
    "    elif sys.platform == 'win32':",
    "        print('Install ffmpeg first:  winget install ffmpeg   (or https://ffmpeg.org/download.html)')",
    "        sys.exit(1)",
    "    else:",
    "        print('Install ffmpeg from https://ffmpeg.org/download.html')",
    "        sys.exit(1)",
    "    if subprocess.run(['ffmpeg', '-version'], capture_output=True).returncode != 0:",
    "        print('ffmpeg still not available')",
    "        sys.exit(1)",
    "    print('ffmpeg ready')",
    "",
    "ensure_ffmpeg()",
    "probe = subprocess.run(",
    "    ['ffprobe', '-v', 'error', '-show_entries', 'format=format_name:stream=codec_name,codec_type', '-of', 'json', 'video.bin'],",
    "    capture_output=True, text=True)",
    "try:",
    "    info = json.loads(probe.stdout)",
    "    fmt = info.get('format', {}).get('format_name', '')",
    "    audio_codecs = [s.get('codec_name') for s in info.get('streams', []) if s.get('codec_type') == 'audio']",
    "except Exception:",
    "    fmt, audio_codecs = '', []",
    "print('container:', fmt or '(unknown)', '| audio:', audio_codecs)",
    "is_mp4 = 'mp4' in fmt",
    "audio_ok = all(c in ('aac', 'mp3') for c in audio_codecs) if audio_codecs else True",
    "if not (is_mp4 and audio_ok):",
    "    print('remuxing to MP4 + AAC...')",
    "    conv = subprocess.run(",
    "        ['ffmpeg', '-y', '-i', 'video.bin', '-map', '0:v:0', '-map', '0:a?',",
    "         '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', 'video.fixed.mp4'],",
    "        capture_output=True)",
    "    if conv.returncode != 0:",
    "        print(conv.stderr.decode()[-600:])",
    "        sys.exit(1)",
    "    os.replace('video.fixed.mp4', 'video.bin')",
    "    print('fixed: MP4 + AAC')",
    ""
  );

  if (r2) {
    lines.push(
      "# ---------- 3) upload to Cloudflare R2 ----------",
      "try:",
      "    import boto3",
      "    from boto3.s3.transfer import TransferConfig",
      "except ImportError:",
      "    print('installing boto3...')",
      "    subprocess.run([sys.executable, '-m', 'pip', 'install', '-q', 'boto3'], check=True)",
      "    import boto3",
      "    from boto3.s3.transfer import TransferConfig",
      "",
      "s3 = boto3.client('s3', endpoint_url=R2_ENDPOINT, aws_access_key_id=R2_ACCESS_KEY,",
      "                  aws_secret_access_key=R2_SECRET_KEY, region_name='auto')",
      "cfg = TransferConfig(multipart_threshold=8*1024*1024, multipart_chunksize=8*1024*1024,",
      "                     max_concurrency=16, use_threads=True)",
      "print('uploading to R2...')",
      "s3.upload_file('video.bin', R2_BUCKET, FILENAME, ExtraArgs={'ContentType': 'video/mp4'}, Config=cfg)",
      "print('R2 DONE:', R2_PUBLIC + '/' + FILENAME)",
      "DIRECT_URL = R2_PUBLIC + '/' + FILENAME",
      ""
    );
  }

  if (abyss && !r2) {
    // abyss.to accepts direct multipart file uploads — nothing else needed
  }

  if (abyss) {
    lines.push(
      "# ---------- 3) direct file upload to abyss.to ----------",
      "# API: POST up.hydrax.net/{apiKey}  (multipart form field \"file\")  ->  {\"slug\": \"file-id\"}",
      "print('uploading to abyss.to...')",
      "name = FILENAME if FILENAME.lower().endswith('.mp4') else FILENAME.rsplit('.', 1)[0] + '.mp4'",
      "with open('video.bin', 'rb') as f:",
      "    r = requests.post(ABYSS_BASE.rstrip('/') + '/' + ABYSS_KEY, files={'file': (name, f, 'video/mp4')}, timeout=600)",
      "print('abyss status:', r.status_code)",
      "try:",
      "    resp = r.json()",
      "except Exception:",
      "    resp = {'raw': r.text[:1000]}",
      "print(json.dumps(resp, indent=2)[:2000])",
      "",
      "slug = resp.get('slug') if isinstance(resp, dict) else None",
      "if slug:",
      "    print('ABYSS DONE — EMBED URL: https://player.abyssplayer.com/' + slug)",
      "    print('Paste this into the episode Video URL.')",
      "else:",
      "    print('No slug in response — check the API key / base URL above.')",
      ""
    );
  }

  lines.push(
    "print('ALL DONE')",
    "os.remove('video.bin')"
  );

  return lines.join("\n");
}

export { downloadNotebook };



