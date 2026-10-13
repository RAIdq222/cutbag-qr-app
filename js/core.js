// データの持ち方と状態の計算。工程と進捗表の列は、作品の進捗表（Excel）に合わせる（docs/07_進捗表の作り.md）
const DAY = 864e5;

/* ================= 工程 ================= */
// 進捗表の工程のまとまり（左から順）
const GROUPS = ['LO','原画','動画','仕上げ','背景','CT','DB差し','本撮'];
// 工程。kind：work＝作業（発注して渡す）／check＝チェック。who：worker＝作業者に渡す／staff＝話数の担当／sakkan＝作監の記号で決まる
// role：話数の担当の役割。std：標準で通す工程。通す工程はカットごとに変えられる（例：総作監を通すカット）
const ST_LIST = [
  ['LO',      'LO',             'LO',  'work', 'worker', '',           1, 1],
  ['LOENJ',   'LO演出助手',      'LO',  'check','staff',  '演出助手',   0],
  ['LOEN',    'LO演出',          'LO',  'check','staff',  '演出',       1],
  ['LOFUKU',  'LO副監督',        'LO',  'check','staff',  '副監督',     0],
  ['LOKAN',   'LO監督',          'LO',  'check','staff',  '監督',       0],
  ['LOACT',   'LOアクション作監', 'LO',  'check','staff',  'アクション作監', 0],
  ['LOEFF',   'LOエフェクト作監', 'LO',  'check','staff',  'エフェクト作監', 0],
  ['LOMECHA', 'LOメカ作監',      'LO',  'check','staff',  'メカ作監',   0],
  ['LOSK',    'LO作監',          'LO',  'check','sakkan', '作監',       1],
  ['LOSOSK',  'LO総作監',        'LO',  'check','staff',  '総作監',     0],
  ['LOCHARA', 'LOキャラデ総作監', 'LO',  'check','staff',  'キャラデ総作監', 0],
  ['GEN',     '原画',            '原画','work', 'worker', '',           1, 1],
  ['GENENJ',  '原画演出助手',     '原画','check','staff',  '演出助手',   0],
  ['GENEN',   '原画演出',        '原画','check','staff',  '演出',       1],
  ['GENFUKU', '原画副監督',      '原画','check','staff',  '副監督',     0],
  ['GENKAN',  '原画監督',        '原画','check','staff',  '監督',       0],
  ['GENACT',  '原画アクション作監','原画','check','staff',  'アクション作監', 0],
  ['GENEFF',  '原画エフェクト作監','原画','check','staff',  'エフェクト作監', 0],
  ['GENMECHA','原画メカ作監',    '原画','check','staff',  'メカ作監',   0],
  ['GENSK',   '原画作監',        '原画','check','sakkan', '作監',       1],
  ['GENSOSK', '原画総作監',      '原画','check','staff',  '総作監',     0],
  ['GENCHARA','原画キャラデ総作監','原画','check','staff',  'キャラデ総作監', 0],
  ['MAKI',    '撒き前',          '動画','check','staff',  '動検',       0],
  ['DOU',     '動画',            '動画','work', 'worker', '',           1, 1],
  ['DOKEN',   '動検',            '動画','check','staff',  '動検',       1],
  ['SHIAGE',  '仕上げ',          '仕上げ','work','worker', '',           1, 1],
  ['CELKEN',  'セル検',          '仕上げ','check','staff', 'セル検',     1],
  ['HONSATSU','本撮',            '本撮','work', 'staff',  '撮影',       1],
];
const STAGES = ST_LIST.map(([id,name,g,kind,who,role,std,po])=>({id, name, g, kind, who, role, std:!!std, po:!!po}));
const ST = Object.fromEntries(STAGES.map(s=>[s.id, s]));
const ORDER = Object.fromEntries(STAGES.map((s,i)=>[s.id, i]));
const DEFAULT_ROUTE = STAGES.filter(s=>s.std).map(s=>s.id);
const nameOf = sid => ST[sid] ? ST[sid].name : '';
// 画面で工程を色分けするための印（まとまりごと）
const GCLASS = {LO:'g-lo', 原画:'g-gen', 動画:'g-dou', 仕上げ:'g-shi', 本撮:'g-sat'};
// 進捗表の、カット袋の流れに乗らない列（背景・CT・DB差しなど）
const SIDE_COLS = {
  仕上げ:['色指定IN','色指定UP','色彩設計IN','色彩設計UP'],
  背景:['原図入れ','背景UP','背景ch'],
  CT:['TS修','撮影上がり'],
  DB差し:['TS修','撮影上がり','2DIN','2DUP','2D撮入れ済','3DIN','3DUP','3D撮入れ済','特効IN','特効UP','特効撮入れ済'],
};
const ROLES = ['演出','演出助手','副監督','監督','アクション作監','エフェクト作監','メカ作監','作監','総作監','キャラデ総作監','動検','セル検','撮影','進行'];
const SK_LETTERS = ['A','B','C','D','E','F'];

// 発注書の作業内容 ↔ 工程
const WORK = {LO:{name:'L/O', unit:'カット', price:4400}, GEN:{name:'原画', unit:'カット', price:3800}, DOU:{name:'動画', unit:'枚', price:250}, SHIAGE:{name:'仕上げ', unit:'枚', price:200}};
// 作業者の候補（工程ごと）。ここにない人は、渡す相手の「追加」で入れる
const WORKERS = {
  LO:['青木 瞳','森田 健吾','高橋 さくら','スタジオ北斗（外注）'],
  GEN:['青木 瞳','森田 健吾','高橋 さくら','スタジオ北斗（外注）'],
  DOU:['佐野 美咲','動画工房ミナト（外注）'],
  SHIAGE:['堀 奈々','彩色ラボ（外注）'],
};
// 入力者（マイページで変えられる）
let OPERATOR = '弁天太郎（制作進行）';
const REASONS = ['作画修正','演出意図と違う','設定・キャラ表違い','タイミング','指示漏れ','その他'];
const RETURN_REASONS = ['未完成','枚数が足りない','タイムシート・書類の不備','指示と違う','その他'];
const SHELF = '社内棚（制作）';
// 文字の色：発注書などから自動で入れた内容は青、計算・転記したものは緑、人が入れたものは黒
const SRC_AUTO = 'auto', SRC_CALC = 'calc';

