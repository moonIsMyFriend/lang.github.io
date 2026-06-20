/**
 * Playdate 프레임 ↔ turntable-quiz-ui + D-pad 네비게이션
 */
import { initTurntableQuizUi } from './turntable-quiz-ui.js';

function playCurrentAudio() {
  const btnAudio = document.querySelector('#btnAudio');
  const screen2 = document.querySelector('#screen2');
  if (!btnAudio || !screen2 || screen2.classList.contains('hidden')) return;
  requestAnimationFrame(() => btnAudio.click());
}

function bindDpadPressFx(btn) {
  if (!btn) return;
  const press = () => btn.classList.add('pressed');
  const release = () => btn.classList.remove('pressed');
  btn.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    try { btn.setPointerCapture(e.pointerId); } catch (_) {}
    press();
  });
  btn.addEventListener('pointerup', release);
  btn.addEventListener('pointercancel', release);
  btn.addEventListener('lostpointercapture', release);
}

export function initPlaydateQuizUi() {
  initTurntableQuizUi();

  const padPrev = document.querySelector('#padPrev');
  const padNextDpad = document.querySelector('#padNextDpad');
  const btnNext = document.querySelector('#btnNext');
  const volUp = document.querySelector('#volUp');
  const volDown = document.querySelector('#volDown');

  [padPrev, padNextDpad, volUp, volDown].forEach(bindDpadPressFx);

  padPrev?.addEventListener('click', () => {
    if (window.quizApp?.goPrevious?.()) {
      playCurrentAudio();
    }
  });

  padNextDpad?.addEventListener('click', () => {
    if (!btnNext || btnNext.disabled) return;
    btnNext.click();
    playCurrentAudio();
  });
}
