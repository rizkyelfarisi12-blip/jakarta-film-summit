/* ============================================================
 * admin-agenda.js — kelola Agenda (sesi + pembicara) di admin panel.
 * Dimuat SETELAH admin.js (memakai API_BASE, handleSessionExpired).
 * Menambahkan sendiri tombol nav "Agenda" dan view-nya, jadi admin.html
 * cukup menambah satu <script>.
 * ============================================================ */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const AG = `${API_BASE}/agenda`;
  const MAX_PHOTO = 3 * 1024 * 1024;
  const TYPES = [
    "Registration",
    "Performance",
    "Opening",
    "Ceremony",
    "Keynote",
    "Transition",
    "Talkshow",
    "Forum",
    "Break",
    "Closing",
    "Gala Dinner",
    "Tour",
  ];

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
  const initials = (n) =>
    String(n || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("") || "?";

  const S = {
    days: [],
    speakers: [],
    day: "1",
    tab: "sessions",
    editId: null,
    editSpeakerId: null,
    sel: [],
  };

  // ---------- API ----------
  async function api(path, opts = {}) {
    const res = await fetch(AG + path, { credentials: "include", ...opts });
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
      S.days = d.days || [];
      S.speakers = d.speakers || [];
    } catch (e) {
      console.error(e);
      $("agSessionList").innerHTML =
        `<div class="gallery-empty"><strong>Gagal memuat agenda</strong><p>${h(e.message)}</p><p>Pastikan agenda.sql sudah dijalankan dan route /api/agenda terpasang di index.php.</p></div>`;
      return;
    }
    render();
  }

  // ---------- lookups ----------
  const dayObj = () => S.days.find((d) => String(d.day) === S.day) || null;
  const spById = (id) => S.speakers.find((s) => String(s.id) === String(id));
  const allSessions = () => S.days.flatMap((d) => d.sessions);
  const findSession = (id) =>
    allSessions().find((s) => String(s.id) === String(id));
  const usage = (spId) =>
    allSessions().filter((s) => s.speakers.includes(String(spId))).length;

  // ---------- render ----------
  function render() {
    $("agSpeakerCount").textContent = S.speakers.length;
    document
      .querySelectorAll("#agDayFilters .filter-btn")
      .forEach((b) => b.classList.toggle("active", b.dataset.day === S.day));
    document
      .querySelectorAll(".ag-tab")
      .forEach((b) => b.classList.toggle("active", b.dataset.agtab === S.tab));
    $("agSessionsPane").classList.toggle("hidden", S.tab !== "sessions");
    $("agSpeakersPane").classList.toggle("hidden", S.tab !== "speakers");
    $("agAddSession").classList.toggle("hidden", S.tab !== "sessions");
    renderDayInfo();
    renderSessions();
    renderSpeakers();
  }

  function renderDayInfo() {
    const d = dayObj();
    if (!d) {
      $("agDayInfo").innerHTML =
        `<div class="empty-note">Data hari belum ada. Jalankan agenda.sql.</div>`;
      return;
    }
    const groups = (d.groups || [])
      .map(
        (g) =>
          `<span class="day-chip">${h(g.label)}${g.title ? " · " + h(g.title) : ""}</span>`,
      )
      .join("");
    $("agDayInfo").innerHTML = `
      <div>
        <h3>${h(d.label)} — ${h(d.title || "Tanpa judul")}</h3>
        <div class="sub">${h(d.date || "Tanggal belum diisi")} · ${d.sessions.length} sesi</div>
        ${groups ? `<div style="margin-top:8px">${groups}</div>` : ""}
      </div>
      <button class="btn btn-ghost" type="button" data-act="editday">Edit hari</button>`;
  }

  function sessionRow(s, i, last) {
    const names = s.speakers.map((id) => spById(id)?.name).filter(Boolean);
    return `
      <article class="ag-row${s.kind === "break" ? " is-break" : ""}">
        <div class="ag-time">${h(s.time || "—")}</div>
        <div class="ag-main">
          <div class="ag-meta">
            <span class="ag-type">${h(s.type)}</span>
            ${s.room ? `<span>${h(s.room)}</span>` : ""}
            ${s.kind === "break" ? `<span class="day-chip">Jeda</span>` : ""}
          </div>
          <h3>${h(s.title)}</h3>
          ${names.length ? `<div class="ag-spk">👤 ${names.map(h).join(", ")}</div>` : ""}
        </div>
        <div class="ag-actions">
          <button class="mini-btn" type="button" data-act="up" data-id="${s.id}" ${i === 0 ? "disabled" : ""} title="Naikkan">↑</button>
          <button class="mini-btn" type="button" data-act="down" data-id="${s.id}" ${i === last ? "disabled" : ""} title="Turunkan">↓</button>
          <button class="mini-btn" type="button" data-act="edit" data-id="${s.id}">Edit</button>
          <button class="mini-btn gal-danger" type="button" data-act="delete" data-id="${s.id}">Hapus</button>
        </div>
      </article>`;
  }

  function renderSessions() {
    const d = dayObj();
    const box = $("agSessionList");
    if (!d) return (box.innerHTML = "");
    const groups = d.groups || [];
    const rows = (items) =>
      items.map((s, i) => sessionRow(s, i, items.length - 1)).join("");

    if (!groups.length) {
      if (!d.sessions.length) {
        box.innerHTML = `<div class="gallery-empty"><div class="gallery-empty-icon">🗓</div><strong>Belum ada sesi di ${h(d.label)}</strong><p>Tambahkan sesi pertama, atau impor dari agenda.json dengan agenda-import.php.</p><button class="btn btn-primary" type="button" id="agEmptyAdd">＋ Tambah Sesi</button></div>`;
        $("agEmptyAdd")?.addEventListener("click", () => openSession());
        return;
      }
      box.innerHTML = rows(d.sessions);
      return;
    }

    // Hari punya sub-agenda (grup): tiap grup tampil sebagai blok terpisah.
    const labels = new Set(groups.map((g) => g.label));
    const sections = groups.map((g) => ({
      label: g.label,
      title: g.title,
      items: d.sessions.filter((s) => s.group === g.label),
    }));
    const rest = d.sessions.filter((s) => !labels.has(s.group));
    if (rest.length) sections.push({ label: "", title: "", items: rest });

    box.innerHTML = sections
      .map(
        (sec) => `
      <section class="ag-group">
        <div class="ag-group-head">
          <div><span class="ag-group-label">${h(sec.label || "Tanpa grup")}</span>${sec.title ? ` <span class="sub">${h(sec.title)}</span>` : ""}</div>
          <button class="mini-btn" type="button" data-act="addin" data-group="${h(sec.label)}">＋ Sesi di grup ini</button>
        </div>
        ${sec.items.length ? rows(sec.items) : `<div class="empty-note" style="margin:0 0 8px">Belum ada sesi di grup ini.</div>`}
      </section>`,
      )
      .join("");
  }

  function renderSpeakers() {
    const q = $("agSpeakerSearch").value.trim().toLowerCase();
    const list = S.speakers.filter(
      (s) =>
        !q ||
        `${s.name} ${s.position} ${s.institution}`.toLowerCase().includes(q),
    );
    const box = $("agSpeakerGrid");
    if (!list.length) {
      box.innerHTML = `<div class="gallery-empty"><div class="gallery-empty-icon">👤</div><strong>${q ? "Tidak ada yang cocok" : "Belum ada pembicara"}</strong><p>Tambahkan pembicara agar bisa dipilih di sesi.</p></div>`;
      return;
    }
    box.innerHTML = list
      .map((s) => {
        const n = usage(s.id);
        return `
      <article class="ag-spcard">
        <div class="ag-spphoto">${s.photo ? `<img src="${h(U(s.photo))}" alt="${h(s.name)}" loading="lazy" onerror="this.remove()">` : ""}<span>${h(initials(s.name))}</span></div>
        <div class="ag-spinfo">
          <h3>${h(s.name)}</h3>
          <div class="sub">${h([s.position, s.institution].filter(Boolean).join(" · ") || "—")}</div>
          <div class="sub" style="margin-top:6px">${n ? `Tampil di ${n} sesi` : "Belum dipakai di sesi"}</div>
          <div class="ag-actions" style="margin-top:10px">
            <button class="mini-btn" type="button" data-act="edit" data-id="${s.id}">Edit</button>
            <button class="mini-btn gal-danger" type="button" data-act="delete" data-id="${s.id}">Hapus</button>
          </div>
        </div>
      </article>`;
      })
      .join("");
  }

  // ---------- session dialog ----------
  function renderPicker() {
    const q = $("agSpSearch").value.trim().toLowerCase();
    const list = S.speakers.filter(
      (s) => !q || `${s.name} ${s.institution}`.toLowerCase().includes(q),
    );
    $("agSpList").innerHTML = list.length
      ? list
          .map(
            (
              s,
            ) => `<label class="ag-pick"><input type="checkbox" data-sp="${s.id}" ${S.sel.includes(String(s.id)) ? "checked" : ""}>
            <span>${h(s.name)}<small>${h([s.position, s.institution].filter(Boolean).join(" · "))}</small></span></label>`,
          )
          .join("")
      : `<div class="sub" style="padding:8px">Tidak ada pembicara. Tambahkan dulu di tab Pembicara.</div>`;
    $("agSpChips").innerHTML = S.sel.length
      ? S.sel
          .map(
            (id, i) =>
              `<span class="day-chip">${i + 1}. ${h(spById(id)?.name || "?")} <button type="button" class="ag-x" data-rm="${id}" aria-label="Hapus">×</button></span>`,
          )
          .join("")
      : `<span class="sub">Belum ada pembicara dipilih.</span>`;
  }

  function openSession(s, presetGroup) {
    S.editId = s ? s.id : null;
    $("agSessTitleHead").textContent = s ? "Edit sesi" : "Tambah sesi";
    $("agSDay").value = String(s ? (s.day ?? S.day) : S.day);
    // sesi dari payload tidak membawa 'day'; pakai hari yang sedang dibuka
    if (s)
      $("agSDay").value = String(
        S.days.find((d) => d.sessions.some((x) => x.id === s.id))?.day || S.day,
      );
    $("agSTitle").value = s?.title || "";
    $("agSStart").value = s?.start || "";
    $("agSEnd").value = s?.end || "";
    $("agSType").value = s?.type || "Talkshow";
    $("agSRoom").value = s?.room ?? "Main Hall";
    $("agSDesc").value = s?.description || "";
    $("agSBreak").checked = s?.kind === "break";
    $("agSError").textContent = "";
    $("agSpSearch").value = "";
    S.sel = (s?.speakers || []).map(String);
    fillGroupList(presetGroup ?? s?.group ?? "");
    renderPicker();
    $("agSessionDialog").showModal();
  }

  function fillGroupList(current) {
    const d = S.days.find((x) => String(x.day) === $("agSDay").value);
    const sel = $("agSGroup");
    const keep = current !== undefined ? current : sel.value;
    const labels = (d?.groups || []).map((g) => g.label);
    if (keep && !labels.includes(keep)) labels.push(keep);
    sel.innerHTML =
      `<option value="">— Tanpa grup —</option>` +
      labels.map((l) => `<option value="${h(l)}">${h(l)}</option>`).join("");
    sel.value = keep || "";
  }

  async function saveSession() {
    const body = {
      id: S.editId,
      day: Number($("agSDay").value),
      title: $("agSTitle").value.trim(),
      start: $("agSStart").value,
      end: $("agSEnd").value,
      type: $("agSType").value.trim(),
      room: $("agSRoom").value.trim(),
      group: $("agSGroup").value.trim(),
      description: $("agSDesc").value.trim(),
      kind: $("agSBreak").checked ? "break" : "session",
      speakers: S.sel.map(Number),
    };
    if (!body.title)
      return ($("agSError").textContent = "Judul sesi wajib diisi.");
    const btn = $("agSSave");
    btn.disabled = true;
    try {
      await post("/session/save", body);
      S.day = String(body.day);
      $("agSessionDialog").close();
      await load();
    } catch (e) {
      $("agSError").textContent = e.message;
    } finally {
      btn.disabled = false;
    }
  }

  // ---------- speaker dialog ----------
  function openSpeaker(s) {
    S.editSpeakerId = s ? s.id : null;
    $("agSpHead").textContent = s ? "Edit pembicara" : "Tambah pembicara";
    $("agSpName").value = s?.name || "";
    $("agSpPos").value = s?.position || "";
    $("agSpInst").value = s?.institution || "";
    $("agSpBio").value = s?.bio || "";
    $("agSpFile").value = "";
    $("agSpRemove").checked = false;
    $("agSpRemoveWrap").style.display = s?.photo ? "" : "none";
    $("agSpError").textContent = "";
    setPreview(s?.photo ? U(s.photo) : "", s?.name || "");
    $("agSpeakerDialog").showModal();
  }

  function setPreview(src, name) {
    $("agSpPreview").innerHTML = src
      ? `<img src="${h(src)}" alt="">`
      : `<span>${h(initials(name))}</span>`;
  }

  async function saveSpeaker() {
    const name = $("agSpName").value.trim();
    if (!name) return ($("agSpError").textContent = "Nama wajib diisi.");
    const f = $("agSpFile").files[0];
    if (f && !/^image\/(jpeg|png|webp)$/i.test(f.type))
      return ($("agSpError").textContent = "Foto harus JPG, PNG, atau WEBP.");
    if (f && f.size > MAX_PHOTO)
      return ($("agSpError").textContent = "Foto terlalu besar (maks. 3 MB).");

    const fd = new FormData();
    if (S.editSpeakerId) fd.append("id", S.editSpeakerId);
    fd.append("name", name);
    fd.append("position", $("agSpPos").value.trim());
    fd.append("institution", $("agSpInst").value.trim());
    fd.append("bio", $("agSpBio").value.trim());
    if (f) fd.append("photo", f);
    if ($("agSpRemove").checked) fd.append("removePhoto", "1");

    const btn = $("agSpSave");
    btn.disabled = true;
    try {
      await api("/speaker/save", { method: "POST", body: fd });
      $("agSpeakerDialog").close();
      await load();
    } catch (e) {
      $("agSpError").textContent = e.message;
    } finally {
      btn.disabled = false;
    }
  }

  // ---------- day dialog ----------
  function openDay() {
    const d = dayObj();
    if (!d) return;
    $("agDTitle").value = d.title || "";
    $("agDDate").value = d.date || "";
    $("agDGroups").value = (d.groups || [])
      .map((g) => `${g.label} | ${g.title || ""}`)
      .join("\n");
    $("agDError").textContent = "";
    $("agDayHead").textContent = `Edit ${d.label}`;
    $("agDayDialog").showModal();
  }

  async function saveDay() {
    try {
      await post("/day/save", {
        day: Number(S.day),
        title: $("agDTitle").value.trim(),
        date: $("agDDate").value.trim(),
        groups: $("agDGroups").value,
      });
      $("agDayDialog").close();
      await load();
    } catch (e) {
      $("agDError").textContent = e.message;
    }
  }

  // ---------- build DOM ----------
  const CSS = `
    #view-agenda .ag-tabs{display:flex;gap:6px;margin-bottom:16px}
    .ag-tab{min-height:40px;padding:8px 16px;background:transparent;border:1px solid var(--border);border-radius:10px;color:var(--text-muted);font-size:13px;font-weight:700;cursor:pointer}
    .ag-tab.active{background:var(--surface-dark);border-color:var(--surface-dark);color:#fff}
    .ag-tab span{opacity:.7;margin-left:4px}
    .ag-dayinfo{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
    .ag-dayinfo h3{margin:0 0 4px;font-size:17px}
    .ag-list{display:flex;flex-direction:column;gap:8px}
    .ag-group{display:flex;flex-direction:column;gap:8px;margin-bottom:22px}
    .ag-group-head{display:flex;justify-content:space-between;align-items:center;gap:10px;padding-bottom:8px;border-bottom:2px solid var(--text)}
    .ag-group-label{font-size:15px;font-weight:800}
    .ag-row{display:grid;grid-template-columns:132px 1fr auto;gap:14px;align-items:start;padding:14px 16px;background:#fff;border:1px solid var(--border);border-radius:14px}
    .ag-row.is-break{background:var(--surface-soft);border-style:dashed}
    .ag-time{color:var(--accent);font-size:13px;font-weight:800;white-space:nowrap}
    .ag-meta{display:flex;flex-wrap:wrap;align-items:center;gap:8px;color:var(--text-muted);font-size:11.5px}
    .ag-type{padding:3px 9px;border-radius:999px;background:var(--danger-bg);color:#a13b22;font-weight:800;letter-spacing:.04em;text-transform:uppercase;font-size:10.5px}
    .ag-main h3{margin:6px 0 0;font-size:14.5px;line-height:1.4}
    .ag-spk{margin-top:6px;color:var(--text-muted);font-size:12px;line-height:1.5}
    .ag-actions{display:flex;flex-wrap:wrap;gap:6px}
    .mini-btn:disabled{opacity:.35;cursor:default}
    .ag-speakers{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}
    .ag-spcard{overflow:hidden;background:#fff;border:1px solid var(--border);border-radius:14px}
    .ag-spphoto,.ag-prev{position:relative;display:grid;place-items:center;background:var(--surface-dark-2,#22241f);color:#fff;font-weight:800}
    .ag-spphoto{aspect-ratio:4/3;font-size:34px}
    .ag-spphoto img,.ag-prev img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
    .ag-spinfo{padding:14px}
    .ag-spinfo h3{margin:0 0 4px;font-size:14px;line-height:1.35}
    .ag-dialog{width:min(640px,94vw);max-height:90vh;overflow:auto}
    .ag-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:14px 0}
    .ag-grid label{display:flex;flex-direction:column;gap:4px;font-size:13px;font-weight:600}
    .ag-grid .full{grid-column:1/-1}
    .ag-grid input[type=text],.ag-grid input[type=time],.ag-grid select,.ag-grid textarea{font:inherit;padding:9px 11px;border:1px solid var(--border);border-radius:9px;background:#fff;font-weight:400}
    .ag-grid .ag-check{flex-direction:row;align-items:center;gap:8px}
    .ag-pickbox{max-height:170px;overflow:auto;border:1px solid var(--border);border-radius:9px;background:#fff}
    .ag-pick{display:flex!important;flex-direction:row!important;align-items:flex-start;gap:9px!important;padding:8px 10px;border-bottom:1px solid var(--border);font-weight:500!important;cursor:pointer}
    .ag-pick:last-child{border-bottom:0}
    .ag-pick small{display:block;color:var(--text-muted);font-size:11px;font-weight:400}
    .ag-chips{display:flex;flex-wrap:wrap;gap:4px}
    .ag-x{border:0;background:transparent;cursor:pointer;font-size:14px;line-height:1;padding:0 0 0 4px;color:var(--accent)}
    .ag-prev{width:96px;height:96px;border-radius:12px;overflow:hidden;font-size:28px;flex:0 0 96px}
    .ag-photorow{display:flex;gap:14px;align-items:center}
    @media(max-width:680px){
      .ag-row{grid-template-columns:1fr;gap:8px}
      .ag-grid{grid-template-columns:1fr}
      .nav{grid-template-columns:repeat(6,minmax(0,1fr))!important}
    }`;

  function build() {
    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    // nav button
    const navBtn = document.createElement("button");
    navBtn.className = "nav-item";
    navBtn.dataset.view = "agenda";
    navBtn.textContent = "🗓 Agenda";
    const after =
      document.querySelector('.nav-item[data-view="gallery"]') ||
      document.querySelector(".nav-item:last-child");
    after.after(navBtn);

    // view
    const view = document.createElement("div");
    view.id = "view-agenda";
    view.className = "hidden";
    view.innerHTML = `
      <div class="page-head">
        <div>
          <div class="eyebrow-admin">PROGRAM MANAGEMENT</div>
          <h1 class="display">Agenda</h1>
          <p>Kelola sesi, jadwal, dan pembicara yang tampil di halaman Agenda website.</p>
        </div>
        <div class="head-actions">
          <button class="btn btn-ghost" id="agAddSpeaker" type="button">＋ Pembicara</button>
          <button class="btn btn-primary" id="agAddSession" type="button">＋ Sesi</button>
        </div>
      </div>
      <div class="ag-tabs">
        <button class="ag-tab active" type="button" data-agtab="sessions">Sesi</button>
        <button class="ag-tab" type="button" data-agtab="speakers">Pembicara <span id="agSpeakerCount">0</span></button>
      </div>
      <div id="agSessionsPane">
        <div class="day-bar-admin"><span>Hari</span>
          <div class="filters" id="agDayFilters">
            <button class="filter-btn" type="button" data-day="1">Day 1</button>
            <button class="filter-btn" type="button" data-day="2">Day 2</button>
            <button class="filter-btn" type="button" data-day="3">Day 3</button>
          </div>
        </div>
        <div class="panel ag-dayinfo" id="agDayInfo"></div>
        <div class="ag-list" id="agSessionList"></div>
      </div>
      <div id="agSpeakersPane" class="hidden">
        <div class="controls"><div class="search"><input type="text" id="agSpeakerSearch" placeholder="Cari nama, jabatan, atau institusi…"></div></div>
        <div class="ag-speakers" id="agSpeakerGrid"></div>
      </div>`;
    document.querySelector(".main").appendChild(view);

    // dialogs
    const dlg = document.createElement("div");
    dlg.innerHTML = `
      <dialog id="agSessionDialog" class="days-dialog ag-dialog">
        <h3 id="agSessTitleHead">Tambah sesi</h3>
        <div class="ag-grid">
          <label class="full">Judul<input id="agSTitle" type="text" maxlength="300"></label>
          <label>Hari<select id="agSDay"><option value="1">Day 1</option><option value="2">Day 2</option><option value="3">Day 3</option></select></label>
          <label>Grup / sub-agenda<select id="agSGroup"></select></label>
          <label>Jam mulai<input id="agSStart" type="time"></label>
          <label>Jam selesai<input id="agSEnd" type="time"></label>
          <label>Tipe<input id="agSType" type="text" maxlength="60" list="agTypeList"><datalist id="agTypeList">${TYPES.map((t) => `<option value="${t}">`).join("")}</datalist></label>
          <label>Ruangan<input id="agSRoom" type="text" maxlength="120"></label>
          <label class="full">Deskripsi<textarea id="agSDesc" rows="5"></textarea></label>
          <label class="full ag-check"><input id="agSBreak" type="checkbox"> Tandai sebagai jeda (tampil sebagai baris sederhana, mis. makan siang)</label>
          <label class="full">Pembicara
            <input id="agSpSearch" type="text" placeholder="Cari pembicara…" autocomplete="off">
          </label>
          <div class="full ag-pickbox" id="agSpList"></div>
          <div class="full ag-chips" id="agSpChips"></div>
        </div>
        <div class="settings-hint" id="agSError" style="color:#B34A00;"></div>
        <div class="days-dialog-actions">
          <button type="button" class="btn btn-ghost" id="agSCancel">Batal</button>
          <button type="button" class="btn btn-primary" id="agSSave">Simpan</button>
        </div>
      </dialog>

      <dialog id="agSpeakerDialog" class="days-dialog ag-dialog">
        <h3 id="agSpHead">Tambah pembicara</h3>
        <div class="ag-grid">
          <div class="full ag-photorow">
            <div class="ag-prev" id="agSpPreview"></div>
            <div>
              <input id="agSpFile" type="file" accept="image/jpeg,image/png,image/webp">
              <div class="settings-hint">JPG / PNG / WEBP, maks. 3 MB. Rasio 4:3 atau persegi paling pas.</div>
              <label class="ag-check" id="agSpRemoveWrap" style="margin-top:6px"><input id="agSpRemove" type="checkbox"> Hapus foto saat ini</label>
            </div>
          </div>
          <label class="full">Nama<input id="agSpName" type="text" maxlength="200"></label>
          <label class="full">Jabatan<input id="agSpPos" type="text" maxlength="300"></label>
          <label class="full">Institusi<input id="agSpInst" type="text" maxlength="300"></label>
          <label class="full">Bio singkat<textarea id="agSpBio" rows="4"></textarea></label>
        </div>
        <div class="settings-hint" id="agSpError" style="color:#B34A00;"></div>
        <div class="days-dialog-actions">
          <button type="button" class="btn btn-ghost" id="agSpCancel">Batal</button>
          <button type="button" class="btn btn-primary" id="agSpSave">Simpan</button>
        </div>
      </dialog>

      <dialog id="agDayDialog" class="days-dialog ag-dialog" style="width:min(480px,94vw)">
        <h3 id="agDayHead">Edit hari</h3>
        <div class="ag-grid">
          <label class="full">Judul hari<input id="agDTitle" type="text" maxlength="200"></label>
          <label class="full">Tanggal (teks yang tampil)<input id="agDDate" type="text" maxlength="60" placeholder="19 November 2026"></label>
          <label class="full">Grup / sub-agenda (opsional, satu per baris: Label | Judul). Mengganti nama grup di baris yang sama ikut memindahkan sesinya.<textarea id="agDGroups" rows="3" placeholder="Group A | Culture &amp; Community"></textarea></label>
        </div>
        <div class="settings-hint" id="agDError" style="color:#B34A00;"></div>
        <div class="days-dialog-actions">
          <button type="button" class="btn btn-ghost" id="agDCancel">Batal</button>
          <button type="button" class="btn btn-primary" id="agDSave">Simpan</button>
        </div>
      </dialog>`;
    document.body.appendChild(dlg);

    return { navBtn, view };
  }

  // ---------- wiring ----------
  function init() {
    const { navBtn, view } = build();

    // navigasi: admin.js tidak tahu view baru ini, jadi diurus di sini
    document.querySelectorAll(".nav-item").forEach((b) => {
      if (b !== navBtn)
        b.addEventListener("click", () => view.classList.add("hidden"));
    });
    navBtn.addEventListener("click", () => {
      document
        .querySelectorAll(".nav-item")
        .forEach((b) => b.classList.toggle("active", b === navBtn));
      ["scan", "dashboard", "peserta", "gallery", "settings"].forEach((v) =>
        $("view-" + v)?.classList.add("hidden"),
      );
      view.classList.remove("hidden");
      if (typeof stopQrScanner === "function") stopQrScanner();
      load();
    });

    document.querySelectorAll(".ag-tab").forEach((b) =>
      b.addEventListener("click", () => {
        S.tab = b.dataset.agtab;
        render();
      }),
    );
    document.querySelectorAll("#agDayFilters .filter-btn").forEach((b) =>
      b.addEventListener("click", () => {
        S.day = b.dataset.day;
        render();
      }),
    );
    $("agAddSession").addEventListener("click", () => openSession());
    $("agAddSpeaker").addEventListener("click", () => {
      S.tab = "speakers";
      render();
      openSpeaker();
    });
    $("agSpeakerSearch").addEventListener("input", renderSpeakers);

    // day info
    $("agDayInfo").addEventListener("click", (e) => {
      if (e.target.closest('[data-act="editday"]')) openDay();
    });

    // session list actions
    $("agSessionList").addEventListener("click", async (e) => {
      const b = e.target.closest("[data-act]");
      if (!b) return;
      if (b.dataset.act === "addin") return openSession(null, b.dataset.group);
      const s = findSession(b.dataset.id);
      if (!s) return;
      try {
        if (b.dataset.act === "edit") return openSession(s);
        if (b.dataset.act === "delete") {
          if (!confirm(`Hapus sesi "${s.title}"?`)) return;
          await post("/session/delete", { id: s.id });
        } else {
          await post("/session/move", {
            id: s.id,
            dir: b.dataset.act === "up" ? -1 : 1,
          });
        }
        await load();
      } catch (err) {
        alert(err.message);
      }
    });

    // speaker grid actions
    $("agSpeakerGrid").addEventListener("click", async (e) => {
      const b = e.target.closest("[data-act]");
      if (!b) return;
      const s = spById(b.dataset.id);
      if (!s) return;
      if (b.dataset.act === "edit") return openSpeaker(s);
      const n = usage(s.id);
      if (
        !confirm(
          `Hapus pembicara "${s.name}"?${n ? `\nDia akan dilepas dari ${n} sesi.` : ""}`,
        )
      )
        return;
      try {
        await post("/speaker/delete", { id: s.id });
        await load();
      } catch (err) {
        alert(err.message);
      }
    });

    // session dialog
    $("agSCancel").addEventListener("click", () =>
      $("agSessionDialog").close(),
    );
    $("agSSave").addEventListener("click", saveSession);
    $("agSDay").addEventListener("change", () => fillGroupList(""));
    $("agSpSearch").addEventListener("input", renderPicker);
    $("agSpList").addEventListener("change", (e) => {
      const cb = e.target.closest("[data-sp]");
      if (!cb) return;
      const id = String(cb.dataset.sp);
      S.sel = cb.checked
        ? [...S.sel.filter((x) => x !== id), id]
        : S.sel.filter((x) => x !== id);
      renderPicker();
    });
    $("agSpChips").addEventListener("click", (e) => {
      const x = e.target.closest("[data-rm]");
      if (!x) return;
      S.sel = S.sel.filter((id) => id !== String(x.dataset.rm));
      renderPicker();
    });

    // speaker dialog
    $("agSpCancel").addEventListener("click", () =>
      $("agSpeakerDialog").close(),
    );
    $("agSpSave").addEventListener("click", saveSpeaker);
    $("agSpFile").addEventListener("change", (e) => {
      const f = e.target.files[0];
      if (f) {
        setPreview(URL.createObjectURL(f), $("agSpName").value);
        $("agSpRemove").checked = false;
      }
    });

    // day dialog
    $("agDCancel").addEventListener("click", () => $("agDayDialog").close());
    $("agDSave").addEventListener("click", saveDay);
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init);
  else init();
})();
