/* ============================================================
 * CONFIG — point this to your real backend.
 * Expected endpoints (see jfs-api-reference.md):
 *   POST /api/login    {email,password}        -> { id, nama, email } (sets session cookie)
 *   POST /api/logout                            -> { ok }
 *   GET  /api/me                                -> { id, nama, email } or 401
 *   GET  /api/participants                      -> [participant...]   (staff session required)
 *   POST /api/checkin  {qrToken}                -> { participant }    (staff session required)
 *   GET  /api/settings                          -> { quota, deadline }
 *   POST /api/settings {quota, deadline}        -> { quota, deadline }
 * ============================================================ */
const API_BASE = "../api";
const POLL_MS = 5000;

function el(id) { return document.getElementById(id); }
function timeShort(iso) { if (!iso) return ""; return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }); }
function timeFull(iso) { if (!iso) return "—"; return new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); }

let staffName = "";
let participants = [];
let checkinLog = [];
let settings = { quota: null, deadline: null };
let currentMode = "scan";           // check-in sub-tab: scan | search
let pesertaStatusFilter = "all";    // peserta view: all | in | out
let pesertaSegmentFilter = "all";
let pollTimer = null;
let donutChart = null;
let timelineChart = null;

// =================================================================
// Login (email + password, session-cookie based)
// =================================================================
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

// =================================================================
// Sidebar navigation (4 views)
// =================================================================
document.querySelectorAll(".nav-item").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    ["scan", "dashboard", "peserta", "settings"].forEach((v) => el("view-" + v).classList.add("hidden"));
    el("view-" + btn.dataset.view).classList.remove("hidden");
  });
});

// =================================================================
// Shared data polling — one fetch feeds all four views
// =================================================================
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
  el("scanTotalLabel").textContent = `${participants.length} peserta terdaftar`;
  renderSettings();
  renderDashboard();
  renderPeserta();
}

// =================================================================
// View: Check-in (scan QR / search manual)
// =================================================================
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

