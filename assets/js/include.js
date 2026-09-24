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
   Mobile navigation (hamburger toggle)
   ======================================================= */

function initMobileNav() {

  const toggle = document.getElementById('navToggle');
  const links = document.getElementById('navLinks');
  const backdrop = document.getElementById('navBackdrop');

  if (!toggle || !links) return;

  function openMenu() {
    links.classList.add('open');
    toggle.classList.add('active');
    toggle.setAttribute('aria-expanded', 'true');
    if (backdrop) backdrop.classList.add('show');
    document.body.classList.add('nav-open');
  }

  function closeMenu() {
    links.classList.remove('open');
    toggle.classList.remove('active');
    toggle.setAttribute('aria-expanded', 'false');
    if (backdrop) backdrop.classList.remove('show');
    document.body.classList.remove('nav-open');
  }

  toggle.addEventListener('click', function () {
    if (links.classList.contains('open')) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  links.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', closeMenu);
  });

  if (backdrop) {
    backdrop.addEventListener('click', closeMenu);
  }

  // keep things tidy if the window is resized past the mobile breakpoint
  // while the menu happens to be open
  window.addEventListener('resize', function () {
    if (window.innerWidth > 760) closeMenu();
  });

}


/* =======================================================
   Load Navbar
   ======================================================= */

async function loadNavbar() {

  await loadInclude(
    '#navbarPlaceholder',
    'components/navbar.html',
    function () {
      markActiveNav();
      initMobileNav();
    }
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