/* ============================================================
 * CONFIG — point this to your real backend.
 * Expected endpoints (see jfs-api-reference.md):
 *   GET  /api/status    -> { open, reason, quota, deadline, total }
 *   POST /api/register  -> { participant } or 409 with { participant } if duplicate
 * ============================================================ */
const API_BASE = "/api";

const COUNTRIES = [
  "Indonesia","Malaysia","Singapore","Thailand","Philippines","Vietnam","Brunei Darussalam","Cambodia","Laos","Myanmar",
  "Timor-Leste","Japan","South Korea","North Korea","China","Hong Kong","Macau","Taiwan","India","Pakistan",
  "Bangladesh","Sri Lanka","Nepal","Bhutan","Maldives","Afghanistan","Iran","Iraq","Saudi Arabia","United Arab Emirates",
  "Qatar","Kuwait","Bahrain","Oman","Jordan","Lebanon","Israel","Palestine","Turkey","Cyprus","Syria","Yemen",
  "Kazakhstan","Uzbekistan","Turkmenistan","Kyrgyzstan","Tajikistan","Mongolia",
  "United States","Canada","Mexico","Brazil","Argentina","Chile","Colombia","Peru","Venezuela","Ecuador",
  "Bolivia","Paraguay","Uruguay","Guyana","Suriname","Cuba","Dominican Republic","Haiti","Jamaica","Bahamas",
  "Trinidad and Tobago","Barbados","Panama","Costa Rica","Guatemala","Honduras","El Salvador","Nicaragua","Belize",
  "United Kingdom","Ireland","France","Germany","Netherlands","Belgium","Luxembourg","Switzerland","Austria","Italy",
  "Spain","Portugal","Greece","Poland","Czech Republic","Slovakia","Hungary","Romania","Bulgaria","Croatia",
  "Serbia","Bosnia and Herzegovina","Slovenia","Montenegro","North Macedonia","Albania","Kosovo","Ukraine","Belarus",
  "Russia","Moldova","Lithuania","Latvia","Estonia","Sweden","Norway","Denmark","Finland","Iceland",
  "Malta","Andorra","Monaco","San Marino","Liechtenstein","Vatican City",
  "Australia","New Zealand","Papua New Guinea","Fiji","Samoa","Tonga","Vanuatu","Solomon Islands","Kiribati",
  "Palau","Micronesia","Marshall Islands","Tuvalu","Nauru",
  "Egypt","South Africa","Nigeria","Kenya","Morocco","Algeria","Tunisia","Libya","Ethiopia","Ghana",
  "Tanzania","Uganda","Senegal","Cameroon","Ivory Coast","Zimbabwe","Zambia","Mozambique","Angola","Sudan",
  "South Sudan","Rwanda","Burundi","Somalia","Djibouti","Eritrea","Chad","Niger","Mali","Burkina Faso",
  "Guinea","Guinea-Bissau","Equatorial Guinea","Sierra Leone","Liberia","Togo","Benin","Gabon","Republic of the Congo",
  "Democratic Republic of the Congo","Central African Republic","Gambia","Mauritania","Lesotho","Eswatini","Namibia",
  "Botswana","Malawi","Madagascar","Mauritius","Seychelles","Comoros","Cape Verde","Sao Tome and Principe",
];

const ROLES = [
  "Director / Filmmaker","Producer","Screenwriter","Actor / Actress","Cinematographer (DOP)","Film Editor",
  "Distributor","Investor / Film Financing","Festival Programmer","Journalist / Media",
  "Academic / Film Student","Sponsor / Industry Partner","Other",
];

