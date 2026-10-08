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
const saveCfg = () => store.set(CFG_KEY, cfg);
const projOf = pid => cfg.projects.find(p=>p.id===pid);
const curProj = () => projOf(cfg.current);
// core.js・phone.js は S を使うので、別のPJを扱うときは一時的に S を差し替える
function withS(s, fn){ const keep = S; S = s; try{ return fn(); } finally { S = keep; } }

/* ---------- Google スプレッドシート（Apps Script）との通信 ---------- */
async function api(p, action, payload={}){
  if(!p.endpoint) throw new Error('書き込み先が設定されていません');
  const res = await fetch(p.endpoint, {method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body:JSON.stringify({action, key:p.key||'', ...payload}), redirect:'follow'});
  const j = await res.json();
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
  if(!pr || !pr.endpoint) return `<p class="sync-line">端末内だけに保存しています（設定から担当PJのスプレッドシートを登録すると反映されます）</p>`;
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
    if(!quiet && !j.data.cuts.length) flashToast('このスプレッドシートにはまだデータがありません。「初期データを作る」を押してください');
  }catch(err){ p.sync.err = err.message; if(!quiet) flashToast(err.message); }
  if(!ui.modal && ['home','settings'].includes(ui.screen)) renderPhone();
}
// 初期データ（デモと同じダミーのカット・発注書・履歴）を作って、今のPJのスプレッドシートを作り直す
async function resetData(){
  const pid = cfg.current, p = PJ[pid], pr = curProj();
  p.S = seedState(); S = p.S; store.set(dataKey(pid), rawOf(p.S));
  if(pr.endpoint){
    ui.busy = '初期データを書き込んでいます…'; renderPhone();
    try{ await api(pr, 'reset', {data:rawOf(p.S), tables:buildTables()}); markSent(pid); p.sync = {at:Date.now(), err:null, pending:0}; ui.busy = null; flashToast('初期データを作りました'); }
    catch(err){ ui.busy = null; flashToast(err.message); }
  } else { markSent(pid); flashToast('初期データを作りました（端末内）'); }
  renderPhone();
}

/* ---------- 起動 ---------- */
async function boot(){
  let preset = {};
  try{ const r = await fetch('config.json', {cache:'no-store'}); if(r.ok) preset = await r.json(); }catch(e){}
  const saved = store.get(CFG_KEY) || {};
  cfg = {...cfg, ...saved};
  // 前の版の設定（書き込み先が1つ）を、担当PJの形に直す
  if(!cfg.projects || !cfg.projects.length){
    const ep = saved.endpoint || preset.endpoint || '';
    cfg.projects = [{id: ep ? 'pj1' : 'local', name: ep ? '担当PJ' : 'デモ（端末内）', endpoint: ep, key: saved.key || preset.key || ''}];
    const old = store.get('cutbagqr.data'); if(old) store.set(dataKey(cfg.projects[0].id), old);
    delete cfg.endpoint; delete cfg.key;
  }
  cfg.lastReg = cfg.lastReg || {};
  if(!projOf(cfg.current)) cfg.current = cfg.projects[0].id;
  OPERATOR = cfg.operator || OPERATOR;
  cfg.projects.forEach(addPJ);
  cfg.projects.forEach(p=>{ if(!p.endpoint && !PJ[p.id].S.cuts.length){ PJ[p.id].S = seedState(); store.set(dataKey(p.id), rawOf(PJ[p.id].S)); markSent(p.id); } });
  saveCfg();
  ui = {screen:'home'}; S = PJ[cfg.current].S;
  renderPhone();
  for(const p of cfg.projects) if(p.endpoint) await reload(p.id, true);
}

