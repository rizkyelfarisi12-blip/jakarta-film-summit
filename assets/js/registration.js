/* ============================================================
 * CONFIG — point this to your real backend.
 * Expected endpoints (see jfs-api-reference.md):
 *   GET  /api/status    -> { open, reason, quota, deadline, total }
 *   POST /api/register  -> { participant } (201) or 409/423 with details
 * ============================================================ */
const API_BASE = "api";

function qrImageUrl(token) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=600x600&ecc=Q&margin=0&qzone=4&data=${encodeURIComponent(token)}`;
}

// =================================================================
// i18n — [id, en] country pairs + full text dictionary
// =================================================================
const COUNTRIES = [
  ["Indonesia", "Indonesia"],
  ["Malaysia", "Malaysia"],
  ["Singapura", "Singapore"],
  ["Thailand", "Thailand"],
  ["Filipina", "Philippines"],
  ["Vietnam", "Vietnam"],
  ["Brunei Darussalam", "Brunei Darussalam"],
  ["Kamboja", "Cambodia"],
  ["Laos", "Laos"],
  ["Myanmar", "Myanmar"],
  ["Timor Leste", "Timor-Leste"],
  ["Jepang", "Japan"],
  ["Korea Selatan", "South Korea"],
  ["Korea Utara", "North Korea"],
  ["Tiongkok", "China"],
  ["Hong Kong", "Hong Kong"],
  ["Makau", "Macau"],
  ["Taiwan", "Taiwan"],
  ["India", "India"],
  ["Pakistan", "Pakistan"],
  ["Bangladesh", "Bangladesh"],
  ["Sri Lanka", "Sri Lanka"],
  ["Nepal", "Nepal"],
  ["Bhutan", "Bhutan"],
  ["Maladewa", "Maldives"],
  ["Afghanistan", "Afghanistan"],
  ["Iran", "Iran"],
  ["Irak", "Iraq"],
  ["Arab Saudi", "Saudi Arabia"],
  ["Uni Emirat Arab", "United Arab Emirates"],
  ["Qatar", "Qatar"],
  ["Kuwait", "Kuwait"],
  ["Bahrain", "Bahrain"],
  ["Oman", "Oman"],
  ["Yordania", "Jordan"],
  ["Lebanon", "Lebanon"],
  ["Israel", "Israel"],
  ["Palestina", "Palestine"],
  ["Turki", "Turkey"],
  ["Siprus", "Cyprus"],
  ["Suriah", "Syria"],
  ["Yaman", "Yemen"],
  ["Kazakhstan", "Kazakhstan"],
  ["Uzbekistan", "Uzbekistan"],
  ["Turkmenistan", "Turkmenistan"],
  ["Kirgistan", "Kyrgyzstan"],
  ["Tajikistan", "Tajikistan"],
  ["Mongolia", "Mongolia"],
  ["Amerika Serikat", "United States"],
  ["Kanada", "Canada"],
  ["Meksiko", "Mexico"],
  ["Brasil", "Brazil"],
  ["Argentina", "Argentina"],
  ["Chile", "Chile"],
  ["Kolombia", "Colombia"],
  ["Peru", "Peru"],
  ["Venezuela", "Venezuela"],
  ["Ekuador", "Ecuador"],
  ["Bolivia", "Bolivia"],
  ["Paraguay", "Paraguay"],
  ["Uruguay", "Uruguay"],
  ["Guyana", "Guyana"],
  ["Suriname", "Suriname"],
  ["Kuba", "Cuba"],
  ["Republik Dominika", "Dominican Republic"],
  ["Haiti", "Haiti"],
  ["Jamaika", "Jamaica"],
  ["Bahama", "Bahamas"],
  ["Trinidad dan Tobago", "Trinidad and Tobago"],
  ["Barbados", "Barbados"],
  ["Panama", "Panama"],
  ["Kosta Rika", "Costa Rica"],
  ["Guatemala", "Guatemala"],
  ["Honduras", "Honduras"],
  ["El Salvador", "El Salvador"],
  ["Nikaragua", "Nicaragua"],
  ["Belize", "Belize"],
  ["Britania Raya", "United Kingdom"],
  ["Irlandia", "Ireland"],
  ["Prancis", "France"],
  ["Jerman", "Germany"],
  ["Belanda", "Netherlands"],
  ["Belgia", "Belgium"],
  ["Luksemburg", "Luxembourg"],
  ["Swiss", "Switzerland"],
  ["Austria", "Austria"],
  ["Italia", "Italy"],
  ["Spanyol", "Spain"],
  ["Portugal", "Portugal"],
  ["Yunani", "Greece"],
  ["Polandia", "Poland"],
  ["Republik Ceko", "Czech Republic"],
  ["Slowakia", "Slovakia"],
  ["Hungaria", "Hungary"],
  ["Rumania", "Romania"],
  ["Bulgaria", "Bulgaria"],
  ["Kroasia", "Croatia"],
  ["Serbia", "Serbia"],
  ["Bosnia dan Herzegovina", "Bosnia and Herzegovina"],
  ["Slovenia", "Slovenia"],
  ["Montenegro", "Montenegro"],
  ["Makedonia Utara", "North Macedonia"],
  ["Albania", "Albania"],
  ["Kosovo", "Kosovo"],
  ["Ukraina", "Ukraine"],
  ["Belarus", "Belarus"],
  ["Rusia", "Russia"],
  ["Moldova", "Moldova"],
  ["Lituania", "Lithuania"],
  ["Latvia", "Latvia"],
  ["Estonia", "Estonia"],
  ["Swedia", "Sweden"],
  ["Norwegia", "Norway"],
  ["Denmark", "Denmark"],
  ["Finlandia", "Finland"],
  ["Islandia", "Iceland"],
  ["Malta", "Malta"],
  ["Andorra", "Andorra"],
  ["Monako", "Monaco"],
  ["San Marino", "San Marino"],
  ["Liechtenstein", "Liechtenstein"],
  ["Vatikan", "Vatican City"],
  ["Australia", "Australia"],
  ["Selandia Baru", "New Zealand"],
  ["Papua Nugini", "Papua New Guinea"],
  ["Fiji", "Fiji"],
  ["Samoa", "Samoa"],
  ["Tonga", "Tonga"],
  ["Vanuatu", "Vanuatu"],
  ["Kepulauan Solomon", "Solomon Islands"],
  ["Kiribati", "Kiribati"],
  ["Palau", "Palau"],
  ["Mikronesia", "Micronesia"],
  ["Kepulauan Marshall", "Marshall Islands"],
  ["Tuvalu", "Tuvalu"],
  ["Nauru", "Nauru"],
  ["Mesir", "Egypt"],
  ["Afrika Selatan", "South Africa"],
  ["Nigeria", "Nigeria"],
  ["Kenya", "Kenya"],
  ["Maroko", "Morocco"],
  ["Aljazair", "Algeria"],
  ["Tunisia", "Tunisia"],
  ["Libya", "Libya"],
  ["Ethiopia", "Ethiopia"],
  ["Ghana", "Ghana"],
  ["Tanzania", "Tanzania"],
  ["Uganda", "Uganda"],
  ["Senegal", "Senegal"],
  ["Kamerun", "Cameroon"],
  ["Pantai Gading", "Ivory Coast"],
  ["Zimbabwe", "Zimbabwe"],
  ["Zambia", "Zambia"],
  ["Mozambik", "Mozambique"],
  ["Angola", "Angola"],
  ["Sudan", "Sudan"],
  ["Sudan Selatan", "South Sudan"],
  ["Rwanda", "Rwanda"],
  ["Burundi", "Burundi"],
  ["Somalia", "Somalia"],
  ["Djibouti", "Djibouti"],
  ["Eritrea", "Eritrea"],
  ["Chad", "Chad"],
  ["Niger", "Niger"],
  ["Mali", "Mali"],
  ["Burkina Faso", "Burkina Faso"],
  ["Guinea", "Guinea"],
  ["Guinea-Bissau", "Guinea-Bissau"],
  ["Guinea Khatulistiwa", "Equatorial Guinea"],
  ["Sierra Leone", "Sierra Leone"],
  ["Liberia", "Liberia"],
  ["Togo", "Togo"],
  ["Benin", "Benin"],
  ["Gabon", "Gabon"],
  ["Kongo", "Republic of the Congo"],
  ["Republik Demokratik Kongo", "Democratic Republic of the Congo"],
  ["Republik Afrika Tengah", "Central African Republic"],
  ["Gambia", "Gambia"],
  ["Mauritania", "Mauritania"],
  ["Lesotho", "Lesotho"],
  ["Eswatini", "Eswatini"],
  ["Namibia", "Namibia"],
  ["Botswana", "Botswana"],
  ["Malawi", "Malawi"],
  ["Madagaskar", "Madagascar"],
  ["Mauritius", "Mauritius"],
  ["Seychelles", "Seychelles"],
  ["Komoro", "Comoros"],
  ["Tanjung Verde", "Cape Verde"],
  ["Sao Tome dan Principe", "Sao Tome and Principe"],
];

const I18N = {
  id: {
    "meta.title": "Jakarta Film Summit — Formulir Pendaftaran",
    "hero.headline": "Daftarkan diri Anda ke layar utama industri film.",
    "hero.lead":
      "Satu formulir untuk bergabung bersama produser, investor, distributor, dan penggerak film di Jakarta Film Summit.",
    "hero.sub": "Empat bagian singkat · sekitar 3 menit untuk diselesaikan",
    "stepnav.s1": "Informasi Diri",
    "stepnav.s2": "Perusahaan & Keterlibatan",
    "stepnav.s3": "Persetujuan",
    "stepnav.days": "Pilih Hari",
    "days.title": "Pilih Hari Kehadiran",
    "days.desc":
      "Pilih satu atau lebih hari yang ingin Anda hadiri. Pilihan tidak bisa diubah sendiri setelah mendaftar; hubungi panitia jika perlu mengubahnya.",
    "days.day": "Hari",
    "days.selectAll": "Pilih semua hari",
    "days.clear": "Hapus pilihan",
    "days.summary": "Anda mendaftar untuk:",
    "days.summary.none": "Belum ada hari yang dipilih.",
    "days.error": "Pilih minimal satu hari untuk dihadiri.",
    "day1.desc":
      "Pembukaan resmi dan diskusi kebijakan: bagaimana pemerintah dan regulasi mendukung produksi film.",
    "day2.desc":
      "Fokus pada investasi dan pembiayaan: akses modal, struktur pendanaan, dan ekosistem produksi Jakarta.",
    "day3.desc":
      "Inovasi industri layar dan forum film commission global, ditutup dengan langkah berikutnya.",
    "error.required":
      "Beberapa bagian wajib diisi terlebih dahulu — periksa kembali kolom yang ditandai.",
    "error.server": "Terjadi kesalahan saat mengirim pendaftaran. Coba lagi.",
    "s1.title": "Informasi Diri",
    "s1.desc": "Data kontak utama untuk konfirmasi pendaftaran Anda.",
    "field.fullname.label": "Nama Lengkap",
    "field.fullname.placeholder": "cth. Amara Wibowo",
    "field.email.label": "Email",
    "field.email.placeholder": "nama@perusahaan.com",
    "field.phone.label": "Nomor Telepon / WhatsApp",
    "field.phone.placeholder": "+62 8xx xxxx xxxx",
    "field.phone.hint": "(opsional)",
    "field.country.label": "Negara Asal",
    "field.country.placeholder": "Cari negara…",
    "s2.title": "Perusahaan & Keterlibatan",
    "s2.desc":
      "Semua kolom di bagian ini opsional — isi jika relevan, supaya kami bisa menyusun sesi dan pertemuan yang lebih sesuai untuk Anda.",
    "field.company.label": "Nama Perusahaan / Organisasi",
    "field.company.placeholder": "cth. Langit Pictures",
    "field.company.hint": "(opsional)",
    "field.jobtitle.label": "Jabatan / Posisi",
    "field.jobtitle.placeholder": "cth. Executive Producer",
    "field.jobtitle.hint": "(opsional)",
    "field.segment.label": "Segment / Peran Pekerjaan",
    "field.segment.hint": "(opsional)",
    "segment.opt1":
      "Produser / EP / Sutradara / Scriptwriter / Distributor / Exhibitor",
    "segment.opt2": "Investor / Financier",
    "segment.opt3": "Film Commission",
    "segment.opt4": "Pelajar / Mahasiswa / Akademisi",
    "segment.opt5": "Pemerintah",
    "segment.opt6": "Lainnya",
    "field.segmentOther.label": "Sebutkan segment Anda",
    "field.segmentOther.placeholder": "Tuliskan peran pekerjaan Anda",
    "field.goals.label": "Tujuan menghadiri Jakarta Film Summit",
    "field.goals.hint": "(boleh lebih dari satu)",
    "goals.opt1": "Networking / Memperluas Jaringan",
    "goals.opt2": "Mengikuti Sesi Panel / Workshop",
    "goals.opt3": "Memasarkan Proyek",
    "goals.opt4": "Mencari Proyek Film untuk Didanai / Didistribusikan",
    "field.access.label": "Kebutuhan Aksesibilitas Khusus",
    "field.access.hint": "(opsional)",
    "field.access.placeholder": "cth. Juru Bahasa Isyarat, akses kursi roda",
    "s3.title": "Persetujuan",
    "s3.desc":
      "Terakhir, setujui syarat dan ketentuan untuk menyelesaikan pendaftaran.",
    "consent.terms.rest1": "Saya menyetujui",
    "consent.terms.link": "Syarat & Ketentuan",
    "consent.terms.rest2": "pendaftaran.",
    "submit.note":
      "Setelah dikirim, tim kami akan mengirimkan konfirmasi dan detail akses ke email bisnis Anda.",
    "submit.button": "Kirim Pendaftaran",
    "submit.sending": "Mengirim…",
    "ticket.heading": "Pendaftaran diterima",
    "ticket.message":
      "Terima kasih — tunjukkan QR di bawah ini saat check-in di lokasi acara.",
    "ticket.heading.duplicate": "Anda sudah terdaftar",
    "ticket.message.duplicate":
      "Email ini sudah pernah mendaftar sebelumnya — ini tiket QR Anda, tidak perlu daftar ulang.",
    "ticket.download": "Unduh QR",
    "ticket.again": "Isi formulir lain",
    "closed.title.quota": "Kuota Penuh",
    "closed.message.quota":
      "Kami sudah mencapai kapasitas penuh untuk Jakarta Film Summit 2026. Terima kasih atas minat Anda — pantau kanal kami untuk info selanjutnya.",
    "closed.title.deadline": "Pendaftaran Ditutup",
    "closed.message.deadline":
      "Periode pendaftaran untuk Jakarta Film Summit 2026 sudah berakhir.",
    "closed.meta.registered": "terdaftar",
    "closed.meta.closedOn": "Ditutup pada",
    "segment.placeholder": "Pilih segment / peran…",
    "goals.placeholder": "Pilih tujuan Anda…",
    "goals.opt5": "Lainnya",
    "field.goalsOther.label": "Sebutkan tujuan Anda",
    "field.goalsOther.placeholder": "Tuliskan tujuan Anda menghadiri acara ini",
    "ticket.qrAlt": "QR tiket masuk",
    "closed.title.manual": "Pendaftaran Ditutup",
    "closed.message.manual":
      "Pendaftaran untuk Jakarta Film Summit 2026 saat ini ditutup oleh panitia.",
    "terms.title": "Syarat & Ketentuan",
    "terms.intro":
      "Berikut ketentuan pendaftaran Jakarta Film Summit 2026. Anda tetap dapat mencentang persetujuan tanpa membuka halaman ini.",
    "terms.h1": "1. Data yang dikumpulkan",
    "terms.p1":
      "Kami mengumpulkan data yang Anda isi pada formulir (nama, email, nomor telepon, negara, perusahaan, jabatan, segment, tujuan kehadiran, dan kebutuhan aksesibilitas) untuk keperluan pendaftaran dan penyelenggaraan acara.",
    "terms.h2": "2. Penggunaan data",
    "terms.p2":
      "Data digunakan untuk memverifikasi pendaftaran, menerbitkan tiket QR, mengelola check-in, menyusun sesi dan pertemuan, serta menghubungi Anda terkait Jakarta Film Summit 2026.",
    "terms.h3": "3. Tiket QR & kehadiran",
    "terms.p3":
      "Tiket QR bersifat pribadi dan hanya berlaku untuk hari yang Anda pilih. Satu email hanya dapat mendaftar satu kali. Mohon tidak membagikan QR Anda kepada orang lain.",
    "terms.h4": "4. Perubahan hari kehadiran",
    "terms.p4":
      "Pilihan hari tidak dapat diubah sendiri setelah pendaftaran. Hubungi panitia jika perlu mengubahnya; perubahan bergantung pada ketersediaan kuota dan tidak dapat dilakukan untuk hari yang sudah check-in.",
    "terms.h5": "5. Kuota & perubahan program",
    "terms.p5":
      "Pendaftaran dapat ditutup jika kuota penuh atau batas waktu berakhir. Panitia berhak menyesuaikan program, pembicara, dan jadwal bila diperlukan.",
    "terms.close": "Tutup",
    "footer.text": "Jakarta Film Summit · Formulir Pendaftaran",
  },
  en: {
    "meta.title": "Jakarta Film Summit — Registration Form",
    "hero.headline": "Register for the main stage of the film industry.",
    "hero.lead":
      "One form to join producers, investors, distributors, and film industry professionals at Jakarta Film Summit.",
    "hero.sub": "Four short sections · about 3 minutes to complete",
    "stepnav.s1": "Personal Info",
    "stepnav.s2": "Company & Involvement",
    "stepnav.s3": "Consent",
    "stepnav.days": "Choose Days",
    "days.title": "Choose Your Days",
    "days.desc":
      "Select one or more days you want to attend. You cannot change your choice after registering; contact the committee if you need to.",
    "days.day": "Day",
    "days.selectAll": "Select all days",
    "days.clear": "Clear selection",
    "days.summary": "You are registering for:",
    "days.summary.none": "No day selected yet.",
    "days.error": "Select at least one day to attend.",
    "day1.desc":
      "Official opening and policy talks on how government and regulation support film production.",
    "day2.desc":
      "Investment and financing: access to capital, funding structures, and Jakarta's production ecosystem.",
    "day3.desc":
      "Screen-economy innovation and the global film commission forum, closing with what comes next.",
    "error.required":
      "Some required sections are missing — please check the highlighted fields.",
    "error.server":
      "Something went wrong while submitting your registration. Please try again.",
    "s1.title": "Personal Info",
    "s1.desc": "Your main contact details for registration confirmation.",
    "field.fullname.label": "Full Name",
    "field.fullname.placeholder": "e.g. Amara Wibowo",
    "field.email.label": "Email",
    "field.email.placeholder": "name@company.com",
    "field.phone.label": "Phone / WhatsApp Number",
    "field.phone.placeholder": "+1 234 567 8900",
    "field.phone.hint": "(optional)",
    "field.country.label": "Country of Origin",
    "field.country.placeholder": "Search country…",
    "s2.title": "Company & Involvement",
    "s2.desc":
      "Every field in this section is optional — fill in what's relevant so we can shape sessions and meetings around you.",
    "field.company.label": "Company / Organization Name",
    "field.company.placeholder": "e.g. Langit Pictures",
    "field.company.hint": "(optional)",
    "field.jobtitle.label": "Job Title / Position",
    "field.jobtitle.placeholder": "e.g. Executive Producer",
    "field.jobtitle.hint": "(optional)",
    "field.segment.label": "Segment / Job Role",
    "field.segment.hint": "(optional)",
    "segment.opt1":
      "Producer / EP / Director / Scriptwriter / Distributor / Exhibitor",
    "segment.opt2": "Investor / Financier",
    "segment.opt3": "Film Commission",
    "segment.opt4": "Student / Academic",
    "segment.opt5": "Government",
    "segment.opt6": "Others",
    "field.segmentOther.label": "Please specify your segment",
    "field.segmentOther.placeholder": "Describe your job role",
    "field.goals.label": "Goals for attending Jakarta Film Summit",
    "field.goals.hint": "(select all that apply)",
    "goals.opt1": "Networking",
    "goals.opt2": "Attending Panels / Workshops",
    "goals.opt3": "Marketing a Project",
    "goals.opt4": "Sourcing Projects to Fund / Distribute",
    "field.access.label": "Accessibility Requirements",
    "field.access.hint": "(optional)",
    "field.access.placeholder":
      "e.g. Sign language interpreter, wheelchair access",
    "s3.title": "Consent",
    "s3.desc":
      "Lastly, agree to the terms and conditions to complete your registration.",
    "consent.terms.rest1": "I agree to the",
    "consent.terms.link": "Terms & Conditions",
    "consent.terms.rest2": "of registration.",
    "submit.note":
      "Once submitted, our team will send a confirmation and access details to your business email.",
    "submit.button": "Submit Registration",
    "submit.sending": "Submitting…",
    "ticket.heading": "Registration received",
    "ticket.message":
      "Thank you — show the QR below when checking in at the venue.",
    "ticket.heading.duplicate": "You're already registered",
    "ticket.message.duplicate":
      "This email has already registered before — here's your QR ticket, no need to register again.",
    "ticket.download": "Download QR",
    "ticket.again": "Fill out another form",
    "closed.title.quota": "Fully Booked",
    "closed.message.quota":
      "We've reached full capacity for Jakarta Film Summit 2026. Thank you for your interest — follow our channels for future updates.",
    "closed.title.deadline": "Registration Closed",
    "closed.message.deadline":
      "The registration period for Jakarta Film Summit 2026 has ended.",
    "closed.meta.registered": "registered",
    "closed.meta.closedOn": "Closed on",
    "segment.placeholder": "Select segment / role…",
    "goals.placeholder": "Select your goals…",
    "goals.opt5": "Others",
    "field.goalsOther.label": "Please specify your goal",
    "field.goalsOther.placeholder": "Describe why you are attending",
    "ticket.qrAlt": "Entry ticket QR code",
    "closed.title.manual": "Registration Closed",
    "closed.message.manual":
      "Registration for Jakarta Film Summit 2026 is currently closed by the organizers.",
    "terms.title": "Terms & Conditions",
    "terms.intro":
      "These are the registration terms for Jakarta Film Summit 2026. You can still tick the agreement box without opening this page.",
    "terms.h1": "1. Data we collect",
    "terms.p1":
      "We collect the details you enter in the form (name, email, phone, country, company, job title, segment, goals for attending, and accessibility needs) for registration and event operations.",
    "terms.h2": "2. How we use your data",
    "terms.p2":
      "Your data is used to verify your registration, issue your QR ticket, manage check-in, shape sessions and meetings, and contact you about Jakarta Film Summit 2026.",
    "terms.h3": "3. QR ticket & attendance",
    "terms.p3":
      "Your QR ticket is personal and valid only for the days you selected. One email can register only once. Please do not share your QR code with others.",
    "terms.h4": "4. Changing your days",
    "terms.p4":
      "You cannot change your days yourself after registering. Contact the committee if you need a change; it depends on available quota and is not possible for days you have already checked in.",
    "terms.h5": "5. Quota & programme changes",
    "terms.p5":
      "Registration may close when quota is full or the deadline passes. The organizers may adjust the programme, speakers, and schedule when necessary.",
    "terms.close": "Close",
    "footer.text": "Jakarta Film Summit · Registration Form",
  },
};

let currentLang = localStorage.getItem("jfs_lang") || "id";
let lastClosedData = null; // re-render on language switch if closed panel is showing
let lastTicketData = null; // { participant, isDuplicate } — re-render on language switch if ticket is showing

function t(key) {
  return I18N[currentLang][key] || I18N.id[key] || key;
}

function populateCountryList() {
  const list = document.getElementById("countryList");
  const idx = currentLang === "en" ? 1 : 0;
  list.innerHTML = COUNTRIES.map(
    (pair) => `<option value="${pair[idx]}">`,
  ).join("");
}

function applyLanguage(lang) {
  currentLang = lang;
  localStorage.setItem("jfs_lang", lang);
  document.documentElement.lang = lang;

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll("[data-i18n-alt]").forEach((el) => {
    el.alt = t(el.dataset.i18nAlt);
  });
  document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    el.setAttribute("aria-label", t(el.dataset.i18nAria));
  });
  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.lang === lang);
  });

  populateCountryList();

  renderDaySummary();
  renderGoalsText();
  if (lastClosedData) showClosed(lastClosedData);
  if (lastTicketData)
    renderTicket(lastTicketData.participant, lastTicketData.isDuplicate);
}

document.querySelectorAll(".lang-btn").forEach((btn) => {
  btn.addEventListener("click", () => applyLanguage(btn.dataset.lang));
});

// ---------- progress bar — measured against the full scrollable range ----------
var bar = document.getElementById("progressBar");
var ticking = false;
function computeProgress() {
  var doc = document.documentElement;
  var scrollTop =
    window.pageYOffset || doc.scrollTop || document.body.scrollTop || 0;
  var scrollHeight =
    Math.max(doc.scrollHeight, document.body.scrollHeight) - doc.clientHeight;
  var pct = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
  pct = Math.min(100, Math.max(0, pct));
  bar.style.width = pct + "%";
}
function requestProgressUpdate() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(function () {
    computeProgress();
    ticking = false;
  });
}
window.addEventListener("scroll", requestProgressUpdate, { passive: true });
window.addEventListener("resize", requestProgressUpdate);
window.addEventListener("load", requestProgressUpdate);
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(requestProgressUpdate);
}
if (window.ResizeObserver) {
  new ResizeObserver(requestProgressUpdate).observe(document.body);
}
computeProgress();

// ---------- chip groups (single = radio look, multi = checkbox look) ----------
document.querySelectorAll(".chips").forEach(function (group) {
  group.addEventListener("click", function (e) {
    var chip = e.target.closest(".chip");
    if (!chip) return;
    var input = chip.querySelector("input");
    if (input.type === "radio") {
      group.querySelectorAll(".chip").forEach(function (c) {
        c.classList.remove("is-selected");
      });
      chip.classList.add("is-selected");
    } else {
      chip.classList.toggle("is-selected", input.checked);
    }
    if (group.dataset.group === "segment") {
      toggleOtherField(
        document.getElementById("segmentOtherWrap"),
        document.getElementById("segmentOther"),
        input.value === "Others",
      );
    }
    requestProgressUpdate();
  });
});

// ---------- "Others" / "Lainnya" reveal fields ----------
function toggleOtherField(wrap, input, show, focus) {
  wrap.classList.toggle("show", show);
  if (show) {
    input.setAttribute("required", "required");
    if (focus !== false) {
      setTimeout(function () {
        input.focus();
      }, 220);
    }
  } else {
    input.removeAttribute("required");
    input.value = "";
  }
  requestProgressUpdate();
}

// ---------- step nav active state via IntersectionObserver ----------
var links = Array.prototype.slice.call(document.querySelectorAll(".step-link"));
var sections = links.map(function (l) {
  return document.getElementById(l.dataset.target);
});
links.forEach(function (l) {
  l.addEventListener("click", function (e) {
    e.preventDefault();
    var target = document.getElementById(l.dataset.target);
    var navH = document.querySelector(".step-nav").offsetHeight + 12;
    window.scrollTo({
      top: target.getBoundingClientRect().top + window.scrollY - navH,
      behavior: "smooth",
    });
  });
});
var io = new IntersectionObserver(
  function (entries) {
    entries.forEach(function (entry) {
      var idx = sections.indexOf(entry.target);
      if (entry.isIntersecting && idx > -1) {
        links.forEach(function (l) {
          l.classList.remove("active");
        });
        links[idx].classList.add("active");
      }
    });
  },
  { rootMargin: "-40% 0px -55% 0px" },
);
sections.forEach(function (s) {
  if (s) io.observe(s);
});

// ---------- registration open/closed check ----------
async function checkStatus() {
  try {
    const res = await fetch(`${API_BASE}/status`);
    if (!res.ok) throw new Error("status check failed");
    const data = await res.json();
    if (!data.open) {
      showClosed(data);
    }
  } catch (e) {
    console.warn("Could not reach /api/status — showing form anyway.", e);
  }
}

function showClosed(data) {
  lastClosedData = data;
  document.getElementById("stepNav").style.display = "none";
  document.getElementById("formStage").style.display = "none";
  document.getElementById("closedStage").style.display = "";

  var rk =
    data.reason === "quota"
      ? "quota"
      : data.reason === "manual"
        ? "manual"
        : "deadline";
  document.getElementById("closedTitle").textContent = t("closed.title." + rk);
  document.getElementById("closedMessage").textContent = t(
    "closed.message." + rk,
  );

  var metaParts = [];
  if (data.quota != null)
    metaParts.push(
      `${data.total} / ${data.quota} ${t("closed.meta.registered")}`,
    );
  if (data.deadline)
    metaParts.push(
      `${t("closed.meta.closedOn")} ` +
        new Date(data.deadline).toLocaleString(
          currentLang === "en" ? "en-US" : "id-ID",
          { dateStyle: "long", timeStyle: "short" },
        ),
    );
  document.getElementById("closedMeta").textContent = metaParts.join(" · ");
}

// ---------- QR download ----------
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

function renderTicket(p, isDuplicate) {
  lastTicketData = { participant: p, isDuplicate: isDuplicate };
  document.getElementById("ticketHeading").textContent = t(
    isDuplicate ? "ticket.heading.duplicate" : "ticket.heading",
  );
  document.getElementById("ticketMessage").textContent = t(
    isDuplicate ? "ticket.message.duplicate" : "ticket.message",
  );
  document.getElementById("ticketCode").textContent = p.id;
  var dl = p.days || window.__lastDays || [];
  if (typeof dl === "string") dl = dl.split(",");
  document.getElementById("ticketDays").textContent = dl.length
    ? formatDays(dl)
    : "";
  document.getElementById("qrImg").src = qrImageUrl(p.qrToken);

  form.style.display = "none";
  document.querySelector(".step-nav").style.display = "none";
  var ticket = document.getElementById("ticket");
  ticket.classList.add("show");
  ticket.scrollIntoView({ behavior: "smooth", block: "start" });
  requestProgressUpdate();
}

// ---------- submit handling ----------
var form = document.getElementById("jfsForm");
var errorBanner = document.getElementById("errorBanner");
var serverErrorBanner = document.getElementById("serverErrorBanner");
var submitBtn = document.getElementById("submitBtn");

function collectGoals() {
  return Array.prototype.slice
    .call(form.querySelectorAll('input[name="goals"]:checked'))
    .map(function (el) {
      if (el.value !== "Others") return el.value;
      var txt = document
        .getElementById("goalsOther")
        .value.trim()
        .replace(/,/g, " /");
      return txt ? "Others: " + txt : "Others";
    });
}

form.addEventListener("submit", async function (e) {
  e.preventDefault();
  errorBanner.classList.remove("show");
  serverErrorBanner.classList.remove("show");

  var daysPicked = collectDays();
  var daysOk = daysPicked.length > 0;
  document.getElementById("daysError").classList.toggle("show", !daysOk);
  window.__lastDays = daysPicked;
  var valid = form.checkValidity() && daysOk;
  var segmentValue = document.getElementById("segment").value;
  if (!valid) {
    form.reportValidity();
    errorBanner.classList.add("show");
    (daysOk
      ? errorBanner
      : document.getElementById("daysError")
    ).scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  const payload = {
    fullname: document.getElementById("fullname").value.trim(),
    email: document.getElementById("email").value.trim(),
    phone: document.getElementById("phone").value.trim(),
    country: document.getElementById("country").value.trim(),
    company: document.getElementById("company").value.trim(),
    jobtitle: document.getElementById("jobtitle").value.trim(),
    segment: segmentValue,
    segmentOther: document.getElementById("segmentOther").value.trim(),
    goals: collectGoals(),
    days: daysPicked,
    access: document.getElementById("access").value.trim(),
    terms: document.getElementById("terms").checked,
  };

  submitBtn.disabled = true;
  submitBtn.textContent = t("submit.sending");

  try {
    const res = await fetch(`${API_BASE}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.status === 409) {
      const data = await res.json();
      renderTicket(data.participant, true);
      return;
    }
    if (res.status === 423) {
      const data = await res.json();
      showClosed(data);
      return;
    }
    if (!res.ok) {
      let errorMessage = `HTTP ${res.status}`;

      try {
        const errorData = await res.json();

        if (errorData && errorData.error) {
          errorMessage = errorData.error;
        }
      } catch (e) {
        // Response bukan JSON
      }

      throw new Error(errorMessage);
    }

    const data = await res.json();
    renderTicket(data.participant, false);
    downloadQr(data.participant);
  } catch (err) {
    serverErrorBanner.classList.add("show");
    serverErrorBanner.scrollIntoView({ behavior: "smooth", block: "center" });
    console.error(err);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = t("submit.button");
  }
});

