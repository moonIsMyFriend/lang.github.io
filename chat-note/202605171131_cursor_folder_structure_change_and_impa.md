# Folder structure change and impact
_Exported on 5/17/2026 at 11:30:36 GMT+9 from Cursor (3.4.20)_

---

**User**

en 폴더의 css, lib 폴더를 com 폴더로 이동시키고 영향이 가는 파일에도 적용해죠.

---

**Cursor**

`en`의 `css`·`lib`를 `com`으로 옮기고 참조를 찾아 수정합니다. 먼저 폴더 구조와 참조 위치를 확인합니다.


폴더를 이동하고 HTML 참조를 일괄 업데이트합니다.


작업을 마쳤습니다.

## 변경 사항

**폴더 이동**
- `src/en/css` → `src/com/css` (`quiz-style.css`)
- `src/en/lib` → `src/com/lib` (`quiz-app.js`, `quiz-core.js`, `title.js`, `quiz-app.js_무소음구간처리`)

**참조 경로 수정** (`en/css` → `com/css`, `en/lib` → `com/lib`)

| 파일 |
|------|
| `src/en/index.html`, `src/en/cc2/index.html`, `src/en/ielts/bs_sp/index.html` |
| `src/fs/index.html` |
| `src/fr/kn/bd1`, `bs_cv2`, `bs_grm`, `nv0`, `vd`, `pron` 하위 HTML |

`lib` 내부의 `./quiz-core.js` 같은 상대 import는 그대로 두었습니다.

`en` 폴더에는 이제 콘텐츠(HTML, CSV 등)만 남고, 공통 퀴즈 UI는 `src/com/` 아래에 있습니다. 배포 시 `com` 폴더도 함께 올라가는지 한 번 확인해 보시면 좋습니다.

---

**User**

@lang/build_publish.js 를 src내 폴더 하나를 지정하면 그 폴더내에 있느 파일들을 난독화하고 publish에 지정한 폴더 이름의 폴더에 결과물 생성하도록 만들어죠.

---

**Cursor**

`build_publish.js`를 확인한 뒤, `src` 내 지정 폴더를 빌드해 `publish`에 출력하도록 수정합니다.


`build_publish.js`를 `src` 하위 폴더를 인자로 받아 `publish/{폴더명}`에 빌드하도록 재작성합니다.


`build_publish.js`를 `src` 하위 폴더 기준으로 동작하도록 바꿨습니다.

## 사용법

```bash
node build_publish.js <src 하위 폴더>
```

예:

```bash
node build_publish.js com
node build_publish.js fs
node build_publish.js fr/kn/pron
```

## 동작

| 확장자 | 처리 |
|--------|------|
| `.html` | html-minifier-terser로 압축 |
| `.css` | cleancss로 압축 |
| `.js` | javascript-obfuscator로 난독화 |
| 그 외 | 그대로 복사 (csv, json, txt, py 등) |

- 입력: `src/{지정 폴더}/` 전체(하위 포함)
- 출력: `publish/{지정 폴더}/` (예: `com` → `publish/com/`)
- 빌드 전 해당 출력 폴더만 삭제 후 재생성 (`publish` 전체는 지우지 않음)
- `.md` 파일은 제외
- `../` 등으로 `src` 밖 경로 지정은 차단

기존 `styletest` 전용 로직은 제거했습니다. `com`으로 테스트했을 때 `publish/com/`에 css·js가 정상 생성되었습니다.

---

**User**

@lang/fr/kn/pron/turntable-player.css 랑 @lang/src/fr/kn/pron/turntable-quiz-ui.js  사용되는 건가?

---

**Cursor**

`turntable-player.css`와 `turntable-quiz-ui.js` 참조 여부를 코드베이스에서 확인합니다.


네, **둘 다 사용됩니다.** 다만 `index.html`이 아니라 **`turntable_music_player.html` 전용**입니다.

## 어디서 쓰이나

| 파일 | 참조하는 HTML |
|------|----------------|
| `turntable-player.css` | `turntable_music_player.html`, `turntable_music_player.ori.html` |
| `turntable-quiz-ui.js` | 위와 동일 (ES module import) |

