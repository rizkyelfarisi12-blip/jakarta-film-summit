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

function segmentLabel(participant) {
  if (!participant) return "-";

  const segment = participant.segment || "";

  if (segment === "Others" || segment === "Lainnya") {
    return participant.segmentOther || "Others";
  }

  const labels = {
    filmmaker: "Filmmaker",
    producer: "Producer",
    production: "Production",
    distribution: "Distribution",
    exhibition: "Exhibition",
    government: "Government",
    investor: "Investor",
    media: "Media",
    student: "Student",
    academia: "Academia",
    creative: "Creative Industry",
  };

  return labels[segment] || segment || "-";
}

function el(id) {
  return document.getElementById(id);
}
// Data peserta berasal dari form publik -> selalu di-escape sebelum masuk innerHTML.
function esc(v) {
  return String(v ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}
function timeShort(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
function timeFull(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

let staffName = "";
let participants = [];
let checkinLog = [];
let settings = { quota: null, deadline: null };
let currentMode = "scan"; // check-in sub-tab: scan | search
let pesertaStatusFilter = "all"; // peserta view: all | in | out
let pesertaSegmentFilter = "all";
let pollTimer = null;
let pesertaDay = "all"; // peserta view: all | 1 | 2 | 3

// ---- day helpers: one participant can attend several days, check-in is per day ----
function todayEventDay() {
  const d = new Date();
  const key =
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0");
  return (
    { "2026-11-19": "1", "2026-11-20": "2", "2026-11-21": "3" }[key] || "1"
  );
}
let checkinDay = todayEventDay(); // day staff are checking people in for
let dashDay = checkinDay; // day shown on the dashboard

const registeredOn = (p, day) =>
  (p.days || []).map(String).includes(String(day));
const checkinOn = (p, day) => (p.checkins && p.checkins[day]) || null;
const attendedOn = (p, day) => !!checkinOn(p, day);
const daysLabel = (p) =>
  (p.days || []).map((d) => "Day " + d).join(", ") || "—";

// Copy of a participant whose kehadiran / waktu_checkin / checkin_oleh describe one day ("all" = any day).
function viewFor(p, day) {
  const all = Object.values(p.checkins || {}).sort((a, b) =>
    String(b.time).localeCompare(String(a.time)),
  );
  const c = day === "all" ? all[0] : checkinOn(p, day);
  return {
    ...p,
    kehadiran: !!c,
    waktu_checkin: c ? c.time : null,
    checkin_oleh: c ? c.by : null,
  };
}
function forDay(day) {
  return participants
    .filter((p) => day === "all" || registeredOn(p, day))
    .map((p) => viewFor(p, day));
}
function statusBadge(p) {
  if (!registeredOn(p, checkinDay))
    return `<div class="status-badge out-day">✕ Tidak terdaftar Day ${checkinDay}</div>`;
  return attendedOn(p, checkinDay)
    ? `<div class="status-badge done">✓ Sudah check-in</div>`
    : `<div class="status-badge valid">⏱ Belum check-in</div>`;
}
function initDayFilters(id, current, onPick) {
  const box = el(id);
  const mark = () =>
    box
      .querySelectorAll(".filter-btn")
      .forEach((b) =>
        b.classList.toggle("active", b.dataset.day === String(current())),
      );
  box.querySelectorAll(".filter-btn").forEach((b) =>
    b.addEventListener("click", () => {
      onPick(b.dataset.day);
      mark();
    }),
  );
  mark();
}
let donutChart = null;
let timelineChart = null;

// =================================================================
// QR CAMERA SCANNER
// =================================================================

let qrScanner = null;
let scannerRunning = false;

const startScannerBtn = el("startScannerBtn");
const stopScannerBtn = el("stopScannerBtn");
const scannerStatus = el("qr-reader-status");

if (startScannerBtn) {
  startScannerBtn.addEventListener("click", startQrScanner);
}

if (stopScannerBtn) {
  stopScannerBtn.addEventListener("click", stopQrScanner);
}

function makeQrScanner() {
  return new Html5Qrcode("qr-reader", {
    formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
    experimentalFeatures: { useBarCodeDetectorIfSupported: true },
    verbose: false,
  });
}

async function startQrScanner() {
  if (scannerRunning) return;

  if (typeof Html5Qrcode === "undefined") {
    scannerStatus.textContent =
      "QR scanner belum berhasil dimuat. Pastikan perangkat terhubung ke internet lalu muat ulang halaman.";
    return;
  }
  if (!window.isSecureContext || !navigator.mediaDevices) {
    scannerStatus.textContent =
      "Kamera hanya bisa dibuka lewat HTTPS (atau localhost). Buka halaman admin dengan alamat https://…";
    return;
  }

  scannerStatus.textContent = "Meminta akses kamera...";
  startScannerBtn.disabled = true;

  const scanConfig = {
    fps: 12,
    // Kotak baca persegi, 75% sisi terpendek area kamera
    qrbox: (w, h) => {
      const m = Math.min(w, h);
      const side = Math.min(m, Math.max(150, Math.floor(m * 0.75)));
      return { width: side, height: side };
    },
  };

  let started = false;
  let lastError = null;

  // Cara 1: pilih kamera belakang dari daftar perangkat
  try {
    const cameras = await Html5Qrcode.getCameras();
    if (cameras && cameras.length) {
      const back = cameras.find((c) =>
        /back|rear|environment|belakang/i.test(c.label),
      );
      const cam = back || cameras[cameras.length - 1];
      qrScanner = makeQrScanner();
      await qrScanner.start(cam.id, scanConfig, onQrCodeSuccess, onQrCodeError);
      started = true;
    }
  } catch (e) {
    lastError = e;
    console.warn("Start via deviceId gagal:", e);
    try { if (qrScanner) await qrScanner.clear(); } catch (_) {}
    qrScanner = null;
  }

  // Cara 2 (cadangan): minta kamera belakang lewat facingMode
  if (!started) {
    try {
      qrScanner = makeQrScanner();
      await qrScanner.start(
        { facingMode: "environment" },
        scanConfig,
        onQrCodeSuccess,
        onQrCodeError,
      );
      started = true;
    } catch (e) {
      lastError = e;
      console.warn("Start via facingMode gagal:", e);
      try { if (qrScanner) await qrScanner.clear(); } catch (_) {}
      qrScanner = null;
    }
  }

  startScannerBtn.disabled = false;

  if (!started) {
    scannerRunning = false;
    scannerStatus.textContent =
      "Kamera tidak dapat dibuka: " +
      getCameraErrorMessage(lastError || new Error("Tidak ada kamera yang ditemukan."));
    return;
  }

  scannerRunning = true;

  // Fokus otomatis kontinu (tidak fatal kalau tidak didukung)
  try {
    await qrScanner.applyVideoConstraints({ advanced: [{ focusMode: "continuous" }] });
  } catch (e) { /* abaikan */ }

  // Tombol senter (hanya muncul jika kamera mendukung)
  try {
    const torch = qrScanner.getRunningTrackCameraCapabilities().torchFeature();
    const torchBtn = el("torchBtn");
    if (torch.isSupported() && torchBtn) {
      let on = false;
      torchBtn.textContent = "🔦 Nyalakan Senter";
      torchBtn.style.display = "inline-flex";
      torchBtn.onclick = async () => {
        try {
          on = !on;
          await torch.apply(on);
          torchBtn.textContent = on ? "🔦 Matikan Senter" : "🔦 Nyalakan Senter";
        } catch (e) { on = !on; }
      };
    }
  } catch (e) { /* senter tidak didukung — abaikan */ }

  startScannerBtn.style.display = "none";
  stopScannerBtn.style.display = "inline-flex";
  scannerStatus.textContent =
    "Kamera aktif. Arahkan QR tiket ke dalam kotak, jaga jarak sekitar 15–25 cm.";
}

let lastScan = { text: "", at: 0 };

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    osc.frequency.value = 880;
    osc.connect(ctx.destination);
    osc.start();
    setTimeout(() => {
      osc.stop();
      ctx.close();
    }, 120);
  } catch (e) {
    /* bunyi bersifat opsional */
  }
}

function findByToken(text) {
  const direct = participants.find(
    (p) => p.qrToken && p.qrToken.toUpperCase() === text.toUpperCase(),
  );
  if (direct) return direct;
  try {
    // QR berisi URL, misalnya ...?token=XXXX
    const url = new URL(text);
    const t = url.searchParams.get("qrToken") || url.searchParams.get("token");
    if (t)
      return participants.find(
        (p) => p.qrToken && p.qrToken.toUpperCase() === t.toUpperCase(),
      );
  } catch (e) {
    /* bukan URL */
  }
  return null;
}

async function onQrCodeSuccess(decodedText) {
  const token = (decodedText || "").trim();
  if (!token) return;

  // QR yang sama masih di depan kamera — abaikan pembacaan ulang selama 3 detik.
  const now = Date.now();
  if (token === lastScan.text && now - lastScan.at < 3000) return;
  lastScan = { text: token, at: now };

  let found = findByToken(token);
  if (!found) {
    // Mungkin peserta baru saja mendaftar: muat ulang daftar sekali lalu coba lagi.
    await fetchData();
    found = findByToken(token);
  }

  beep();
  el("resultTicket").classList.add("hidden");
  el("notFoundCard").classList.add("hidden");

  if (found) {
    scannerStatus.textContent = "QR berhasil dibaca: " + found.id;
    renderTicket(found);
  } else {
    scannerStatus.textContent = "QR terbaca, tetapi peserta tidak ditemukan.";
    el("notFoundCard").classList.remove("hidden");
  }
  // Kamera sengaja tetap menyala supaya peserta berikutnya bisa langsung di-scan.
}

function onQrCodeError(errorMessage) {
  // Error ini terjadi terus-menerus saat kamera belum menemukan QR.
  // Jangan tampilkan ke console supaya tidak penuh.
}

async function stopQrScanner() {
  if (!qrScanner) return;

  try {
    if (scannerRunning) {
      await qrScanner.stop();
    }
  } catch (error) {
    console.warn("Gagal menghentikan scanner:", error);
  }

  try {
    await qrScanner.clear();
  } catch (error) {
    // ignore
  }

  qrScanner = null;
  scannerRunning = false;

  startScannerBtn.style.display = "inline-flex";
  stopScannerBtn.style.display = "none";

  if (el("torchBtn")) el("torchBtn").style.display = "none";
  scannerStatus.textContent = 'Tekan "Buka Kamera" untuk mulai scan QR.';
}

function getCameraErrorMessage(error) {
  if (!error) {
    return "Alasan tidak diketahui.";
  }

  const message = String(error.message || error);

  if (
    error.name === "NotAllowedError" ||
    message.toLowerCase().includes("permission")
  ) {
    return "Izin kamera ditolak. Izinkan kamera di browser lalu coba lagi.";
  }

  if (
    error.name === "NotFoundError" ||
    message.toLowerCase().includes("camera")
  ) {
    return "Kamera tidak ditemukan.";
  }

  if (error.name === "NotReadableError") {
    return "Kamera sedang digunakan aplikasi lain.";
  }

  if (error.name === "SecurityError") {
    return "Browser memblokir akses kamera karena alasan keamanan.";
  }

  return message;
}

// =================================================================
// Login (email + password, session-cookie based)
// =================================================================
el("loginBtn").addEventListener("click", doLogin);
el("staffPasswordInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") doLogin();
});

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
    errBox.textContent =
      "Tidak bisa menghubungi server. (Backend belum terhubung?)";
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
    await fetch(`${API_BASE}/logout`, {
      method: "POST",
      credentials: "include",
    });
  } catch (e) {
    /* ignore */
  }
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
  } catch (e) {
    /* not logged in yet — show login screen as normal */
  }
})();