el("checkinSearchInput").addEventListener("input", (e) => {
  const q = e.target.value.trim().toLowerCase();
  el("resultTicket").classList.add("hidden");
  const matches = q ? participants.filter((p) =>
    p.fullname.toLowerCase().includes(q) || p.email.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)
  ) : [];
  el("searchEmptyNote").classList.toggle("hidden", !(q && matches.length === 0));
  el("searchMatches").innerHTML = matches.map((p) => `
    <div class="matchrow" data-id="${p.id}">
      <div><div class="name">${p.fullname}</div><div class="meta">${p.email} · ${p.id}</div></div>
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
      <div><div class="ticket-id mono">${p.id}</div><div class="ticket-name">${p.fullname}</div></div>
      <div class="status-badge ${p.kehadiran ? "done" : "valid"}">${p.kehadiran ? "✓ Sudah Check-in" : "⏱ Belum Check-in"}</div>
    </div>
    <div class="perf"></div>
    <div class="ticket-details">
      <div class="detail-row">✉️ <strong>${p.email}</strong></div>
      <div class="detail-row">📞 <strong>${p.phone}</strong></div>
      <div class="detail-row">🌍 <strong>${p.country}</strong></div>
      <div class="detail-row">🏢 <strong>${p.company}</strong></div>
      <div class="detail-row">🏷️ <strong>${p.jobtitle}</strong></div>
      <div class="detail-row">🎬 <strong>${segmentLabel(p)}</strong></div>
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

// =================================================================
// View: Dashboard (charts)
// =================================================================
el("dashboardRefreshBtn").addEventListener("click", fetchData);

function renderDashboard() {
  const total = participants.length;
  const hadir = participants.filter((p) => p.kehadiran).length;
  const miss = total - hadir;
  const rate = total ? Math.round((hadir / total) * 100) : 0;

  el("dashboardSyncLabel").textContent = "Sync " + timeShort(new Date().toISOString());
  el("valTotal").textContent = total;
  el("valHadir").textContent = hadir;
  el("valMiss").textContent = miss;
  el("subHadir").textContent = total ? `${rate}% dari total terdaftar` : "Belum ada data";
  el("subMiss").textContent = total ? `${100 - rate}% belum melakukan absen` : "Belum ada data";

  renderDonut(total, hadir, miss, rate);
  renderTimeline(participants);
  renderNegaraBreakdown(participants);
}

function renderDonut(total, hadir, miss, rate) {
  const wrap = el("donutWrap");
  if (total === 0) {
    wrap.innerHTML = `<div class="empty-chart">Belum ada data peserta</div>`;
    if (donutChart) { donutChart.destroy(); donutChart = null; }
    return;
  }
  wrap.innerHTML = `
    <div class="donut-wrap">
      <div class="donut-chart">
        <canvas id="donutCanvas"></canvas>
        <div class="donut-center"><div class="rate">${rate}%</div><div class="rl">hadir</div></div>
      </div>
      <div class="legend">
        <div class="legend-item"><span class="sw" style="background:#59B292"></span>Sudah Absen<span class="num">${hadir}</span></div>
        <div class="legend-item"><span class="sw" style="background:#FF6A14"></span>Tidak Hadir<span class="num">${miss}</span></div>
        <div class="legend-item"><span class="sw" style="background:#FFC94D"></span>Total<span class="num">${total}</span></div>
      </div>
    </div>`;
  const ctx = document.getElementById("donutCanvas");
  if (donutChart) donutChart.destroy();
  donutChart = new Chart(ctx, {
    type: "doughnut",
    data: { datasets: [{ data: [hadir, miss], backgroundColor: ["#59B292", "#FF6A14"], borderWidth: 0 }] },
    options: { cutout: "72%", plugins: { legend: { display: false }, tooltip: { enabled: true } } },
  });
}

function renderTimeline(list) {
  const buckets = {};
  list.forEach((p) => {
    if (!p.kehadiran || !p.waktu_checkin) return;
    const d = new Date(p.waktu_checkin);
    const key = String(d.getHours()).padStart(2, "0") + ":00";
    buckets[key] = (buckets[key] || 0) + 1;
  });
  const labels = Object.keys(buckets).sort();
  const wrap = el("timelineWrap");
  if (labels.length === 0) {
    wrap.innerHTML = `<div class="empty-chart">Belum ada peserta yang absen</div>`;
    if (timelineChart) { timelineChart.destroy(); timelineChart = null; }
    return;
  }
  if (!document.getElementById("timelineChart")) {
    wrap.innerHTML = `<canvas id="timelineChart"></canvas>`;
  }
  const ctx = document.getElementById("timelineChart");
  if (timelineChart) timelineChart.destroy();
  timelineChart = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets: [{ data: labels.map((k) => buckets[k]), backgroundColor: "#FFC94D", borderRadius: 5, maxBarThickness: 36 }] },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: "#7A7168", font: { size: 11.5 } } },
        y: { beginAtZero: true, ticks: { precision: 0, color: "#7A7168", font: { size: 11.5 } }, grid: { color: "#E6D9BC" } },
      },
    },
  });
}

function renderNegaraBreakdown(list) {
  const map = {};
  list.forEach((p) => {
    const key = segmentLabel(p) || "Tidak diketahui";
    if (!map[key]) map[key] = { segment: key, total: 0, hadir: 0 };
    map[key].total += 1;
    if (p.kehadiran) map[key].hadir += 1;
  });
  const rows = Object.values(map).sort((a, b) => b.total - a.total);
  const wrap = el("instWrap");
  if (rows.length === 0) {
    wrap.innerHTML = `<div class="empty-chart">Belum ada data peserta</div>`;
    return;
  }
  wrap.innerHTML = `
    <table class="inst-table">
      <thead><tr><th>Segment</th><th>Terdaftar</th><th>Sudah Absen</th><th style="width:100px;">Proporsi</th></tr></thead>
      <tbody>
        ${rows.map((r) => `
          <tr>
            <td style="font-weight:500;">${r.segment}</td>
            <td>${r.total}</td>
            <td>${r.hadir}</td>
            <td><div class="inst-bar-wrap"><div class="inst-bar" style="width:${r.total ? (r.hadir / r.total) * 100 : 0}%"></div></div></td>
          </tr>`).join("")}
      </tbody>
    </table>`;
}

// =================================================================
// View: Peserta (filterable list + PDF export)
// =================================================================
document.querySelectorAll("#view-peserta .filter-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#view-peserta .filter-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    pesertaStatusFilter = btn.dataset.status;
    renderPeserta();
  });
});
el("segmentFilter").addEventListener("change", (e) => { pesertaSegmentFilter = e.target.value; renderPeserta(); });
el("pesertaSearchInput").addEventListener("input", renderPeserta);
el("pesertaRefreshBtn").addEventListener("click", fetchData);
el("exportPdfBtn").addEventListener("click", () => window.print());

function populateSegmentFilter() {
  const select = el("segmentFilter");
  const current = select.value;
  const segments = Array.from(new Set(participants.map((p) => segmentLabel(p) || "Tidak diketahui"))).sort();
  select.innerHTML = `<option value="all">Semua Segment</option>` + segments.map((c) => `<option value="${c}">${c}</option>`).join("");
  select.value = segments.includes(current) ? current : "all";
}

function getFilteredPeserta() {
  const q = el("pesertaSearchInput").value.trim().toLowerCase();
  return participants
    .filter((p) => (pesertaStatusFilter === "in" ? p.kehadiran : pesertaStatusFilter === "out" ? !p.kehadiran : true))
    .filter((p) => (pesertaSegmentFilter === "all" ? true : (segmentLabel(p) || "Tidak diketahui") === pesertaSegmentFilter))
    .filter((p) => !q ||
      p.fullname.toLowerCase().includes(q) || p.email.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q) || (p.company || "").toLowerCase().includes(q) ||
      (p.country || "").toLowerCase().includes(q))
    .sort((a, b) => a.fullname.localeCompare(b.fullname));
}

function renderPeserta() {
  populateSegmentFilter();
  const filtered = getFilteredPeserta();
  el("pesertaMetaLabel").textContent = `Menampilkan ${filtered.length} dari ${participants.length} peserta`;
  el("pesertaEmptyState").classList.toggle("hidden", filtered.length !== 0);

  el("pesertaTableBody").innerHTML = filtered.map((p, i) => `
    <tr>
      <td class="sub">${i + 1}</td>
      <td><div class="name-cell">${p.fullname}</div><div class="sub">${p.email}</div></td>
      <td class="sub">${p.phone || "—"}</td>
      <td>${p.country || "—"}</td>
      <td>${p.company || "—"}</td>
      <td>${p.jobtitle || "—"}</td>
      <td>${segmentLabel(p) || "—"}</td>
      <td class="mono sub">${p.id}</td>
      <td><span class="badge ${p.kehadiran ? "in" : "out"}">${p.kehadiran ? "Hadir" : "Belum Hadir"}</span></td>
      <td>${p.waktu_checkin ? timeFull(p.waktu_checkin) : "—"}</td>
    </tr>`).join("");

  el("printDate").textContent = "Dicetak " + new Date().toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" });
  el("printStats").innerHTML = `
    <div>Total ditampilkan: ${filtered.length} dari ${participants.length} peserta</div>
    <div>Sudah absen: ${filtered.filter((p) => p.kehadiran).length}</div>`;
}

// =================================================================
// View: Settings (quota / deadline)
// =================================================================
el("saveSettingsBtn").addEventListener("click", saveSettings);
el("deadlineInput").addEventListener("input", (e) => { e.target.dataset.touched = "1"; });

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
