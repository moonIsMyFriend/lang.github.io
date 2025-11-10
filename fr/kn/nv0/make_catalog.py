# make_catalog.py
import os, json

BASE_DIR = "./"          # 스캔 시작 경로(사이트 루트)
OUTPUT   = "catalog.json"
EXT      = ".csv"

catalog = []

# print(os.walk(BASE_DIR))

for root, dirs, files in os.walk(BASE_DIR):
    print(root, dirs, files)
    print(root.split(os.sep))


    # # 숨김 폴더/파일 제외
    # if any(p.startswith('.') for p in root.split(os.sep)): 
    #     print('stop')
    #     continue
    
    
    rel_dir = os.path.relpath(root, BASE_DIR).replace("\\", "/")
    if rel_dir == ".": 
        rel_dir = ""  # 루트

    print(rel_dir)
    csvs = [f for f in files if f.lower().endswith(EXT)]
    
    
    for fname in csvs:
        print(fname)
        if fname.startswith('.'): 
            continue
        rel_path = (rel_dir + "/" + fname).lstrip("/")
        catalog.append({
            "dir": rel_dir,         # 예: "", "fr", "eng/set1"
            "name": fname,          # 예: "fr.csv"
            "path": rel_path        # 예: "fr/fr.csv"
        })

# 정렬: 폴더→파일명
catalog.sort(key=lambda x: (x["dir"], x["name"]))

with open(OUTPUT, "w", encoding="utf-8") as f:
    json.dump(catalog, f, ensure_ascii=False, indent=2)

print(f"완료: {OUTPUT} (총 {len(catalog)}개 CSV)")
