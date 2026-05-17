# make_catalog.py
import os, json

# 실행 시 작업 디렉터리와 무관하게, 이 스크립트가 있는 폴더를 루트로 스캔
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT = os.path.join(BASE_DIR, "catalog.json")
EXT = ".csv"

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
        if 'test.csv' in fname: 
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


