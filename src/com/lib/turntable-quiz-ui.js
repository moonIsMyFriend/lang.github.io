/**
 * TP-7 프레임 ↔ quiz-app 연동 (turntable_music_player.html 전용)
 */
export function initTurntableQuizUi() {
  const audio = document.querySelector('#audioPlayer');
  const btnAudio = document.querySelector('#btnAudio');
  const disc = document.querySelector('#disc');
  const padPlay = document.querySelector('#padPlay');
  const padNext = document.querySelector('#padNext');
  const miniPlay = document.querySelector('#miniPlay');
  const recordBtn = document.querySelector('#recordBtn');
  const btnNext = document.querySelector('#btnNext');
  const btnPronounceRecord = document.querySelector('#btnPronounceRecord');
  const volUp = document.querySelector('#volUp');
  const volDown = document.querySelector('#volDown');
  const eqBars = document.querySelectorAll('#equalizer .eq-bar');

  function setPlaying(on) {
    if (disc) disc.classList.toggle('playing', on);
    if (padPlay) {
      padPlay.classList.toggle('pressed', on);
      padPlay.textContent = on ? 'Ⅱ' : '▶';
    }
    if (miniPlay) miniPlay.textContent = on ? 'Ⅱ' : '▶';
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

  padPlay?.addEventListener('click', toggleListen);
  miniPlay?.addEventListener('click', toggleListen);
  miniPlay?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleListen();
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

  /** 볼륨 버튼: 포인터·키보드로 눌린 동안 `.pressed` 유지 → CSS 3D 눌림 */
  function bindVolumePressFx(btn) {
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

  bindVolumePressFx(volUp);
  bindVolumePressFx(volDown);

  volUp?.addEventListener('click', () => {
    if (!audio) return;
    audio.volume = Math.min(1, audio.volume + 0.1);
  });
  volDown?.addEventListener('click', () => {
    if (!audio) return;
    audio.volume = Math.max(0, audio.volume - 0.1);
  });

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
