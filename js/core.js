// デモ（demo/index.html）から持ってきた、データの持ち方と状態の計算
const DAY = 864e5;
/* 工程マスター: グループ・発注の要否。順番は「よくある順番」で、標準ルートはこのうち route:true のもの */
const STAGES = [
  {id:'LO',      name:'LO', full:'LO',         kind:'work',  g:'LO',  po:true,  route:true},
  {id:'LOEN',    name:'LO演出', full:'演出チェック',     kind:'check', g:'LO',            route:true},
  {id:'LOSK',    name:'LO作監', full:'LO作監',     kind:'check', g:'LO',            route:true},
  {id:'GEN',     name:'原画', full:'原画',       kind:'work',  g:'原画', po:true, route:true},
  {id:'GENEN',   name:'原画演出', full:'演出チェック',   kind:'check', g:'原画',          route:true},
  {id:'GENSK',   name:'原画作監', full:'原画作監',   kind:'check', g:'原画',          route:true},
  {id:'GENSOSK', name:'総作監', full:'総作監', kind:'check', g:'原画',          route:false},
  {id:'DOU',     name:'動画', full:'動画',       kind:'work',  g:'動画', po:true, route:true},
  {id:'DOKEN',   name:'動検', full:'動検',       kind:'check', g:'動画',          route:true},
  {id:'SHIAGE',  name:'仕上げ', full:'仕上げ',     kind:'work',  g:'仕上', po:true, route:true},
  {id:'CELKEN',  name:'セル検', full:'セル検',     kind:'check', g:'仕上',          route:true},
  {id:'SATSU',   name:'撮影', full:'撮影',       kind:'work',  g:'撮影',          route:true},
];
const N = STAGES.length;
const IDX = Object.fromEntries(STAGES.map((s,i)=>[s.id,i]));
const GROUPS_ST = ['LO','原画','動画','仕上','撮影'];
const lastOfGroup = g => Math.max(...STAGES.map((s,i)=>s.g===g?i:-1));
// 発注書の作業内容 ↔ 工程（発注書のマスタ一覧「工程」列にあたる）
const WORK = {LO:{name:'L/O', unit:'カット', price:4400}, GEN:{name:'原画', unit:'カット', price:3800}, DOU:{name:'動画', unit:'枚', price:250}, SHIAGE:{name:'仕上げ', unit:'枚', price:200}};
const WORKERS = {
  LO:['青木 瞳','森田 健吾','高橋 さくら','スタジオ北斗（外注）'],
  GEN:['青木 瞳','森田 健吾','高橋 さくら','スタジオ北斗（外注）'],
  DOU:['佐野 美咲','動画工房ミナト（外注）'],
  SHIAGE:['堀 奈々','彩色ラボ（外注）'],
  SATSU:['内田 翔'],
};
const CHECKERS = {LOEN:'川上（演出）',LOSK:'西村（作監）',GENEN:'川上（演出）',GENSK:'西村（作監）',GENSOSK:'南（総作監）',DOKEN:'大野（動検）',CELKEN:'村井（セル検）'};
// 入力者（設定で変えられる）
let OPERATOR = '東海林（制作進行）';
// チェック工程で渡せる人（担当と、代わりに見る人）
const CHECK_POOL = {LOEN:['川上（演出）','佐藤（演出）'], GENEN:['川上（演出）','佐藤（演出）'], LOSK:['西村（作監）','中島（作監）'], GENSK:['西村（作監）','中島（作監）'], GENSOSK:['南（総作監）'], DOKEN:['大野（動検）','石田（動検）'], CELKEN:['村井（セル検）']};
const REASONS = ['作画修正','演出意図と違う','設定・キャラ表違い','タイミング','指示漏れ','その他'];
const RETURN_REASONS = ['未完成','枚数が足りない','タイムシート・書類の不備','指示と違う','その他'];
const SHELF = '社内棚（制作）';

