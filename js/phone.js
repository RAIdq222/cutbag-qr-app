/* ================= 画面 ================= */
// ホームはボタン4つ：QRコード読み取り／回収済みカットの確認／進行管理／制作状況を見る。マイページは右上から
const who = () => `<span class="op">ログイン中<b>${esc(OPERATOR)}</b></span>`;
const reviewList = () => S.cuts.map(c=>({c, d:derive(c.id)})).filter(x=>x.d.phase==='review').sort((a,b)=>a.d.since-b.d.since);
const FILTERS = [['all','すべて'],['wait','配布待ち'],['in','作業中・チェック中'],['review','確認待ち'],['retake','リテイク・差し戻し'],['over','納期遅れ'],['done','完了']];
const ICON = {
  scan:'<path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><rect x="7.5" y="7.5" width="9" height="9" rx="1" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  review:'<rect x="4" y="3" width="16" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M8 12.5l2.6 2.6L16 9.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  manage:'<path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="8" cy="6" r="2" fill="var(--surface)" stroke="currentColor" stroke-width="1.8"/><circle cx="15" cy="12" r="2" fill="var(--surface)" stroke="currentColor" stroke-width="1.8"/><circle cx="10" cy="18" r="2" fill="var(--surface)" stroke="currentColor" stroke-width="1.8"/>',
  dash:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  me:'<circle cx="12" cy="8.5" r="3.6" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M4.5 20c1.3-3.7 4.2-5.5 7.5-5.5s6.2 1.8 7.5 5.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>',
  x:'<path d="M7 7l10 10M17 7L7 17" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  rt:'<path d="M9 7H5V3" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/><path d="M5.6 7A8 8 0 1 1 4 12" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/>',
};
const svg = (k, s=24) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true">${ICON[k]}</svg>`;
const stg = sid => sid ? `<span class="stg ${GCLASS[ST[sid].g]||''}">${esc(nameOf(sid))}</span>` : '';
const back = (to='home', label='戻る') => `<button class="back" data-a="go" data-to="${to}" aria-label="${label}">‹</button>`;
// モーダルの上に出す見出し：作品・話数・カット・工程
const ctxLine = (c, sid) => `<p class="mctx">${esc(titleOf())}　${esc(c.ep)}　<b>${esc(c.no)}</b>${sid?'　'+esc(nameOf(sid)):''}</p>`;

let lastScreen = null;
function renderPhone(){
  const el = $('#screen');
  const keep = document.activeElement && document.activeElement.id==='findCut';
  let h = '';
  const V = {home:homeView, scanner:scannerView, review:reviewView, manage:manageView, cut:cutView, dash:dashView, settings:settingsView, register:registerView};
  h += (V[ui.screen] || homeView)();
  if(ui.modal) h += `<div class="scrim" data-a="closeModal"></div>` + modalView();
  if(ui.toast) h += `<div class="toast" role="status">${esc(ui.toast)}</div>`;
  el.innerHTML = h;
  if(ui.screen !== lastScreen){ el.querySelectorAll('.body,.appbar').forEach(b=>b.classList.add('enter')); lastScreen = ui.screen; }
  if(keep){ const f = $('#findCut'); if(f){ f.focus(); f.setSelectionRange(f.value.length, f.value.length); } }
  afterRender();
}
function go(screen, extra={}){ ui = {screen, ...extra}; renderPhone(); }

/* ---------- ホーム ---------- */
function homeView(){
  const n = reviewList().length;
  const tile = (a, icon, label, badge) => `<button type="button" class="tile${a==='scan'?' main':''}" data-a="${a}">${svg(icon, 34)}<b>${label}</b>${badge ? `<em class="badge">${badge}</em>` : ''}</button>`;
  return `<div class="appbar"><h3>カット袋QR</h3>${who()}<button type="button" class="gear" data-a="go" data-to="settings" aria-label="マイページ">${svg('me', 24)}</button></div>
  <div class="body home">
    ${oldDataLine()}
    <div class="tiles">
      ${tile('scan','scan','QRコード読み取り')}
      ${tile('goReview','review','回収済みカットの確認', n ? n+'件' : '')}
      ${tile('goManage','manage','進行管理')}
      ${tile('goDash','dash','制作状況を見る')}
    </div>
  </div>`;
}

