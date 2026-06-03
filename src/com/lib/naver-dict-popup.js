/**
 * 표현(original) 영역에서 단어·숙어 선택 시 네이버 사전 검색 결과 팝업
 */

/** 네이버 사전 통합 도메인 (fren.dict.naver.com 등 구 서브도메인은 DNS 미지원) */
const DICT_BASE = {
  fren: 'https://dict.naver.com/frkodict/#/search?query=',
  frko: 'https://dict.naver.com/frkodict/#/search?query=',
  en: 'https://dict.naver.com/english/#/search?query=',
  ko: 'https://dict.naver.com/kokodict/#/search?query=',
};

function normalizeQuery(raw) {
  return String(raw || '')
    .replace(/^[\s.,;:!?«»""''()[\]…—–\-]+/, '')
    .replace(/[\s.,;:!?«»""''()[\]…—–\-]+$/, '')
    .trim();
}

function selectionWithin(el) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || sel.isCollapsed) return false;
  const node = sel.anchorNode;
  return node && el.contains(node);
}

function getSelectedQuery() {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed) return '';
  return normalizeQuery(sel.toString());
}

function buildDictUrl(dictKey, query) {
  const base = DICT_BASE[dictKey] || DICT_BASE.fren;
  return base + encodeURIComponent(query);
}

let popupRoot = null;

function ensurePopup() {
  if (popupRoot) return popupRoot;

  const root = document.createElement('div');
  root.id = 'tpDictPopup';
  root.className = 'tp-dict-popup hidden';
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', 'tpDictPopupTitle');

  root.innerHTML = `
    <div class="tp-dict-backdrop" data-tp-dict-close tabindex="-1" aria-hidden="true"></div>
    <div class="tp-dict-dialog">
      <div class="tp-dict-head">
        <h2 id="tpDictPopupTitle" class="tp-dict-title"></h2>
        <button type="button" class="tp-dict-close" data-tp-dict-close aria-label="닫기">✕</button>
      </div>
      <div class="tp-dict-body">
        <iframe class="tp-dict-frame" title="네이버 사전 검색 결과" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
        <p class="tp-dict-fallback muted">사전 화면이 보이지 않으면 아래 링크를 이용하세요.</p>
      </div>
      <div class="tp-dict-foot">
        <a class="tp-dict-external" href="#" target="_blank" rel="noopener noreferrer">네이버 사전에서 열기</a>
      </div>
    </div>
  `;

  document.body.appendChild(root);
  popupRoot = root;
  return root;
}

function closePopup() {
  if (!popupRoot) return;
  popupRoot.classList.add('hidden');
  popupRoot.hidden = true;
  const frame = popupRoot.querySelector('.tp-dict-frame');
  if (frame) frame.src = 'about:blank';
}

function openPopup(query, dictKey) {
  const root = ensurePopup();
  const url = buildDictUrl(dictKey, query);
  const title = root.querySelector('.tp-dict-title');
  const frame = root.querySelector('.tp-dict-frame');
  const external = root.querySelector('.tp-dict-external');

  if (title) title.textContent = query;
  if (frame) frame.src = url;
  if (external) {
    external.href = url;
    external.textContent = `「${query}」 네이버 사전에서 열기`;
  }

  root.classList.remove('hidden');
  root.hidden = false;
  root.querySelector('.tp-dict-close')?.focus();
}

/**
 * @param {HTMLElement} target — original 표시 영역 (예: #tpExpr)
 * @param {{ dict?: 'fren'|'en'|'ko' }} [options]
 */
export function installNaverDictPopup(target, options = {}) {
  if (!target) return;

  const dictKey = options.dict || 'fren';
  target.classList.add('tp-expr-selectable');

  const root = ensurePopup();
  root.querySelectorAll('[data-tp-dict-close]').forEach((el) => {
    el.addEventListener('click', closePopup);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && popupRoot && !popupRoot.hidden) {
      e.preventDefault();
      closePopup();
    }
  });

  function onSelectionEnd() {
    if (!selectionWithin(target)) return;
    const query = getSelectedQuery();
    if (!query || query.length > 120) return;
    openPopup(query, dictKey);
  }

  target.addEventListener('mouseup', () => {
    requestAnimationFrame(onSelectionEnd);
  });
  target.addEventListener('touchend', () => {
    setTimeout(onSelectionEnd, 80);
  });
}
