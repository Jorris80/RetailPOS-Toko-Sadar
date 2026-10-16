/* Retail POS Enterprise — Service Worker (mode offline PWA)
 * Naikkan VERSION setiap kali index.html diperbarui agar perangkat kasir mengambil versi baru. */
var VERSION = 'rpos-v1.2.1';
var SHELL = ['./', './index.html', './manifest.json', './offline.html', './icon-512.png'];
var CDN = ['https://cdnjs.cloudflare.com/ajax/libs/jsbarcode/3.11.6/JsBarcode.all.min.js'];

self.addEventListener('install', function (e) {
  // toleran: satu berkas gagal diunduh tidak menggagalkan pemasangan service worker
  e.waitUntil(caches.open(VERSION).then(function (c) {
    return Promise.all(SHELL.concat(CDN).map(function (u) {
      return fetch(u, { cache: 'reload', mode: u.indexOf('http') === 0 ? 'cors' : 'same-origin' })
        .then(function (r) { if (r.ok) return c.put(u, r); }).catch(function () { });
    }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;                                   // API Apps Script (POST) tidak pernah di-cache
  var url = new URL(req.url);
  if (/script\.google(usercontent)?\.com$/.test(url.hostname)) return; // data selalu langsung ke server
  if (req.mode === 'navigate') {
    // network-first: selalu coba versi terbaru, jatuh ke cache saat offline
    e.respondWith(fetch(req).then(function (r) {
      var copy = r.clone();
      caches.open(VERSION).then(function (c) { c.put('./index.html', copy); });
      return r;
    }).catch(function () {
      return caches.match('./index.html').then(function (r) { return r || caches.match('./offline.html'); });
    }));
    return;
  }
  // aset statis & pustaka CDN: cache-first lalu perbarui di latar
  e.respondWith(caches.match(req).then(function (hit) {
    var net = fetch(req).then(function (r) {
      if (r && (r.ok || r.type === 'opaque') && (url.origin === location.origin || CDN.indexOf(req.url) >= 0 || /cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com/.test(url.hostname))) {
        var copy = r.clone();
        caches.open(VERSION).then(function (c) { c.put(req, copy); });
      }
      return r;
    }).catch(function () { return hit; });
    return hit || net;
  }));
});

self.addEventListener('message', function (e) { if (e.data === 'skipWaiting') self.skipWaiting(); });
