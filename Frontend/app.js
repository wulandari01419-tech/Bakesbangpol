// app.js — SPK Konflik Sosial BAKESBANGPOL Banyumas
// Version 2.0 — Premium UI with toast, modal, animated stats

'use strict';

const API_BASE_URL = "http://localhost:8000";
const AUTO_REFRESH_INTERVAL = 30000; // 30 detik

let historyData = [];
let currentPage = 1;
const PAGE_SIZE = 20;
let categoryChartInstance = null;
let districtChartInstance = null;
let autoRefreshTimer = null;
let modalResolve = null;


// ================================================================
// DOM REFS
// ================================================================
const $ = (id) => document.getElementById(id);

const statusDot        = $("statusDot");
const statusText       = $("statusText");
const themeToggle      = $("themeToggle");
const loadingBar       = $("loadingBar");

const predictForm      = $("predictForm");
const selectKecamatan  = $("selectKecamatan");
const inputPihak       = $("inputPihak");
const textInput        = $("textInput");
const btnSubmit        = $("btnSubmit");
const btnReset         = $("btnReset");
const charCounter      = $("charCounter");

const emptyResult      = $("emptyResult");
const resultContent    = $("resultContent");
const overrideAlert    = $("overrideAlert");
const overrideText     = $("overrideText");
const resCategory      = $("resCategory");
const resRiskBadge     = $("resRiskBadge");
const resKecamatan     = $("resKecamatan");
const resPihak         = $("resPihak");
const keywordsBox      = $("keywordsBox");
const kwTags           = $("kwTags");
const recCard          = $("recCard");
const resRecommendation = $("resRecommendation");
const btnPrintRec      = $("btnPrintRec");

const historyTableBody = $("historyTableBody");
const historySearch    = $("historySearch");
const filterRisk       = $("filterRisk");
const btnClearHistory  = $("btnClearHistory");
const btnExportExcel   = $("btnExportExcel");

const statTotal  = $("statTotal");
const statTinggi = $("statTinggi");
const statSedang = $("statSedang");
const statRendah = $("statRendah");
const bannerTotal = $("bannerTotal");

const scrollToTopBtn  = $("scrollToTop");
const modalOverlay    = $("modalOverlay");
const modalTitle      = $("modalTitle");
const modalMessage    = $("modalMessage");
const modalConfirm    = $("modalConfirm");
const modalCancel     = $("modalCancel");
const modalIcon       = $("modalIcon");

// ================================================================
// INIT
// ================================================================
document.addEventListener("DOMContentLoaded", () => {
  setupTheme();
  checkApiHealth();
  loadHistory();
  setupEventListeners();
  startAutoRefresh();
});

// ================================================================
// EVENT LISTENERS
// ================================================================
function setupEventListeners() {
  // Theme Toggle
  themeToggle.addEventListener("click", toggleTheme);

  // Character counter
  textInput.addEventListener("input", () => {
    const len = textInput.value.length;
    charCounter.textContent = `${len} / 2000 karakter`;
    charCounter.style.color = len > 1800 ? "var(--primary)" : "var(--text-muted)";
  });

  // Preset Buttons
  document.querySelectorAll(".preset-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      textInput.value = btn.dataset.text || "";
      if (btn.dataset.kec)   selectKecamatan.value = btn.dataset.kec;
      if (btn.dataset.pihak) inputPihak.value = btn.dataset.pihak;
      // Trigger character counter
      textInput.dispatchEvent(new Event("input"));
      textInput.focus();
      showToast("Teks contoh telah diisi. Silakan edit sesuai kasus nyata.", "info");
    });
  });

  // Reset Button
  btnReset.addEventListener("click", () => {
    predictForm.reset();
    charCounter.textContent = "0 / 2000 karakter";
    charCounter.style.color = "var(--text-muted)";
    resetResultUI();
    showToast("Formulir telah direset.", "info");
  });

  // Form Submit
  predictForm.addEventListener("submit", handlePredictSubmit);

  // History Search & Filter
  historySearch.addEventListener("input", filterAndRenderHistory);
  filterRisk.addEventListener("change", filterAndRenderHistory);

  // Clear History & Export
  btnClearHistory.addEventListener("click", handleClearAllHistory);
  btnExportExcel.addEventListener("click", handleExportExcel);

  // Print Recommendation
  btnPrintRec.addEventListener("click", printRecommendation);

  // Scroll to Top
  window.addEventListener("scroll", () => {
    if (window.scrollY > 320) {
      scrollToTopBtn.classList.add("visible");
    } else {
      scrollToTopBtn.classList.remove("visible");
    }
  });

  scrollToTopBtn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // Modal cancel
  modalCancel.addEventListener("click", () => {
    closeModal(false);
  });

  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal(false);
  });

  // Keyboard Escape to close modal
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modalOverlay.classList.contains("hidden")) {
      closeModal(false);
    }
  });
}

