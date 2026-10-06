/* ============================================================
 * admin-gallery.js — Gallery admin yang terhubung ke database.
 * Dimuat SETELAH admin.js (memakai API_BASE, handleSessionExpired).
 * Menggantikan prototipe gallery lama di admin.js.
 * ============================================================ */
(() => {
  "use strict";

  // Matikan prototipe lama (yang hanya menyimpan media di memori browser).
  if (typeof initGalleryView === "function") {
    document.removeEventListener("DOMContentLoaded", initGalleryView);
  }

  const $ = (id) => document.getElementById(id);
  const GAL = `${API_BASE}/gallery`;
  const MAX_IMAGE = 15 * 1024 * 1024;
  const MAX_VIDEO = 300 * 1024 * 1024;
  const OK_TYPES = /^(image\/(jpeg|png|webp)|video\/(mp4|quicktime))$/i;

  const h = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  // Path dari API relatif ke root website; halaman admin ada di /admin/.
  const U = (p) => (/^(https?:)?\/\//i.test(p || "") ? p : "../" + (p || ""));
  const bytes = (n) => {
    if (!n) return "—";
    const u = ["B", "KB", "MB", "GB"];
    const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), u.length - 1);
    return `${(n / Math.pow(1024, i)).toFixed(i ? 1 : 0)} ${u[i]}`;
  };

  const S = {
    items: [],
    filter: "all",
    day: "all",
    files: [],
    busy: false,
    editId: null,
  };

  // ---------- API ----------
  async function api(path, opts = {}) {
    const res = await fetch(GAL + path, { credentials: "include", ...opts });
    if (res.status === 401) {
      if (typeof handleSessionExpired === "function") handleSessionExpired();
      throw new Error("Sesi berakhir, silakan login lagi.");
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data;
  }
  const post = (path, body) =>
    api(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  async function load() {
    try {
      const d = await api("/admin");
      S.items = d.days.flatMap((x) => x.media);
    } catch (e) {
      console.error(e);
      $("galleryLibrary").innerHTML =
        `<div class="gallery-empty"><strong>Gagal memuat gallery</strong><p>${h(e.message)}</p><p>Pastikan tabel gallery sudah dibuat (gallery.sql) dan route /api/gallery terpasang.</p></div>`;
      return;
    }
    renderLibrary();
    renderStats();
  }

  // ---------- Library ----------
  function card(m) {
    const video = m.type === "video";
    const preview =
      video && !m.hasThumb && m.src
        ? `<video src="${h(U(m.src))}" muted preload="metadata"></video>`
        : `<img src="${h(U(m.image))}" alt="${h(m.title)}" loading="lazy">`;
    return `
    <article class="gallery-media-card${m.published ? "" : " is-draft"}">
      <div class="gallery-media-preview">
        ${preview}
        <span class="media-type">${video ? "VIDEO" : "PHOTO"}</span>
        ${m.published ? "" : '<span class="gal-draft-badge">DRAFT</span>'}
      </div>
      <div class="gallery-media-info">
        <div class="gallery-media-meta"><span>DAY ${m.day}</span><span>${h(m.session || "—")}</span></div>
        <h3>${h(m.title)}</h3>
        <div class="gallery-media-bottom"><span>${bytes(m.size)} · ${h(m.timestamp)}</span>
          <span class="${m.published ? "published-dot" : "gal-draft-text"}">${m.published ? "● Published" : "○ Draft"}</span></div>
        <div class="gal-actions">
          <button class="mini-btn" type="button" data-act="edit" data-id="${m.id}">Edit</button>
          <button class="mini-btn" type="button" data-act="toggle" data-id="${m.id}">${m.published ? "Sembunyikan" : "Publish"}</button>
          <button class="mini-btn gal-danger" type="button" data-act="delete" data-id="${m.id}">Hapus</button>
        </div>
      </div>
    </article>`;
  }

  function renderLibrary() {
    const wrap = $("galleryLibrary");
    if (!wrap) return;
    const list = S.items.filter(
      (m) =>
        (S.filter === "all" || m.type === S.filter) &&
        (S.day === "all" || String(m.day) === S.day),
    );
    $("galleryLibraryLabel").textContent = `${list.length} media ditampilkan`;
    if (!list.length) {
      wrap.innerHTML = `<div class="gallery-empty"><div class="gallery-empty-icon">▧</div><strong>Belum ada media</strong><p>Upload foto atau video dokumentasi untuk mulai mengisi Gallery.</p><button class="btn btn-primary" type="button" id="galEmptyUpload">＋ Upload Media</button></div>`;
      $("galEmptyUpload")?.addEventListener("click", () =>
        $("galleryOpenUploadBtn").click(),
      );
      return;
    }
    wrap.innerHTML = list.map(card).join("");
  }

  function renderStats() {
    const c = (f) => S.items.filter(f).length;
    $("galleryPhotoCount").textContent = c((x) => x.type === "photo");
    $("galleryVideoCount").textContent = c((x) => x.type === "video");
    $("galleryPublishedCount").textContent = c((x) => x.published);
    $("galleryDayCount").textContent = new Set(S.items.map((x) => x.day)).size;
    $("galleryTotalLabel").textContent = `${S.items.length} media`;
  }

  async function onLibraryClick(e) {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const m = S.items.find((x) => String(x.id) === btn.dataset.id);
    if (!m) return;
    try {
      if (btn.dataset.act === "edit") return openEdit(m);
      if (btn.dataset.act === "toggle") {
        const r = await post("/update", { id: m.id, published: !m.published });
        S.items = S.items.map((x) => (x.id === m.id ? r.item : x));
      } else if (btn.dataset.act === "delete") {
        if (!confirm(`Hapus "${m.title}"? File juga akan dihapus dari server.`))
          return;
        await post("/delete", { id: m.id });
        S.items = S.items.filter((x) => x.id !== m.id);
      }
      renderLibrary();
      renderStats();
    } catch (err) {
      alert(err.message);
    }
  }

  // ---------- Upload ----------
  function renderQueue(status = {}) {
    const q = $("galleryUploadQueue");
    q.innerHTML = S.files
      .map(
        (f, i) => `
      <div class="gallery-queue-item">
        <span class="gallery-queue-index">${i + 1}</span>
        <div><strong>${h(f.name)}</strong><small>${bytes(f.size)}${status[i] ? " · " + h(status[i]) : ""}</small></div>
      </div>`,
      )
      .join("");
  }

  function setFiles(list) {
    const rejected = [];
    const ok = [];
    Array.from(list || []).forEach((f) => {
      const video = f.type.startsWith("video/");
      if (!OK_TYPES.test(f.type))
        rejected.push(`${f.name}: format tidak didukung`);
      else if (f.size > (video ? MAX_VIDEO : MAX_IMAGE))
        rejected.push(
          `${f.name}: terlalu besar (maks ${video ? "300" : "15"} MB)`,
        );
      else ok.push(f);
    });
    if (rejected.length) alert("File dilewati:\n\n" + rejected.join("\n"));
    S.files = ok;
    renderQueue();
  }

  // Poster video dibuat di browser (frame ±1 detik); null kalau codec tidak didukung.
  function videoThumb(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.muted = true;
    v.preload = "auto";
    v.playsInline = true;
    let done = false, times = [], idx = 0, best = null, bestLum = -1;

    const finish = (b) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve(b);
    };
    const timer = setTimeout(() => finish(best), 12000);

    const next = () => {
      if (bestLum > 30 || idx >= times.length) return finish(best);
      v.currentTime = times[idx++];
    };

    v.onloadedmetadata = () => {
      const d = v.duration || 1;
      times = [0.1, 0.25, 0.5, 0.75].map((f) => Math.max(0.05, Math.min(d * f, d - 0.1)));
      next();
    };

    v.onseeked = () => {
      try {
        if (!v.videoWidth) return finish(best);
        const s = Math.min(1, 960 / v.videoWidth);
        const c = document.createElement("canvas");
        c.width = Math.round(v.videoWidth * s);
        c.height = Math.round(v.videoHeight * s);
        const ctx = c.getContext("2d");
        ctx.drawImage(v, 0, 0, c.width, c.height);
        // ukur kecerahan frame (sampling)
        const px = ctx.getImageData(0, 0, c.width, c.height).data;
        let sum = 0, n = 0;
        for (let i = 0; i < px.length; i += 200) {
          sum += px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114;
          n++;
        }
        const lum = sum / n;
        c.toBlob((b) => {
          if (b && lum > bestLum) { best = b; bestLum = lum; }
          next();
        }, "image/jpeg", 0.82);
      } catch (_) {
        next();
      }
    };

    v.onerror = () => finish(null);
    v.src = url;
  });
}

  async function publish() {
    if (S.busy) return;
    if (!S.files.length) {
      alert("Pilih minimal satu foto atau video terlebih dahulu.");
      return;
    }
    const day = $("galleryDayInput").value;
    const session = $("gallerySessionInput").value.trim();
    const caption = $("galleryCaptionInput").value.trim();
    const title = $("galleryTitleInput")?.value.trim() || "";
    const btn = $("galleryPublishBtn");
    const label = btn.textContent;
    S.busy = true;
    btn.disabled = true;

    const status = {};
    const failed = [];
    const total = S.files.length;
    for (let i = 0; i < total; i++) {
      const f = S.files[i];
      status[i] = "mengunggah…";
      renderQueue(status);
      btn.textContent = `Mengunggah ${i + 1}/${total}…`;
      try {
        const fd = new FormData();
        fd.append("file", f);
        fd.append("day", day);
        fd.append("session", session);
        fd.append("caption", caption);
        if (title) fd.append("title", total > 1 ? `${title} ${i + 1}` : title);
        if (f.type.startsWith("video/")) {
          const t = await videoThumb(f);
          if (t) fd.append("thumb", t, "thumb.jpg");
        }
        const res = await fetch(GAL + "/upload", {
          method: "POST",
          credentials: "include",
          body: fd,
        });
        if (res.status === 401 && typeof handleSessionExpired === "function")
          handleSessionExpired();
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
        S.items.unshift(data.item);
        status[i] = "✓ selesai";
      } catch (err) {
        status[i] = "✕ " + err.message;
        failed.push(f);
      }
      renderQueue(status);
    }

    S.busy = false;
    btn.disabled = false;
    btn.textContent = label;
    await load();

    if (!failed.length) {
      S.files = [];
      $("galleryFileInput").value = "";
      $("galleryCaptionInput").value = "";
      $("gallerySessionInput").value = "";
      if ($("galleryTitleInput")) $("galleryTitleInput").value = "";
      renderQueue();
      $("galleryUploadPanel").classList.add("hidden");
    } else {
      // Sisakan hanya yang gagal supaya bisa dicoba lagi; alasan gagal tetap tampil di antrian.
      const keep = {};
      let k = 0;
      Object.keys(status).forEach((i) => {
        if (status[i].startsWith("✕")) keep[k++] = status[i];
      });
      S.files = failed;
      alert(
        `${total - failed.length} berhasil, ${failed.length} gagal. Lihat keterangan di daftar antrian.`,
      );
      renderQueue(keep);
    }
  }

  // ---------- Edit dialog ----------
  function buildEditDialog() {
    const d = document.createElement("dialog");
    d.id = "galleryEditDialog";
    d.className = "days-dialog gal-edit-dialog";
    d.innerHTML = `
      <h3>Edit media</h3>
      <div class="gal-edit-grid">
        <label class="full">Judul<input id="galEditTitle" type="text" maxlength="200"></label>
        <label>Hari<select id="galEditDay"><option value="1">Day 1</option><option value="2">Day 2</option><option value="3">Day 3</option></select></label>
        <label>Sesi<input id="galEditSession" type="text" maxlength="120"></label>
        <label class="full">Waktu pengambilan<input id="galEditTaken" type="datetime-local"></label>
        <label class="full">Caption<textarea id="galEditCaption" rows="3"></textarea></label>
        <label class="full" id="galEditVideoWrap">URL video (opsional, link langsung file .mp4)<input id="galEditVideoUrl" type="url" placeholder="https://…"></label>
        <label class="full gal-check"><input id="galEditPublished" type="checkbox"> Tampilkan di website (Published)</label>
      </div>
      <div class="settings-hint" id="galEditError" style="color:#B34A00;"></div>
      <div class="days-dialog-actions">
        <button type="button" class="btn btn-ghost" id="galEditCancel">Batal</button>
        <button type="button" class="btn btn-primary" id="galEditSave">Simpan</button>
      </div>`;
    document.body.appendChild(d);
    $("galEditCancel").addEventListener("click", () => d.close());
    $("galEditSave").addEventListener("click", saveEdit);
  }

  function openEdit(m) {
    S.editId = m.id;
    $("galEditTitle").value = m.title;
    $("galEditDay").value = String(m.day);
    $("galEditSession").value = m.session || "";
    $("galEditTaken").value = (m.takenAt || "").slice(0, 16);
    $("galEditCaption").value = m.caption || "";
    $("galEditVideoUrl").value = m.videoUrl || "";
    $("galEditVideoWrap").style.display = m.type === "video" ? "" : "none";
    $("galEditPublished").checked = !!m.published;
    $("galEditError").textContent = "";
    $("galleryEditDialog").showModal();
  }

  async function saveEdit() {
    const m = S.items.find((x) => x.id === S.editId);
    if (!m) return;
    const body = {
      id: m.id,
      title: $("galEditTitle").value.trim(),
      day: Number($("galEditDay").value),
      session: $("galEditSession").value.trim(),
      takenAt: $("galEditTaken").value,
      caption: $("galEditCaption").value.trim(),
      published: $("galEditPublished").checked,
    };
    if (m.type === "video") body.videoUrl = $("galEditVideoUrl").value.trim();
    if (!body.title) {
      $("galEditError").textContent = "Judul wajib diisi.";
      return;
    }
    try {
      const r = await post("/update", body);
      S.items = S.items.map((x) => (x.id === m.id ? r.item : x));
      $("galleryEditDialog").close();
      renderLibrary();
      renderStats();
    } catch (err) {
      $("galEditError").textContent = err.message;
    }
  }

  // ---------- Setup ----------
  function injectStyles() {
    const s = document.createElement("style");
    s.textContent = `
      .gallery-media-card.is-draft .gallery-media-preview{opacity:.55}
      .gal-draft-badge{position:absolute;left:10px;bottom:10px;background:#B34A00;color:#fff;font-size:11px;font-weight:700;padding:3px 8px;border-radius:999px;letter-spacing:.04em}
      .gal-draft-text{color:#B34A00;font-weight:600;font-size:12px}
      .gal-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
      .gal-danger{color:#B34A00}
      .gal-edit-dialog{width:min(520px,92vw)}
      .gal-edit-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:14px 0}
      .gal-edit-grid label{display:flex;flex-direction:column;gap:4px;font-size:13px;font-weight:600}
      .gal-edit-grid label.full{grid-column:1/-1}
      .gal-edit-grid input[type=text],.gal-edit-grid input[type=url],.gal-edit-grid input[type=datetime-local],.gal-edit-grid select,.gal-edit-grid textarea{font:inherit;padding:8px 10px;border:1px solid #E6D9BC;border-radius:8px;background:#fff}
      .gal-edit-grid .gal-check{flex-direction:row;align-items:center;gap:8px}
    `;
    document.head.appendChild(s);
  }

  function init() {
    injectStyles();
    buildEditDialog();

    // Field judul (opsional) di form upload.
    const grid = document.querySelector(
      "#galleryUploadPanel .gallery-form-grid",
    );
    if (grid && !$("galleryTitleInput")) {
      const l = document.createElement("label");
      l.className = "full";
      l.innerHTML = `Judul (opsional)<input id="galleryTitleInput" type="text" maxlength="200" placeholder="Kosongkan untuk memakai nama file" autocomplete="off">`;
      grid.insertBefore(l, grid.firstChild);
    }
    const note = document.querySelector(".gallery-note");
    if (note)
      note.textContent =
        "Media tersimpan permanen di server (database + folder uploads). Maks. foto 15 MB, video 300 MB. Poster video dibuat otomatis.";

    const panel = $("galleryUploadPanel");
    $("galleryOpenUploadBtn")?.addEventListener("click", () => {
      panel.classList.remove("hidden");
      setTimeout(
        () => panel.scrollIntoView({ behavior: "smooth", block: "start" }),
        30,
      );
    });
    $("galleryCloseUploadBtn")?.addEventListener("click", () =>
      panel.classList.add("hidden"),
    );
    $("galleryFileInput")?.addEventListener("change", (e) =>
      setFiles(e.target.files),
    );
    $("galleryPublishBtn")?.addEventListener("click", publish);

    const dz = $("galleryDropzone");
    ["dragenter", "dragover"].forEach((ev) =>
      dz?.addEventListener(ev, (e) => {
        e.preventDefault();
        dz.classList.add("dragover");
      }),
    );
    ["dragleave", "drop"].forEach((ev) =>
      dz?.addEventListener(ev, (e) => {
        e.preventDefault();
        dz.classList.remove("dragover");
      }),
    );
    dz?.addEventListener("drop", (e) => setFiles(e.dataTransfer.files));

    $("galleryDayFilter")?.addEventListener("change", (e) => {
      S.day = e.target.value;
      renderLibrary();
    });
    document.querySelectorAll("[data-gallery-filter]").forEach((b) =>
      b.addEventListener("click", () => {
        document
          .querySelectorAll("[data-gallery-filter]")
          .forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
        S.filter = b.dataset.galleryFilter;
        renderLibrary();
      }),
    );
    $("galleryLibrary")?.addEventListener("click", onLibraryClick);

    // Muat data tiap kali tab Gallery dibuka (sudah login pada saat itu).
    document
      .querySelector('.nav-item[data-view="gallery"]')
      ?.addEventListener("click", load);
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init);
  else init();
})();
