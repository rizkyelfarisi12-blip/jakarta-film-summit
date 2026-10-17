/* =======================================================
   Jakarta Film Summit — Home page behaviour
   Requires: common.js
   ======================================================= */

document.addEventListener("DOMContentLoaded", function () {
  var tabs = document.querySelectorAll(".day-tab");
  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      tabs.forEach(function (t) {
        t.classList.remove("active");
      });
      tab.classList.add("active");
      document.querySelectorAll(".day-panel").forEach(function (p) {
        p.classList.toggle("active", p.dataset.day === tab.dataset.day);
      });
    });
  });
});

/* =======================================================
   Jakarta Film Summit — Home page behaviour
   Requires: common.js
   Day 3 route popup: Group A / Group B
   ======================================================= */
(function () {
  "use strict";

  function initHomePage() {
    // Schedule tabs (if present on this version of the homepage).
    var tabs = document.querySelectorAll(".day-tab");
    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        tabs.forEach(function (t) { t.classList.remove("active"); });
        tab.classList.add("active");
        document.querySelectorAll(".day-panel").forEach(function (panel) {
          panel.classList.toggle("active", panel.dataset.day === tab.dataset.day);
        });
      });
    });

    var modal = document.getElementById("homeRouteModal");
    if (!modal) {
      console.warn("JFS Day 3 popup: #homeRouteModal tidak ditemukan di HTML.");
      return;
    }

    var routeData = {
      A: {
        title: "Group A · Heritage & Waterfront",
        desc: "Menjelajahi landmark bersejarah, kawasan pesisir, dan ruang publik Jakarta melalui perspektif produksi film.",
        more: "experiences.html#route-1",
        stops: [
          "Perjalanan menuju Lapangan Banteng",
          "Tour Lapangan Banteng – Istiqlal – Cathedral",
          "Perjalanan menuju Muara Angke",
          "Tour Pelabuhan Muara Angke",
          "Perjalanan menuju area Kota Tua",
          "Tour kawasan Kota Tua",
          "Perjalanan menuju Halte Bundaran HI",
          "Foto bersama di sky deck Halte Bundaran HI",
          "Perjalanan menuju FX Sudirman menggunakan MRT Jakarta"
        ]
      },
      B: {
        title: "Group B · Urban & Creative",
        desc: "Mengenal ruang kota, fasilitas olahraga, kawasan bersejarah, dan titik kreatif Jakarta dari perspektif produksi.",
        more: "experiences.html#route-2",
        stops: [
          "Perjalanan menuju Pasar Rumput & Jaksinema",
          "Tour Pasar Rumput & Jaksinema",
          "Perjalanan menuju Velodrome",
          "Tour Velodrome",
          "Perjalanan menuju Kota Tua",
          "Tour kawasan Kota Tua",
          "Perjalanan menuju Halte Bundaran HI",
          "Foto bersama di sky deck Halte Bundaran HI",
          "Perjalanan menuju FX Sudirman menggunakan MRT Jakarta"
        ]
      }
    };

    var lastTrigger = null;
    var title = document.getElementById("homeRouteTitle");
    var desc = document.getElementById("homeRouteDesc");
    var stops = document.getElementById("homeRouteStops");
    var more = document.getElementById("homeRouteMore");
    var closeButton = modal.querySelector(".home-route-close");

    function openRoute(key, trigger) {
      var route = routeData[key];
      if (!route) return;
      lastTrigger = trigger || null;
      title.textContent = route.title;
      desc.textContent = route.desc;
      stops.replaceChildren();

      route.stops.forEach(function (stop, index) {
        var li = document.createElement("li");
        var num = document.createElement("span");
        num.className = "home-route-num";
        num.textContent = String(index + 1).padStart(2, "0");
        var text = document.createElement("span");
        text.className = "home-route-stop-text";
        text.textContent = stop;
        li.append(num, text);
        stops.appendChild(li);
      });

      more.href = route.more;
      modal.classList.add("open");
      modal.setAttribute("aria-hidden", "false");
      document.body.classList.add("home-route-modal-open");
      var body = modal.querySelector(".home-route-body");
      if (body) body.scrollTop = 0;
      if (closeButton) closeButton.focus();
    }

    function closeRoute() {
      if (!modal.classList.contains("open")) return;
      modal.classList.remove("open");
      modal.setAttribute("aria-hidden", "true");
      document.body.classList.remove("home-route-modal-open");
      if (lastTrigger && typeof lastTrigger.focus === "function") lastTrigger.focus();
    }

    // Delegated listener means buttons work even if card markup is changed later.
    document.addEventListener("click", function (event) {
      var target = event.target;
      if (!(target instanceof Element)) return;
      var trigger = target.closest("[data-home-route-open]");
      if (trigger) {
        event.preventDefault();
        openRoute(trigger.getAttribute("data-home-route-open"), trigger);
        return;
      }
      if (target.closest("[data-home-route-close]")) closeRoute();
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeRoute();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initHomePage, { once: true });
  } else {
    initHomePage();
  }
})();