/* ---------- QRコード読み取り ---------- */
// 読み取った1件ずつの行。配布は相手と納期を同じ行で直せる
function scanRow(it){
  const c = cutById(it.cut), e = it.no ? S.events.find(x=>x.no===it.no) : null;
  const ctx = c ? `<span class="sr-ctx">${esc(titleOf())}　${esc(c.ep)}　<b>${esc(c.no)}</b></span>` : `<span class="sr-ctx"><b>${esc(it.cutNo||'')}</b></span>`;
  let main = '', tail = '';
  if(it.kind==='ok' && e && !it.voided){
    if(e.type==='IN') main = `${stg(e.stage)}<span class="sr-act">配布</span><button type="button" class="person-btn" data-person-ev="${e.no}">${esc(e.person)}</button><button type="button" class="due-btn${e.due?'':' empty'}" data-due-ev="${e.no}">${e.due ? '納期 '+fD(e.due) : '納期'}</button>`;
    else if(e.type==='UP') main = `${stg(e.stage)}<span class="sr-act">回収</span><span class="sr-from">${esc(e.person||'')}</span>`;
    else main = `<span class="sr-act">${esc(it.text)}</span>`;
    tail = `<button type="button" class="xbtn" data-undo-ev="${e.no}" aria-label="取り消し">${svg('x', 18)}</button>`;
  } else if(it.kind==='ok' && it.voided){
    main = `${e ? stg(e.stage) : ''}<span class="sr-act">取り消しました</span>`;
  } else if(it.kind==='need'){
    main = `${stg(it.stage)}<span class="sr-act">配布</span><span class="sr-warn">発注書に載っていません</span>`;
    tail = `<button type="button" class="linkbtn strong" data-need="${it.cut}">作業者を選ぶ</button>`;
  } else {
    main = `${it.stage ? stg(it.stage) : ''}<span class="sr-act">${esc(it.text)}</span>`;
  }
  return `<li class="sr ${it.kind}${it.voided?' void':''}"><div class="sr-body">${ctx}<div class="sr-main">${main}</div></div>${tail}</li>`;
}
function sessionIns(){
  if(!ui.scan) return [];
  return ui.scan.items.filter(it=>it.kind==='ok' && !it.voided).map(it=>S.events.find(e=>e.no===it.no)).filter(e=>e && e.type==='IN');
}
function scannerView(){
  const s = ui.scan, live = s.items.filter(i=>i.kind==='ok' && !i.voided).map(i=>S.events.find(e=>e.no===i.no)).filter(Boolean);
  const nIn = live.filter(e=>e.type==='IN').length, nUp = live.filter(e=>e.type==='UP').length;
  return `<div class="appbar">${back('home')}<h3>QRコード読み取り</h3></div>
  <div class="body scan-body">
    <div class="finder cam${ui.scanning?' scanning':''}"><video id="cam" playsinline muted autoplay></video><span class="corner c1"></span><span class="corner c2"></span><span class="corner c3"></span><span class="corner c4"></span><span class="laser"></span>
      ${camMsg() ? `<span class="ftext">${camMsg()}</span>` : ''}</div>
    <div class="sess-count"><span><b>${nIn+nUp}</b>件 登録<small>（配布 ${nIn}・回収 ${nUp}）</small></span>${sessionIns().length>1 ? `<button type="button" class="linkbtn due-all" data-a="dueAll">納期をまとめて設定</button>` : ''}</div>
    ${s.items.length ? `<ul class="sess-list">${[...s.items].reverse().map(scanRow).join('')}</ul>` : ''}
    <button type="button" class="act sticky" data-a="closeScan">完了</button>
  </div>`;
}

/* ---------- 回収済みカットの確認 ---------- */
function reviewView(){
  const list = reviewList(), sel = ui.sel || [];
  return `<div class="appbar">${back('home')}<h3>回収済みカットの確認</h3></div>
  <div class="body">
    ${list.length ? `<div class="rv-tools"><span class="mnote">確認待ち ${list.length}件</span><button type="button" class="linkbtn" data-a="selAll">すべて選ぶ</button></div>
    <div class="rv-list">${list.map(({c,d})=>{ const on = sel.includes(c.id); return `<div class="rv-row${on?' on':''}">
      <button type="button" class="rv-chk" data-sel="${c.id}" aria-pressed="${on}" aria-label="${c.no} を選ぶ">${on?'✓':''}</button>
      <button type="button" class="rv-main" data-okcut="${c.id}"><span class="rv-ctx">${esc(c.ep)}　<b>${esc(c.no)}</b>　${stg(d.sid)}${d.ret?'<span class="tagx">差し戻し分</span>':d.open?'<span class="tagx">リテイク分</span>':''}</span><span class="rv-sub">${esc(d.from||'')} から回収　${fD(d.since)}</span></button>
      <button type="button" class="rv-rt" data-rtcut="${c.id}" aria-label="${c.no} をリテイク・差し戻し">${svg('rt', 20)}</button></div>`; }).join('')}</div>
    ${sel.length ? `<button type="button" class="act ok sticky" data-a="bulkOK">選んだ${sel.length}件を確認OK</button>` : ''}`
    : `<p class="batch-empty">確認待ちのカット袋は0件です</p>`}
  </div>`;
}

