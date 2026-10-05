(() => {
  "use strict";
  const state = { data: null, filter: "all" };
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

  async function load() {
    const res = await fetch("assets/data/gallery.json", { cache: "no-store" });
    if (!res.ok) throw new Error("gallery.json tidak dapat dimuat");
    return res.json();
  }

  function img(item) {
    return item.image || "assets/gallery/hero_bg.jpeg";
  }

  function filtered(media) {
    return state.filter === "all"
      ? media
      : media.filter((m) => m.type === state.filter);
  }

  function render() {
    const root = $("#daySections");
    root.innerHTML = state.data.days
      .map((day) => {
        const items = filtered(day.media);
        if (!items.length) return "";
        const preview = items.slice(0, 5);
        return `
        <section class="day-section">
          <div class="day-section-head">
            <div><h2 class="day-section-title">${esc(day.label)}</h2><div class="day-section-date">${esc(day.date)}</div></div>
            <a class="see-all" href="gallery-detail.html?day=${encodeURIComponent(day.id)}">Lihat Semua <span>→</span></a>
          </div>
          <div class="day-preview-grid">
            ${preview
              .map(
                (item, i) => `
              <a class="preview-card" href="gallery-detail.html?day=${encodeURIComponent(day.id)}" aria-label="Lihat semua gallery ${esc(day.label)}">
                <img src="${esc(img(item))}" alt="${esc(item.title)}" loading="lazy">
                ${item.type === "video" ? `<span class="media-badge"><span class="play-dot"></span>Video</span>` : ""}
                <div class="preview-info"><p class="preview-title">${esc(item.title)}</p></div>
              </a>`,
              )
              .join("")}
          </div>
        </section>`;
      })
      .join("");
    if (!root.innerHTML)
      root.innerHTML =
        '<div class="gallery-empty">Belum ada media untuk filter ini.</div>';
  }

  function bind() {
    $$("#overviewFilters .media-filter").forEach((btn) =>
      btn.addEventListener("click", () => {
        $$("#overviewFilters .media-filter").forEach((b) =>
          b.classList.remove("active"),
        );
        btn.classList.add("active");
        state.filter = btn.dataset.filter;
        render();
      }),
    );
  }

  async function init() {
    try {
      state.data = await load();
      bind();
      render();
    } catch (err) {
      console.error(err);
      $("#daySections").innerHTML =
        '<div class="gallery-empty">Gallery belum dapat dimuat. Pastikan assets/data/gallery.json tersedia.</div>';
    }
  }
  init();
})();
