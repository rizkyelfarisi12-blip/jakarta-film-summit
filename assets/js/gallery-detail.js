(() => {
  "use strict";
  const state = { data: null, day: null, filter: "all", items: [], index: 0 };
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (v = "") =>
    String(v).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#039;",
        })[c],
    );
  const params = new URLSearchParams(location.search);

  // Data gallery dari database lewat API (hanya media yang berstatus published).
  async function load() {
    const res = await fetch("api/gallery", { cache: "no-store" });
    if (!res.ok)
      throw new Error("API gallery tidak dapat dimuat (" + res.status + ")");
    return res.json();
  }

  function image(item) {
    return item.image || "assets/gallery/hero_bg.jpeg";
  }
  function fileName(url, fallback) {
    const n = String(url || "")
      .split("?")[0]
      .split("/")
      .pop();
    return n || fallback;
  }
  function visible() {
    let items = state.day.media.filter(
      (m) => state.filter === "all" || m.type === state.filter,
    );
    const sort = $("#sortSelect")?.value || "newest";
    // takenAt = ISO (YYYY-MM-DDTHH:mm:ss) sehingga bisa dibandingkan sebagai string
    items = [...items].sort((a, b) =>
      sort === "newest"
        ? String(b.takenAt).localeCompare(String(a.takenAt))
        : String(a.takenAt).localeCompare(String(b.takenAt)),
    );
    state.items = items;
    return items;
  }

  function render() {
    const root = $("#detailGrid");
    const items = visible();
    root.innerHTML = items.length
      ? items
          .map(
            (item, i) => `
      <button class="detail-card" type="button" data-index="${i}" aria-label="Buka ${esc(item.title)}">
        <img src="${esc(image(item))}" alt="${esc(item.title)}" loading="lazy">
        ${item.type === "video" ? `<span class="media-badge"><span class="play-dot"></span>Video</span>` : ""}
        <div class="card-info"><div class="card-type">${item.type === "video" ? "Video" : "Foto"}</div><p class="card-title">${esc(item.title)}</p><div class="card-time">${esc(item.timestamp || "")}</div></div>
      </button>`,
          )
          .join("")
      : '<div class="gallery-empty" style="grid-column:1/-1">Belum ada media untuk filter ini.</div>';
    $$(".detail-card", root).forEach((card) =>
      card.addEventListener("click", () => open(Number(card.dataset.index))),
    );
  }

  function open(index) {
    if (!state.items.length) return;
    state.index = (index + state.items.length) % state.items.length;
    const item = state.items[state.index];
    const box = $("#mediaLightbox"),
      media = $("#lightboxMedia"),
      download = $("#lightboxDownload");
    $("#lightboxCounter").textContent =
      `${state.index + 1} / ${state.items.length}`;
    $("#lightboxTitle").textContent = item.title || "";
    $("#lightboxMeta").textContent = [item.timestamp, item.session]
      .filter(Boolean)
      .join(" · ");
    $("#lightboxCaption").textContent = item.caption || "";
    media.innerHTML = "";
    if (item.type === "video") {
      if (item.src) {
        const v = document.createElement("video");
        v.controls = true;
        v.autoplay = true;
        v.playsInline = true;
        v.poster = image(item);
        v.src = item.src;
        media.appendChild(v);
        download.href = item.src;
        download.setAttribute("download", fileName(item.src, "jfs-video.mp4"));
        download.removeAttribute("hidden");
      } else {
        media.innerHTML = `<div class="video-empty">Video belum memiliki file atau URL.</div>`;
        download.setAttribute("hidden", "hidden");
      }
    } else {
      const im = document.createElement("img");
      im.src = image(item);
      im.alt = item.title || "Gallery";
      media.appendChild(im);
      download.href = image(item);
      download.setAttribute(
        "download",
        fileName(image(item), "jfs-gallery.jpg"),
      );
      download.removeAttribute("hidden");
    }
    box.classList.add("open");
    box.setAttribute("aria-hidden", "false");
    document.body.classList.add("lightbox-open");
  }
  function close() {
    const box = $("#mediaLightbox");
    box.classList.remove("open");
    box.setAttribute("aria-hidden", "true");
    document.body.classList.remove("lightbox-open");
    $("#lightboxMedia").innerHTML = "";
  }
  function move(dir) {
    open(state.index + dir);
  }

  function bind() {
    $$("#detailFilters .media-filter").forEach((btn) =>
      btn.addEventListener("click", () => {
        $$("#detailFilters .media-filter").forEach((b) =>
          b.classList.remove("active"),
        );
        btn.classList.add("active");
        state.filter = btn.dataset.filter;
        render();
      }),
    );
    $("#sortSelect")?.addEventListener("change", render);
    $$("[data-close-lightbox]").forEach((el) =>
      el.addEventListener("click", close),
    );
    $("#lightboxPrev").addEventListener("click", () => move(-1));
    $("#lightboxNext").addEventListener("click", () => move(1));
    document.addEventListener("keydown", (e) => {
      if (!$("#mediaLightbox").classList.contains("open")) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") move(-1);
      if (e.key === "ArrowRight") move(1);
    });
  }

  function setDay() {
    const id = params.get("day") || "day-1";

    state.day = state.data.days.find((d) => d.id === id) || state.data.days[0];
    if (!state.day) throw new Error("Belum ada data hari di database.");

    $("#detailTitle").textContent = state.day.label;
    $("#detailDate").textContent = state.day.date;
    $("#detailIntro").textContent = state.day.intro || "";

    document.title = `${state.day.label} — Gallery — Jakarta Film Summit 2026`;

    // Hero: foto terbaru hari tersebut (fallback hero_bg.jpeg).
    const heroItem =
      state.day.media?.find((item) => item.type === "photo" && item.image) ||
      state.day.media?.find((item) => item.image);
    const heroImage = heroItem?.image || "assets/gallery/hero_bg.jpeg";
    const hero = $("#detailHeroBg");
    if (hero) {
      hero.style.backgroundImage = `url("${encodeURI(heroImage)}")`;
    }
  }

  async function init() {
    try {
      state.data = await load();
      setDay();
      bind();
      render();
    } catch (err) {
      console.error(err);
      $("#detailGrid").innerHTML =
        '<div class="gallery-empty" style="grid-column:1/-1">Gallery belum dapat dimuat. Pastikan server dan database aktif.</div>';
    }
  }
  init();
})();
