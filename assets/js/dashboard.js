/* Expected endpoint (see jfs-api-reference.md):
 *   GET /api/participants -> [ { id, nama, email, negara, peran, kehadiran, waktu_checkin, ... } ] */
const API_BASE = "/api";
const POLL_MS = 5000;

function el(id) { return document.getElementById(id); }
function timeShort(iso) { return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }); }

let participants = [];
let donutChart = null;
let timelineChart = null;

async function fetchData() {
  try {
    const res = await fetch(`${API_BASE}/participants`);
    participants = res.ok ? await res.json() : [];
  } catch (e) {
    console.warn("Could not reach API — showing empty state.", e);
    participants = [];
  }
  el("syncLabel").textContent = "Sync " + timeShort(new Date().toISOString());
  render();
}

function render() {
  const total = participants.length;
  const hadir = participants.filter((p) => p.kehadiran).length;
  const miss = total - hadir;
  const rate = total ? Math.round((hadir / total) * 100) : 0;

  el("valTotal").textContent = total;
  el("valHadir").textContent = hadir;
  el("valMiss").textContent = miss;
  el("subHadir").textContent = total ? `${rate}% dari total terdaftar` : "Belum ada data";
  el("subMiss").textContent = total ? `${100 - rate}% belum melakukan absen` : "Belum ada data";

  renderDonut(total, hadir, miss, rate);
  renderTimeline(participants);
  renderInstitusi(participants);
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

function renderInstitusi(list) {
  const map = {};
  list.forEach((p) => {
    const key = p.negara || "Tidak diketahui";
    if (!map[key]) map[key] = { negara: key, total: 0, hadir: 0 };
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
      <thead><tr><th>Negara</th><th>Terdaftar</th><th>Sudah Absen</th><th style="width:100px;">Proporsi</th></tr></thead>
      <tbody>
        ${rows.map((r) => `
          <tr>
            <td style="font-weight:500;">${r.negara}</td>
            <td>${r.total}</td>
            <td>${r.hadir}</td>
            <td><div class="inst-bar-wrap"><div class="inst-bar" style="width:${r.total ? (r.hadir / r.total) * 100 : 0}%"></div></div></td>
          </tr>`).join("")}
      </tbody>
    </table>`;
}

el("refreshBtn").addEventListener("click", fetchData);
fetchData();
setInterval(fetchData, POLL_MS);
