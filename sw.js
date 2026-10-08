// 画面のファイルを端末に置いておき、電波が弱くても開けるようにする（データは毎回スプレッドシートから読む）
const CACHE = 'cutbagqr-v1';
const FILES = ['./', 'index.html', 'print.html', 'css/app.css', 'js/core.js', 'js/phone.js', 'js/app.js', 'vendor/jsQR.js', 'vendor/qrcode.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', e=>{ e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())); });
self.addEventListener('activate', e=>{ e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())); });
self.addEventListener('fetch', e=>{
  const u = new URL(e.request.url);
  if(e.request.method!=='GET' || u.origin!==location.origin) return;
  // 新しい版を優先し、つながらないときだけ端末の分を使う
  e.respondWith(fetch(e.request).then(r=>{ const c=r.clone(); caches.open(CACHE).then(x=>x.put(e.request, c)); return r; }).catch(()=>caches.match(e.request)));
});
