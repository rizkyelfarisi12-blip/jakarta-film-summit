/* =======================================================
   Jakarta Film Summit — component loader
   Memuat /components/navbar.html dan /components/footer.html
   ke dalam placeholder <div id="navbarPlaceholder"></div> dan
   <div id="footerPlaceholder"></div> di setiap halaman.

   Catatan: fetch() ke file lokal butuh dijalankan lewat server
   (mis. `php -S localhost:8000`), bukan dibuka langsung via
   file:// di browser — kalau tidak, akan kena error CORS.
   ======================================================= */

async function loadInclude(selector, url, afterInsert) {
  var el = document.querySelector(selector);
  if (!el) return;
  try {
    var res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    el.innerHTML = await res.text();
    if (afterInsert) afterInsert();
  } catch (e) {
    console.warn('Gagal memuat ' + url + ' — jalankan lewat server lokal, bukan file://', e);
  }
}

// Tandai link navbar yang cocok dengan halaman yang sedang dibuka.
function markActiveNav() {
  var current = (location.pathname.split('/').pop() || 'index.html');
  document.querySelectorAll('.nav-links a[href]').forEach(function (link) {
    var href = link.getAttribute('href').split('/').pop();
    link.classList.toggle('active', href === current);
  });
}

document.addEventListener('DOMContentLoaded', function () {
  loadInclude('#navbarPlaceholder', '../components/navbar.html', markActiveNav);
  loadInclude('#footerPlaceholder', '../components/footer.html');
});
