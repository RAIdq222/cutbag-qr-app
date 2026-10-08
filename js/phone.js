/* ================= phone ================= */
// 画面は3つだけ：ホーム（QRを読む・手元で確認待ち・カットを探す）／読み取り／カットの状況
function statusBar(){ return ''; }
const who = () => `<span class="op">ログイン中<b>${esc(OPERATOR)}</b></span>`;
const reviewList = () => S.cuts.map(c=>({c, d:derive(c.id)})).filter(x=>x.d.phase==='review').sort((a,b)=>a.d.since-b.d.since);
const FILTERS = [['all','すべて'],['wait','配布待ち'],['in','作業中・チェック中'],['review','確認待ち'],['done','完了']];
let lastScreen = null;
function renderPhone(){
  const el = $('#screen');
  const focusFind = document.activeElement && document.activeElement.id==='findCut';
  let h = statusBar();
  if(ui.screen==='home') h += homeView();
  else if(ui.screen==='scanner') h += scannerView();
  else if(ui.screen==='cut') h += cutView();
  else if(ui.screen==='revoked') h += revokedView();
  else if(ui.screen==='settings') h += settingsView();
  else if(ui.screen==='register') h += registerView();
  if(ui.modal) h += `<div class="scrim" data-a="closeModal"></div>` + modalView();
  if(ui.toast) h += `<div class="toast" role="status">${esc(ui.toast)}</div>`;
  el.innerHTML = h;
  if(ui.screen !== lastScreen){ el.querySelectorAll('.body,.appbar').forEach(b=>b.classList.add('enter')); lastScreen = ui.screen; }
  if(focusFind){ const f=$('#findCut'); if(f){ f.focus(); f.setSelectionRange(f.value.length, f.value.length); } }
  afterRender();
}
function banner(){
  const l = ui.last; if(!l) return '';
  return `<div class="lastres${l.voided?' void':''}"><span class="ok-mark" aria-hidden="true">${l.voided?'↺':'✓'}</span><div>${l.cutNo?`<b>${esc(l.cutNo)}</b> `:''}${esc(l.text)}${l.voided?'<small>取り消しました</small>':''}</div>${l.voided||!l.no?'':`<button type="button" class="linkbtn" data-undo-ev="${l.no}">取り消し</button>`}</div>`;
}
function filterMatch(d, f){
  if(f==='all') return true;
  if(f==='in') return d.phase==='in';
  return d.phase===f;
}
function homeView(){
  const list = reviewList(), sel = ui.sel || [];
  const q = (ui.q||'').replace(/\D/g,''), f = ui.filter || 'all';
  const found = S.cuts.map(c=>({c, d:derive(c.id)})).filter(x=>(!q || String(Number(x.c.no.slice(1))).startsWith(String(Number(q))) ) && filterMatch(x.d, f));
  return `<div class="appbar"><h3>カット袋QR</h3>${who()}<button type="button" class="gear" data-a="settings" aria-label="設定"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7.4-2.5a7.6 7.6 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.4 7.4 0 0 0-1.7-1L15 3.5h-4l-.3 2.5a7.4 7.4 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 0 0 0 2l-2 1.6 2 3.4 2.4-1c.5.4 1.1.8 1.7 1l.3 2.5h4l.3-2.5c.6-.2 1.2-.6 1.7-1l2.4 1 2-3.4-2-1.6Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg></button></div>
  <div class="body">
    ${pjLine()}
    ${syncLine()}
    ${banner()}
    <button type="button" class="scan-cta" data-a="scan"><svg class="scan-ico" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><rect x="7.5" y="7.5" width="9" height="9" rx="1" fill="none" stroke="currentColor" stroke-width="1.8"/></svg><b>QRコード読み取り</b></button>
    <section class="home-sec home-review"><h5>手元で確認待ち <em>${list.length}件</em></h5>
      ${list.length ? `<div class="rv-tools"><button type="button" class="linkbtn" data-a="selAll">すべて選ぶ</button></div>
      <div class="rv-list">${list.map(({c,d})=>{ const on=sel.includes(c.id); return `<div class="rv-row${on?' on':''}">
        <button type="button" class="rv-chk" data-sel="${c.id}" aria-pressed="${on}" aria-label="${c.no} を選ぶ">${on?'✓':''}</button>
        <div class="rv-main"><b>${c.no}</b><span>${esc(d.from||'')} から回収</span><small>${fD(d.since)}${d.ret?'・差し戻し分':d.open?'・リテイク分':''}</small></div>
        <button type="button" class="rv-more" data-row="${c.id}" aria-label="${c.no} のそのほかの操作">…</button></div>`; }).join('')}</div>
      ${sel.length?`<button type="button" class="act ok sticky" data-a="bulkOK">選んだ${sel.length}件を確認OK</button>`:''}` : '<p class="batch-empty">手元で確認待ちのカット袋はありません</p>'}
    </section>
    <section class="home-sec home-find"><h5>カットを探す</h5>
      <input id="findCut" type="search" inputmode="numeric" placeholder="カット番号（例：13）" value="${esc(ui.q||'')}" aria-label="カット番号で探す">
      <div class="chips">${FILTERS.map(([k,n])=>`<button type="button" class="chipf${f===k?' on':''}" data-filter="${k}">${n}</button>`).join('')}</div>
      <div class="find-list">${found.map(({c,d})=>{ const st=statusOf(d); return `<button type="button" class="find-row" data-open="${c.id}"><b>${c.no}</b><span>${esc(d.phase==='done'?'完了':fullOf(d.stage))}</span><span class="chip ${st.k}">${st.t}</span><small>${esc(d.holder)}</small></button>`; }).join('') || '<p class="batch-empty">該当するカットはありません</p>'}</div>
    </section>
  </div>`;
}
// 読み取り：何件読むかは決めない。読んだカット袋の状態で、配布か回収かが決まる。読み終わったら「閉じる」
// この読み取りで配布した作業工程のカット袋（納期を入れる対象）
function sessionIns(){
  if(!ui.scan) return [];
  return ui.scan.items.filter(it=>it.kind==='ok' && !it.voided).map(it=>S.events.find(e=>e.no===it.no)).filter(e=>e && e.type==='IN' && STAGES[e.stage].kind==='work');
}
const ymd = ts => { const d=new Date(ts); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
function personOf(it){
  const e = it.no ? S.events.find(x=>x.no===it.no) : null;
  if(it.kind!=='ok' || it.voided || !e || e.type!=='IN') return esc(it.text);
  return `配布 → <button type="button" class="person-btn" data-person-ev="${e.no}">${esc(e.person)}</button>`;
}
function setPerson(no, name){
  const e = S.events.find(x=>x.no===no); if(e) e.person = name;
  ui.modal = null; renderPhone();  sync();
}
function personView(){
  const e = S.events.find(x=>x.no===ui.pick), st = STAGES[e.stage];
  const list = st.kind==='work' ? WORKERS[st.id] : (CHECK_POOL[st.id] || [CHECKERS[st.id]]);
  const po = e.po ? S.orders.find(o=>o.no===e.po) : null;
  return `<div class="sheetm" role="dialog" aria-label="渡す相手"><h4>渡す相手：${cutById(e.cut).no}　${esc(fullOf(e.stage))}</h4>
    <div class="opts">${list.map(n=>`<button type="button" class="opt pick${n===e.person?' sel':''}" data-person="${esc(n)}">${esc(n)}${po && po.vendor===n ? '<small class="tagx">発注書</small>' : ''}</button>`).join('')}</div>
    <button class="linkbtn" data-a="closeModal">閉じる</button></div>`;
}
function dueBtn(it){
  if(it.kind!=='ok' || it.voided) return '';
  const e = S.events.find(x=>x.no===it.no);
  if(!e || e.type!=='IN' || STAGES[e.stage].kind!=='work') return '';
  return `<button type="button" class="due-btn${e.due?'':' empty'}" data-due-ev="${e.no}">${e.due ? '納期 '+fD(e.due) : '納期を入力'}</button>`;
}
// 納期を設定する（target は履歴の番号、'all' ならこの読み取りで配布した分すべて）
function setDue(target, day){
  const ts = new Date(day+'T18:00').getTime();
  (target==='all' ? sessionIns() : S.events.filter(e=>e.no===target)).forEach(e=>{ e.due = ts; });
  ui.modal = null; renderPhone(); sync();
}
function openCal(target){
  const e = target==='all' ? null : S.events.find(x=>x.no===target);
  const base = new Date(e && e.due ? e.due : clock());
  ui.cal = {target, y:base.getFullYear(), m:base.getMonth()};
  ui.modal = 'cal'; renderPhone();
}
function calView(){
  const {target, y, m} = ui.cal;
  const e = target==='all' ? null : S.events.find(x=>x.no===target);
  const title = target==='all' ? `納期：まとめて（${sessionIns().length}件）` : `納期：${cutById(e.cut).no}`;
  const sel = e && e.due ? ymd(e.due) : '', today = ymd(clock());
  const first = new Date(y, m, 1), days = new Date(y, m+1, 0).getDate(), cells = [];
  for(let k=0; k<first.getDay(); k++) cells.push('<span></span>');
  for(let dd=1; dd<=days; dd++){ const v=`${y}-${pad(m+1)}-${pad(dd)}`; cells.push(`<button type="button" class="cal-d${v===sel?' sel':''}${v===today?' today':''}${v<today?' past':''}" data-day="${v}">${dd}</button>`); }
  return `<div class="sheetm" role="dialog" aria-label="納期"><h4>${esc(title)}</h4>
    <div class="cal-h"><button type="button" class="linkbtn" data-a="calPrev" aria-label="前の月">‹</button><b>${y}年${m+1}月</b><button type="button" class="linkbtn" data-a="calNext" aria-label="次の月">›</button></div>
    <div class="cal"><span>日</span><span>月</span><span>火</span><span>水</span><span>木</span><span>金</span><span>土</span>${cells.join('')}</div>
    <button class="linkbtn" data-a="closeModal">閉じる</button></div>`;
}
function scannerView(){
  const s = ui.scan, okN = s.items.filter(i=>i.kind==='ok' && !i.voided).length;
  return `<div class="appbar"><h3>QRコード読み取り</h3>${who()}</div>
  <div class="body scan-body">
    <div class="finder cam${ui.scanning?' scanning':''}"><video id="cam" playsinline muted autoplay></video><span class="corner c1"></span><span class="corner c2"></span><span class="corner c3"></span><span class="corner c4"></span><span class="laser"></span>
      ${camMsg() ? `<span class="ftext">${camMsg()}</span>` : ''}</div>
    <div class="sess-count"><b>${okN}</b>件 登録${sessionIns().length>1 ? `<button type="button" class="linkbtn due-all" data-a="dueAll">納期をまとめて設定</button>` : ''}</div>
    ${s.items.length ? `<ul class="sess-list">${[...s.items].reverse().map(it=>`<li class="${it.kind}${it.voided?' void':''}"><b>${esc(it.cutNo)}</b><span><span class="row-t">${personOf(it)}</span>${dueBtn(it)}</span>${it.kind==='reg'?'<em>QR登録</em>':it.kind!=='ok'?'<em>登録なし</em>':it.voided?'<em>取り消し済み</em>':`<button type="button" class="linkbtn" data-undo-ev="${it.no}">取り消し</button>`}</li>`).join('')}</ul>` : ''}
    <button type="button" class="act sticky" data-a="closeScan">完了</button>
  </div>`;
}
function flowChips(d){
  return `<div class="flow" aria-label="工程の流れ">${STAGES.map((s,i)=>{
    if(!s.route && !d.passed.has(i) && d.stage!==i) return '';
    let cls='';
    if(d.phase==='done' || i<d.stage) cls = (s.route||d.passed.has(i)) ? 'pass' : '';
    if(i===d.stage && d.phase!=='done') cls='cur';
    if(d.open && (i===d.open.raised || i===d.open.target)) cls+=' rt';
    return `<span class="${cls}">${s.full}</span>`;
  }).join('')}</div>`;
}
// カットの状況（ホームで探したとき／確認待ちの「…」から／読み取り中に確認が必要になったとき）
function cutView(){
  const c = cutById(ui.cut), d = derive(c.id), st = statusOf(d), stg = STAGES[d.stage];
  const readonly = ui.readonly;
  let h = `<div class="appbar"><button class="back" data-a="back" aria-label="戻る">‹</button><h3>${ui.resume?'発注書の確認':'カットの状況'}</h3>${who()}</div><div class="body">`;
  h += `<div class="cuthead"><div><div class="sub">${c.ep}　パート${c.part}　${c.sec}秒</div><div class="big">${c.no}</div></div>
        <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end"><span class="chip ${st.k}">${st.t}</span>${d.stale?'<span class="chip stale">3日以上動きなし</span>':''}</div></div>`;
  h += `<dl class="kv"><dt>今の工程</dt><dd>${esc(d.phase==='done'?'完了':fullOf(d.stage))}${d.rtCount?`　<span style="color:var(--retake)">リテイク${d.rtCount}回</span>`:''}${d.retCount?`　<span style="color:var(--retake)">差し戻し${d.retCount}回</span>`:''}</dd>
        <dt>所在</dt><dd>${esc(d.holder)}</dd>
        ${d.due?`<dt>納期</dt><dd class="num">${fD(d.due)}</dd>`:''}
        <dt>最終更新</dt><dd class="num">${d.lastTs?fDT(d.lastTs)+'（'+ago(d.lastTs)+'）':'—'}</dd></dl>`;
  if(d.open){
    const o=d.open;
    h += `<div class="rt-banner"><b>${o.id} リテイク対応中</b><br>${fullOf(o.raised)} → ${fullOf(o.target)}（${esc(o.reason)}）<br>
      ${o.mode==='direct' ? `直したら <b>${fullOf(o.raised)}</b> へ直接戻ります` : `直したら ${fullOf(routeNext(o.target))} から順に戻ります`}${o.note?`<br>「${esc(o.note)}」`:''}</div>`;
  }
  if(d.ret && d.phase==='in') h += `<div class="rt-banner"><b>${d.ret.id} 差し戻し中</b><br>${esc(d.ret.reason)}${d.ret.note?`「${esc(d.ret.note)}」`:''}</div>`;
  h += flowChips(d);
  const needOrder = !readonly && d.phase==='wait' && stg.po && !autoIn(c.id, d);
  if(!readonly && d.phase==='wait' && stg.po && !needOrder){
    const a = autoIn(c.id, d);
    h += `<div class="pocard"><span class="lbl">発注書から</span><b>${esc(a.person)}</b></div>`;
  }
  if(readonly){
    h += `<div class="readonly-note">旧ラベルのため閲覧のみです。</div>`;
  } else if(needOrder && ui.resume){
    const cands = candidatesFor(c.id, d.stage);
    h += `<div class="pocard warn"><span class="lbl">発注書に ${c.no} の ${fullOf(d.stage)} が見つかりません</span>
      ${cands.length ? `<span>書き間違いの候補があります</span>${cands.map(x=>`<button type="button" class="act cand" data-a="cand" data-po="${x.o.no}" data-li="${x.li}">${esc(x.o.vendor)} に配布<small>発注書の「${esc(x.l.text)}」を ${c.no} の書き間違いとして配布</small></button>`).join('')}` : ''}
      <button type="button" class="linkbtn" data-a="pick">候補にない：作業者を選んで配布</button></div>`;
  } else if(d.phase==='review'){
    const n = nextOf(d);
    h += `<div class="actions"><button class="act ok" data-a="main">確認OK（${esc(fullOf(d.stage))}）<small>次：${esc(n>=N?'完了':fullOf(n))}</small></button></div>`;
  }
  if(!readonly && d.phase!=='done' && !ui.resume){
    if(ui.confirmUndo){
      const lastLive = lastLiveEvent(c.id);
      if(lastLive) h += `<div class="confirm"><span>「${esc(evText(lastLive))}」（${fDT(lastLive.ts)}）を取り消します。</span>
        <div class="row"><button class="btn" data-a="undoNo">やめる</button><button class="btn primary" data-a="undoYes">取り消す</button></div></div>`;
    }
    h += `<button type="button" class="irr-btn" data-a="irr">通常と違うとき ▾</button>`;
  }
  const mine = S.events.filter(e=>e.cut===c.id && e.type!=='VOID');
  const voided = voidedSet();
  h += `<div><div class="lbl">最近の履歴</div><ul class="hist">${mine.slice(-4).reverse().map(e=>`<li class="${voided.has(e.no)?'void':''}"><span class="t">${fDT(e.ts)}</span><span class="${e.type==='RETAKE'||e.type==='RETURN'?'r':''}">${esc(evText(e))}${e.late?'（後入力）':''}</span></li>`).join('')}</ul></div>`;
  h += `</div>`;
  return h;
}
function lastLiveEvent(cutId){ const v=voidedSet(); return [...S.events].reverse().find(e=>e.cut===cutId && ['IN','UP','OK','RETAKE','RETURN'].includes(e.type) && !v.has(e.no)); }
// 読み取りの一覧に出す文言。進行に要るのは「配布か回収か」と「だれに渡すか」だけ（工程名・発注番号は出さない）
function scanText(e){
  if(e.type==='IN') return `配布 → ${e.person}${e.provisional?'（発注書の確認待ち）':''}`;
  if(e.type==='UP') return '回収';
  return evText(e);
}
function evText(e){
  const s = fullOf(e.stage);
  if(e.type==='IN') return `${s} 配布 → ${e.person}`;
  if(e.type==='UP') return `${s} 回収`;
  if(e.type==='OK') return e.to!=null ? `${s} 確認OK → ${fullOf(e.to)}へ` : `${s} 確認OK`;
  if(e.type==='RETURN') return `${e.rt.id} 差し戻し（${e.rt.reason}）`;
  if(e.type==='RETAKE') return `${e.rt.id} リテイク ${fullOf(e.rt.raised)} → ${s}`;
  if(e.type==='VOID') return `取り消し（No.${e.voidOf}）`;
  if(e.type==='ALERT') return `無効なQRの読み取り`;
  if(e.type==='MANUAL') return `QRを使わずカット番号で開いた`;
  if(e.type==='LINK') return e.note || 'カット袋を登録';
  return e.type;
}
function modalView(){
  if(ui.modal==='pj') return pjView();
  if(ui.modal==='cal') return calView();
  if(ui.modal==='person') return personView();
  const c = cutById(ui.cut), d = derive(c.id), stg = STAGES[d.stage], m = ui.form || {};
  const close = `<button class="linkbtn" data-a="closeModal">閉じる</button>`;
  if(ui.modal==='irr'){
    const items = [];
    if(d.phase==='review') items.push(['return','差し戻し（不備）','']);
    if(d.phase==='review' && stg.kind==='check') items.push(['retake','リテイク','']);
    if(d.phase==='review') items.push(['route','確認OK して別の工程へ回す','']);
    if(d.phase==='wait' || d.phase==='in') items.push(['late','日付を指定して登録','']);
    if(ui.fromList) items.push(['info','このカットの状況を見る','']);
    if(lastLiveEvent(c.id) && !ui.fromList) items.push(['undo','直前の操作を取り消す','']);
    return `<div class="sheetm" role="dialog" aria-label="そのほかの操作"><h4>${ui.fromList ? `${c.no}（${fullOf(d.stage)}）の操作` : `${c.no}：通常と違うとき`}</h4>
      <div class="irr-list">${items.map(([k,t,s])=>`<button type="button" class="irr-item" data-irr="${k}"><b>${t}</b>${s?`<span>${s}</span>`:''}</button>`).join('')}</div>${close}</div>`;
  }
  if(ui.modal==='return'){
    return `<div class="sheetm" role="dialog" aria-label="差し戻し"><h4>差し戻し（不備）：${c.no}　${fullOf(d.stage)}</h4>
      <p class="mnote">戻し先：${esc(d.from||'')}</p>
      <div class="field"><span class="lbl">理由</span><div class="pills">${RETURN_REASONS.map(r=>`<button type="button" class="pill${m.reason===r?' sel':''}" data-reason="${esc(r)}">${esc(r)}</button>`).join('')}</div></div>
      <div class="field"><label class="lbl" for="rtNote">メモ（任意）</label><textarea id="rtNote">${esc(m.note||'')}</textarea></div>
      <button class="act" style="background:var(--retake)" data-a="submitReturn">差し戻す</button>${close}</div>`;
  }
  if(ui.modal==='retake'){
    const prev = STAGES.map((s,i)=>({s,i})).filter(({s,i})=>i<d.stage && (s.route || d.passed.has(i)));
    return `<div class="sheetm" role="dialog" aria-label="リテイク"><h4>リテイク：${c.no}　${fullOf(d.stage)}</h4>
      <div class="field"><label class="lbl" for="rtTarget">戻し先</label><select id="rtTarget">${prev.map(({s,i})=>`<option value="${i}"${i===m.target?' selected':''}>${s.full}${s.kind==='work'&&d.workers[s.id]?`（${d.workers[s.id]}）`:''}</option>`).join('')}</select></div>
      <div class="field"><span class="lbl">直した後の戻り方</span><div class="opts">
        <label class="opt${m.mode==='direct'?' sel':''}"><input type="radio" name="mode" value="direct"${m.mode==='direct'?' checked':''}><span>${fullOf(d.stage)}へ直接戻す</span></label>
        <label class="opt${m.mode==='seq'?' sel':''}"><input type="radio" name="mode" value="seq"${m.mode==='seq'?' checked':''}><span>間のチェックを順に通す</span></label></div></div>
      <div class="field"><span class="lbl">理由</span><div class="pills">${REASONS.map(r=>`<button type="button" class="pill${m.reason===r?' sel':''}" data-reason="${esc(r)}">${esc(r)}</button>`).join('')}</div></div>
      <div class="field"><label class="lbl" for="rtNote">メモ（任意）</label><textarea id="rtNote">${esc(m.note||'')}</textarea></div>
      <button class="act" style="background:var(--retake)" data-a="submitRetake">リテイクを登録</button>${close}</div>`;
  }
  if(ui.modal==='route'){
    const opts = STAGES.map((s,i)=>({s,i})).filter(({i})=>i>d.stage && i!==routeNext(d.stage));
    return `<div class="sheetm" role="dialog" aria-label="別の工程へ"><h4>${c.no}：確認OK → 回す先</h4>
      <p class="mnote">標準ルートの次：${fullOf(routeNext(d.stage))||'完了'}</p>
      <div class="opts">${opts.map(({s,i})=>`<label class="opt${m.to===i?' sel':''}"><input type="radio" name="to" value="${i}"${m.to===i?' checked':''}>${s.full}${s.route?'':'<small class="tagx">標準ルート外</small>'}</label>`).join('')}</div>
      <button class="act ok" data-a="submitRoute">確認OK して回す</button>${close}</div>`;
  }
  if(ui.modal==='late'){
    return `<div class="sheetm" role="dialog" aria-label="日付を指定して登録"><h4>日付を指定して登録</h4>
      <p class="mnote"><b>${d.phase==='wait'?`${fullOf(d.stage)} 配布${autoIn(c.id,d)?' → '+autoIn(c.id,d).person:''}`:`${fullOf(d.stage)} 回収`}</b></p>
      <div class="field"><label class="lbl" for="lateDate">実際の日付</label><input id="lateDate" type="date" value="${m.date}"></div>
      <button class="act" data-a="submitLate">この日付で登録</button>${close}</div>`;
  }
  if(ui.modal==='pick'){
    return `<div class="sheetm" role="dialog" aria-label="作業者を選ぶ"><h4>${fullOf(d.stage)} を配布：作業者を選ぶ</h4>
      
      <div class="opts">${(WORKERS[stg.id]||[]).map(w=>`<label class="opt${m.person===w?' sel':''}"><input type="radio" name="person" value="${esc(w)}"${m.person===w?' checked':''}>${esc(w)}</label>`).join('')}</div>
      <button class="act" data-a="submitPick">配布を登録</button>${close}</div>`;
  }
  return '';
}
function revokedView(){
  const q = S.qrs.find(x=>x.token===ui.qr), c = cutById(q.cut), nq = activeQr(c.id);
  return `<div class="appbar"><h3>読み取り結果</h3>${who()}</div><div class="body done-view">
    <div class="done-ico bad" aria-hidden="true"><svg width="30" height="30" viewBox="0 0 24 24"><path d="M12 6v8M12 18v.5" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg></div>
    <h4>このQRラベルは無効です</h4>
    <div class="summary"><div class="what">${c.ep} ${c.no} の旧ラベル</div>
      <div style="font-size:12.5px">${fD(q.revoked)} に再発行済み（${esc(q.reason)}）。<br>新しいラベル：${esc(nq.token)}</div></div>
    <div class="actions" style="width:100%"><button class="act" data-a="home">ホームへ</button></div>
  </div>`;
}

/* ---------- phone actions ---------- */
// カット袋のQRを読む。状態で操作が決まる：配布待ち→配布、作業中・チェック中→回収。それ以外は登録しない
async function scan(token){
  const q = S.qrs.find(x=>x.token===token); if(!q) return;
  
  if(ui.screen!=='scanner') ui = {screen:'scanner', scan:{items:[]}};
  const sc = ui.scan;
  ui.scanning = true; renderPhone();
  await sleep(250);
  ui.scanning = false;
  const cut = cutById(q.cut);
  const back = () => { ui = {screen:'scanner', scan:sc}; renderPhone();  };
  if(q.status==='revoked'){
    const r = act(q.cut,'ALERT',{qr:token, note:'無効化済みQRを読み取り（更新は拒否）'});
    sc.items.push({no:r.ev.no, cutNo:cut.no, text:'旧ラベル（無効なQR）。カット袋のラベルを確認', kind:'bad'}); back(); sync(); return;
  }
  const d = derive(q.cut);
  if(d.phase==='review'){ sc.items.push({cutNo:cut.no, text:'手元で確認待ち（ホームで確認）', kind:'info'}); back(); return; }
  if(d.phase==='done'){ sc.items.push({cutNo:cut.no, text:'完了済みのカット', kind:'info'}); back(); return; }
  const r = defaultAct(q.cut, {qr:token});
  if(r.ok){ sc.items.push({no:r.ev.no, cutNo:cut.no, text:scanText(r.ev), kind:'ok'}); back(); sync(); return; }
  if(r.need==='order'){ ui = {screen:'cut', cut:q.cut, qr:token, resume:sc, toast:'このカット袋だけ、発注書の確認が必要です'}; renderPhone(); setTimeout(()=>{ if(ui.toast){ ui.toast=null; renderPhone(); } }, 2600); return; }
  sc.items.push({cutNo:cut.no, text:r.msg||'登録できません', kind:'info'}); back();
}
function openModal(kind){
  const d = derive(ui.cut);
  if(kind==='retake'){ let t = d.stage-1; while(t>0 && STAGES[t].kind!=='work') t--; ui.form = {target:t, mode:'direct', reason:REASONS[0], note:''}; }
  else if(kind==='return'){ ui.form = {reason:RETURN_REASONS[0], note:''}; }
  else if(kind==='route'){ ui.form = {to:null}; }
  else if(kind==='late'){ const y=new Date(clock()-DAY); ui.form = {date:`${y.getFullYear()}-${pad(y.getMonth()+1)}-${pad(y.getDate())}`}; }
  else if(kind==='pick'){ ui.form = {person:null}; }
  else ui.form = ui.form || {};
  ui.modal = kind; renderPhone();
}
function readForm(){
  const f = ui.form; if(!f) return;
  const g = id => document.getElementById(id);
  if(g('rtTarget')) f.target = Number(g('rtTarget').value);
  if(g('rtNote')) f.note = g('rtNote').value;
  if(g('lateDate')) f.date = g('lateDate').value;
  const p = document.querySelector('input[name=person]:checked'); if(p) f.person = p.value;
  const m = document.querySelector('input[name=mode]:checked'); if(m) f.mode = m.value;
  const t = document.querySelector('input[name=to]:checked'); if(t) f.to = Number(t.value);
}
// 登録したあとは元の画面（読み取りの途中ならそこ、それ以外はホーム）に戻る
function finish(r){
  if(!r.ok){ flashToast(r.msg || '登録できませんでした'); return; }
  const cut = cutById(r.ev.cut), e = r.ev;
  let text = ui.resume ? scanText(e) : evText(e);
  if(e.type==='RETAKE') text = `${e.rt.id} リテイク：${fullOf(e.rt.raised)} → ${fullOf(e.stage)}（${e.rt.reason}）`;
  if(ui.resume){ const sc=ui.resume; sc.items.push({no:e.no, cutNo:cut.no, text, kind:'ok'}); ui={screen:'scanner', scan:sc}; renderPhone();  sync(); return; }
  ui = {screen:'home', last:{no:e.no, cutNo:cut.no, text}};
  renderPhone();  sync();
}
function flashToast(msg){ ui.toast = msg; renderPhone(); setTimeout(()=>{ ui.toast=null; renderPhone(); }, 2600); }

$('#screen').addEventListener('click', e=>{
  const pill = e.target.closest('[data-reason]');
  if(pill){ readForm(); ui.form.reason = pill.dataset.reason; renderPhone(); return; }
  const ue = e.target.closest('[data-undo-ev]');
  if(ue){ const no=Number(ue.dataset.undoEv), ev=S.events.find(x=>x.no===no); const r=act(ev.cut,'VOID',{voidOf:no, note:`${evText(ev)} を取り消し`});
    if(ui.screen==='scanner'){ const it=ui.scan.items.find(x=>x.no===no); if(it) it.voided=true; if(ui.scan.seen && ev.qr) ui.scan.seen.delete(ev.qr); renderPhone();  sync(); }
    else { if(ui.last) ui.last.voided=true; renderPhone();  sync(); }
    return; }
  const pb = e.target.closest('[data-person-ev]');
  if(pb){ ui.pick = Number(pb.dataset.personEv); ui.modal = 'person'; renderPhone(); return; }
  const pp = e.target.closest('[data-person]');
  if(pp){ setPerson(ui.pick, pp.dataset.person); return; }
  const db = e.target.closest('[data-due-ev]');
  if(db){ openCal(Number(db.dataset.dueEv)); return; }
  const dy = e.target.closest('[data-day]');
  if(dy){ setDue(ui.cal.target, dy.dataset.day); return; }
  const sel = e.target.closest('[data-sel]');
  if(sel){ const id=sel.dataset.sel; ui.sel = ui.sel||[]; ui.sel = ui.sel.includes(id) ? ui.sel.filter(x=>x!==id) : [...ui.sel, id]; ui.last=null; renderPhone(); return; }
  const row = e.target.closest('[data-row]');
  if(row){ ui.cut=row.dataset.row; ui.fromList=true; openModal('irr'); return; }
  const fl = e.target.closest('[data-filter]');
  if(fl){ ui.filter = fl.dataset.filter; renderPhone(); return; }
  const op = e.target.closest('[data-open]');
  if(op){ ui = {screen:'cut', cut:op.dataset.open, qr:activeQr(op.dataset.open).token, q:ui.q, filter:ui.filter}; renderPhone(); return; }
  const irr = e.target.closest('[data-irr]');
  if(irr){ const k=irr.dataset.irr; ui.modal=null;
    if(k==='undo'){ ui.confirmUndo=true; renderPhone(); }
    else if(k==='info'){ ui={screen:'cut', cut:ui.cut, qr:activeQr(ui.cut).token}; renderPhone(); }
    else openModal(k); return; }
  const t = e.target.closest('[data-a]'); if(!t) return;
  const a = t.dataset.a;
  if(appAction(a, t)) return;
  if(a==='home'){ ui={screen:'home'}; renderPhone();  }
  else if(a==='back'){ ui = ui.resume ? {screen:'scanner', scan:ui.resume} : {screen:'home', q:ui.q, filter:ui.filter}; renderPhone(); }
  else if(a==='scan'){ ui={screen:'scanner', scan:{items:[]}}; renderPhone(); }
  else if(a==='closeScan'){ const n=ui.scan.items.filter(i=>i.kind==='ok' && !i.voided).length; ui={screen:'home', last: n ? {text:`${n}件を登録しました`} : null}; renderPhone(); }
  else if(a==='selAll'){ ui.sel = reviewList().map(x=>x.c.id); ui.last=null; renderPhone(); }
  else if(a==='bulkOK'){ const ids=ui.sel||[]; if(!ids.length) return; const nos=[]; ids.forEach(id=>{ const r=act(id,'OK',{}); if(r.ok){ nos.push(cutById(id).no); sync(); } }); ui={screen:'home', last:{text:`${nos.join('・')} の${nos.length}件を確認OK。次の工程の配布待ちになりました`}}; renderPhone();  }
  else if(a==='main'){ finish(act(ui.cut,'OK',{})); }
  else if(a==='cand'){ const o=S.orders.find(x=>x.no===t.dataset.po), li=Number(t.dataset.li); finish(act(ui.cut,'IN',{person:o.vendor, po:o.no, poLine:li, provisional:true, sheets:o.lines[li].sheets??null, qr:ui.qr, note:`発注番号 ${o.no} の「${o.lines[li].text}」を仮に紐づけ`})); }
  else if(a==='pick') openModal('pick');
  else if(a==='irr'){ ui.fromList=false; openModal('irr'); }
  else if(a==='closeModal'){ ui.modal=null; renderPhone(); }
  else if(a==='dueAll'){ openCal('all'); }
  else if(a==='calPrev' || a==='calNext'){ const d=new Date(ui.cal.y, ui.cal.m + (a==='calNext'?1:-1), 1); ui.cal.y=d.getFullYear(); ui.cal.m=d.getMonth(); renderPhone(); }
  else if(a==='submitRetake'){ readForm(); const f=ui.form; ui.modal=null; finish(act(ui.cut,'RETAKE',{target:f.target, mode:f.mode, reason:f.reason, note:f.note})); }
  else if(a==='submitReturn'){ readForm(); const f=ui.form; ui.modal=null; finish(act(ui.cut,'RETURN',{reason:f.reason, note:f.note})); }
  else if(a==='submitRoute'){ readForm(); const f=ui.form; if(f.to==null){ flashToast('回す先を選んでください'); return; } ui.modal=null; finish(act(ui.cut,'OK',{to:f.to})); }
  else if(a==='submitLate'){ readForm(); const f=ui.form; ui.modal=null; const ts=new Date(f.date+'T18:00').getTime(); finish(defaultAct(ui.cut, {late:true, ets:clock()}, ts)); }
  else if(a==='submitPick'){ readForm(); const f=ui.form; if(!f.person){ flashToast('作業者を選んでください'); return; } ui.modal=null; finish(act(ui.cut,'IN',{person:f.person, qr:ui.qr})); }
  else if(a==='undoNo'){ ui.confirmUndo=false; renderPhone(); }
  else if(a==='undoYes'){ const last=lastLiveEvent(ui.cut); if(last) finish(act(ui.cut,'VOID',{voidOf:last.no, note:`${evText(last)} を取り消し`})); }
});
$('#screen').addEventListener('input', e=>{ if(e.target.id==='findCut'){ ui.q = e.target.value; renderPhone(); } });
$('#screen').addEventListener('change', e=>{ if(['person','mode','to'].includes(e.target.name)){ readForm(); renderPhone(); } });

