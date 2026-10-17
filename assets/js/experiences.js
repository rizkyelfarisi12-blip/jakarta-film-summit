/* =======================================================
   Jakarta Film Summit — Experiences page behaviour
   Requires: common.js
   - Route switcher (Rute A / Rute B)
   - Illustrative route map (SVG) built from each stop list
   - "Buka rute di Google Maps": rute lengkap (titik awal + semua
     lokasi berurutan seperti di peta ilustrasi)
   - Popup foto lokasi (klik daftar lokasi atau titik di peta)
     Foto dicari otomatis: file Wikimedia Commons -> thumbnail
     Wikipedia -> foto lama (data-img) -> placeholder
   ======================================================= */
(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var W = 520;
  var H = 400;

  /* =====================================================
     DATA RUTE
     Urutan array = urutan <li> di experiences.html (01 … 09).

     maps  : nama tempat untuk Google Maps (boleh lebih dari satu,
             dipakai berurutan). Kosongkan [] jika langkah itu
             hanya "tour" di tempat yang sama dengan langkah sebelumnya.
     files : nama file di Wikimedia Commons (foto pasti ada)
     wiki  : artikel Wikipedia "bahasa:Judul_Artikel" — foto utama
             artikel dipakai sebagai gambar
     ===================================================== */
  var START_POINT = "Park Hyatt Jakarta"; // titik awal semua rute

  var STOPS = {
    "route-1": [
      { // 01 Perjalanan menuju Lapangan Banteng
        maps: ["Lapangan Banteng, Jakarta"],
        files: ["Tugu Lapangan Banteng.jpg"],
        wiki: ["en:Lapangan_Banteng", "id:Lapangan_Banteng"]
      },
      { // 02 Tour Lapangan Banteng – Istiqlal – Cathedral
        maps: ["Masjid Istiqlal, Jakarta", "Gereja Katedral Jakarta"],
        files: ["Istiqlal Mosque.jpg"],
        wiki: ["en:Istiqlal_Mosque,_Jakarta", "en:Jakarta_Cathedral"]
      },
      { // 03 Perjalanan menuju Muara Angke
        maps: ["Pelabuhan Muara Angke, Jakarta"],
        files: [],
        wiki: ["en:Muara_Angke", "id:Muara_Angke"]
      },
      { // 04 Tour Pelabuhan Muara Angke
        maps: [],
        files: [],
        wiki: ["en:Muara_Angke", "id:Muara_Angke"]
      },
      { // 05 Perjalanan menuju area Kota Tua
        maps: ["Museum Fatahillah, Kota Tua, Jakarta"],
        files: ["Stadhuis Batavia, Jakarta.jpg"],
        wiki: ["en:Jakarta_Old_Town", "en:Fatahillah_Square", "en:Jakarta_History_Museum"]
      },
      { // 06 Tour kawasan Kota Tua
        maps: [],
        files: ["Stadhuis Batavia, Jakarta.jpg"],
        wiki: ["en:Jakarta_Old_Town", "en:Fatahillah_Square", "en:Jakarta_History_Museum"]
      },
      { // 07 Perjalanan menuju Halte Bundaran HI
        maps: ["Halte Bundaran HI, Jakarta"],
        files: [],
        wiki: ["id:Halte_Transjakarta_Bundaran_HI", "en:Selamat_Datang_Monument", "id:Bundaran_Hotel_Indonesia"]
      },
      { // 08 Foto bersama di sky deck Halte Bundaran HI
        maps: [],
        files: [],
        wiki: ["id:Halte_Transjakarta_Bundaran_HI", "en:Selamat_Datang_Monument", "id:Bundaran_Hotel_Indonesia"]
      },
      { // 09 Perjalanan menuju FX Sudirman (MRT)
        maps: ["FX Sudirman, Jakarta"],
        files: ["FX Sudirman.jpg"],
        wiki: ["en:FX_Sudirman", "id:FX_Sudirman"]
      }
    ],

    "route-2": [
      { // 01 Perjalanan menuju Pasar Rumput & Jaksinema
        maps: ["Pasar Rumput, Jakarta"],
        files: [],
        wiki: ["id:Jaksinema", "id:Pasar_Rumput", "en:Pasar_Rumput"]
      },
      { // 02 Tour Pasar Rumput & Jaksinema
        maps: [],
        files: [],
        wiki: ["id:Jaksinema", "id:Pasar_Rumput", "en:Pasar_Rumput"]
      },
      { // 03 Perjalanan menuju Velodrome
        maps: ["Jakarta International Velodrome, Rawamangun, Jakarta"],
        files: [],
        wiki: ["en:Jakarta_International_Velodrome", "id:Jakarta_International_Velodrome"]
      },
      { // 04 Tour Velodrome
        maps: [],
        files: [],
        wiki: ["en:Jakarta_International_Velodrome", "id:Jakarta_International_Velodrome"]
      },
      { // 05 Perjalanan menuju Kota Tua
        maps: ["Museum Fatahillah, Kota Tua, Jakarta"],
        files: ["Stadhuis Batavia, Jakarta.jpg"],
        wiki: ["en:Jakarta_Old_Town", "en:Fatahillah_Square", "en:Jakarta_History_Museum"]
      },
      { // 06 Tour kawasan Kota Tua
        maps: [],
        files: ["Stadhuis Batavia, Jakarta.jpg"],
        wiki: ["en:Jakarta_Old_Town", "en:Fatahillah_Square", "en:Jakarta_History_Museum"]
      },
      { // 07 Perjalanan menuju Halte Bundaran HI
        maps: ["Halte Bundaran HI, Jakarta"],
        files: [],
        wiki: ["id:Halte_Transjakarta_Bundaran_HI", "en:Selamat_Datang_Monument", "id:Bundaran_Hotel_Indonesia"]
      },
      { // 08 Foto bersama di sky deck Halte Bundaran HI
        maps: [],
        files: [],
        wiki: ["id:Halte_Transjakarta_Bundaran_HI", "en:Selamat_Datang_Monument", "id:Bundaran_Hotel_Indonesia"]
      },
      { // 09 Perjalanan menuju FX Sudirman (MRT)
        maps: ["FX Sudirman, Jakarta"],
        files: ["FX Sudirman.jpg"],
        wiki: ["en:FX_Sudirman", "id:FX_Sudirman"]
      }
    ]
  };

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

  /* =====================================================
     FOTO LOKASI — pencari gambar otomatis
     ===================================================== */
  var wikiCache = {}; // "en:Judul" -> Promise<[{url}]>

  function fileUrls(files) {
    return (files || []).map(function (f) {
      return {
        url: "https://commons.wikimedia.org/wiki/Special:FilePath/" + encodeURIComponent(f) + "?width=1200",
        from: "wiki"
      };
    });
  }

  // Ambil foto utama artikel Wikipedia lewat REST API (mendukung CORS)
  function wikiOne(spec) {
    if (wikiCache[spec]) return wikiCache[spec];
    var i = spec.indexOf(":");
    var lang = spec.slice(0, i);
    var title = spec.slice(i + 1);
    var api = "https://" + lang + ".wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(title);
    wikiCache[spec] = fetch(api)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        var out = [];
        if (j && j.thumbnail && j.thumbnail.source) {
          // minta ukuran lebih besar dari thumbnail bawaan (320px)
          out.push({ url: j.thumbnail.source.replace(/\/\d+px-/, "/1200px-"), from: "wiki" });
          out.push({ url: j.thumbnail.source, from: "wiki" });
        }
        if (j && j.originalimage && j.originalimage.source) {
          out.push({ url: j.originalimage.source, from: "wiki" });
        }
        return out;
      })
      .catch(function () { return []; });
    return wikiCache[spec];
  }

  function wikiUrls(specs) {
    return Promise.all((specs || []).map(wikiOne)).then(function (lists) {
      return [].concat.apply([], lists);
    });
  }

  // Coba url satu per satu, kembalikan yang pertama berhasil dimuat
  function firstLoadable(list) {
    return new Promise(function (resolve) {
      var k = 0;
      (function next() {
        if (k >= list.length) return resolve(null);
        var item = list[k++];
        var probe = new Image();
        probe.referrerPolicy = "no-referrer"; // lolos dari proteksi hotlink
        probe.onload = function () { resolve(item); };
        probe.onerror = next;
        probe.src = item.url;
      })();
    });
  }

  /* ---------- popup foto lokasi ---------- */
  var stop = { items: null, cfgs: null, i: 0, trigger: null, token: 0 };

  function stopName(li) {
    var num = li.querySelector(".stop-num");
    return li.textContent.replace(num ? num.textContent : "", "").trim();
  }

  function loadPhoto(cfg, li, name, token) {
    var wrap = document.getElementById("stopModalPhotoWrap");
    var img = document.getElementById("stopModalPhoto");
    var desc = document.getElementById("stopModalDesc");

    var stages = [
      function () { return Promise.resolve(fileUrls(cfg && cfg.files)); },
      function () { return wikiUrls(cfg && cfg.wiki); },
      function () {
        return Promise.resolve(li.dataset.img ? [{ url: li.dataset.img, from: "orig" }] : []);
      }
    ];

    (function run(s) {
      if (token !== stop.token) return;
      if (s >= stages.length) {
        wrap.classList.add("is-empty");
        return;
      }
      stages[s]()
        .then(firstLoadable)
        .then(function (hit) {
          if (token !== stop.token) return;
          if (!hit) return run(s + 1);
          img.referrerPolicy = "no-referrer";
          img.src = hit.url;
          img.alt = name;
          wrap.classList.remove("is-empty");
          if (hit.from === "wiki") {
            desc.textContent = "Foto: Wikimedia Commons / Wikipedia (lisensi terbuka — cantumkan atribusi sesuai halaman file).";
          } else {
            desc.textContent = li.dataset.desc || "";
          }
          desc.hidden = !desc.textContent;
        });
    })(0);
  }

  function openStop(items, i, trigger, cfgs) {
    var modal = document.getElementById("stopModal");
    if (!modal) return;
    stop.items = items;
    if (cfgs) stop.cfgs = cfgs;
    stop.i = (i + items.length) % items.length;
    if (trigger) stop.trigger = trigger;
    stop.token++;

    var li = items[stop.i];
    var name = stopName(li);
    var wrap = document.getElementById("stopModalPhotoWrap");
    var img = document.getElementById("stopModalPhoto");

    // kosongkan foto lama supaya tidak "nyangkut" saat pindah lokasi
    wrap.classList.remove("is-empty");
    img.removeAttribute("src");
    img.alt = name;

    document.getElementById("stopModalCount").textContent =
      "Lokasi " + String(stop.i + 1).padStart(2, "0") + " / " + String(items.length).padStart(2, "0");
    document.getElementById("stopModalName").textContent = name;
    var desc = document.getElementById("stopModalDesc");
    desc.textContent = "";
    desc.hidden = true;
    document.getElementById("stopModalMaps").href =
      "https://www.google.com/maps/search/?api=1&query=" +
      encodeURIComponent((li.dataset.q || name) + ", Jakarta");

    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("stop-modal-open");
    modal.querySelector(".stop-close").focus();

    loadPhoto(stop.cfgs && stop.cfgs[stop.i], li, name, stop.token);
  }

  function closeStop() {
    var modal = document.getElementById("stopModal");
    if (!modal || !modal.classList.contains("open")) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("stop-modal-open");
    stop.token++;
    if (stop.trigger && stop.trigger.focus) stop.trigger.focus();
  }

  function initStopModal() {
    var modal = document.getElementById("stopModal");
    if (!modal) return;
    Array.prototype.forEach.call(modal.querySelectorAll("[data-close-stop]"), function (b) {
      b.addEventListener("click", closeStop);
    });
    document.getElementById("stopPrev").addEventListener("click", function () {
      openStop(stop.items, stop.i - 1);
    });
    document.getElementById("stopNext").addEventListener("click", function () {
      openStop(stop.items, stop.i + 1);
    });
    document.addEventListener("keydown", function (e) {
      if (!modal.classList.contains("open")) return;
      if (e.key === "Escape") closeStop();
      if (e.key === "ArrowLeft") openStop(stop.items, stop.i - 1);
      if (e.key === "ArrowRight") openStop(stop.items, stop.i + 1);
    });
  }

  /* ---------- tautan Google Maps (rute lengkap) ---------- */
  function buildMapsUrl(cfgs) {
    var places = [];
    (cfgs || []).forEach(function (c) {
      (c.maps || []).forEach(function (p) {
        if (places[places.length - 1] !== p) places.push(p); // buang duplikat berurutan
      });
    });
    if (!places.length) return null;

    var destination = places[places.length - 1];
    var waypoints = places.slice(0, -1); // Google Maps maks. 9 titik singgah

    var url =
      "https://www.google.com/maps/dir/?api=1" +
      "&origin=" + encodeURIComponent(START_POINT) +
      "&destination=" + encodeURIComponent(destination) +
      "&travelmode=driving";
    if (waypoints.length) {
      url += "&waypoints=" + encodeURIComponent(waypoints.join("|"));
    }
    return url;
  }

  /* ---------- peta rute ---------- */
  function buildMap(panel) {
    var map = panel.querySelector(".route-map");
    var items = panel.querySelectorAll(".stop-list li");
    if (!map || !items.length) return;

    var cfgs = STOPS[panel.id] || [];

    var pts = points(items.length, parseFloat(map.dataset.phase) || 0);
    var svg = el("svg", { viewBox: "0 0 " + W + " " + H, role: "group", "aria-label": "Peta ilustrasi rute" });

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

      // klik -> popup foto
      items[i].setAttribute("role", "button");
      items[i].setAttribute("tabindex", "0");
      items[i].addEventListener("click", function () { openStop(items, i, items[i], cfgs); });
      items[i].addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openStop(items, i, items[i], cfgs);
        }
      });
      g.setAttribute("tabindex", "0");
      g.setAttribute("role", "button");
      g.addEventListener("click", function () { openStop(items, i, g, cfgs); });
      g.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openStop(items, i, g, cfgs);
        }
      });
    });

    map.appendChild(svg);

    // Tautan Google Maps: titik awal -> semua lokasi berurutan
    var link = panel.querySelector(".route-open");
    if (link) {
      var url = buildMapsUrl(cfgs);
      if (url) link.href = url;
    }
  }

  function initRoutes() {
    var tabs = Array.prototype.slice.call(document.querySelectorAll(".route-tab"));
    var panels = Array.prototype.slice.call(document.querySelectorAll(".route-panel"));
    if (!tabs.length) return;

    initStopModal();
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