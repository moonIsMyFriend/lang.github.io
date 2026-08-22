"""
YouTube URL 리스트로 동영상을 다운로드합니다.

사용법:
  1) pip install yt-dlp
  2) URLS에 주소를 넣거나 urls.txt에 한 줄에 하나씩 작성
  3) python dy.py
"""

from __future__ import annotations

import sys
from pathlib import Path

try:
    import yt_dlp
except ImportError:
    print("yt-dlp가 필요합니다. 설치: pip install yt-dlp")
    sys.exit(1)

# 스크립트와 같은 폴더
BASE_DIR = Path(__file__).resolve().parent
DOWNLOAD_DIR = BASE_DIR / "downloads"
URLS_FILE = BASE_DIR / "urls.txt"

# 코드에 직접 넣을 URL (urls.txt가 있으면 그쪽이 우선)
URLS: list[str] = [
    # "https://www.youtube.com/watch?v=XXXXXXXXXXX",
    # "https://youtu.be/XXXXXXXXXXX",
]


def load_urls() -> list[str]:
    urls: list[str] = []

    if URLS_FILE.exists():
        for line in URLS_FILE.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#"):
                urls.append(line)

    if not urls:
        urls = [u.strip() for u in URLS if u.strip()]

    # 중복 제거 (순서 유지)
    seen: set[str] = set()
    unique: list[str] = []
    for u in urls:
        if u not in seen:
            seen.add(u)
            unique.append(u)
    return unique


def download(urls: list[str]) -> None:
    DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)

    ydl_opts = {
        "outtmpl": str(DOWNLOAD_DIR / "%(title)s [%(id)s].%(ext)s"),
        "format": "bv*+ba/b",  # 최고 화질 영상+오디오, 없으면 단일 파일
        "merge_output_format": "mp4",
        "ignoreerrors": True,
        "noplaylist": True,
        "retries": 3,
        "fragment_retries": 3,
    }

    print(f"저장 위치: {DOWNLOAD_DIR}")
    print(f"다운로드 개수: {len(urls)}\n")

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download(urls)


def main() -> None:
    urls = load_urls()
    if not urls:
        print("다운로드할 URL이 없습니다.")
        print(f"  - {URLS_FILE} 에 한 줄에 하나씩 넣거나")
        print("  - dy.py 의 URLS 리스트에 주소를 추가하세요.")
        sys.exit(1)

    download(urls)
    print("\n완료.")


if __name__ == "__main__":
    main()