// ================================================================
// LOADING BAR
// ================================================================
function setLoadingBar(pct) {
  loadingBar.style.width = pct + "%";
  if (pct >= 100) {
    setTimeout(() => { loadingBar.style.width = "0%"; }, 400);
  }
}

// ================================================================
// API HEALTH CHECK
// ================================================================
async function checkApiHealth() {
  try {
    const res = await fetch(`${API_BASE_URL}/`, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      statusDot.className = "status-dot online";
      statusText.textContent = "API Terhubung";
    } else {
      throw new Error("HTTP " + res.status);
    }
  } catch {
    statusDot.className = "status-dot offline";
    statusText.textContent = "API Terputus";
  }
}

// ================================================================
// HANDLE FORM SUBMIT (PREDICT)
// ================================================================
async function handlePredictSubmit(e) {
  e.preventDefault();

  const text = textInput.value.trim();
  const kecamatan = selectKecamatan.value;
  const pihak = inputPihak.value.trim();

  if (!text) {
    showToast("Silakan masukkan uraian kejadian konflik terlebih dahulu.", "warning");
    textInput.focus();
    return;
  }

  if (text.length < 10) {
    showToast("Uraian kejadian terlalu singkat. Mohon isi dengan lebih lengkap.", "warning");
    textInput.focus();
    return;
  }

  setLoadingState(true);
  setLoadingBar(30);

  try {
    setLoadingBar(60);
    const response = await fetch(`${API_BASE_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: text,
        kecamatan: kecamatan,
        pihak_terlibat: pihak || "Masyarakat / Warga"
      }),
    });

    setLoadingBar(85);

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.detail || `Server error (${response.status})`);
    }

    const data = await response.json();
    setLoadingBar(100);
    renderPredictionResult(data);

    const riskLabel = data.risk_level || "Tidak Diketahui";
    showToast(`Prediksi selesai: Tingkat Risiko — ${riskLabel}`, data.risk_color === "merah" ? "error" : data.risk_color === "oranye" ? "warning" : "success");

    await loadHistory();
  } catch (err) {
    setLoadingBar(0);
    if (err.name === "TimeoutError" || err.name === "AbortError") {
      showToast("Koneksi ke server timeout. Pastikan backend aktif.", "error");
    } else {
      showToast(`Terjadi Kesalahan: ${err.message}`, "error");
    }
  } finally {
    setLoadingState(false);
  }
}

// ================================================================
// RENDER PREDICTION RESULT
// ================================================================
function renderPredictionResult(data) {
  emptyResult.classList.add("hidden");
  resultContent.classList.remove("hidden");

  // Trigger re-animation
  resultContent.style.animation = "none";
  void resultContent.offsetHeight; // reflow
  resultContent.style.animation = "";

  // Category & location
  resCategory.textContent   = data.category       || "Tidak Terklasifikasi";
  resKecamatan.textContent  = data.kecamatan       || "Purwokerto Timur";
  resPihak.textContent      = data.pihak_terlibat  || "—";

  // Risk badge
  const colorMap = { merah: "merah", oranye: "oranye", hijau: "hijau" };
  const colorClass = colorMap[data.risk_color?.toLowerCase()] || "hijau";
  const riskEmoji = colorClass === "merah" ? "🔴" : colorClass === "oranye" ? "🟠" : "🟢";

  resRiskBadge.textContent = `${riskEmoji} ${data.risk_level || "Rendah"}`;
  resRiskBadge.className = `badge badge-risk ${colorClass}`;

  // Override alert
  if (data.is_override) {
    overrideAlert.classList.remove("hidden");
    overrideText.textContent = `Terdeteksi kata kunci darurat: [${(data.keywords_detected || []).join(", ")}]. Sistem meng-override prediksi ML → Risiko TINGGI.`;
  } else {
    overrideAlert.classList.add("hidden");
  }

  // Keywords
  if (data.keywords_detected && data.keywords_detected.length > 0) {
    keywordsBox.classList.remove("hidden");
    kwTags.innerHTML = data.keywords_detected
      .map((kw) => `<span class="kw-tag">${escapeHtml(kw)}</span>`)
      .join("");
  } else {
    keywordsBox.classList.add("hidden");
  }

  // Recommendation
  recCard.className = `recommendation-card ${colorClass}`;
  resRecommendation.textContent = data.recommendation || "—";

  // Scroll smoothly
  resultContent.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// ================================================================
// RESET RESULT UI
// ================================================================
function resetResultUI() {
  emptyResult.classList.remove("hidden");
  resultContent.classList.add("hidden");
}

// ================================================================
// LOADING STATE (SUBMIT BUTTON)
// ================================================================
function setLoadingState(isLoading) {
  const btnText = btnSubmit.querySelector(".btn-text");
  const spinner = btnSubmit.querySelector(".spinner");
  btnSubmit.disabled = isLoading;

  if (isLoading) {
    btnText.classList.add("hidden");
    spinner.classList.remove("hidden");
  } else {
    btnText.classList.remove("hidden");
    spinner.classList.add("hidden");
  }
}

// ================================================================
// LOAD HISTORY FROM API
// ================================================================
async function loadHistory() {
  try {
    const res = await fetch(`${API_BASE_URL}/history`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error("Gagal mengambil riwayat (HTTP " + res.status + ")");

    historyData = await res.json();
    updateStats(historyData);
    renderCharts(historyData);
    filterAndRenderHistory();
  } catch {
    if (historyTableBody.innerHTML.includes("Memuat")) {
      historyTableBody.innerHTML = `
        <tr class="empty-row">
          <td colspan="9" class="text-center" style="color:var(--risk-red-text);">
            <i class="fa-solid fa-triangle-exclamation"></i>
            &nbsp;Gagal memuat data — pastikan server backend aktif di <code>${API_BASE_URL}</code>
          </td>
        </tr>`;
    }
  }
}

// ================================================================
// AUTO REFRESH
// ================================================================
function startAutoRefresh() {
  if (autoRefreshTimer) clearInterval(autoRefreshTimer);
  autoRefreshTimer = setInterval(() => {
    loadHistory();
    checkApiHealth();
  }, AUTO_REFRESH_INTERVAL);
}

// ================================================================
// UPDATE STATS WITH ANIMATED COUNTER
// ================================================================
function updateStats(data) {
  const total  = data.length;
  const tinggi = data.filter((i) => i.tingkat_risiko === "Tinggi").length;
  const sedang = data.filter((i) => i.tingkat_risiko === "Sedang").length;
  const rendah = data.filter((i) => i.tingkat_risiko === "Rendah").length;

  animateCounter(statTotal,  total);
  animateCounter(statTinggi, tinggi);
  animateCounter(statSedang, sedang);
  animateCounter(statRendah, rendah);

  if (bannerTotal) bannerTotal.textContent = total || "0";
}

function animateCounter(el, target) {
  if (!el) return;
  const start = parseInt(el.textContent) || 0;
  if (start === target) return;

  const duration = 600;
  const startTime = performance.now();

  el.classList.remove("animating");
  void el.offsetHeight;
  el.classList.add("animating");

  function step(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Ease-out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(start + (target - start) * eased);
    if (progress < 1) requestAnimationFrame(step);
    else {
      el.textContent = target;
      el.classList.remove("animating");
    }
  }

  requestAnimationFrame(step);
}

// ================================================================
// RENDER CHARTS (CHART.JS)
// ================================================================
function renderCharts(data) {
  if (typeof Chart === "undefined") return;

  const isDark = document.body.classList.contains("dark-mode");
  const textColor     = isDark ? "#94a3b8" : "#64748b";
  const gridColor     = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
  const legendColor   = isDark ? "#cbd5e1" : "#475569";

  // -- Category Chart (Doughnut) --
  const catCounts = {};
  data.forEach(item => {
    const cat = item.kategori || "Lainnya";
    catCounts[cat] = (catCounts[cat] || 0) + 1;
  });
  const catLabels = Object.keys(catCounts);
  const catValues = Object.values(catCounts);

  const PALETTE = [
    "#dc2626", "#ea580c", "#d97706", "#16a34a",
    "#2563eb", "#7c3aed", "#0891b2", "#db2777",
    "#64748b", "#059669"
  ];

  const ctxCat = $("categoryChart")?.getContext("2d");
  if (ctxCat) {
    if (categoryChartInstance) categoryChartInstance.destroy();
    categoryChartInstance = new Chart(ctxCat, {
      type: "doughnut",
      data: {
        labels: catLabels.length > 0 ? catLabels : ["Belum ada data"],
        datasets: [{
          data: catValues.length > 0 ? catValues : [1],
          backgroundColor: PALETTE,
          borderWidth: 2,
          borderColor: isDark ? "#13151a" : "#ffffff",
          hoverBorderWidth: 3,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "62%",
        plugins: {
          legend: {
            position: "bottom",
            labels: { font: { size: 11, family: "Plus Jakarta Sans", weight: "700" }, color: legendColor, padding: 16, boxWidth: 14 }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ${ctx.raw} laporan`
            }
          }
        }
      }
    });
  }

  // -- District Chart (Bar) --
  const distCounts = {};
  data.forEach(item => {
    const dist = item.kecamatan || "Purwokerto Timur";
    distCounts[dist] = (distCounts[dist] || 0) + 1;
  });
  const distLabels = Object.keys(distCounts);
  const distValues = Object.values(distCounts);

  // Color bars by count (more = redder)
  const maxVal = Math.max(...distValues, 1);
  const barColors = distValues.map(v => {
    const ratio = v / maxVal;
    if (ratio > 0.66) return "#dc2626";
    if (ratio > 0.33) return "#ea580c";
    return "#16a34a";
  });

  const ctxDist = $("districtChart")?.getContext("2d");
  if (ctxDist) {
    if (districtChartInstance) districtChartInstance.destroy();
    districtChartInstance = new Chart(ctxDist, {
      type: "bar",
      data: {
        labels: distLabels.length > 0 ? distLabels : ["Purwokerto Timur"],
        datasets: [{
          label: "Jumlah Konflik",
          data: distValues.length > 0 ? distValues : [0],
          backgroundColor: barColors,
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1, color: textColor, font: { size: 11 } },
            grid: { color: gridColor }
          },
          x: {
            ticks: {
              color: textColor,
              font: { size: 10 },
              maxRotation: 45,
              minRotation: 30
            },
            grid: { display: false }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.raw} laporan konflik`
            }
          }
        }
      }
    });
  }
}

// ================================================================
// FILTER & RENDER HISTORY TABLE
// ================================================================
function filterAndRenderHistory() {
  const searchTerm   = historySearch.value.toLowerCase().trim();
  const selectedRisk = filterRisk.value;

  const filtered = historyData.filter((item) => {
    const matchesSearch =
      (item.teks_input  || "").toLowerCase().includes(searchTerm) ||
      (item.kategori    || "").toLowerCase().includes(searchTerm) ||
      (item.kecamatan   || "").toLowerCase().includes(searchTerm) ||
      (item.pihak_terlibat || "").toLowerCase().includes(searchTerm);
    const matchesRisk = selectedRisk === "ALL" || item.tingkat_risiko === selectedRisk;
    return matchesSearch && matchesRisk;
  });

  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / PAGE_SIZE) || 1;
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, totalItems);
  const pageItems = filtered.slice(startIndex, endIndex);

  const paginationInfo = $("paginationInfo");
  const paginationButtons = $("paginationButtons");

  if (paginationInfo) {
    paginationInfo.textContent = totalItems > 0 
      ? `Menampilkan ${startIndex + 1}–${endIndex} dari ${totalItems} laporan`
      : "Menampilkan 0 data";
  }

  if (paginationButtons) {
    if (totalPages <= 1) {
      paginationButtons.innerHTML = "";
    } else {
      let btnsHtml = `<button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="changeHistoryPage(${currentPage - 1})"><i class="fa-solid fa-chevron-left"></i> Prev</button>`;
      
      for (let p = 1; p <= totalPages; p++) {
        btnsHtml += `<button class="page-btn ${p === currentPage ? 'active' : ''}" onclick="changeHistoryPage(${p})">${p}</button>`;
      }

      btnsHtml += `<button class="page-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="changeHistoryPage(${currentPage + 1})">Next <i class="fa-solid fa-chevron-right"></i></button>`;
      paginationButtons.innerHTML = btnsHtml;
    }
  }

  if (filtered.length === 0) {
    historyTableBody.innerHTML = `
      <tr class="empty-row">
        <td colspan="9" class="text-center">
          <i class="fa-solid fa-inbox" style="font-size:1.5rem;opacity:.4;display:block;margin-bottom:8px;"></i>
          Tidak ada data riwayat laporan yang cocok.
        </td>
      </tr>`;
    return;
  }

  historyTableBody.innerHTML = pageItems.map((item, index) => {
    const globalIndex = startIndex + index + 1;
    const dateStr = item.created_at
      ? new Date(item.created_at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })
      : "—";

    let pillClass = "pill-green";
    if (item.tingkat_risiko === "Tinggi") pillClass = "pill-red";
    else if (item.tingkat_risiko === "Sedang") pillClass = "pill-orange";

    const pillEmoji = item.tingkat_risiko === "Tinggi" ? "🔴" : item.tingkat_risiko === "Sedang" ? "🟠" : "🟢";

    const currentStatus = item.status_penanganan || "Dalam Proses";

    const uraianShort = item.teks_input && item.teks_input.length > 140
      ? escapeHtml(item.teks_input.substring(0, 140)) + "…"
      : escapeHtml(item.teks_input || "—");

    return `
      <tr>
        <td style="font-weight:700;color:var(--text-muted);text-align:center;">${globalIndex}</td>
        <td style="font-size:0.78rem;color:var(--text-muted);">${dateStr}</td>
        <td><span class="kec-badge">${escapeHtml(item.kecamatan || "Purwokerto Timur")}</span></td>
        <td style="font-size:0.82rem;">${escapeHtml(item.pihak_terlibat || "—")}</td>
        <td class="col-uraian-cell" title="${escapeHtml(item.teks_input || "")}">${uraianShort}</td>
        <td style="font-weight:600;">${escapeHtml(item.kategori || "—")}</td>
        <td><span class="pill ${pillClass}">${pillEmoji} ${item.tingkat_risiko || "Rendah"}</span></td>
        <td>
          <select class="status-select" onchange="updateStatusPenanganan(${item.id}, this.value)" aria-label="Status penanganan laporan ${globalIndex}">
            <option value="Dalam Proses" ${currentStatus === "Dalam Proses" ? "selected" : ""}>⏳ Dalam Proses</option>
            <option value="Mediasi"      ${currentStatus === "Mediasi"      ? "selected" : ""}>🤝 Mediasi</option>
            <option value="Tertangani"   ${currentStatus === "Tertangani"   ? "selected" : ""}>✅ Tertangani</option>
          </select>
        </td>
        <td>
          <button class="btn-sm-danger" onclick="deleteHistoryItem(${item.id})" title="Hapus riwayat ini" aria-label="Hapus laporan nomor ${globalIndex}">
            <i class="fa-solid fa-trash-can" aria-hidden="true"></i>
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

function changeHistoryPage(newPage) {
  currentPage = newPage;
  filterAndRenderHistory();
}


// ================================================================
// UPDATE STATUS PENANGANAN
// ================================================================
async function updateStatusPenanganan(id, newStatus) {
  try {
    const res = await fetch(`${API_BASE_URL}/history/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status_penanganan: newStatus })
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    showToast(`Status diperbarui: ${newStatus}`, "success");
    await loadHistory();
  } catch {
    showToast("Terjadi kesalahan saat memperbarui status penanganan.", "error");
  }
}

