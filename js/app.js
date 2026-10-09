/* ================= アプリ：担当PJ・スプレッドシートとの同期・カメラ・カット袋の登録 ================= */
// QRコードには個別のIDだけが入っている。どのPJ（スプレッドシート）のどのカットかは、各PJの「QR管理」で決まる。
// 端末には、そのスタッフが担当するPJを登録しておき、読み取ったIDがどのPJのものかをその場で探す。
const CFG_KEY = 'cutbagqr.cfg', dataKey = pid => 'cutbagqr.data.' + pid;
const DUMMY_OP = '東海林（制作進行）';
let cfg = {operator:OPERATOR, projects:[], current:null, lastReg:{}};
const PJ = {};   // PJの番号 → {S, sent, sync}
const store = {
  get(k){ try{ return JSON.parse(localStorage.getItem(k)); }catch(e){ return null; } },
  set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} },
  del(k){ try{ localStorage.removeItem(k); }catch(e){} },
};
const saveCfg = () => store.set(CFG_KEY, {operator:cfg.operator, current:cfg.current, lastReg:cfg.lastReg, names:Object.fromEntries(cfg.projects.map(p=>[p.id, p.name]))});
const projOf = pid => cfg.projects.find(p=>p.id===pid);
const curProj = () => projOf(cfg.current);
// core.js・phone.js は S を使うので、別のPJを扱うときは一時的に S を差し替える
function withS(s, fn){ const keep = S; S = s; try{ return fn(); } finally { S = keep; } }

/* ---------- Google スプレッドシート（Apps Script）との通信 ---------- */
let API_TIMEOUT = 60000;
async function api(p, action, payload={}){
  if(!p.endpoint) throw new Error('書き込み先が設定されていません');
  // Google 側が返事を返さずに止まることがある。60秒たったら届いていない扱いにして、送り直す（同じものを送り直しても重ならない）
  const ac = new AbortController(), timer = setTimeout(()=>ac.abort(), API_TIMEOUT);
  let j = null;
  try{
    const res = await fetch(p.endpoint, {method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body:JSON.stringify({action, key:p.key||'', ...payload}), redirect:'follow', signal:ac.signal});
    // Google 側の転送先が、ときどきエラーのページや doGet の返事を返す。そのときも届いていない扱いにして、送り直す
    try{ j = JSON.parse(await res.text()); }catch(e){}
  }catch(e){ if(ac.signal.aborted) throw new Error('スプレッドシートから返事がありませんでした'); throw e; }
  finally{ clearTimeout(timer); }
  if(!j || (j.action ? j.action!==action : 'message' in j) || (action==='load' && j.ok && !j.data)) throw new Error('スプレッドシートから返事がありませんでした');
  if(!j.ok) throw new Error(j.error || '書き込みに失敗しました');
  return j;
}
function makeState(d){
  const s = {cuts:d.cuts||[], qrs:d.qrs||[], orders:d.orders||[], events:(d.events||[]).sort((a,b)=>a.no-b.no), seq:0, rtSeq:0, retSeq:0, poSeq:(d.orders||[]).length, day:0};
  s.seq = s.events.reduce((m,e)=>Math.max(m,e.no||0), 0);
  s.events.forEach(e=>{ if(e.rt && e.rt.id){ const n=Number(String(e.rt.id).slice(1)); if(e.rt.id[0]==='R') s.rtSeq=Math.max(s.rtSeq,n); else s.retSeq=Math.max(s.retSeq,n); } });
  return s;
}
const rawOf = s => ({cuts:s.cuts, qrs:s.qrs, orders:s.orders, events:s.events});
const KEYS = {events:'no', cuts:'id', qrs:'token'};
function markSent(pid){ const p=PJ[pid]; p.sent = {events:new Map(), cuts:new Map(), qrs:new Map()}; Object.keys(KEYS).forEach(k=>p.S[k].forEach(x=>p.sent[k].set(x[KEYS[k]], JSON.stringify(x)))); }