document.getElementById("downloadBtn").addEventListener("click", function () {
  if (lastTicketData) downloadQr(lastTicketData.participant);
});

document.getElementById("againBtn").addEventListener("click", function () {
  form.reset();
  lastTicketData = null;
  document.querySelectorAll(".chip.is-selected").forEach(function (c) {
    c.classList.remove("is-selected");
  });
  document.getElementById("segmentOtherWrap").classList.remove("show");
  document.getElementById("ticket").classList.remove("show");
  form.style.display = "";
  document.querySelector(".step-nav").style.display = "";
  window.scrollTo({ top: 0, behavior: "smooth" });
  requestProgressUpdate();
});

// ---------- segment dropdown ("Others" reveals a text field) ----------
document.getElementById("segment").addEventListener("change", function (e) {
  toggleOtherField(
    document.getElementById("segmentOtherWrap"),
    document.getElementById("segmentOther"),
    e.target.value === "Others",
  );
});

// ---------- goals dropdown (multi-select with "Others" text field) ----------
function renderGoalsText() {
  var text = document.getElementById("goalsBtnText");
  var panel = document.getElementById("goalsPanel");
  if (!text || !panel) return;
  var labels = Array.prototype.slice
    .call(panel.querySelectorAll("input:checked"))
    .map(function (i) {
      return i.parentNode.querySelector("span").textContent;
    });
  text.textContent = labels.length ? labels.join(", ") : t("goals.placeholder");
  text.classList.toggle("is-placeholder", labels.length === 0);
}
function setGoalsOpen(open) {
  document.getElementById("goalsMulti").classList.toggle("open", open);
  document
    .getElementById("goalsBtn")
    .setAttribute("aria-expanded", String(open));
}
document.getElementById("goalsBtn").addEventListener("click", function () {
  setGoalsOpen(
    !document.getElementById("goalsMulti").classList.contains("open"),
  );
});
document.addEventListener("click", function (e) {
  if (!document.getElementById("goalsMulti").contains(e.target))
    setGoalsOpen(false);
});
document.getElementById("goalsPanel").addEventListener("change", function () {
  var others = document.querySelector(
    '#goalsPanel input[value="Others"]',
  ).checked;
  toggleOtherField(
    document.getElementById("goalsOtherWrap"),
    document.getElementById("goalsOther"),
    others,
    false,
  );
  renderGoalsText();
  requestProgressUpdate();
});
document.getElementById("jfsForm").addEventListener("reset", function () {
  setTimeout(function () {
    document.getElementById("segmentOtherWrap").classList.remove("show");
    document.getElementById("goalsOtherWrap").classList.remove("show");
    document.getElementById("segmentOther").removeAttribute("required");
    document.getElementById("goalsOther").removeAttribute("required");
    setGoalsOpen(false);
    renderGoalsText();
  }, 0);
});

