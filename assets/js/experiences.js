/* =======================================================
   Jakarta Film Summit — Experiences page behaviour
   Requires: common.js
   - Route switcher (Route 01 / Route 02)
   - Illustrative route map (SVG) built from each stop list
   - "Open route in Google Maps" link built from stop names
   ======================================================= */
(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var W = 520;
  var H = 400;

  function el(name, attrs) {
    var n = document.createElementNS(NS, name);
    Object.keys(attrs || {}).forEach(function (k) {
      n.setAttribute(k, attrs[k]);
    });
    return n;
  }

  // Titik-titik rute: bergelombang dari kiri ke kanan
  function points(count, phase) {
    var pts = [];
    var left = 62;
    var right = W - 62;
    for (var i = 0; i < count; i++) {
      var x = left + (i * (right - left)) / (count - 1);
      var y = H / 2 + Math.sin(i * 1.15 + phase) * 105;
      pts.push({ x: x, y: y });
    }
    return pts;
  }

  // Catmull-Rom -> cubic bezier supaya garis rute melengkung halus
  function smoothPath(p) {
    var d = "M" + p[0].x + " " + p[0].y;
    for (var i = 0; i < p.length - 1; i++) {
      var p0 = p[i - 1] || p[i];
      var p1 = p[i];
      var p2 = p[i + 1];
      var p3 = p[i + 2] || p2;
      var c1x = p1.x + (p2.x - p0.x) / 6;
      var c1y = p1.y + (p2.y - p0.y) / 6;
      var c2x = p2.x - (p3.x - p1.x) / 6;
      var c2y = p2.y - (p3.y - p1.y) / 6;
      d += " C" + c1x + " " + c1y + "," + c2x + " " + c2y + "," + p2.x + " " + p2.y;
    }
    return d;
  }

  function buildMap(panel) {
    var map = panel.querySelector(".route-map");
    var items = panel.querySelectorAll(".stop-list li");
    if (!map || !items.length) return;

    var pts = points(items.length, parseFloat(map.dataset.phase) || 0);
    var svg = el("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-hidden": "true" });

    // pola grid ala peta
    var grid = el("g", { class: "map-grid" });
    for (var gx = 40; gx < W; gx += 40) {
      grid.appendChild(el("line", { x1: gx, y1: 0, x2: gx, y2: H }));
    }
    for (var gy = 40; gy < H; gy += 40) {
      grid.appendChild(el("line", { x1: 0, y1: gy, x2: W, y2: gy }));
    }
    svg.appendChild(grid);

    var d = smoothPath(pts);
    svg.appendChild(el("path", { d: d, class: "route-base" }));
    svg.appendChild(el("path", { d: d, class: "route-line", pathLength: "1" }));

    pts.forEach(function (pt, i) {
      var above = i % 2 === 0;
      var g = el("g", { class: "map-node", "data-i": i });
      g.appendChild(el("circle", { cx: pt.x, cy: pt.y, r: 22, class: "node-halo" }));
      g.appendChild(el("circle", { cx: pt.x, cy: pt.y, r: 15, class: "node-dot" }));
      var num = el("text", { x: pt.x, y: pt.y + 4.5, class: "node-num", "text-anchor": "middle" });
      num.textContent = String(i + 1);
      g.appendChild(num);
      var label = el("text", {
        x: pt.x,
        y: above ? pt.y - 30 : pt.y + 38,
        class: "node-label",
        "text-anchor": "middle",
      });
      label.textContent = items[i].dataset.short || "";
      g.appendChild(label);
      svg.appendChild(g);

      // hover daftar <-> titik di peta
      items[i].addEventListener("mouseenter", function () { g.classList.add("is-on"); });
      items[i].addEventListener("mouseleave", function () { g.classList.remove("is-on"); });
      g.addEventListener("mouseenter", function () { items[i].classList.add("is-on"); });
      g.addEventListener("mouseleave", function () { items[i].classList.remove("is-on"); });
    });

    map.appendChild(svg);

    // tautan Google Maps (rute berurutan antar titik)
    var link = panel.querySelector(".route-open");
    if (link) {
      var parts = Array.prototype.map.call(items, function (li) {
        return encodeURIComponent((li.dataset.q || li.textContent) + ", Jakarta");
      });
      link.href = "https://www.google.com/maps/dir/" + parts.join("/");
    }
  }

  function initRoutes() {
    var tabs = Array.prototype.slice.call(document.querySelectorAll(".route-tab"));
    var panels = Array.prototype.slice.call(document.querySelectorAll(".route-panel"));
    if (!tabs.length) return;

    panels.forEach(buildMap);

    function select(id, focus) {
      tabs.forEach(function (t) {
        var on = t.dataset.route === id;
        t.classList.toggle("active", on);
        t.setAttribute("aria-selected", on ? "true" : "false");
        t.tabIndex = on ? 0 : -1;
        if (on && focus) t.focus();
      });
      panels.forEach(function (p) {
        var on = p.id === id;
        p.hidden = !on;
        p.classList.toggle("active", on);
      });
    }

    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { select(t.dataset.route); });
      t.addEventListener("keydown", function (e) {
        var next = null;
        if (e.key === "ArrowRight") next = tabs[(i + 1) % tabs.length];
        if (e.key === "ArrowLeft") next = tabs[(i - 1 + tabs.length) % tabs.length];
        if (next) {
          e.preventDefault();
          select(next.dataset.route, true);
        }
      });
    });

    // dukung link langsung: experiences.html#route-2
    var hash = (location.hash || "").replace("#", "");
    if (hash === "route-1" || hash === "route-2") {
      select(hash);
      var box = document.getElementById("scouting-routes");
      if (box) setTimeout(function () { box.scrollIntoView({ behavior: "smooth", block: "start" }); }, 150);
    }
  }

  document.addEventListener("DOMContentLoaded", initRoutes);
})();