/* ---------- 同期：変わったもの（履歴・カット・QR）だけを送り、表は作り直して送る ---------- */
function sync(){
  const pid = cfg.current, p = PJ[pid]; if(!p) return;
  store.set(dataKey(pid), rawOf(p.S));
  clearTimeout(p.timer); p.timer = setTimeout(()=>doSync(pid), 400);
}
async function doSync(pid){
  const p = PJ[pid], pr = projOf(pid);
  if(!p || !pr || !pr.endpoint){ if(p) p.sync.pending = 0; return; }
  if(p.syncing){ p.dirty = true; return; }
  p.syncing = true; p.dirty = false;
  const changed = {};
  Object.keys(KEYS).forEach(k=>{ changed[k] = p.S[k].filter(x=>p.sent[k].get(x[KEYS[k]])!==JSON.stringify(x)); });
  p.sync.pending = changed.events.length + changed.cuts.length + changed.qrs.length;
  try{
    await api(pr, 'upsert', {...changed, tables:withS(p.S, buildTables)});
    Object.keys(KEYS).forEach(k=>changed[k].forEach(x=>p.sent[k].set(x[KEYS[k]], JSON.stringify(x))));
    p.sync = {at:Date.now(), err:null, pending:0};
  }catch(err){ p.sync.err = err.message; setTimeout(()=>{ clearTimeout(p.timer); doSync(pid); }, 8000); }
  p.syncing = false;
  if(ui && ui.screen==='home') renderPhone();
  if(p.dirty) doSync(pid);
}
function syncLine(){
  const p = PJ[cfg.current], pr = curProj();
  if(!pr || !pr.endpoint) return `<p class="sync-line">端末内だけに保存しています</p>`;
  if(p.sync.err) return `<p class="sync-line bad">スプレッドシートに送れていません（${esc(p.sync.err)}）。自動でもう一度送ります</p>`;
  if(p.sync.pending) return `<p class="sync-line">スプレッドシートに送っています（${p.sync.pending}件）</p>`;
  return p.sync.at ? `<p class="sync-line ok">スプレッドシートに反映済み ${fDT(p.sync.at)}</p>` : '';
}
// 今のPJ。担当PJが2つ以上なら、押して切り替えられる
function pjLine(){
  const pr = curProj(); if(!pr) return '';
  return cfg.projects.length > 1
    ? `<button type="button" class="pj-chip" data-a="pjPick">PJ：${esc(pr.name)} <span aria-hidden="true">▾</span></button>`
    : `<p class="pj-chip static">PJ：${esc(pr.name)}</p>`;
}
function pjView(){
  return `<div class="sheetm" role="dialog" aria-label="PJ"><h4>PJ</h4>
    <div class="opts">${cfg.projects.map(p=>`<button type="button" class="opt pick${p.id===cfg.current?' sel':''}" data-pj="${esc(p.id)}">${esc(p.name)}</button>`).join('')}</div>
    <button class="linkbtn" data-a="closeModal">閉じる</button></div>`;
}
// スプレッドシートに書く表（デモの表と同じもの）
const SHEETS = [['prog','進捗表'],['master','①カット一覧'],['order','②発注管理（取込）'],['log','③履歴ログ'],['issues','要確認'],['retake','リテイク・差し戻し'],['daily','日報（自動）'],['qr','QR管理']];
function buildTables(){
  const out = {};
  SHEETS.forEach(([id, name])=>{
    const t = buildTab(id), values = [], fmt = [], merges = [];
    if(t.groups){ const row=[]; let col=0; t.groups.forEach(g=>{ row.push(g.n); for(let k=1;k<g.span;k++) row.push(''); if(g.span>1 && g.n) merges.push([0, col, g.span]); col+=g.span; }); values.push(row); fmt.push(row.map(()=>'head')); }
    values.push(t.head.map(h=>typeof h==='string' ? h : h.t)); fmt.push(t.head.map(()=>'head'));
    t.rows.forEach(r=>{ values.push(r.cells.map(c=>c.v ?? '')); fmt.push(r.cells.map(c=>((c.c||'')+(r.cls?' '+r.cls:'')).trim())); });
    out[name] = {values, fmt, merges, freeze: t.groups ? 2 : 1};
  });
  return out;
}