// =================================================================
// Sidebar navigation (5 views)
// =================================================================
document.querySelectorAll(".nav-item").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".nav-item")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    ["scan", "dashboard", "peserta", "gallery", "settings"].forEach((v) =>
      el("view-" + v).classList.add("hidden"),
    );
    el("view-" + btn.dataset.view).classList.remove("hidden");
    if (btn.dataset.view !== "scan") stopQrScanner();
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
    if (pRes.status === 401 || sRes.status === 401)
      return handleSessionExpired();
    if (!pRes.ok) {
      const data = await pRes.json().catch(() => ({}));
      throw new Error(data.error || `Participants API error (${pRes.status})`);
    }

    if (!sRes.ok) {
      const data = await sRes.json().catch(() => ({}));
      throw new Error(data.error || `Settings API error (${sRes.status})`);
    }

    participants = await pRes.json();
    settings = await sRes.json();
  } catch (e) {
    console.warn("Could not load admin data.", e);
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
    document
      .querySelectorAll(".tab")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentMode = btn.dataset.mode;
    if (currentMode !== "scan") stopQrScanner();
    el("modeScanPanel").classList.toggle("hidden", currentMode !== "scan");
    el("modeSearchPanel").classList.toggle("hidden", currentMode !== "search");
    el("resultTicket").classList.add("hidden");
    el("notFoundCard").classList.add("hidden");
  });
});

