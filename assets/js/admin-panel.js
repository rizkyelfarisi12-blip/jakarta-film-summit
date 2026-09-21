/* ============================================================
 * CONFIG — point this to your real backend.
 * Expected endpoints (see jfs-api-reference.md):
 *   GET  /api/participants                 -> [participant...]
 *   GET  /api/participants/search?q=...    -> [participant...]
 *   POST /api/checkin  {qrToken}               -> { participant }  (staff session required)
 *   GET  /api/settings                     -> { quota, deadline }
 *   POST /api/settings {quota, deadline}   -> { quota, deadline }
 *   GET  /api/checkin-log                  -> [{id, nama, time, staff}...]
 * ============================================================ */
const API_BASE = "/api";
const POLL_MS = 5000;

function el(id) { return document.getElementById(id); }
function timeShort(iso) { if (!iso) return ""; return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }); }
function timeFull(iso) { if (!iso) return "—"; return new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); }

let staffName = "";
let participants = [];
let checkinLog = [];
let settings = { quota: null, deadline: null };
let currentMode = "scan";
let currentFilter = "all";
let pollTimer = null;

// ---------- Login (real email + password, session-cookie based) ----------
el("loginBtn").addEventListener("click", doLogin);
el("staffPasswordInput").addEventListener("keydown", (e) => { if (e.key === "Enter") doLogin(); });