/* ---------- 担当PJ ---------- */
function seedState(){ const me = OPERATOR; OPERATOR = DUMMY_OP; const keep = S; seed(); const s = S; S = keep; OPERATOR = me; return s; }
function addPJ(p){ PJ[p.id] = {S: makeState(store.get(dataKey(p.id)) || {}), sent:null, sync:{at:null, err:null, pending:0}}; markSent(p.id); }
function useProject(pid, screen){
  cfg.current = pid; saveCfg(); S = PJ[pid].S;
  ui = screen==='scanner' ? {screen:'scanner', scan:{items:[]}} : {screen: screen || 'home'};
}
async function reload(pid, quiet){
  const pr = projOf(pid), p = PJ[pid]; if(!pr || !pr.endpoint) return;
  try{
    const j = await api(pr, 'load');
    if(j.name && pr.name!==j.name){ pr.name = j.name; saveCfg(); }
    p.S = makeState(j.data); markSent(pid); store.set(dataKey(pid), j.data);
    p.sync = {at:Date.now(), err:null, pending:0};
    if(pid===cfg.current) S = p.S;
  }catch(err){ p.sync.err = err.message; if(!quiet) flashToast(err.message); }
  if(!ui.modal && ['home','settings'].includes(ui.screen)) renderPhone();
}
// 初期データ（デモと同じダミーのカット・発注書・履歴）を作って、今のPJのスプレッドシートを作り直す
async function resetData(){
  const pid = cfg.current, p = PJ[pid], pr = curProj();
  p.S = seedState(); S = p.S; store.set(dataKey(pid), rawOf(p.S));
  if(pr.endpoint){
    ui.busy = '初期データを書き込んでいます…'; renderPhone();
    try{ await api(pr, 'reset', {data:rawOf(p.S), tables:buildTables()}); markSent(pid); p.sync = {at:Date.now(), err:null, pending:0}; ui.busy = null; flashToast('初期化しました'); }
    catch(err){ ui.busy = null; flashToast(err.message); }
  } else { markSent(pid); flashToast('初期化しました（端末内）'); }
  renderPhone();
}

/* ---------- 起動 ---------- */
// 担当PJ（スプレッドシート）の一覧は、システム側が config.json に書いておく。制作の方は設定しない
//   {"projects":[{"endpoint":"https://script.google.com/macros/s/…/exec", "key":""}]}
// PJ名はスプレッドシートの名前を使う。一覧がないときは、端末の中だけで動くデモになる
const pjIdOf = ep => 'pj-' + Array.from(ep).reduce((h,c)=>((h*31 + c.charCodeAt(0))>>>0), 7).toString(36);
async function boot(){
  let preset = {};
  try{ const r = await fetch('config.json', {cache:'no-store'}); if(r.ok) preset = await r.json(); }catch(e){}
  const saved = store.get(CFG_KEY) || {};
  cfg = {operator: saved.operator || OPERATOR, current: saved.current || null, lastReg: saved.lastReg || {}, projects: []};
  const list = (preset.projects || []).filter(p=>p && p.endpoint);
  const names = saved.names || {};
  cfg.projects = list.length
    ? list.map(p=>{ const id = pjIdOf(p.endpoint); return {id, name: p.name || names[id] || 'PJ', endpoint: p.endpoint, key: p.key || ''}; })
    : [{id:'local', name:'デモ（端末内）', endpoint:'', key:''}];
  if(!projOf(cfg.current)) cfg.current = cfg.projects[0].id;
  OPERATOR = cfg.operator;
  cfg.projects.forEach(addPJ);
  cfg.projects.forEach(p=>{ if(!p.endpoint && !PJ[p.id].S.cuts.length){ PJ[p.id].S = seedState(); store.set(dataKey(p.id), rawOf(PJ[p.id].S)); markSent(p.id); } });
  saveCfg();
  ui = {screen:'home'}; S = PJ[cfg.current].S;
  renderPhone();
  for(const p of cfg.projects) if(p.endpoint) await reload(p.id, true);
}