function qrImageUrl(token) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=10&qzone=1&data=${encodeURIComponent(token)}`;
}

function el(id) { return document.getElementById(id); }

// populate country datalist + role select
const countryList = el("countryList");
COUNTRIES.forEach((c) => {
  const opt = document.createElement("option");
  opt.value = c;
  countryList.appendChild(opt);
});
const roleSelect = el("f_peran");
ROLES.forEach((r) => {
  const opt = document.createElement("option");
  opt.value = r;
  opt.textContent = r;
  roleSelect.appendChild(opt);
});

let currentTicket = null;

async function checkStatus() {
  try {
    const res = await fetch(`${API_BASE}/status`);
    if (!res.ok) throw new Error("status check failed");
    const data = await res.json();
    el("loadingState").classList.add("hidden");
    if (!data.open) {
      showClosed(data);
    } else {
      el("regForm").classList.remove("hidden");
    }
  } catch (e) {
    // Backend not reachable yet (e.g. this file opened standalone without an API).
    // Fail open so the form is still usable / visually inspectable.
    console.warn("Could not reach /api/status — showing form anyway.", e);
    el("loadingState").classList.add("hidden");
    el("regForm").classList.remove("hidden");
  }
}

function showClosed(data) {
  el("closedState").classList.remove("hidden");
  if (data.reason === "quota") {
    el("closedIcon").textContent = "👥";
    el("closedMessage").textContent = "We've reached full capacity for Jakarta Film Summit 2026. Thank you for your interest — follow our channels for future updates.";
  } else {
    el("closedIcon").textContent = "📅";
    el("closedMessage").textContent = "The registration period for Jakarta Film Summit 2026 has ended.";
  }
  if (data.quota != null) {
    el("closedQuotaMeta").textContent = `${data.total} / ${data.quota} registered`;
    el("closedQuotaMeta").classList.remove("hidden");
  }
  if (data.deadline) {
    el("closedDeadlineMeta").textContent = "Registration closed on " + new Date(data.deadline).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" });
    el("closedDeadlineMeta").classList.remove("hidden");
  }
}

function validate() {
  const fields = {
    nama: el("f_nama").value.trim(),
    email: el("f_email").value.trim(),
    telp: el("f_telp").value.trim(),
    negara: el("f_negara").value.trim(),
    peran: el("f_peran").value.trim(),
    jabatan: el("f_jabatan").value.trim(),
  };
  let ok = true;
  ["nama", "email", "telp", "negara", "peran", "jabatan"].forEach((k) => {
    el("e_" + k).classList.remove("show");
    el("f_" + k).classList.remove("err");
  });
  if (!fields.nama) { markErr("nama"); ok = false; }
  if (!fields.email) { markErr("email"); ok = false; }
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) { markErr("email"); ok = false; }
  if (!fields.telp) { markErr("telp"); ok = false; }
  if (!fields.negara || !COUNTRIES.includes(fields.negara)) { markErr("negara"); ok = false; }
  if (!fields.peran) { markErr("peran"); ok = false; }
  if (!fields.jabatan) { markErr("jabatan"); ok = false; }
  return ok ? fields : null;
}

function markErr(key) {
  el("e_" + key).classList.add("show");
  el("f_" + key).classList.add("err");
}

function renderTicket(p, justRegistered) {
  currentTicket = p;
  el("t_nama").textContent = p.nama;
  el("t_id").textContent = p.id;
  el("t_qr").src = qrImageUrl(p.qrToken);
  el("t_email").textContent = p.email;
  el("t_telp").textContent = p.telp;
  el("t_negara").textContent = p.negara;
  el("t_peran").textContent = p.peran;
  el("t_jabatan").textContent = p.jabatan;
  el("t_status").textContent = p.kehadiran ? "Checked in" : "Not checked in";
  el("t_status").style.color = p.kehadiran ? "var(--success)" : "#8A6415";

  el("regForm").classList.add("hidden");
  el("ticketWrap").classList.remove("hidden");
  el("successHead").classList.toggle("hidden", !justRegistered);
  el("downloadNote").textContent = (justRegistered ? "Your QR file has been downloaded automatically. " : "") +
    "Show this QR to the staff when checking in at the venue.";
  if (justRegistered) downloadQr(p);
}

async function downloadQr(p) {
  const url = qrImageUrl(p.qrToken);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("fetch failed");
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objUrl;
    a.download = `QR-${p.id}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objUrl);
  } catch (e) {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

el("regForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  el("duplicateBanner").classList.remove("show");
  const fields = validate();
  if (!fields) return;

  const btn = el("submitBtn");
  btn.disabled = true;
  btn.textContent = "Processing…";

  try {
    const res = await fetch(`${API_BASE}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });

    if (res.status === 409) {
      const data = await res.json();
      el("duplicateBanner").classList.add("show");
      renderTicket(data.participant, false);
      return;
    }
    if (res.status === 423) {
      // registration closed between page load and submit (race condition)
      const data = await res.json();
      el("regForm").classList.add("hidden");
      showClosed(data);
      return;
    }
    if (!res.ok) throw new Error("register failed");

    const data = await res.json();
    renderTicket(data.participant, true);
  } catch (e) {
    alert("Something went wrong while submitting your registration. Please try again.\n\n(Backend not connected yet — see jfs-api-reference.md)");
    console.error(e);
  } finally {
    btn.disabled = false;
    btn.textContent = "Register Now →";
  }
});

el("downloadBtn").addEventListener("click", () => currentTicket && downloadQr(currentTicket));
el("againBtn").addEventListener("click", () => {
  currentTicket = null;
  el("regForm").reset();
  el("duplicateBanner").classList.remove("show");
  el("ticketWrap").classList.add("hidden");
  el("regForm").classList.remove("hidden");
});

checkStatus();