/* ---------- 進行管理 ---------- */
function filterMatch(d, f){
  if(f==='all') return true;
  if(f==='in') return d.phase==='in' && !d.open && !d.ret;
  if(f==='retake') return d.phase==='in' && (d.open || d.ret);
  if(f==='over') return d.overdue;
  return d.phase===f;
}
function manageView(){
  const eps = epsOf(), ep = ui.ep && eps.includes(ui.ep) ? ui.ep : eps[0];
  const q = (ui.q||'').replace(/\D/g,''), f = ui.filter || 'all';
  const all = S.cuts.filter(c=>c.ep===ep).sort((a,b)=>a.no.localeCompare(b.no)).map(c=>({c, d:derive(c.id)}));
  const found = all.filter(x=>(!q || String(Number(x.c.no.slice(1))).startsWith(String(Number(q)))) && filterMatch(x.d, f));
  return `<div class="appbar">${back('home')}<h3>進行管理</h3></div>
  <div class="body">
    <div class="mg-top">${pjLine()}${syncLine()}${oldDataLine()}</div>
    <div class="ep-tabs">${eps.map(e=>`<button type="button" class="ep-tab${e===ep?' on':''}" data-ep="${esc(e)}">${esc(e)}</button>`).join('')}</div>
    <input id="findCut" type="search" inputmode="numeric" placeholder="カット番号（例：13）" value="${esc(ui.q||'')}" aria-label="カット番号で探す">
    <div class="chips">${FILTERS.map(([k,n])=>`<button type="button" class="chipf${f===k?' on':''}" data-filter="${k}">${n}</button>`).join('')}</div>
    <div class="find-list">${found.map(({c,d})=>{ const st = statusOf(d);
      const sub = [d.phase==='in' ? d.holder : '', d.due && d.phase==='in' ? `<span class="${d.overdue?'over':''}">納期 ${fD(d.due)}</span>` : '', d.stale ? `<span class="stale">${d.days}日動きなし</span>` : ''].filter(Boolean).join('・');
      return `<button type="button" class="find-row" data-open="${c.id}"><b>${esc(c.no)}</b><span class="fr-st"><i class="dot ${st.k}"></i>${esc(stateText(d))}</span><small>${sub}</small></button>`; }).join('') || '<p class="batch-empty">当てはまるカットは0件です</p>'}</div>
  </div>`;
}
// カットの状況：工程の流れに沿って、誰がやったか・いつ入って（IN）いつ上がったか（UP）・納期を並べる。行を押すと直せる
function cutView(){
  const c = cutById(ui.cut), d = derive(c.id), st = statusOf(d);
  const curI = d.sid ? d.route.indexOf(d.sid) : d.route.length;
  const rows = d.route.map((sid,i)=>{
    const x = d.cells[sid] || {};
    const cls = i<curI ? 'done' : i===curI ? 'cur' : 'todo';
    const person = x.person || (i>=curI && ST[sid].who!=='worker' ? staffFor(c, sid) : '');
    const due = x.due ? `<span class="${d.overdue && sid===d.sid ? 'over':''}">${fD(x.due)}</span>` : '';
    const rt = x.rin ? `<span class="tagx">R ${fD(x.rin)}${x.rup?'→'+fD(x.rup):''}</span>` : x.rtc ? `<span class="tagx">指摘 ${fD(x.rtc)}</span>` : '';
    return `<li class="fl ${cls}" data-edit="${sid}"><span class="fl-st">${stg(sid)}</span><span class="fl-who">${esc(person)}${rt}</span><span class="fl-d">${fD(x.in)}</span><span class="fl-d">${fD(x.up)}</span><span class="fl-d">${due}</span></li>`;
  }).join('');
  const mine = S.events.filter(e=>e.cut===c.id && e.type!=='VOID'), voided = voidedSet();
  return `<div class="appbar">${back('manage')}<h3>カットの状況</h3></div>
  <div class="body">
    <div class="cuthead"><div><div class="sub">${esc(titleOf())}　${esc(c.ep)}</div><div class="big">${esc(c.no)}</div><div class="sub">パート${esc(c.part||'')}　${esc(c.sec||'')}秒</div></div>
      <div class="ch-st"><span class="chip ${st.k}">${esc(stateText(d))}</span>${d.stale ? `<span class="stop">止まっている：${esc(d.holder)}（${d.days}日）</span>` : ''}</div></div>
    <ol class="flow2"><li class="fl head"><span>工程</span><span>担当</span><span>IN</span><span>UP</span><span>納期</span></li>${rows}</ol>
    ${d.phase!=='done' ? `<button type="button" class="act ghost" data-a="routeEdit">通す工程を変える</button>` : ''}
    <div><div class="lbl">履歴</div><ul class="hist">${mine.slice(-6).reverse().map(e=>`<li class="${voided.has(e.no)?'void':''}"><span class="t">${fDT(e.ts)}</span><span class="${e.type==='RETAKE'||e.type==='RETURN'?'r':''}">${esc(evText(e))}</span></li>`).join('')}</ul></div>
  </div>`;
}

/* ---------- 制作状況を見る（ダッシュボード） ---------- */
function dashView(){
  const today = startOfDay(clock());
  const cards = epsOf().map(ep=>{
    const list = S.cuts.filter(c=>c.ep===ep).map(c=>({c, d:derive(c.id)}));
    let passed = 0, total = 0; const byG = {}; let done = 0;
    list.forEach(({d})=>{ total += d.route.length; const i = d.sid ? d.route.indexOf(d.sid) : d.route.length; passed += i; if(d.phase==='done') done++; else { const g = ST[d.sid].g; byG[g] = (byG[g]||0)+1; } });
    const pct = total ? Math.round(passed/total*100) : 0;
    const over = list.filter(x=>x.d.overdue);
    const gs = ['LO','原画','動画','仕上げ','本撮'];
    return `<section class="dash-card"><h5>${esc(titleOf())}　${esc(ep)}<small>${list.length}カット</small></h5>
      <div class="pbar"><i style="width:${pct}%"></i></div><p class="dash-num"><b>${pct}</b>%<small>完了 ${done}/${list.length}カット</small></p>
      <div class="gbar">${gs.map(g=>byG[g] ? `<i class="${GCLASS[g]}" style="flex:${byG[g]}" title="${g}"></i>` : '').join('')}${done ? `<i class="g-done" style="flex:${done}"></i>` : ''}</div>
      <ul class="glist">${gs.map(g=>`<li><span class="stg ${GCLASS[g]}">${g}</span><b>${byG[g]||0}</b></li>`).join('')}<li><span class="stg g-done">完了</span><b>${done}</b></li></ul>
      <p class="dash-over${over.length?' on':''}">納期遅れ <b>${over.length}</b>カット${over.length ? '：'+over.map(x=>esc(x.c.no)).join('・') : ''}</p></section>`;
  }).join('');
  // 担当者ごとの手持ち（今そのカットを持っている人）
  const hold = new Map();
  S.cuts.forEach(c=>{ const d = derive(c.id); if(d.phase!=='in') return; const k = d.holder; if(!hold.has(k)) hold.set(k, []); hold.get(k).push({c, d}); });
  const people = [...hold.entries()].sort((a,b)=>b[1].length-a[1].length);
  return `<div class="appbar">${back('home')}<h3>制作状況</h3></div>
  <div class="body">
    ${cards}
    <section class="dash-card"><h5>担当者の手持ち<small>今カット袋を持っている人</small></h5>
      <ul class="hold">${people.map(([p, xs])=>`<li><div><b>${esc(p)}</b><small>${xs.map(({c,d})=>`<span class="${d.overdue?'over':''}">${esc(c.ep)} ${esc(c.no)}（${esc(nameOf(d.sid))}${d.due?'・'+fD(d.due):''}）</span>`).join('　')}</small></div><em>${xs.length}</em></li>`).join('')}</ul></section>
  </div>`;
}

