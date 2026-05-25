# make_catalog.py
import json
import os
import re

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT = os.path.join(BASE_DIR, "catalog.json")
EXT = ".srt"

YOUTUBE_URL_RE = re.compile(
    r"https?://(?:www\.)?(?:youtube\.com/watch\?v=|youtu\.be/)[\w-]{11}[^\s]*",
    re.I,
)


def read_youtube_url(srt_path: str) -> str:
    try:
        with open(srt_path, encoding="utf-8") as f:
            for i, line in enumerate(f):
                if i > 8:
                    break
                line = line.strip()
                if not line:
                    continue
                m = YOUTUBE_URL_RE.search(line)
                if m:
                    return m.group(0).rstrip(".,)")
                if line.lower().startswith("youtube:"):
                    rest = line.split(":", 1)[-1].strip()
                    m2 = YOUTUBE_URL_RE.search(rest)
                    if m2:
                        return m2.group(0).rstrip(".,)")
    except OSError:
        pass
    return ""


catalog = []

for root, dirs, files in os.walk(BASE_DIR):
    dirs[:] = [d for d in dirs if not d.startswith(".")]

    rel_dir = os.path.relpath(root, BASE_DIR).replace("\\", "/")
    if rel_dir == ".":
        rel_dir = ""

    srts = [f for f in files if f.lower().endswith(EXT)]

    for fname in srts:
        if fname.startswith("."):
            continue

        rel_path = (rel_dir + "/" + fname).lstrip("/")
        full_path = os.path.join(root, fname)
        youtube = read_youtube_url(full_path)

        entry = {
            "dir": rel_dir,
            "name": fname,
            "path": rel_path,
        }
        if youtube:
            entry["youtube"] = youtube
        catalog.append(entry)

catalog.sort(key=lambda x: (x["dir"], x["name"]))

with open(OUTPUT, "w", encoding="utf-8") as f:
    json.dump(catalog, f, ensure_ascii=False, indent=2)

print(f"완료: {OUTPUT} (총 {len(catalog)}개 SRT)")