let S, ui;

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad = n => String(n).padStart(2,'0');
const fD  = t => t ? `${new Date(t).getMonth()+1}/${new Date(t).getDate()}` : '';
const fDT = t => { if(!t) return ''; const d=new Date(t); return `${d.getMonth()+1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const clock = () => Date.now();
const WD = '日月火水木金土';
const ago = t => { const d=Math.floor((clock()-t)/DAY); return d<=0 ? '今日' : `${d}日前`; };
const sleep = ms => new Promise(r=>setTimeout(r,ms));
const startOfDay = t => { const d=new Date(t); d.setHours(0,0,0,0); return d.getTime(); };
const ymd = ts => { const d=new Date(ts); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
const dayTs = v => new Date(v+'T18:00').getTime();
// 祝日（日曜と同じく赤で出す）
const HOLIDAYS = new Set(['2026-01-01','2026-01-12','2026-02-11','2026-02-23','2026-03-20','2026-04-29','2026-05-03','2026-05-04','2026-05-05','2026-05-06','2026-07-20','2026-08-11','2026-09-21','2026-09-22','2026-09-23','2026-10-12','2026-11-03','2026-11-23',
  '2027-01-01','2027-01-11','2027-02-11','2027-02-23','2027-03-21','2027-03-22','2027-04-29','2027-05-03','2027-05-04','2027-05-05','2027-07-19','2027-08-11','2027-09-20','2027-09-23','2027-10-11','2027-11-03','2027-11-23']);

/* ================= データ ================= */
function cutByNo(no, ep){ return S.cuts.find(c=>c.no===no && (!ep || c.ep===ep)); }
function cutById(id){ return S.cuts.find(c=>c.id===id); }
function activeQr(cutId){ return S.qrs.find(q=>q.cut===cutId && q.status==='active'); }
function voidedSet(){ return new Set(S.events.filter(e=>e.type==='VOID').map(e=>e.voidOf)); }
const epNum = ep => String(ep).replace(/\D/g,'').padStart(2,'0');
const cutIdOf = (ep, no) => `${S.code||'SMP'}-${epNum(ep)}-${no}`;
const titleOf = () => S.title || '';
const epsOf = () => [...new Set([...(S.eps||[]).map(e=>e.ep), ...S.cuts.map(c=>c.ep)])].sort();
const epInfo = ep => (S.eps||[]).find(e=>e.ep===ep) || {ep, staff:{}};
// カットの見出し（作品・話数・カット番号）
const cutTitle = c => `${titleOf()}　${c.ep}　${c.no}`;
// 話数の担当から、チェック工程の担当者を決める（作監はカットごとの記号から）
function staffFor(c, sid){
  const st = ST[sid], staff = epInfo(c.ep).staff || {};
  if(st.who==='sakkan'){ const k = (c.sk||{})[st.g] || 'A'; return (staff.作監||{})[k] || ''; }
  return staff[st.role] || '';
}
// 渡す相手の候補
function candidatesOf(c, sid){
  const st = ST[sid], out = [];
  const add = n => { if(n && !out.includes(n)) out.push(n); };
  if(st.who==='worker') (WORKERS[sid]||[]).forEach(add);
  else if(st.who==='sakkan'){ (S.eps||[]).forEach(e=>Object.values((e.staff||{}).作監||{}).forEach(add)); }
  else { add(staffFor(c, sid)); (S.eps||[]).forEach(e=>add((e.staff||{})[st.role])); }
  S.events.forEach(e=>{ if(e.type==='IN' && e.stage===sid) add(e.person); });
  (S.people||[]).filter(p=>p.stage===sid).forEach(p=>add(p.name));
  return out;
}

// 発注書のカットNo.の書き方をそろえる："9" "09" "C009" → C009
function normCut(text){ const m=String(text||'').trim().toUpperCase().match(/^C?0*(\d+)([A-Z]?)$/); return m ? 'C'+m[1].padStart(3,'0')+m[2] : null; }
function orderLines(){ return S.orders.flatMap(o=>o.lines.map((l,li)=>({o, l, li, cut:(()=>{ const n=normCut(l.text); const c=n&&cutByNo(n, o.ep); return c?c.id:null; })()}))); }
function findOrderLine(cutId, sid){ return orderLines().find(x=>x.cut===cutId && x.o.stage===sid); }
// 書き間違いの候補：同じ工程・話数で、カットNo.が見つからない明細のうち、1桁違いか隣どうしの入れ替わり
function similarNo(a, b){
  if(a===b) return false;
  if(a.length===b.length){ const diff=[]; for(let i=0;i<a.length;i++) if(a[i]!==b[i]) diff.push(i);
    if(diff.length===1) return true;
    if(diff.length===2 && diff[1]===diff[0]+1 && a[diff[0]]===b[diff[1]] && a[diff[1]]===b[diff[0]]) return true; }
  return false;
}
function linkedLines(){ const v=voidedSet(), m=new Map(); S.events.forEach(e=>{ if(e.type==='IN' && e.poLine!=null && !v.has(e.no)) m.set(e.po+'|'+e.poLine, e.cut); }); return m; }
function typoCandidates(cutId, sid){
  const c = cutById(cutId), digits = c.no.replace(/\D/g,'').replace(/^0+/,''), linked = linkedLines();
  return orderLines().filter(x=>!x.cut && x.o.stage===sid && x.o.ep===c.ep && !linked.has(x.o.no+'|'+x.li) && similarNo(String(x.l.text).replace(/\D/g,'').replace(/^0+/,''), digits));
}

/* ================= カットの今の状態（履歴だけから組み立てる） ================= */
// どの工程も「配布（IN）→ 回収（UP）→ 制作の確認」。確認OK で次の工程へ。
// 差し戻し（不備）は同じ人へ戻す。チェック工程のリテイクは、前の工程へ戻し、直ったら指摘した工程へ直接戻る
const LIVE = ['IN','UP','OK','RETAKE','RETURN'];
function derive(cutId){
  const c = cutById(cutId), voided = voidedSet();
  const all = S.events.filter(e=>e.cut===cutId && !voided.has(e.no) && e.type!=='VOID');
  const d = {route:[...((c && c.route) || DEFAULT_ROUTE)], sid:null, phase:'wait', holder:SHELF, cells:{}, open:null, ret:null, rtCount:0, retCount:0,
    lastTs:null, since:null, from:null, retakes:[], returns:[], next:null, evs:all, due:null};
  d.sid = d.route[0];
  const cell = sid => d.cells[sid] || (d.cells[sid] = {});
  const afterOf = sid => { const i = d.route.indexOf(sid); return i>=0 && i+1<d.route.length ? d.route[i+1] : null; };
  for(const e of all){
    if(LIVE.includes(e.type)) d.lastTs = e.ts;
    if(e.type==='ROUTE'){ d.route = [...e.route]; continue; }
    if(e.type==='SET'){
      const x = cell(e.stage); x[e.field] = e.value; x[e.field+'Src'] = '';
      if(e.field==='person' && e.stage===d.sid && d.phase==='in') d.holder = e.value;
      if(e.field==='due' && e.stage===d.sid) d.due = e.value;
      continue;
    }
    if(e.type==='IN'){
      const x = cell(e.stage);
      d.sid = e.stage; d.phase = 'in'; d.holder = e.person;
      if(x.in && (d.open || d.ret || x.up)) x.rin = e.ts; else x.in = e.ts;
      x.person = e.person; x.personSrc = e.src || '';
      x.due = e.due || null; x.dueSrc = e.dueSrc || ''; d.due = x.due;
      if(e.sheets!=null){ x.sheets = e.sheets; x.sheetsSrc = e.sheetsSrc || ''; }
      if(e.po) x.po = e.po;
      d.next = null;
    } else if(e.type==='UP'){
      const x = cell(d.sid);
      if(x.rin && !x.rup) x.rup = e.ts; else if(!x.up) x.up = e.ts; else x.rup = e.ts;
      d.phase = 'review'; d.from = d.holder; d.holder = '制作（確認中）'; d.since = e.ts;
    } else if(e.type==='OK'){
      const x = cell(d.sid);
      if(e.sheets!=null){ x.sheets = e.sheets; x.sheetsSrc = ''; }
      if(d.ret){ d.ret.closed = e.ts; d.ret = null; }
      let next;
      if(d.open && d.sid===d.open.target) next = d.open.raised;
      else { if(d.open && d.sid===d.open.raised){ d.open.closed = e.ts; d.open = null; } next = afterOf(d.sid); }
      d.next = e.next || null;
      d.due = null;
      if(next){ d.sid = next; d.phase = 'wait'; d.holder = SHELF; }
      else { d.sid = null; d.phase = 'done'; d.holder = '完了（保管）'; }
    } else if(e.type==='RETURN'){
      const r = {...e.rt, ts:e.ts, closed:null, note:e.note, person:e.person, due:e.due||null};
      d.returns.push(r); d.ret = r; d.retCount++;
      const x = cell(d.sid); x.rin = e.ts; x.rup = null; if(e.due){ x.due = e.due; x.dueSrc = ''; }
      d.phase = 'in'; d.holder = e.person; d.due = e.due || x.due || null;
    } else if(e.type==='RETAKE'){
      if(d.open){ d.open.closed = e.ts; d.open.chained = true; }
      const r = {...e.rt, ts:e.ts, closed:null, note:e.note, person:e.person, due:e.due||null};
      d.retakes.push(r); d.open = r; d.rtCount++;
      cell(r.raised).rtc = e.ts;
      const x = cell(e.stage); x.rin = e.ts; x.rup = null; x.person = e.person; x.personSrc = ''; if(e.due){ x.due = e.due; x.dueSrc = ''; }
      d.sid = e.stage; d.phase = 'in'; d.holder = e.person; d.due = e.due || null;
    }
  }
  const now = clock();
  d.days = d.lastTs ? Math.floor((now - d.lastTs)/DAY) : null;
  d.stale = d.phase==='in' && d.days!=null && d.days >= 3;
  d.overdue = d.phase==='in' && d.due && d.due < startOfDay(now);
  return d;
}
// 一覧に出す日付：今の工程の IN と納期（配布待ちは前の確認OK の日、確認待ちは UP の日）。経った日数と納期超過も
const STALE_DAYS = 3;
function cutDates(d){
  const x = d.cells[d.sid] || {}, now = clock();
  const days = t => t ? Math.floor((startOfDay(now) - startOfDay(t))/DAY) : null;
  if(d.phase==='done') return {label:'完了', at:d.lastTs};
  if(d.phase==='wait') return {label:'配布待ち', at:d.lastTs, days:days(d.lastTs)};
  if(d.phase==='review') return {label:'UP', at:d.since, days:days(d.since)};
  const inAt = (d.open || d.ret) && x.rin ? x.rin : x.in;
  return {label:'IN', at:inAt, days:days(inAt), due:d.due, over:d.overdue};
}
const epOwner = ep => (epInfo(ep).staff||{}).進行 || '';
// アプリで入力できる工程。終わった工程は締める（さかのぼって直さない。直すときはスプレッドシートで）
//   wait：今の工程の配布待ち（担当・納期・IN）／in：作業中・チェック中（担当・納期・IN・UP）／plan：先の工程（担当・納期の予定）
function editMode(d, sid){
  if(d.phase==='done') return null;
  const i = d.route.indexOf(sid), cur = d.route.indexOf(d.sid);
  if(i < cur) return null;
  if(i > cur) return 'plan';
  return d.phase==='wait' ? 'wait' : d.phase==='in' ? 'in' : null;
}
// 前の工程が上がった日（IN はこれより前にできない）
function prevUp(d, sid){
  const i = d.route.indexOf(sid); if(i<=0) return null;
  const x = d.cells[d.route[i-1]] || {}; return x.rup || x.up || null;
}
function statusOf(d){
  if(d.phase==='done') return {k:'done', t:'完了'};
  if(d.phase==='review') return {k:'review', t:'確認待ち'};
  if(d.ret && d.phase==='in') return {k:'retake', t:'差し戻し中'};
  if(d.open && d.phase==='in') return {k:'retake', t:'リテイク中'};
  if(d.phase==='in') return {k:'in', t: ST[d.sid].kind==='work' ? '作業中' : 'チェック中'};
  return {k:'wait', t:'配布待ち'};
}
// 「仕上げの配布待ち」のように、工程と状態を1つにした言い方
function stateText(d){ return d.phase==='done' ? '完了' : `${nameOf(d.sid)}の${statusOf(d).t}`; }
// 確認OK のあとに進む工程
function nextOf(d){
  if(d.phase!=='review') return d.sid;
  if(d.open && d.sid===d.open.target) return d.open.raised;
  const i = d.route.indexOf(d.sid); return i+1<d.route.length ? d.route[i+1] : null;
}

// 配布のとき自動で入る内容。確認OK のときに決めた相手・納期があればそれ、チェック工程は話数の担当、作業は発注書から。見つからなければ null
function autoIn(cutId, d){
  const c = cutById(cutId), st = ST[d.sid];
  if(d.next && d.next.person) return {person:d.next.person, src:'', due:d.next.due||null, dueSrc:''};
  // 進行管理で先に決めておいた担当・納期
  const pre = d.cells[d.sid] || {};
  if(!pre.in && pre.person) return {person:pre.person, src:'', due:pre.due||null, dueSrc:''};
  if(st.who!=='worker'){ const p = staffFor(c, st.id); return p ? {person:p, src:SRC_CALC, due:(d.next&&d.next.due)||null, dueSrc:''} : null; }
  const x = findOrderLine(cutId, st.id);
  if(!x) return null;
  return {person:x.o.vendor, src:SRC_AUTO, po:x.o.no, poLine:x.li, due:(d.next&&d.next.due)||x.o.due||null, dueSrc:(d.next&&d.next.due)?'':SRC_AUTO, sheets:x.l.sheets ?? null, sheetsSrc:SRC_AUTO};
}

// 変更はすべてここを通る。今の状態で許される操作かを確かめてから追記する
function act(cutId, type, o={}, ts=clock()){
  const d = derive(cutId), st = ST[d.sid];
  const fail = m => ({ok:false, msg:m});
  if(type==='IN'  && d.phase!=='wait') return fail('このカット袋は配布待ちではありません。');
  if(type==='UP'  && d.phase!=='in')   return fail('このカット袋は作業中・チェック中ではないので回収できません。');
  if(type==='OK'  && d.phase!=='review') return fail('確認待ちのカット袋ではありません。');
  if(type==='RETURN' && d.phase!=='review') return fail('差し戻しは、確認待ちのカット袋から行えます。');
  if(type==='RETAKE' && !(d.phase==='review' && st.kind==='check')) return fail('リテイクは、チェック工程から回収したカット袋で登録します。');
  const q = activeQr(cutId);
  const ev = {no:++S.seq, ts, ets:o.ets||ts, cut:cutId, qr:o.qr || (q ? q.token : ''), type, op:OPERATOR, note:o.note||''};
  if(o.late) ev.late = true;
  if(type==='IN'){
    ev.stage = d.sid; ev.person = o.person; ev.src = o.src || '';
    if(o.due){ ev.due = o.due; ev.dueSrc = o.dueSrc || ''; }
    if(o.po){ ev.po = o.po; ev.poLine = o.poLine; }
    if(o.provisional) ev.provisional = true;
    if(o.sheets!=null){ ev.sheets = o.sheets; ev.sheetsSrc = o.sheetsSrc || ''; }
  } else if(type==='UP'){
    ev.stage = d.sid; ev.person = d.holder;
  } else if(type==='OK'){
    ev.stage = d.sid;
    if(o.next && (o.next.person || o.next.due)) ev.next = {person:o.next.person||'', due:o.next.due||null};
    if(o.sheets!=null && o.sheets!=='') ev.sheets = Number(o.sheets);
  } else if(type==='RETURN'){
    ev.stage = d.sid; ev.person = d.from || '';
    if(o.due) ev.due = o.due;
    ev.rt = {id:'D'+String(++S.retSeq).padStart(3,'0'), kind:'差し戻し', stage:d.sid, reason:o.reason||'', by:''};
  } else if(type==='RETAKE'){
    ev.stage = o.target;
    ev.person = o.person || (d.cells[o.target]||{}).person || staffFor(cutById(cutId), o.target) || '';
    if(o.due) ev.due = o.due;
    ev.rt = {id:'R'+String(++S.rtSeq).padStart(3,'0'), kind:'リテイク', raised:d.sid, by:d.from || '', target:o.target, reason:o.reason||''};
  } else if(type==='VOID'){
    ev.voidOf = o.voidOf; const t = S.events.find(e=>e.no===o.voidOf); ev.stage = t.stage;
  } else if(type==='SET'){
    ev.stage = o.stage; ev.field = o.field; ev.value = o.value;
  } else if(type==='ROUTE'){
    ev.route = o.route; ev.stage = o.stage || d.sid;
  } else {
    ev.stage = d.sid;
  }
  S.events.push(ev);
  return {ok:true, ev, before:d, after:derive(cutId)};
}
// カット袋を読んだときの操作：配布待ち→配布、作業中・チェック中→回収
function defaultAct(cutId, extra={}, ts){
  const d = derive(cutId);
  if(d.phase==='done') return {ok:false, msg:'このカットは完了しています。'};
  if(d.phase==='wait'){ const a = autoIn(cutId, d); if(!a) return {ok:false, need:'order'}; return act(cutId,'IN',{...a, ...extra}, ts); }
  if(d.phase==='review') return {ok:false, msg:'確認待ちのカット袋です。'};
  return act(cutId,'UP',extra, ts);
}
/* ================= 通知（マイページ） ================= */
// 進行が手を打たないと進まないもの
function notices(){
  const out = [], now = clock(), linked = linkedLines(), v = voidedSet();
  S.cuts.forEach(c=>{
    const d = derive(c.id); if(d.phase==='done') return;
    if(d.overdue) out.push({k:'due', cut:c, text:`${nameOf(d.sid)}の納期（${fD(d.due)}）を過ぎています。${d.holder}`});
    if(d.phase==='review' && now - d.since >= 2*DAY) out.push({k:'review', cut:c, text:`${nameOf(d.sid)}を ${fD(d.since)} に回収してから、確認が終わっていません`});
    if(d.open && d.phase==='in' && now - d.open.ts >= 3*DAY) out.push({k:'retake', cut:c, text:`リテイク（${nameOf(d.open.target)}）が ${fD(d.open.ts)} から戻っていません`});
  });
  orderLines().filter(x=>!x.cut && !linked.get(x.o.no+'|'+x.li)).forEach(x=>out.push({k:'order', cut:null, text:`発注番号 ${x.o.no}（${x.o.ep}・${x.o.work}・${x.o.vendor}）の「${x.l.text}」に当たるカットがありません`}));
  S.events.forEach(e=>{
    if(v.has(e.no)) return;
    if(e.type==='REQ') out.push({k:'req', cut:cutById(e.cut), text:e.note});
    if(e.type==='ALERT' && now - e.ts < 7*DAY) out.push({k:'qr', cut:cutById(e.cut), text:`旧ラベル（使えなくしたQR）が ${fDT(e.ts)} に読まれました`});
  });
  return out;
}

/* ================= カット袋のQRのID ================= */
// QRの中身は「CUTBAG:」＋ID（8文字）。ID は「Q」＋6文字＋確認用の1文字。
// 確認用の1文字は前の7文字から計算する（Luhn mod 34）。1文字の読み違い・隣どうしの入れ替わりは、形式に合わなくなる
const ID_CHARS = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';   // I・O は 1・0 と紛らわしいので使わない
function idCheck(body){
  const n = ID_CHARS.length; let sum = 0, f = 2;
  for(let i=body.length-1; i>=0; i--){ const a = f * ID_CHARS.indexOf(body[i]); sum += Math.floor(a/n) + a%n; f = f===2 ? 1 : 2; }
  return ID_CHARS[(n - sum%n) % n];
}
const isCutbagId = id => /^Q[0-9A-HJ-NP-Z]{7}$/.test(id) && idCheck(id.slice(0,7))===id[7];
const qrText = id => 'CUTBAG:' + id;
// 読み取った文字列からカット袋のIDを取り出す。形式に合わないもの（ほかのQRコード）は null
function cutbagIdOf(text){
  const m = /^CUTBAG:([0-9A-Z]{8})$/.exec(String(text||'').trim().toUpperCase());
  return m && isCutbagId(m[1]) ? m[1] : null;
}
function newCutbagId(){
  const r = new Uint32Array(6); crypto.getRandomValues(r);
  const body = 'Q' + Array.from(r, x=>ID_CHARS[x % ID_CHARS.length]).join('');
  return body + idCheck(body);
}
// デモのQRのIDは固定（印刷したQRコードを、初期データを作り直しても使い続けられるように）。#01 の C001〜C015 の順、最後は C005 の再発行分
const FIXED_QR = ['Q7K2M9A','QX4P8DL','Q3N6T1R','QH8W2CE','QB5J7VY','Q9F3K6S','QM2R8XT','QD6Y4NB','QT1G9HP','QL7C3WK','QR4V8JD','QE9S2MZ','QW5H6QA','QN3B7FX','QC8Z1LU','QP6D4GR'].map(b=>b+idCheck(b));
// まだどのカットにも紐づいていない予備のQR（読み取ると「カット袋の登録」になる）。どのPJでも使える
const SPARE_QR = ['QS4K8TA','QS7M2PD','QS9R3XE','QS2V6NH','QS5W8JL','QS3B9QM','QS6C1ZR','QS8F4YU'].map(b=>b+idCheck(b));

/* ================= 初期データ ================= */
function seedEps(){
  return [
    {ep:'#01', staff:{演出:'川上（演出）', 監督:'北村（監督）', 作監:{A:'西村（作監）', B:'中島（作監）'}, 総作監:'南（総作監）', キャラデ総作監:'南（総作監）', 動検:'大野（動検）', セル検:'村井（セル検）', 撮影:'内田 翔', 進行:'弁天太郎（制作進行）'}},
    {ep:'#02', staff:{演出:'佐藤（演出）', 監督:'北村（監督）', 作監:{A:'中島（作監）', B:'西村（作監）'}, 総作監:'南（総作監）', キャラデ総作監:'南（総作監）', 動検:'石田（動検）', セル検:'村井（セル検）', 撮影:'内田 翔', 進行:'毘沙門次郎（制作進行）'}},
  ];
}
function seed(){
  S = {title:'サンプル作品', code:'SMP', eps:seedEps(), cuts:[], qrs:[], events:[], orders:[], people:[], seq:0, rtSeq:0, retSeq:0, poSeq:0};
  let tokN = 0;
  const tok = () => FIXED_QR[tokN++];
  const now = Date.now();
  const R = (...add) => DEFAULT_ROUTE.concat(add).sort((a,b)=>ORDER[a]-ORDER[b]);
  const defs = [
    // 話数, no, パート, 秒, 通す工程, 到達工程, 状態（in=作業中・チェック中／review=回収済み・確認待ち／wait=配布待ち）, 開始（何日前）, 最終（何日前）
    ['#01','C001','A','3+12', R('LOKAN'),  'DONE',  '',      30, 2],
    ['#01','C002','A','5+00', R(),         'HONSATSU','in',  28, 1],
    ['#01','C003','A','2+18', R(),         'GENEN', 'wait',  20, 1.2],
    ['#01','C004','A','6+06', R(),         'GEN',   'in',    24, 0.6],
    ['#01','C005','B','4+00', R(),         'DOU',   'in',    22, 1],
    ['#01','C006','B','3+06', R('GENSOSK'),'GENSK', 'in',    21, 0.7],
    ['#01','C007','B','7+12', R(),         'GENSK', 'in',    18, 0.5],
    ['#01','C008','B','1+18', R('GENSOSK'),'GENSOSK','in',   16, 0.4],
    ['#01','C009','C','3+00', R(),         'LO',    'wait',   0, 0],
    ['#01','C010','C','2+12', R(),         'SHIAGE','wait',  25, 1.5],
    ['#01','C011','C','4+18', R(),         'DOKEN', 'review',23, 0.8],
    ['#01','C012','C','2+00', R(),         'LO',    'wait',   0, 0],
    ['#01','C013','A','1+12', R(),         'LO',    'wait',   0, 0],
    ['#01','C014','B','2+06', R(),         'LO',    'wait',   0, 0],
    ['#01','C015','C','3+18', R(),         'LO',    'wait',   0, 0],
    ['#02','C001','A','2+00', R(),         'LO',    'in',    10, 9],
    ['#02','C002','A','3+12', R(),         'LO',    'in',     6, 4],
    ['#02','C003','B','4+06', R(),         'LOEN',  'review', 9, 1],
    ['#02','C004','B','1+18', R(),         'LO',    'wait',   0, 0],
    ['#02','C005','C','2+12', R(),         'LO',    'wait',   0, 0],
    ['#02','C006','C','5+00', R(),         'LO',    'wait',   0, 0],
  ];
  const partWorker = {A:0,B:1,C:2};
  const workerFor = (sid, part) => { const w = WORKERS[sid]; return w ? w[Math.min(partWorker[part], w.length-1)] : ''; };
  defs.forEach(([ep,no,part,sec,route,tgt,phase,a,b])=>{
    const id = cutIdOf(ep, no);
    const c = {id, no, ep, part, sec, route, sk:{LO:part==='B'?'B':'A', 原画:part==='B'?'B':'A'}};
    S.cuts.push(c);
    if(ep==='#01') S.qrs.push({token:tok(), cut:id, status:'active', issued: now-(a+3)*DAY});
    const ti = tgt==='DONE' ? route.length : route.indexOf(tgt);
    const ops = [];
    const inOf = sid => ST[sid].who==='worker' ? {person:workerFor(sid, part), src:SRC_AUTO, work:true} : {person:staffFor(c, sid), src:SRC_CALC};
    for(let k=0; k<ti; k++){ const sid = route[k]; ops.push(['IN', inOf(sid)], ['UP',{}], ['OK',{}]); }
    if(ti<route.length && (phase==='in' || phase==='review')){ ops.push(['IN', inOf(route[ti])]); if(phase==='review') ops.push(['UP',{}]); }
    ops.forEach(([type,o],k)=>{
      const ts = now - (a - (a-b)*(ops.length<=1?1:k/(ops.length-1)))*DAY - 3600e3*((k*7)%5);
      act(id, type, {...o, due: type==='IN' ? ts+5*DAY : null, dueSrc: o.work ? SRC_AUTO : ''}, ts);
    });
  });
  const byNo = (no, ep='#01') => cutByNo(no, ep).id;
  const rebuild = (cutId, script) => { S.events = S.events.filter(e=>e.cut!==cutId); for(const [type,o,daysAgo] of script) act(cutId, type, o, now-daysAgo*DAY); };
  const W = (person, daysAgo) => ({person, src:SRC_AUTO, due:now-daysAgo*DAY, dueSrc:SRC_AUTO});
  const C = (sid, cutNo) => ({person:staffFor(cutById(byNo(cutNo)), sid), src:SRC_CALC, due:null});
  // C004：過去に閉じたリテイクがある（LO作監 → LO）
  const c4 = byNo('C004');
  rebuild(c4, [
    ['IN',W('青木 瞳',19),24],['UP',{},20],['OK',{},19.8],['IN',C('LOEN','C004'),19.5],['UP',{},18.2],['OK',{},18],['IN',C('LOSK','C004'),17.5],['UP',{},17.2],
    ['RETAKE',{target:'LO', reason:'設定・キャラ表違い', note:'衣装の柄が設定と違う', due:now-15*DAY},17],
    ['UP',{},14],['OK',{},13.8],['IN',C('LOSK','C004'),13.5],['UP',{},13.2],['OK',{},13],['IN',W('青木 瞳',-1),6],
  ]);
  // C007：リテイク対応中（原画作監 → 原画）
  const c7 = byNo('C007');
  rebuild(c7, [
    ['IN',W('森田 健吾',13),18],['UP',{},15],['OK',{},14.8],['IN',C('LOEN','C007'),14.5],['UP',{},14.2],['OK',{},14],['IN',C('LOSK','C007'),13.5],['UP',{},13.2],['OK',{},13],
    ['IN',W('森田 健吾',6),12],['UP',{},5],['OK',{},4.8],['IN',C('GENEN','C007'),4.5],['UP',{},4.2],['OK',{},4],['IN',C('GENSK','C007'),3.2],['UP',{},0.8],
    ['RETAKE',{target:'GEN', reason:'作画修正', note:'ラスト3枚の芝居が硬い', due:now+2*DAY},0.5],
  ]);
  // C005：ラベル破損で再発行済み。旧QRは使えない
  const c5 = byNo('C005'), q5 = activeQr(c5);
  q5.status = 'revoked'; q5.revoked = now-8*DAY; q5.reason = 'ラベル破損のため再発行';
  S.qrs.push({token:tok(), cut:c5, status:'active', issued:now-8*DAY, prev:q5.token});
  S.events.sort((x,y)=>x.ts-y.ts); S.events.forEach((e,i)=>e.no=i+1); S.seq = S.events.length;
  let r = 0; S.events.forEach(e=>{ if(e.type==='RETAKE'){ e.rt.id = 'R'+String(++r).padStart(3,'0'); } }); S.rtSeq = r;

  // 発注書（読み取り専用で取り込んだもの）。これまでの配布は、作業者×作業内容×話数ごとの発注書に紐づける
  const newOrder = (sid, vendor, ep, date, due, lines) => { const w = WORK[sid]; const o = {no:'1012600'+pad(++S.poSeq), date, staff:'弁天', vendor, stage:sid, ep, work:w.name, unit:w.unit, price:w.price, due, lines}; S.orders.push(o); return o; };
  const sheetsOf = (cutNo, sid) => sid==='DOU' || sid==='SHIAGE' ? 30 + (Number(cutNo.slice(1))*7)%25 : null;
  const groups = new Map();
  S.events.forEach(e=>{ if(e.type!=='IN' || !ST[e.stage].po) return; const c = cutById(e.cut); const k = e.stage+'|'+e.person+'|'+c.ep; if(!groups.has(k)) groups.set(k,[]); groups.get(k).push(e); });
  groups.forEach(evs=>{
    const e0 = evs[0], c0 = cutById(e0.cut);
    const o = newOrder(e0.stage, e0.person, c0.ep, Math.min(...evs.map(e=>e.ts))-DAY, Math.max(...evs.map(e=>e.due||e.ts)), []);
    evs.forEach(e=>{ const c = cutById(e.cut), t = String(Number(c.no.slice(1))); let li = o.lines.findIndex(l=>l.text===t);
      if(li<0){ o.lines.push({text:t, sheets:sheetsOf(c.no, e.stage)}); li = o.lines.length-1; }
      e.po = o.no; e.poLine = li; if(o.lines[li].sheets!=null){ e.sheets = o.lines[li].sheets; e.sheetsSrc = SRC_AUTO; } });
  });
  // これから配布するカットの発注書（発注は作業より先に出ている）
  newOrder('LO', '青木 瞳', '#01', now-2*DAY, now+6*DAY, [{text:'13', sheets:null}]);
  newOrder('LO', '森田 健吾', '#01', now-2*DAY, now+6*DAY, [{text:'14', sheets:null}]);
  newOrder('LO', '高橋 さくら', '#01', now-2*DAY, now+12*DAY, [{text:'9', sheets:null}, {text:'15', sheets:null}]);
  // C012 を「21」と書き間違えた追加発注（書き間違いの例）
  newOrder('LO', '高橋 さくら', '#01', now-1*DAY, now+24*DAY, [{text:'21', sheets:null}]);
  newOrder('GEN', '青木 瞳', '#01', now-1*DAY, now+24*DAY, [{text:'13', sheets:null}]);
  newOrder('GEN', '森田 健吾', '#01', now-1*DAY, now+24*DAY, [{text:'14', sheets:null}]);
  newOrder('GEN', 'スタジオ北斗（外注）', '#01', now-1*DAY, now+24*DAY, [{text:'15', sheets:null}]);
  newOrder('SHIAGE', '堀 奈々', '#01', now-2*DAY, now+25*DAY, [{text:'10', sheets:sheetsOf('C010','SHIAGE')}]);
  newOrder('LO', '森田 健吾', '#02', now-1*DAY, now+10*DAY, [{text:'4', sheets:null}, {text:'5', sheets:null}, {text:'6', sheets:null}]);
}

function qrSvg(text){
  try{
    const q = qrcode(0,'M'); q.addData(text); q.make();
    return q.createSvgTag({cellSize:2, margin:0, scalable:true});
  }catch(e){ return '<svg viewBox="0 0 10 10"><rect width="10" height="10" fill="#000"/></svg>'; }
}

/* ================= スプレッドシートの表 ================= */
// 文字の色（誰が書いたか）と背景の色（状態）
const FONT = {auto:'#1D4ED8', calc:'#15803D', muted:'#6B7280'};
const BG = {wait:'#E3EBFB', in:'#DDF3E4', review:'#EEE6FA', retake:'#FDE2D5', done:'#EEF0F3', stale:'#FCE3BF', over:'#FAD4D4', head:'#E8EDF5'};
const fontOf = src => FONT[src] || '';
// 表を作る道具：行ごとに {v, f（文字の色）, b（背景の色）} を並べる
function table(head, rows, opt={}){
  const values = [], font = [], bg = [], strike = [];
  const put = (cells, r) => { values.push(cells.map(x=>x.v ?? '')); font.push(cells.map(x=>x.f||'')); bg.push(cells.map(x=>x.b||'')); if(r && r.strike) strike.push(values.length-1); };
  (opt.heads || [head]).forEach(h=>put(h.map(v=>({v, b:BG.head}))));
  rows.forEach(r=>put(r.cells, r));
  return {values, font, bg, strike, merges:opt.merges||[], freeze:(opt.heads||[head]).length, freezeCols:opt.freezeCols ?? 1, protect:!!opt.protect};
}
// 話数ごとの進捗表の列（Excel の進捗表と同じ並び。各工程に担当と納期を足している）
function progColumns(){
  const cols = [];
  const add = (g, h, get, key) => cols.push({g, h, get, key:key||null});
  ['C＃','パート'].forEach((h,i)=>add('', h, (c)=>({v: i ? c.part : c.no})));
  add('', 'LO担当', (c,d)=>{ const x = d.cells.LO||{}; return {v:x.person||'', f:fontOf(x.personSrc)}; }, 'LO|person');
  ['兼用','特効','2D','3D','3DLO','写真LO','全セル','BG ONLY','設計戻し','セルBANK','再撮BANK','編集BANK','欠番','備考'].forEach(h=>add('', h, ()=>({v:''})));
  add('', '現状', (c,d)=>({v:stateText(d), f:FONT.calc, b:BG[d.stale && d.phase==='in' ? 'stale' : statusOf(d).k]}));
  const now = clock(), today = startOfDay(now);
  GROUPS.forEach(g=>{
    STAGES.filter(s=>s.g===g).forEach(s=>{
      const x = (c,d) => d.cells[s.id] || {};
      const on = (c,d) => d.route.includes(s.id);
      if(s.who==='sakkan') add(g, `${s.name}（記号）`, (c,d)=>({v: on(c,d) ? ((c.sk||{})[s.g]||'') : ''}));
      if(s.who==='worker' && s.id!=='LO') add(g, `${s.name}作業者`, (c,d)=>({v:x(c,d).person||'', f:fontOf(x(c,d).personSrc)}), `${s.id}|person`);
      add(g, `${s.name}IN`, (c,d)=>({v:fD(x(c,d).in)}), `${s.id}|in`);
      // IN から7日たっても UP が空なら、UP のセルに色を付ける（Excel と同じ）
      add(g, `${s.name}UP`, (c,d)=>{ const y = x(c,d); return {v:fD(y.up), b: y.in && !y.up && now - y.in >= 7*DAY ? BG.stale : ''}; }, `${s.id}|up`);
      add(g, `${s.name}納期`, (c,d)=>{ const y = x(c,d), open = (y.rin ? !y.rup : !y.up); return {v:fD(y.due), f:fontOf(y.dueSrc), b: y.due && open && y.due < today && (y.in||y.rin) ? BG.over : ''}; }, `${s.id}|due`);
      if(s.kind==='check') add(g, `${s.name}リテイク中`, (c,d)=>({v:fD(x(c,d).rtc), b:x(c,d).rtc ? BG.retake : ''}));
      add(g, `${s.name}リテイクIN`, (c,d)=>({v:fD(x(c,d).rin), b: x(c,d).rin && !x(c,d).rup ? BG.retake : ''}), `${s.id}|rin`);
      add(g, `${s.name}リテイクUP`, (c,d)=>({v:fD(x(c,d).rup)}), `${s.id}|rup`);
      if(s.kind==='work') add(g, `${s.name}枚数`, (c,d)=>({v:x(c,d).sheets ?? '', f:fontOf(x(c,d).sheetsSrc)}), `${s.id}|sheets`);
    });
    (SIDE_COLS[g]||[]).forEach(h=>add(g, h, ()=>({v:''})));
  });
  add('本撮', 'CT撮線撮尺（秒）', (c)=>({v:String(c.sec||'').split('+')[0]||'', f:FONT.calc}));
  add('本撮', 'CT撮線撮尺（コマ）', (c)=>({v:String(c.sec||'').split('+')[1]||'', f:FONT.calc}));
  add('本撮', 'DB前撮線撮尺（秒）', ()=>({v:''}));
  add('本撮', 'DB前撮線撮尺（コマ）', ()=>({v:''}));
  add('本撮', '本撮備考', ()=>({v:''}));
  return cols;
}
function progTable(ep){
  const cols = progColumns();
  const row1 = [], merges = [];
  cols.forEach((c,i)=>{ row1.push(i>0 && cols[i-1].g===c.g ? '' : c.g); });
  for(let i=0; i<cols.length; ){ let j=i; while(j+1<cols.length && cols[j+1].g===cols[i].g) j++; if(cols[i].g && j>i) merges.push([0, i, j-i+1]); i = j+1; }
  const cuts = S.cuts.filter(c=>c.ep===ep).sort((a,b)=>a.no.localeCompare(b.no));
  const rows = cuts.map(c=>{ const d = derive(c.id); return {cells: cols.map(col=>col.get(c, d))}; });
  const t = table(null, rows, {heads:[row1, cols.map(c=>c.h)], merges, freezeCols:1});
  // スプレッドシートで直接直したとき、どのカットのどの工程の値かを Apps Script が分かるように
  t.map = {cols: cols.map(c=>c.key), cuts: cuts.map(c=>c.id)};
  return t;
}
function orderRowStatus(x, linked){
  if(!x.cut){ const lk = linked.get(x.o.no+'|'+x.li); return lk ? {t:`仮紐づけ（${cutById(lk).no}）`, k:'stale'} : {t:'カットNo.不明', k:'over'}; }
  const d = derive(x.cut);
  const inDone = d.evs.some(e=>e.type==='IN' && e.stage===x.o.stage);
  if(!inDone) return {t:'未配布', k:'wait'};
  if(d.sid===x.o.stage && d.phase==='review') return {t:'回収済（確認待ち）', k:'review'};
  const passed = d.phase==='done' || d.route.indexOf(d.sid) > d.route.indexOf(x.o.stage);
  return passed ? {t:'確認OK', k:'in'} : {t:'配布済', k:'in'};
}
const FIELD_NAME = {in:'IN', up:'UP', due:'納期', person:'担当', sheets:'枚数', rin:'リテイクIN', rup:'リテイクUP'};
const TYPE_NAME = {IN:'配布', UP:'回収', OK:'確認OK', RETURN:'差し戻し', RETAKE:'リテイク', VOID:'取り消し', ALERT:'旧ラベル', LINK:'QR登録', SET:'入力', ROUTE:'工程の追加・削除', REQ:'発注書の更新依頼'};
function buildTables(){
  const out = {};
  epsOf().forEach(ep=>{ out[ep] = progTable(ep); });
  // 発注管理（発注書から取り込んだもの。発注書は書き換えない）
  {
    const head = ['発注番号','発注日','発注先','作業内容','話数','カットNo.（記載）','紐づけ','枚','単価方式','単価','金額','納品期日','状態'];
    const linked = linkedLines(), A = FONT.auto, Cc = FONT.calc;
    const rows = orderLines().map(x=>{ const s = orderRowStatus(x, linked); const lk = linked.get(x.o.no+'|'+x.li); const cutNo = x.cut ? cutById(x.cut).no : (lk ? cutById(lk).no : '');
      const amt = x.o.unit==='枚' ? (x.l.sheets||0)*x.o.price : x.o.price;
      return {cells:[{v:x.o.no,f:A},{v:fD(x.o.date),f:A},{v:x.o.vendor,f:A},{v:x.o.work,f:A},{v:x.o.ep,f:A},{v:x.l.text,f:A},{v:cutNo,f:Cc},{v:x.l.sheets??'',f:A},{v:x.o.unit+'単価',f:A},{v:x.o.price.toLocaleString(),f:A},{v:amt.toLocaleString(),f:Cc},{v:fD(x.o.due),f:A},{v:s.t,f:Cc,b:BG[s.k]}]}; });
    out['発注管理（取込）'] = table(head, rows);
  }
  // 履歴ログ（1件1行。リテイク・差し戻しも、ここに理由・指摘した人・納期を書く）
  {
    const head = ['No','実施日時','入力日時','話数','C＃','操作','工程','担当','納期','発注番号','リテイク','理由','指摘した工程','指摘した人','備考','入力者','経路'];
    const voided = voidedSet();
    const rows = S.events.map(e=>{ const c = cutById(e.cut) || {};
      const rt = e.rt || null;
      const stg = e.type==='SET' ? `${nameOf(e.stage)}（${FIELD_NAME[e.field]||e.field}）` : nameOf(e.stage);
      const note = e.type==='VOID' ? `No.${e.voidOf} を取り消し` : e.type==='SET' ? `${['due','in','up','rin','rup'].includes(e.field) ? (fD(e.value)||'空') : (e.value ?? '空')} にした` : e.type==='ROUTE' ? `工程：${e.route.map(nameOf).join('→')}` : e.note;
      return {strike:voided.has(e.no), cells:[{v:e.no},{v:fDT(e.ts)},{v:e.late?fDT(e.ets):''},{v:c.ep||''},{v:c.no||''},{v:TYPE_NAME[e.type]||e.type, b: rt ? BG.retake : e.type==='ALERT' ? BG.over : ''},
        {v:stg},{v:['IN','RETAKE','RETURN'].includes(e.type)?e.person:'', f: e.type==='IN' ? fontOf(e.src) : ''},{v:fD(e.due), f: e.type==='IN' ? fontOf(e.dueSrc) : ''},{v:e.po?(e.po+(e.provisional?'（仮）':'')):''},
        {v:rt?rt.id:''},{v:rt?rt.reason:''},{v:rt ? nameOf(rt.raised||rt.stage) : ''},{v:rt ? (rt.by||'') : ''},{v:note||''},{v:e.op},{v:e.via==='sheet'?'スプレッドシート':'アプリ'}]}; });
    out['履歴ログ'] = table(head, rows);
  }
  // 話数の担当（演出・監督・作監の記号など。チェック工程の担当はここから決まる）
  {
    const roleCols = ['演出','演出助手','副監督','監督','アクション作監','エフェクト作監','メカ作監', ...SK_LETTERS.map(k=>'作監'+k), '総作監','キャラデ総作監','動検','セル検','撮影','進行'];
    const rows = (S.eps||[]).map(e=>({cells:[{v:e.ep}, ...roleCols.map(r=>({v: r.startsWith('作監') && r.length===3 ? ((e.staff.作監||{})[r[2]]||'') : (e.staff[r]||'')}))]}));
    out['話数の担当'] = table(['話数', ...roleCols], rows);
  }
  // QR管理（QR のIDから、作品・話数・カットが1つに決まる。人は書き換えない）
  {
    const head = ['QR ID','作品','話数','C＃','状態','発行日','無効化日','理由','旧QR'];
    const rows = S.qrs.map(q=>{ const c = cutById(q.cut) || {}; return {cells:[{v:q.token},{v:titleOf()},{v:c.ep||''},{v:c.no||''},{v:q.status==='active'?'有効':'無効', b:q.status==='active'?BG.in:BG.over},{v:fD(q.issued)},{v:fD(q.revoked)},{v:q.reason||''},{v:q.prev||''}]}; });
    out['QR管理'] = table(head, rows, {protect:true});
  }
  return out;
}
