"""
북마크 HTML의 폴더(기본: 펜싱)에서 YouTube URL을 뽑아 다운로드합니다.

완전히 받은 파일(합쳐진 [id].mp4 등)은 건너뛰고,
받던 중(.part / .f###)이거나 아직 없는 것만 받습니다.

사용법:
  1) pip install yt-dlp
  2) winget install Gyan.FFmpeg   # 영상+소리 합치기용
  3) python dy.py
  4) python dy.py --list-only     # 받을 목록만 확인
"""

from __future__ import annotations

import argparse
import os
import re
import shutil
import subprocess
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import parse_qs, urlparse

try:
    import yt_dlp
except ImportError:
    print("yt-dlp가 필요합니다. 설치: pip install yt-dlp")
    sys.exit(1)

BASE_DIR = Path(__file__).resolve().parent
DOWNLOAD_DIR = BASE_DIR / "downloads"
DEFAULT_BOOKMARKS = BASE_DIR / "bookmarks_26. 8. 22..html"
DEFAULT_FOLDER = "펜싱"

VIDEO_ID_RE = re.compile(
    r"(?:youtube\.com/(?:watch\?.*?v=|shorts/|embed/|live/)|youtu\.be/)([A-Za-z0-9_-]{11})"
)
# 파일명에서 id 추출: Title [xxxxxxxxxxx].ext
FILE_ID_RE = re.compile(r"\[([A-Za-z0-9_-]{11})\]")
# 완성본: Title [id].mp4 (중간 .f137 없음)
DONE_FILE_RE = re.compile(
    r"\[([A-Za-z0-9_-]{11})\]\.(mp4|mkv|webm)$", re.IGNORECASE
)
# 분리 스트림: Title [id].f137.mp4 / .f251.webm
SPLIT_FILE_RE = re.compile(
    r"\[([A-Za-z0-9_-]{11})\]\.f\d+", re.IGNORECASE
)


class BookmarkFolderParser(HTMLParser):
    """Netscape 북마크 HTML에서 지정 폴더 안의 링크를 수집."""

    def __init__(self, folder_name: str) -> None:
        super().__init__()
        self.folder_name = folder_name
        self.in_h3 = False
        self.h3_text = ""
        self.pending_folder: str | None = None
        self.folder_stack: list[tuple[str, int]] = []
        self.dl_depth = 0
        self.capture = False
        self.target_dl_depth: int | None = None
        self.hrefs: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_d = {k: (v or "") for k, v in attrs}
        if tag == "h3":
            self.in_h3 = True
            self.h3_text = ""
        elif tag == "dl":
            self.dl_depth += 1
            if self.pending_folder is not None:
                name = self.pending_folder
                self.folder_stack.append((name, self.dl_depth))
                if name == self.folder_name:
                    self.capture = True
                    self.target_dl_depth = self.dl_depth
                self.pending_folder = None
        elif tag == "a" and self.capture:
            href = attrs_d.get("href", "").strip()
            if href:
                self.hrefs.append(href)

    def handle_endtag(self, tag: str) -> None:
        if tag == "h3" and self.in_h3:
            self.in_h3 = False
            self.pending_folder = self.h3_text.strip()
        elif tag == "dl":
            if self.folder_stack and self.folder_stack[-1][1] == self.dl_depth:
                name, depth = self.folder_stack.pop()
                if name == self.folder_name and depth == self.target_dl_depth:
                    self.capture = False
                    self.target_dl_depth = None
            self.dl_depth -= 1

    def handle_data(self, data: str) -> None:
        if self.in_h3:
            self.h3_text += data


def extract_video_id(url: str) -> str | None:
    m = VIDEO_ID_RE.search(url)
    if m:
        return m.group(1)
    parsed = urlparse(url)
    if "youtube.com" in parsed.netloc and parsed.path == "/watch":
        vids = parse_qs(parsed.query).get("v")
        if vids and len(vids[0]) == 11:
            return vids[0]
    return None


def load_urls_from_bookmarks(path: Path, folder: str) -> list[str]:
    html = path.read_text(encoding="utf-8", errors="replace")
    parser = BookmarkFolderParser(folder)
    parser.feed(html)

    seen: set[str] = set()
    urls: list[str] = []
    for href in parser.hrefs:
        vid = extract_video_id(href)
        if not vid or vid in seen:
            continue
        seen.add(vid)
        urls.append(f"https://www.youtube.com/watch?v={vid}")
    return urls


def find_ffmpeg() -> str | None:
    found = shutil.which("ffmpeg")
    if found:
        return found
    candidates = [
        Path(os.environ.get("LOCALAPPDATA", "")) / "Microsoft" / "WinGet" / "Links" / "ffmpeg.exe",
        Path(r"C:\ffmpeg\bin\ffmpeg.exe"),
    ]
    for p in candidates:
        if p.is_file():
            return str(p)
    winget_pkgs = Path(os.environ.get("LOCALAPPDATA", "")) / "Microsoft" / "WinGet" / "Packages"
    if winget_pkgs.is_dir():
        for exe in winget_pkgs.glob("Gyan.FFmpeg*/ffmpeg-*/bin/ffmpeg.exe"):
            return str(exe)
    return None


