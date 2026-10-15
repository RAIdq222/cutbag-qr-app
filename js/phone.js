/* ================= 画面 ================= */
// ホームはボタン4つ：QRコード読み取り／回収済みカットの確認／進行管理／制作状況を見る。マイページは右上から
const who = () => `<span class="op">ログイン中<b>${esc(OPERATOR)}</b></span>`;
const reviewList = () => S.cuts.map(c=>({c, d:derive(c.id)})).filter(x=>x.d.phase==='review').sort((a,b)=>a.d.since-b.d.since);
const FILTERS = [['all','すべて'],['wait','配布待ち'],['in','作業中・チェック中'],['review','確認待ち'],['retake','リテイク・差し戻し'],['over','納期遅れ'],['done','完了']];
const ICON = {
  scan:'<path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><rect x="7.5" y="7.5" width="9" height="9" rx="1" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  // QRコード：四隅の位置合わせの四角と、点
  qr:'<rect x="3" y="3" width="7" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="14" y="3" width="7" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="3" y="14" width="7" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="5.5" y="5.5" width="2" height="2" fill="currentColor"/><rect x="16.5" y="5.5" width="2" height="2" fill="currentColor"/><rect x="5.5" y="16.5" width="2" height="2" fill="currentColor"/><path d="M14 14h3v3h-3zM18 18h3v3h-3zM18 14h3M14 18v3" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  // 回収済カット：カット袋と、確認のチェック
  review:'<path d="M5 4h10l4 4v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M15 4v4h4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8 13.5l2.6 2.6L16 11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  // 進捗表：表と鉛筆
  manage:'<rect x="2.5" y="4" width="15" height="14" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M2.5 8.5h15M2.5 13h15M7.5 4v14M12.5 4v14" stroke="currentColor" stroke-width="1.3"/><path d="M14.5 20.5l1-3.6 5.4-5.4a1.5 1.5 0 0 1 2.1 2.1l-5.4 5.4-3.1 1.5Z" fill="var(--tile-bg)" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
  // ダッシュボード：棒グラフと折れ線
  dash:'<path d="M3 21h18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><rect x="4.5" y="13" width="3" height="8" rx=".5" fill="currentColor" opacity=".45"/><rect x="10.5" y="10" width="3" height="11" rx=".5" fill="currentColor" opacity=".45"/><rect x="16.5" y="7" width="3" height="14" rx=".5" fill="currentColor" opacity=".45"/><path d="M4 11l6-4 5 3 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="4" cy="11" r="1.5" fill="currentColor"/><circle cx="10" cy="7" r="1.5" fill="currentColor"/><circle cx="15" cy="10" r="1.5" fill="currentColor"/><circle cx="21" cy="4" r="1.5" fill="currentColor"/>',
  me:'<circle cx="12" cy="8.5" r="3.6" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M4.5 20c1.3-3.7 4.2-5.5 7.5-5.5s6.2 1.8 7.5 5.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>',
  x:'<path d="M7 7l10 10M17 7L7 17" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  rt:'<path d="M9 7H5V3" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/><path d="M5.6 7A8 8 0 1 1 4 12" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/>',
};
const svg = (k, s=24) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true">${ICON[k]}</svg>`;
const stg = sid => sid ? `<span class="stg ${GCLASS[ST[sid].g]||''}">${esc(nameOf(sid))}</span>` : '<span class="stg-ph"></span>';
const back = (to='home', label='戻る') => `<button class="back" data-a="go" data-to="${to}" aria-label="${label}">‹</button>`;
// モーダルの上に出す見出し：作品・話数・カット・工程
const ctxLine = (c, sid) => `<p class="mctx">${esc(titleOf())}　${esc(c.ep)}　<b>${esc(c.no)}</b>${sid?'　'+esc(nameOf(sid)):''}</p>`;

