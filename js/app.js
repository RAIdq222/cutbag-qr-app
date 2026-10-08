/* ================= アプリ：設定・スプレッドシートとの同期・カメラ ================= */
// 設定は端末に保存する。config.json があれば、その値を初期値にする（社内サーバーに置くときに使う）
const CFG_KEY = 'cutbagqr.cfg', DATA_KEY = 'cutbagqr.data';
let cfg = {endpoint:'', key:'', operator:OPERATOR};
const store = {
  get(k){ try{ return JSON.parse(localStorage.getItem(k)); }catch(e){ return null; } },
  set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} },
  del(k){ try{ localStorage.removeItem(k); }catch(e){} },
};

/* ---------- Google スプレッドシート（Apps Script）との通信 ---------- */
async function api(action, payload={}){
  if(!cfg.endpoint) throw new Error('書き込み先が設定されていません');
  const body = JSON.stringify({action, key:cfg.key, ...payload});
  // Content-Type を text/plain にすると、Apps Script でも事前確認（preflight）なしで送れる
  const res = await fetch(cfg.endpoint, {method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body, redirect:'follow'});
  const j = await res.json();
  if(!j.ok) throw new Error(j.error || '書き込みに失敗しました');
  return j;
}
// 読み込んだデータから S を作る
function loadState(d){
  S = {cuts:d.cuts||[], qrs:d.qrs||[], orders:d.orders||[], events:(d.events||[]).sort((a,b)=>a.no-b.no), seq:0, rtSeq:0, retSeq:0, poSeq:(d.orders||[]).length, day:0};
  S.seq = S.events.reduce((m,e)=>Math.max(m,e.no||0), 0);
  S.events.forEach(e=>{ if(e.rt && e.rt.id){ const n=Number(String(e.rt.id).slice(1)); if(e.rt.id[0]==='R') S.rtSeq=Math.max(S.rtSeq,n); else S.retSeq=Math.max(S.retSeq,n); } });
}

