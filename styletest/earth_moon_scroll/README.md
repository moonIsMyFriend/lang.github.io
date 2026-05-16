# Earth → Moon

---

## 프로젝트 구조 (페이지별)

에셋은 **페이지 폴더**(`earth/`, `distance/`, `moon/`)와 **공통**(`common/`)으로 나뉩니다.  
스크롤·로켓 시퀀스는 페이지 간 연결이 많아 `common/scroll.js` 한 곳에서 오케스트레이션하며, 코드 안에 페이지별 섹션 주석으로 구분합니다.

### 디렉터리

```
styletest/
  mobile_earth_moon_page.html     # 진입 HTML
  earth_moon_scroll/
    README.md
    common/
      base.css                    # reset, 스크롤 래퍼, 별, 화살표 힌트, earth-label
      rocket.css, rocket.js       # 로켓 DOM·비행·대기·모드
      line.css, line.js           # 주황 궤적(트레일)·렌더·freeze
      scroll.js                   # 가로 스크롤·인트로/거리/달 시퀀스
    earth/                        # 1페이지 — EARTH
      page.css                    # 지구 백플레이트, 3D 호스트, 캔버스
      page.js                     # Three.js 지구, EarthIntroRocket
    distance/                     # 2페이지 — 384,400km
      page.css                    # .distance-text (숫자·라벨)
    moon/                         # 3페이지 — MOON
      page.css                    # .planet.moon, moon-label, moon-drift
```

### 파일 ↔ 역할

| 경로 | 역할 |
|------|------|
| `common/base.css` | 우주 배경, `.scroll-wrapper` / `.screen`, `.stars`, `.arrow-hint`, `.earth-label` |
| `common/rocket.css` · `rocket.js` | `.rocket-travel`, 로켓 위치·회전·엔진 불·모드 |
| `common/line.css` · `line.js` | `.rocket-trail`, intro/active path, 달 페이지 트레일 스타일 |
| `common/scroll.js` | 스냅 스크롤, forward-only, 1→2→3 자동·수동 시퀀스 |
| `earth/page.css` | `.earth-backplate`, `.earth-3d-host`, `.earth-canvas` |
| `earth/page.js` | 3D 지구 씬, `window.EarthIntroRocket`, `earth-scene-ready` 이벤트 |
| `distance/page.css` | `.distance-text` (384,400km, DISTANCE) |
| `moon/page.css` | `.moon`, `@keyframes moon-drift`, `.moon-label`, 착륙 시 drift 정지 |

### `common/scroll.js` 내부 섹션

| 주석 구간 | 대응 페이지 | 내용 요약 |
|-----------|-------------|-----------|
| `1페이지 EARTH` | `earth/` | 3D 인트로 이후 DOM 아크, `EarthIntroRocket` 연동 |
| `2페이지 DISTANCE` | `distance/` | 2페이지 중앙 대기, 왼쪽→중앙 진입, 자동 출발(3페이지 방향) |
| `3페이지 MOON` | `moon/` | 왼쪽 대기, 궤도·착륙, 트레일 정리 |

### 진입 HTML 로드 순서

**CSS** (`mobile_earth_moon_page.html`):

1. `earth_moon_scroll/common/base.css`
2. `earth_moon_scroll/earth/page.css`
3. `earth_moon_scroll/distance/page.css`
4. `earth_moon_scroll/moon/page.css`
5. `earth_moon_scroll/common/rocket.css`
6. `earth_moon_scroll/common/line.css`

**JS**:

1. `common/line.js`
2. `common/rocket.js`
3. `common/scroll.js`
4. Three.js (CDN)
5. `earth/page.js`

### 빌드

프로젝트 루트: `node build_publish.js`

```
publish/
  index.html                      # mobile_earth_moon_page.html 미니파이
  earth_moon_scroll/
    common/ …
    earth/ …
    distance/ …
    moon/ …
```

`build_publish.js`는 `earth_moon_scroll/` 하위를 재귀 복사·미니파이합니다 (`README.md` 제외).

---

## 페이지별 의도 (3화면)

| 페이지 | 화면 | 로켓·궤적 의도 |
|--------|------|----------------|
| **1** | 지구 (EARTH) | 3D 지구가 자전. |
|       |             | 처음 입장 시 로켓이 궤적을 그리며 자동 이동. |
|       |             | 지구 아래 → 위 →  로켓 앞부위가 오른쪽으로 턴하면서 왼쪽 중앙으로 이동 → **2페이지 방향(오른쪽)**. |
|       |             | 도착지: 2페이지 중심. but 사용자가 이동하기전까지는 1페이지 화면을 표시하고 있어야 함. |
| **2** | 384,400km (DISTANCE) | 처음 2페이지 입장 시 로켓 **화면 중앙(50vw, 44vh)** 대기. |
|       |             | 만약 사용자가 로켓이 1에서 2페이지로 이동전에 2페이지로 미리 이동했다면 로켓을 왼쪽에서 중앙부로 이동하면서 이동 궤적을 그려준다.|
|       |             | 잠시 후 **오른쪽(3페이지 방향)** 자동 출발. |
|       |             | 1페이지 궤적 제거 |
| **3** | 달 (MOON) | 화면 왼쪽 대기 → 달 위쪽(달 주위 궤도진입 지점)으로 포물선을 그리며 비행. 앞으로 그릴 달 궤적 위로 너무 올라 가지 않아야 함 → 달 주위 궤도에 부드럽게 이어지며 달 주위를 둥글게 회전하면서 달에 근접해가면서 궤적을 그림 → 착륙. |
|       |             | 착륙은 달 위로 다시 돌아오면 로켓의 머리 부분을 위로 돌려주고 아래로 내려가면서 중앙에 도착. 도착하면서 로켓사이즈는 점점 작아지고 도착후에 엔진 불 꺼짐.|
|       |             | 착륙시도할 때 이전 궤적은 모두 옅어지고 로켓이 이동할 때 없어짐.|
|       |             | 도착후 달은 정지하고 노란꽃, 분홍꽃, 상록수, 소나무로 달의 모든 면을 가득 채운다. 꽃은 나무 보다 작다.|
|       |             | 그리고나서 나비 2마리가 날라다닌다.
|       |             | 1·2페이지 궤적 제거 |

## 공통

- 3번째 페이지 이동해서 로켓의 자동 이동이 끝나기 전까지는 이전 페이지는 **다시 왼쪽으로 돌아갈 수 없음** (forward-only).
- 모든 로켓의 이동은 궤적을 그리며, 궤적은 stroke 그라데이션으로 끝이 옅어진다.
- 모바일에서도 궤적은 로켓의 엔진부 중심부를 기준으로 그려진다.
- 자동 이동이 완료되고 사용자가 화살표로 이동하거나 스크린 터치로 이동할때 이동방향으로 로켓 머리부분 회전. 멈추면 머리부부은 위로 회전. 이동시에는 엔진에 불들어옴.
-