let lastScreen = null;
function renderPhone(){
  const el = $('#screen');
  const keep = document.activeElement && document.activeElement.id==='findCut';
  let h = '';
  const V = {home:homeView, scanner:scannerView, review:reviewView, manage:manageView, cut:cutView, dash:dashView, dashEp:dashEpView, settings:settingsView, register:registerView};
  h += (V[ui.screen] || homeView)();
  if(ui.modal) h += `<div class="scrim" data-a="closeModal"></div>` + modalView();
  if(ui.toast) h += `<div class="toast" role="status">${esc(ui.toast)}</div>`;
  if(ui.done) h += doneView();
  el.innerHTML = h;
  if(ui.screen !== lastScreen){ el.querySelectorAll('.body,.appbar').forEach(b=>b.classList.add('enter')); lastScreen = ui.screen; }
  if(keep){ const f = $('#findCut'); if(f){ f.focus(); f.setSelectionRange(f.value.length, f.value.length); } }
  afterRender();
}
function go(screen, extra={}){ const done = ui && ui.done; ui = {screen, ...extra}; if(done && done.state==='sending') ui.done = done; renderPhone(); }
// 登録したときのポップアップ：送っているあいだ→届いた（大きなチェック）／送れなかった
function doneView(){
  const d = ui.done;
  const icon = d.state==='ok' ? `<svg viewBox="0 0 24 24" width="72" height="72" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="currentColor"/><path d="M6.8 12.4l3.4 3.4 7-7.2" fill="none" stroke="var(--pop-bg)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`
    : d.state==='err' ? `<svg viewBox="0 0 24 24" width="64" height="64" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="currentColor"/><path d="M12 6.5v7M12 17v.5" stroke="var(--pop-bg)" stroke-width="2.6" stroke-linecap="round"/></svg>`
    : `<span class="spin" aria-hidden="true"></span>`;
  const text = d.state==='ok' ? `${d.n}件をスプレッドシートに登録しました！` : d.state==='err' ? `${d.n}件を端末に残しました。つながったら送ります` : `${d.n}件をスプレッドシートに送っています…`;
  return `<button type="button" class="donepop ${d.state}" data-a="donePopClose" role="status">${icon}<b>${esc(text)}</b></button>`;
}

