/* =======================================================
   Jakarta Film Summit — Component Loader
   ======================================================= */

async function loadInclude(selector, url, afterInsert) {
  const element = document.querySelector(selector);

  if (!element) {
    console.warn(`Placeholder "${selector}" tidak ditemukan.`);
    return;
  }

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();

    element.innerHTML = html;

    if (typeof afterInsert === 'function') {
      afterInsert();
    }

  } catch (error) {
    console.error(`Gagal memuat ${url}:`, error);
  }
}


/* =======================================================
   Active navigation
   ======================================================= */

function markActiveNav() {

  const currentPage =
    window.location.pathname
      .split('/')
      .pop()
      .toLowerCase() || 'home.html';

  const links = document.querySelectorAll(
    '#navbarPlaceholder .nav-links a'
  );

  links.forEach(link => {

    const href =
      link.getAttribute('href')
        .split('/')
        .pop()
        .split('?')[0]
        .split('#')[0]
        .toLowerCase();

    link.classList.toggle(
      'active',
      href === currentPage
    );

  });
}


/* =======================================================
   Load Navbar
   ======================================================= */

async function loadNavbar() {

  await loadInclude(
    '#navbarPlaceholder',
    'components/navbar.html',
    markActiveNav
  );

}


/* =======================================================
   Load Footer
   ======================================================= */

async function loadFooter() {

  await loadInclude(
    '#footerPlaceholder',
    'components/footer.html'
  );

}


/* =======================================================
   Initialize
   ======================================================= */

document.addEventListener('DOMContentLoaded', () => {

  loadNavbar();
  loadFooter();

});