/* ---------- 履歴の言い方 ---------- */
function evText(e){
  const s = nameOf(e.stage);
  if(e.type==='IN') return `${s} 配布 → ${e.person}`;
  if(e.type==='UP') return `${s} 回収`;
  if(e.type==='OK') return `${s} 確認OK${e.next && e.next.person ? `（次：${e.next.person}）` : ''}`;
  if(e.type==='RETURN') return `${e.rt.id} 差し戻し（${e.rt.reason}）`;
  if(e.type==='RETAKE') return `${e.rt.id} リテイク ${nameOf(e.rt.raised)} → ${s}（${e.rt.reason}）`;
  if(e.type==='VOID') return `取り消し（No.${e.voidOf}）`;
  if(e.type==='ALERT') return `旧ラベルの読み取り`;
  if(e.type==='LINK') return e.note || 'カット袋を登録';
  if(e.type==='SET') return `${s}の${{in:'IN',up:'UP',due:'納期',person:'担当',sheets:'枚数'}[e.field]||e.field}を直した`;
  if(e.type==='ROUTE') return `通す工程を変えた`;
  if(e.type==='REQ') return `発注書の更新を依頼`;
  return e.type;
}

/* ---------- 下から出る画面 ---------- */
// 納期のカレンダー。今日と、今の納期に印を付ける。日曜・祝日は赤、今日より前は押せない
function openCal(target, cur){
  const base = new Date(cur || clock());
  ui.cal = {target, y:base.getFullYear(), m:base.getMonth(), cur:cur||null, back:ui.modal==='cal' ? (ui.cal && ui.cal.back) : ui.modal};
  ui.modal = 'cal'; renderPhone();
}
function calInfo(t){
  if(t.kind==='ev'){ const e = S.events.find(x=>x.no===t.no); return {c:cutById(e.cut), sid:e.stage, cur:e.due}; }
  if(t.kind==='all') return {c:null, sid:null, cur:null};
  const f = ui.form || {}, sid = f.sid || (f.mode==='retake' ? f.target : derive(ui.cut).sid);
  return {c:cutById(ui.cut), sid, cur:f[t.field]};
}
function calView(){
  const {target, y, m} = ui.cal, info = calInfo(target);
  const sel = info.cur ? ymd(info.cur) : '', today = ymd(clock());
  const first = new Date(y, m, 1), days = new Date(y, m+1, 0).getDate(), cells = [];
  for(let k=0; k<first.getDay(); k++) cells.push('<span></span>');
  for(let dd=1; dd<=days; dd++){
    const v = `${y}-${pad(m+1)}-${pad(dd)}`, wd = new Date(y, m, dd).getDay();
    const cls = ['cal-d', v===sel?'sel':'', v===today?'today':'', v<today?'past':'', wd===0||HOLIDAYS.has(v)?'red':''].filter(Boolean).join(' ');
    const mark = v===today ? '<small>今日</small>' : v===sel ? '<small>納期</small>' : '';
    cells.push(`<button type="button" class="${cls}" data-day="${v}"${v<today?' disabled':''}><span>${dd}</span>${mark}</button>`);
  }
  const ctx = info.c ? ctxLine(info.c, info.sid) : `<p class="mctx">この読み取りで配布した ${sessionIns().length}件</p>`;
  return `<div class="sheetm" role="dialog" aria-label="納期">${ctx}<h4>納期を選ぶ</h4>
    <div class="cal-h"><button type="button" class="linkbtn" data-a="calPrev" aria-label="前の月">‹</button><b>${y}年${m+1}月</b><button type="button" class="linkbtn" data-a="calNext" aria-label="次の月">›</button></div>
    <div class="cal"><span class="red">日</span><span>月</span><span>火</span><span>水</span><span>木</span><span>金</span><span>土</span>${cells.join('')}</div>
    <button class="linkbtn" data-a="calClose">閉じる</button></div>`;
}
function pickDay(v){
  const t = ui.cal.target, ts = dayTs(v), backTo = ui.cal.back;
  if(t.kind==='ev'){ const e = S.events.find(x=>x.no===t.no); e.due = ts; e.dueSrc = ''; sync(); }
  else if(t.kind==='all'){ sessionIns().forEach(e=>{ e.due = ts; e.dueSrc = ''; }); sync(); }
  else ui.form[t.field] = ts;
  ui.modal = backTo || null; renderPhone();
}
// 渡す相手を選ぶ。候補にない人は「追加」で入れる
function openPerson(target, sid, cur){ ui.person = {target, sid, cur, back:ui.modal, adding:false}; ui.modal = 'person'; renderPhone(); }
function personView(){
  const p = ui.person, info = p.target.kind==='ev' ? (()=>{ const e = S.events.find(x=>x.no===p.target.no); return {c:cutById(e.cut), sid:e.stage}; })() : {c:cutById(ui.cut), sid:p.sid};
  const list = candidatesOf(info.c, info.sid);
  if(p.cur && !list.includes(p.cur)) list.unshift(p.cur);
  return `<div class="sheetm" role="dialog" aria-label="渡す相手">${ctxLine(info.c, info.sid)}<h4>渡す相手を選ぶ</h4>
    <div class="opts">${list.map(n=>`<button type="button" class="opt pick${n===p.cur?' sel':''}" data-person="${esc(n)}">${esc(n)}</button>`).join('')}</div>
    ${p.adding ? `<div class="add-row"><input id="newPerson" placeholder="名前" autocomplete="off"><button type="button" class="btn primary" data-a="personAdd">追加</button></div>`
      : `<button type="button" class="act ghost" data-a="personAddOpen">＋ 追加</button>`}
    <button class="linkbtn" data-a="personClose">閉じる</button></div>`;
}
function pickPerson(name){
  const p = ui.person, t = p.target;
  if(t.kind==='ev'){ const e = S.events.find(x=>x.no===t.no); e.person = name; e.src = ''; sync(); }
  else ui.form[t.field] = name;
  ui.modal = p.back || null; renderPhone();
}
function modalView(){
  if(ui.modal==='pj') return pjView();
  if(ui.modal==='cal') return calView();
  if(ui.modal==='person') return personView();
  if(ui.modal==='regConfirm') return regConfirmView();
  const c = cutById(ui.cut), d = derive(c.id), f = ui.form || {};
  const close = `<button class="linkbtn" data-a="closeModal">閉じる</button>`;
  const pills = (list, cur) => `<div class="pills">${list.map(r=>`<button type="button" class="pill${cur===r?' sel':''}" data-reason="${esc(r)}">${esc(r)}</button>`).join('')}</div>`;
  const pickBtn = (field, sid, label='渡す相手') => `<div class="field"><span class="lbl">${label}</span><button type="button" class="fbtn" data-a="formPerson" data-field="${field}" data-sid="${sid}">${f[field] ? esc(f[field]) : '選ぶ'}</button></div>`;
  const dueBtnF = (field='due', label='納期') => `<div class="field"><span class="lbl">${label}</span><button type="button" class="fbtn" data-a="formDue" data-field="${field}">${f[field] ? fD(f[field]) : '選ぶ'}</button></div>`;
  if(ui.modal==='ok'){
    const n = nextOf(d), work = ST[d.sid].kind==='work', x = d.cells[d.sid] || {};
    const needPo = n && ST[n].po && !findOrderLine(c.id, n);
    return `<div class="sheetm" role="dialog" aria-label="確認OK">${ctxLine(c, d.sid)}<h4>確認OK</h4>
      <p class="mnote">${esc(d.from||'')} から ${fD(d.since)} に回収。次は ${n ? `<b>${esc(nameOf(n))}</b>` : '<b>完了</b>'}です。</p>
      ${n ? pickBtn('person', n, '次に渡す相手') + dueBtnF('due', '次の納期') : ''}
      ${work ? `<div class="field"><label class="lbl" for="okSheets">枚数</label><input id="okSheets" type="number" inputmode="numeric" min="0" value="${esc(f.sheets ?? x.sheets ?? '')}"></div>` : ''}
      ${needPo ? `<label class="opt${f.req?' sel':''}"><input type="checkbox" id="okReq"${f.req?' checked':''}><span>発注書に ${esc(c.no)} の ${esc(nameOf(n))} がありません。発注書の更新を依頼する</span></label>` : ''}
      <button class="act ok" data-a="submitOK">確認OK</button>${close}</div>`;
  }
  if(ui.modal==='rt'){
    const canRetake = ST[d.sid].kind==='check';
    const mode = canRetake ? (f.mode || 'retake') : 'return';
    const i = d.route.indexOf(d.sid);
    const prev = d.route.slice(0, i);
    const seg = canRetake ? `<div class="seg"><button type="button" class="${mode==='retake'?'on':''}" data-rtmode="retake">リテイク</button><button type="button" class="${mode==='return'?'on':''}" data-rtmode="return">差し戻し（不備）</button></div>` : '';
    const body = mode==='retake'
      ? `<div class="field"><label class="lbl" for="rtTarget">戻し先</label><select id="rtTarget">${prev.map(sid=>`<option value="${sid}"${sid===f.target?' selected':''}>${esc(nameOf(sid))}${(d.cells[sid]||{}).person?`（${esc(d.cells[sid].person)}）`:''}</option>`).join('')}</select></div>
         ${pickBtn('person', f.target)}${dueBtnF()}
         <div class="field"><span class="lbl">理由</span>${pills(REASONS, f.reason)}</div>`
      : `<p class="mnote">戻し先：${esc(d.from||'')}</p>${dueBtnF()}
         <div class="field"><span class="lbl">理由</span>${pills(RETURN_REASONS, f.reason)}</div>`;
    return `<div class="sheetm" role="dialog" aria-label="リテイク・差し戻し">${ctxLine(c, d.sid)}${seg || `<h4>差し戻し（不備）</h4>`}${body}
      <div class="field"><label class="lbl" for="rtNote">メモ（任意）</label><textarea id="rtNote">${esc(f.note||'')}</textarea></div>
      <button class="act rtb" data-a="submitRt">${mode==='retake'?'リテイクを登録':'差し戻す'}</button>${close}</div>`;
  }
  if(ui.modal==='edit'){
    const sid = f.sid, x = d.cells[sid] || {}, cur = sid===d.sid;
    const hint = cur && d.phase==='wait' ? 'IN を入れると、配布したことになります。' : cur && d.phase==='in' ? 'UP を入れると、回収したことになります。' : '';
    return `<div class="sheetm" role="dialog" aria-label="流れを直す">${ctxLine(c, sid)}<h4>流れを直す</h4>
      ${pickBtn('person', sid, '担当')}
      <div class="row2"><div class="field"><label class="lbl" for="edIn">IN</label><input id="edIn" type="date" value="${f.in?ymd(f.in):''}"></div>
        <div class="field"><label class="lbl" for="edUp">UP</label><input id="edUp" type="date" value="${f.up?ymd(f.up):''}"${(cur && d.phase==='wait') ? ' disabled' : ''}></div></div>
      ${dueBtnF()}
      ${ST[sid].kind==='work' ? `<div class="field"><label class="lbl" for="edSheets">枚数</label><input id="edSheets" type="number" inputmode="numeric" min="0" value="${esc(f.sheets ?? '')}"></div>` : ''}
      ${hint ? `<p class="mnote">${hint}</p>` : ''}
      <button class="act" data-a="submitEdit">保存</button>${close}</div>`;
  }
  if(ui.modal==='route'){
    const curI = d.sid ? d.route.indexOf(d.sid) : d.route.length;
    const groups = [...new Set(STAGES.filter(s=>s.g && ST[s.id]).map(s=>s.g))];
    const after = s => { const r = [...new Set([...d.route, s.id])].sort((a,b)=>ORDER[a]-ORDER[b]); return r.indexOf(s.id) > curI; };
    return `<div class="sheetm" role="dialog" aria-label="通す工程">${ctxLine(c)}<h4>通す工程を変える</h4>
      <p class="mnote">今より先の工程を選べます。作業の工程（LO・原画・動画・仕上げ・本撮）は必ず通ります。</p>
      ${groups.map(g=>{ const ss = STAGES.filter(s=>s.g===g); return `<div class="rt-group"><span class="lbl">${g}</span><div class="rt-opts">${ss.map(s=>{ const on = (f.route||d.route).includes(s.id), lock = s.kind==='work' || !after(s); return `<label class="ropt${on?' on':''}${lock?' lock':''}"><input type="checkbox" data-route="${s.id}"${on?' checked':''}${lock?' disabled':''}>${esc(s.name)}</label>`; }).join('')}</div></div>`; }).join('')}
      <button class="act" data-a="submitRoute">保存</button>${close}</div>`;
  }
  if(ui.modal==='pick'){
    const sid = d.sid, cands = typoCandidates(c.id, sid);
    return `<div class="sheetm" role="dialog" aria-label="作業者を選んで配布">${ctxLine(c, sid)}<h4>作業者を選んで配布</h4>
      ${cands.length ? `<div class="field"><span class="lbl">発注書の書き間違いの候補</span>${cands.map(x=>`<button type="button" class="opt pick" data-cand="${x.o.no}|${x.li}">${esc(x.o.vendor)}<small>発注番号 ${esc(x.o.no)} の「${esc(x.l.text)}」を ${esc(c.no)} として配布</small></button>`).join('')}</div>` : ''}
      ${pickBtn('person', sid, '作業者')}${dueBtnF()}
      <button class="act" data-a="submitPick">配布を登録</button>${close}</div>`;
  }
  return '';
}

