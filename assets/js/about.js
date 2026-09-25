document.addEventListener("DOMContentLoaded", function () {
  initSpeakers();
  initPartners();
});


/* =======================================================
   SPEAKERS
   ======================================================= */

async function initSpeakers() {
  const grid = document.getElementById("speakerGrid");
  const moreWrap = document.getElementById("speakersMore");
  const toggle = document.getElementById("speakerToggle");

  if (!grid) return;

  try {
    const response = await fetch("assets/data/speakers.json", {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("Gagal mengambil speakers.json");
    }

    const speakers = await response.json();

    const visibleLimit = 6;
    let expanded = false;

    function renderSpeakers() {
      grid.innerHTML = "";

      const visibleSpeakers = expanded
        ? speakers
        : speakers.slice(0, visibleLimit);

      visibleSpeakers.forEach(function (speaker, index) {
        const card = document.createElement("article");

        card.className = "speaker-card dynamic-speaker";

        card.innerHTML = `
          <div class="speaker-avatar">
            ${
              speaker.image
                ? `<img
                    src="${escapeHTML(speaker.image)}"
                    alt="${escapeHTML(speaker.name)}"
                    loading="lazy"
                  >`
                : `
                  <div class="speaker-placeholder" aria-hidden="true">
                    <span>JFS</span>
                  </div>
                `
            }
          </div>

          <div class="speaker-info">
            <h4>${escapeHTML(speaker.name)}</h4>
            <div class="speaker-role">
              ${escapeHTML(speaker.role)}
            </div>
            <div class="speaker-co">
              ${escapeHTML(speaker.company)}
            </div>
          </div>
        `;

        grid.appendChild(card);

        requestAnimationFrame(function () {
          card.classList.add("speaker-visible");
        });
      });

      if (speakers.length > visibleLimit) {
        moreWrap.style.display = "block";

        toggle.innerHTML = expanded
          ? `Sembunyikan Pembicara <span aria-hidden="true">↑</span>`
          : `Lihat Semua Pembicara <span aria-hidden="true">→</span>`;
      } else {
        moreWrap.style.display = "none";
      }
    }

    toggle.addEventListener("click", function () {
      expanded = !expanded;

      renderSpeakers();

      if (expanded) {
        setTimeout(function () {
          const firstExtraSpeaker = grid.children[visibleLimit];

          if (firstExtraSpeaker) {
            firstExtraSpeaker.scrollIntoView({
              behavior: "smooth",
              block: "center"
            });
          }
        }, 80);
      }
    });

    renderSpeakers();

  } catch (error) {
    console.error(error);

    grid.innerHTML = `
      <p class="data-error">
        Data pembicara belum dapat dimuat.
      </p>
    `;

    moreWrap.style.display = "none";
  }
}


/* =======================================================
   PARTNERS
   ======================================================= */

async function initPartners() {
  try {
    const response = await fetch("assets/data/partners.json", {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("Gagal mengambil partners.json");
    }

    const partners = await response.json();

    renderPresentingPartners(partners.presenting || []);
    renderPartnerGrid(
      document.getElementById("strategicPartners"),
      partners.strategic || []
    );

    renderPartnerGrid(
      document.getElementById("mediaPartners"),
      partners.media || []
    );

  } catch (error) {
    console.error(error);

    const container = document.getElementById("partnersData");

    if (container) {
      container.innerHTML = `
        <p class="data-error">
          Data partner belum dapat dimuat.
        </p>
      `;
    }
  }
}


function renderPresentingPartners(partners) {
  const container = document.getElementById("presentingPartners");

  if (!container) return;

  container.innerHTML = "";

  partners.forEach(function (partner) {
    const item = document.createElement("div");

    item.className = "partner-feature-item";

    item.innerHTML = partner.logo
      ? `
        <img
          src="${escapeHTML(partner.logo)}"
          alt="${escapeHTML(partner.name)}"
          loading="lazy"
        >
      `
      : `
        <span class="wordmark">
          ${escapeHTML(partner.name)}
        </span>
      `;

    container.appendChild(item);
  });
}


function renderPartnerGrid(container, partners) {
  if (!container) return;

  container.innerHTML = "";

  partners.forEach(function (partner) {
    const item = document.createElement("div");

    item.className = "partner-badge";

    item.innerHTML = partner.logo
      ? `
        <img
          src="${escapeHTML(partner.logo)}"
          alt="${escapeHTML(partner.name)}"
          loading="lazy"
        >
      `
      : `
        <span class="wordmark">
          ${escapeHTML(partner.name)}
        </span>
      `;

    container.appendChild(item);
  });
}


/* =======================================================
   SIMPLE HTML ESCAPE
   ======================================================= */

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}