el("verifyBtn").addEventListener("click", () =>
  lookupToken(el("tokenInput").value),
);
el("tokenInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") lookupToken(el("tokenInput").value);
});

function lookupToken(token) {
  el("resultTicket").classList.add("hidden");
  el("notFoundCard").classList.add("hidden");
  const t = token.trim();
  if (!t) return;
  const found = participants.find(
    (p) => p.qrToken.toUpperCase() === t.toUpperCase(),
  );
  if (found) renderTicket(found);
  else el("notFoundCard").classList.remove("hidden");
}

el("checkinSearchInput").addEventListener("input", (e) => {
  const q = e.target.value.trim().toLowerCase();
  el("resultTicket").classList.add("hidden");
  const matches = q
    ? participants.filter(
        (p) =>
          p.fullname.toLowerCase().includes(q) ||
          p.email.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q),
      )
    : [];
  el("searchEmptyNote").classList.toggle(
    "hidden",
    !(q && matches.length === 0),
  );
  el("searchMatches").innerHTML = matches
    .map(
      (p) => `
    <div class="matchrow" data-id="${p.id}">
      <div><div class="name">${esc(p.fullname)}</div><div class="meta">${esc(p.email)} · ${esc(p.id)}</div></div>
      ${statusBadge(p)}
    </div>`,
    )
    .join("");
  el("searchMatches")
    .querySelectorAll(".matchrow")
    .forEach((row) => {
      row.addEventListener("click", () => {
        const p = participants.find((x) => x.id === row.dataset.id);
        if (p) renderTicket(p);
      });
    });
});