let S, ui;

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad = n => String(n).padStart(2,'0');
const fD  = t => t ? `${new Date(t).getMonth()+1}/${new Date(t).getDate()}` : '';
const fDT = t => { if(!t) return ''; const d=new Date(t); return `${d.getMonth()+1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const clock = () => Date.now();
const WD = '日月火水木金土';
const dayLabel = t => { const d=new Date(t); return `${d.getMonth()+1}/${d.getDate()}（${WD[d.getDay()]}）`; };
const ago = t => { const d=Math.floor((clock()-t)/DAY); return d<=0 ? '今日' : `${d}日前`; };
const sleep = ms => new Promise(r=>setTimeout(r,ms));
const colName = i => { let s=''; i++; while(i>0){ const m=(i-1)%26; s=String.fromCharCode(65+m)+s; i=Math.floor((i-1)/26); } return s; };
const startOfDay = t => { const d=new Date(t); d.setHours(0,0,0,0); return d.getTime(); };

/* ================= data layer ================= */
function cutByNo(no){ return S.cuts.find(c=>c.no===no); }
function cutById(id){ return S.cuts.find(c=>c.id===id); }
function activeQr(cutId){ return S.qrs.find(q=>q.cut===cutId && q.status==='active'); }
function voidedSet(){ return new Set(S.events.filter(e=>e.type==='VOID').map(e=>e.voidOf)); }
// 標準ルートでの次の工程（今の工程が標準ルート外でも、その後ろの標準工程へ戻る）
function routeNext(i){ for(let k=i+1;k<N;k++) if(STAGES[k].route) return k; return N; }
// 発注書のカットNo.の書き方をそろえる: "9" "09" "C009" → C009、枝番は残す
function normCut(text){ const m=String(text||'').trim().toUpperCase().match(/^C?0*(\d+)([A-Z]?)$/); return m ? 'C'+m[1].padStart(3,'0')+m[2] : null; }
function orderLines(){ return S.orders.flatMap(o=>o.lines.map((l,li)=>({o, l, li, cut: (()=>{ const n=normCut(l.text); const c=n&&cutByNo(n); return c?c.id:null; })()}))); }
function findOrderLine(cutId, stage){ return orderLines().find(x=>x.cut===cutId && x.o.stage===stage); }
// 書き間違いの候補: 同じ工程・話数で、カットNo.が存在しない明細のうち、1桁違いか数字の入れ替わり
function similarNo(a, b){
  if(a===b) return false;
  if(a.length===b.length){ let diff=[]; for(let i=0;i<a.length;i++) if(a[i]!==b[i]) diff.push(i);
    if(diff.length===1) return true;
    if(diff.length===2 && diff[1]===diff[0]+1 && a[diff[0]]===b[diff[1]] && a[diff[1]]===b[diff[0]]) return true; }
  return false;
}
function candidatesFor(cutId, stage){
  const c = cutById(cutId), digits = c.no.replace(/\D/g,'').replace(/^0+/,'');
  const linked = linkedLines();
  return orderLines().filter(x=>!x.cut && x.o.stage===stage && x.o.ep===c.ep && !linked.has(x.o.no+'|'+x.li) && similarNo(String(x.l.text).replace(/\D/g,'').replace(/^0+/,''), digits));
}
function linkedLines(){ const v=voidedSet(), m=new Map(); S.events.forEach(e=>{ if(e.type==='IN' && e.poLine!=null && !v.has(e.no)) m.set(e.po+'|'+e.poLine, e.cut); }); return m; }

// カットの今の状態は、履歴だけから組み立て直す
// どの工程も「配布（IN）→ 回収（UP）→ 制作確認」の繰り返し。
// 制作確認で「確認OK」なら次の工程へ、「差し戻し（不備）」なら同じ人へ戻す、チェック工程で「リテイク」なら前の工程へ戻す
function derive(cutId){
  const voided = voidedSet();
  const all = S.events.filter(e=>e.cut===cutId);
  const evs = all.filter(e=>['IN','UP','OK','RETAKE','RETURN'].includes(e.type) && !voided.has(e.no));
  const d = {stage:0, phase:'wait', holder:SHELF, cells:{}, workers:{}, po:{}, open:null, ret:null, rtCount:0, retCount:0, lastTs:null, due:null, since:null, rev:all.length, retakes:[], returns:[], evs, passed:new Set()};
  STAGES.forEach(s=>d.cells[s.id]={});
  const advance = (e) => {
    let next = e.to ?? routeNext(e.stage);
    if(d.open){
      if(e.stage===d.open.raised){ d.open.closed=e.ts; d.open=null; }
      else if(e.stage===d.open.target && d.open.mode==='direct') next=d.open.raised;
    }
    if(STAGES[e.stage].kind==='work') d.due=null;
    d.stage=next;
    if(next>=N){ d.phase='done'; d.holder='完了（保管）'; } else { d.phase='wait'; d.holder=SHELF; }
  };
  for(const e of evs){
    d.lastTs = e.ts;
    const st = STAGES[e.stage], sid = st.id, c = d.cells[sid];
    if(e.type==='IN'){
      d.stage=e.stage; d.phase='in'; d.holder=e.person; d.passed.add(e.stage);
      if(st.kind==='work'){ d.workers[sid]=e.person; d.due=e.due||null; if(e.po) d.po[sid]=e.po; if(e.sheets!=null) c.sheets=e.sheets; }
      if(d.open || c.in) c.rin=e.ts; else c.in=e.ts;
    } else if(e.type==='UP'){
      if(c.up) c.rup=e.ts; else c.up=e.ts;
      d.phase='review'; d.from=d.holder; d.holder='制作（確認中）'; d.since=e.ts;
    } else if(e.type==='OK'){
      c.ok=e.ts;
      if(d.ret){ d.ret.closed=e.ts; d.ret=null; }
      advance(e);
    } else if(e.type==='RETURN'){
      const r = {...e.rt, ts:e.ts, closed:null, note:e.note, person:e.person};
      d.returns.push(r); d.ret=r; d.retCount++;
      d.phase='in'; d.holder=e.person; c.rin=e.ts;
    } else if(e.type==='RETAKE'){
      if(d.open){ d.open.closed=e.ts; d.open.chained=true; }
      const r = {...e.rt, ts:e.ts, closed:null, op:e.op, note:e.note, person:e.person};
      d.retakes.push(r); d.open=r; d.rtCount++;
      d.stage=e.stage; d.phase='in'; d.holder=e.person; c.rin=e.ts; d.workers[sid]=e.person;
    }
  }
  d.stale = d.phase!=='done' && d.lastTs && (clock()-d.lastTs) >= 3*DAY;
  return d;
}
function statusOf(d){
  if(d.phase==='done') return {k:'done', t:'完了'};
  if(d.phase==='review') return {k:'review', t:'制作確認中'};
  if(d.ret && d.phase==='in') return {k:'return', t:'差し戻し中'};
  if(d.open) return {k:'retake', t:'リテイク中'};
  if(d.phase==='in') return {k:'in', t: STAGES[d.stage].kind==='work' ? '作業中' : 'チェック中'};
  return {k:'wait', t:'配布待ち'};
}
function stageLabel(d){ return d.phase==='done' ? '完了' : STAGES[d.stage].name; }
const fullOf = i => STAGES[i]?.full || '';
const groupDone = (d, g) => d.phase==='done' || d.stage > lastOfGroup(g);
// 確認OK のあとに進む工程
function nextOf(d){
  if(d.phase==='done') return null;
  if(d.phase==='wait' || d.phase==='in') return d.stage;
  if(d.open && d.stage===d.open.target && d.open.mode==='direct') return d.open.raised;
  return routeNext(d.stage);
}

// 配布のとき自動で入る内容（チェック工程は担当、発注する工程は発注書から）。見つからなければ null
function autoIn(cutId, d){
  const st = STAGES[d.stage];
  if(st.kind==='check') return {person:CHECKERS[st.id]};
  if(!st.po) return {person:(WORKERS[st.id]||[''])[0]};
  const x = findOrderLine(cutId, d.stage);
  return x ? {person:x.o.vendor, po:x.o.no, poLine:x.li, sheets:x.l.sheets ?? null} : null;
}

// 変更はすべてここを通る。今の状態で許される操作かを確かめてから追記する
function act(cutId, type, o={}, ts=clock()){
  const d = derive(cutId);
  const st = STAGES[d.stage];
  const fail = m => ({ok:false, msg:m});
  if(type==='IN'  && d.phase!=='wait') return fail('このカット袋は配布待ちではありません。');
  if(type==='UP'  && d.phase!=='in')   return fail('このカット袋は作業中・チェック中ではないので回収できません。');
  if(type==='OK'  && d.phase!=='review') return fail('制作確認中のカット袋ではありません。');
  if(type==='RETURN' && d.phase!=='review') return fail('差し戻しは、制作確認中のカット袋から行えます。');
  if(type==='RETAKE' && !(d.phase==='review' && st.kind==='check')) return fail('リテイクは、チェック工程から回収したカット袋の確認で登録します。');
  const qr = o.qr || activeQr(cutId).token;
  const ev = {no:++S.seq, ts, ets:o.ets||ts, cut:cutId, qr, type, op:OPERATOR, note:o.note||''};
  if(o.late) ev.late = true;
  if(type==='IN'){
    ev.stage=d.stage; ev.person=o.person; if(o.due) ev.due=o.due;
    if(o.po){ ev.po=o.po; ev.poLine=o.poLine; }
    if(o.provisional) ev.provisional=true;
    if(o.sheets!=null) ev.sheets=o.sheets;
  } else if(type==='UP'){
    ev.stage=d.stage; ev.person=d.holder;
  } else if(type==='OK'){
    ev.stage=d.stage; if(o.to!=null) ev.to=o.to;
  } else if(type==='RETURN'){
    ev.stage=d.stage; ev.person=d.from || d.workers[st.id] || CHECKERS[st.id] || '';
    ev.rt = {id:'D'+String(++S.retSeq).padStart(3,'0'), kind:'差し戻し', stage:d.stage, reason:o.reason||''};
  } else if(type==='RETAKE'){
    ev.stage=o.target;
    ev.person = d.workers[STAGES[o.target].id] || CHECKERS[STAGES[o.target].id] || '';
    ev.rt = {id:'R'+String(++S.rtSeq).padStart(3,'0'), kind:'リテイク', raised:d.stage, by:CHECKERS[st.id], target:o.target, mode:o.mode||'direct', reason:o.reason||''};
  } else if(type==='VOID'){
    ev.voidOf=o.voidOf; const t=S.events.find(e=>e.no===o.voidOf); ev.stage=t.stage;
  } else {
    ev.stage=d.stage;
  }
  S.events.push(ev);
  return {ok:true, ev, before:d, after:derive(cutId)};
}
// カット袋を読んだときの操作：配布待ち→配布、作業中・チェック中→回収（確認待ちは確認OK。途中からの再生でも使う）
function defaultAct(cutId, extra={}, ts){
  const d = derive(cutId);
  if(d.phase==='done') return {ok:false, msg:'このカットは完了しています。'};
  if(d.phase==='wait'){ const a = autoIn(cutId, d); if(!a) return {ok:false, need:'order'}; return act(cutId,'IN',{...a, ...extra}, ts); }
  if(d.phase==='review') return act(cutId,'OK',extra, ts);
  return act(cutId,'UP',extra, ts);
}
function defaultLabel(d, cutId){
  if(d.phase==='done') return '';
  const f = fullOf(d.stage);
  if(d.phase==='wait'){ const a=autoIn(cutId,d); return `配布（${f}${a?'・'+a.person:''}）`; }
  if(d.phase==='review') return `確認OK（${f}）`;
  return `回収（${f}${d.open?'・リテイク分':d.ret?'・差し戻し分':''}）`;
}

/* ---- 要確認: 操作の途中では止めず、ここにまとめて出す ---- */
function issues(){
  const out = [], v = voidedSet(), linked = linkedLines(), now = clock();
  orderLines().filter(x=>!x.cut).forEach(x=>{
    const key = x.o.no+'-'+x.li, lk = linked.get(x.o.no+'|'+x.li);
    const cands = !lk ? S.cuts.filter(c=>{ const d=derive(c.id); return d.stage===x.o.stage && !findOrderLine(c.id,x.o.stage) && similarNo(String(x.l.text).replace(/\D/g,'').replace(/^0+/,''), c.no.replace(/\D/g,'').replace(/^0+/,'')); }) : [];
    if(lk) out.push({id:'typo:'+key, k:'order', type:'発注書の書き間違いの疑い', cut:cutById(lk).no, text:`発注番号 ${x.o.no} の「${x.l.text}」を ${cutById(lk).no} として仮に紐づけ中。発注書の修正待ち`, who:'発注した進行'});
    else if(cands.length) out.push({id:'typo:'+key, k:'order', type:'発注書の書き間違いの疑い', cut:cands[0].no, text:`発注番号 ${x.o.no} の「${x.l.text}」は ${cands[0].no} では？（${x.o.vendor}・${WORK[STAGES[x.o.stage].id].name}）`, who:'発注した進行'});
    else out.push({id:'nocut:'+key, k:'order', type:'発注書のカットNo.が不明', cut:'', text:`発注番号 ${x.o.no} の「${x.l.text}」に当たるカットがない`, who:'発注した進行'});
  });
  S.events.forEach(e=>{
    if(v.has(e.no)) return;
    if(e.type==='IN' && STAGES[e.stage].po && !e.po && !e.provisional) out.push({id:'nopo:'+e.no, k:'order', type:'発注書なしで配布', cut:cutById(e.cut).no, text:`${fullOf(e.stage)} を ${e.person} に配布（発注書が見つからない）`, who:'デスク'});
    if(e.type==='IN' && e.po && !e.provisional){ const o=S.orders.find(x=>x.no===e.po); if(o && o.vendor!==e.person) out.push({id:'who:'+e.no, k:'order', type:'発注先と渡した相手が違う', cut:cutById(e.cut).no, text:`${fullOf(e.stage)}：発注書は ${o.vendor}、渡した相手は ${e.person}`, who:'発注した進行'}); }
    if(e.type==='ALERT' && now-e.ts < 7*DAY) out.push({id:'qr:'+e.no, k:'qr', type:'旧ラベルの読み取り', cut:cutById(e.cut).no, text:`無効なQR（${e.qr}）が ${fDT(e.ts)} に読まれた。カット袋のラベルを確認`, who:'デスク'});
  });
  S.cuts.forEach(c=>{
    const d = derive(c.id); if(d.phase==='done') return;
    if(d.phase==='review' && now-d.since >= 2*DAY) out.push({id:'rev:'+c.id, k:'review', type:'制作確認待ち（2日以上）', cut:c.no, text:`${fullOf(d.stage)}を ${fD(d.since)} に回収。制作確認がまだ`, who:'進行'});
    if(d.ret && d.phase==='in') out.push({id:'ret:'+c.id, k:'ret', type:'差し戻し中', cut:c.no, text:`${d.ret.id} ${fullOf(d.stage)}・${d.holder}（${d.ret.reason}）`, who:'進行'});
    if(d.open) out.push({id:'rt:'+c.id, k:'rt', type:'リテイク中', cut:c.no, text:`${d.open.id} ${fullOf(d.open.raised)}→${fullOf(d.open.target)}（${d.open.reason}）`, who:'進行'});
    if(d.phase==='in' && d.due){
      if(d.due < now) out.push({id:'over:'+c.id, k:'due', type:'予定日超過', cut:c.no, text:`${fullOf(d.stage)}・${d.holder}（予定 ${fD(d.due)}）`, who:'進行'});
      else if(d.due - now < 2*DAY) out.push({id:'soon:'+c.id, k:'soon', type:'予定日まで2日以内', cut:c.no, text:`${fullOf(d.stage)}・${d.holder}（予定 ${fD(d.due)}）`, who:'進行'});
    }
    if(d.stale && d.phase!=='review') out.push({id:'stale:'+c.id, k:'stale', type:'3日以上動きなし', cut:c.no, text:`${fullOf(d.stage)}・${d.holder}（${Math.floor((now-d.lastTs)/DAY)}日）`, who:'進行'});
  });
  return out;
}

/* ================= seed data ================= */
function seed(){
  S = {cuts:[], qrs:[], events:[], orders:[], seq:0, rtSeq:0, retSeq:0, poSeq:0, day:0};
  // QRのIDは固定（印刷したQRコードを、初期データを作り直しても使い続けられるように）。C001〜C015 の順、最後は C005 の再発行分
  const FIXED_QR = ['Q7K2M9A','QX4P8DL','Q3N6T1R','QH8W2CE','QB5J7VY','Q9F3K6S','QM2R8XT','QD6Y4NB','QT1G9HP','QL7C3WK','QR4V8JD','QE9S2MZ','QW5H6QA','QN3B7FX','QC8Z1LU','QP6D4GR'];
  let tokN = 0;
  const tok = () => FIXED_QR[tokN++];
  const defs = [
    // no, part, sec, 到達工程, 状態（in=作業中・チェック中／review=回収済み・制作確認中／wait=配布待ち）, 開始（何日前）, 最終（何日前）
    ['C001','A','3+12','DONE','',   30, 2],
    ['C002','A','5+00','SATSU','in',28, 1],
    ['C003','A','2+18','GENEN','wait',20, 1.2],
    ['C004','A','6+06','GEN','in',  24, 0.6],
    ['C005','B','4+00','DOU','in',  22, 1],
    ['C006','B','3+06','GENSK','in',21, 0.7],
    ['C007','B','7+12','GENSK','in',18, 0.5],
    ['C008','B','1+18','GENSK','in',16, 0.4],
    ['C009','C','3+00','LO','wait', 0, 0],
    ['C010','C','2+12','SHIAGE','wait',25,1.5],
    ['C011','C','4+18','DOKEN','in',23, 0.8],
    ['C012','C','2+00','LO','wait', 0, 0],
    ['C013','A','1+12','LO','wait', 0, 0],
    ['C014','B','2+06','LO','wait', 0, 0],
    ['C015','C','3+18','LO','wait', 0, 0],
  ];
  const partWorker = {A:0,B:1,C:2};
  const now = Date.now();
  const personFor = (st, part) => st.kind==='work' ? WORKERS[st.id][Math.min(partWorker[part], WORKERS[st.id].length-1)] : CHECKERS[st.id];
  defs.forEach(([no,part,sec,tgt,phase,a,b],i)=>{
    const id = 'SMP-01-' + no;
    S.cuts.push({id,no,ep:'#01',part,sec});
    S.qrs.push({token:tok(), cut:id, status:'active', issued: now-(a+3)*DAY});
    const ti = tgt==='DONE' ? N : IDX[tgt];
    const ops = [];
    for(let s=0; s<Math.min(ti,N); s=routeNext(s)){ const st=STAGES[s]; ops.push(['IN',{person:personFor(st,part), work:st.kind==='work'}], ['UP',{}], ['OK',{}]); }
    if(ti<N && (phase==='in' || phase==='review')){ const st=STAGES[ti]; ops.push(['IN',{person:personFor(st,part), work:st.kind==='work'}]); if(phase==='review') ops.push(['UP',{}]); }
    ops.forEach(([type,o],k)=>{
      const ts = now - (a - (a-b)*(ops.length<=1?1:k/(ops.length-1)))*DAY - 3600e3*((k*7)%5);
      act(id, type, {...o, due: o.work ? ts+5*DAY : null}, ts);
    });
  });
  const byNo = no => cutByNo(no).id;
  const rebuild = (cutId, script) => { S.events = S.events.filter(e=>e.cut!==cutId); for(const [type,o,daysAgo] of script) act(cutId,type,o, now-daysAgo*DAY); };
  // C004: 過去に閉じたリテイクがある（LO作監チェック → LO）
  rebuild(byNo('C004'), [
    ['IN',{person:'青木 瞳', due:now-19*DAY},24],['UP',{},20],['OK',{},19.8],['IN',{person:CHECKERS.LOEN},19.5],['UP',{},18.2],['OK',{},18],['IN',{person:CHECKERS.LOSK},17.5],['UP',{},17.2],
    ['RETAKE',{target:IDX.LO, mode:'direct', reason:'設定・キャラ表違い', note:'衣装の柄が設定と違う'},17],
    ['UP',{},14],['OK',{},13.8],['IN',{person:CHECKERS.LOSK},13.5],['UP',{},13.2],['OK',{},13],['IN',{person:'青木 瞳', due:now+1*DAY},6],['UP',{},1.4],['OK',{},1.2],
  ]);
  // C007: リテイク対応中（原画作監チェック → 原画、作監へ直接戻す）
  rebuild(byNo('C007'), [
    ['IN',{person:'森田 健吾', due:now-13*DAY},18],['UP',{},15],['OK',{},14.8],['IN',{person:CHECKERS.LOEN},14.5],['UP',{},14.2],['OK',{},14],['IN',{person:CHECKERS.LOSK},13.5],['UP',{},13.2],['OK',{},13],
    ['IN',{person:'森田 健吾', due:now-6*DAY},12],['UP',{},5],['OK',{},4.8],['IN',{person:CHECKERS.GENEN},4.5],['UP',{},4.2],['OK',{},4],['IN',{person:CHECKERS.GENSK},3.2],['UP',{},0.8],
    ['RETAKE',{target:IDX.GEN, mode:'direct', reason:'作画修正', note:'ラスト3枚の芝居が硬い'},0.5],
  ]);
  // C005: ラベル破損で再発行済み。旧QRは無効
  const c5 = byNo('C005'); const q5 = activeQr(c5);
  q5.status='revoked'; q5.revoked=now-8*DAY; q5.reason='ラベル破損のため再発行';
  S.qrs.push({token:tok(), cut:c5, status:'active', issued:now-8*DAY, prev:q5.token});
  S.events.sort((x,y)=>x.ts-y.ts); S.events.forEach((e,i)=>e.no=i+1); S.seq=S.events.length;
  let r=0; S.events.forEach(e=>{ if(e.rt && e.type==='RETAKE'){ e.rt.id='R'+String(++r).padStart(3,'0'); } }); S.rtSeq=r;

  // 発注書（読み取り専用で取り込んだもの）。過去の配布は、作業者×作業内容ごとの発注書に紐づける
  const newOrder = (stage, vendor, date, due, lines) => { const o={no:'1012600'+pad(++S.poSeq), date, staff:'東海林', vendor, stage, ep:'#01', work:WORK[STAGES[stage].id].name, unit:WORK[STAGES[stage].id].unit, price:WORK[STAGES[stage].id].price, due, lines}; S.orders.push(o); return o; };
  const sheetsOf = (cutNo, sid) => sid==='DOU' || sid==='SHIAGE' ? 30 + (Number(cutNo.slice(1))*7)%25 : null;
  const groups = new Map();
  S.events.forEach(e=>{ if(e.type!=='IN' || !STAGES[e.stage].po) return; const k=e.stage+'|'+e.person; if(!groups.has(k)) groups.set(k,[]); groups.get(k).push(e); });
  groups.forEach(evs=>{
    const e0 = evs[0], sid = STAGES[e0.stage].id;
    const o = newOrder(e0.stage, e0.person, Math.min(...evs.map(e=>e.ts))-DAY, Math.max(...evs.map(e=>e.due||e.ts)), []);
    evs.forEach(e=>{ const c=cutById(e.cut), t=String(Number(c.no.slice(1))); let li=o.lines.findIndex(l=>l.text===t); if(li<0){ const sh=sheetsOf(c.no, sid); o.lines.push({text:t, sheets:sh}); li=o.lines.length-1; } e.po=o.no; e.poLine=li; if(o.lines[li].sheets!=null) e.sheets=o.lines[li].sheets; });
  });
  // これから配布するカットの発注書（発注は必ず作業より先に出ている）
  newOrder(IDX.LO, '青木 瞳', now-2*DAY, now+6*DAY, [{text:'13', sheets:null}]);
  newOrder(IDX.LO, '森田 健吾', now-2*DAY, now+6*DAY, [{text:'14', sheets:null}]);
  newOrder(IDX.LO, '高橋 さくら', now-2*DAY, now+12*DAY, [{text:'9', sheets:null}, {text:'15', sheets:null}]);
  // C012 を「21」と書き間違えた追加発注（ヒューマンエラーの例）
  newOrder(IDX.LO, '高橋 さくら', now-1*DAY, now+24*DAY, [{text:'21', sheets:null}]);
  newOrder(IDX.GEN, '青木 瞳', now-1*DAY, now+24*DAY, [{text:'13', sheets:null}]);
  newOrder(IDX.GEN, '森田 健吾', now-1*DAY, now+24*DAY, [{text:'14', sheets:null}]);
  newOrder(IDX.GEN, 'スタジオ北斗（外注）', now-1*DAY, now+24*DAY, [{text:'15', sheets:null}]);
  newOrder(IDX.SHIAGE, '堀 奈々', now-2*DAY, now+25*DAY, [{text:'10', sheets:sheetsOf('C010','SHIAGE')}]);
}


function qrSvg(text){
  try{
    const q = qrcode(0,'M'); q.addData(text); q.make();
    return q.createSvgTag({cellSize:2, margin:0, scalable:true});
  }catch(e){ return '<svg viewBox="0 0 10 10"><rect width="10" height="10" fill="#000"/></svg>'; }
}

// スプレッドシートの各表
function orderRowStatus(x, linked){
  if(!x.cut){ const lk=linked.get(x.o.no+'|'+x.li); return lk ? {t:`仮紐づけ（${cutById(lk).no}）`, c:'st-stale'} : {t:'カットNo.不明', c:'st-bad'}; }
  const d = derive(x.cut);
  const inDone = d.evs.some(e=>e.type==='IN' && e.stage===x.o.stage);
  if(!inDone) return {t:'未配布', c:'st-wait'};
  if(d.stage===x.o.stage && d.phase==='review') return {t:'回収済（制作確認中）', c:'st-stale'};
  return groupDone(d, STAGES[x.o.stage].g) || d.stage > x.o.stage ? {t:'確認OK', c:'st-in'} : {t:'配布済', c:'st-in'};
}
function buildTab(id){
  if(id==='prog'){
    const groups=[{n:'',span:5}], head=['C#','パート','現状','R回数','差戻'];
    STAGES.forEach((s,i)=>{ const cols = s.kind==='work'?['IN','UP','R-IN','R-UP','枚数']:['IN','UP','R-IN','R-UP']; groups.push({n:s.name,span:cols.length,alt:i%2===1}); cols.forEach(c=>head.push({t:c,alt:i%2===1})); });
    const rows = S.cuts.map(c=>{
      const d = derive(c.id), st=statusOf(d);
      const cells=[{v:c.no},{v:c.part,c:'c'},{v:`${stageLabel(d)} ${d.phase==='done'?'':st.t}`.trim(), c:'st-'+st.k},{v:d.rtCount||'',c:'c'+(d.rtCount?' rtc':'')},{v:d.retCount||'',c:'c'+(d.retCount?' rtc':'')}];
      STAGES.forEach((s,i)=>{
        const x=d.cells[s.id], alt=i%2===1?' alt':'';
        cells.push({v:fD(x.in),c:'c'+alt},{v:fD(x.up),c:'c'+alt},{v:fD(x.rin),c:'c'+(x.rin?' rtc':alt)},{v:fD(x.rup),c:'c'+(x.rup?' rtc':alt)});
        if(s.kind==='work') cells.push({v:x.sheets??'',c:'r'+alt});
      });
      return {key:c.id,cells};
    });
    return {groups,head,rows};
  }
  if(id==='master'){
    const head=['C#','Cut ID','話数','秒数','現工程','状態','所在','納期','R回数','差戻回数','最終更新','滞留日数','QR（有効）','rev'];
    const rows=S.cuts.map(c=>{ const d=derive(c.id), st=statusOf(d); const days=d.lastTs?Math.floor((clock()-d.lastTs)/DAY):'';
      return {key:c.id,cells:[{v:c.no},{v:c.id,c:'muted'},{v:c.ep,c:'c'},{v:c.sec,c:'r'},{v:stageLabel(d)},{v:st.t,c:'st-'+st.k},{v:d.holder},{v:fD(d.due),c:'c'},{v:d.rtCount||'',c:'c'+(d.rtCount?' rtc':'')},{v:d.retCount||'',c:'c'+(d.retCount?' rtc':'')},{v:fDT(d.lastTs),c:'c'},{v:d.phase==='done'?'':days,c:'r'+(d.stale?' st-stale':'')},{v:activeQr(c.id).token,c:'muted'},{v:d.rev,c:'r muted'}]}; });
    return {head,rows};
  }
  if(id==='order'){
    const head=['発注番号','発注日','発注先','作業内容','話数','カットNo.（記載）','紐づけ','枚','単価方式','単価','金額','納品期日','状態'];
    const linked = linkedLines();
    const rows = orderLines().map(x=>{ const s=orderRowStatus(x, linked); const cutNo = x.cut ? cutById(x.cut).no : (linked.get(x.o.no+'|'+x.li) ? cutById(linked.get(x.o.no+'|'+x.li)).no : '');
      const amt = x.o.unit==='枚' ? (x.l.sheets||0)*x.o.price : x.o.price;
      return {key:'o'+x.o.no+'-'+x.li, cells:[{v:x.o.no,c:'muted'},{v:fD(x.o.date),c:'c'},{v:x.o.vendor},{v:x.o.work},{v:x.o.ep,c:'c'},{v:x.l.text,c:'r'+(x.cut?'':' st-bad')},{v:cutNo,c:x.cut?'':'st-stale'},{v:x.l.sheets??'',c:'r'},{v:x.o.unit+'単価',c:'c'},{v:x.o.price.toLocaleString(),c:'r'},{v:amt.toLocaleString(),c:'r'},{v:fD(x.o.due),c:'c'},{v:s.t,c:s.c}]}; });
    return {head,rows};
  }
  if(id==='log'){
    const head=['No','実施日時','入力日時','C#','QR','操作','工程','担当・所在','発注番号','リテイク','備考','入力者'];
    const voided=voidedSet();
    const typeName={IN:'配布',UP:'回収',OK:'確認OK',RETURN:'差し戻し',RETAKE:'リテイク',VOID:'取り消し',ALERT:'無効QR',MANUAL:'番号で開く'};
    const rows=S.events.map(e=>{ const c=cutById(e.cut); const stg=STAGES[e.stage]?.name||'';
      const typeCls = e.type==='RETAKE'||e.type==='RETURN'?'st-retake':e.type==='ALERT'?'st-bad':e.type==='VOID'?'st-stale':'';
      const opName = e.type==='OK' && e.to!=null ? `確認OK→${STAGES[e.to].name}` : (typeName[e.type]||e.type);
      return {key:'e'+e.no, cls:voided.has(e.no)?'void':'', cells:[{v:e.no,c:'r'},{v:fDT(e.ts),c:'c'},{v:e.late?fDT(e.ets)+' 後入力':'',c:e.late?'c st-stale':'c'},{v:c.no},{v:e.qr,c:'muted'},{v:opName,c:typeCls},
        {v:e.type==='RETAKE'?`${STAGES[e.rt.raised].name}→${stg}`:stg},{v:e.type==='IN'||e.type==='RETAKE'||e.type==='RETURN'?e.person:''},{v:e.po?(e.po+(e.provisional?'（仮）':'')):'',c:e.provisional?'st-stale':'muted'},{v:e.rt?e.rt.id:'',c:e.rt?'st-retake':''},{v:e.type==='VOID'?`No.${e.voidOf} を打ち消し`:(e.rt?[e.rt.reason,e.note].filter(Boolean).join('／'):e.note)},{v:e.op}]}; });
    return {head,rows};
  }
  if(id==='issues'){
    const head=['種類','C#','内容','対応する人'];
    const cls = {order:'st-bad', qr:'st-bad', rt:'st-retake', due:'st-bad', soon:'st-stale', stale:'st-stale'};
    return {head, rows: issues().map(x=>({key:'i'+x.id, cells:[{v:x.type,c:cls[x.k]},{v:x.cut},{v:x.text},{v:x.who}]}))};
  }
  if(id==='retake'){
    const head=['ID','種別','C#','発生日時','どこで','戻し先','戻し相手','戻り方','理由','メモ','状態','完了日時','所要'];
    const all=[]; S.cuts.forEach(c=>{ const d=derive(c.id); d.retakes.forEach(r=>all.push({c,r,k:'rt'})); d.returns.forEach(r=>all.push({c,r,k:'ret'})); });
    all.sort((a,b)=>a.r.ts-b.r.ts);
    const rows=all.map(({c,r,k})=>{ const st = r.closed ? (r.chained?'再リテイクへ':'完了') : '対応中';
      const dur = r.closed ? `${Math.max(0,((r.closed-r.ts)/DAY)).toFixed(1)}日` : `${((clock()-r.ts)/DAY).toFixed(1)}日〜`;
      const rt = k==='rt';
      return {key:'r'+r.id,cells:[{v:r.id,c:'st-retake'},{v:rt?'リテイク':'差し戻し（不備）',c:rt?'st-retake':'st-stale'},{v:c.no},{v:fDT(r.ts),c:'c'},{v:rt?`${STAGES[r.raised].name}（${r.by||''}）`:'制作確認'},{v:STAGES[rt?r.target:r.stage].name},{v:r.person},{v:rt?(r.mode==='direct'?'指摘元へ直接':'順に通す'):'—'},{v:r.reason},{v:r.note||''},{v:st,c:r.closed?'st-in':'st-retake'},{v:fDT(r.closed),c:'c'},{v:dur,c:'r'}]}; });
    return {head,rows};
  }
  if(id==='daily'){
    // 既存の「日報」にあたる集計：作業者 × 工程ごとの担当カット・UP・手持ち・枚数
    const head=['工程','作業者','担当カット','UP','手持ち','枚数（UP分）'];
    const m = new Map();
    S.cuts.forEach(c=>{ const d=derive(c.id); STAGES.forEach((s,i)=>{ if(s.kind!=='work') return; const w=d.workers[s.id]; if(!w) return;
      const k=s.id+'|'+w; if(!m.has(k)) m.set(k,{s, w, cuts:0, up:0, hold:0, sheets:0}); const x=m.get(k); x.cuts++;
      const cell=d.cells[s.id]; if(cell.up||cell.rup){ x.up++; x.sheets+=cell.sheets||0; } if(d.phase==='in' && d.stage===i) x.hold++; }); });
    const rows=[...m.values()].sort((a,b)=>IDX[a.s.id]-IDX[b.s.id] || a.w.localeCompare(b.w)).map(x=>({key:'d'+x.s.id+x.w, cells:[{v:x.s.name},{v:x.w},{v:x.cuts,c:'r'},{v:x.up,c:'r'},{v:x.hold,c:'r'+(x.hold?' st-in':'')},{v:x.sheets||'',c:'r'}]}));
    return {head,rows};
  }
  if(id==='qr'){
    const head=['QR ID','C#','Cut ID','状態','発行日','無効化日','理由','旧QR'];
    const rows=S.qrs.map(q=>{ const c=cutById(q.cut); return {key:'q'+q.token,cells:[{v:q.token},{v:c.no},{v:c.id,c:'muted'},{v:q.status==='active'?'有効':'無効',c:q.status==='active'?'st-in':'st-bad'},{v:fD(q.issued),c:'c'},{v:fD(q.revoked),c:'c'},{v:q.reason||''},{v:q.prev||'',c:'muted'}]}; });
    return {head,rows};
  }
}
