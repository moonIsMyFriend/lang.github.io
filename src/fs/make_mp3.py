"""CSV no 열을 1부터 순차 재번호한 뒤 저장하고, original 기준 mp3 생성."""

import argparse
import re
import sys
from pathlib import Path
from typing import Optional

import pandas as pd
from gtts import gTTS

ROOT = Path(__file__).resolve().parent

# 처리할 CSV (파일명만, ROOT 기준). 필요 시 목록에 추가.
CSV_FILES = [
    "00. 입문.csv",
    "01. 기본.csv",
    "02. 심화.csv",
    "03. 전문.csv",
]


def slugify(s: str) -> str:
    s = re.sub(r"[^\w\s-]", "", s, flags=re.UNICODE)
    s = re.sub(r"\s+", "_", s.strip())
    return s[:60]


def renumber_no_column(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    if "no" not in out.columns:
        out.insert(0, "no", range(1, len(out) + 1))
    else:
        out["no"] = range(1, len(out) + 1)
    return out


def save_csv(df: pd.DataFrame, path: Path) -> None:
    df.to_csv(path, index=False, encoding="utf-8-sig")


def make_mp3_for_csv(csv_path: Path, out_dir: Optional[Path] = None) -> int:
    if not csv_path.is_file():
        print(f"[skip] 없음: {csv_path}", file=sys.stderr)
        return 0

    df = pd.read_csv(csv_path)
    df = renumber_no_column(df)
    save_csv(df, csv_path)
    print(f"[csv] {csv_path.name} — no 1~{len(df)} 저장")

    mp3_dir = out_dir or csv_path.parent / "mp3" / csv_path.stem
    mp3_dir.mkdir(parents=True, exist_ok=True)

    made = 0
    for _, row in df.iterrows():
        text = str(row.get("original", "")).strip()
        if not text or text.lower() == "nan":
            continue
        no = int(row["no"])
        fname = mp3_dir / f"{no:03d}.mp3"
        print(f"  mp3 {fname.name}: {text[:60]}{'…' if len(text) > 60 else ''}")
        tts = gTTS(text=text, lang="fr", tld="fr", slow=True)
        tts.save(str(fname))
        made += 1

    print(f"[done] {csv_path.name} → {mp3_dir} ({made}개)")
    return made


def main() -> None:
    parser = argparse.ArgumentParser(description="CSV no 재번호 + mp3 생성")
    parser.add_argument(
        "csv",
        nargs="*",
        help="CSV 경로(생략 시 CSV_FILES 목록 사용)",
    )
    parser.add_argument(
        "--out",
        type=Path,
        help="mp3 출력 폴더(단일 CSV일 때만; 기본: mp3/<csv이름>)",
    )
    args = parser.parse_args()

    if args.csv:
        paths = [Path(p) if Path(p).is_absolute() else ROOT / p for p in args.csv]
    else:
        paths = [ROOT / name for name in CSV_FILES]

    total = 0
    for i, csv_path in enumerate(paths):
        out = args.out if args.out and len(paths) == 1 else None
        total += make_mp3_for_csv(csv_path, out)

    print(f"\n총 mp3 {total}개 생성")


if __name__ == "__main__":
    main()
