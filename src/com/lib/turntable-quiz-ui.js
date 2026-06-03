/**
 * TP-7 프레임 ↔ quiz-app 연동 (turntable_music_player.html 전용)
 */
import { installNaverDictPopup } from './naver-dict-popup.js';

export function initTurntableQuizUi() {
  const audio = document.querySelector('#audioPlayer');
  const btnAudio = document.querySelector('#btnAudio');
  const disc = document.querySelector('#disc');
  const padPlay = document.querySelector('#padPlay');
  const padNext = document.querySelector('#padNext');
  const miniPlay = document.querySelector('#miniPlay');
  const audioLoopEl = document.querySelector('#audioLoop');
  const recordBtn = document.querySelector('#recordBtn');
  const btnNext = document.querySelector('#btnNext');
  const btnPronounceRecord = document.querySelector('#btnPronounceRecord');
  const speedUp = document.querySelector('#volUp');
  const speedDown = document.querySelector('#volDown');
  const tpSpeed = document.querySelector('#tpSpeed');
  const eqBars = document.querySelectorAll('#equalizer .eq-bar');

  const LS_PLAYBACK_RATE = 'learnlang_playback_rate';
  const SPEED_STEP = 0.25;
  const SPEED_MIN = 0.25;
  const SPEED_MAX = 4;
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

  function formatSpeed(rate) {
    const n = stepToRate(rateToStep(rate));
    const text = Number.isInteger(n) ? String(n) : String(n);
    return `x${text}`;
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

  function applyPlaybackSpeed() {
    const rate = stepToRate(speedStep);
    if (audio) audio.playbackRate = rate;
    if (tpSpeed) tpSpeed.textContent = formatSpeed(rate);
    persistSpeed();
  }

  function isAudioLoopOn() {
    if (audioLoopEl) return audioLoopEl.checked;
    if (audio) return !!audio.loop;
    return false;
  }

  const MINI_PLAY_ICON =
    '<svg class="tp-mini-play-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
  const MINI_REPEAT_ICON =
    '<svg class="tp-mini-play-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>';

  /** 디스플레이 하단: 1회 재생 ▶ / 반복 리사이클 아이콘 */
  function syncMiniPlayModeLabel() {
    if (!miniPlay) return;
    const loop = isAudioLoopOn();
    miniPlay.innerHTML = loop ? MINI_REPEAT_ICON : MINI_PLAY_ICON;
    miniPlay.classList.toggle('tp-play-mode-repeat', loop);
    miniPlay.classList.toggle('tp-play-mode-once', !loop);
    miniPlay.title = loop ? '반복 재생 (클릭: 1회 재생)' : '1회 재생 (클릭: 반복 재생)';
    miniPlay.setAttribute('aria-label', loop ? '반복 재생, 클릭하면 1회 재생' : '1회 재생, 클릭하면 반복 재생');
    miniPlay.setAttribute('aria-pressed', loop ? 'true' : 'false');
  }

  function toggleAudioLoop() {
    if (!audioLoopEl) return;
    audioLoopEl.checked = !audioLoopEl.checked;
    audioLoopEl.dispatchEvent(new Event('change', { bubbles: true }));
    syncMiniPlayModeLabel();
  }

  function setPlaying(on) {
    if (disc) disc.classList.toggle('playing', on);
    if (padPlay) {
      padPlay.classList.toggle('pressed', on);
      padPlay.textContent = on ? 'Ⅱ' : '▶';
    }
  }

  function armEq() {
    initEqualizer();
    if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume().catch(() => {});
    }
  }

  function toggleListen() {
    armEq();
    btnAudio?.click();
    /* 재생 시작 시 quiz-app에서 녹음 중지 → 녹음 패드 눌림 해제가 한 프레임 늦을 수 있음 */
    requestAnimationFrame(() => syncRecordPadPressed());
  }

  audioLoopEl?.addEventListener('change', syncMiniPlayModeLabel);
  document.addEventListener('learnlang-settings-applied', syncMiniPlayModeLabel);

  padPlay?.addEventListener('click', toggleListen);
  miniPlay?.addEventListener('click', toggleAudioLoop);
  miniPlay?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleAudioLoop();
    }
  });

  padNext?.addEventListener('click', () => {
    btnNext?.click();
    requestAnimationFrame(() => syncRecordPadPressed());
  });

  /** 마이크 권한 대기 중에도 패드 눌림 유지 (스트림 오기 전 · 브라우저 프롬프트 구간) */
  let awaitingMic = false;
  let awaitingMicTimer = null;
  /** 직전 프레임에 `data-pronounce-posting` 이었는지 — 서버 인식 끝난 뒤 stale awaitingMic 로 패드가 다시 눌리는 것 방지 */
  let prevPronouncePostingAttr = false;

  function clearAwaitingMic() {
    awaitingMic = false;
    if (awaitingMicTimer) {
      clearTimeout(awaitingMicTimer);
      awaitingMicTimer = null;
    }
  }

  recordBtn?.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    /* 종료 클릭(이미 녹음 중)에는 대기 플래그를 켜지 않음 — 손을 뗀 뒤에도 눌림이 남는 현상 방지 */
    const alreadyRecording = !!btnPronounceRecord?.querySelector('svg rect');
    if (!alreadyRecording) {
      awaitingMic = true;
      clearTimeout(awaitingMicTimer);
      awaitingMicTimer = setTimeout(() => {
        clearAwaitingMic();
        syncRecordPadPressed();
      }, 15000);
    }
    syncRecordPadPressed();
  });

  recordBtn?.addEventListener('click', () => btnPronounceRecord?.click());

  document.addEventListener('learnlang-pronounce-mic-failed', () => {
    clearAwaitingMic();
    syncRecordPadPressed();
  });

  document.addEventListener('learnlang-pronounce-post-finished', () => {
    clearAwaitingMic();
    requestAnimationFrame(() => syncRecordPadPressed());
  });

  /**
   * 숨김 버튼 정지 아이콘(svg rect) 또는 권한 대기(awaitingMic) ↔ 빨간 패드 눌림.
   */
  function syncRecordPadPressed() {
    if (!recordBtn || !btnPronounceRecord) return;
    const posting = btnPronounceRecord.getAttribute('data-pronounce-posting') === '1';
    if (prevPronouncePostingAttr && !posting) {
      clearAwaitingMic();
    }
    prevPronouncePostingAttr = posting;
    const hasStopIcon = !!btnPronounceRecord.querySelector('svg rect');
    if (hasStopIcon) clearAwaitingMic();
    const pressed = !posting && (hasStopIcon || awaitingMic);
    recordBtn.classList.toggle('pressed', pressed);
    recordBtn.setAttribute('aria-pressed', pressed ? 'true' : 'false');
    let aria =
      '발음 녹음 시작';
    if (hasStopIcon) aria = '녹음 종료 · 결과 전송';
    else if (awaitingMic) aria = '마이크 연결 중…';
    recordBtn.setAttribute('aria-label', aria);
  }

  if (btnPronounceRecord) {
    new MutationObserver(syncRecordPadPressed).observe(btnPronounceRecord, {
      attributes: true,
      attributeFilter: ['aria-label', 'title', 'data-pronounce-posting', 'disabled'],
      childList: true,
      subtree: true
    });
  }
  syncRecordPadPressed();

  function syncPlayAndRecordPads() {
    setPlaying(!!audio && !audio.paused);
    syncRecordPadPressed();
  }

  audio?.addEventListener('play', syncPlayAndRecordPads);
  audio?.addEventListener('playing', syncPlayAndRecordPads);
  audio?.addEventListener('pause', syncPlayAndRecordPads);
  audio?.addEventListener('ended', syncPlayAndRecordPads);

  if (btnAudio) {
    new MutationObserver(syncPlayAndRecordPads).observe(btnAudio, {
      subtree: true,
      characterData: true,
      childList: true
    });
  }
  syncPlayAndRecordPads();
  syncMiniPlayModeLabel();

  /** 속도 ± 버튼: 포인터·키보드로 눌린 동안 `.pressed` 유지 → CSS 3D 눌림 */
  function bindRoundBtnPressFx(btn) {
    if (!btn) return;
    const press = () => btn.classList.add('pressed');
    const release = () => btn.classList.remove('pressed');

    btn.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      try {
        btn.setPointerCapture(e.pointerId);
      } catch (_) {}
      press();
    });
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('lostpointercapture', release);
    btn.addEventListener('blur', release);

    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        press();
      }
    });
    btn.addEventListener('keyup', (e) => {
      if (e.key === 'Enter' || e.key === ' ') release();
    });
  }

  bindRoundBtnPressFx(speedUp);
  bindRoundBtnPressFx(speedDown);

  speedUp?.addEventListener('click', () => {
    speedStep = clampSpeedStep(speedStep + 1);
    applyPlaybackSpeed();
  });
  speedDown?.addEventListener('click', () => {
    speedStep = clampSpeedStep(speedStep - 1);
    applyPlaybackSpeed();
  });

  applyPlaybackSpeed();
  audio?.addEventListener('loadedmetadata', applyPlaybackSpeed);
  audio?.addEventListener('play', applyPlaybackSpeed);

  let audioContext;
  let analyser;
  let sourceNode;
  let frequencyData;
  let equalizerStarted = false;

  function initEqualizer() {
    if (equalizerStarted || !audio || !eqBars.length) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    try {
      audioContext = new AudioContextClass();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 128;
      frequencyData = new Uint8Array(analyser.frequencyBinCount);
      sourceNode = audioContext.createMediaElementSource(audio);
      sourceNode.connect(analyser);
      analyser.connect(audioContext.destination);
      equalizerStarted = true;
    } catch (_) {
      equalizerStarted = false;
    }
  }

  function animateEq() {
    requestAnimationFrame(animateEq);
    if (!eqBars.length) return;
    if (!analyser || !audio || audio.paused) {
      eqBars.forEach((bar, i) => {
        bar.style.setProperty('--level', `${10 + (i % 3) * 4}%`);
      });
      return;
    }
    analyser.getByteFrequencyData(frequencyData);
    const step = Math.floor(frequencyData.length / eqBars.length);
    eqBars.forEach((bar, index) => {
      let sum = 0;
      const start = index * step;
      for (let i = 0; i < step; i++) sum += frequencyData[start + i] || 0;
      const avg = sum / step;
      bar.style.setProperty('--level', `${8 + (avg / 255) * 92}%`);
    });
  }

  audio?.addEventListener(
    'play',
    () => {
      initEqualizer();
      if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume().catch(() => {});
      }
    },
    { passive: true }
  );

  requestAnimationFrame(animateEq);

  if (audio && audio.volume >= 0.99) audio.volume = 0.7;

  const ko = document.querySelector('#ko');
  const enMask = document.querySelector('#enMask');
  const enFull = document.querySelector('#enFull');
  const answerWrap = document.querySelector('#answerWrap');
  const tpExpr = document.querySelector('#tpExpr');
  const tpPron = document.querySelector('#tpPron');
  const tpMean = document.querySelector('#tpMean');
  const tpComment = document.querySelector('#tpComment');

  function syncLines() {
    const ktxt = (ko?.textContent || '').trim();
    let mean = ktxt;
    let com = '';
    const ci = ktxt.indexOf('\n:');
    if (ci >= 0) {
      mean = ktxt.slice(0, ci).trim();
      com = ktxt.slice(ci + 2).trim();
    }

    let expr = '—';
    let pron = '—';

    const showAnswer =
      answerWrap &&
      answerWrap.style.display !== 'none' &&
      enFull &&
      (enFull.textContent || '').trim();

    if (showAnswer) {
      const w = document.createElement('div');
      w.innerHTML = enFull.innerHTML;
      const italicDiv = Array.from(w.querySelectorAll('div')).find((d) => {
        const st = d.getAttribute('style') || '';
        return st.includes('italic') || /font-style:\s*italic/i.test(st);
      });
      if (italicDiv) {
        pron = (italicDiv.textContent || '')
          .replace(/^\s*\[|\]\s*$/g, '')
          .trim();
        italicDiv.remove();
      }
      expr = (w.textContent || '').replace(/\s+/g, ' ').trim() || '—';
      if (pron === '—' || !pron) {
        const m = expr.match(/\[([^\]]+)\]/);
        if (m) {
          pron = m[1].trim();
          expr = expr.replace(m[0], '').replace(/\s+/g, ' ').trim() || '—';
        }
      }
    } else if (enMask && (enMask.textContent || '').trim()) {
      expr = (enMask.innerText || enMask.textContent || '').trim() || '—';
    }

    const set = (el, v, empty = '—') => {
      if (el) el.textContent = v && String(v).trim() ? v : empty;
    };
    set(tpExpr, expr);
    set(tpPron, pron);
    set(tpMean, mean);
    set(tpComment, com, '');
  }

  const mo = new MutationObserver(syncLines);
  if (ko) mo.observe(ko, { characterData: true, subtree: true, childList: true });
  if (enMask) mo.observe(enMask, { characterData: true, subtree: true, childList: true });
  if (enFull) mo.observe(enFull, { characterData: true, subtree: true, childList: true });
  if (answerWrap) mo.observe(answerWrap, { attributes: true, attributeFilter: ['style'] });
  document.addEventListener('learnlang-reset-tp-expr', syncLines);
  syncLines();

  if (tpExpr) {
    installNaverDictPopup(tpExpr, { dict: 'fren' });
  }

  const settingsBtn = document.querySelector('#btnSettings');
  const settingsModal = document.querySelector('#tpSettingsModal');
  const closeBtn = document.querySelector('#btnCloseSettings');
  const applyBtn = document.querySelector('#btnApplySettings');

  function openSettings() {
    if (!settingsModal) return;
    settingsModal.classList.remove('hidden');
    settingsModal.hidden = false;
    document.body.classList.add('tp-settings-open');
    closeBtn?.focus();
  }

  function closeSettings() {
    if (!settingsModal) return;
    settingsModal.classList.add('hidden');
    settingsModal.hidden = true;
    document.body.classList.remove('tp-settings-open');
    settingsBtn?.focus();
  }

  settingsBtn?.addEventListener('click', openSettings);
  closeBtn?.addEventListener('click', closeSettings);
  applyBtn?.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('learnlang-settings-applied'));
    closeSettings();
  });
  settingsModal?.querySelector('[data-close-settings]')?.addEventListener('click', closeSettings);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && settingsModal && !settingsModal.hidden) closeSettings();
  });
}