// ---------- Terms & Conditions popup (reading is NOT required to tick the box) ----------
var termsModal = document.getElementById("termsModal");
var termsLastFocus = null;
function openTerms() {
  termsLastFocus = document.activeElement;
  termsModal.classList.add("open");
  termsModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  termsModal.querySelector(".terms-x").focus();
}
function closeTerms() {
  if (!termsModal.classList.contains("open")) return;
  termsModal.classList.remove("open");
  termsModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  if (termsLastFocus && termsLastFocus.focus) termsLastFocus.focus();
}
document.getElementById("termsLink").addEventListener("click", function (e) {
  e.preventDefault();
  e.stopPropagation();
  openTerms();
});
termsModal.querySelectorAll("[data-close-terms]").forEach(function (b) {
  b.addEventListener("click", closeTerms);
});
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") closeTerms();
});

applyLanguage(currentLang);
// ---------- day selection cards ----------
function collectDays() {
  return Array.prototype.slice
    .call(form.querySelectorAll('input[name="days"]:checked'))
    .map(function (el) {
      return el.value;
    });
}
function formatDays(list) {
  return list
    .map(function (d) {
      return t("days.day") + " " + d;
    })
    .join(" · ");
}
function renderDaySummary() {
  var picked = collectDays();
  document.getElementById("daySummary").textContent = picked.length
    ? t("days.summary") + " " + formatDays(picked)
    : t("days.summary.none");
  document.getElementById("dayAll").textContent =
    picked.length === 3 ? t("days.clear") : t("days.selectAll");
}
document.getElementById("dayCards").addEventListener("change", function () {
  document.getElementById("daysError").classList.remove("show");
  renderDaySummary();
});
document.getElementById("dayAll").addEventListener("click", function () {
  var boxes = form.querySelectorAll('input[name="days"]');
  var all = collectDays().length === boxes.length;
  boxes.forEach(function (b) {
    b.checked = !all;
  });
  document.getElementById("daysError").classList.remove("show");
  renderDaySummary();
});
form.addEventListener("reset", function () {
  setTimeout(renderDaySummary, 0);
});
renderDaySummary();
checkStatus();