`index.html`은 목록에서 학습을 고르면 `turntable_music_player.html?file=...`로 **이동만** 하고, CSS/JS는 직접 로드하지 않습니다.

```359:359:c:\Users\winmev\Desktop\dev\lang\src\fr\kn\pron\index.html
                        const studyUrl = `./turntable_music_player.html?file=${encodeURIComponent(f.path)}&mode=study${orderQs}`;
```

실제 로드는 `turntable_music_player.html` 안에서 이렇게 됩니다.

- CSS: `./turntable-player.css`
- JS: `import { initTurntableQuizUi } from './turntable-quiz-ui.js'`

`turntable-quiz-ui.js`는 TP-7 턴테이블 UI와 `quiz-app`을 연결하는 역할이고, `quiz-app` 초기화 후 `initTurntableQuizUi()`를 호출합니다.

## 쓰이지 않는 페이지

- `index.html` — 목록/설정만
- `study_card.html` — turntable 관련 참조 없음

## 정리

pron 폴더에서 **턴테이블 학습 화면**(`turntable_music_player.html`)을 쓸 때만 필요합니다. `index.html`만 배포하거나 turntable 페이지를 안 쓰면 이 두 파일은 불필요합니다.

---

**User**

@lang/publish/fr/kn/pron/turntable-player.css 랑 @lang/publish/fr/kn/pron/turntable-quiz-ui.js 를 src 폴더내 com으로 이동시켜죠. 영향있는 파일에도 반영해주고

---

**Cursor**

`turntable-player.css`와 `turntable-quiz-ui.js`를 `src/com`으로 옮기고 참조 경로를 업데이트합니다.


작업 반영했습니다.

## 이동

| 이전 | 이후 |
|------|------|
| `src/fr/kn/pron/turntable-player.css` | `src/com/css/turntable-player.css` |
| `src/fr/kn/pron/turntable-quiz-ui.js` | `src/com/lib/turntable-quiz-ui.js` |

## 경로 수정

`turntable_music_player.html`, `turntable_music_player.ori.html`에서:

- CSS: `../../../com/css/turntable-player.css`
- JS: `../../../com/lib/turntable-quiz-ui.js`

(`quiz-style.css`, `quiz-app.js`와 같은 `com` 경로 패턴)

## publish

`publish/fr/kn/pron/`에 있던 예전 복사본은 삭제했습니다. 배포용으로는 다시 빌드해 주세요.

```bash
node build_publish.js com
node build_publish.js fr/kn/pron
```

`com` 빌드에 turntable CSS/JS가 포함되고, `fr/kn/pron` 빌드에는 HTML만 갱신된 경로로 나갑니다.

---

**User**

@lang/publish/fr/kn/pron/index.html 에서 학습설정을 @lang/src/fr/kn/pron/turntable_music_player.html 의 좌측에 있는 M 버튼을 누르면 팝업창이 떠서 설정할 수 있도록 수정.

---

**Cursor**

index.html의 학습 설정과 turntable 페이지의 M 버튼 구조를 확인합니다.


M 버튼으로 학습 설정 팝업을 열도록 구현하고, `index.html`의 설정 섹션은 제거합니다.


작업 반영했습니다.

## 변경 요약

### `turntable_music_player.html`
- 좌측 **M**을 `btnSettings` 버튼으로 변경
- `index.html`에 있던 **학습 설정** UI를 모달(`#tpSettingsModal`)로 이동
- 숨겨진 `screen1` 안의 중복 설정 블록은 제거

### `turntable-quiz-ui.js`
- M 버튼 → 설정 팝업 열기
- ✕, 배경 클릭, Esc → 닫기
- **확인** → `learnlang-settings-applied` 이벤트 후 닫기

### `turntable-player.css`
- M 버튼·모달(백드롭, 다이얼로그) 스타일 추가