function renderTicket(raw, opts) {
  opts = opts || {};
  const p = viewFor(raw, checkinDay);
  const registered = registeredOn(raw, checkinDay);
  const ck = checkinOn(raw, checkinDay);

  // Verdict besar: yang paling penting dilihat petugas = terdaftar di hari ini atau tidak.
  let state, icon, title, sub;
  if (!registered) {
    state = "no";
    icon = "✕";
    title = `TIDAK TERDAFTAR DAY ${checkinDay}`;
    sub = `Peserta ini hanya terdaftar untuk ${esc(daysLabel(raw))}. Tidak bisa check-in hari ini.`;
  } else if (opts.justDone && ck) {
    state = "ok";
    icon = "✓";
    title = `CHECK-IN DAY ${checkinDay} BERHASIL`;
    sub = `Tercatat pukul ${timeShort(ck.time)}.`;
  } else if (ck) {
    state = "done";
    icon = "!";
    title = `SUDAH CHECK-IN DAY ${checkinDay}`;
    sub = `Pukul ${timeShort(ck.time)} oleh ${esc(ck.by || "-")}.`;
  } else {
    state = "ok";
    icon = "✓";
    title = `TERDAFTAR DAY ${checkinDay}`;
    sub = "Belum check-in. Konfirmasi di bawah untuk mencatat kehadiran.";
  }

  // Ringkasan Day 1-3: terdaftar / sudah check-in jam berapa
  const strip = [1, 2, 3]
    .map((d) => {
      const reg = registeredOn(raw, d);
      const c = checkinOn(raw, d);
      const cls = !reg ? "none" : c ? "in" : "out";
      const txt = !reg ? "Tidak terdaftar" : c ? "✓ " + timeShort(c.time) : "Belum check-in";
      return `<div class="day-pill ${cls}${String(d) === String(checkinDay) ? " current" : ""}">
        <span class="dp-day">Day ${d}</span><span class="dp-state">${txt}</span></div>`;
    })
    .join("");

  let footer;
  if (registered && !ck) {
    footer = `<div></div><button class="btn btn-primary btn-lg" id="confirmCheckinBtn">✓ Check-in Day ${checkinDay} Sekarang</button>`;
  } else {
    footer = "";
  }

  const box = el("resultTicket");
  box.className = "ticket state-" + state;
  box.innerHTML = `
    <div class="verdict verdict-${state}">
      <div class="verdict-icon" aria-hidden="true">${icon}</div>
      <div class="verdict-text"><div class="verdict-title">${title}</div><div class="verdict-sub">${sub}</div></div>
    </div>
    <div class="ticket-head">
      <div><div class="ticket-id mono">${esc(p.id)}</div><div class="ticket-name">${esc(p.fullname)}</div></div>
    </div>
    <div class="day-strip">${strip}</div>
    <div class="perf"></div>
    <div class="ticket-details">
      <div class="detail-row">✉️ <strong>${esc(p.email)}</strong></div>
      <div class="detail-row">📞 <strong>${esc(p.phone || "—")}</strong></div>
      <div class="detail-row">🌍 <strong>${esc(p.country || "—")}</strong></div>
      <div class="detail-row">🏢 <strong>${esc(p.company || "—")}</strong></div>
      <div class="detail-row">🏷️ <strong>${esc(p.jobtitle || "—")}</strong></div>
      <div class="detail-row">🎬 <strong>${esc(segmentLabel(p))}</strong></div>
    </div>
    ${footer ? `<div class="ticket-footer">${footer}</div>` : ""}`;
  if (registered && !ck) {
    el("confirmCheckinBtn").addEventListener("click", () => doCheckIn(raw));
  }
  box.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

async function doCheckIn(p) {
  try {
    const res = await fetch(`${API_BASE}/checkin`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qrToken: p.qrToken, day: Number(checkinDay) }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok && !data.participant)
      throw new Error(data.error || "checkin failed");
    const updated = data.participant;
    participants = participants.map((x) => (x.id === updated.id ? updated : x));
    if (res.ok) {
      checkinLog.unshift({
        id: updated.id,
        nama: `${updated.fullname} (Day ${checkinDay})`,
        time: checkinOn(updated, checkinDay).time,
        staff: staffName,
      });
      renderLog();
    }
    renderTicket(updated, { justDone: res.ok });
    renderAll();
  } catch (e) {
    alert("Gagal check-in. Cek koneksi ke server.\n\n" + (e.message || ""));
    console.error(e);
  }
}

function renderLog() {
  const box = el("checkinLog");
  if (checkinLog.length === 0) {
    box.innerHTML = `<p class="empty-note" style="margin-top:0;">Belum ada peserta yang check-in.</p>`;
    return;
  }
  box.innerHTML = checkinLog
    .slice(0, 20)
    .map(
      (e) => `
    <div class="log-row"><span>${esc(e.nama)}</span><span class="who">${timeShort(e.time)} · ${esc(e.staff)}</span></div>
  `,
    )
    .join("");
}

// =================================================================
// View: Dashboard (charts)
// =================================================================
el("dashboardRefreshBtn").addEventListener("click", fetchData);