def remux_split_downloads(ffmpeg: str) -> int:
    """완성된 분리 스트림(.f### 영상+오디오)을 합친다. .part는 건드리지 않음."""
    stem_re = re.compile(r"^(.+)\.f\d+\.(mp4|webm|m4a)$", re.I)
    groups: dict[str, dict[str, Path]] = {}
    for path in DOWNLOAD_DIR.iterdir():
        if not path.is_file():
            continue
        if path.name.endswith(".part"):
            continue
        m = stem_re.match(path.name)
        if not m:
            continue
        stem = m.group(1)
        ext = m.group(2).lower()
        kind = "video" if ext == "mp4" else "audio"
        groups.setdefault(stem, {})[kind] = path

    merged = 0
    for stem, parts in groups.items():
        video = parts.get("video")
        audio = parts.get("audio")
        if not video or not audio:
            continue
        out = DOWNLOAD_DIR / f"{stem}.mp4"
        if out.exists() and out.stat().st_size > 0:
            video.unlink(missing_ok=True)
            audio.unlink(missing_ok=True)
            continue
        cmd = [
            ffmpeg, "-y",
            "-i", str(video),
            "-i", str(audio),
            "-c", "copy",
            str(out),
        ]
        print(f"합치는 중: {out.name}")
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode == 0 and out.exists():
            video.unlink(missing_ok=True)
            audio.unlink(missing_ok=True)
            merged += 1
        else:
            print(f"  실패: {r.stderr[-300:] if r.stderr else r.returncode}")
    return merged


def scan_local_ids() -> tuple[set[str], set[str]]:
    """
    downloads 폴더를 스캔한다.
    returns: (완료된 video id, 미완/부분 파일 video id)
    """
    done: set[str] = set()
    partial: set[str] = set()
    if not DOWNLOAD_DIR.is_dir():
        return done, partial

    for path in DOWNLOAD_DIR.iterdir():
        if not path.is_file():
            continue
        name = path.name

        if name.endswith(".part"):
            m = FILE_ID_RE.search(name)
            if m:
                partial.add(m.group(1))
            continue

        if SPLIT_FILE_RE.search(name):
            m = SPLIT_FILE_RE.search(name)
            if m:
                partial.add(m.group(1))
            continue

        m = DONE_FILE_RE.search(name)
        if m and path.stat().st_size > 0:
            done.add(m.group(1))

    # 완성본이 있으면 부분 파일 id는 완료로 취급
    partial -= done
    return done, partial


def filter_pending_urls(urls: list[str]) -> tuple[list[str], int, int]:
    """완료된 id는 제외하고, 받을 URL만 반환. (pending, skipped, partial_count)"""
    done, partial = scan_local_ids()
    pending: list[str] = []
    skipped = 0
    for url in urls:
        vid = extract_video_id(url)
        if not vid:
            continue
        if vid in done:
            skipped += 1
            continue
        pending.append(url)
    return pending, skipped, len(partial)


def download(urls: list[str]) -> None:
    DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)

    ffmpeg = find_ffmpeg()
    if not ffmpeg:
        print("ffmpeg가 없습니다. 영상+소리가 합쳐지려면 필요합니다.")
        print("  winget install Gyan.FFmpeg")
        print("설치 후 터미널을 다시 열고 실행하세요.")
        sys.exit(1)

    n = remux_split_downloads(ffmpeg)
    if n:
        print(f"기존 분리 파일 {n}개 합침 완료\n")

    pending, skipped, partial_n = filter_pending_urls(urls)
    print(f"완료(스킵): {skipped}개")
    print(f"부분/미완 파일: {partial_n}개 (이어서 받음)")
    print(f"받을 개수: {len(pending)}개")

    if not pending:
        print("받을 영상이 없습니다.")
        return

    ydl_opts = {
        "outtmpl": str(DOWNLOAD_DIR / "%(title)s [%(id)s].%(ext)s"),
        "format": "bv*+ba/b",
        "merge_output_format": "mp4",
        "ffmpeg_location": str(Path(ffmpeg).parent),
        "ignoreerrors": True,
        "noplaylist": True,
        "retries": 3,
        "fragment_retries": 3,
        "continuedl": True,       # .part 이어받기
        "nooverwrites": True,     # 완성 파일 덮어쓰지 않음
    }

    print(f"ffmpeg: {ffmpeg}")
    print(f"저장 위치: {DOWNLOAD_DIR}\n")

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download(pending)


def main() -> None:
    ap = argparse.ArgumentParser(description="북마크 폴더 YouTube 다운로드")
    ap.add_argument(
        "--bookmarks",
        type=Path,
        default=DEFAULT_BOOKMARKS,
        help="북마크 HTML 경로",
    )
    ap.add_argument("--folder", default=DEFAULT_FOLDER, help="북마크 폴더 이름")
    ap.add_argument(
        "--list-only",
        action="store_true",
        help="받을 URL만 출력 (다운로드 안 함)",
    )
    args = ap.parse_args()

    if not args.bookmarks.exists():
        print(f"북마크 파일이 없습니다: {args.bookmarks}")
        sys.exit(1)

    urls = load_urls_from_bookmarks(args.bookmarks, args.folder)
    if not urls:
        print(f"'{args.folder}' 폴더에서 YouTube 영상을 찾지 못했습니다.")
        sys.exit(1)

    urls_file = BASE_DIR / "urls.txt"
    urls_file.write_text("\n".join(urls) + "\n", encoding="utf-8")
    print(f"폴더: {args.folder}")
    print(f"고유 영상: {len(urls)}개 → {urls_file}")

    pending, skipped, partial_n = filter_pending_urls(urls)
    print(f"완료(스킵): {skipped}개 / 부분파일: {partial_n}개 / 받을 것: {len(pending)}개")

    if args.list_only:
        for u in pending:
            print(u)
        return

    download(urls)
    print("\n완료.")


if __name__ == "__main__":
    main()