// ================================================================
// EXPORT EXCEL
// ================================================================
function handleExportExcel() {
  if (historyData.length === 0) {
    showToast("Belum ada data riwayat untuk diekspor.", "warning");
    return;
  }
  window.open(`${API_BASE_URL}/export/excel`, "_blank");
  showToast("Mengunduh file Excel rekapitulasi...", "info");
}

// ================================================================
// DELETE HISTORY ITEM
// ================================================================
async function deleteHistoryItem(id) {
  const confirmed = await showModal(
    "Hapus Riwayat",
    "Apakah Anda yakin ingin menghapus catatan riwayat ini? Tindakan ini tidak dapat dibatalkan.",
    "warning"
  );
  if (!confirmed) return;

  try {
    const res = await fetch(`${API_BASE_URL}/history/${id}`, { method: "DELETE" });
    if (res.ok) {
      showToast("Riwayat berhasil dihapus.", "success");
      await loadHistory();
    } else {
      showToast("Gagal menghapus riwayat. Coba lagi.", "error");
    }
  } catch {
    showToast("Terjadi kesalahan koneksi saat menghapus.", "error");
  }
}

// ================================================================
// CLEAR ALL HISTORY
// ================================================================
async function handleClearAllHistory() {
  if (historyData.length === 0) {
    showToast("Riwayat masih kosong.", "info");
    return;
  }

  const confirmed = await showModal(
    "Hapus Semua Riwayat",
    `PERINGATAN: Anda akan menghapus SELURUH ${historyData.length} catatan riwayat laporan konflik. Tindakan ini tidak dapat dibatalkan!`,
    "danger"
  );
  if (!confirmed) return;

  try {
    const res = await fetch(`${API_BASE_URL}/history`, { method: "DELETE" });
    if (res.ok) {
      showToast("Seluruh riwayat berhasil dihapus.", "success");
      await loadHistory();
    } else {
      showToast("Gagal membersihkan riwayat.", "error");
    }
  } catch {
    showToast("Terjadi kesalahan jaringan.", "error");
  }
}

