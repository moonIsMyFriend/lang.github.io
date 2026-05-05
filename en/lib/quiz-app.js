// lib/quiz-app.js
import { $, toast, parseCSV, maskEnglish } from './quiz-core.js';

export function initQuizApp() {
  const state = {
    rows: [],
    cols: { id: "일련번호", en: "영문", ko: "번역", pron: "발음" },
    current: null,
    session: null,  // 🔹{ order: number[], idx: 0, total: 20, scored: boolean[], correctCount: 0 }
    audioLoop: false, // 🔹 반복 여부 추가
    /** 로컬 파일 선택·URL 등으로 불러온 CSV 파일명 (mp3/폴더명과 맞춤; 없으면 test.csv 기준) */
    csvFileName: null
  };

  // 화면 전환
  const screen1 = $('#screen1');
  const screen2 = $('#screen2');
  const screen3 = $('#screen3');
  const sub = document.querySelector('.sub');

  function showScreen(which) {
    // 모두 숨기고 필요한 화면만 표시
    screen1.classList.add('hidden');
    screen2.classList.add('hidden');
    screen3.classList.add('hidden');

    if (which === 1) {
      screen1.classList.remove('hidden');
      sub.style.display = '';
    } else if (which === 2) {
      screen2.classList.remove('hidden');
      sub.style.display = 'none';
    } else if (which === 3) {
      screen3.classList.remove('hidden');
      sub.style.display = 'none';
    }

    updatePageTitle(which);
  }

  function updatePageTitle(whichScreen){
    const baseTitle = state.pageBaseTitle || document.title;   // title.txt에서 불러온 기본 제목
    const csvBase = (state.csvFileName || 'test.csv').replace(/\.csv$/i, '');  // ".csv"

    const h1 = document.querySelector('#pageTitle');
    if (h1) { 
      if(whichScreen === 1){
          h1.textContent = baseTitle;           // 화면1에서는 원래 제목만
      } 
      else if(whichScreen === 2){
          h1.textContent = `${baseTitle} ${csvBase}`;  // 화면2: CSV명 추가
      }
      else if(whichScreen === 3){
          h1.textContent = `${baseTitle} ${csvBase} (Result)`; // 화면3: CSV명 추가
      }
    }
}

  // 요소
  const csvInput = $('#csvFile');
  const btnDemo = $('#btnDemo');
  const btnPick = $('#btnPick');
  // const btnReveal = $('#btnReveal');
  const btnNext = $('#btnNext');
  const btnGrade = $('#btnGrade');
  const btnHome = $('#btnHome');
  const ko = $('#ko');
  const enMask = $('#enMask');
  const enFull = $('#enFull');
  const level = $('#level');
  const levelLabel = $('#levelLabel');
  const keepFirst = $('#keepFirst');
  const minLen = $('#minLen');
  const selId = $('#selId');
  const totalCnt = $('#totalCnt');
  const answerWrap = $('#answerWrap');
  // const scoreCorrect = $('#scoreCorrect');
  const scoreTotal = $('#scoreTotal');
  // const progressNow  = $('#progressNow');
  const finalLine = $('#finalLine');
  const btnRestart = $('#btnRestart');
  const btnHome2 = $('#btnHome2');
  const btnSample = document.querySelector('#btnSample');
  const modeSeq = document.querySelector('#modeSeq');
  const practiceStudy = document.querySelector('#practiceStudy');
  const barUnified = document.querySelector('#barUnified');
  const barProgress = document.querySelector('#barProgress');
  const barCorrect = document.querySelector('#barCorrect');
  const barLabel = document.querySelector('#barLabel');
  const barTotal = document.querySelector('#barTotal');

  const pronounceApiKeyEl = document.querySelector('#pronounceApiKey');
  const pronounceLocaleEl = document.querySelector('#pronounceLocale');
  const btnPronounceRecord = document.querySelector('#btnPronounceRecord');
  const pronounceStatus = document.querySelector('#pronounceStatus');
  const pronounceOutcome = document.querySelector('#pronounceOutcome');
  const LS_PRON_API_KEY = 'learnlang_pronounce_api_key';
  /** Set after at least one successful /api/pronounce; cleared on 401 (e.g. rotated server key). */
  const LS_PRON_KEY_VERIFIED = 'learnlang_pronounce_key_verified';
  const LS_PRON_LOCALE = 'learnlang_pronounce_locale';

  let pronounceRecorder = null;
  let pronounceChunks = [];
  let pronounceStream = null;
  let suppressPronounceUpload = false;
  /** 서버 발음 채점(fetch) 중 — 연속 클릭·중복 전송 방지 */
  let pronouncePosting = false;
  /** Auto-stop recording after this many ms (prevents huge uploads). */
  let pronounceMaxDurationTimer = null;
  let pronounceProgressTimer = null;
  let pronounceRecordStart = 0;
  /** 첫 발음 인식 요청 여부(새로고침 전까지 유지). */
  let pronounceRequestedOnce = false;

  /** Production pronunciation API (no URL input in UI). */
  const PRONOUNCE_API_BASE = 'https://learnlang-4fm6.onrender.com';
  /** Max upload size for /api/pronounce (bytes). ~3MB is safe for small hosts / multipart limits. */
  const PRONOUNCE_MAX_BYTES = 3 * 1024 * 1024;
  /** Hard cap on recording length so blobs stay small even without manual stop. */
  const PRONOUNCE_MAX_DURATION_MS = 45 * 1000;
  const PRONOUNCE_BUSY_MESSAGE = '채점자가 바쁩니다. 3분정도 뒤에 다시 시도 해주세요';
  /** Max wait (1 min) for /api/pronounce (e.g. cold start after idle spin-down). */
  const PRONOUNCE_FETCH_TIMEOUT_MS = 1 * 60 * 1000; // 1분 무응답 시 오류 처리

  const PRONOUNCE_SVG_MIC =
    '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>';
  const PRONOUNCE_SVG_STOP =
    '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="1.5"/></svg>';

  function setPronounceRecordButton(recording) {
    if (!btnPronounceRecord) return;
    if (recording) {
      btnPronounceRecord.innerHTML = PRONOUNCE_SVG_STOP;
      btnPronounceRecord.setAttribute('aria-label', '마이크 비활성 · 녹음 종료 및 전송');
      btnPronounceRecord.title = '마이크 비활성 · 녹음 종료 및 전송';
    } else {
      btnPronounceRecord.innerHTML = PRONOUNCE_SVG_MIC;
      btnPronounceRecord.setAttribute('aria-label', '마이크 활성 · 녹음 시작');
      btnPronounceRecord.title = '마이크 활성 · 녹음 시작';
    }
  }

  function getPronounceBase() {
    return PRONOUNCE_API_BASE.replace(/\/+$/, '').replace(/\/api\/pronounce$/i, '');
  }

  function clearPronounceRecordingProgress() {
    if (pronounceProgressTimer) {
      clearInterval(pronounceProgressTimer);
      pronounceProgressTimer = null;
    }
  }

  function renderPronounceRecordingProgress() {
    if (!pronounceStatus) return;
    const maxSec = PRONOUNCE_MAX_DURATION_MS / 1000;
    const elapsedSec = Math.min(maxSec, (Date.now() - pronounceRecordStart) / 1000);
    const pct = Math.min(100, (elapsedSec / maxSec) * 100);
    const elapsedLabel = elapsedSec.toFixed(1);
    pronounceStatus.innerHTML = `<div class="pronounce-rec-wrap" role="status">
      <div class="pronounce-rec-bar-track" role="progressbar" aria-valuemin="0" aria-valuemax="${maxSec}" aria-valuenow="${Math.round(elapsedSec)}" aria-label="녹음 진행">
        <div class="pronounce-rec-bar-fill" style="width:${pct}%"></div>
      </div>
      <div class="pronounce-rec-label">녹음 중 ${elapsedLabel} / ${maxSec}초</div>
    </div>`;
  }

  function beginPronounceRecordingProgress() {
    clearPronounceRecordingProgress();
    pronounceRecordStart = Date.now();
    renderPronounceRecordingProgress();
    pronounceProgressTimer = window.setInterval(renderPronounceRecordingProgress, 120);
  }

  const pronounceApiKeyWrapEl = document.querySelector('#pronounceApiKeyWrap');

  function setPronounceApiKeyWrapVisible(visible) {
    if (!pronounceApiKeyWrapEl) return;
    pronounceApiKeyWrapEl.style.display = visible ? 'inline-flex' : 'none';
  }

  if (pronounceApiKeyEl) {
    const savedKey = localStorage.getItem(LS_PRON_API_KEY);
    if (savedKey) pronounceApiKeyEl.value = savedKey;
    pronounceApiKeyEl.addEventListener('change', () => {
      localStorage.setItem(LS_PRON_API_KEY, pronounceApiKeyEl.value.trim());
      localStorage.removeItem(LS_PRON_KEY_VERIFIED);
      setPronounceApiKeyWrapVisible(true);
    });
    if (localStorage.getItem(LS_PRON_KEY_VERIFIED) === '1') {
      setPronounceApiKeyWrapVisible(false);
    }
  }

  if (pronounceLocaleEl) {
    const savedLoc = localStorage.getItem(LS_PRON_LOCALE);
    if (savedLoc && [...pronounceLocaleEl.options].some((o) => o.value === savedLoc)) {
      pronounceLocaleEl.value = savedLoc;
    }
    pronounceLocaleEl.addEventListener('change', () => {
      localStorage.setItem(LS_PRON_LOCALE, pronounceLocaleEl.value.trim());
    });
  }

  async function togglePronounceRecord() {
    if (!btnPronounceRecord) return;
    if (!state.current) {
      toast('문장이 선택되지 않았습니다.');
      return;
    }
    if (pronounceRecorder && pronounceRecorder.state === 'recording') {
      suppressPronounceUpload = false;
      pronounceRecorder.stop();
      return;
    }
    if (pronouncePosting) {
      toast('발음 채점 중입니다. 잠시만 기다려 주세요.');
      return;
    }
    const pronounceCaption = String(state.current[state.cols.en] || '').trim();
    if (!pronounceCaption) {
      toast('점수를 낼 원문이 없습니다.');
      return;
    }

    try {
      pronounceStream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: { ideal: 1 } },
      });
    } catch (e) {
      toast('마이크 접근에 실패했습니다.');
      return;
    }

    let mimeType = '';
    try {
      if (MediaRecorder.isTypeSupported?.('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported?.('audio/webm')) {
        mimeType = 'audio/webm';
      }
      pronounceChunks = [];
      pronounceRecorder = mimeType ? new MediaRecorder(pronounceStream, { mimeType }) : new MediaRecorder(pronounceStream);
      const finalMime = pronounceRecorder.mimeType || mimeType || 'audio/webm';
      pronounceRecorder.ondataavailable = (ev) => {
        if (ev.data?.size) pronounceChunks.push(ev.data);
      };
      pronounceRecorder.onstop = async () => {
        clearPronounceRecordingProgress();
        if (pronounceMaxDurationTimer) {
          clearTimeout(pronounceMaxDurationTimer);
          pronounceMaxDurationTimer = null;
        }
        const canceled = suppressPronounceUpload;
        suppressPronounceUpload = false;
        try {
          pronounceStream?.getTracks().forEach((t) => t.stop());
        } catch (_) {}
        pronounceStream = null;
        pronounceRecorder = null;

        if (canceled) {
          if (pronounceStatus) pronounceStatus.textContent = '';
          btnPronounceRecord.disabled = false;
          setPronounceRecordButton(false);
          return;
        }
        if (!pronounceChunks.length) {
          if (pronounceStatus) pronounceStatus.textContent = '';
          toast('녹음 데이터가 비어 있습니다.');
          btnPronounceRecord.disabled = false;
          setPronounceRecordButton(false);
          return;
        }

        btnPronounceRecord.disabled = true;
        setPronounceRecordButton(false);

        const blob = new Blob(pronounceChunks, { type: finalMime });
        try {
          await postPronounce(blob, pronounceCaption, finalMime);
        } finally {
          btnPronounceRecord.disabled = false;
        }
      };
      pronounceRecorder.start();
      pronounceMaxDurationTimer = window.setTimeout(() => {
        if (pronounceRecorder && pronounceRecorder.state === 'recording') {
          toast(`최대 녹음 시간(${PRONOUNCE_MAX_DURATION_MS / 1000}초)에 도달해 자동으로 전송합니다.`);
          pronounceRecorder.stop();
        }
      }, PRONOUNCE_MAX_DURATION_MS);
      setPronounceRecordButton(true);
      beginPronounceRecordingProgress();
    } catch (e) {
      clearPronounceRecordingProgress();
      pronounceStream?.getTracks().forEach((t) => t.stop());
      pronounceStream = null;
      pronounceRecorder = null;
      setPronounceRecordButton(false);
      toast('녹음을 시작할 수 없습니다.');
    }
  }

  /** Browser does not distinguish CORS vs offline; use fetch failure message heuristics. */
  function isLikelyNetworkOrCorsFailure(err) {
    const m = String((err && err.message) || err || '');
    return /failed to fetch|load failed|networkerror|network request failed|fetch.*abort/i.test(m);
  }

  function isPronounceNoResponseError(err) {
    if (!err) return false;
    if (err.name === 'AbortError') return true;
    return isLikelyNetworkOrCorsFailure(err);
  }

  function showPronounceServerBusy() {
    if (pronounceStatus) pronounceStatus.textContent = PRONOUNCE_BUSY_MESSAGE;
    toast(PRONOUNCE_BUSY_MESSAGE);
  }

  /**
   * CSV trans(아라비아 숫자)와 같을 때만 만점 보정.
   * 발음 인식문 전체가 **수치(아라비아 숫자)만**일 때만 적용.
   */
  function pronounceAsrDigitsMatchTrans(trans, bestUserSaid) {
    const t = String(trans ?? '').trim();
    if (!/^\d+$/.test(t)) return false;
    const want = Number(t);
    const s = String(bestUserSaid ?? '').trim();
    if (!/^\d+$/.test(s)) return false;
    return Number(s) === want;
  }

  /** 서버 `colored_caption`과 같은 방식: 공백 기준 토큰마다 녹색 (HTML 이스케이프) */
  function pronounceCaptionMatchWordsGreenHtml(caption) {
    const esc = (x) =>
      String(x ?? '').replace(/[&<>"']/g, (c) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
      );
    const s = String(caption ?? '');
    if (!s) return '';
    return s
      .split(/(\s+)/)
      .map((part) => {
        if (!part) return '';
        if (/^\s+$/.test(part)) return esc(part);
        return `<font color='green'>${esc(part)}</font>`;
      })
      .join('');
  }

  async function postPronounce(blob, caption, mimeType) {
    if (pronouncePosting) return;
    pronouncePosting = true;
    try {
    if (blob.size > PRONOUNCE_MAX_BYTES) {
      const mb = (blob.size / (1024 * 1024)).toFixed(2);
      const maxMb = (PRONOUNCE_MAX_BYTES / (1024 * 1024)).toFixed(1);
      toast(`녹음 파일이 너무 큽니다 (${mb}MB). 최대 약 ${maxMb}MB까지 전송할 수 있어요. 더 짧게 녹음해 주세요.`);
      if (pronounceStatus) pronounceStatus.textContent = '';
      return;
    }

    const base = getPronounceBase();
    const engine = 'google';
    // 첫 요청은 "요청중", 이후에는 기존 "채점 중" 문구 표시
    if (pronounceStatus) {
      pronounceStatus.textContent = pronounceRequestedOnce
        ? 'Gabrielle이 채점 중입니다...'
        : 'Gabrielle에게 요청중입니다...';
    }
    pronounceRequestedOnce = true;

    const fd = new FormData();
    fd.append('caption', caption);
    fd.append('engine', engine);
    const loc = (pronounceLocaleEl?.value || 'fr-FR').trim();
    fd.append('locale', loc || 'fr-FR');
    const ext = /\.webm/i.test(blob.type || mimeType) ? 'webm' : (/mpeg|mp3/i.test(blob.type || '') ? 'mp3' : 'webm');
    fd.append('audio', blob, `clip.${ext}`);

    try {
      const headers = {};
      const apiKey = (pronounceApiKeyEl?.value || '').trim();
      if (apiKey) headers['X-API-Key'] = apiKey;

      const ac = new AbortController();
      const tid = setTimeout(() => ac.abort(), PRONOUNCE_FETCH_TIMEOUT_MS);
      let res;
      try {
        res = await fetch(`${base}/api/pronounce`, {
          method: 'POST',
          headers,
          body: fd,
          signal: ac.signal
        });
      } finally {
        clearTimeout(tid);
      }
      const text = await res.text();
      let data;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }
      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem(LS_PRON_KEY_VERIFIED);
          setPronounceApiKeyWrapVisible(true);
          if (pronounceOutcome) pronounceOutcome.innerHTML = '';
          if (pronounceStatus) pronounceStatus.textContent = '';
          toast('이용 발급 key가 맞지 않거나 만료되었습니다. 다시 입력해 주세요.');
          throw new Error('__pronounce_auth_toast_shown__');
        }
        if ([502, 503, 504, 524].includes(res.status)) {
          if (pronounceOutcome) pronounceOutcome.innerHTML = '';
          showPronounceServerBusy();
          return;
        }
        const detail = (data && data.detail) ? JSON.stringify(data.detail) : text || res.statusText;
        throw new Error(detail);
      }

      localStorage.setItem(LS_PRON_KEY_VERIFIED, '1');
      setPronounceApiKeyWrapVisible(false);

      const transRow = state.current ? String(state.current[state.cols.ko] ?? '').trim() : '';
      let score = typeof data.score === 'number' ? data.score : '—';
      let colored = data.colored_caption ?? '';
      if (pronounceAsrDigitsMatchTrans(transRow, data.best_user_said)) {
        score = 100;
        colored = pronounceCaptionMatchWordsGreenHtml(caption);
      } else if (typeof data.score === 'number' && data.score === 100 && !String(colored || '').trim()) {
        colored = pronounceCaptionMatchWordsGreenHtml(caption);
      }
      const said = escapeHTML_(data.best_user_said || '(인식 없음)');
      const scoreHtml =
        typeof score === 'number'
          ? `<span class="pron-score-num">${score}점</span><span class="pron-score-suffix">(/100점)</span>`
          : escapeHTML_(String(score));
      const scoreToast = typeof score === 'number' ? `${score}점` : String(score);
      if (pronounceOutcome) {
        const cap = colored || escapeHTML_(caption);
        pronounceOutcome.innerHTML = `<div class="pronounce-caption-text">${cap}</div>
          <div class="pron-meta">점수 ${scoreHtml} · 인식 문장 <span style="opacity:.92">${said}</span></div>`;
      }
      if (pronounceStatus) pronounceStatus.textContent = '';
      toast(`발음 점수: ${scoreToast}`);
    } catch (e) {
      if ((e && e.message) === '__pronounce_auth_toast_shown__') return;
      if (pronounceOutcome) pronounceOutcome.innerHTML = '';
      if (isPronounceNoResponseError(e)) {
        showPronounceServerBusy();
        return;
      }
      if (pronounceStatus) pronounceStatus.textContent = '';
      toast(`발음 검사 오류: ${e.message || e}`);
    }
    } finally {
      pronouncePosting = false;
    }
  }

  /** local escape when server returns transcript for meta line */
  function escapeHTML_(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  if (btnPronounceRecord) {
    setPronounceRecordButton(false);
    btnPronounceRecord.addEventListener('click', () => togglePronounceRecord());
  }

  // URL 파라미터
  const url = new URL(location.href);
  const file = url.searchParams.get('file') || './test.csv';
  state.csvFileName = decodeURIComponent(file.split('/').pop().split('?')[0] || 'test.csv');
  const modeParam = url.searchParams.get('mode');
  state.practice = (modeParam === 'study') ? 'study' : 'quiz';


  // 🔊 화면이 안 보이게 될 때(홈버튼, 앱 전환, 탭 전환 등) 오디오 정지
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      stopAudio();
      stopPronounceRecording();
    }
  });

  // 🔙 뒤로 가기(히스토리 이동) / 페이지 떠날 때도 오디오 정지
  window.addEventListener('pagehide', () => { stopAudio(); stopPronounceRecording(); });
  window.addEventListener('beforeunload', () => { stopAudio(); stopPronounceRecording(); });

  // (선택) history.back 같은 popstate 상황도 잡고 싶으면
  window.addEventListener('popstate', () => { stopAudio(); stopPronounceRecording(); });

  function updateUnifiedBar() {
    const s = state.session;
    if (!s) return;

    const progressPct = Math.round(((s.idx + 1) / s.total) * 100);     // 진행 퍼센트
    const correctPct = Math.round((s.correctCount / s.total) * 100);  // 정답 퍼센트

    if (barProgress) barProgress.style.width = progressPct + '%';
    if (barCorrect) barCorrect.style.width = correctPct + '%';

    // ✅ 바 내부: 정답수
    if (barLabel) barLabel.textContent = String(s.correctCount);

    // ✅ 바 오른쪽: 전체 문항수
    if (barTotal) barTotal.textContent = String(s.idx + 1) + '/' + String(s.total);

    if (barUnified) barUnified.setAttribute('aria-valuenow', progressPct);
  }

  if (btnRestart) {
    btnRestart.addEventListener('click', () => {
      if (!state.rows.length) { showScreen(1); return; }
      const mode = (modeSeq && modeSeq.checked) ? 'seq' : 'random';
      startSession(20, mode);
      showScreen(2);
      renderCurrent();
    });
  }

  if (btnHome2) {
    btnHome2.addEventListener('click', () => { showScreen(1); });
  }

  if (btnSample) {
    btnSample.addEventListener('click', async () => {
      try {
        const res = await fetch('./test.csv', { cache: 'no-store' });
        if (!res.ok) throw new Error('파일 없음');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'test.csv';   // 다운로드 파일명
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast('test.csv 다운로드 완료');
      } catch (err) {
        toast('⚠️ test.csv 파일을 찾을 수 없습니다');
      }
    });
  }

  level.addEventListener('input', () => levelLabel.textContent = level.value + '%');

  // 파일 선택
  csvInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    state.csvFileName = file.name;
    const text = await file.text();
    handleCSV(text);
  });


  const themeToggle = document.querySelector('#themeToggle');

  // 기본: 밝은 모드이므로 체크 안 됨
  themeToggle.checked = false;

  themeToggle.addEventListener('change', () => {
      if(themeToggle.checked){
          document.body.classList.add('dark');
      } else {
          document.body.classList.remove('dark');
      }
  });


  // 자동 로드
  // window.addEventListener('DOMContentLoaded', tryAutoload);
  async function tryAutoload() {
    try {
      // const res = await fetch('./test.csv', { cache: 'no-store' });

      // 파일 로드
      const res = await fetch(file, { cache: 'no-store' });


      if (!res.ok) return false;
      const txt = await res.text();
      if (!/,/.test(txt)) return false;

      handleCSV(txt);                   // ← 이 안에서 state.rows 채워짐
      state.csvFileName = String(file).split('/').pop().split('?')[0] || 'test.csv';
      toast('데이터 로드됨');
      return true;                      // ✅ 성공 여부 반환
    } catch (err) {
      return false;                     // 실패
    }
  }

  // 엔터키: 마지막 입력칸이면 정답/채점 + 포커스 해제
  enMask.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const t = e.target;
    if (!(t instanceof HTMLInputElement)) return;
    if (!t.matches('input[data-ans]')) return;

    e.preventDefault();
    const inputs = Array.from(document.querySelectorAll('input[data-ans]'));
    const idx = inputs.indexOf(t);
    if (idx === inputs.length - 1) {
      showAnswer();
      gradeCurrent();
      document.activeElement.blur();
    } else if (idx > -1) {
      inputs[idx + 1].focus();
    }
  });

  // 데모
  btnDemo.addEventListener('click', () => {
    const demo = `일련번호,영문,번역
1,"Learning a new language takes time and practice.","새 언어를 배우려면 시간과 연습이 필요해요."
2,"Consistency beats intensity when building habits.","습관을 만들 때는 강도보다 꾸준함이 더 중요해요."
3,"Failure is not the opposite of success; it is part of success.","실패는 성공의 반대가 아니라 성공의 일부예요."
4,"Small daily improvements lead to stunning long-term results.","작은 일상의 개선이 놀라운 장기적 성과로 이어집니다."`;
    handleCSV(demo);
    state.csvFileName = 'test.csv';
  });

  // 화면1: 문제 내기 → 화면2
  btnPick.addEventListener('click', async () => {
    // 중복 클릭 방지(선택)
    btnPick.disabled = true;

    // 아직 로드 안 됐으면 test.csv 자동 시도
    if (!state.rows.length) {
      const ok = await tryAutoload();   // ✅ 로드 끝날 때까지 대기
      if (!ok) {
        toast('CSV를 먼저 불러오세요 (파일 선택 또는 데모 로드)');
        // btnPick.disabled = false;
        return;
      }

    }

    // 🔸 연습 모드: quiz | study
    state.practice = (practiceStudy && practiceStudy.checked) ? 'study' : 'quiz';
    // state.practice = 'quiz';

    btnPick.disabled = false
    const mode = (modeSeq && modeSeq.checked) ? 'seq' : 'random';
    startSession(20, mode);     // 🔸 모드 전달
    showScreen(2);
    renderCurrent();
    // (화면 전환되니 굳이 다시 활성화할 필요 없음)
  });

  // 화면2 버튼
  //btnNext.addEventListener('click', pickQuestion);
  btnNext.addEventListener('click', () => {
    const s = state.session;
    if (!s) return;

    gradeCurrent();

    if (s.idx < s.total - 1) {
      s.idx += 1;
      renderCurrent();
      updateUnifiedBar();

      // 🔥 자동재생
      if (state.audioLoop){
        togglePlayCurrent();
      }

    } else {
      // audioPlayer.pause();
      stopAudio(); 
      showResults();     // 🔹마지막 문제 다음 → 결과 화면
    }

  });

  function showResults() {
    const s = state.session;
    const total = s?.total || 0;
    const correct = s?.correctCount || 0;
    if (state.practice == 'study'){
      finalLine.textContent = `총 ${total}문장을 학습했습니다.`;
    }else{
      finalLine.textContent = `총 ${total}문제 중 ${correct}문제를 맞혔습니다.`;
    }
    
    showScreen(3);
  }

  // btnReveal.addEventListener('click', showAnswer);
  btnGrade.addEventListener('click', () => {
    showAnswer();
    gradeCurrent();
    document.activeElement.blur();
  });
  btnHome.addEventListener('click', () => { 
    // audioPlayer.pause();
    stopPronounceRecording();
    stopAudio(); 
    showScreen(1); state.rows = [];
   }
  );


  function startSession(n, mode = 'random') {
    console.log('startSession')
    const N = state.rows.length;
    let total = Math.min(n, N);
    let order;
    if (mode === 'seq') {
      // 순차: 앞에서부터 total개
      total = state.rows.length;     // ✅ 전체 문장 수
      order = Array.from({ length: N }, (_, i) => i).slice(0, total);
    } else {
      // 랜덤: 중복 없이 무작위 total개
      order = sampleWithoutReplacement(N, total);
    }

    state.session = { order, idx: 0, total, scored: Array(total).fill(false), correctCount: 0, mode };
    // scoreTotal.textContent = String(total);
    // scoreCorrect.textContent = '0';
    // progressTotal.textContent = String(total);
    // progressNow.textContent = '1';

    updateUnifiedBar();
  }

  function sampleWithoutReplacement(N, k) {
    // 피셔-예이츠에서 k개만 뽑기
    const arr = Array.from({ length: N }, (_, i) => i);
    for (let i = 0; i < k; i++) {
      const j = i + Math.floor(Math.random() * (N - i));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(0, k);
  }

  function renderCurrent() {
    const s = state.session;
    if (!s) return;
    const rowIdx = s.order[s.idx];
    const row = state.rows[rowIdx];
    state.current = row;

    const idv = row[state.cols.id] ?? (rowIdx + 1);
    const en = (row[state.cols.en] || '').toString();
    const koText = (row[state.cols.ko] || '').toString();
    const comment = (row[state.cols.comment] || '').toString();
    const pr = String(row[state.cols.pron] ?? '');

    const maskedInfo = maskEnglish(en, {
      ratio: Number(level.value) / 100,
      keepFirst: keepFirst.checked,
      minLen: Math.max(1, Number(minLen.value) || 1)
    });

    if (comment){
        ko.textContent = koText +'\n:' + comment;
    } else {
        ko.textContent = koText;
    }
    enMask.innerHTML = maskedInfo.html;
    enFull.textContent = '';
    answerWrap.style.display = 'none';
    selId.textContent = idv;

    updateUnifiedBar();

    if (state.practice === 'study') {
      // 🔹 학습 모드: 빈칸 없음, 정답/발음만 표시
      enMask.innerHTML = '';  // 마스킹 없이 원문 그대로
      const pronHtml = pr ? `<div style="color:#94a3b8; font-size:14px; margin-top:6px; line-height:1.5; font-style:italic;">[${pr}]</div>` : '';
      enFull.innerHTML = en + pronHtml;   // 정답 영역도 같은 내용(원문+발음)
      answerWrap.style.display = 'block';

      // 버튼 상태
      // btnReveal.disabled = true;  // 정답보기 불필요
      btnGrade.disabled = true;  // 채점 없음
      btnNext.disabled = false; // 다음으로 이동 가능

      // 스코어(이 문제의 빈칸 수는 0)
      // scoreCorrect.textContent = '0';
      // scoreTotal.textContent   = '0';

    } else {


      // 스코어(문장 내 빈칸 개수)
      // scoreCorrect.textContent = '0';
      // scoreTotal.textContent = String(maskedInfo.totalBlanks);
      // const correct = s?.correctCount || 0;
      // scoreCorrect.textContent = String(correct);


      // 🔹다음 버튼은 '채점 전'엔 비활성화 (채점해야 넘어갈 수 있게)
      //btnReveal.disabled = false;
      btnGrade.disabled = maskedInfo.totalBlanks === 0 ? false : false;
      btnNext.disabled = false;

      // 진행도
      // progressNow.textContent = String(s.idx + 1);
      // progressTotal.textConten = String(s.total);

      const firstBlank = document.querySelector('input[data-ans]');
      if (firstBlank) firstBlank.focus();
    }


    // ✅ 현재 행의 id 구하기 (없으면 행 인덱스+1)
    const idKey = state.cols?.id;
    const itemId = (idKey && row[idKey] != null && row[idKey] !== '')
      ? String(row[idKey]).trim()
      : String(rowIdx + 1);

    selId.textContent = itemId;

    // ... (퀴즈/학습 모드 분기 및 마스킹/표시 코드)

    // ✅ 오디오 준비
    prepareAudioFor(itemId);

    if (pronounceOutcome) pronounceOutcome.innerHTML = '';
    if (pronounceStatus) pronounceStatus.textContent = '';
  }


  let prepareAudioGeneration = 0;

  async function prepareAudioFor(itemId) {
    if (!audioPlayer || !btnAudio) return;
    const gen = ++prepareAudioGeneration;

    // 문제 전환 시 재생 중이면 정지
    if (!audioPlayer.paused) {
      audioPlayer.pause();
      audioPlayer.currentTime = 0;
    }
    btnAudio.textContent = '🔊 듣기';

    // 반복 여부 저장
    const loopCheck = document.querySelector('#audioLoop');
    if (loopCheck) {
        state.audioLoop = loopCheck.checked;
    }


    // 경로 규칙: ./mp3/<csv파일명에서 .csv 제거>/<id>.mp3 (폴더·파일명은 URL 인코딩)
    const csvBase = String(state.csvFileName || 'test.csv').replace(/\.csv$/i, '');
    const padItemId = String(itemId).padStart(3, '0');
    const src = `./mp3/${encodeURIComponent(csvBase)}/${encodeURIComponent(`${padItemId}.mp3`)}`;

    btnAudio.disabled = true;
    const onReady = () => {
      if (gen !== prepareAudioGeneration) return;
      btnAudio.disabled = false;
      if (state.audioLoop) audioPlayer.play().catch(() => {});
      audioPlayer.removeEventListener('canplay', onReady);
      audioPlayer.removeEventListener('error', onFail);
    };
    const onFail = () => {
      if (gen !== prepareAudioGeneration) return;
      btnAudio.disabled = true;
      try {
        audioPlayer.removeAttribute('src');
      } catch (_) {}
      audioPlayer.removeEventListener('canplay', onReady);
      audioPlayer.removeEventListener('error', onFail);
    };
    audioPlayer.removeEventListener('canplay', onReady);
    audioPlayer.removeEventListener('error', onFail);
    audioPlayer.addEventListener('canplay', onReady, { once: true });
    audioPlayer.addEventListener('error', onFail, { once: true });
    audioPlayer.src = src;
  }

  function togglePlayCurrent() {
    if (!audioPlayer) return;

    // 반복 설정 적용
    audioPlayer.loop = state.audioLoop;

    // src가 비어있거나 로드 안된 경우 방어
    if (!audioPlayer.src) { toast('오디오가 준비되지 않았어요.'); return; }

    if (audioPlayer.paused) {
      audioPlayer.play().catch(() => toast('오디오를 재생할 수 없어요.'));
    } else {
      audioPlayer.pause();
    }
  }


  // CSV 처리
  function handleCSV(text) {
    try {
      const rows = parseCSV(text);
      if (!rows.length) throw new Error('빈 CSV');

      const header = Object.keys(rows[0]);
      const norm = h => h.replace(/\s+/g, '').toLowerCase();
      const byNorm = Object.fromEntries(header.map(h => [norm(h), h]));
      const idKey = byNorm['no'] || byNorm['일련번호'] || byNorm['id'] || header[0];
      const enKey = byNorm['original'] || byNorm['원문'] || header[1];
      const koKey = byNorm['trans'] || byNorm['번역'] || byNorm['translation'] || header[2];
      const groupKey = byNorm['group'] || byNorm['그룹'] || header[3];
      const speakerKey = byNorm['speaker'] || byNorm['화자'] || header[4];
      const pronKey = byNorm['pron'] || byNorm['발음'] || header[5];
      const commentKey = byNorm['comment'] || byNorm['비고'] || header[6];

      state.cols = { id: idKey, en: enKey, ko: koKey, group: groupKey, speaker: speakerKey, pron: pronKey, comment: commentKey };
      state.rows = rows.filter(r => (r[enKey] ?? '').toString().trim());

      totalCnt.textContent = state.rows.length;
      btnPick.disabled = false; //!state.rows.length;

      // 화면2 버튼 초기화
      btnNext.disabled = !state.rows.length;
      // btnReveal.disabled = true;
      btnGrade.disabled = false;

      // 문제 영역 초기화
      ko.textContent = '—';
      enMask.textContent = '—';
      enFull.textContent = '';
      answerWrap.style.display = 'none';
      selId.textContent = '—';
      // scoreCorrect.textContent = '0';
      // scoreTotal.textContent = '0';

      //toast(`불러오기 완료: ${state.rows.length}건`);
    } catch (err) {
      alert('CSV 파싱 오류: ' + err.message);
    }
  }

  // // 정답 표시
  // function showAnswer(){
  //   if(!state.current) return;
  //   enFull.innerHTML  = state.current[state.cols.en] +'<br><div style="color:#94a3b8; font-size:14px; margin-top:6px; line-height:1.5; font-style:italic;">[' + state.current[state.cols.pron] + ']</div>' || '';
  //   answerWrap.style.display = 'block';
  // }
  // 정답 표시
  function showAnswer() {
    if (!state.current) return;
    if (state.practice === 'study') return; // 학습 모드에선 의미 없음

    const en = state.current[state.cols.en] || '';
    const pron = state.current[state.cols.pron] || '';

    // pron이 있을 때만 발음 div 추가
    const pronHtml = pron
      ? `<div style="color:#94a3b8; font-size:14px; margin-top:6px; line-height:1.5; font-style:italic;">[${pron}]</div>`
      : '';

    enFull.innerHTML = en + pronHtml;
    answerWrap.style.display = 'block';
  }

  // 문제 뽑기
  function pickQuestion() {
    if (!state.rows.length) return;
    const idx = Math.floor(Math.random() * state.rows.length);
    const row = state.rows[idx];
    state.current = row;

    const idv = row[state.cols.id] ?? (idx + 1);
    const en = (row[state.cols.en] || '').toString();
    const koText = (row[state.cols.ko] || '').toString();

    const maskedInfo = maskEnglish(en, {
      ratio: Number(level.value) / 100,
      keepFirst: keepFirst.checked,
      minLen: Math.max(1, Number(minLen.value) || 1)
    });

    ko.textContent = koText;
    enMask.innerHTML = maskedInfo.html;
    enFull.textContent = '';
    answerWrap.style.display = 'none';
    selId.textContent = idv;

    // 스코어 초기화
    // scoreCorrect.textContent = '0';
    //scoreTotal.textContent = String(maskedInfo.totalBlanks);

    // btnReveal.disabled = false;
    btnGrade.disabled = false; //maskedInfo.totalBlanks === 0;
    btnNext.disabled = false;

    // 첫 번째 빈칸 포커스
    const firstBlank = document.querySelector('input[data-ans]');
    if (firstBlank) firstBlank.focus();
  }

  // 채점
  function gradeCurrent() {
    const inputs = Array.from(document.querySelectorAll('input[data-ans]'));
    if (inputs.length === 0) { //toast('채점할 빈칸이 없습니다');
      return;
    }
    let correct = 0;
    const trans = state.current
      ? String(state.current[state.cols.ko] ?? '').trim()
      : '';

    for (const inp of inputs) {
      const ans = inp.getAttribute('data-ans') || '';
      const keep = inp.getAttribute('data-keepfirst') === '1';
      const user = (inp.value || '').trim();
      //const fullUser = keep ? ((ans[0]||'') + user) : user;

      // 숫자만 입력했을 때: 번역(trans) 열의 아라비아 숫자와 같으면 정답 (예: 정답 douze, trans "12" ↔ "12")
      if (
        /^\d+$/.test(user) &&
        /^\d+$/.test(trans) &&
        Number(user) === Number(trans) &&
        !/^\d+$/.test(ans)
      ) {
        inp.classList.remove('bad');
        inp.classList.add('good');
        correct++;
        continue;
      }

      let fullUser = user;

      if (keep) {
        const first = ans[0] || '';
        if (first) {
          // 사용자가 첫 글자를 이미 썼다면 그대로 비교,
          // 안 썼다면 자동으로 첫 글자를 보태서 비교
          if (user.length === 0) {
            fullUser = first;                 // 빈 입력도 최소 첫 글자와 비교
          } else if (user[0].localeCompare(first, undefined, { sensitivity: 'accent' }) !== 0) {
            fullUser = first + user;       // 앞글자 안 썼으면 보태기
          } // 앞글자 썼으면 그대로
        }
      }



      if (fullUser.localeCompare(ans, undefined, { sensitivity: 'accent' }) === 0) {
        inp.classList.remove('bad'); inp.classList.add('good'); correct++;
      } else {
        inp.classList.remove('good'); inp.classList.add('bad');
      }
    }
    // scoreCorrect.textContent = String(correct);
    //scoreTotal.textContent = String(inputs.length);

    // 🔹정답 집계: 모든 빈칸을 맞춘 경우에만 그 문제를 '정답' 처리
    const s = state.session;
    if (s) {
      const isAllCorrect = (correct === inputs.length);
      // 같은 문제에서 여러 번 눌러도 '처음 정답 처리'만 1점 반영
      if (isAllCorrect && !s.scored[s.idx]) {
        s.correctCount += 1;
        s.scored[s.idx] = true;
      }
    }

    // 채점 후 다음 문제 이동 가능
    btnNext.disabled = false;
    updateUnifiedBar();

  }



  const btnAudio = document.querySelector('#btnAudio');
  const audioPlayer = document.querySelector('#audioPlayer');

  if (btnAudio) {
    btnAudio.addEventListener('click', togglePlayCurrent);
  }
  if (audioPlayer) {
    audioPlayer.addEventListener('ended', () => { btnAudio.textContent = '🔊 듣기'; });
    audioPlayer.addEventListener('pause', () => { btnAudio.textContent = '🔊 듣기'; });
    audioPlayer.addEventListener('play', () => { btnAudio.textContent = '⏸ 일시정지'; });
    audioPlayer.onerror = () => toast('오디오 파일을 찾을 수 없어요.');
  }

  function stopPronounceRecording() {
    clearPronounceRecordingProgress();
    if (pronounceMaxDurationTimer) {
      clearTimeout(pronounceMaxDurationTimer);
      pronounceMaxDurationTimer = null;
    }
    const hadSession = !!(pronounceRecorder || pronounceStream);
    if (!hadSession) {
      suppressPronounceUpload = false;
      return;
    }
    suppressPronounceUpload = true;
    try {
      pronounceStream?.getTracks().forEach((t) => t.stop());
    } catch (_) {}
    try {
      if (pronounceRecorder && pronounceRecorder.state === 'recording') {
        pronounceRecorder.stop();
      }
    } catch (_) {}
    pronounceStream = null;
    pronounceChunks = [];
  }

  function stopAudio(){
  if (!audioPlayer) return;

  if (!audioPlayer.paused) {
    audioPlayer.pause();
  }
  audioPlayer.currentTime = 0;

  if (btnAudio) {
    btnAudio.textContent = '🔊 듣기';
  }
}



  async function startWith({ file, count = 'all' } = {}) {
    // 1) CSV 로드
    const res = await fetch(file, { cache: 'no-store' });
    const csvText = await res.text();
    handleCSV(csvText);

    // 2) 모드 세팅
    // 🔸 연습 모드: quiz | study
    state.practice = (practiceStudy && practiceStudy.checked) ? 'study' : 'quiz';
    // state.practice = (mode === 'study') ? 'study' : 'quiz';
    const mode = (modeSeq && modeSeq.checked) ? 'seq' : 'random';

    if (mode == 'random'){
      count = 20
    }

    // 3) 문제 개수 결정
    const total = (count && count !== 'all') ? Math.min(Number(count), state.rows.length)
      : state.rows.length;


    // URL 파라미터
    // const url  = new URL(location.href);
    const csvFilePath = file || './test.csv';
    // 폴더명에 'csv파일명'을 그대로 쓴다 했으므로 확장자 포함 파일명 그대로 사용
    const csvFileName = csvFilePath.split('/').pop(); // ex) "fr.csv"
    state.csvFileName = csvFileName;


    // 4) 세션 시작 + 화면 전환
    startSession(total, mode);
    showScreen(2);
    renderCurrent();
  }

  // 페이지 외부에서 호출할 수 있게 반환
  return {
    startWith,
    // 필요시 다른 메서드도 노출 가능
  };
}