function renderDashboard() {
  const list = forDay(dashDay);
  const total = list.length;
  const hadir = list.filter((p) => p.kehadiran).length;
  const miss = total - hadir;
  const rate = total ? Math.round((hadir / total) * 100) : 0;
  const dayInfo = (settings.days || []).find(
    (d) => String(d.day) === String(dashDay),
  );
  const quotaNote =
    dayInfo && dayInfo.quota != null
      ? ` · kuota ${dayInfo.taken}/${dayInfo.quota}`
      : "";

  el("dashboardSyncLabel").textContent =
    `Day ${dashDay}${quotaNote} · Sync ` + timeShort(new Date().toISOString());
  el("valTotal").textContent = total;
  el("valHadir").textContent = hadir;
  el("valMiss").textContent = miss;
  el("subHadir").textContent = total
    ? `${rate}% dari total terdaftar`
    : "Belum ada data";
  el("subMiss").textContent = total
    ? `${100 - rate}% belum melakukan absen`
    : "Belum ada data";

  renderDonut(total, hadir, miss, rate);
  renderTimeline(list);
  renderNegaraBreakdown(list);
}

function renderDonut(total, hadir, miss, rate) {
  const wrap = el("donutWrap");
  if (total === 0) {
    wrap.innerHTML = `<div class="empty-chart">Belum ada data peserta</div>`;
    if (donutChart) {
      donutChart.destroy();
      donutChart = null;
    }
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
    data: {
      datasets: [
        {
          data: [hadir, miss],
          backgroundColor: ["#59B292", "#FF6A14"],
          borderWidth: 0,
        },
      ],
    },
    options: {
      cutout: "72%",
      plugins: { legend: { display: false }, tooltip: { enabled: true } },
    },
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
    if (timelineChart) {
      timelineChart.destroy();
      timelineChart = null;
    }
    return;
  }
  if (!document.getElementById("timelineChart")) {
    wrap.innerHTML = `<canvas id="timelineChart"></canvas>`;
  }
  const ctx = document.getElementById("timelineChart");
  if (timelineChart) timelineChart.destroy();
  timelineChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          data: labels.map((k) => buckets[k]),
          backgroundColor: "#FFC94D",
          borderRadius: 5,
          maxBarThickness: 36,
        },
      ],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: "#7A7168", font: { size: 11.5 } },
        },
        y: {
          beginAtZero: true,
          ticks: { precision: 0, color: "#7A7168", font: { size: 11.5 } },
          grid: { color: "#E6D9BC" },
        },
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
        ${rows
          .map(
            (r) => `
          <tr>
            <td style="font-weight:500;">${r.segment}</td>
            <td>${r.total}</td>
            <td>${r.hadir}</td>
            <td><div class="inst-bar-wrap"><div class="inst-bar" style="width:${r.total ? (r.hadir / r.total) * 100 : 0}%"></div></div></td>
          </tr>`,
          )
          .join("")}
      </tbody>
    </table>`;
}

// =================================================================
// View: Peserta (filterable list + PDF export)
// =================================================================
document.querySelectorAll("#view-peserta .filter-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll("#view-peserta .filter-btn")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    pesertaStatusFilter = btn.dataset.status;
    renderPeserta();
  });
});
el("segmentFilter").addEventListener("change", (e) => {
  pesertaSegmentFilter = e.target.value;
  renderPeserta();
});
el("pesertaSearchInput").addEventListener("input", renderPeserta);
el("pesertaRefreshBtn").addEventListener("click", fetchData);
el("exportPdfBtn").addEventListener("click", () => window.print());

function populateSegmentFilter() {
  const select = el("segmentFilter");
  const current = select.value;
  const segments = Array.from(
    new Set(participants.map((p) => segmentLabel(p) || "Tidak diketahui")),
  ).sort();
  select.innerHTML =
    `<option value="all">Semua Segment</option>` +
    segments.map((c) => `<option value="${c}">${c}</option>`).join("");
  select.value = segments.includes(current) ? current : "all";
}

function getFilteredPeserta() {
  const q = el("pesertaSearchInput").value.trim().toLowerCase();
  return forDay(pesertaDay)
    .filter((p) =>
      pesertaStatusFilter === "in"
        ? p.kehadiran
        : pesertaStatusFilter === "out"
          ? !p.kehadiran
          : true,
    )
    .filter((p) =>
      pesertaSegmentFilter === "all"
        ? true
        : (segmentLabel(p) || "Tidak diketahui") === pesertaSegmentFilter,
    )
    .filter(
      (p) =>
        !q ||
        p.fullname.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        (p.company || "").toLowerCase().includes(q) ||
        (p.country || "").toLowerCase().includes(q),
    )
    .sort((a, b) => a.fullname.localeCompare(b.fullname));
}

// Sel per hari: terdaftar? sudah check-in jam berapa?
function dayCell(p, d) {
  if (!registeredOn(p, d))
    return `<span class="dcell none" title="Tidak terdaftar Day ${d}">—</span>`;
  const c = checkinOn(p, d);
  if (c)
    return `<span class="dcell in" title="Check-in Day ${d}: ${esc(timeFull(c.time))}"><b>✓ ${timeShort(c.time)}</b><small>${esc(c.by || "")}</small></span>`;
  return `<span class="dcell out" title="Terdaftar, belum check-in">Belum</span>`;
}

const PESERTA_HEAD = `<th>No</th><th>Peserta</th><th>Telepon</th><th>Negara</th><th>Perusahaan</th><th>Jabatan</th><th>Segment</th><th class="th-day">Day 1</th><th class="th-day">Day 2</th><th class="th-day">Day 3</th><th>ID</th><th class="no-print">Aksi</th>`;

function renderPeserta() {
  const headRow = document.querySelector("#view-peserta thead tr");
  if (headRow && headRow.dataset.v !== "3") {
    headRow.innerHTML = PESERTA_HEAD;
    headRow.dataset.v = "3";
  }
  populateSegmentFilter();
  const filtered = getFilteredPeserta();
  const base = forDay(pesertaDay).length;
  el("pesertaMetaLabel").textContent =
    `Menampilkan ${filtered.length} dari ${base} peserta`;
  el("pesertaEmptyState").classList.toggle("hidden", filtered.length !== 0);

  el("pesertaTableBody").innerHTML = filtered
    .map(
      (p, i) => `
    <tr>
      <td class="sub c-no">${i + 1}</td>
      <td class="c-name"><div class="name-cell">${esc(p.fullname)}</div><div class="sub">${esc(p.email)}</div></td>
      <td class="sub c-info" data-label="Telepon">${esc(p.phone || "—")}</td>
      <td class="c-info" data-label="Negara">${esc(p.country || "—")}</td>
      <td class="c-info" data-label="Perusahaan">${esc(p.company || "—")}</td>
      <td class="c-info" data-label="Jabatan">${esc(p.jobtitle || "—")}</td>
      <td class="c-info" data-label="Segment">${esc(segmentLabel(p) || "—")}</td>
      <td class="day-td" data-label="Day 1">${dayCell(p, 1)}</td>
      <td class="day-td" data-label="Day 2">${dayCell(p, 2)}</td>
      <td class="day-td" data-label="Day 3">${dayCell(p, 3)}</td>
      <td class="mono sub c-info" data-label="ID">${esc(p.id)}</td>
      <td class="no-print c-act"><button class="mini-btn" data-edit-days="${esc(p.id)}">Ubah hari</button></td>
    </tr>`,
    )
    .join("");

  el("printDate").textContent =
    "Dicetak " +
    new Date().toLocaleString("id-ID", {
      dateStyle: "long",
      timeStyle: "short",
    });
  el("printStats").innerHTML = `
    <div>Hari: ${pesertaDay === "all" ? "Semua" : "Day " + pesertaDay} · Total ditampilkan: ${filtered.length} dari ${base} peserta</div>
    <div>Sudah absen: ${filtered.filter((p) => p.kehadiran).length}</div>`;
}

el("dayFilter").addEventListener("change", (e) => {
  pesertaDay = e.target.value;
  renderPeserta();
});

// ---- committee edits a participant's days ----
let editingId = null;
el("pesertaTableBody").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-edit-days]");
  if (!btn) return;
  const p = participants.find((x) => x.id === btn.dataset.editDays);
  if (!p) return;
  editingId = p.id;
  el("daysDialogName").textContent = `${p.fullname} · ${p.id}`;
  el("daysDialogError").textContent = "";
  document
    .querySelectorAll('#daysDialog input[name="editDay"]')
    .forEach((i) => (i.checked = registeredOn(p, i.value)));
  el("daysDialog").showModal();
});
el("daysDialogCancel").addEventListener("click", () =>
  el("daysDialog").close(),
);
el("daysDialogSave").addEventListener("click", async () => {
  const days = [
    ...document.querySelectorAll('#daysDialog input[name="editDay"]:checked'),
  ].map((i) => Number(i.value));
  if (!days.length) {
    el("daysDialogError").textContent = "Pilih minimal satu hari.";
    return;
  }
  try {
    const res = await fetch(`${API_BASE}/participants/days`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editingId, days }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      el("daysDialogError").textContent = data.error || "Gagal menyimpan.";
      return;
    }
    el("daysDialog").close();
    fetchData();
  } catch (err) {
    el("daysDialogError").textContent = "Tidak bisa menghubungi server.";
  }
});

// ---- day selectors (check-in & dashboard) ----
initDayFilters(
  "checkinDayFilters",
  () => checkinDay,
  (d) => {
    checkinDay = d;
    el("resultTicket").classList.add("hidden");
    el("notFoundCard").classList.add("hidden");
    el("checkinSearchInput").dispatchEvent(new Event("input"));
  },
);
initDayFilters(
  "dashDayFilters",
  () => dashDay,
  (d) => {
    dashDay = d;
    renderDashboard();
  },
);

// =================================================================
// View: Settings (quota / deadline)
// =================================================================
el("saveSettingsBtn").addEventListener("click", saveSettings);
el("deadlineInput").addEventListener("input", (e) => {
  e.target.dataset.touched = "1";
});

[1, 2, 3].forEach((n) =>
  el("quotaInput" + n).addEventListener(
    "input",
    (e) => (e.target.dataset.touched = "1"),
  ),
);

function renderSettings() {
  const days = settings.days || [];
  days.forEach((d) => {
    const input = el("quotaInput" + d.day);
    if (!input.dataset.touched) input.value = d.quota != null ? d.quota : "";
    el("quotaHint" + d.day).textContent =
      `Terdaftar: ${d.taken}` +
      (d.quota != null ? ` / ${d.quota}` : " (tanpa batas)");
  });
  if (settings.deadline && !el("deadlineInput").dataset.touched) {
    el("deadlineInput").value = settings.deadline
      .slice(0, 16)
      .replace(" ", "T");
  }

  const full = (d) => d.quota != null && d.taken >= d.quota;
  const allFull = days.length > 0 && days.every(full);
  const deadlinePassed =
    settings.deadline != null &&
    new Date(settings.deadline.replace(" ", "T")) < new Date();
  const closed = allFull || deadlinePassed;

  let html = `<div class="status-pill ${closed ? "closed" : "open"}">${closed ? "Pendaftaran TERTUTUP" : "Pendaftaran TERBUKA"}</div>`;
  if (closed) {
    html += `<p class="settings-hint" style="margin-top:10px;">${allFull ? "Alasan: kuota semua hari sudah penuh." : "Alasan: sudah melewati batas waktu pendaftaran."}</p>`;
  }
  days.forEach((d) => {
    html += `<p class="settings-hint" style="margin-top:8px;">Day ${d.day}: ${d.taken}${d.quota != null ? " / " + d.quota : ""} peserta — ${full(d) ? "PENUH" : "masih tersedia"}</p>`;
  });
  if (settings.deadline) {
    html += `<p class="settings-hint" style="margin-top:8px;">Batas waktu: ${new Date(settings.deadline.replace(" ", "T")).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" })}</p>`;
  }
  el("statusPillWrap").innerHTML = html;
}