// ================================================================
// THEME TOGGLE
// ================================================================
function toggleTheme() {
  const isDark = document.body.classList.toggle("dark-mode");
  document.body.classList.toggle("light-mode", !isDark);

  const icon = themeToggle.querySelector("i");
  icon.className = isDark ? "fa-solid fa-sun" : "fa-solid fa-moon";
  localStorage.setItem("theme", isDark ? "dark" : "light");

  // Re-render charts for new theme
  if (historyData.length > 0) {
    setTimeout(() => renderCharts(historyData), 50);
  }

  showToast(`Mode ${isDark ? "Gelap" : "Terang"} diaktifkan.`, "info");
}

function setupTheme() {
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark") {
    document.body.classList.add("dark-mode");
    document.body.classList.remove("light-mode");
    themeToggle.querySelector("i").className = "fa-solid fa-sun";
  } else {
    document.body.classList.add("light-mode");
  }
}

// ================================================================
// PRINT RECOMMENDATION
// ================================================================
function printRecommendation() {
  const kat   = resCategory.textContent;
  const risk  = resRiskBadge.textContent;
  const rec   = resRecommendation.textContent;
  const text  = textInput.value;
  const kec   = resKecamatan.textContent;
  const pihak = resPihak.textContent;

  if (kat === "—" || kat === "") {
    showToast("Belum ada hasil prediksi untuk dicetak.", "warning");
    return;
  }

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    showToast("Popup diblokir. Izinkan popup untuk mencetak.", "error");
    return;
  }

  const now = new Date();
  const dateStr = now.toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const timeStr = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

  printWindow.document.write(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Lembar Rekomendasi — BAKESBANGPOL Banyumas</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Plus Jakarta Sans', Arial, sans-serif;
      background: white;
      color: #0f172a;
      font-size: 13px;
      line-height: 1.65;
    }

    .page {
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 48px;
    }

    /* Header */
    .letter-header {
      display: flex;
      align-items: center;
      gap: 20px;
      padding-bottom: 16px;
      border-bottom: 3px solid #7f1d1d;
      margin-bottom: 24px;
    }

    .letter-header .logo-box {
      width: 60px;
      height: 60px;
      background: linear-gradient(135deg, #7f1d1d, #dc2626);
      color: #fef08a;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      border-radius: 8px;
      flex-shrink: 0;
      border: 2px solid #d97706;
    }

    .letter-header .org-info h1 {
      font-size: 15px;
      font-weight: 800;
      color: #7f1d1d;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      line-height: 1.3;
    }

    .letter-header .org-info p {
      font-size: 11px;
      color: #64748b;
      margin-top: 3px;
    }

    /* Title */
    .doc-title {
      text-align: center;
      margin-bottom: 24px;
    }

    .doc-title h2 {
      font-size: 14px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #0f172a;
    }

    .doc-title .doc-sub {
      font-size: 11px;
      color: #64748b;
      margin-top: 3px;
    }

    .doc-title .nomor {
      font-size: 11px;
      color: #475569;
      border: 1px solid #e2e8f0;
      display: inline-block;
      padding: 3px 12px;
      border-radius: 4px;
      margin-top: 6px;
    }

    /* Section header */
    .section-title {
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #94a3b8;
      margin-bottom: 8px;
      margin-top: 20px;
    }

    /* Meta table */
    .meta-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 4px;
    }

    .meta-table tr:first-child td { border-top: 1px solid #e2e8f0; }
    .meta-table td {
      padding: 9px 12px;
      border-bottom: 1px solid #e2e8f0;
      border-left: 1px solid #e2e8f0;
      border-right: 1px solid #e2e8f0;
      vertical-align: top;
    }

    .meta-table td.label {
      background: #f8fafc;
      font-weight: 700;
      width: 180px;
      color: #475569;
      font-size: 11px;
    }

    .meta-table td.value {
      color: #0f172a;
      font-size: 12px;
    }

    /* Risk badge */
    .risk-badge {
      display: inline-block;
      padding: 3px 12px;
      border-radius: 4px;
      font-weight: 800;
      font-size: 12px;
    }

    .risk-merah  { background: #fef2f2; color: #dc2626; border: 1px solid #fca5a5; }
    .risk-oranye { background: #fff7ed; color: #ea580c; border: 1px solid #fdba74; }
    .risk-hijau  { background: #f0fdf4; color: #16a34a; border: 1px solid #86efac; }

    /* Recommendation */
    .rec-box {
      background: #f8fafc;
      border-left: 4px solid #2563eb;
      padding: 16px 18px;
      margin-top: 8px;
      border-radius: 0 6px 6px 0;
      font-size: 13px;
      line-height: 1.75;
      color: #0f172a;
    }

    /* Signature */
    .signature-section {
      display: flex;
      justify-content: flex-end;
      margin-top: 48px;
    }

    .signature-box {
      text-align: center;
      min-width: 220px;
    }

    .signature-box .place-date {
      font-size: 12px;
      margin-bottom: 4px;
    }

    .signature-box .sig-title {
      font-size: 11px;
      color: #64748b;
      margin-bottom: 56px;
    }

    .signature-box .sig-name {
      font-weight: 800;
      font-size: 13px;
      border-top: 1px solid #0f172a;
      padding-top: 6px;
    }

    .signature-box .sig-nip {
      font-size: 11px;
      color: #64748b;
      margin-top: 2px;
    }

    /* Footer note */
    .print-footer {
      margin-top: 32px;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
      font-size: 10px;
      color: #94a3b8;
      text-align: center;
    }

    @media print {
      .page { padding: 20px; }
    }
  </style>
</head>
<body>
  <div class="page">
    <!-- Kop Surat -->
    <div class="letter-header">
      <div class="logo-box">&#xf3ed;</div>
      <div class="org-info">
        <h1>Badan Kesatuan Bangsa dan Politik<br>Kabupaten Banyumas</h1>
        <p>Jl. Kabupaten No. 1, Purwokerto, Kabupaten Banyumas, Jawa Tengah 53114</p>
      </div>
    </div>

    <!-- Judul Dokumen -->
    <div class="doc-title">
      <h2>Lembar Rekomendasi</h2>
      <p class="doc-sub">Sistem Pendukung Keputusan Penanganan Konflik Sosial (SPK-PKS)</p>
      <span class="nomor">Dicetak: ${dateStr}, Pukul ${timeStr}</span>
    </div>

    <!-- Detail Laporan -->
    <p class="section-title">A. Identitas Laporan</p>
    <table class="meta-table">
      <tr>
        <td class="label">Tanggal Analisis</td>
        <td class="value">${dateStr}, Pukul ${timeStr} WIB</td>
      </tr>
      <tr>
        <td class="label">Kecamatan / Lokasi</td>
        <td class="value"><strong>${escapeHtml(kec)}</strong>, Kabupaten Banyumas</td>
      </tr>
      <tr>
        <td class="label">Pihak Terlibat</td>
        <td class="value">${escapeHtml(pihak)}</td>
      </tr>
      <tr>
        <td class="label">Uraian Kejadian</td>
        <td class="value">${escapeHtml(text)}</td>
      </tr>
    </table>

    <!-- Hasil Analisis AI -->
    <p class="section-title">B. Hasil Klasifikasi AI (Hybrid System)</p>
    <table class="meta-table">
      <tr>
        <td class="label">Kategori Konflik</td>
        <td class="value"><strong>${escapeHtml(kat)}</strong></td>
      </tr>
      <tr>
        <td class="label">Tingkat Risiko Sosial</td>
        <td class="value">
          <span class="risk-badge risk-${risk.includes('Tinggi') || risk.includes('🔴') ? 'merah' : risk.includes('Sedang') || risk.includes('🟠') ? 'oranye' : 'hijau'}">
            ${escapeHtml(risk)}
          </span>
        </td>
      </tr>
    </table>

    <!-- Rekomendasi -->
    <p class="section-title">C. Rekomendasi Tindakan / Penanganan</p>
    <div class="rec-box">${escapeHtml(rec)}</div>

    <!-- Tanda Tangan -->
    <div class="signature-section">
      <div class="signature-box">
        <p class="place-date">Purwokerto, ${dateStr}</p>
        <p class="sig-title">Kepala BAKESBANGPOL Kabupaten Banyumas</p>
        <p class="sig-name">.........................................................</p>
        <p class="sig-nip">NIP. ........................................</p>
      </div>
    </div>

    <!-- Print Footer -->
    <div class="print-footer">
      Dokumen ini dicetak otomatis oleh Sistem Pendukung Keputusan SPK-PKS BAKESBANGPOL Kabupaten Banyumas.
      Dokumen ini bersifat resmi dan hanya untuk keperluan internal instansi.
    </div>
  </div>

  <script>
    window.onload = function() {
      window.print();
      window.close();
    };
  <\/script>
</body>
</html>`);

  printWindow.document.close();
}

// ================================================================
// TOAST NOTIFICATION SYSTEM
// ================================================================
function showToast(message, type = "info") {
  const container = $("toastContainer");
  if (!container) return;

  const icons = {
    success: "fa-circle-check",
    error:   "fa-circle-xmark",
    warning: "fa-triangle-exclamation",
    info:    "fa-circle-info"
  };

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <i class="fa-solid ${icons[type] || icons.info} toast-icon" aria-hidden="true"></i>
    <span class="toast-msg">${escapeHtml(message)}</span>
  `;
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");

  container.appendChild(toast);

  const duration = type === "error" ? 5000 : 3500;
  setTimeout(() => {
    toast.classList.add("removing");
    setTimeout(() => toast.remove(), 350);
  }, duration);
}

// ================================================================
// CUSTOM MODAL (REPLACES browser confirm())
// ================================================================
function showModal(title, message, type = "warning") {
  return new Promise((resolve) => {
    modalResolve = resolve;
    modalTitle.textContent   = title;
    modalMessage.textContent = message;

    // Icon & style by type
    const iconMap = {
      danger:  { icon: "fa-trash-can",           color: "#dc2626", bg: "rgba(220,38,38,0.1)"  },
      warning: { icon: "fa-triangle-exclamation", color: "#ea580c", bg: "rgba(234,88,12,0.1)" },
      info:    { icon: "fa-circle-info",           color: "#3b82f6", bg: "rgba(59,130,246,0.1)"}
    };

    const cfg = iconMap[type] || iconMap.warning;
    modalIcon.innerHTML = `<i class="fa-solid ${cfg.icon}" aria-hidden="true"></i>`;
    modalIcon.style.color      = cfg.color;
    modalIcon.style.background = cfg.bg;
    modalConfirm.style.borderColor = cfg.color;
    modalConfirm.style.color       = cfg.color;

    modalOverlay.classList.remove("hidden");
    modalCancel.focus();
  });
}

modalConfirm.addEventListener("click", () => closeModal(true));

function closeModal(result) {
  modalOverlay.classList.add("hidden");
  if (modalResolve) {
    modalResolve(result);
    modalResolve = null;
  }
}

// ================================================================
// UTILITY: ESCAPE HTML
// ================================================================
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
