import os, re, pandas as pd
from gtts import gTTS
from pathlib import Path
from shutil import make_archive

title = 'rd_hk_basic'
print('making', title)
CSV_PATH = f"./{title}.csv"          # 파일 경로(필요시 절대경로로 수정)
OUT_DIR  = Path(f"./mp3/{title}")              # 출력 폴더
OUT_DIR.mkdir(exist_ok=True)

df = pd.read_csv(CSV_PATH)

def slugify(s):
    s = re.sub(r"[^\w\s-]", "", s, flags=re.UNICODE)
    s = re.sub(r"\s+", "_", s.strip())
    return s[:60]  # 파일명 너무 길어지는 것 방지

for _, row in df.iterrows():
    text = str(row["original"]).strip()
    print(text)
    if not text or text.lower() == "nan":
        continue
    no = int(row["no"])
    fname = OUT_DIR / f"{no:03d}.mp3"
    print(fname)
    tts = gTTS(text=text, lang="en", tld="co.uk")
    tts.save(str(fname))

# ZIP으로 묶기 (선택)
# make_archive("fr_dialogue_mp3", "zip", OUT_DIR)
# print("완료:", OUT_DIR, "→ fr_dialogue_mp3.zip 생성")


print('end')