/* ---------- 設定の画面 ---------- */
// 制作の方が設定するのは入力者だけ。デモ用に、スプレッドシートの初期化をデバッグの欄に置く。QRの印刷は、URL の末尾に #admin を付けて開いたときだけ出す
const isAdmin = () => /admin/.test(location.hash + location.search);
function settingsView(){
  const pr = curProj(), s = PJ[cfg.current].S;
  return `<div class="appbar"><button class="back" data-a="home" aria-label="戻る">‹</button><h3>設定</h3>${who()}</div>
  <div class="body settings">
    <div class="field"><label class="lbl" for="cfgOp">入力者</label><input id="cfgOp" value="${esc(cfg.operator||'')}" placeholder="例：東海林（制作進行）"></div>
    <button type="button" class="act ghost" data-a="opSave">入力者を保存</button>
    <section class="home-sec"><h5>デバッグ（${esc(pr.name)}）</h5>
      <p class="mnote">カット ${s.cuts.length}件・QR ${s.qrs.filter(q=>q.status==='active').length}件・履歴 ${s.events.length}件</p>
      ${ui.confirmReset
        ? `<div class="confirm"><span>${esc(pr.name)} のスプレッドシートを、デモの初期データに作り直します。読み取った内容は消えます。</span><div class="row"><button class="btn" data-a="resetNo">やめる</button><button class="btn primary" data-a="resetYes">初期化する</button></div></div>`
        : `<button type="button" class="act ghost" data-a="resetAsk">スプレッドシートを初期化する</button>`}
      ${isAdmin() ? `<button type="button" class="act ghost" data-a="print">QRコードを印刷する</button>` : ''}
    </section>
    ${ui.busy ? `<p class="sync-line">${esc(ui.busy)}</p>` : ''}
  </div>`;
}