/* ---------- 操作 ---------- */
// カット袋のQRを読む。状態で操作が決まる：配布待ち→配布、作業中・チェック中→回収。それ以外は登録しない
async function scan(token){
  const q = S.qrs.find(x=>x.token===token); if(!q) return;
  if(ui.screen!=='scanner') ui = {screen:'scanner', scan:{items:[]}};
  const sc = ui.scan;
  ui.scanning = true; renderPhone();
  await sleep(250);
  ui.scanning = false;
  const cut = cutById(q.cut), d = derive(q.cut);
  const push = it => { sc.items.push({cut:q.cut, cutNo:cut.no, ...it}); ui = {screen:'scanner', scan:sc}; renderPhone(); };
  if(q.status==='revoked'){ const r = act(q.cut,'ALERT',{qr:token, note:'使えなくしたQRを読み取り（更新しない）'}); push({no:r.ev.no, text:'旧ラベルです。カット袋のラベルを確かめてください', kind:'bad'}); sync(); return; }
  if(d.phase==='review'){ push({stage:d.sid, text:'回収済み（回収済みカットの確認で確認します）', kind:'info'}); return; }
  if(d.phase==='done'){ push({text:'完了したカットです', kind:'info'}); return; }
  const r = defaultAct(q.cut, {qr:token});
  if(r.ok){ push({no:r.ev.no, kind:'ok'}); sync(); return; }
  if(r.need==='order'){ push({stage:d.sid, kind:'need'}); return; }
  push({text:r.msg||'登録できません', kind:'info'});
}
function flashToast(msg){ ui.toast = msg; renderPhone(); clearTimeout(flashToast.t); flashToast.t = setTimeout(()=>{ ui.toast = null; renderPhone(); }, 2600); }
function readForm(){
  const f = ui.form; if(!f) return;
  const g = id => document.getElementById(id);
  if(g('rtTarget')) f.target = g('rtTarget').value;
  if(g('rtNote')) f.note = g('rtNote').value;
  if(g('okSheets')) f.sheets = g('okSheets').value;
  if(g('okReq')) f.req = g('okReq').checked;
  if(g('edIn')) f.in = g('edIn').value ? dayTs(g('edIn').value) : null;
  if(g('edUp')) f.up = g('edUp').value ? dayTs(g('edUp').value) : null;
  if(g('edSheets')) f.sheets = g('edSheets').value;
}
function openOK(cutId){
  ui.cut = cutId; const d = derive(cutId), n = nextOf(d), c = cutById(cutId);
  let person = '', due = null;
  if(n){ if(ST[n].who!=='worker') person = staffFor(c, n); else { const x = findOrderLine(cutId, n); if(x){ person = x.o.vendor; due = x.o.due; } } }
  ui.form = {sid:n, person, due, sheets:(d.cells[d.sid]||{}).sheets ?? '', req:false};
  ui.modal = 'ok'; renderPhone();
}
function openRt(cutId){
  ui.cut = cutId; const d = derive(cutId), i = d.route.indexOf(d.sid);
  let t = i-1; while(t>0 && ST[d.route[t]].kind!=='work') t--;
  const target = d.route[Math.max(0,t)];
  ui.form = {mode: ST[d.sid].kind==='check' ? 'retake' : 'return', target, person:(d.cells[target]||{}).person || '', due:null, reason:null, note:''};
  ui.modal = 'rt'; renderPhone();
}
function openEdit(sid){
  const c = cutById(ui.cut), d = derive(c.id), x = d.cells[sid] || {};
  const day = t => t ? dayTs(ymd(t)) : null;
  ui.form = {sid, person: x.person || (ST[sid].who!=='worker' ? staffFor(c, sid) : ''), in:day(x.in), up:day(x.up), due:day(x.due), sheets:x.sheets ?? ''};
  ui.form0 = {...ui.form};
  ui.modal = 'edit'; renderPhone();
}
function submitEdit(){
  readForm();
  const f = ui.form, f0 = ui.form0, c = cutById(ui.cut), d = derive(c.id), sid = f.sid;
  const changed = k => String(f[k] ?? '') !== String(f0[k] ?? '');
  if(sid===d.sid && d.phase==='wait' && f.in){
    const r = act(c.id, 'IN', {person:f.person, src:'', due:f.due, dueSrc:'', late:true, ets:clock(), sheets: f.sheets!=='' ? Number(f.sheets) : null}, f.in);
    if(!r.ok){ flashToast(r.msg); return; }
  } else {
    ['person','in','due','sheets'].forEach(k=>{ if(changed(k)) act(c.id, 'SET', {stage:sid, field:k, value: k==='sheets' ? Number(f[k]) : f[k]}); });
    if(sid===d.sid && d.phase==='in' && f.up){ const r = act(c.id, 'UP', {late:true, ets:clock()}, f.up); if(!r.ok){ flashToast(r.msg); return; } }
    else if(changed('up')) act(c.id, 'SET', {stage:sid, field:'up', value:f.up});
  }
  ui.modal = null; sync(); flashToast('保存しました');
}