async function saveSettings() {
  const btn = el("saveSettingsBtn");
  btn.disabled = true;
  const quotas = {};
  [1, 2, 3].forEach((n) => {
    const v = el("quotaInput" + n).value.trim();
    quotas[n] = v === "" ? null : Math.max(0, parseInt(v, 10) || 0);
  });
  try {
    const res = await fetch(`${API_BASE}/settings`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quotas,
        deadline: el("deadlineInput").value || null,
      }),
    });
    if (!res.ok) throw new Error("save failed");
    settings = await res.json();
    [1, 2, 3].forEach((n) => delete el("quotaInput" + n).dataset.touched);
    renderSettings();
  } catch (e) {
    alert("Gagal menyimpan pengaturan. Cek koneksi ke server.");
    console.error(e);
  } finally {
    btn.disabled = false;
  }
}

// =================================================================
// View: Gallery (frontend prototype)
// =================================================================
let galleryMedia = [];
let galleryFilter = "all";
let galleryDayFilter = "all";
let galleryInitialized = false;

function initGalleryView() {
  if (galleryInitialized) return;
  galleryInitialized = true;

  const openBtn = el("galleryOpenUploadBtn");
  const closeBtn = el("galleryCloseUploadBtn");
  const panel = el("galleryUploadPanel");
  const input = el("galleryFileInput");
  const dropzone = el("galleryDropzone");
  const publishBtn = el("galleryPublishBtn");
  const dayFilter = el("galleryDayFilter");

  openBtn?.addEventListener("click", () => {
    panel?.classList.remove("hidden");
    setTimeout(
      () => panel?.scrollIntoView({ behavior: "smooth", block: "start" }),
      30,
    );
  });
  closeBtn?.addEventListener("click", () => panel?.classList.add("hidden"));
  input?.addEventListener("change", (e) => setGalleryFiles(e.target.files));
  dayFilter?.addEventListener("change", (e) => {
    galleryDayFilter = e.target.value;
    renderGalleryLibrary();
  });
  document.querySelectorAll("[data-gallery-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll("[data-gallery-filter]")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      galleryFilter = btn.dataset.galleryFilter;
      renderGalleryLibrary();
    });
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    dropzone?.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.add("dragover");
    });
  });
  ["dragleave", "drop"].forEach((eventName) => {
    dropzone?.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.remove("dragover");
    });
  });
  dropzone?.addEventListener("drop", (e) =>
    setGalleryFiles(e.dataTransfer.files),
  );
  publishBtn?.addEventListener("click", publishGalleryFiles);
  renderGalleryLibrary();
  updateGalleryStats();
}