/* ---------- カット袋の登録（まだどのカットにも紐づいていないQRを読んだとき） ---------- */
const epsOf = s => [...new Set(s.cuts.map(c=>c.ep))].sort();
function nextCutNo(pid, ep){
  const last = cfg.lastReg[pid];
  if(last && last.ep===ep) return last.no + 1;
  const nums = PJ[pid].S.cuts.filter(c=>c.ep===ep).map(c=>Number(c.no.replace(/\D/g,''))||0);
  return (nums.length ? Math.max(...nums) : 0) + 1;
}
function openRegister(token){
  const pid = cfg.current, s = PJ[pid].S, last = cfg.lastReg[pid];
  const ep = (last && last.ep) || epsOf(s)[0] || '#01';
  ui = {screen:'register', reg:{token, pid, ep, no:nextCutNo(pid, ep), sec:''}, resume: ui.screen==='scanner' ? ui.scan : null};
  renderPhone();
}
function registerView(){
  const r = ui.reg, s = PJ[r.pid].S, eps = epsOf(s);
  const cutNo = 'C' + String(r.no||0).padStart(3,'0');
  const exist = s.cuts.find(c=>c.ep===r.ep && c.no===cutNo);
  const has = exist && s.qrs.find(q=>q.cut===exist.id && q.status==='active');
  return `<div class="appbar"><button class="back" data-a="regCancel" aria-label="戻る">‹</button><h3>カット袋の登録</h3>${who()}</div>
  <div class="body settings">
    <p class="mnote">まだどのカットにも紐づいていないQRコードです（${esc(r.token)}）。</p>
    <div class="field"><label class="lbl" for="regPj">PJ</label><select id="regPj">${cfg.projects.map(p=>`<option value="${esc(p.id)}"${p.id===r.pid?' selected':''}>${esc(p.name)}</option>`).join('')}</select></div>
    <div class="field"><label class="lbl" for="regEp">話数</label><input id="regEp" list="regEps" value="${esc(r.ep)}"><datalist id="regEps">${eps.map(e=>`<option value="${esc(e)}">`).join('')}</datalist></div>
    <div class="field"><label class="lbl" for="regNo">カット番号</label><input id="regNo" type="number" inputmode="numeric" min="1" value="${esc(r.no)}"></div>
    <div class="field"><label class="lbl" for="regSec">秒数（任意）</label><input id="regSec" value="${esc(exist ? exist.sec : r.sec)}" placeholder="例：3+12"></div>
    <div class="reg-big">${esc(r.ep)} <b>${esc(cutNo)}</b></div>
    ${has ? `<p class="sync-line bad">${esc(cutNo)} にはすでにQRがあります。登録すると、今のQR（${esc(has.token)}）は使えなくなります。</p>` : exist ? `<p class="mnote">${esc(cutNo)} はカット一覧にあります。このQRを紐づけます。</p>` : `<p class="mnote">${esc(cutNo)} をカット一覧に足して、このQRを紐づけます。</p>`}
    <button type="button" class="act" data-a="regSave">${has ? '付け替えて登録する' : '登録する'}</button>
  </div>`;
}
function readReg(){
  const r = ui.reg; const g = id => document.getElementById(id);
  r.pid = g('regPj').value; r.ep = g('regEp').value.trim() || '#01'; r.no = Math.max(1, Number(g('regNo').value)||1); r.sec = g('regSec').value.trim();
}
function linkQr(r){
  const s = PJ[r.pid].S, ts = clock(), cutNo = 'C' + String(r.no).padStart(3,'0');
  return withS(s, ()=>{
    let c = S.cuts.find(x=>x.ep===r.ep && x.no===cutNo);
    if(!c){ c = {id:`CUT-${r.ep.replace(/\D/g,'').padStart(2,'0')}-${cutNo}`, no:cutNo, ep:r.ep, part:'', sec:r.sec}; S.cuts.push(c); }
    else if(r.sec) c.sec = r.sec;
    const old = S.qrs.find(q=>q.cut===c.id && q.status==='active');
    if(old){ old.status = 'revoked'; old.revoked = ts; old.reason = '付け替え'; }
    S.qrs.push({token:r.token, cut:c.id, status:'active', issued:ts, ...(old ? {prev:old.token} : {})});
    S.events.push({no:++S.seq, ts, ets:ts, cut:c.id, qr:r.token, type:'LINK', op:OPERATOR, note: old ? `QRを付け替え（旧 ${old.token}）` : 'カット袋を登録'});
    return {c, old};
  });
}

// phone.js のボタンのうち、アプリだけにあるもの
function appAction(a, t){
  if(a==='settings'){ ui = {screen:'settings'}; renderPhone(); return true; }
  if(a==='opSave'){ cfg.operator = $('#cfgOp').value.trim() || OPERATOR; OPERATOR = cfg.operator; saveCfg(); flashToast('保存しました'); return true; }
  if(a==='pjPick'){ ui.modal = 'pj'; renderPhone(); return true; }
  if(a==='print'){ location.href = 'print.html'; return true; }
  if(a==='resetAsk'){ ui.confirmReset = true; renderPhone(); return true; }
  if(a==='resetNo'){ ui.confirmReset = false; renderPhone(); return true; }
  if(a==='resetYes'){ ui.confirmReset = false; resetData(); return true; }
  if(a==='regCancel'){ ui = ui.resume ? {screen:'scanner', scan:ui.resume} : {screen:'home'}; renderPhone(); return true; }
  if(a==='regSave'){
    readReg(); const r = ui.reg, resume = ui.resume;
    const {c, old} = linkQr(r);
    cfg.lastReg[r.pid] = {ep:r.ep, no:r.no}; saveCfg();
    const moved = r.pid!==cfg.current;
    if(moved){ cfg.current = r.pid; S = PJ[r.pid].S; saveCfg(); }
    sync();
    const item = {cutNo:c.no, text: old ? 'QRを付け替えました' : 'カット袋を登録しました', kind:'reg'};
    if(resume && !moved){ resume.items.push(item); ui = {screen:'scanner', scan:resume}; }
    else ui = {screen:'scanner', scan:{items:[item], seen:new Set([r.token])}};
    feedback(true); renderPhone(); return true;
  }
  if(a==='scan'){ unlockAudio(); return false; }
  return false;
}
// 登録の画面で PJ・話数を変えたら、カット番号の初期値を出し直す
document.addEventListener('change', e=>{
  if(!ui || ui.screen!=='register') return;
  if(['regPj','regEp'].includes(e.target.id)){ readReg(); ui.reg.no = nextCutNo(ui.reg.pid, ui.reg.ep); renderPhone(); }
  else if(e.target.id==='regNo'){ readReg(); renderPhone(); }
});
document.addEventListener('click', e=>{
  const pj = e.target.closest('[data-pj]');
  if(pj){ e.stopPropagation(); useProject(pj.dataset.pj, 'home'); renderPhone(); return; }
}, true);

