/* =======================================================
   Jakarta Film Summit — Agenda page behaviour
   Requires: common.js, include.js
   ======================================================= */
(() => {
  "use strict";

  const FALLBACK_IMG = "assets/icon/jfs_logo_black.png";
  const BIO_FALLBACK = "Profil singkat pembicara akan segera diperbarui.";

  const state = {
    agenda: null,
    speakers: [],
    currentDay: "day-1",
    lastTrigger: null,
  };

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

  /* ---------- data ---------- */

  async function load(url) {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error(url + " (" + r.status + ")");
    return r.json();
  }

  // Terima dua format data:
  //   agenda.json  -> { id, name, position, institution, photo, bio }
  //   speakers.json -> { name, role, company, image }
  // Kalau id tidak ada, dibuat urut: speaker-001, speaker-002, ...
  // (sama dengan id yang dipakai di agenda.json > sessions > speakers)
  function normalizeSpeaker(s, i) {
    return {
      id: String(s.id ?? "speaker-" + String(i + 1).padStart(3, "0")),
      name: s.name || "",
      position: s.position || s.role || "",
      institution: s.institution || s.company || "",
      photo: s.photo || s.image || "",
      bio: s.bio || "",
    };
  }

  function pickSpeakers(speakerData, agenda) {
    const list = Array.isArray(speakerData)
      ? speakerData
      : Array.isArray(speakerData?.speakers)
        ? speakerData.speakers
        : Array.isArray(agenda?.speakers)
          ? agenda.speakers
          : [];
    return list.map(normalizeSpeaker);
  }

  const byId = (id) => state.speakers.find((s) => s.id === String(id));
  const photoOf = (s) => s?.photo || FALLBACK_IMG;

  // Semua sesi (bukan break) yang diisi pembicara ini
  function sessionsOf(speakerId) {
    const out = [];
    (state.agenda?.days || []).forEach((day) => {
      (day.sessions || []).forEach((s) => {
        if (s.kind === "break") return;
        if ((s.speakers || []).map(String).includes(String(speakerId))) {
          out.push({
            day: day.label || day.title || "",
            date: day.date || "",
            time: s.time || "",
            title: s.title || "",
          });
        }
      });
    });
    return out;
  }

  /* ---------- init ---------- */

  async function init() {
    try {
      const [agenda, speakerData] = await Promise.all([
        load("assets/data/agenda.json"),
        load("assets/data/speakers.json").catch(() => null),
      ]);
      state.agenda = agenda;
      state.speakers = pickSpeakers(speakerData, agenda);

      bindDays();
      bindSpeakerClicks();
      bindModal();
      renderDay();
      renderSpeakers();
    } catch (e) {
      console.error(e);
      $("#agendaPanels").innerHTML =
        '<div class="agenda-empty">Agenda belum dapat dimuat. Pastikan assets/data/agenda.json tersedia.</div>';
    }
  }

  /* ---------- agenda ---------- */

  function bindDays() {
    $$(".day-button").forEach((b) =>
      b.addEventListener("click", () => {
        state.currentDay = b.dataset.day;
        $$(".day-button").forEach((x) => x.classList.toggle("active", x === b));
        renderDay();
      }),
    );
  }

  function renderDay() {
    const day = state.agenda?.days?.find((x) => x.id === state.currentDay);
    const box = $("#agendaPanels");

    if (!day) {
      box.innerHTML =
        '<div class="agenda-empty">Agenda untuk hari ini belum tersedia.</div>';
      return;
    }

    box.innerHTML = `
      <div class="agenda-day-header">
        <h3 class="agenda-day-title">${esc(day.title || day.label || "Day")}</h3>
        <div class="agenda-day-date">${esc(day.date || "")}</div>
      </div>
      <div class="timeline">${(day.sessions || []).map(sessionHtml).join("")}</div>`;
  }

  function sessionHtml(s) {
    if (s.kind === "break") {
      return `<div class="break-row">${esc(s.time || "")} &nbsp;·&nbsp; ${esc(s.title || "Break")}</div>`;
    }

    const speakers = (s.speakers || []).map(byId).filter(Boolean);

    return `
      <article class="session">
        <div class="session-time">${esc(s.time || "")}</div>
        <div class="session-meta">
          <span class="session-type">${esc(s.type || "Session")}</span>
          ${s.room ? `<span class="session-room">${esc(s.room)}</span>` : ""}
        </div>
        <h4 class="session-title">${esc(s.title || "")}</h4>
        ${s.description ? `<p class="session-description">${esc(s.description)}</p>` : ""}
        ${
          speakers.length
            ? `<div class="session-speakers">${speakers
                .map(
                  (sp) => `
              <button class="session-speaker" type="button" data-speaker="${esc(sp.id)}">
                <img src="${esc(photoOf(sp))}" alt="" loading="lazy">
                <span>${esc(sp.name)}</span>
              </button>`,
                )
                .join("")}</div>`
            : ""
        }
      </article>`;
  }

  /* ---------- speakers ---------- */

  function renderSpeakers() {
    const grid = $("#speakerGrid");
    $("#speakerCount").textContent = state.speakers.length + " pembicara";

    if (!state.speakers.length) {
      grid.innerHTML =
        '<div class="agenda-empty">Belum ada data pembicara.</div>';
      return;
    }

    grid.innerHTML = state.speakers
      .map(
        (s) => `
      <button class="speaker-card" type="button" data-speaker="${esc(s.id)}"
        aria-label="Lihat profil ${esc(s.name)}">
        <div class="speaker-photo">
          <img src="${esc(photoOf(s))}" alt="${esc(s.name)}" loading="lazy">
        </div>
        <div class="speaker-info">
          <h3 class="speaker-name">${esc(s.name)}</h3>
          <p class="speaker-role">${esc(s.position)}${s.institution ? " · " + esc(s.institution) : ""}</p>
          <span class="speaker-tag">Lihat profil</span>
        </div>
      </button>`,
      )
      .join("");
  }

  // Satu listener untuk semua tombol pembicara (kartu di grid + chip di sesi),
  // jadi tetap jalan walau agenda dirender ulang saat ganti hari.
  function bindSpeakerClicks() {
    document.addEventListener("click", (e) => {
      const trigger = e.target.closest("[data-speaker]");
      if (!trigger) return;
      openSpeaker(trigger.dataset.speaker, trigger);
    });
  }

  /* ---------- modal ---------- */

  function openSpeaker(id, trigger) {
    const s = byId(id);
    if (!s) {
      console.warn("Pembicara tidak ditemukan:", id);
      return;
    }
    state.lastTrigger = trigger || null;

    const photo = $("#speakerModalPhoto");
    photo.onerror = () => {
      photo.onerror = null;
      photo.src = FALLBACK_IMG;
    };
    photo.src = photoOf(s);
    photo.alt = s.name || "Speaker";

    $("#speakerModalName").textContent = s.name;
    $("#speakerModalRole").textContent = [s.position, s.institution]
      .filter(Boolean)
      .join(" · ");
    $("#speakerModalBio").textContent = s.bio || BIO_FALLBACK;

    // daftar sesi
    const sessions = sessionsOf(s.id);
    const wrap = $("#speakerModalSessionsWrap");
    wrap.hidden = sessions.length === 0;
    $("#speakerModalSessions").innerHTML = sessions
      .map(
        (x) =>
          `<li><strong>${esc(x.title)}</strong><span>${esc(x.day)} · ${esc(x.time)}</span></li>`,
      )
      .join("");

    const modal = $("#speakerModal");
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    $(".modal-close", modal).focus();
  }

  function closeSpeaker() {
    const modal = $("#speakerModal");
    if (!modal.classList.contains("open")) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    state.lastTrigger?.focus?.();
  }

  function bindModal() {
    $$("[data-close-modal]").forEach((x) =>
      x.addEventListener("click", closeSpeaker),
    );
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeSpeaker();
    });
  }

  init();
})();