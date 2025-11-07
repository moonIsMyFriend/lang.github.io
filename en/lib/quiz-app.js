// lib/quiz-app.js
import { $, toast, parseCSV, maskEnglish } from './quiz-core.js';

export function initQuizApp(){
  const state = {
  rows: [],
  cols: { id:"일련번호", en:"영문", ko:"번역", pron:"발음" },
  current: null,
  session: null  // 🔹{ order: number[], idx: 0, total: 20, scored: boolean[], correctCount: 0 }
};

  // 화면 전환
  const screen1 = $('#screen1');
  const screen2 = $('#screen2');
  const screen3 = $('#screen3');
  const sub = document.querySelector('.sub');

  function showScreen(which){
    // 모두 숨기고 필요한 화면만 표시
    screen1.classList.add('hidden');
    screen2.classList.add('hidden');
    screen3.classList.add('hidden');

    if(which === 1){
      screen1.classList.remove('hidden');
      sub.style.display = '';
    } else if(which === 2){
      screen2.classList.remove('hidden');
      sub.style.display = 'none';
    } else if(which === 3){
      screen3.classList.remove('hidden');
      sub.style.display = 'none';
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
  const scoreCorrect = $('#scoreCorrect');
  const scoreTotal = $('#scoreTotal');
  const progressNow  = $('#progressNow');
  const progressTotal = $('#progressTotal');
  const finalLine = $('#finalLine');
  const btnRestart = $('#btnRestart');
  const btnHome2 = $('#btnHome2');
  const btnSample = document.querySelector('#btnSample');
  const modeRandom = document.querySelector('#modeRandom');
  const modeSeq = document.querySelector('#modeSeq');

  if(btnRestart){
    btnRestart.addEventListener('click', ()=>{
      if(!state.rows.length){ showScreen(1); return; }
      const mode = (modeSeq && modeSeq.checked) ? 'seq' : 'random';
      startSession(20, mode);
      showScreen(2);
      renderCurrent();
    });
  }

  if(btnHome2){
    btnHome2.addEventListener('click', ()=>{ showScreen(1); });
  }

  if (btnSample) {
    btnSample.addEventListener('click', async ()=>{
      try{
        const res = await fetch('./test.csv', {cache:'no-store'});
        if(!res.ok) throw new Error('파일 없음');
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
      }catch(err){
        toast('⚠️ test.csv 파일을 찾을 수 없습니다');
      }
    });
  }

  level.addEventListener('input', () => levelLabel.textContent = level.value + '%');

  // 파일 선택
  csvInput.addEventListener('change', async (e)=>{
    const file = e.target.files?.[0];
    if(!file) return;
    const text = await file.text();
    handleCSV(text);
  });

  // 자동 로드
  // window.addEventListener('DOMContentLoaded', tryAutoload);
  async function tryAutoload(){
    try{
      const res = await fetch('./test.csv', { cache: 'no-store' });
      if(!res.ok) return false;
      const txt = await res.text();
      if(!/,/.test(txt)) return false;

      handleCSV(txt);                   // ← 이 안에서 state.rows 채워짐
      toast('데이터 로드됨');
      return true;                      // ✅ 성공 여부 반환
    }catch(err){
      return false;                     // 실패
    }
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
  btnPick.addEventListener('click', async ()=>{
    // 중복 클릭 방지(선택)
    btnPick.disabled = true;

    // 아직 로드 안 됐으면 test.csv 자동 시도
    if(!state.rows.length){
      const ok = await tryAutoload();   // ✅ 로드 끝날 때까지 대기
      if(!ok){
        toast('CSV를 먼저 불러오세요 (파일 선택 또는 데모 로드)');
        // btnPick.disabled = false;
        return;
      }
      
    }
    
    btnPick.disabled = false
    const mode = (modeSeq && modeSeq.checked) ? 'seq' : 'random';
    startSession(20, mode);     // 🔸 모드 전달
    showScreen(2);
    renderCurrent();
    // (화면 전환되니 굳이 다시 활성화할 필요 없음)
  });

  // 화면2 버튼
  //btnNext.addEventListener('click', pickQuestion);
  btnNext.addEventListener('click', ()=>{
    const s = state.session;
    if(!s) return;
    
    gradeCurrent(); 

    if(s.idx < s.total - 1){
      s.idx += 1;
      renderCurrent();
    }else{
      showResults();     // 🔹마지막 문제 다음 → 결과 화면
    }

  });

  function showResults(){
    const s = state.session;
    const total = s?.total || 0;
    const correct = s?.correctCount || 0;
    finalLine.textContent = `총 ${total}문제 중 ${correct}문제를 맞혔습니다.`;
    showScreen(3);
  }

  // btnReveal.addEventListener('click', showAnswer);
  btnGrade.addEventListener('click', () => {
    showAnswer(); 
    gradeCurrent(); 
    document.activeElement.blur();});
  btnHome.addEventListener('click', ()=>{ showScreen(1); state.rows = [];});


  function startSession(n, mode='random'){
    console.log('startSession')
    const N = state.rows.length;
    let total = Math.min(n, N);
    let order;
    if(mode === 'seq'){
      // 순차: 앞에서부터 total개
      total = state.rows.length;     // ✅ 전체 문장 수
      order = Array.from({length:N}, (_,i)=> i).slice(0, total);
    }else{
      // 랜덤: 중복 없이 무작위 total개
      order = sampleWithoutReplacement(N, total);
    }

    state.session = { order, idx: 0, total, scored: Array(total).fill(false), correctCount: 0, mode };
    scoreTotal.textContent = String(total);
    scoreCorrect.textContent = '0';
    progressTotal.textContent = String(total);
    progressNow.textContent = '1';
  }

  function sampleWithoutReplacement(N, k){
    // 피셔-예이츠에서 k개만 뽑기
    const arr = Array.from({length:N}, (_,i)=>i);
    for(let i=0;i<k;i++){
      const j = i + Math.floor(Math.random()*(N - i));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(0, k);
  }

  function renderCurrent(){
    const s = state.session;
    if(!s) return;
    const rowIdx = s.order[s.idx];
    const row = state.rows[rowIdx];
    state.current = row;

    const idv = row[state.cols.id] ?? (rowIdx+1);
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

    // 스코어(문장 내 빈칸 개수)
    // scoreCorrect.textContent = '0';
    // scoreTotal.textContent = String(maskedInfo.totalBlanks);
    const correct = s?.correctCount || 0;
    scoreCorrect.textContent = String(correct);
    

    // 🔹다음 버튼은 '채점 전'엔 비활성화 (채점해야 넘어갈 수 있게)
    //btnReveal.disabled = false;
    btnGrade.disabled = maskedInfo.totalBlanks === 0 ? false : false;
    btnNext.disabled  = false;

    // 진행도
    progressNow.textContent = String(s.idx + 1);

    const firstBlank = document.querySelector('input[data-ans]');
    if(firstBlank) firstBlank.focus();
  }


  // CSV 처리
  function handleCSV(text){
    try{
      const rows = parseCSV(text);
      if(!rows.length) throw new Error('빈 CSV');

      const header = Object.keys(rows[0]);
      const norm = h => h.replace(/\s+/g,'').toLowerCase();
      const byNorm = Object.fromEntries(header.map(h=>[norm(h), h]));
      const idKey =  byNorm['no'] || byNorm['일련번호'] || byNorm['id'] || header[0];
      const enKey = byNorm['original'] || byNorm['원문'] || header[1];
      const koKey = byNorm['trans'] || byNorm['번역'] || byNorm['translation'] || header[2];
      const groupKey   = byNorm['group']     || byNorm['그룹']     || header[3];
      const speakerKey = byNorm['speaker']   || byNorm['화자']     || header[4];
      const pronKey    = byNorm['pron']      || byNorm['발음']     || header[5];


      state.cols = { id: idKey, en: enKey, ko: koKey, group:groupKey, speaker: speakerKey, pron: pronKey };
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

      //toast(`불러오기 완료: ${state.rows.length}건`);
    }catch(err){
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
  function showAnswer(){
    if(!state.current) return;

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
    // scoreCorrect.textContent = '0';
    //scoreTotal.textContent = String(maskedInfo.totalBlanks);

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
      //const fullUser = keep ? ((ans[0]||'') + user) : user;

      let fullUser = user;

      if(keep){
        const first = ans[0] || '';
        if(first){
          // 사용자가 첫 글자를 이미 썼다면 그대로 비교,
          // 안 썼다면 자동으로 첫 글자를 보태서 비교
          if(user.length === 0){
            fullUser = first;                 // 빈 입력도 최소 첫 글자와 비교
          } else if (user[0].localeCompare(first, undefined, {sensitivity:'accent'}) !== 0){
            fullUser = first + user;       // 앞글자 안 썼으면 보태기
          } // 앞글자 썼으면 그대로
        }
      }


      
      if(fullUser.localeCompare(ans, undefined, {sensitivity:'accent'})===0){
        inp.classList.remove('bad'); inp.classList.add('good'); correct++;
      }else{
        inp.classList.remove('good'); inp.classList.add('bad');
      }
    }
    // scoreCorrect.textContent = String(correct);
    //scoreTotal.textContent = String(inputs.length);

    // 🔹정답 집계: 모든 빈칸을 맞춘 경우에만 그 문제를 '정답' 처리
    const s = state.session;
    if(s){
      const isAllCorrect = (correct === inputs.length);
      // 같은 문제에서 여러 번 눌러도 '처음 정답 처리'만 1점 반영
      if(isAllCorrect && !s.scored[s.idx]){
        s.correctCount += 1;
        s.scored[s.idx] = true;
      }
    }

    // 채점 후 다음 문제 이동 가능
    btnNext.disabled = false;

  }
}