$('#screen').addEventListener('click', e=>{
  const T = sel => e.target.closest(sel);
  let t;
  if((t = T('[data-reason]'))){ readForm(); ui.form.reason = t.dataset.reason; renderPhone(); return; }
  if((t = T('[data-rtmode]'))){ readForm(); ui.form.mode = t.dataset.rtmode; ui.form.reason = null; renderPhone(); return; }
  if((t = T('[data-undo-ev]'))){
    const no = Number(t.dataset.undoEv), ev = S.events.find(x=>x.no===no);
    act(ev.cut, 'VOID', {voidOf:no, note:`${evText(ev)} を取り消し`});
    const it = ui.scan && ui.scan.items.find(x=>x.no===no); if(it) it.voided = true;
    if(ui.scan && ui.scan.seen && ev.qr) ui.scan.seen.delete(ev.qr);
    renderPhone(); sync(); return;
  }
  if((t = T('[data-person-ev]'))){ const ev = S.events.find(x=>x.no===Number(t.dataset.personEv)); openPerson({kind:'ev', no:ev.no}, ev.stage, ev.person); return; }
  if((t = T('[data-person]'))){ pickPerson(t.dataset.person); return; }
  if((t = T('[data-due-ev]'))){ const ev = S.events.find(x=>x.no===Number(t.dataset.dueEv)); openCal({kind:'ev', no:ev.no}, ev.due); return; }
  if((t = T('[data-day]'))){ if(!t.disabled) pickDay(t.dataset.day); return; }
  if((t = T('[data-sel]'))){ const id = t.dataset.sel; ui.sel = ui.sel || []; ui.sel = ui.sel.includes(id) ? ui.sel.filter(x=>x!==id) : [...ui.sel, id]; renderPhone(); return; }
  if((t = T('[data-okcut]'))){ openOK(t.dataset.okcut); return; }
  if((t = T('[data-rtcut]'))){ openRt(t.dataset.rtcut); return; }
  if((t = T('[data-need]'))){ ui.cut = t.dataset.need; ui.form = {person:'', due:null}; ui.modal = 'pick'; renderPhone(); return; }
  if((t = T('[data-cand]'))){
    const [po, li] = t.dataset.cand.split('|'), o = S.orders.find(x=>x.no===po), l = o.lines[Number(li)];
    const r = act(ui.cut, 'IN', {person:o.vendor, src:SRC_AUTO, po:o.no, poLine:Number(li), provisional:true, due:o.due, dueSrc:SRC_AUTO, sheets:l.sheets ?? null, sheetsSrc:SRC_AUTO, note:`発注番号 ${o.no} の「${l.text}」を仮に紐づけ`});
    afterPick(r); return;
  }
  if((t = T('[data-filter]'))){ ui.filter = t.dataset.filter; renderPhone(); return; }
  if((t = T('[data-ep]'))){ ui.ep = t.dataset.ep; renderPhone(); return; }
  if((t = T('[data-open]'))){ go('cut', {cut:t.dataset.open, from:{ep:ui.ep, q:ui.q, filter:ui.filter}}); return; }
  if((t = T('[data-edit]'))){ openEdit(t.dataset.edit); return; }
  if((t = T('[data-route]'))){ return; }
  t = T('[data-a]'); if(!t) return;
  const a = t.dataset.a;
  if(appAction(a, t)) return;
  if(a==='go'){ const to = t.dataset.to; if(to==='manage' && ui.from) go('manage', ui.from); else go(to); }
  else if(a==='scan'){ go('scanner', {scan:{items:[]}}); }
  else if(a==='goReview'){ go('review'); }
  else if(a==='goManage'){ go('manage'); }
  else if(a==='goDash'){ go('dash'); }
  else if(a==='closeScan'){ const n = ui.scan.items.filter(i=>i.kind==='ok' && !i.voided).length; go('home'); if(n) flashToast(`${n}件を登録しました`); }
  else if(a==='selAll'){ ui.sel = reviewList().map(x=>x.c.id); renderPhone(); }
  else if(a==='bulkOK'){
    const ids = ui.sel || []; let n = 0;
    ids.forEach(id=>{ const d = derive(id), nx = nextOf(d), c = cutById(id); let next = null;
      if(nx && ST[nx].who!=='worker') next = {person:staffFor(c, nx)};
      if(act(id, 'OK', {next}).ok) n++; });
    ui.sel = []; sync(); flashToast(`${n}件を確認OKにしました`);
  }
  else if(a==='closeModal'){ ui.modal = null; renderPhone(); }
  else if(a==='calClose'){ ui.modal = ui.cal.back || null; renderPhone(); }
  else if(a==='personClose'){ ui.modal = ui.person.back || null; renderPhone(); }
  else if(a==='personAddOpen'){ ui.person.adding = true; renderPhone(); const i = $('#newPerson'); if(i) i.focus(); }
  else if(a==='personAdd'){ const v = ($('#newPerson').value||'').trim(); if(!v){ flashToast('名前を入れてください'); return; } S.people = S.people || []; if(!S.people.some(p=>p.name===v && p.stage===ui.person.sid)) S.people.push({name:v, stage:ui.person.sid}); pickPerson(v); }
  else if(a==='formPerson'){ readForm(); const fld = t.dataset.field, sid = ui.modal==='rt' ? ui.form.target : t.dataset.sid; openPerson({kind:'form', field:fld}, sid, ui.form[fld]); }
  else if(a==='formDue'){ readForm(); const fld = t.dataset.field; openCal({kind:'form', field:fld}, ui.form[fld]); }
  else if(a==='dueAll'){ openCal({kind:'all'}, null); }
  else if(a==='calPrev' || a==='calNext'){ const d = new Date(ui.cal.y, ui.cal.m + (a==='calNext'?1:-1), 1); ui.cal.y = d.getFullYear(); ui.cal.m = d.getMonth(); renderPhone(); }
  else if(a==='submitOK'){
    readForm(); const f = ui.form, c = cutById(ui.cut), d = derive(c.id), n = nextOf(d);
    const r = act(c.id, 'OK', {next:{person:f.person, due:f.due}, sheets:f.sheets});
    if(!r.ok){ flashToast(r.msg); return; }
    if(f.req && n) act(c.id, 'REQ', {note:`${c.ep} ${c.no} の ${nameOf(n)} を発注書に足してください（依頼：${OPERATOR}）`});
    ui.modal = null; ui.sel = (ui.sel||[]).filter(x=>x!==c.id); sync(); flashToast(`${c.no} を確認OKにしました`);
  }
  else if(a==='submitRt'){
    readForm(); const f = ui.form, c = cutById(ui.cut);
    if(!f.reason){ flashToast('理由を選んでください'); return; }
    const r = f.mode==='retake' ? act(c.id, 'RETAKE', {target:f.target, person:f.person, due:f.due, reason:f.reason, note:f.note}) : act(c.id, 'RETURN', {due:f.due, reason:f.reason, note:f.note});
    if(!r.ok){ flashToast(r.msg); return; }
    ui.modal = null; sync(); flashToast(f.mode==='retake' ? `${c.no} をリテイクにしました` : `${c.no} を差し戻しました`);
  }
  else if(a==='submitEdit'){ submitEdit(); }
  else if(a==='routeEdit'){ ui.form = {route:null}; ui.modal = 'route'; renderPhone(); }
  else if(a==='submitRoute'){
    const c = cutById(ui.cut), d = derive(c.id);
    const on = new Set([...document.querySelectorAll('[data-route]')].filter(x=>x.checked).map(x=>x.dataset.route));
    const r = STAGES.filter(s=>on.has(s.id)).map(s=>s.id);
    if(r.join()!==d.route.join()) act(c.id, 'ROUTE', {route:r});
    ui.modal = null; sync(); flashToast('通す工程を変えました');
  }
  else if(a==='submitPick'){
    readForm(); const f = ui.form;
    if(!f.person){ flashToast('作業者を選んでください'); return; }
    afterPick(act(ui.cut, 'IN', {person:f.person, src:'', due:f.due, dueSrc:''}));
  }
});
// 発注書に載っていないカット袋を、作業者を選んで配布したあと：読み取りの行を差し替える
function afterPick(r){
  if(!r.ok){ flashToast(r.msg); return; }
  const it = ui.scan && ui.scan.items.find(x=>x.kind==='need' && x.cut===r.ev.cut);
  if(it){ it.kind = 'ok'; it.no = r.ev.no; }
  ui.modal = null; renderPhone(); sync();
}
$('#screen').addEventListener('input', e=>{ if(e.target.id==='findCut'){ ui.q = e.target.value; renderPhone(); } });