/* ---------- ホーム ---------- */
function homeView(){
  const n = reviewList().length;
  const tile = (a, icon, label, badge) => `<button type="button" class="tile${a==='scan'?' main':''}" data-a="${a}">${svg(icon, 60)}<b>${label}</b>${badge ? `<em class="badge">${badge}</em>` : ''}</button>`;
  return `<div class="appbar"><h3>カット袋QR</h3>${who()}<button type="button" class="gear" data-a="go" data-to="settings" aria-label="マイページ">${svg('me', 24)}</button></div>
  <div class="body home">
    ${oldDataLine()}${warnLine()}
    <div class="tiles">
      ${tile('scan','qr','QRコード読取')}
      ${tile('goReview','review','回収済カットの確認', n ? n+'件' : '')}
      ${tile('goManage','manage','進捗表の確認・修正')}
      ${tile('goDash','dash','制作ダッシュボード')}
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
    if(e.type==='IN') main = `${stg(e.stage)}<span class="sr-act">配布</span><span class="sr-who"><button type="button" class="person-btn" data-person-ev="${e.no}">${esc(e.person)}</button><button type="button" class="due-btn${e.due?'':' missing'}" data-due-ev="${e.no}">${e.due ? '納期 '+fD(e.due) : '納期未入力'}</button></span>`;
    else if(e.type==='UP') main = `${stg(e.stage)}<span class="sr-act">回収</span><span class="sr-who sr-from">${esc(e.person||'')}</span>`;
    else main = `${stg(e.stage)}<span class="sr-act wide">${esc(it.text)}</span>`;
    tail = `<button type="button" class="xbtn" data-undo-ev="${e.no}" aria-label="取り消し">${svg('x', 18)}</button>`;
  } else if(it.kind==='ok' && it.voided){
    main = `${stg(e && e.stage)}<span class="sr-act wide">取り消しました</span>`;
  } else if(it.kind==='need'){
    main = `${stg(it.stage)}<span class="sr-act">配布</span><span class="sr-who"><span class="sr-warn">発注書に載っていません</span><button type="button" class="pick-need" data-need="${it.cut}">作業者を選ぶ</button></span>`;
  } else {
    main = `${stg(it.stage)}<span class="sr-act wide">${esc(it.text)}</span>`;
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
  return `<div class="appbar"><button class="back" data-a="scanBack" aria-label="戻る">‹</button><h3>QRコード読取</h3></div>
  <div class="body scan-body">
    <div class="finder cam${ui.scanning?' scanning':''}"><video id="cam" playsinline muted autoplay></video><span class="corner c1"></span><span class="corner c2"></span><span class="corner c3"></span><span class="corner c4"></span><span class="laser"></span>
      ${camMsg() ? `<span class="ftext">${camMsg()}</span>` : ''}</div>
    <div class="sess-count"><span><b>${nIn+nUp}</b>件<small>（配布 ${nIn}・回収 ${nUp}）</small></span>${sessionIns().length>1 ? `<button type="button" class="linkbtn due-all" data-a="dueAll">納期をまとめて設定</button>` : ''}</div>
    ${s.items.length ? `<ul class="sess-list">${[...s.items].reverse().map(scanRow).join('')}</ul>` : ''}
    <button type="button" class="act sticky" data-a="closeScan">完了（登録する）</button>
  </div>`;
}
// 読み取った分は「完了」で登録する。それまでは下書き（スプレッドシートには送らない）
const sessionEvents = sc => sc ? sc.items.filter(i=>i.no && !i.voided).map(i=>S.events.find(e=>e.no===i.no)).filter(e=>e && e.draft) : [];
function dropDrafts(sc){ const ids = new Set(sessionEvents(sc).map(e=>e.no)); S.events = S.events.filter(e=>!ids.has(e.no)); }
function scanBackView(){
  const n = sessionEvents(ui.scan).length;
  return `<div class="sheetm" role="dialog" aria-label="読み取りをやめる"><h4>読み取った ${n}件を取り消して戻ります</h4>
    <p class="mnote">登録するときは「完了（登録する）」を押します。</p>
    <div class="row2"><button class="act ghost" data-a="closeModal">読み取りに戻る</button><button class="act rtb" data-a="scanDiscard">取り消して戻る</button></div></div>`;
}

/* ---------- 回収済みカットの確認 ---------- */
function reviewView(){
  const list = reviewList();
  return `<div class="appbar">${back('home')}<h3>回収済カットの確認</h3></div>
  <div class="body">
    ${list.length ? `<div class="rv-tools"><span class="mnote">確認待ち ${list.length}件</span></div>
    <div class="rv-list">${list.map(({c,d})=>{ return `<div class="rv-row">
      <button type="button" class="rv-main" data-okcut="${c.id}"><span class="rv-ctx">${esc(c.ep)}　<b>${esc(c.no)}</b>　${stg(d.sid)}${d.ret?'<span class="tagx">差し戻し分</span>':d.open?'<span class="tagx">リテイク分</span>':''}</span><span class="rv-sub">${esc(d.from||'')} から回収　${fD(d.since)}</span></button>
      <button type="button" class="rv-ok" data-okcut="${c.id}">確認OK</button>
      <button type="button" class="rv-rt" data-rtcut="${c.id}" aria-label="${c.no} をリテイク・差し戻し">${svg('rt', 20)}</button></div>`; }).join('')}</div>`
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
// カットの一覧の1行：状態・担当、いつ入っていつが納期か。日数が経ったら黄色、納期を過ぎたら赤
function cutRow(c, d, opt={}){
  const st = statusOf(d), t = cutDates(d);
  const dates = [];
  if(t.at) dates.push(`${t.label} ${fD(t.at)}${t.days!=null && t.days>=STALE_DAYS ? `<em class="aged">${t.days}日経過</em>` : ''}`);
  else if(t.label!=='IN') dates.push(t.label);
  if(d.phase==='in') dates.push(t.due ? `納期 ${fD(t.due)}${t.over ? '<em class="late">納期超過</em>' : ''}` : '納期 未入力');
  const who = d.phase==='in' ? `<span class="fr-who">${esc(d.holder)}</span>` : '';
  return `<button type="button" class="find-row" data-open="${c.id}"><b>${opt.ep ? `<small>${esc(c.ep)}</small>` : ''}${esc(c.no)}</b><span class="fr-st"><i class="dot ${st.k}"></i>${esc(stateText(d))}${who}</span><small class="fr-dates">${dates.join('　')}</small></button>`;
}
function manageView(){
  const eps = epsOf(), ep = ui.ep && eps.includes(ui.ep) ? ui.ep : eps[0];
  const q = (ui.q||'').replace(/\D/g,''), f = ui.filter || 'all';
  const all = S.cuts.filter(c=>c.ep===ep).sort((a,b)=>a.no.localeCompare(b.no)).map(c=>({c, d:derive(c.id)}));
  const found = all.filter(x=>(!q || String(Number(x.c.no.slice(1))).startsWith(String(Number(q)))) && filterMatch(x.d, f));
  return `<div class="appbar">${back('home')}<h3>進捗表の確認・修正</h3></div>
  <div class="body">
    <div class="mg-top">${pjLine()}${syncLine()}${oldDataLine()}${warnLine()}</div>
    <div class="ep-tabs">${eps.map(e=>`<button type="button" class="ep-tab${e===ep?' on':''}" data-ep="${esc(e)}">${esc(e)}</button>`).join('')}</div>
    <p class="ep-owner">話数担当：<b>${esc(epOwner(ep) || '未入力')}</b></p>
    <input id="findCut" type="search" inputmode="numeric" placeholder="番号で検索（例：13）" value="${esc(ui.q||'')}" aria-label="番号で検索">
    <div class="chips">${FILTERS.map(([k,n])=>`<button type="button" class="chipf${f===k?' on':''}" data-filter="${k}">${n}</button>`).join('')}</div>
    <div class="find-list">${found.map(({c,d})=>cutRow(c, d)).join('') || '<p class="batch-empty">当てはまるカットは0件です</p>'}</div>
  </div>`;
}
// カットの状況：工程の流れに沿って、誰がやったか・いつ入って（IN）いつ上がったか（UP）・納期を並べる。
// 今の工程と先の工程だけ、行を押して入力できる。終わった工程は締めてある（直すときはスプレッドシートで）
function cutView(){
  const c = cutById(ui.cut), d = derive(c.id), st = statusOf(d);
  const curI = d.sid ? d.route.indexOf(d.sid) : d.route.length;
  const rows = d.route.map((sid,i)=>{
    const x = d.cells[sid] || {}, mode = editMode(d, sid);
    const cls = (i<curI ? 'done' : i===curI ? 'cur' : 'todo') + (mode ? ' can' : ' lock');
    const person = x.person || (i>=curI && ST[sid].who!=='worker' ? staffFor(c, sid) : '');
    const due = x.due ? `<span class="${d.overdue && sid===d.sid ? 'over':''}">${fD(x.due)}</span>` : '';
    const rt = x.rin ? `<span class="tagx">R ${fD(x.rin)}${x.rup?'→'+fD(x.rup):''}</span>` : x.rtc ? `<span class="tagx">指摘 ${fD(x.rtc)}</span>` : '';
    return `<li class="fl ${cls}"${mode ? ` data-edit="${sid}"` : ''}><span class="fl-st">${stg(sid)}</span><span class="fl-who">${esc(person)}${rt}</span><span class="fl-d">${fD(x.in)}</span><span class="fl-d">${fD(x.up)}</span><span class="fl-d">${due}</span></li>`;
  }).join('');
  const mine = S.events.filter(e=>e.cut===c.id && e.type!=='VOID' && !e.draft), voided = voidedSet();
  return `<div class="appbar"><button class="back" data-a="cutBack" aria-label="戻る">‹</button><h3>カットの状況</h3></div>
  <div class="body">
    <div class="cuthead"><div><div class="sub">${esc(titleOf())}　${esc(c.ep)}</div><div class="big">${esc(c.no)}</div><div class="sub">パート${esc(c.part||'')}　${esc(c.sec||'')}秒</div></div>
      <div class="ch-st"><span class="chip ${st.k}">${esc(stateText(d))}</span>${d.stale ? `<span class="stop">止まっている：${esc(d.holder)}（${d.days}日）</span>` : ''}</div></div>
    <ol class="flow2"><li class="fl head"><span>工程</span><span>担当</span><span class="fl-d">IN</span><span class="fl-d">UP</span><span class="fl-d">納期</span></li>${rows}</ol>
    ${d.phase!=='done' ? `<div class="flow-tools"><button type="button" class="linkbtn" data-a="routeEdit">工程の追加・削除</button></div>` : ''}
    <div><div class="lbl">履歴（だれが・いつ更新したか）</div><ul class="hist2">${[...mine].reverse().map(e=>`<li class="${voided.has(e.no)?'void':''}">
      <span class="h-meta"><span class="t">${fDT(e.ts)}</span><span class="w">${esc(e.op||'')}</span><span class="via ${e.via==='sheet'?'sheet':''}">${e.via==='sheet'?'スプレッドシート':'アプリ'}</span>${e.ets && e.ts!==e.ets ? `<span class="late-in">入力 ${fDT(e.ets)}</span>` : ''}</span>
      <span class="h-what ${e.type==='RETAKE'||e.type==='RETURN'?'r':''}">${esc(evText(e))}</span></li>`).join('')}</ul></div>
  </div>`;
}

/* ---------- 制作ダッシュボード ---------- */
// 作品全体（全体と話数ごとの進捗率）→ 話数を押すと話数の詳細。下に担当者別の手持ち（制作進行／作画・チェック）
const pctOf = list => { let p = 0, t = 0; list.forEach(({d})=>{ t += d.route.length; p += d.sid ? d.route.indexOf(d.sid) : d.route.length; }); return t ? Math.round(p/t*100) : 0; };
const withD = cuts => cuts.map(c=>({c, d:derive(c.id)}));
function dashView(){
  const all = withD(S.cuts), eps = epsOf();
  const over = all.filter(x=>x.d.overdue).length, done = all.filter(x=>x.d.phase==='done').length;
  const tab = ui.dashTab || 'staff';
  const epRows = eps.map(ep=>{ const l = all.filter(x=>x.c.ep===ep), p = pctOf(l), o = l.filter(x=>x.d.overdue).length;
    return `<button type="button" class="ep-row" data-dash-ep="${esc(ep)}"><span class="er-h"><b>${esc(ep)}${o ? `<em class="late">納期超過 ${o}</em>` : ''}</b><small>${l.length}カット・話数担当 ${esc(epOwner(ep)||'未入力')}</small></span><span class="er-bar"><span class="pbar"><i style="width:${p}%"></i></span><b>${p}%</b></span><span class="chev" aria-hidden="true">›</span></button>`; }).join('');
  // 制作進行ごと：担当の話数の、まだ終わっていないカット
  const owners = [...new Set(eps.map(epOwner).filter(Boolean))];
  const staffRows = owners.map(o=>{ const l = all.filter(x=>epOwner(x.c.ep)===o && x.d.phase!=='done');
    const n = k => l.filter(x=>x.d.phase===k).length, ov = l.filter(x=>x.d.overdue).length;
    return `<li><div><b>${esc(o)}</b><small>担当 ${eps.filter(e=>epOwner(e)===o).map(esc).join('・')}　配布待ち ${n('wait')}・作業中 ${n('in')}・確認待ち ${n('review')}${ov ? `　<span class="late">納期超過 ${ov}</span>` : ''}</small></div><em>${l.length}</em></li>`; }).join('');
  // 作画・チェック：今カット袋を持っている人
  const hold = new Map();
  all.forEach(({c,d})=>{ if(d.phase!=='in') return; if(!hold.has(d.holder)) hold.set(d.holder, []); hold.get(d.holder).push({c, d}); });
  const workRows = [...hold.entries()].sort((a,b)=>b[1].length-a[1].length).map(([p, xs])=>`<li><div><b>${esc(p)}</b><small>${xs.map(({c,d})=>{ const t = cutDates(d); return `<span class="${d.overdue?'late':''}">${esc(c.ep)} ${esc(c.no)}（${esc(nameOf(d.sid))}・納期 ${t.due ? fD(t.due) : '未入力'}${d.overdue?'・納期超過':''}）</span>`; }).join('　')}</small></div><em>${xs.length}</em></li>`).join('');
  return `<div class="appbar">${back('home')}<h3>制作ダッシュボード</h3></div>
  <div class="body">
    <section class="dash-card"><h5>${esc(titleOf())}<small>作品全体・${all.length}カット</small></h5>
      <div class="pbar"><i style="width:${pctOf(all)}%"></i></div>
      <p class="dash-num"><b>${pctOf(all)}</b>%<small>完了 ${done}/${all.length}カット${over ? `　<span class="late">納期超過 ${over}カット</span>` : ''}</small></p>
      <div class="ep-rows">${epRows}</div></section>
    <section class="dash-card"><h5>担当者別の手持ち</h5>
      <div class="seg two"><button type="button" class="${tab==='staff'?'on':''}" data-dash-tab="staff">制作進行</button><button type="button" class="${tab==='work'?'on':''}" data-dash-tab="work">作画・チェック</button></div>
      <ul class="hold">${tab==='staff' ? staffRows : workRows}</ul></section>
  </div>`;
}
// 話数の詳細：工程ごとのカット数（配布待ち・作業中・確認待ち）と、各カットの状態
function dashEpView(){
  const ep = ui.ep, list = withD(S.cuts.filter(c=>c.ep===ep)).sort((a,b)=>a.c.no.localeCompare(b.c.no));
  const used = STAGES.filter(s=>list.some(x=>x.d.route.includes(s.id)));
  const done = list.filter(x=>x.d.phase==='done').length, p = pctOf(list), max = Math.max(1, ...used.map(s=>list.filter(x=>x.d.sid===s.id).length));
  const rows = used.map(s=>{ const at = list.filter(x=>x.d.sid===s.id), n = k => at.filter(x=>x.d.phase===k).length;
    return `<li><span class="stg ${GCLASS[s.g]||''}">${esc(s.name)}</span><span class="sbar">${['wait','in','review'].map(k=>n(k) ? `<i class="${k}" style="width:${n(k)/max*100}%"></i>` : '').join('')}</span><b>${at.length}</b></li>`; }).join('');
  return `<div class="appbar">${back('dash')}<h3>${esc(ep)} の詳細</h3></div>
  <div class="body">
    <section class="dash-card"><h5>${esc(titleOf())}　${esc(ep)}<small>話数担当 ${esc(epOwner(ep)||'未入力')}</small></h5>
      <div class="pbar"><i style="width:${p}%"></i></div><p class="dash-num"><b>${p}</b>%<small>完了 ${done}/${list.length}カット</small></p></section>
    <section class="dash-card"><h5>工程ごとのカット数<small><i class="key wait"></i>配布待ち <i class="key in"></i>作業中 <i class="key review"></i>確認待ち</small></h5>
      <ul class="stage-count">${rows}<li><span class="stg g-done">完了</span><span class="sbar"><i class="done" style="width:${done/Math.max(max,done)*100}%"></i></span><b>${done}</b></li></ul></section>
    <section class="dash-card"><h5>カットの状態</h5><div class="find-list">${list.map(({c,d})=>cutRow(c, d)).join('')}</div></section>
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
  if(e.type==='SET'){ const v = ['in','up','due','rin','rup'].includes(e.field) ? (fD(e.value) || '空') : (e.value ?? '空'); return `${s}の${FIELD_NAME[e.field]||e.field}を ${v} にした`; }
  if(e.type==='ROUTE') return `工程を ${e.route.map(nameOf).join('→')} にした`;
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
    const mark = v===today ? '<small>今日</small>' : v===sel ? '<small>予定</small>' : '';
    cells.push(`<button type="button" class="${cls}" data-day="${v}"${v<today?' disabled':''}><span>${dd}</span>${mark}</button>`);
  }
  const ctx = info.c ? ctxLine(info.c, info.sid) : `<p class="mctx">この読み取りで配布した ${sessionIns().length}件</p>`;
  return `<div class="sheetm" role="dialog" aria-label="納期">${ctx}<h4>納期を選ぶ</h4>
    <div class="cal-h"><button type="button" class="linkbtn" data-a="calPrev" aria-label="前の月">‹</button><b>${y}年${m+1}月</b><button type="button" class="linkbtn" data-a="calNext" aria-label="次の月">›</button></div>
    <div class="cal"><span class="red">日</span><span>月</span><span>火</span><span>水</span><span>木</span><span>金</span><span>土</span>${cells.join('')}</div>
    <button class="closebtn" data-a="calClose">閉じる</button></div>`;
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
    <button class="closebtn" data-a="personClose">閉じる</button></div>`;
}
function pickPerson(name){
  const p = ui.person, t = p.target;
  if(t.kind==='ev'){ const e = S.events.find(x=>x.no===t.no); e.person = name; e.src = ''; sync(); }
  else ui.form[t.field] = name;
  ui.modal = p.back || null; renderPhone();
}
function modalView(){
  if(ui.modal==='pj') return pjView();
  if(ui.modal==='warn') return warnView();
  if(ui.modal==='cal') return calView();
  if(ui.modal==='person') return personView();
  if(ui.modal==='regConfirm') return regConfirmView();
  if(ui.modal==='scanBack') return scanBackView();
  const c = cutById(ui.cut), d = derive(c.id), f = ui.form || {};
  const close = `<button class="closebtn" data-a="closeModal">閉じる</button>`;
  const pills = (list, cur) => `<div class="pills">${list.map(r=>`<button type="button" class="pill${cur===r?' sel':''}" data-reason="${esc(r)}">${esc(r)}</button>`).join('')}</div>`;
  const pickBtn = (field, sid, label='配布先') => `<div class="field"><span class="lbl">${label}</span><button type="button" class="fbtn${f[field]?'':' missing'}" data-a="formPerson" data-field="${field}" data-sid="${sid}">${f[field] ? esc(f[field]) : '未入力'}</button></div>`;
  const dueBtnF = (field='due', label='納期') => `<div class="field"><span class="lbl">${label}</span><button type="button" class="fbtn${f[field]?'':' missing'}" data-a="formDue" data-field="${field}">${f[field] ? fD(f[field]) : '未入力'}</button></div>`;
  if(ui.modal==='ok'){
    const n = nextOf(d), work = ST[d.sid].kind==='work', x = d.cells[d.sid] || {};
    const needPo = n && ST[n].po && !findOrderLine(c.id, n);
    return `<div class="sheetm" role="dialog" aria-label="確認OK">${ctxLine(c, d.sid)}<h4>確認OK</h4>
      <p class="mnote">${esc(d.from||'')} から ${fD(d.since)} に回収。次は ${n ? `<b>${esc(nameOf(n))}</b>` : '<b>完了</b>'}です。</p>
      ${n ? pickBtn('person', n, `配布先（${esc(nameOf(n))}）`) + dueBtnF('due', '納期') : ''}
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
    const sid = f.sid, mode = editMode(d, sid);
    const title = mode==='plan' ? '担当・納期の予定' : mode==='wait' ? '配布の入力' : '入力';
    const hint = mode==='wait' ? 'IN を入れると、配布したことになります。' : mode==='in' ? 'UP を入れると、回収したことになります。' : '先の工程の担当と納期を、前もって決めておけます。';
    return `<div class="sheetm" role="dialog" aria-label="${title}">${ctxLine(c, sid)}<h4>${title}</h4>
      ${pickBtn('person', sid, '担当')}
      ${mode==='plan' ? '' : `<div class="row2"><div class="field"><label class="lbl" for="edIn">IN</label><input id="edIn" type="date" max="${ymd(clock())}" value="${f.in?ymd(f.in):''}"></div>
        <div class="field"><label class="lbl" for="edUp">UP</label><input id="edUp" type="date" max="${ymd(clock())}" value="${f.up?ymd(f.up):''}"${mode==='wait' ? ' disabled' : ''}></div></div>`}
      ${dueBtnF()}
      ${ST[sid].kind==='work' && mode!=='plan' ? `<div class="field"><label class="lbl" for="edSheets">枚数</label><input id="edSheets" type="number" inputmode="numeric" min="0" value="${esc(f.sheets ?? '')}"></div>` : ''}
      <p class="mnote">${hint}</p>
      <button class="act" data-a="submitEdit">保存</button>${close}</div>`;
  }
  if(ui.modal==='route'){
    const curI = d.sid ? d.route.indexOf(d.sid) : d.route.length;
    const groups = [...new Set(STAGES.filter(s=>s.g && ST[s.id]).map(s=>s.g))];
    const after = s => { const r = [...new Set([...d.route, s.id])].sort((a,b)=>ORDER[a]-ORDER[b]); return r.indexOf(s.id) > curI; };
    return `<div class="sheetm" role="dialog" aria-label="工程の追加・削除">${ctxLine(c)}<h4>工程の追加・削除</h4>
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
  if(q.status==='revoked'){ const r = act(q.cut,'ALERT',{qr:token, note:'使えなくしたQRを読み取り（更新しない）'}); r.ev.draft = true; push({no:r.ev.no, text:'旧ラベルです。カット袋のラベルを確かめてください', kind:'bad'}); return; }
  if(d.phase==='review'){ push({stage:d.sid, text:'回収済み（回収済みカットの確認で確認します）', kind:'info'}); return; }
  if(d.phase==='done'){ push({text:'完了したカットです', kind:'info'}); return; }
  const r = defaultAct(q.cut, {qr:token});
  if(r.ok){ r.ev.draft = true; push({no:r.ev.no, kind:'ok'}); return; }
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
  if(!editMode(d, sid)) return;
  const day = t => t ? dayTs(ymd(t)) : null;
  // 作業中にリテイク・差し戻しで戻っているときは、リテイクの IN・UP を入れる
  const re = sid===d.sid && (d.open || d.ret) && x.rin;
  ui.form = {sid, re, person: x.person || (ST[sid].who!=='worker' ? staffFor(c, sid) : ''), in:day(re ? x.rin : x.in), up:day(re ? x.rup : x.up), due:day(x.due), sheets:x.sheets ?? ''};
  ui.form0 = {...ui.form};
  ui.modal = 'edit'; renderPhone();
}
// 日付の決まり：今日まで。IN は前の工程の UP 以降、UP は IN 以降
function checkDates(f, d){
  const end = startOfDay(clock()) + DAY - 1, pu = prevUp(d, f.sid);
  if((f.in && f.in > end) || (f.up && f.up > end)) return '今日までの日付を入れてください';
  if(f.in && pu && startOfDay(f.in) < startOfDay(pu)) return `IN は、前の工程の UP（${fD(pu)}）以降の日付を入れてください`;
  if(f.up && f.in && startOfDay(f.up) < startOfDay(f.in)) return 'UP は、IN 以降の日付を入れてください';
  if(f.up && !f.in) return 'UP の前に IN を入れてください';
  return '';
}
function submitEdit(){
  readForm();
  const f = ui.form, f0 = ui.form0, c = cutById(ui.cut), d = derive(c.id), sid = f.sid, mode = editMode(d, sid);
  if(!mode){ ui.modal = null; renderPhone(); return; }
  const changed = k => String(f[k] ?? '') !== String(f0[k] ?? '');
  const err = mode==='plan' ? '' : checkDates(f, d);
  if(err){ flashToast(err); return; }
  if(mode==='wait' && f.in){
    const r = act(c.id, 'IN', {person:f.person, src:'', due:f.due, dueSrc:'', late:true, ets:clock(), sheets: f.sheets!=='' ? Number(f.sheets) : null}, f.in);
    if(!r.ok){ flashToast(r.msg); return; }
  } else {
    const keys = mode==='plan' ? ['person','due'] : mode==='wait' ? ['person','due','sheets'] : ['person','in','due','sheets'];
    keys.forEach(k=>{ if(changed(k)) act(c.id, 'SET', {stage:sid, field: k==='in' && f.re ? 'rin' : k, value: k==='sheets' ? Number(f[k]) : f[k]}); });
    if(mode==='in' && f.up){ const r = act(c.id, 'UP', {late:true, ets:clock()}, f.up); if(!r.ok){ flashToast(r.msg); return; } }
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
    if(ev.draft) S.events = S.events.filter(x=>x.no!==no);
    else act(ev.cut, 'VOID', {voidOf:no, note:`${evText(ev)} を取り消し`});
    const it = ui.scan && ui.scan.items.find(x=>x.no===no); if(it) it.voided = true;
    if(ui.scan && ui.scan.seen && ev.qr) ui.scan.seen.delete(ev.qr);
    renderPhone(); sync(); return;
  }
  if((t = T('[data-person-ev]'))){ const ev = S.events.find(x=>x.no===Number(t.dataset.personEv)); openPerson({kind:'ev', no:ev.no}, ev.stage, ev.person); return; }
  if((t = T('[data-person]'))){ pickPerson(t.dataset.person); return; }
  if((t = T('[data-due-ev]'))){ const ev = S.events.find(x=>x.no===Number(t.dataset.dueEv)); openCal({kind:'ev', no:ev.no}, ev.due); return; }
  if((t = T('[data-day]'))){ if(!t.disabled) pickDay(t.dataset.day); return; }
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
  if((t = T('[data-open]'))){ go('cut', {cut:t.dataset.open, from:{screen:ui.screen, ep:ui.ep, q:ui.q, filter:ui.filter}}); return; }
  if((t = T('[data-dash-ep]'))){ go('dashEp', {ep:t.dataset.dashEp}); return; }
  if((t = T('[data-dash-tab]'))){ ui.dashTab = t.dataset.dashTab; renderPhone(); return; }
  if((t = T('[data-edit]'))){ openEdit(t.dataset.edit); return; }
  if((t = T('[data-route]'))){ return; }
  t = T('[data-a]'); if(!t) return;
  const a = t.dataset.a;
  if(appAction(a, t)) return;
  if(a==='go'){ go(t.dataset.to); }
  else if(a==='cutBack'){ const f = ui.from || {screen:'manage'}; go(f.screen || 'manage', {ep:f.ep, q:f.q, filter:f.filter}); }
  else if(a==='scan'){ go('scanner', {scan:{items:[]}}); }
  else if(a==='goReview'){ go('review'); }
  else if(a==='goManage'){ go('manage'); }
  else if(a==='goDash'){ go('dash'); }
  else if(a==='closeScan'){
    const evs = sessionEvents(ui.scan), noDue = evs.filter(e=>e.type==='IN' && !e.due).length;
    if(noDue){ flashToast(`納期未入力が ${noDue}件あります`); return; }
    evs.forEach(e=>{ delete e.draft; });
    const n = evs.filter(e=>e.type!=='ALERT').length;
    go('home');
    // スプレッドシートに届いたら「登録しました」に変わる（donePop は app.js）
    if(evs.length){ if(n) donePop(n, evs.map(e=>e.no)); sync(); }
  }
  else if(a==='scanBack'){ if(sessionEvents(ui.scan).length){ ui.modal = 'scanBack'; renderPhone(); } else go('home'); }
  else if(a==='scanDiscard'){ dropDrafts(ui.scan); go('home'); flashToast('読み取った分を取り消しました'); }
  else if(a==='closeModal'){ ui.modal = null; renderPhone(); }
  else if(a==='donePopClose'){ ui.done = null; renderPhone(); }
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
    ui.modal = null; sync(); flashToast(`${c.no} を確認OKにしました`);
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
    ui.modal = null; sync(); flashToast('工程を変えました');
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
  if(it){ it.kind = 'ok'; it.no = r.ev.no; r.ev.draft = true; }
  ui.modal = null; renderPhone();
}
$('#screen').addEventListener('input', e=>{ if(e.target.id==='findCut'){ ui.q = e.target.value; renderPhone(); } });