async function doLogin() {
  const email = el("staffEmailInput").value.trim();
  const password = el("staffPasswordInput").value;
  const errBox = el("loginError");
  errBox.style.display = "none";
  if (!email || !password) return;

  const btn = el("loginBtn");
  btn.disabled = true;
  btn.textContent = "Memeriksa…";

  try {
    const res = await fetch(`${API_BASE}/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      errBox.textContent = data.error || "Login gagal. Cek email/password.";
      errBox.style.display = "block";
      return;
    }
    const user = await res.json();
    enterApp(user.nama);
  } catch (e) {
    errBox.textContent = "Tidak bisa menghubungi server. (Backend belum terhubung?)";
    errBox.style.display = "block";
    console.error(e);
  } finally {
    btn.disabled = false;
    btn.textContent = "Masuk";
  }
}

function enterApp(nama) {
  staffName = nama;
  el("staffChipName").textContent = staffName;
  el("loginScreen").classList.add("hidden");
  el("appShell").classList.remove("hidden");
  startPolling();
}

el("logoutBtn").addEventListener("click", async () => {
  try {
    await fetch(`${API_BASE}/logout`, { method: "POST", credentials: "include" });
  } catch (e) { /* ignore */ }
  clearInterval(pollTimer);
  el("appShell").classList.add("hidden");
  el("loginScreen").classList.remove("hidden");
  el("staffPasswordInput").value = "";
});

// Resume an existing session (e.g. page refresh) without asking to log in again.
(async function checkExistingSession() {
  try {
    const res = await fetch(`${API_BASE}/me`, { credentials: "include" });
    if (res.ok) {
      const user = await res.json();
      enterApp(user.nama);
    }
  } catch (e) { /* not logged in yet — show login screen as normal */ }
})();

// ---------- Nav ----------
document.querySelectorAll(".nav-item").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    ["scan", "monitor", "settings"].forEach((v) => el("view-" + v).classList.add("hidden"));
    el("view-" + btn.dataset.view).classList.remove("hidden");
  });
});

// ---------- Data polling ----------
function startPolling() {
  fetchData();
  pollTimer = setInterval(fetchData, POLL_MS);
}

async function fetchData() {
  try {
    const [pRes, sRes] = await Promise.all([
      fetch(`${API_BASE}/participants`, { credentials: "include" }),
      fetch(`${API_BASE}/settings`, { credentials: "include" }),
    ]);
    if (pRes.status === 401 || sRes.status === 401) return handleSessionExpired();
    participants = pRes.ok ? await pRes.json() : [];
    settings = sRes.ok ? await sRes.json() : { quota: null, deadline: null };
  } catch (e) {
    console.warn("Could not reach API — showing empty state.", e);
    participants = [];
  }
  renderAll();
}

function handleSessionExpired() {
  clearInterval(pollTimer);
  el("appShell").classList.add("hidden");
  el("loginScreen").classList.remove("hidden");
  el("loginError").textContent = "Sesi berakhir, silakan login lagi.";
  el("loginError").style.display = "block";
}

function renderAll() {
  const total = participants.length;
  el("scanTotalLabel").textContent = `${total} peserta terdaftar`;
  renderMonitor();
  renderSettings();
}

// ---------- Check-in / scan ----------
document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentMode = btn.dataset.mode;
    el("modeScanPanel").classList.toggle("hidden", currentMode !== "scan");
    el("modeSearchPanel").classList.toggle("hidden", currentMode !== "search");
    el("resultTicket").classList.add("hidden");
    el("notFoundCard").classList.add("hidden");
  });
});

el("verifyBtn").addEventListener("click", () => lookupToken(el("tokenInput").value));
el("tokenInput").addEventListener("keydown", (e) => { if (e.key === "Enter") lookupToken(el("tokenInput").value); });

function lookupToken(token) {
  el("resultTicket").classList.add("hidden");
  el("notFoundCard").classList.add("hidden");
  const t = token.trim();
  if (!t) return;
  const found = participants.find((p) => p.qrToken.toUpperCase() === t.toUpperCase());
  if (found) renderTicket(found); else el("notFoundCard").classList.remove("hidden");
}

el("searchInput").addEventListener("input", (e) => {
  const q = e.target.value.trim().toLowerCase();
  el("resultTicket").classList.add("hidden");
  const matches = q ? participants.filter((p) =>
    p.nama.toLowerCase().includes(q) || p.email.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)
  ) : [];
  el("searchEmptyNote").classList.toggle("hidden", !(q && matches.length === 0));
  el("searchMatches").innerHTML = matches.map((p) => `
    <div class="matchrow" data-id="${p.id}">
      <div><div class="name">${p.nama}</div><div class="meta">${p.email} · ${p.id}</div></div>
      <div class="status-badge ${p.kehadiran ? "done" : "valid"}">${p.kehadiran ? "✓ Sudah check-in" : "⏱ Belum check-in"}</div>
    </div>`).join("");
  el("searchMatches").querySelectorAll(".matchrow").forEach((row) => {
    row.addEventListener("click", () => {
      const p = participants.find((x) => x.id === row.dataset.id);
      if (p) renderTicket(p);
    });
  });
});

function renderTicket(p) {
  el("resultTicket").classList.remove("hidden");
  el("resultTicket").innerHTML = `
    <div class="ticket-head">
      <div><div class="ticket-id mono">${p.id}</div><div class="ticket-name">${p.nama}</div></div>
      <div class="status-badge ${p.kehadiran ? "done" : "valid"}">${p.kehadiran ? "✓ Sudah Check-in" : "⏱ Belum Check-in"}</div>
    </div>
    <div class="perf"></div>
    <div class="ticket-details">
      <div class="detail-row">✉️ <strong>${p.email}</strong></div>
      <div class="detail-row">🌍 <strong>${p.negara}</strong></div>
      <div class="detail-row">💼 <strong>${p.peran}</strong></div>
      <div class="detail-row">🏷️ <strong>${p.jabatan}</strong></div>
    </div>
    <div class="ticket-footer">
      ${p.kehadiran
        ? `<div class="timestamp">⏱ Check-in pukul ${timeShort(p.waktu_checkin)} oleh ${p.checkin_oleh}</div>`
        : `<div></div><button class="btn btn-primary" id="confirmCheckinBtn">✓ Check-in Sekarang</button>`}
    </div>`;
  if (!p.kehadiran) {
    el("confirmCheckinBtn").addEventListener("click", () => doCheckIn(p));
  }
}

async function doCheckIn(p) {
  try {
    const res = await fetch(`${API_BASE}/checkin`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qrToken: p.qrToken }),
    });
    if (!res.ok) throw new Error("checkin failed");
    const data = await res.json();
    const updated = data.participant;
    participants = participants.map((x) => (x.id === updated.id ? updated : x));
    checkinLog.unshift({ id: updated.id, nama: updated.nama, time: updated.waktu_checkin, staff: staffName });
    renderTicket(updated);
    renderLog();
    renderAll();
  } catch (e) {
    alert("Gagal check-in. Cek koneksi ke backend.\n\n(Backend belum terhubung — lihat jfs-api-reference.md)");
    console.error(e);
  }
}

function renderLog() {
  const box = el("checkinLog");
  if (checkinLog.length === 0) {
    box.innerHTML = `<p class="empty-note" style="margin-top:0;">Belum ada peserta yang check-in.</p>`;
    return;
  }
  box.innerHTML = checkinLog.slice(0, 20).map((e) => `
    <div class="log-row"><span>${e.nama}</span><span class="who">${timeShort(e.time)} · ${e.staff}</span></div>
  `).join("");
}

// ---------- Monitoring ----------
document.querySelectorAll(".filter-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentFilter = btn.dataset.filter;
    renderMonitor();
  });
});
el("monitorSearch").addEventListener("input", renderMonitor);
el("refreshBtn").addEventListener("click", fetchData);
el("exportCsvBtn").addEventListener("click", exportCsv);

function renderMonitor() {
  const total = participants.length;
  const hadir = participants.filter((p) => p.kehadiran).length;
  const belum = total - hadir;
  const rate = total ? Math.round((hadir / total) * 100) : 0;

  el("statTotal").textContent = total;
  el("statHadir").textContent = hadir;
  el("statBelum").textContent = belum;
  el("statRate").textContent = rate + "%";
  el("monitorSync").textContent = "Sync " + timeShort(new Date().toISOString()) + " · update otomatis tiap 5 detik";

  const q = el("monitorSearch").value.trim().toLowerCase();
  const filtered = participants
    .filter((p) => (currentFilter === "in" ? p.kehadiran : currentFilter === "out" ? !p.kehadiran : true))
    .filter((p) => !q || p.nama.toLowerCase().includes(q) || p.email.toLowerCase().includes(q) ||
      (p.negara || "").toLowerCase().includes(q) || (p.peran || "").toLowerCase().includes(q) || p.id.toLowerCase().includes(q))
    .sort((a, b) => a.nama.localeCompare(b.nama));

  el("monitorEmpty").classList.toggle("hidden", filtered.length !== 0);
  el("monitorTableBody").innerHTML = filtered.map((p) => `
    <tr>
      <td><div class="name-cell">${p.nama}</div><div class="sub">${p.email}</div></td>
      <td>${p.negara || "—"}</td>
      <td>${p.peran || "—"}</td>
      <td class="mono sub">${p.id}</td>
      <td><span class="badge ${p.kehadiran ? "in" : "out"}">${p.kehadiran ? "Hadir" : "Belum Hadir"}</span></td>
      <td>${p.waktu_checkin ? timeFull(p.waktu_checkin) : "—"}</td>
      <td class="sub">${p.checkin_oleh || "—"}</td>
    </tr>`).join("");
}

function exportCsv() {
  const headers = ["ID", "Nama", "Email", "Telepon", "Negara", "Peran", "Jabatan", "Kehadiran", "Waktu Check-in", "Check-in Oleh"];
  const rows = participants.map((p) => [
    p.id, p.nama, p.email, p.telp || "", p.negara || "", p.peran || "", p.jabatan || "",
    p.kehadiran ? "Hadir" : "Belum", p.waktu_checkin ? timeFull(p.waktu_checkin) : "", p.checkin_oleh || "",
  ]);
  const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `jfs-peserta-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------- Settings ----------
el("saveSettingsBtn").addEventListener("click", saveSettings);

function renderSettings() {
  el("quotaInput").value = settings.quota != null ? settings.quota : el("quotaInput").value;
  el("quotaCurrentHint").textContent = `Saat ini: ${participants.length} peserta terdaftar`;
  if (settings.deadline && !el("deadlineInput").dataset.touched) {
    el("deadlineInput").value = settings.deadline.slice(0, 16);
  }

  const total = participants.length;
  const quota = settings.quota;
  const deadline = settings.deadline;
  const quotaReached = quota != null && total >= quota;
  const deadlinePassed = deadline != null && new Date() > new Date(deadline);
  const closed = quotaReached || deadlinePassed;

  let html = `<div class="status-pill ${closed ? "closed" : "open"}">${closed ? "Pendaftaran TERTUTUP" : "Pendaftaran TERBUKA"}</div>`;
  if (closed) html += `<p class="settings-hint" style="margin-top:10px;">${quotaReached ? "Alasan: kuota sudah terpenuhi." : "Alasan: sudah melewati batas tanggal pendaftaran."}</p>`;
  if (quota != null) html += `<p class="settings-hint" style="margin-top:8px;">Kuota: ${total} / ${quota}</p>`;
  if (deadline) html += `<p class="settings-hint" style="margin-top:4px;">Batas waktu: ${new Date(deadline).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" })}</p>`;
  if (quota == null && !deadline) html += `<p class="settings-hint" style="margin-top:8px;">Belum ada kuota atau batas tanggal yang diset — pendaftaran terbuka tanpa batas.</p>`;
  el("statusPillWrap").innerHTML = html;
}
el("deadlineInput").addEventListener("input", (e) => { e.target.dataset.touched = "1"; });

async function saveSettings() {
  const btn = el("saveSettingsBtn");
  btn.disabled = true;
  const quotaVal = el("quotaInput").value.trim();
  const nextSettings = {
    quota: quotaVal === "" ? null : Math.max(0, parseInt(quotaVal, 10) || 0),
    deadline: el("deadlineInput").value || null,
  };
  try {
    const res = await fetch(`${API_BASE}/settings`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nextSettings),
    });
    if (!res.ok) throw new Error("save failed");
    settings = await res.json();
    renderSettings();
  } catch (e) {
    alert("Gagal menyimpan pengaturan. Cek koneksi ke backend.\n\n(Backend belum terhubung — lihat jfs-api-reference.md)");
    console.error(e);
  } finally {
    btn.disabled = false;
  }
}