/* ---------- 同期：変わった履歴だけを送り、表は作り直して送る ---------- */
const sent = new Map();         // 履歴の番号 → 最後に送った内容
let syncTimer = null, syncing = false, dirty = false;
const syncState = {at:null, err:null, pending:0};
function markSent(){ sent.clear(); S.events.forEach(e=>sent.set(e.no, JSON.stringify(e))); }
function sync(){
  store.set(DATA_KEY, {cuts:S.cuts, qrs:S.qrs, orders:S.orders, events:S.events});
  clearTimeout(syncTimer); syncTimer = setTimeout(doSync, 400);
}
async function doSync(){
  if(!cfg.endpoint){ syncState.pending = 0; return; }
  if(syncing){ dirty = true; return; }
  syncing = true; dirty = false;
  const changed = S.events.filter(e=>sent.get(e.no)!==JSON.stringify(e));
  syncState.pending = changed.length;
  try{
    await api('upsert', {events:changed, tables:buildTables()});
    changed.forEach(e=>sent.set(e.no, JSON.stringify(e)));
    syncState.at = Date.now(); syncState.err = null; syncState.pending = 0;
  }catch(err){ syncState.err = err.message; setTimeout(()=>sync(), 8000); }
  syncing = false;
  if(ui && ui.screen==='home') renderPhone();
  if(dirty) doSync();
}
function syncLine(){
  if(!cfg.endpoint) return `<p class="sync-line">端末内だけに保存しています（設定から書き込み先を入れるとスプレッドシートに反映されます）</p>`;
  if(syncState.err) return `<p class="sync-line bad">スプレッドシートに送れていません（${esc(syncState.err)}）。自動でもう一度送ります</p>`;
  if(syncState.pending) return `<p class="sync-line">スプレッドシートに送っています（${syncState.pending}件）</p>`;
  return syncState.at ? `<p class="sync-line ok">スプレッドシートに反映済み ${fDT(syncState.at)}</p>` : '';
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

/* ---------- 起動 ---------- */
async function boot(){
  try{ const r = await fetch('config.json', {cache:'no-store'}); if(r.ok){ const c = await r.json(); cfg = {...cfg, ...c}; } }catch(e){}
  cfg = {...cfg, ...(store.get(CFG_KEY)||{})};
  OPERATOR = cfg.operator || OPERATOR;
  ui = {screen:'home'};
  const cached = store.get(DATA_KEY);
  if(cached && cached.cuts && cached.cuts.length) loadState(cached); else { const me = OPERATOR; OPERATOR = '東海林（制作進行）'; seed(); OPERATOR = me; }
  renderPhone();
  if(cfg.endpoint) await reload(true);
}
// スプレッドシートから読み直す
async function reload(quiet){
  try{
    const j = await api('load');
    if(j.data.cuts && j.data.cuts.length){ loadState(j.data); markSent(); store.set(DATA_KEY, j.data); syncState.at = Date.now(); syncState.err = null; }
    else if(!quiet) flashToast('スプレッドシートにデータがありません。設定の「初期データを作る」を押してください');
  }catch(err){ syncState.err = err.message; if(!quiet) flashToast(err.message); }
  renderPhone();
}
// 初期データ（デモと同じダミーのカット・発注書・履歴）を作って、スプレッドシートを作り直す
async function resetData(){
  const me = OPERATOR; OPERATOR = '東海林（制作進行）'; seed(); OPERATOR = me;   // 初期データの過去の履歴は、ダミーの入力者で作る
  store.set(DATA_KEY, {cuts:S.cuts, qrs:S.qrs, orders:S.orders, events:S.events});
  if(cfg.endpoint){
    ui.busy = '初期データを書き込んでいます…'; renderPhone();
    try{ await api('reset', {data:{cuts:S.cuts, qrs:S.qrs, orders:S.orders, events:S.events}, tables:buildTables()}); markSent(); syncState.at = Date.now(); syncState.err = null; ui.busy = null; flashToast('初期データを作りました。QRコードを印刷してください'); }
    catch(err){ ui.busy = null; flashToast(err.message); }
  } else flashToast('初期データを作りました（端末内）');
  renderPhone();
}

/* ---------- 設定の画面 ---------- */
function settingsView(){
  const n = S ? S.cuts.length : 0;
  return `<div class="appbar"><button class="back" data-a="home" aria-label="戻る">‹</button><h3>設定</h3>${who()}</div>
  <div class="body settings">
    <div class="field"><label class="lbl" for="cfgOp">入力者</label><input id="cfgOp" value="${esc(cfg.operator||'')}" placeholder="例：東海林（制作進行）"></div>
    <div class="field"><label class="lbl" for="cfgEp">書き込み先（Apps Script のウェブアプリのURL）</label><input id="cfgEp" value="${esc(cfg.endpoint||'')}" placeholder="https://script.google.com/macros/s/…/exec" inputmode="url"></div>
    <div class="field"><label class="lbl" for="cfgKey">合言葉（Apps Script に設定した場合）</label><input id="cfgKey" value="${esc(cfg.key||'')}"></div>
    <button type="button" class="act" data-a="cfgSave">保存して読み込む</button>
    <section class="home-sec"><h5>データ</h5>
      <p class="mnote">カット ${n}件・履歴 ${S?S.events.length:0}件</p>
      <button type="button" class="act ghost" data-a="print">QRコードを印刷する</button>
      ${ui.confirmReset
        ? `<div class="confirm"><span>今のデータを消して、初期データ（ダミーのカット・発注書・履歴）に作り直します。スプレッドシートも書き直されます。</span><div class="row"><button class="btn" data-a="resetNo">やめる</button><button class="btn primary" data-a="resetYes">作り直す</button></div></div>`
        : `<button type="button" class="act ghost" data-a="resetAsk">初期データを作る</button>`}
    </section>
    ${ui.busy ? `<p class="sync-line">${esc(ui.busy)}</p>` : ''}
  </div>`;
}
// phone.js のボタンのうち、アプリだけにあるもの
function appAction(a, t){
  if(a==='settings'){ ui = {screen:'settings'}; renderPhone(); return true; }
  if(a==='cfgSave'){
    cfg.operator = $('#cfgOp').value.trim() || OPERATOR; cfg.endpoint = $('#cfgEp').value.trim(); cfg.key = $('#cfgKey').value.trim();
    OPERATOR = cfg.operator; store.set(CFG_KEY, cfg);
    if(cfg.endpoint) reload(false).then(()=>{ if(!syncState.err) flashToast('保存しました'); }); else { flashToast('保存しました'); }
    return true;
  }
  if(a==='print'){ location.href = 'print.html'; return true; }
  if(a==='resetAsk'){ ui.confirmReset = true; renderPhone(); return true; }
  if(a==='resetNo'){ ui.confirmReset = false; renderPhone(); return true; }
  if(a==='resetYes'){ ui.confirmReset = false; resetData(); return true; }
  if(a==='scan'){ unlockAudio(); return false; }
  return false;
}

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
  if(ui.screen==='scanner') { const f=document.querySelector('.finder .ftext'); if(f) f.textContent = camMsg(); else if(cam.err) renderPhone(); }
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
async function onCode(text){
  const token = tokenOfText(text), now = Date.now();
  if(cam.last[token] && now - cam.last[token] < 3000) return;   // 同じQRを続けて読まない
  cam.last[token] = now;
  if(!S.qrs.find(q=>q.token===token)){ feedback(false); flashToast('登録されていないQRコードです'); return; }
  cam.busy = true;
  const q = S.qrs.find(x=>x.token===token);
  feedback(q.status==='active');
  try{ await scan(token); } finally { cam.busy = false; }
}
// 読み取ったときの音と振動（成功と、旧ラベル・未登録で音を変える）
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

// ほかの端末で登録した分を取り込むため、ホームを開いているあいだは時々読み直す
setInterval(()=>{ if(cfg.endpoint && ui && ui.screen==='home' && !ui.modal && !syncing && !syncState.pending) reload(true); }, 30000);
document.addEventListener('visibilitychange', ()=>{ if(document.hidden) camStop(); else if(ui && ui.screen==='scanner') camStart(); });
// Android アプリ（Capacitor）の中では端末のファイルから開くので、Service Worker は使わない
if('serviceWorker' in navigator && location.protocol==='https:' && !window.Capacitor) navigator.serviceWorker.register('sw.js').catch(()=>{});
boot();