function setGalleryFiles(fileList) {
  const files = Array.from(fileList || []).filter((file) =>
    /^(image\/(jpeg|png|webp)|video\/(mp4|quicktime))$/i.test(file.type),
  );
  if (!files.length) return;
  const queue = el("galleryUploadQueue");
  queue.innerHTML = files
    .map(
      (file, i) => `
    <div class="gallery-queue-item">
      <span class="gallery-queue-index">${i + 1}</span>
      <div><strong>${escapeGalleryText(file.name)}</strong><small>${formatGalleryBytes(file.size)}</small></div>
    </div>`,
    )
    .join("");
  queue.dataset.count = String(files.length);
  queue._files = files;
}

function publishGalleryFiles() {
  const queue = el("galleryUploadQueue");
  const files = queue?._files || [];
  if (!files.length) {
    alert("Pilih minimal satu foto atau video terlebih dahulu.");
    return;
  }
  const day = el("galleryDayInput").value;
  const session = el("gallerySessionInput").value || "General";
  const caption = el("galleryCaptionInput").value.trim();
  files.forEach((file) => {
    galleryMedia.unshift({
      id: crypto.randomUUID
        ? crypto.randomUUID()
        : String(Date.now() + Math.random()),
      file,
      url: URL.createObjectURL(file),
      type: file.type.startsWith("video/") ? "video" : "photo",
      day,
      session,
      caption,
      published: true,
      createdAt: new Date(),
    });
  });
  queue.innerHTML = "";
  queue._files = [];
  el("galleryFileInput").value = "";
  el("galleryCaptionInput").value = "";
  el("gallerySessionInput").value = "";
  el("galleryUploadPanel").classList.add("hidden");
  renderGalleryLibrary();
  updateGalleryStats();
}

