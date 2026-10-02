import getpass
import importlib.util
import os
import shutil
import subprocess
import sys

DEPENDENCIES = {
    "requests": "requests",
    "tqdm": "tqdm",
    "internetarchive": "internetarchive",
}

MISSING = [
    pip_name
    for module, pip_name in DEPENDENCIES.items()
    if importlib.util.find_spec(module) is None
]

if MISSING:
    print(f"Installing missing packages: {', '.join(MISSING)}")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-q"] + MISSING)

import requests
from tqdm import tqdm
from internetarchive import configure, upload

CHUNK_SIZE = 1024 * 1024
DOWNLOAD_RETRIES = 3
TARGETS = [
    {"height": 720, "suffix": "720p"},
    {"height": 480, "suffix": "480p"},
]


def ensure_ffmpeg():
    if shutil.which("ffmpeg") and shutil.which("ffprobe"):
        return
    print("ffmpeg not found, installing it...")
    subprocess.check_call(
        "sudo apt-get update -qq && sudo apt-get install -y -qq ffmpeg",
        shell=True,
    )


def has_gpu():
    try:
        return subprocess.run(["nvidia-smi"], capture_output=True).returncode == 0
    except Exception:
        return False


def encoder_for(use_gpu):
    if not use_gpu:
        return "libx264", ["-preset", "veryfast", "-crf", "23"]
    try:
        out = subprocess.run(
            ["ffmpeg", "-hide_banner", "-encoders"], capture_output=True, text=True
        ).stdout
        if "h264_nvenc" in out:
            return "h264_nvenc", ["-preset", "p4", "-cq", "23", "-rc", "vbr"]
    except Exception:
        pass
    print("Warning: no NVENC encoder in ffmpeg, falling back to CPU x264.")
    return "libx264", ["-preset", "veryfast", "-crf", "23"]


def probe_height(path):
    try:
        out = subprocess.run(
            [
                "ffprobe", "-v", "error", "-select_streams", "v:0",
                "-show_entries", "stream=height", "-of", "csv=p=0", path,
            ],
            capture_output=True, text=True, timeout=60,
        )
        return int(out.stdout.strip().splitlines()[0])
    except Exception:
        return None


def download(url, dest):
    existing = os.path.getsize(dest) if os.path.exists(dest) else 0
    headers = {"Range": f"bytes={existing}-"} if existing else {}
    for attempt in range(1, DOWNLOAD_RETRIES + 1):
        try:
            with requests.get(url, headers=headers, stream=True, timeout=60) as resp:
                if resp.status_code == 416:
                    print(f"{dest} already fully downloaded.")
                    return
                resp.raise_for_status()
                total = int(resp.headers.get("content-length", 0)) + existing
                mode = "ab" if existing else "wb"
                with open(dest, mode) as f, tqdm(
                    total=total, initial=existing, unit="B", unit_scale=True,
                    desc=os.path.basename(dest),
                ) as bar:
                    for chunk in resp.iter_content(CHUNK_SIZE):
                        f.write(chunk)
                        bar.update(len(chunk))
            print(f"Downloaded {dest}")
            return
        except Exception as exc:
            print(f"Download attempt {attempt} failed: {exc}")
            existing = os.path.getsize(dest) if os.path.exists(dest) else 0
            headers = {"Range": f"bytes={existing}-"}
    raise RuntimeError(f"Could not download {url}")


def encode(src, height, dest, codec, opts):
    cmd = [
        "ffmpeg", "-y", "-i", src,
        "-vf", f"scale=-2:{height}",
        "-c:v", codec, *opts,
        "-c:a", "aac", "-b:a", "128k",
        "-movflags", "+faststart",
        dest,
    ]
    print(f"Encoding {os.path.basename(src)} -> {height}p ({codec})...")
    subprocess.run(cmd, check=True)
    print(f"Encoded {dest}")


def upload_one(identifier, path, title):
    print(f"Uploading {path} to archive.org item '{identifier}'...")
    upload(
        identifier,
        files=[path],
        metadata={
            "title": title,
            "mediatype": "movies",
            "collection": "opensource_movies",
        },
        retries=10,
        verbose=True,
    )
    print(
        f"Uploaded https://archive.org/download/{identifier}/{os.path.basename(path)}"
    )


def main():
    ensure_ffmpeg()
    use_gpu = has_gpu()
    print("GPU (NVENC):", "yes" if use_gpu else "no")
    codec, opts = encoder_for(use_gpu)

    url = input("1080p direct link (Seedr): ").strip()
    filename = input("File name to save as (e.g. video.mkv): ").strip() or "source.mkv"
    identifier = input("Archive.org item ID: ").strip()
    title = input("Title: ").strip() or os.path.splitext(filename)[0]

    email = os.environ.get("IA_EMAIL") or input("Archive.org email: ").strip()
    password = os.environ.get("IA_PASSWORD") or getpass.getpass("Archive.org password: ")
    configure(email, password)

    download(url, filename)
    src_height = probe_height(filename)
    if src_height is None:
        print("Could not read source resolution; encoding anyway.")
        src_height = 1080

    stem = os.path.splitext(filename)[0]
    outputs = []
    for target in TARGETS:
        if target["height"] >= src_height:
            print(f"Skipping {target['height']}p (source is only {src_height}p).")
            continue
        out = f"{stem}-{target['suffix']}.mp4"
        encode(filename, target["height"], out, codec, opts)
        outputs.append(out)

    upload_one(identifier, filename, title)
    for out in outputs:
        upload_one(identifier, out, title)

    print("\nMulti-quality line for Admin -> Episodes (video URL):")
    print("(first URL is the default quality — reorder if you want 720p/480p first)")
    lines = [
        f"https://archive.org/download/{identifier}/{os.path.basename(p)}"
        for p in [filename] + outputs
    ]
    print("|".join(lines))


if __name__ == "__main__":
    main()
