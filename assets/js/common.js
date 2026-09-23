/* =======================================================
   Jakarta Film Summit — shared behaviour
   Used by: index.html, about.html, news.html, register.html
   ======================================================= */

// Build the marquee ticker from a comma-separated data-words attribute,
// e.g. <div class="ticker-track" data-words="PRODUSER,SUTRADARA,..."></div>
function initTicker(){
  document.querySelectorAll('.ticker-track[data-words]').forEach(function(track){
    var words = track.dataset.words.split(',');
    var html = '';
    for (var r = 0; r < 2; r++) {
      words.forEach(function(w){
        html += '<div class="ticker-item"><span>' + w.trim() + '</span><i></i></div>';
      });
    }
    track.innerHTML = html;
  });
}

// Highlight the in-page nav link that matches the section currently in view.
// Works for both the top `.nav-links a` (home/about/news) and the
// registration page's `.step-link` rail — both use [data-target="sectionId"].
function initSectionNav(linkSelector){
  var links = Array.prototype.slice.call(document.querySelectorAll(linkSelector));
  if (!links.length) return;
  var sections = links.map(function(l){ return document.getElementById(l.dataset.target); });
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      var idx = sections.indexOf(entry.target);
      if (entry.isIntersecting && idx > -1) {
        links.forEach(function(l){ l.classList.remove('active'); });
        links[idx].classList.add('active');
      }
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach(function(s){ if (s) io.observe(s); });
}

// Fade + slide up any element with class="reveal" once it enters the viewport.
function initReveal(){
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: .12 });
  document.querySelectorAll('.reveal').forEach(function(el){ io.observe(el); });
}

// Count up any element with data-target (and optional data-suffix) from 0
// once it scrolls into view. Used by .stat-num (home) and .recap-num (news).
function initCounters(){
  function animateCount(el){
    var target = parseInt(el.dataset.target, 10) || 0;
    var suffix = el.dataset.suffix || '';
    var start = null;
    var duration = 1350;
    function step(ts){
      if (!start) start = ts;
      var progress = Math.min(1, (ts - start) / duration);
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target) + suffix;
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      if (entry.isIntersecting) {
        animateCount(entry.target);
        io.unobserve(entry.target);
      }
    });
  }, { threshold: .5 });
  document.querySelectorAll('[data-target][data-suffix], [data-target]:not([data-suffix])').forEach(function(el){
    // only auto-count elements explicitly opted in, to avoid clashing with
    // unrelated data-target attributes a page might add later
    if (el.classList.contains('stat-num') || el.classList.contains('recap-num')) {
      io.observe(el);
    }
  });
}

document.addEventListener('DOMContentLoaded', function(){
  initTicker();
  initSectionNav('.nav-links a');
  initReveal();
  initCounters();
});
