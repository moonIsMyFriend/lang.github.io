/**
 * 학습 종료: 발음 시도 있음 → 요약 팝업 후 목록, 없음 → 바로 목록.
 */

const PRON_STATS_KEY = 'learnlang.pronStats';

export function syncPronStatsStorage(count, totalScore) {
  try {
    sessionStorage.setItem(PRON_STATS_KEY, JSON.stringify({ count, totalScore }));
  } catch (_) { /* ignore */ }
}

export function clearPronStatsStorage() {
  try {
    sessionStorage.removeItem(PRON_STATS_KEY);
  } catch (_) { /* ignore */ }
}

function readPronStatsFromStorage() {
  try {
    const raw = sessionStorage.getItem(PRON_STATS_KEY);
    if (!raw) return null;
    const { count, totalScore } = JSON.parse(raw);
    if (!count) return null;
    const avg = Math.round(totalScore / count);
    return {
      text: `발음 ${count}회 · 총점 ${Math.round(totalScore)}점 · 평균 ${avg}점 / 100`,
    };
  } catch {
    return null;
  }
}

function resolveSummary({ total = 0, pronSummary = '', getSummary } = {}) {
  if (pronSummary) return { total, text: pronSummary };
  if (typeof getSummary === 'function') {
    const s = getSummary();
    if (s?.text) return { total: s.total ?? total, text: s.text };
  }
  const stored = readPronStatsFromStorage();
  if (stored?.text) return { total, text: stored.text };
  return null;
}

function ensurePronSummaryStyles() {
  if (document.getElementById('pron-summary-modal-style')) return;
  const style = document.createElement('style');
  style.id = 'pron-summary-modal-style';
  style.textContent = `
    .pron-summary-modal { position:fixed; inset:0; z-index:10000; display:flex; align-items:center; justify-content:center; padding:16px; }
    .pron-summary-modal.hidden { display:none !important; }
    .pron-summary-backdrop { position:absolute; inset:0; background:rgba(0,0,0,.55); border:0; padding:0; cursor:pointer; }
    .pron-summary-dialog { position:relative; z-index:1; max-width:420px; width:100%; margin:0; }
  `;
  document.head.appendChild(style);
}

function ensurePronSummaryModal() {
  ensurePronSummaryStyles();
  const existing = document.getElementById('pronSummaryModal');
  if (existing) return existing;

  const modal = document.createElement('div');
  modal.id = 'pronSummaryModal';
  modal.className = 'pron-summary-modal hidden';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'pronSummaryTitle');
  modal.hidden = true;
  modal.innerHTML = `
    <button type="button" class="pron-summary-backdrop" aria-label="닫기"></button>
    <div class="pron-summary-dialog box card">
      <h2 id="pronSummaryTitle" style="margin-top:0">발음 학습 결과</h2>
      <p id="pronSummaryLead" class="sub"></p>
      <p id="pronSummaryBody" class="big"></p>
      <div class="row" style="margin-top:14px;justify-content:flex-end">
        <button type="button" class="primary" id="pronSummaryOk">확인</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  return modal;
}

function showPronounceSummaryModal({ total, pronSummary, onClose }) {
  const modal = ensurePronSummaryModal();
  const lead = modal.querySelector('#pronSummaryLead');
  const body = modal.querySelector('#pronSummaryBody');
  const ok = modal.querySelector('#pronSummaryOk');
  const backdrop = modal.querySelector('.pron-summary-backdrop');

  if (lead) lead.textContent = total > 0 ? `총 ${total}문장을 학습했습니다.` : '';
  if (body) body.textContent = pronSummary;

  const close = () => {
    modal.classList.add('hidden');
    modal.hidden = true;
    ok?.removeEventListener('click', close);
    backdrop?.removeEventListener('click', close);
    onClose?.();
  };

  modal.classList.remove('hidden');
  modal.hidden = false;
  ok?.addEventListener('click', close);
  backdrop?.addEventListener('click', close);
}

/** @returns {boolean} handled */
export function finishStudySession({ homeUrl, total = 0, pronSummary = '', getSummary } = {}) {
  if (!homeUrl) return false;

  const summary = resolveSummary({ total, pronSummary, getSummary });
  const go = () => {
    clearPronStatsStorage();
    location.replace(homeUrl);
  };

  if (summary?.text) {
    showPronounceSummaryModal({
      total: summary.total,
      pronSummary: summary.text,
      onClose: go,
    });
    return true;
  }

  go();
  return true;
}

/**
 * 구 quiz-app(com/lib)용: pronounceOutcome 점수 표시를 세션 storage에 누적.
 */
export function installPronStatsDomTracker() {
  const el = document.getElementById('pronounceOutcome');
  if (!el || el.dataset.pronTracker === '1') return;
  el.dataset.pronTracker = '1';

  let count = 0;
  let totalScore = 0;
  let lastKey = '';

  const obs = new MutationObserver(() => {
    const numEl = el.querySelector('.pron-score-num');
    if (!numEl) return;
    const m = String(numEl.textContent || '').match(/(\d+)/);
    if (!m) return;
    const key = m[1] + '|' + (el.textContent || '').slice(0, 120);
    if (key === lastKey) return;
    lastKey = key;

    const n = Number(m[1]);
    if (!Number.isFinite(n)) return;
    count += 1;
    totalScore += Math.max(0, Math.min(100, Math.round(n)));
    syncPronStatsStorage(count, totalScore);
  });

  obs.observe(el, { childList: true, subtree: true, characterData: true });
}

/**
 * 구 quiz-app: Result(screen3) 표시 시 목록으로 (발음 있으면 팝업).
 */
export function installStudyResultRedirect({ requireStudyMode = true, getSummary } = {}) {
  if (!window.quizApp?.getPronounceSummary) installPronStatsDomTracker();
  const homeUrl = document.body?.dataset?.quizHomeUrl || './index.html';
  const screen3 = document.getElementById('screen3');
  if (!screen3) return;

  let handled = false;

  const redirect = () => {
    if (handled) return;
    if (screen3.classList.contains('hidden') || screen3.hidden) return;

    if (requireStudyMode) {
      const mode = new URLSearchParams(location.search).get('mode');
      const practiceStudy = document.getElementById('practiceStudy');
      const isStudy =
        mode === 'study' ||
        (mode !== 'quiz' && practiceStudy?.checked !== false);
      if (!isStudy) return;
    }

    handled = true;
    screen3.classList.add('hidden');
    screen3.hidden = true;

    const total =
      (typeof getSummary === 'function' && getSummary()?.total) ||
      Number(document.getElementById('barTotal')?.textContent) ||
      0;

    finishStudySession({ homeUrl, total, getSummary });
  };

  new MutationObserver(redirect).observe(screen3, {
    attributes: true,
    attributeFilter: ['class', 'hidden'],
  });
}
