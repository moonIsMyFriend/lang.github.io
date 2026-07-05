(function () {
  'use strict';

  /** learnlang_server — cloud IP may be blocked by YouTube; try local server next. */
  function getTranscriptApiBases() {
    const host = window.location.hostname;
    if (host === '127.0.0.1' || host === 'localhost') {
      return ['http://127.0.0.1:8765'];
    }
    return ['https://learnlang-4fm6.onrender.com', 'http://127.0.0.1:8765'];
  }

  function isRetriableTranscriptError(msg) {
    const s = String(msg || '').toLowerCase();
    return (
      s.includes('blocking requests') ||
      s.includes('ip has been blocked') ||
      s.includes('ip를 차단') ||
      s.includes('클라우드') ||
      s.includes('연결하지 못했습니다') ||
      s.includes('could not retrieve a transcript')
    );
  }

  const $ = (id) => document.getElementById(id);

  const urlInput = $('ytUrl');
  const btnLoad = $('btnLoad');
  const btnLoopToggle = $('btnLoopToggle');
  const langSelect = $('captionLang');
  const cueList = $('cueList');
  const nowCue = $('nowCue');
  const statusEl = $('status');
  const cueCountEl = $('cueCount');
  const vttFile = $('vttFile');
  const rangeStart = $('rangeStart');
  const rangeEnd = $('rangeEnd');
  const btnCaptionSettings = $('btnCaptionSettings');
  const captionSettings = $('ytCaptionSettings');
  const btnAnsLeft = $('btnAnsLeft');
  const btnAnsNon = $('btnAnsNon');
  const btnAnsRight = $('btnAnsRight');
  const quizScoreEl = $('quizScore');
  const ytSpeedEl = $('ytSpeed');
  const ytLoopHud = $('ytLoopHud');
  const ytPlayerMask = $('ytPlayerMask');
  const volUp = $('volUp');
  const volDown = $('volDown');
  const padPrev = $('padPrev');
  const padNextDpad = $('padNextDpad');
  const quizAnswers = new Map();

  function showFatalError(message) {
    const text = message || '스크립트 오류가 발생했습니다.';
    if (statusEl) {
      statusEl.textContent = text;
      statusEl.classList.add('is-error');
      statusEl.classList.remove('sr-only');
    }
    if (cueList) {
      cueList.innerHTML = `<p class="muted yt-cue-empty">${escapeHtml(text)}</p>`;
    }
  }

  window.addEventListener('error', (event) => {
    showFatalError(event.message);
  });
  window.addEventListener('unhandledrejection', (event) => {
    showFatalError(event.reason?.message || String(event.reason || 'Promise 오류가 발생했습니다.'));
  });

  const LS_PLAYBACK_RATE = 'learnlang_playback_rate';
  const SPEED_STEP = 0.25;
  const SPEED_MIN = 0.25;
  const SPEED_MAX = 2;
  const SPEED_MIN_STEP = SPEED_MIN / SPEED_STEP;
  const SPEED_MAX_STEP = SPEED_MAX / SPEED_STEP;

  function clampSpeedStep(step) {
    return Math.min(SPEED_MAX_STEP, Math.max(SPEED_MIN_STEP, step));
  }

  function stepToRate(step) {
    return Math.round(step * SPEED_STEP * 100) / 100;
  }

  function rateToStep(rate) {
    return clampSpeedStep(Math.round(rate / SPEED_STEP));
  }

  function loadSpeedStep() {
    try {
      const saved = Number(localStorage.getItem(LS_PLAYBACK_RATE));
      if (Number.isFinite(saved) && saved >= SPEED_MIN && saved <= SPEED_MAX) {
        return rateToStep(saved);
      }
    } catch (_) {}
    return rateToStep(1);
  }

  let speedStep = loadSpeedStep();

  function persistSpeed() {
    try {
      localStorage.setItem(LS_PLAYBACK_RATE, String(stepToRate(speedStep)));
    } catch (_) {}
  }

  function formatSpeed(rate) {
    const n = stepToRate(rateToStep(rate));
    return `x${Number.isInteger(n) ? n : String(n)}`;
  }

  function syncSpeedHud() {
    if (ytSpeedEl) ytSpeedEl.textContent = formatSpeed(stepToRate(speedStep));
  }

  function applyPlaybackSpeed() {
    const rate = stepToRate(speedStep);
    if (player && typeof player.setPlaybackRate === 'function') {
      try {
        player.setPlaybackRate(rate);
      } catch (_) {}
    }
    persistSpeed();
    syncSpeedHud();
  }

  function bindDpadPressFx(btn) {
    if (!btn) return;
    const press = () => btn.classList.add('pressed');
    const release = () => {
      btn.classList.remove('pressed');
      btn.blur();
    };
    btn.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      try { btn.setPointerCapture(e.pointerId); } catch (_) {}
      press();
    });
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('lostpointercapture', release);
  }

  function updateDpadButtons() {
    const hasPlayer = !!(player && typeof player.setPlaybackRate === 'function');
    const hasCues = cues.length > 0;
    if (volUp) volUp.disabled = !hasPlayer;
    if (volDown) volDown.disabled = !hasPlayer;
    if (padPrev) padPrev.disabled = !hasCues;
    if (padNextDpad) padNextDpad.disabled = !hasCues;
  }

  let player = null;
  let cues = [];
  let activeIndex = -1;
  let loopIndex = -1;
  let loopSeekGuardUntil = 0;
  let tickTimer = null;
  let pendingStart = 0;
  let playEnd = null;
  let captionTracks = [];
  let srtSourcePath = '';
  let cuesFromSrt = false;
  let lastLoadedVideoId = '';
  let catalogPromise = null;
  let youtubeApiPromise = null;

  const LOOP_SEEK_GUARD_MS = 250;

  function setStatus(msg, isError) {
    if (!statusEl) return;
    statusEl.textContent = msg || '';
    statusEl.classList.toggle('is-error', !!isError);
    statusEl.classList.toggle('sr-only', !isError);
  }

  function parseVideoId(input) {
    const s = String(input || '').trim();
    const m =
      s.match(/(?:youtube\.com\/watch\?.*v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/) ||
      s.match(/^([a-zA-Z0-9_-]{11})$/);
    return m ? m[1] : null;
  }

  function parseClock(parts) {
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    const s = parseInt(parts[2], 10) || 0;
    return h * 3600 + m * 60 + s;
  }

  /** SRT/VTT: 00:00:01,010 or 00:00:01.010 */
  function parseSubRipTime(tok) {
    if (!tok) return 0;
    const t = String(tok)
      .trim()
      .replace(/\s*([,.])\s*/g, '.')
      .replace(/\s+/g, '');
    const hms = t.match(/^(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/);
    if (hms) {
      const ms = hms[4] ? parseInt(hms[4].padEnd(3, '0').slice(0, 3), 10) / 1000 : 0;
      return parseInt(hms[1], 10) * 3600 + parseInt(hms[2], 10) * 60 + parseInt(hms[3], 10) + ms;
    }
    const ms2 = t.match(/^(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?$/);
    if (ms2) {
      const frac = ms2[3] ? parseInt(ms2[3].padEnd(3, '0').slice(0, 3), 10) / 1000 : 0;
      return parseInt(ms2[1], 10) * 60 + parseInt(ms2[2], 10) + frac;
    }
    return 0;
  }

  function parseTimeToken(tok) {
    if (!tok) return 0;
    const t = tok.trim();
    if (/^\d+([.,]\d+)?$/.test(t)) return parseFloat(t.replace(',', '.'));
    const hm = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s?)?$/i);
    if (hm && (hm[1] || hm[2] || hm[3])) {
      return (parseInt(hm[1], 10) || 0) * 3600 + (parseInt(hm[2], 10) || 0) * 60 + (parseFloat(hm[3]) || 0);
    }
    const sub = parseSubRipTime(t);
    if (sub > 0 || /^(\d{1,2}:){1,2}\d{2}/.test(t)) return sub;
    const clock = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (clock) return parseClock([clock[3] ? clock[1] : 0, clock[3] ? clock[2] : clock[1], clock[3] || clock[2]]);
    return 0;
  }

  function parseUrlTimes(input) {
    let start = 0;
    let end = null;
    const s = String(input || '');

    const range = s.match(/\[(\d{1,2}:\d{2}(?::\d{2})?)\s*~\s*(\d{1,2}:\d{2}(?::\d{2})?)\]/);
    if (range) {
      start = parseTimeToken(range[1]);
      end = parseTimeToken(range[2]);
    }

    const tParam = s.match(/[?&]t=([^&\s\]]+)/);
    if (tParam) start = parseTimeToken(tParam[1]);

    const startParam = s.match(/[?&]start=(\d+)/);
    if (startParam) start = parseInt(startParam[1], 10);

    const endParam = s.match(/[?&]end=(\d+)/);
    if (endParam) end = parseInt(endParam[1], 10);

    return { start, end };
  }

  function formatTime(sec) {
    const t = Math.max(0, sec || 0);
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = Math.floor(t % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function finalizeCues(list) {
    const sorted = list
      .filter((c) => c.text)
      .sort((a, b) => a.start - b.start);
    for (let i = 0; i < sorted.length; i++) {
      const next = sorted[i + 1];
      const endFromCue = sorted[i].end;
      sorted[i].end =
        endFromCue && endFromCue > sorted[i].start
          ? endFromCue
          : next
            ? next.start
            : sorted[i].start + (sorted[i].duration || 2.5);
      sorted[i].duration = Math.max(0.15, sorted[i].end - sorted[i].start);
    }
    return sorted;
  }

  function parseTimedTextBlock(lines) {
    const timeLine = lines.find((l) => /-->/i.test(l));
    if (!timeLine) return null;
    const parts = timeLine.split(/-->/i);
    const start = parseSubRipTime(parts[0]);
    const end = parts[1] ? parseSubRipTime(parts[1]) : 0;
    const idx = lines.indexOf(timeLine);
    const textLines = lines
      .slice(idx + 1)
      .join(' ')
      .replace(/<[^>]+>/g, '')
      .trim();
    if (!textLines) return null;
    const duration = end > start ? end - start : 0;
    return { start, end: end > start ? end : undefined, duration, text: textLines };
  }

  function parseWebVtt(text) {
    const raw = [];
    const blocks = text.replace(/\r/g, '').split(/\n\n+/);
    for (const block of blocks) {
      const lines = block.trim().split('\n');
      if (lines.length < 2) continue;
      const cue = parseTimedTextBlock(lines);
      if (cue) raw.push(cue);
    }
    return finalizeCues(raw);
  }

  function extractYoutubeUrlFromLine(line) {
    const trimmed = line.trim();
    if (!trimmed) return '';
    const hash = trimmed.match(/^#\s*(https?:\/\/\S+)/i);
    if (hash) return hash[1].replace(/[.,)]+$/, '');
    const tag = trimmed.match(/^youtube\s*:\s*(\S+)/i);
    if (tag) return tag[1].replace(/[.,)]+$/, '');
    if (/^https?:\/\/\S+/i.test(trimmed) && /-->/i.test(trimmed) === false && /youtube/i.test(trimmed)) {
      return trimmed.replace(/[.,)]+$/, '');
    }
    return '';
  }

  function splitSrtSource(text) {
    const lines = text.replace(/\r/g, '').split('\n');
    let youtubeUrl = '';
    const body = [];
    for (const line of lines) {
      if (!youtubeUrl) {
        const found = extractYoutubeUrlFromLine(line);
        if (found) {
          youtubeUrl = found;
          continue;
        }
      }
      body.push(line);
    }
    return { youtubeUrl, body: body.join('\n').trim() };
  }

  function parseSrt(text) {
    const { youtubeUrl, body } = splitSrtSource(text);
    const raw = [];
    const blocks = body.split(/\n\s*\n/);
    for (const block of blocks) {
      const lines = block
        .trim()
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
      if (lines.length < 2) continue;
      const first = lines[0];
      const bodyLines = /^\d+$/.test(first) ? lines.slice(1) : lines;
      const cue = parseTimedTextBlock(bodyLines);
      if (cue) raw.push(cue);
    }
    return { cues: finalizeCues(raw), youtubeUrl };
  }

  function syncPageSubtitle() {
    if (typeof window.updateHubPageTitle !== 'function') return;
    const fromQuery = new URLSearchParams(location.search).get('srt');
    const path = srtSourcePath || fromQuery || '';
    const label = path
      ? decodeURIComponent(String(path)).split('/').pop().replace(/\.srt$/i, '')
      : '';
    window.updateHubPageTitle(label || '\u00a0');
  }

  function applyLoadedCues(sourceLabel) {
    applyRangeFilter();
    activeIndex = cues.length > 0 ? 0 : -1;
    loopIndex = activeIndex;
    clearLoopSeekGuard();
    captionTracks = [];
    langSelect.innerHTML = '<option value="">파일</option>';
    langSelect.disabled = true;
    resetQuizScore();
    renderCueList();
    if (activeIndex >= 0) {
      updateNowDisplay(activeIndex);
      requestAnimationFrame(() => scrollCueIntoView(activeIndex, false));
    }
    updateQuizButtonsEnabled();
    updateDpadButtons();
    syncPageSubtitle();
    setStatus('');
  }

  async function fetchTranscriptFromBase(base, videoId, lang) {
    const q = new URLSearchParams({
      video_id: videoId,
      lang: lang || 'fr',
    });
    let res;
    try {
      res = await fetch(`${base}/api/youtube/transcript?${q}`);
    } catch (_) {
      throw new Error(
        `자막 서버에 연결하지 못했습니다 (${base}). learnlang_server가 실행 중인지 확인해 주세요.`
      );
    }
    let body = {};
    try {
      body = await res.json();
    } catch (_) {
      /* ignore */
    }
    if (!res.ok) {
      const detail = body.detail;
      const msg =
        typeof detail === 'string'
          ? detail
          : Array.isArray(detail)
            ? detail.map((d) => d.msg || d).join(', ')
            : `HTTP ${res.status}`;
      throw new Error(msg || '자막을 가져오지 못했습니다.');
    }
    return body;
  }

  async function fetchTranscriptApi(videoId, lang) {
    const bases = getTranscriptApiBases();
    let lastErr = null;
    for (let i = 0; i < bases.length; i++) {
      try {
        const data = await fetchTranscriptFromBase(bases[i], videoId, lang);
        if (i > 0) {
          setStatus('로컬 자막 서버(127.0.0.1:8765)에서 불러왔습니다.');
        }
        return data;
      } catch (err) {
        lastErr = err;
        const canRetry = i < bases.length - 1 && isRetriableTranscriptError(err.message);
        if (!canRetry) break;
      }
    }
    throw lastErr || new Error('자막을 가져오지 못했습니다.');
  }

  function fillLangSelect(tracks, selectedCode) {
    langSelect.innerHTML = '';
    if (!tracks.length) {
      langSelect.disabled = true;
      return;
    }
    langSelect.disabled = false;
    for (const t of tracks) {
      const opt = document.createElement('option');
      opt.value = t.languageCode || '';
      const label = t.name || t.languageCode || 'unknown';
      opt.textContent = `${label} (${t.languageCode || '?'})`;
      langSelect.appendChild(opt);
    }
    if (selectedCode) langSelect.value = selectedCode;
  }

  function filterByRange(list, start, end) {
    if (!end && !start) return list;
    return list.filter((c) => c.start >= start - 0.05 && (!end || c.start < end + 0.05));
  }

  function revealCue(index) {
    if (!cueList || !cues[index]) return;
    const row = cueList.querySelector(`[data-index="${index}"]`);
    if (!row) return;
    const cue = cues[index];
    row.classList.add('is-revealed');
    const timeEl = row.querySelector('.yt-cue-time');
    const textEl = row.querySelector('.yt-cue-text');
    if (timeEl) timeEl.textContent = `${formatTime(cue.start)} ~ ${formatTime(cue.end)}`;
    if (textEl) textEl.textContent = cue.text;
  }

  function renderCueList() {
    if (!cueList) return;
    cueList.innerHTML = '';
    if (!cues.length) {
      cueList.innerHTML =
        '<p class="muted yt-cue-empty">자막이 없습니다. 언어를 바꾸거나 VTT/SRT 파일을 업로드해 보세요.</p>';
      if (cueCountEl) cueCountEl.textContent = '0';
      updateLoopToggle();
      return;
    }
    if (cueCountEl) cueCountEl.textContent = String(cues.length);

    cues.forEach((cue, i) => {
      const revealed = quizAnswers.get(i) === 'correct';
      const row = document.createElement('div');
      row.className = 'yt-cue';
      row.dataset.index = String(i);
      row.classList.toggle('is-revealed', revealed);
      if (i === activeIndex) row.classList.add('is-active');
      if (i === loopIndex) row.classList.add('is-looping');

      row.innerHTML = `
        <span class="yt-cue-no">${i + 1}.</span>
        <span class="yt-cue-time">${revealed ? `${formatTime(cue.start)} ~ ${formatTime(cue.end)}` : ''}</span>
        <span class="yt-cue-text">${revealed ? escapeHtml(cue.text) : ''}</span>
      `;

      row.addEventListener('click', () => {
        if (loopIndex >= 0) {
          clearLoopSeekGuard();
          loopIndex = i;
          seekToCue(i, true, true);
          setStatus(`구간 반복: ${formatTime(cues[i].start)} ~ ${formatTime(cues[i].end)}`);
        } else {
          seekToCue(i, true);
        }
      });
      cueList.appendChild(row);
    });
    updateLoopToggle();
    if (activeIndex >= 0) {
      requestAnimationFrame(() => scrollCueIntoView(activeIndex, false));
    }
  }

  function scrollCueIntoView(index, smooth) {
    if (!cueList) return;
    const row = cueList.querySelector(`[data-index="${index}"]`);
    if (!row) return;
    const listRect = cueList.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    const top = cueList.scrollTop + (rowRect.top - listRect.top);
    cueList.scrollTo({
      top: Math.max(0, top),
      behavior: smooth ? 'smooth' : 'auto',
    });
  }

  function clearLoopSeekGuard() {
    loopSeekGuardUntil = 0;
  }

  function updateNowDisplay(index) {
    if (nowCue) {
      if (index < 0 || !cues[index]) {
        nowCue.textContent = '재생 중인 자막이 여기에 표시됩니다.';
        nowCue.classList.add('is-empty');
        nowCue.classList.remove('is-active');
      } else {
        nowCue.textContent = cues[index].text;
        nowCue.classList.remove('is-empty');
        nowCue.classList.add('is-active');
      }
    }
    updateQuizButtonsEnabled();
  }

  function determineAnswer(text) {
    const t = String(text || '');
    if (/\[\s*-\s*\]/.test(t)) return 'non';
    if (/left/i.test(t)) return 'left';
    if (/right/i.test(t)) return 'right';
    return null;
  }

  function getCurrentQuizIndex() {
    if (loopIndex >= 0 && cues[loopIndex]) return loopIndex;
    if (activeIndex >= 0 && cues[activeIndex]) return activeIndex;
    return -1;
  }

  function updateQuizButtonsEnabled() {
    const idx = getCurrentQuizIndex();
    const hasAnswer = idx >= 0 && determineAnswer(cues[idx] && cues[idx].text) != null;
    [btnAnsLeft, btnAnsNon, btnAnsRight].forEach((b) => {
      if (b) b.disabled = !hasAnswer;
    });
  }

  function updateQuizScore() {
    if (!quizScoreEl) return;
    let correct = 0;
    for (const v of quizAnswers.values()) if (v === 'correct') correct++;
    quizScoreEl.textContent = `${correct} / ${cues.length}`;
  }

  function resetQuizScore() {
    quizAnswers.clear();
    updateQuizScore();
  }

  function handleQuizAnswer(answer) {
    const idx = getCurrentQuizIndex();
    if (idx < 0 || !cues[idx]) return;
    const correct = determineAnswer(cues[idx].text);
    if (!correct) return;
    const ok = answer === correct;
    quizAnswers.set(idx, ok ? 'correct' : 'wrong');
    updateQuizScore();
    if (ok) {
      revealCue(idx);
      if (idx < cues.length - 1) {
        setTimeout(() => stepCue(1), 600);
      }
    }
  }

  function highlightActive(index, smoothScroll) {
    if (index === activeIndex) return;
    activeIndex = index;
    updateNowDisplay(index);
    if (!cueList) return;
    cueList.querySelectorAll('.yt-cue').forEach((row) => {
      const i = parseInt(row.dataset.index, 10);
      row.classList.toggle('is-active', i === index);
      row.classList.toggle('is-looping', i === loopIndex);
    });
    updateLoopToggle();
    requestAnimationFrame(() => scrollCueIntoView(index, smoothScroll !== false));
  }

  function findCueIndex(time) {
    for (let i = cues.length - 1; i >= 0; i--) {
      if (time >= cues[i].start - 0.05) return i;
    }
    return -1;
  }

  function seekToCue(index, play, keepLoop) {
    if (!cues[index]) return;
    if (!keepLoop) {
      loopIndex = -1;
      clearLoopSeekGuard();
      updateLoopToggle();
    }
    if (player) {
      player.seekTo(cues[index].start, true);
      if (play) player.playVideo();
    }
    activeIndex = index;
    updateNowDisplay(index);
    if (cueList) {
      cueList.querySelectorAll('.yt-cue').forEach((row) => {
        const i = parseInt(row.dataset.index, 10);
        row.classList.toggle('is-active', i === index);
        row.classList.toggle('is-looping', i === loopIndex);
      });
    }
    updateLoopToggle();
    requestAnimationFrame(() => scrollCueIntoView(index, true));
  }

  function updateLoopToggle() {
    const on = loopIndex >= 0;
    if (btnLoopToggle) {
      btnLoopToggle.disabled = cues.length === 0;
      btnLoopToggle.classList.toggle('is-on', on);
      btnLoopToggle.setAttribute('aria-pressed', on ? 'true' : 'false');
      btnLoopToggle.setAttribute('aria-label', on ? '구간 반복 끄기' : '구간 반복 켜기');
      btnLoopToggle.title = on ? '구간 반복 끄기' : '구간 반복 켜기';
    }
    if (ytLoopHud) ytLoopHud.classList.toggle('is-on', on);
  }

  function toggleLoop(index) {
    if (!cues[index]) return;
    if (loopIndex === index) {
      loopIndex = -1;
      clearLoopSeekGuard();
      setStatus('');
      if (cueList) {
        cueList.querySelectorAll('.yt-cue').forEach((row) => {
          row.classList.toggle('is-looping', false);
        });
      }
      if (player && window.YT) {
        player.playVideo();
      }
    } else {
      loopIndex = index;
      seekToCue(index, true, true);
      setStatus(`구간 반복: ${formatTime(cues[index].start)} ~ ${formatTime(cues[index].end)}`);
    }
    updateLoopToggle();
  }

  function toggleLoopCurrent() {
    const idx = activeIndex >= 0 ? activeIndex : 0;
    if (cues[idx]) toggleLoop(idx);
  }

  function stopTick() {
    if (tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
  }

  function startTick() {
    stopTick();
    tickTimer = setInterval(() => {
      if (!player || typeof player.getCurrentTime !== 'function') return;
      const t = player.getCurrentTime();

      if (playEnd != null && t >= playEnd - 0.08) {
        player.pauseVideo();
        playEnd = null;
      }

      if (loopIndex >= 0 && cues[loopIndex]) {
        const cue = cues[loopIndex];

        if (loopSeekGuardUntil > 0) {
          if (Date.now() < loopSeekGuardUntil) {
            highlightActive(loopIndex);
            return;
          }
          clearLoopSeekGuard();
        }

        if (t >= cue.end - 0.05) {
          loopSeekGuardUntil = Date.now() + LOOP_SEEK_GUARD_MS;
          player.seekTo(cue.start, true);
          player.playVideo();
          highlightActive(loopIndex);
          return;
        }

        highlightActive(loopIndex);
        return;
      }

      const idx = findCueIndex(t);
      if (idx >= 0) highlightActive(idx);
    }, 120);
  }

  function loadYouTubeApi() {
    if (window.YT && window.YT.Player) return Promise.resolve();
    if (youtubeApiPromise) return youtubeApiPromise;

    youtubeApiPromise = new Promise((resolve, reject) => {
      if (window.YT && window.YT.Player) {
        resolve();
        return;
      }
      window.onYouTubeIframeAPIReady = () => {
        resolve();
      };
      if (document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const wait = setInterval(() => {
          if (window.YT && window.YT.Player) {
            clearInterval(wait);
            resolve();
          }
        }, 50);
        setTimeout(() => {
          clearInterval(wait);
          reject(new Error('YouTube API 로드 시간 초과'));
        }, 15000);
        return;
      }
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.onerror = () => reject(new Error('YouTube API 스크립트 로드 실패'));
      document.head.appendChild(tag);
    });
    return youtubeApiPromise;
  }

  function destroyPlayer() {
    stopTick();
    clearLoopSeekGuard();
    if (player) {
      try {
        player.destroy();
      } catch (_) {
        /* ignore */
      }
      player = null;
    }
    updateDpadButtons();
  }

  function applyMutedAutoplay(target) {
    if (!target) return;
    try {
      if (typeof target.setVolume === 'function') {
        target.setVolume(100);
      }
      if (typeof target.mute === 'function') {
        target.mute();
      }
    } catch (_) {
      /* ignore */
    }
  }

  function createPlayer(videoId, startSec) {
    return new Promise((resolve, reject) => {
      destroyPlayer();
      let settled = false;
      const readyTimeout = setTimeout(() => {
        fail(new Error('YouTube 플레이어 준비 시간 초과'));
      }, 10000);
      function finish() {
        if (settled) return;
        settled = true;
        clearTimeout(readyTimeout);
        resolve();
      }
      function fail(err) {
        if (settled) return;
        settled = true;
        clearTimeout(readyTimeout);
        reject(err);
      }
      player = new YT.Player('player', {
        videoId,
        playerVars: {
          autoplay: 1,
          mute: 1,
          start: Math.floor(startSec || 0),
          controls: 0,
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3,
          playsinline: 1,
          rel: 0,
          modestbranding: 1,
          cc_load_policy: 1,
          hl: (langSelect.value || 'fr').split('-')[0],
        },
        events: {
          onReady: (e) => {
            try {
              applyMutedAutoplay(e.target);
              if (startSec > 0) e.target.seekTo(startSec, true);
              e.target.playVideo();
              applyPlaybackSpeed();
              updateDpadButtons();
              startTick();
              finish();
            } catch (err) {
              fail(err);
            }
          },
          onStateChange: (ev) => {
            if (ev.data === YT.PlayerState.PLAYING) startTick();
            if (ev.data === YT.PlayerState.ENDED || ev.data === YT.PlayerState.PAUSED) {
              /* keep tick for loop */
            }
          },
        },
      });
    });
  }

  function encodeSrtPath(relPath) {
    return relPath
      .split('/')
      .map((seg) => encodeURIComponent(seg))
      .join('/');
  }

  function loadCatalog() {
    if (!catalogPromise) {
      catalogPromise = fetch('./catalog.json', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []);
    }
    return catalogPromise;
  }

  function catalogEntryPath(item) {
    if (!item || !item.path) return '';
    const dir = (item.dir || '').replace(/\/+$/, '');
    return dir ? `${dir}/${item.path}` : item.path;
  }

  async function findSrtPathInCatalog(videoId) {
    const catalog = await loadCatalog();
    for (const item of catalog) {
      if (parseVideoId(item.youtube || '') === videoId) {
        return catalogEntryPath(item);
      }
    }
    return '';
  }

  async function tryLoadSrtForVideo(videoId) {
    const params = new URLSearchParams(location.search);
    const candidates = [params.get('srt'), srtSourcePath, await findSrtPathInCatalog(videoId)].filter(
      Boolean
    );
    const seen = new Set();
    for (const relPath of candidates) {
      if (seen.has(relPath)) continue;
      seen.add(relPath);
      try {
        await loadSrtFromPath(relPath);
        return true;
      } catch (_) {
        /* try next */
      }
    }
    return false;
  }

  async function loadSrtFromPath(relPath) {
    const res = await fetch(`./${encodeSrtPath(relPath)}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('SRT 파일을 불러오지 못했습니다.');
    const text = await res.text();
    const parsed = parseSrt(text);
    cues = parsed.cues;
    cuesFromSrt = true;
    srtSourcePath = relPath;
    if (parsed.youtubeUrl) urlInput.value = parsed.youtubeUrl;
    if (!cues.length) throw new Error('자막 내용을 찾지 못했습니다.');
    applyLoadedCues('SRT');
    return parsed.youtubeUrl || '';
  }

  async function loadCaptions(videoId) {
    if (!(cuesFromSrt && cues.length)) {
      setStatus('SRT 확인 중…');
      if (await tryLoadSrtForVideo(videoId)) {
        applyRangeFilter();
        renderCueList();
        return;
      }
    }
    if (cuesFromSrt && cues.length) {
      applyRangeFilter();
      renderCueList();
      syncPageSubtitle();
      setStatus('');
      return;
    }
    setStatus('자막 불러오는 중…');
    const data = await fetchTranscriptApi(videoId, langSelect.value || 'fr');
    captionTracks = data.tracks || [];
    fillLangSelect(captionTracks, data.language_code);
    cues = (data.cues || []).map((c) => ({
      start: c.start,
      end: c.end,
      duration: c.duration,
      text: c.text,
    }));
    if (!cues.length) {
      resetQuizScore();
      renderCueList();
      setStatus('YouTube 자막이 없습니다. VTT/SRT 파일을 업로드해 주세요.', true);
      return;
    }
    applyRangeFilter();
    activeIndex = cues.length > 0 ? 0 : -1;
    loopIndex = activeIndex;
    clearLoopSeekGuard();
    resetQuizScore();
    renderCueList();
    updateQuizButtonsEnabled();
    updateDpadButtons();
    syncPageSubtitle();
    setStatus('');
  }

  function applyRangeFilter() {
    const start = parseTimeToken(rangeStart.value) || pendingStart || 0;
    const endRaw = rangeEnd.value.trim();
    const end = endRaw ? parseTimeToken(endRaw) : playEnd;
    cues = filterByRange(cues, start, end);
    if (end) playEnd = end;
  }

  async function handleLoad() {
    if (!urlInput) return;
    const input = urlInput.value.trim();
    if (!input) {
      setStatus('YouTube 주소를 입력해 주세요.', true);
      return;
    }
    const videoId = parseVideoId(input);
    if (!videoId) {
      setStatus('올바른 YouTube URL이 아닙니다.', true);
      return;
    }

    const srtInUrl = new URLSearchParams(location.search).get('srt');
    if (lastLoadedVideoId !== videoId) {
      if (!srtInUrl) {
        cuesFromSrt = false;
        srtSourcePath = '';
        cues = [];
      }
      lastLoadedVideoId = videoId;
    }

    const times = parseUrlTimes(input);
    pendingStart = times.start;
    playEnd = times.end;
    rangeStart.value = times.start ? formatTime(times.start) : '';
    rangeEnd.value = times.end != null ? formatTime(times.end) : '';

    if (btnLoad) btnLoad.disabled = true;
    setStatus('동영상 로드 중…');
    try {
      localStorage.setItem('yt_last_url', input);
      await loadCaptions(videoId);
      await loadYouTubeApi();
      await createPlayer(videoId, pendingStart);
    } catch (err) {
      console.error(err);
      setStatus(err.message || '로드 실패', true);
    } finally {
      if (btnLoad) btnLoad.disabled = false;
    }
  }

  async function bootFromQuery() {
    const params = new URLSearchParams(location.search);
    let srtPath = params.get('srt');
    let urlParam = params.get('url');

    if (!srtPath) {
      const catalog = await loadCatalog();
      const first = catalog[0];
      srtPath = catalogEntryPath(first);
      urlParam = first?.youtube || urlParam;
      if (!srtPath) {
        renderCueList();
        setStatus('불러올 SRT가 없습니다.', true);
        return;
      }
    }

    if (btnLoad) btnLoad.disabled = true;
    setStatus('SRT 불러오는 중…');
    try {
      const fromSrt = await loadSrtFromPath(srtPath);
      if (urlParam && urlInput) urlInput.value = urlParam;
      const playUrl = (urlInput?.value.trim()) || fromSrt;
      if (playUrl) await handleLoad();
      else setStatus('SRT에 YouTube URL이 없습니다. 주소를 입력하세요.', true);
    } catch (err) {
      console.error(err);
      setStatus(err.message || 'SRT 로드 실패', true);
    } finally {
      if (btnLoad) btnLoad.disabled = false;
    }
  }

  async function reloadCaptionsOnly() {
    if (cuesFromSrt && cues.length) return;
    const input = urlInput.value.trim();
    const videoId = parseVideoId(input);
    if (!videoId) return;
    try {
      if (btnLoad) btnLoad.disabled = true;
      await loadCaptions(videoId);
    } catch (err) {
      setStatus(err.message || '자막 로드 실패', true);
    } finally {
      if (btnLoad) btnLoad.disabled = false;
    }
  }

  function handleVttUpload(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result;
        const name = (file.name || '').toLowerCase();
        if (name.endsWith('.srt')) {
          const parsed = parseSrt(text);
          cues = parsed.cues;
          cuesFromSrt = true;
          srtSourcePath = file.name || '';
          if (parsed.youtubeUrl) urlInput.value = parsed.youtubeUrl;
        } else {
          cues = parseWebVtt(text);
          cuesFromSrt = true;
          srtSourcePath = file.name || '';
        }
        if (!cues.length) {
          setStatus('자막 내용을 찾지 못했습니다.', true);
          return;
        }
        applyLoadedCues('파일 자막');
      } catch (err) {
        console.error(err);
        setStatus('자막 파일 파싱 실패', true);
      }
    };
    reader.readAsText(file, 'UTF-8');
  }

  function stepCue(delta) {
    const base = loopIndex >= 0 ? loopIndex : activeIndex;
    const next = Math.min(cues.length - 1, Math.max(0, (base < 0 ? 0 : base) + delta));
    if (!cues[next]) return;
    if (loopIndex >= 0) {
      clearLoopSeekGuard();
      loopIndex = next;
      seekToCue(next, true, true);
      setStatus(`구간 반복: ${formatTime(cues[next].start)} ~ ${formatTime(cues[next].end)}`);
    } else {
      seekToCue(next, true);
    }
  }

  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea, select')) return;
    if (e.code === 'Space') {
      e.preventDefault();
      if (!player || !window.YT) return;
      const st = player.getPlayerState();
      if (st === YT.PlayerState.PLAYING) player.pauseVideo();
      else player.playVideo();
    }
    if (e.code === 'ArrowLeft') {
      e.preventDefault();
      stepCue(-1);
    }
    if (e.code === 'ArrowRight') {
      e.preventDefault();
      stepCue(1);
    }
    if (e.key === 'r' || e.key === 'R') {
      toggleLoopCurrent();
    }
  });

  function isMobileCaptionSettings() {
    return window.matchMedia('(max-width: 759px)').matches;
  }

  function setCaptionSettingsOpen(open) {
    if (!captionSettings || !btnCaptionSettings) return;
    const on = !!open && isMobileCaptionSettings();
    captionSettings.classList.toggle('is-open', on);
    btnCaptionSettings.setAttribute('aria-expanded', on ? 'true' : 'false');
  }

  if (btnCaptionSettings && captionSettings) {
    btnCaptionSettings.addEventListener('click', () => {
      setCaptionSettingsOpen(!captionSettings.classList.contains('is-open'));
    });
    window.addEventListener('resize', () => {
      if (!isMobileCaptionSettings()) setCaptionSettingsOpen(false);
    });
  }

  function syncPlayerMaskUi(visible) {
    if (!ytPlayerMask) return;
    ytPlayerMask.classList.toggle('is-hidden', !visible);
    ytPlayerMask.setAttribute('aria-pressed', visible ? 'true' : 'false');
    ytPlayerMask.setAttribute(
      'aria-label',
      visible ? 'YouTube 하단 가림 숨기기' : 'YouTube 하단 가림 표시'
    );
    ytPlayerMask.title = visible ? '터치하여 하단 가림 숨기기' : '터치하여 하단 가림 표시';
  }

  ytPlayerMask?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    syncPlayerMaskUi(ytPlayerMask.classList.contains('is-hidden'));
  });
  syncPlayerMaskUi(true);

  btnLoad?.addEventListener('click', handleLoad);
  btnLoopToggle?.addEventListener('click', toggleLoopCurrent);
  [btnAnsLeft, btnAnsNon, btnAnsRight].forEach((btn) => {
    if (!btn) return;
    btn.addEventListener('click', () => handleQuizAnswer(btn.dataset.answer));
  });
  [volUp, volDown, padPrev, padNextDpad].forEach(bindDpadPressFx);
  volUp?.addEventListener('click', () => {
    speedStep = clampSpeedStep(speedStep + 1);
    applyPlaybackSpeed();
  });
  volDown?.addEventListener('click', () => {
    speedStep = clampSpeedStep(speedStep - 1);
    applyPlaybackSpeed();
  });
  padPrev?.addEventListener('click', () => stepCue(-1));
  padNextDpad?.addEventListener('click', () => stepCue(1));
  urlInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleLoad();
  });
  langSelect?.addEventListener('change', reloadCaptionsOnly);
  vttFile?.addEventListener('change', () => handleVttUpload(vttFile.files[0]));

  const saved = localStorage.getItem('yt_last_url');
  if (saved && urlInput && !new URLSearchParams(location.search).get('srt')) {
    urlInput.value = saved;
  }
  updateLoopToggle();
  updateDpadButtons();
  syncSpeedHud();
  bootFromQuery();
})();