function renderGalleryLibrary() {
  const wrap = el("galleryLibrary");
  if (!wrap) return;
  const list = galleryMedia.filter(
    (item) =>
      (galleryFilter === "all" || item.type === galleryFilter) &&
      (galleryDayFilter === "all" || item.day === galleryDayFilter),
  );
  el("galleryLibraryLabel").textContent = `${list.length} media ditampilkan`;
  el("galleryTotalLabel").textContent = `${galleryMedia.length} media`;
  if (!list.length) {
    wrap.innerHTML = `<div class="gallery-empty"><div class="gallery-empty-icon">▧</div><strong>Belum ada media</strong><p>Upload foto atau video dokumentasi untuk mulai mengisi Gallery.</p><button class="btn btn-primary" type="button" onclick="document.getElementById('galleryOpenUploadBtn').click()">＋ Upload Media</button></div>`;
    return;
  }
  wrap.innerHTML = list
    .map(
      (item) => `
    <article class="gallery-media-card">
      <div class="gallery-media-preview">
        ${
          item.type === "video"
            ? `<video src="${item.url}" muted preload="metadata"></video><span class="media-type">VIDEO</span>`
            : `<img src="${item.url}" alt="${escapeGalleryText(item.caption || item.file.name)}" loading="lazy"><span class="media-type">PHOTO</span>`
        }
        <button class="gallery-delete" type="button" data-gallery-delete="${item.id}" aria-label="Hapus media">×</button>
      </div>
      <div class="gallery-media-info">
        <div class="gallery-media-meta"><span>DAY ${item.day}</span><span>${escapeGalleryText(item.session)}</span></div>
        <h3>${escapeGalleryText(item.caption || item.file.name)}</h3>
        <div class="gallery-media-bottom"><span>${formatGalleryBytes(item.file.size)}</span><span class="published-dot">● Published</span></div>
      </div>
    </article>`,
    )
    .join("");
  wrap.querySelectorAll("[data-gallery-delete]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = galleryMedia.find((x) => x.id === btn.dataset.galleryDelete);
      if (item?.url) URL.revokeObjectURL(item.url);
      galleryMedia = galleryMedia.filter(
        (x) => x.id !== btn.dataset.galleryDelete,
      );
      renderGalleryLibrary();
      updateGalleryStats();
    });
  });
}

function updateGalleryStats() {
  const photos = galleryMedia.filter((x) => x.type === "photo").length;
  const videos = galleryMedia.filter((x) => x.type === "video").length;
  const published = galleryMedia.filter((x) => x.published).length;
  const days = new Set(galleryMedia.map((x) => x.day)).size;
  if (el("galleryPhotoCount")) el("galleryPhotoCount").textContent = photos;
  if (el("galleryVideoCount")) el("galleryVideoCount").textContent = videos;
  if (el("galleryPublishedCount"))
    el("galleryPublishedCount").textContent = published;
  if (el("galleryDayCount")) el("galleryDayCount").textContent = days;
  if (el("galleryTotalLabel"))
    el("galleryTotalLabel").textContent = `${galleryMedia.length} media`;
}

function formatGalleryBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  return `${(bytes / Math.pow(1024, i)).toFixed(i ? 1 : 0)} ${units[i]}`;
}

function escapeGalleryText(value) {
  return String(value ?? "").replace(
    /[&<>'"]/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[char],
  );
}

// Initialise Gallery only after the DOM exists. Other admin views keep their original flow.
document.addEventListener("DOMContentLoaded", initGalleryView);