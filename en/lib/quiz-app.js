// lib/quiz-app.js
import { $, toast, parseCSV, maskEnglish } from './quiz-core.js';

export function initQuizApp(){
  const state = { rows: [], cols: {id:"일련번호", en:"영문", ko:"번역"}, current: null };

  // 화면 전환
  const screen1 = $('#screen1');
  const screen2 = $('#screen2');
  function showScreen(which){
    if(which===1){ screen1.classList.remove('hidden'); screen2.classList.add('hidden'); }
    else { screen2.classList.remove('hidden'); screen1.classList.add('hidden'); }
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
  const scoreCorrect = $('#scoreCorrect');
  const scoreTotal = $('#scoreTotal');

  level.addEventListener('input', () => levelLabel.textContent = level.value + '%');

  // 파일 선택
  csvInput.addEventListener('change', async (e)=>{
    const file = e.target.files?.[0];
    if(!file) return;
    const text = await file.text();
    handleCSV(text);
  });

  // 자동 로드
  window.addEventListener('DOMContentLoaded', tryAutoload);
  async function tryAutoload(){
    try{
      const res = await fetch('./test.csv', {cache:'no-store'});
      if(res.ok){
        const txt = await res.text();
        if(/,/.test(txt)){
          handleCSV(txt);
          toast('./test.csv 자동 로드됨');
        }
      }
    }catch(err){ /* 없음 */ }
  }

  // 엔터키: 마지막 입력칸이면 정답/채점 + 포커스 해제
  enMask.addEventListener('keydown', (e)=>{
    if(e.key !== 'Enter') return;
    const t = e.target;
    if(!(t instanceof HTMLInputElement)) return;
    if(!t.matches('input[data-ans]')) return;

    e.preventDefault();
    const inputs = Array.from(document.querySelectorAll('input[data-ans]'));
    const idx = inputs.indexOf(t);
    if(idx === inputs.length - 1){
      showAnswer();
      gradeCurrent();
      document.activeElement.blur();
    }else if(idx > -1){
      inputs[idx + 1].focus();
    }
  });

  // 데모
  btnDemo.addEventListener('click', ()=>{
    const demo = `일련번호,영문,번역
1,"Learning a new language takes time and practice.","새 언어를 배우려면 시간과 연습이 필요해요."
2,"Consistency beats intensity when building habits.","습관을 만들 때는 강도보다 꾸준함이 더 중요해요."
3,"Failure is not the opposite of success; it is part of success.","실패는 성공의 반대가 아니라 성공의 일부예요."
4,"Small daily improvements lead to stunning long-term results.","작은 일상의 개선이 놀라운 장기적 성과로 이어집니다."`;
    handleCSV(demo);
  });

  // 화면1: 문제 내기 → 화면2
  btnPick.addEventListener('click', ()=>{
    if(!state.rows.length){ 
      tryAutoload();
      // if(!state.rows.length){ 
      //   console.log('csv')
      //   toast('먼저 CSV를 로드하세요'); 
      //   return;
      // }
    } else{
      pickQuestion();
      showScreen(2);
    }
  });

  // 화면2 버튼
  btnNext.addEventListener('click', pickQuestion);
  // btnReveal.addEventListener('click', showAnswer);
  btnGrade.addEventListener('click', () => {
    toast('btnGrade');
    showAnswer(); 
    gradeCurrent(); 
    document.activeElement.blur();});
  btnHome.addEventListener('click', ()=>{ showScreen(1); state.rows = [];});

  // CSV 처리
  function handleCSV(text){
    try{
      const rows = parseCSV(text);
      if(!rows.length) throw new Error('빈 CSV');

      const header = Object.keys(rows[0]);
      const norm = h => h.replace(/\s+/g,'').toLowerCase();
      const byNorm = Object.fromEntries(header.map(h=>[norm(h), h]));
      const idKey = byNorm['일련번호'] || byNorm['id'] || header[0];
      const enKey = byNorm['영문'] || byNorm['english'] || header[1];
      const koKey = byNorm['번역'] || byNorm['translation'] || header[2];

      state.cols = { id: idKey, en: enKey, ko: koKey };
      state.rows = rows.filter(r=> (r[enKey]??'').toString().trim() );

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
      scoreCorrect.textContent = '0';
      scoreTotal.textContent = '0';

      toast(`불러오기 완료: ${state.rows.length}건`);
    }catch(err){
      alert('CSV 파싱 오류: ' + err.message);
    }
  }

  // 정답 표시
  function showAnswer(){
    if(!state.current) return;
    enFull.textContent = state.current[state.cols.en] || '';
    answerWrap.style.display = 'block';
  }

  // 문제 뽑기
  function pickQuestion(){
    if(!state.rows.length) return;
    const idx = Math.floor(Math.random() * state.rows.length);
    const row = state.rows[idx];
    state.current = row;

    const idv = row[state.cols.id] ?? (idx+1);
    const en = (row[state.cols.en]||'').toString();
    const koText = (row[state.cols.ko]||'').toString();

    const maskedInfo = maskEnglish(en, { 
      ratio: Number(level.value)/100, 
      keepFirst: keepFirst.checked, 
      minLen: Math.max(1, Number(minLen.value)||1)
    });

    ko.textContent = koText;
    enMask.innerHTML = maskedInfo.html;
    enFull.textContent = '';
    answerWrap.style.display = 'none';
    selId.textContent = idv;

    // 스코어 초기화
    scoreCorrect.textContent = '0';
    scoreTotal.textContent = String(maskedInfo.totalBlanks);

    // btnReveal.disabled = false;
    btnGrade.disabled = false; //maskedInfo.totalBlanks === 0;
    btnNext.disabled = false;

    // 첫 번째 빈칸 포커스
    const firstBlank = document.querySelector('input[data-ans]');
    if(firstBlank) firstBlank.focus();
  }

  // 채점
  function gradeCurrent(){
    const inputs = Array.from(document.querySelectorAll('input[data-ans]'));
    if(inputs.length===0){ toast('채점할 빈칸이 없습니다'); return; }
    let correct = 0;
    for(const inp of inputs){
      const ans = inp.getAttribute('data-ans') || '';
      const keep = inp.getAttribute('data-keepfirst')==='1';
      const user = (inp.value||'').trim();
      const fullUser = keep ? ((ans[0]||'') + user) : user;
      if(fullUser.localeCompare(ans, undefined, {sensitivity:'accent'})===0){
        inp.classList.remove('bad'); inp.classList.add('good'); correct++;
      }else{
        inp.classList.remove('good'); inp.classList.add('bad');
      }
    }
    scoreCorrect.textContent = String(correct);
    scoreTotal.textContent = String(inputs.length);
  }
}
