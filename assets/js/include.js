/* =======================================================
   Jakarta Film Summit — Component Loader
   ======================================================= */


/* =======================================================
   Generic Include Loader
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
   Active Navigation
   ======================================================= */

function markActiveNav() {

  const currentPage =
    window.location.pathname
      .split('/')
      .pop()
      .toLowerCase() || 'index.html';


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
   Mobile Navigation
   ======================================================= */

function initMobileNav() {

  const toggle = document.getElementById('navToggle');
  const links = document.getElementById('navLinks');
  const backdrop = document.getElementById('navBackdrop');


  if (!toggle || !links) {
    return;
  }


  /* -------------------------------------------------------
     Open Menu
     ------------------------------------------------------- */

  function openMenu() {

    links.classList.add('open');

    toggle.classList.add('active');

    toggle.setAttribute(
      'aria-expanded',
      'true'
    );


    if (backdrop) {
      backdrop.classList.add('show');
      backdrop.setAttribute(
        'aria-hidden',
        'false'
      );
    }


    document.body.classList.add('nav-open');

  }


  /* -------------------------------------------------------
     Close Menu
     ------------------------------------------------------- */

  function closeMenu() {

    links.classList.remove('open');

    toggle.classList.remove('active');

    toggle.setAttribute(
      'aria-expanded',
      'false'
    );


    if (backdrop) {
      backdrop.classList.remove('show');
      backdrop.setAttribute(
        'aria-hidden',
        'true'
      );
    }


    document.body.classList.remove('nav-open');

  }


  /* -------------------------------------------------------
     Hamburger Click
     ------------------------------------------------------- */

  toggle.addEventListener('click', function () {

    const isOpen =
      links.classList.contains('open');


    if (isOpen) {
      closeMenu();
    } else {
      openMenu();
    }

  });


  /* -------------------------------------------------------
     Close When Navigation Item Is Clicked
     ------------------------------------------------------- */

  links.querySelectorAll('a').forEach(function (link) {

    link.addEventListener(
      'click',
      closeMenu
    );

  });


  /* -------------------------------------------------------
     Close When Backdrop Is Clicked
     ------------------------------------------------------- */

  if (backdrop) {

    backdrop.addEventListener(
      'click',
      closeMenu
    );

  }


  /* -------------------------------------------------------
     Close Menu When Switching Back To Desktop
     ------------------------------------------------------- */

  window.addEventListener(
    'resize',
    function () {

      if (window.innerWidth > 760) {
        closeMenu();
      }

    }
  );

}


/* =======================================================
   Navbar Scroll Effect
   ======================================================= */

function initNavbarScroll() {

  const nav =
    document.querySelector('.site-nav');


  if (!nav) {
    return;
  }


  const threshold = 20;

  let ticking = false;


  function updateNavbar() {

    nav.classList.toggle(
      'scrolled',
      window.scrollY > threshold
    );

    ticking = false;

  }


  window.addEventListener(
    'scroll',
    function () {

      if (!ticking) {

        window.requestAnimationFrame(
          updateNavbar
        );

        ticking = true;

      }

    },
    {
      passive: true
    }
  );


  /* Set initial state */
  updateNavbar();

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

      initNavbarScroll();

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

document.addEventListener(
  'DOMContentLoaded',
  function () {

    loadNavbar();

    loadFooter();

  }
);