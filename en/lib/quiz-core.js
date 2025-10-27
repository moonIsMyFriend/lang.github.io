// lib/quiz-core.js

// DOM 헬퍼
export const $ = (sel, root = document) => root.querySelector(sel);

// 토스트
export function toast(msg){
  const el=document.createElement('div');
  el.textContent=msg;
  el.style.position='fixed'; el.style.left='50%'; el.style.top='18px'; el.style.transform='translateX(-50%)';
  el.style.background='#0b1220'; el.style.border='1px solid #1f2937'; el.style.padding='8px 12px'; el.style.borderRadius='10px'; el.style.color='#cbd5e1'; el.style.boxShadow='0 10px 20px rgba(0,0,0,.35)';
  document.body.appendChild(el);
  setTimeout(()=>{ el.remove(); }, 1600);
}

// 유틸
export function shuffle(arr){
  for(let i=arr.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
}
export function escapeHTML(s){
  return s.replace(/[&<>\"']/g, c=> ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;','\'':'&#39;'}[c]) );
}

// CSV 파서
export function parseCSV(text){
  const lines = text.replace(/\uFEFF/, '').split(/\r?\n/).filter(l=>l.trim().length>0);
  if(lines.length===0) return [];
  const header = splitCSVLine(lines[0]);
  const rows = [];
  for(let i=1;i<lines.length;i++){
    const cols = splitCSVLine(lines[i]);
    const obj = {};
    for(let j=0;j<header.length;j++) obj[header[j]] = cols[j] ?? '';
    rows.push(obj);
  }
  return rows;
}

export function splitCSVLine(line){
  const out = [];
  let cur = '';
  let inQ = false;
  for(let i=0;i<line.length;i++){
    const ch = line[i];
    if(inQ){
      if(ch=='"'){
        if(line[i+1]=='"'){ cur+='"'; i++; } else { inQ=false; }
      } else cur+=ch;
    } else {
      if(ch=='"') inQ = true;
      else if(ch==','){ out.push(cur); cur=''; }
      else cur+=ch;
    }
  }
  out.push(cur);
  return out.map(s=>s.trim());
}

// 마스킹
export function maskEnglish(sentence, opt){
  const {ratio, keepFirst, minLen} = opt;
  // 단어/공백/구두점 분리
  const tokens = sentence.match(/\w+|\s+|[^\w\s]/g) || [sentence];
  const wordsIdx = tokens
    .map((t,i)=>(/^[A-Za-z][A-Za-z\d']*$/i.test(t) && t.length>=minLen ? i : -1))
    .filter(i=>i>=0);

  const hideCount = Math.max(1, Math.floor(wordsIdx.length * ratio));
  shuffle(wordsIdx);
  const hideSet = new Set(wordsIdx.slice(0, hideCount));

  let blanks = 0;
  const out = tokens.map((t,i)=>{
    if(!hideSet.has(i)) return escapeHTML(t);
    blanks++;
    const first = keepFirst ? t[0] : '';
    const expectLen = keepFirst ? Math.max(1, t.length-1) : t.length;
    return `<span class="blank"><span class="first">${escapeHTML(first)}</span><input type="text" data-ans="${escapeHTML(t)}" data-keepfirst="${keepFirst?1:0}" size="${Math.min(24, Math.max(2, expectLen))}" autocomplete="off" spellcheck="false"/></span>`;
  });

  return { html: out.join(''), totalBlanks: blanks };
}