/* ---------- 設定の画面 ---------- */
function settingsView(){
  const pr = curProj(), s = PJ[cfg.current].S;
  return `<div class="appbar"><button class="back" data-a="home" aria-label="戻る">‹</button><h3>設定</h3>${who()}</div>
  <div class="body settings">
    <div class="field"><label class="lbl" for="cfgOp">入力者</label><input id="cfgOp" value="${esc(cfg.operator||'')}" placeholder="例：東海林（制作進行）"></div>
    <button type="button" class="act ghost" data-a="opSave">入力者を保存</button>
    <section class="home-sec"><h5>担当PJ</h5>
      <ul class="pj-list">${cfg.projects.map(p=>`<li class="${p.id===cfg.current?'on':''}"><div><b>${esc(p.name)}</b><small>${p.endpoint ? 'スプレッドシート' : '端末内だけ'}</small></div>
        ${p.id===cfg.current ? '<em>使用中</em>' : `<button type="button" class="linkbtn" data-pj="${esc(p.id)}">使う</button>`}
        ${cfg.projects.length>1 ? `<button type="button" class="linkbtn" data-pj-del="${esc(p.id)}">外す</button>` : ''}</li>`).join('')}</ul>
      <div class="field"><label class="lbl" for="pjEp">PJのスプレッドシートを登録する（Apps Script のウェブアプリのURL）</label><input id="pjEp" placeholder="https://script.google.com/macros/s/…/exec" inputmode="url"></div>
      <div class="field"><label class="lbl" for="pjKey">合言葉（設定した場合）</label><input id="pjKey"></div>
      <button type="button" class="act" data-a="pjAdd">登録して読み込む</button>
    </section>
    <section class="home-sec"><h5>${esc(pr.name)} のデータ</h5>
      <p class="mnote">カット ${s.cuts.length}件・QR ${s.qrs.filter(q=>q.status==='active').length}件・履歴 ${s.events.length}件</p>
      <button type="button" class="act ghost" data-a="print">QRコードを印刷する</button>
      ${ui.confirmReset
        ? `<div class="confirm"><span>${esc(pr.name)} のデータを消して、初期データ（ダミーのカット・発注書・履歴）に作り直します。スプレッドシートも書き直されます。</span><div class="row"><button class="btn" data-a="resetNo">やめる</button><button class="btn primary" data-a="resetYes">作り直す</button></div></div>`
        : `<button type="button" class="act ghost" data-a="resetAsk">初期データを作る</button>`}
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
  if(a==='pjAdd'){
    const ep = $('#pjEp').value.trim(), key = $('#pjKey').value.trim();
    if(!/^https:\/\//.test(ep) && !/^http:\/\/(127\.0\.0\.1|localhost)/.test(ep)){ flashToast('Apps Script のウェブアプリのURLを入れてください'); return true; }
    const exist = cfg.projects.find(p=>p.endpoint===ep);
    if(exist){ useProject(exist.id, 'settings'); reload(exist.id, false); return true; }
    const p = {id:'pj'+Date.now().toString(36), name:'PJ（読み込み中）', endpoint:ep, key};
    // 端末内だけのデモPJしかないときは、それを置き換える
    if(cfg.projects.length===1 && !cfg.projects[0].endpoint){ store.del(dataKey(cfg.projects[0].id)); delete PJ[cfg.projects[0].id]; cfg.projects = []; }
    cfg.projects.push(p); addPJ(p); useProject(p.id, 'settings'); renderPhone();
    reload(p.id, false).then(()=>{ if(!PJ[p.id].sync.err) flashToast(`「${p.name}」を登録しました`); });
    return true;
  }
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
    else ui = {screen:'scanner', scan:{items:[item]}};
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
  if(pj){ e.stopPropagation(); const back = ui.screen==='settings' ? 'settings' : 'home'; useProject(pj.dataset.pj, back); renderPhone(); return; }
  const del = e.target.closest('[data-pj-del]');
  if(del){ e.stopPropagation(); const id = del.dataset.pjDel; cfg.projects = cfg.projects.filter(p=>p.id!==id); delete PJ[id]; store.del(dataKey(id)); if(cfg.current===id) cfg.current = cfg.projects[0].id; useProject(cfg.current, 'settings'); renderPhone(); }
}, true);

/* ---------- カメラでQRコードを読む ---------- */
const cam = {stream:null, raf:0, busy:false, err:'', last:{}, t:0, detector:null, canvas:null};
function camMsg(){
  if(ui.scanning) return '読み取り中…';
  if(cam.err) return esc(cam.err);
  if(!cam.stream) return 'カメラを起動しています…';
  return '';
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
  if(ui.screen==='scanner'){ const f=document.querySelector('.finder .ftext'); if(f) f.textContent = camMsg(); else if(cam.err) renderPhone(); }
}
function attachCam(){
  const v = $('#cam'); if(!v || !cam.stream) return;
  if(v.srcObject !== cam.stream){ v.srcObject = cam.stream; v.play().catch(()=>{}); }
  const f = document.querySelector('.finder .ftext'); if(f && !camMsg()) f.remove();
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
// QRの中身は「CUTBAG:ID」。ID だけのものも読む
const tokenOfText = t => String(t||'').trim().replace(/^CUTBAG:/i, '');
// 読み取ったIDが、どの担当PJのものかを探す（今のPJから）
function findProjectOf(token){
  const order = [cfg.current, ...cfg.projects.map(p=>p.id).filter(id=>id!==cfg.current)];
  for(const pid of order){ const q = PJ[pid] && PJ[pid].S.qrs.find(x=>x.token===token); if(q) return {pid, q}; }
  return null;
}
async function onCode(text){
  const token = tokenOfText(text), now = Date.now();
  if(!token) return;
  if(cam.last[token] && now - cam.last[token] < 3000) return;   // 同じQRを続けて読まない
  cam.last[token] = now;
  const hit = findProjectOf(token);
  if(!hit){ feedback(true); openRegister(token); return; }
  if(hit.pid!==cfg.current){
    const pr = projOf(hit.pid);
    if(ui.scan && ui.scan.items.length){
      const no = withS(PJ[hit.pid].S, ()=>cutById(hit.q.cut).no);
      ui.scan.items.push({cutNo:no, text:`別のPJ（${pr.name}）のカット袋です。「完了」してから読み直してください`, kind:'bad'});
      feedback(false); renderPhone(); return;
    }
    useProject(hit.pid, 'scanner'); renderPhone(); flashToast(`PJ「${pr.name}」に切り替えました`);
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