### `quiz-app.js`
- 설정값 localStorage 저장/복원 (난이도, 첫 글자, 최소 길이, 다크 모드)
- 설정 적용 시 현재 문항 다시 렌더
- `index`에 설정 UI가 없어도 동작하도록 null 가드

### `index.html`
- **학습 설정** 섹션 제거
- 사용법: “학습 화면 M 버튼에서 설정” 안내 추가

## 사용 방법

1. `index.html`에서 CSV 선택 → turntable로 이동  
2. 학습 중 장치 왼쪽 **M** 클릭 → 설정 팝업  
3. 변경 후 **확인** (퀴즈 모드·난이도 등은 바로 반영, 출제 순서는 다음 세션부터 localStorage 기준)

배포 반영:

```bash
node build_publish.js com
node build_publish.js fr/kn/pron
```

---

**User**

설정 이라는 의미로 M으로 시작하는 영어 단어가 있어?

---

**Cursor**

M으로 시작하면서 **‘설정’과 똑같은 뜻**인 영어 단어는 거의 없습니다. 보통 **Settings**는 S, **Options**는 O, **Preferences**는 P로 시작합니다.

다만 UI 버튼 라벨로 쓰기 좋은 **M** 단어는 있습니다.

| 단어 | 의미 | 이 프로젝트에 맞는지 |
|------|------|---------------------|
| **Menu** | 메뉴(설정·옵션 목록) | 가장 흔함. M = 메뉴 관례 |
| **Mode** | 모드(학습/퀴즈, 랜덤/순차) | 지금 팝업 내용과 잘 맞음 |
| **More** | 더 보기(추가 옵션) | 모바일에서 자주 씀 |
| **Manage** | 관리 | 설정보다는 ‘관리’ 느낌 |

턴테이블 UI의 **M**은 원래 장식/브랜드 느낌(TP-7 스타일)인 경우도 많고, 기능을 붙일 때는 **Menu**(설정 열기)나 **Mode**(모드 바꾸기)가 자연스럽습니다.

정리하면, **“설정”의 직역은 M으로 시작하지 않지만**, 버튼 글자로는 **Menu** 또는 **Mode**가 가장 무난합니다.

---

**User**

home 말고 index로 이동하는 경우의 버튼 이미지로는 뭐가 좋을가?

---

**Cursor**

次 페이지가 **목록(index)** 이라면, 집 모양 **Home**보다 아래가 더 잘 맞습니다.

## 추천 순서

### 1. **목록(List)** — 가장 직관적
- 가로 줄 3~4개(≡) 또는 불릿 리스트
- 의미: “CSV 목록으로 돌아가기”
- `index.html`의 Index·폴더 목록과 잘 맞음

### 2. **뒤로(← / Chevron-left)**
- 의미: “방금 보던 목록으로”
- turntable → index 흐름에서는 **가장 자연스러움**
- 단, “앱 첫 화면” 느낌은 약함

### 3. **그리드(Grid, ⊞)**
- 의미: “카탈로그·강의 목록”
- 항목이 많을 때 목록 화면과 잘 어울림

### 4. **폴더(Folder)**
- CSV·파일 선택 화면이면 괜찮음
- “학습 재개”보다는 “파일 고르기” 쪽 뉘앙스

## 비추천
- **집(Home)** — 보통 앱 메인/대시보드
- **톱니(Settings)** — 이미 M(설정)에 쓰는 중이면 혼동

## 이 프로젝트에 대한 제안

| 버튼 역할 | 아이콘 |
|-----------|--------|
| `index.html` (목록) | **←** 또는 **목록(≡)** |
| 학습 설정 팝업 | **M** → Menu/Mode 유지 |

**목록 아이콘 + `aria-label="목록"`** 또는 **← + `aria-label="목록으로"`** 조합이 좋습니다.  
지금처럼 턴테이블 왼쪽 아래에 두 버튼이 있으면, **위·아래로 Home(목록) / M(설정)** 을 나란히 두는 것도 읽기 쉽습니다.

원하시면 `btnHome` SVG를 목록/뒤로 아이콘으로 바꾸는 패치도 해 드릴 수 있습니다.