/* ---------- カメラでQRコードを読む ---------- */
const cam = {stream:null, raf:0, busy:false, err:'', note:'', t:0, detector:null, canvas:null};
function camMsg(){
  if(ui.scanning) return '読み取り中…';
  if(cam.err) return esc(cam.err);
  if(!cam.stream) return 'カメラを起動しています…';
  if(cam.note) return esc(cam.note);
  return '';
}
// カメラの枠の中の文字だけを書き換える（読み取りの一覧は描き直さない）
function showCamMsg(){
  const f = document.querySelector('.finder'); if(!f) return;
  let el = f.querySelector('.ftext'); const m = camMsg();
  if(!m){ if(el) el.remove(); return; }
  if(!el){ el = document.createElement('span'); el.className = 'ftext'; f.appendChild(el); }
  el.innerHTML = m;
}
function camNote(msg){
  cam.note = msg; showCamMsg();
  clearTimeout(cam.noteT); cam.noteT = setTimeout(()=>{ cam.note = ''; showCamMsg(); }, 2000);
}
function afterRender(){
  if(ui.screen==='scanner') camStart(); else camStop();
}
async function camStart(){
  if(cam.stream){ attachCam(); return; }
  if(cam.starting) return;
  cam.starting = true; cam.err = '';
  try{
    if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('この環境ではカメラを使えません（HTTPS で開いてください）');
    cam.stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}, width:{ideal:1280}, height:{ideal:720}}, audio:false});
    if(ui.screen!=='scanner'){ camStop(); cam.starting = false; return; }
    if('BarcodeDetector' in window){ try{ cam.detector = new BarcodeDetector({formats:['qr_code']}); }catch(e){ cam.detector = null; } }
    attachCam(); loop();
  }catch(err){ cam.err = err.name==='NotAllowedError' ? 'カメラの使用が許可されていません。ブラウザの設定で許可してください' : (err.message || 'カメラを起動できません'); }
  cam.starting = false;
  if(ui.screen==='scanner') showCamMsg();
}
function attachCam(){
  const v = $('#cam'); if(!v || !cam.stream) return;
  if(v.srcObject !== cam.stream){ v.srcObject = cam.stream; v.play().catch(()=>{}); }
  showCamMsg();
}
function camStop(){
  if(cam.stream){ cam.stream.getTracks().forEach(t=>t.stop()); cam.stream = null; }
  cancelAnimationFrame(cam.raf); cam.raf = 0;
}
function loop(){
  cam.raf = requestAnimationFrame(loop);
  const now = performance.now(); if(now - cam.t < 150) return; cam.t = now;
  const v = $('#cam');
  if(!v || v.readyState < 2 || cam.busy || ui.modal || ui.screen!=='scanner' || ui.scanning) return;
  if(cam.detector){
    cam.busy = true;
    cam.detector.detect(v).then(list=>{ cam.busy = false; if(list && list.length) onCode(list[0].rawValue); }).catch(()=>{ cam.busy = false; cam.detector = null; });
    return;
  }
  const w = 480, h = Math.round(v.videoHeight * w / v.videoWidth) || 360;
  cam.canvas = cam.canvas || document.createElement('canvas');
  cam.canvas.width = w; cam.canvas.height = h;
  const ctx = cam.canvas.getContext('2d', {willReadFrequently:true});
  ctx.drawImage(v, 0, 0, w, h);
  const code = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, {inversionAttempts:'dontInvert'});
  if(code && code.data) onCode(code.data);
}
// 1回の読み取り（「QRコード読み取り」から「完了」まで）で読んだカット袋。同じカット袋は1回だけ登録する
const seenOf = sc => (sc.seen = sc.seen || new Set());
// 読み取ったIDが、どの担当PJのものかを探す（今のPJから）
function findProjectOf(token){
  const order = [cfg.current, ...cfg.projects.map(p=>p.id).filter(id=>id!==cfg.current)];
  for(const pid of order){ const q = PJ[pid] && PJ[pid].S.qrs.find(x=>x.token===token); if(q) return {pid, q}; }
  return null;
}
async function onCode(text){
  if(cam.busy || ui.screen!=='scanner' || !ui.scan) return;
  // カット袋のQR（CUTBAG:＋確認用の文字の合うID）だけを読む。ほかのQRコードは登録しない
  const token = cutbagIdOf(text);
  if(!token){ camNote('カット袋のQRコードだけ読み取れます'); return; }
  // カメラに映ったままでも、同じカット袋は1回だけ。もう一度読むときは「完了」してから読み直す
  if(seenOf(ui.scan).has(token)) return;
  seenOf(ui.scan).add(token);
  const hit = findProjectOf(token);
  if(!hit){ feedback(true); openRegister(token); return; }
  if(hit.pid!==cfg.current){
    const pr = projOf(hit.pid);
    if(ui.scan.items.length){
      const no = withS(PJ[hit.pid].S, ()=>cutById(hit.q.cut).no);
      ui.scan.items.push({cutNo:no, text:`別のPJ（${pr.name}）のカット袋です。「完了」してから読み直してください`, kind:'bad'});
      feedback(false); renderPhone(); return;
    }
    useProject(hit.pid, 'scanner'); seenOf(ui.scan).add(token); renderPhone(); flashToast(`PJ「${pr.name}」に切り替えました`);
  }
  cam.busy = true;
  feedback(hit.q.status==='active');
  try{ await scan(token); } finally { cam.busy = false; }
}
// 読み取ったときの音と振動（成功と、旧ラベル・別のPJで音を変える）
let actx = null;
function unlockAudio(){ try{ actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if(actx.state==='suspended') actx.resume(); }catch(e){} }
function feedback(ok){
  try{ if(navigator.vibrate) navigator.vibrate(ok ? 60 : [80,60,80]); }catch(e){}
  try{
    if(!actx) return;
    const o = actx.createOscillator(), g = actx.createGain();
    o.frequency.value = ok ? 1320 : 330; o.type = 'sine';
    g.gain.setValueAtTime(0.18, actx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + (ok ? 0.12 : 0.35));
    o.connect(g); g.connect(actx.destination); o.start(); o.stop(actx.currentTime + (ok ? 0.13 : 0.36));
  }catch(e){}
}

// ほかの端末・PCで変えた分を取り込むため、ホームを開いているあいだは時々読み直す
setInterval(()=>{ if(ui && ui.screen==='home' && !ui.modal){ const p = PJ[cfg.current]; if(p && !p.syncing && !p.sync.pending) reload(cfg.current, true); } }, 30000);
document.addEventListener('visibilitychange', ()=>{ if(document.hidden) camStop(); else if(ui && ui.screen==='scanner') camStart(); });
// Android アプリ（Capacitor）の中では端末のファイルから開くので、Service Worker は使わない
if('serviceWorker' in navigator && location.protocol==='https:' && !window.Capacitor) navigator.serviceWorker.register('sw.js').catch(()=>{});
boot();
