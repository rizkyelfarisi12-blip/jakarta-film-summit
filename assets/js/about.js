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

    const visibleLimit = 12;
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
  const directory = document.getElementById("partnerDirectory");
  const presenting = document.getElementById("presentingPartners");

  if (!directory) {
    console.error("partnerDirectory tidak ditemukan");
    return;
  }

  try {
    const response = await fetch(
      "assets/data/partners.json",
      {
        cache: "no-store"
      }
    );

    if (!response.ok) {
      throw new Error(
        "partners.json gagal dimuat. Status: " + response.status
      );
    }

    const data = await response.json();

    console.log("PARTNERS DATA:", data);

    /* Presenting Partner */
    renderPresentingPartner(
      presenting,
      data.presenting || []
    );

    /* Semua kategori */
    renderPartnerCategories(
      directory,
      data.categories || []
    );

  } catch (error) {

    console.error("PARTNERS ERROR:", error);

    directory.innerHTML = `
      <div class="data-error">
        <strong>Data partner belum dapat dimuat.</strong>
        <br>
        <small>${escapeHTML(error.message)}</small>
      </div>
    `;
  }
}


/* =====================================================
   PRESENTING PARTNER
===================================================== */

function renderPresentingPartner(container, partners) {

  if (!container) return;

  container.innerHTML = "";

  if (!partners.length) {
    container.innerHTML = `
      <span class="wordmark">
        Presenting Partner
      </span>
    `;
    return;
  }

  const partner = partners[0];

  if (partner.logo) {

    const img = document.createElement("img");

    img.src = partner.logo;
    img.alt = partner.name || "Presenting Partner";
    img.loading = "lazy";

    container.appendChild(img);

  } else {

    const text = document.createElement("span");

    text.className = "wordmark";
    text.textContent = partner.name || "";

    container.appendChild(text);
  }
}


/* =====================================================
   RENDER CATEGORY
===================================================== */

function renderPartnerCategories(container, categories) {

  container.innerHTML = "";

  console.log("JUMLAH KATEGORI:", categories.length);

  if (!categories.length) {

    container.innerHTML = `
      <div class="data-error">
        Belum ada kategori partner.
      </div>
    `;

    return;
  }


  categories.forEach(function (category, index) {

    const element = document.createElement("article");

    element.className = "partner-category";


    /*
     * 4 kategori pertama ditampilkan.
     * Sisanya disembunyikan.
     */

    if (index >= 4) {
      element.classList.add("is-hidden");
    }


    element.innerHTML = `
      <div class="partner-category-inner">

        <div class="partner-category-info">

          <h3 class="partner-category-title">
            ${escapeHTML(category.title)}
          </h3>

          <p class="partner-category-description">
            ${escapeHTML(category.description || "")}
          </p>

        </div>


        <div class="partner-carousel">

          <button
            class="partner-arrow prev"
            type="button"
            aria-label="Partner sebelumnya">
            ←
          </button>


          <div class="partner-viewport">

            <div class="partner-track"></div>

          </div>


          <button
            class="partner-arrow next"
            type="button"
            aria-label="Partner berikutnya">
            →
          </button>


          <div class="partner-dots"></div>

        </div>

      </div>
    `;


    container.appendChild(element);


    initPartnerCarousel(
      element,
      category.partners || []
    );

  });


  initPartnerExpand(categories.length);
}


/* =====================================================
   CAROUSEL
===================================================== */

function initPartnerCarousel(element, partners) {

  const track =
    element.querySelector(".partner-track");

  const prev =
    element.querySelector(".partner-arrow.prev");

  const next =
    element.querySelector(".partner-arrow.next");

  const dots =
    element.querySelector(".partner-dots");


  if (!track) return;


  /*
   * Desktop:
   * 6 logo per halaman
   *
   * Mobile:
   * 4 logo per halaman
   */

  const itemsPerPage =
    window.innerWidth <= 700 ? 4 : 6;


  const pages = [];


  for (
    let i = 0;
    i < partners.length;
    i += itemsPerPage
  ) {

    pages.push(
      partners.slice(
        i,
        i + itemsPerPage
      )
    );

  }


  let currentPage = 0;


  /*
   * Buat halaman
   */

  pages.forEach(function (page) {

    const pageElement =
      document.createElement("div");

    pageElement.className =
      "partner-page";


    page.forEach(function (partner) {

      const item =
        document.createElement("div");

      item.className =
        "partner-logo";


      if (partner.logo) {

        const img =
          document.createElement("img");

        img.src = partner.logo;

        img.alt =
          partner.name || "Partner";

        img.loading = "lazy";

        item.appendChild(img);

      } else {

        const text =
          document.createElement("span");

        text.className =
          "wordmark";

        text.textContent =
          partner.name || "";

        item.appendChild(text);

      }


      pageElement.appendChild(item);

    });


    track.appendChild(pageElement);

  });


  /*
   * Kalau cuma satu halaman,
   * tidak perlu tombol/dots.
   */

  if (pages.length <= 1) {

    prev.style.display = "none";
    next.style.display = "none";
    dots.style.display = "none";

    return;
  }


  /*
   * Buat dots
   */

  pages.forEach(function (_, index) {

    const dot =
      document.createElement("button");

    dot.type = "button";

    dot.className =
      "partner-dot";

    dot.setAttribute(
      "aria-label",
      "Halaman " + (index + 1)
    );


    dot.addEventListener(
      "click",
      function () {

        currentPage = index;

        update();

      }
    );


    dots.appendChild(dot);

  });


  function update() {

    track.style.transform =
      "translateX(-" +
      (currentPage * 100) +
      "%)";


    prev.disabled =
      currentPage === 0;

    next.disabled =
      currentPage === pages.length - 1;


    dots
      .querySelectorAll(".partner-dot")
      .forEach(function (dot, index) {

        dot.classList.toggle(
          "active",
          index === currentPage
        );

      });

  }


  prev.addEventListener(
    "click",
    function () {

      if (currentPage > 0) {

        currentPage--;

        update();

      }

    }
  );


  next.addEventListener(
    "click",
    function () {

      if (
        currentPage <
        pages.length - 1
      ) {

        currentPage++;

        update();

      }

    }
  );


  update();
}


/* =====================================================
   SHOW ALL CATEGORIES
===================================================== */

function initPartnerExpand(categoryCount) {

  const button =
    document.getElementById("partnerExpand");

  const directory =
    document.getElementById("partnerDirectory");


  if (!button || !directory) return;


  if (categoryCount <= 4) {

    button.style.display = "none";

    return;

  }


  let expanded = false;


  button.addEventListener(
    "click",
    function () {

      expanded = !expanded;


      directory
        .querySelectorAll(".partner-category")
        .forEach(function (category, index) {

          if (index >= 4) {

            category.classList.toggle(
              "is-hidden",
              !expanded
            );

          }

        });


      button.innerHTML =
        expanded
          ? `
            Sembunyikan Mitra
            <span aria-hidden="true">↑</span>
          `
          : `
            Lihat Semua Mitra
            <span aria-hidden="true">→</span>
          `;

    }
  );
}


/* =====================================================
   ESCAPE HTML
===================================================== */

function escapeHTML(value) {

  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}