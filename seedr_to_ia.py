import importlib.util
import getpass
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
from internetarchive import configure, get_item, upload

DELETE_AFTER_UPLOAD = True
CONVERT_TO_MP4 = False
CHUNK_SIZE = 1024 * 1024
DOWNLOAD_RETRIES = 3


def get_auth():
    email = os.environ.get("IA_EMAIL") or input("Archive.org email: ").strip()
    password = os.environ.get("IA_PASSWORD") or getpass.getpass("Archive.org password: ")
    configure(email, password)
    print("Archive.org login configured.")
    return email


def resolve_identifier(email):
    while True:
        identifier = input("Archive.org item ID (e.g. my-video-item): ").strip()
        if not identifier:
            continue
        try:
            item = get_item(identifier)
        except Exception:
            return identifier
        if not item.exists:
            return identifier
        uploader = (item.metadata or {}).get("uploader", "").lower()
        if uploader == email.lower():
            print("Item exists and belongs to you; uploading into it.")
            return identifier
        print(f"Item '{identifier}' belongs to '{uploader}'. Pick a different ID.")


def collect_jobs(email):
    jobs = []
    while True:
        print("\n--- New upload job ---")
        url = input("Seedr direct download link: ").strip()
        filename = input("File name to save as (e.g. video.mkv): ").strip()
        identifier = resolve_identifier(email)
        title = input("Title: ").strip() or filename
        if not url or not filename:
            print("Missing link or filename, skipping this job.")
        else:
            jobs.append(
                {
                    "url": url,
                    "filename": filename,
                    "identifier": identifier,
                    "title": title,
                }
            )
        more = input("Add another file? (y/n): ").strip().lower()
        if more != "y":
            return jobs


def ensure_ffmpeg():
    if shutil.which("ffmpeg"):
        return
    print("ffmpeg not found, installing it (sudo required)...")
    subprocess.check_call(["sudo", "apt-get", "update", "-qq"])
    subprocess.check_call(["sudo", "apt-get", "install", "-y", "-qq", "ffmpeg"])


def is_playable(path):
    try:
        probe = subprocess.run(
            [
                "ffprobe", "-v", "error", "-select_streams", "v:0",
                "-show_entries", "stream=codec_name,pix_fmt",
                "-of", "default=noprint_wrappers=1", path,
            ],
            capture_output=True, text=True, timeout=60,
        )
        if probe.returncode != 0:
            return False
        info = {}
        for line in probe.stdout.splitlines():
            if "=" in line:
                key, value = line.split("=", 1)
                info[key.strip()] = value.strip()
        return info.get("codec_name") == "h264" and info.get("pix_fmt") == "yuv420p"
    except Exception:
        return False


def convert_to_mp4(path):
    dest = os.path.splitext(path)[0] + "-web.mp4"
    print(f"Converting to browser-playable MP4: {dest}")
    subprocess.run(
        [
            "ffmpeg", "-y", "-i", path,
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "21",
            "-pix_fmt", "yuv420p", "-c:a", "aac",
            "-movflags", "+faststart", dest,
        ],
        check=True,
    )
    return dest


def free_space():
    stat = os.statvfs(".")
    return stat.f_frsize * stat.f_bavail


def remote_size(url):
    try:
        resp = requests.head(url, timeout=30)
        return int(resp.headers.get("content-length", 0))
    except Exception:
        return 0


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
                    total=total,
                    initial=existing,
                    unit="B",
                    unit_scale=True,
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


def upload_one(job, path):
    metadata = {
        "title": job["title"],
        "mediatype": "movies",
        "collection": "opensource_movies",
    }
    print(f"Uploading {path} to archive.org item '{job['identifier']}'...")
    upload(job["identifier"], files=[path], metadata=metadata, retries=10, verbose=True)
    print(f"Uploaded https://archive.org/details/{job['identifier']}")
    file_url = (
        f"https://archive.org/download/{job['identifier']}/{os.path.basename(path)}"
    )
    print(f"Direct URL: {file_url}")
    print("\nMovi-player embed code:\n")
    print(embed_html(file_url))


def embed_html(file_url):
    return (
        "<iframe srcdoc='<!doctype html><meta charset=\"utf-8\">"
        "<style>html,body{margin:0;height:100%;overflow:hidden;background:#000}"
        "movi-player{width:100%;height:100%}</style>"
        "<script type=\"module\" "
        "src=\"https://cdn.jsdelivr.net/npm/movi-player/dist/element.js\"></script>"
        f"<movi-player src=\"{file_url}\" renderer=\"canvas\" controls "
        "objectfit=\"control\" gesturefs fastseek stablevolume "
        "fallback=\"native\" autoplay thumb></movi-player>' "
        "style=\"display:block;box-sizing:border-box;border:0;margin:0;"
        "padding:0;width:100%;max-width:800px;aspect-ratio:16/9;"
        "height:auto;background:#000\" width=\"800\" height=\"450\" "
        "frameborder=\"0\" allowfullscreen allow=\"fullscreen; autoplay\">"
        "</iframe>"
    )


def main():
    email = get_auth()
    jobs = collect_jobs(email)
    if not jobs:
        print("No jobs to run.")
        return
    for job in jobs:
        size = remote_size(job["url"])
        if size and size > free_space():
            raise SystemExit(
                "Not enough free disk space in this Codespace. "
                "Resize to 128GB or delete files first."
            )
        download(job["url"], job["filename"])
        converted = None
        if CONVERT_TO_MP4 and not is_playable(job["filename"]):
            ensure_ffmpeg()
            if size and size * 2 > free_space():
                raise SystemExit(
                    "Not enough free disk space for conversion. "
                    "Resize the Codespace to 128GB."
                )
            converted = convert_to_mp4(job["filename"])
        upload_path = converted or job["filename"]
        upload_one(job, upload_path)
        if converted and os.path.exists(converted):
            os.remove(converted)
        if DELETE_AFTER_UPLOAD and os.path.exists(job["filename"]):
            os.remove(job["filename"])
            print(f"Removed local copy of {job['filename']}")
    print("All jobs finished.")


if __name__ == "__main__":
    main()
