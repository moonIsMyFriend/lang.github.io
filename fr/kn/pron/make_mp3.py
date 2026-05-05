import os, re, pandas as pd
from gtts import gTTS
from pathlib import Path
from shutil import make_archive

titles = ['00.num.0_20', '01.num.21_40', '02.num.41_60', '03.num.61_80', '04.num.81_100', '15']
titles = ['15. 발음 정리']
print('making', titles)


def slugify(s):
    s = re.sub(r"[^\w\s-]", "", s, flags=re.UNICODE)
    s = re.sub(r"\s+", "_", s.strip())
    return s[:60]  # 파일명 너무 길어지는 것 방지

for title in titles:
    CSV_PATH = f"./{title}.csv" 
    # 파일 경로(필요시 절대경로로 수정)
    OUT_DIR  = Path(f"./mp3")          
    OUT_DIR.mkdir(exist_ok=True)
    OUT_DIR  = Path(f"./mp3/{title}")              # 출력 폴더
    OUT_DIR.mkdir(exist_ok=True)

    df = pd.read_csv(CSV_PATH)
    for _, row in df.iterrows():
        if int(row['no']) < 83:
            continue

        text = str(row["original"]).strip()
        if not text or text.lower() == "nan":
            continue
        no = int(row["no"])
        fname = OUT_DIR / f"{no:03d}.mp3"
        print(fname)
        # lang='fr'로 프랑스어, tld='fr'로 프랑스식 발음 엔진 선택
        tts = gTTS(text=text, lang="fr", tld="fr", slow=True)
        tts.save(str(fname))

# ZIP으로 묶기 (선택)
# make_archive("fr_dialogue_mp3", "zip", OUT_DIR)
# print("완료:", OUT_DIR, "→ fr_dialogue_mp3.zip 생성")


print('end')



