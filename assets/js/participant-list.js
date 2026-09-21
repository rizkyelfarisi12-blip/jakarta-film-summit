/* Expected endpoint (see jfs-api-reference.md):
 *   GET /api/participants -> [ {id, nama, email, telp, negara, peran, kehadiran, waktu_checkin, ...} ] */
const API_BASE = "/api";

function el(id) { return document.getElementById(id); }
function timeFull(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

let participants = [];
let statusFilter = "all";
let countryFilter = "all";

async function fetchData() {
  try {
    const res = await fetch(`${API_BASE}/participants`);
    participants = res.ok ? await res.json() : [];
  } catch (e) {
    console.warn("Could not reach API — showing empty state.", e);
    participants = [];
  }
  populateCountryFilter();
  render();
}

function populateCountryFilter() {
  const select = el("countryFilter");
  const current = select.value;
  const countries = Array.from(new Set(participants.map((p) => p.negara || "Tidak diketahui"))).sort();
  select.innerHTML = `<option value="all">Semua Negara</option>` + countries.map((c) => `<option value="${c}">${c}</option>`).join("");
  select.value = countries.includes(current) ? current : "all";
}

function getFiltered() {
  const q = el("searchInput").value.trim().toLowerCase();
  return participants
    .filter((p) => (statusFilter === "in" ? p.kehadiran : statusFilter === "out" ? !p.kehadiran : true))
    .filter((p) => (countryFilter === "all" ? true : (p.negara || "Tidak diketahui") === countryFilter))
    .filter((p) => !q ||
      p.nama.toLowerCase().includes(q) || p.email.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q) || (p.negara || "").toLowerCase().includes(q))
    .sort((a, b) => a.nama.localeCompare(b.nama));
}

function render() {
  const filtered = getFiltered();
  el("metaLabel").textContent = `Menampilkan ${filtered.length} dari ${participants.length} peserta`;
  el("emptyState").classList.toggle("hidden", filtered.length !== 0);

  el("tableBody").innerHTML = filtered.map((p, i) => `
    <tr>
      <td class="sub">${i + 1}</td>
      <td><div class="name-cell">${p.nama}</div><div class="sub">${p.email}</div></td>
      <td class="sub">${p.telp || "—"}</td>
      <td>${p.negara || "—"}</td>
      <td>${p.peran || "—"}</td>
      <td class="mono sub">${p.id}</td>
      <td><span class="badge ${p.kehadiran ? "in" : "out"}">${p.kehadiran ? "Hadir" : "Belum Hadir"}</span></td>
      <td>${p.waktu_checkin ? timeFull(p.waktu_checkin) : "—"}</td>
    </tr>`).join("");

  el("printDate").textContent = "Dicetak " + new Date().toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" });
  el("printStats").innerHTML = `
    <div>Total ditampilkan: ${filtered.length} dari ${participants.length} peserta</div>
    <div>Sudah absen: ${filtered.filter((p) => p.kehadiran).length}</div>`;
}

document.querySelectorAll(".filter-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    statusFilter = btn.dataset.status;
    render();
  });
});
el("countryFilter").addEventListener("change", (e) => { countryFilter = e.target.value; render(); });
el("searchInput").addEventListener("input", render);
el("refreshBtn").addEventListener("click", fetchData);
el("exportPdfBtn").addEventListener("click", () => window.print());

fetchData();
