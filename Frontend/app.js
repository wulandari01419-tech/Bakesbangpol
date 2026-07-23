// app.js
const API_BASE_URL = "http://localhost:8000";

let historyData = [];
let categoryChartInstance = null;
let districtChartInstance = null;

// DOM Elements
const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const themeToggle = document.getElementById("themeToggle");

const predictForm = document.getElementById("predictForm");
const selectKecamatan = document.getElementById("selectKecamatan");
const inputPihak = document.getElementById("inputPihak");
const textInput = document.getElementById("textInput");
const btnSubmit = document.getElementById("btnSubmit");
const btnReset = document.getElementById("btnReset");

const emptyResult = document.getElementById("emptyResult");
const resultContent = document.getElementById("resultContent");

const overrideAlert = document.getElementById("overrideAlert");
const overrideText = document.getElementById("overrideText");
const resCategory = document.getElementById("resCategory");
const resRiskBadge = document.getElementById("resRiskBadge");
const resKecamatan = document.getElementById("resKecamatan");
const resPihak = document.getElementById("resPihak");
const keywordsBox = document.getElementById("keywordsBox");
const kwTags = document.getElementById("kwTags");
const recCard = document.getElementById("recCard");
const resRecommendation = document.getElementById("resRecommendation");
const btnPrintRec = document.getElementById("btnPrintRec");

const historyTableBody = document.getElementById("historyTableBody");
const historySearch = document.getElementById("historySearch");
const filterRisk = document.getElementById("filterRisk");
const btnClearHistory = document.getElementById("btnClearHistory");
const btnExportExcel = document.getElementById("btnExportExcel");

// Stats Elements
const statTotal = document.getElementById("statTotal");
const statTinggi = document.getElementById("statTinggi");
const statSedang = document.getElementById("statSedang");
const statRendah = document.getElementById("statRendah");

// Init Application
document.addEventListener("DOMContentLoaded", () => {
  checkApiHealth();
  loadHistory();
  setupEventListeners();
  setupTheme();
});

// Event Listeners Setup
function setupEventListeners() {
  // Theme Toggle
  themeToggle.addEventListener("click", toggleTheme);

  // Preset Buttons
  document.querySelectorAll(".preset-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      textInput.value = btn.getAttribute("data-text");
      if (btn.getAttribute("data-kec")) selectKecamatan.value = btn.getAttribute("data-kec");
      if (btn.getAttribute("data-pihak")) inputPihak.value = btn.getAttribute("data-pihak");
      textInput.focus();
    });
  });

  // Reset Button
  btnReset.addEventListener("click", () => {
    textInput.value = "";
    inputPihak.value = "";
    selectKecamatan.value = "Purwokerto Timur";
    resetResultUI();
  });

  // Form Submit
  predictForm.addEventListener("submit", handlePredictSubmit);

  // History Search & Filter
  historySearch.addEventListener("input", filterAndRenderHistory);
  filterRisk.addEventListener("change", filterAndRenderHistory);

  // Clear History & Export Excel
  btnClearHistory.addEventListener("click", handleClearAllHistory);
  btnExportExcel.addEventListener("click", handleExportExcel);

  // Print Recommendation
  btnPrintRec.addEventListener("click", printRecommendation);
}

// Health Check API
async function checkApiHealth() {
  try {
    const res = await fetch(`${API_BASE_URL}/`);
    if (res.ok) {
      statusDot.className = "status-dot online";
      statusText.textContent = "API Terhubung";
    } else {
      throw new Error();
    }
  } catch (err) {
    statusDot.className = "status-dot offline";
    statusText.textContent = "API Terputus";
  }
}

// Handle Form Submission
async function handlePredictSubmit(e) {
  e.preventDefault();
  const text = textInput.value.trim();
  const kecamatan = selectKecamatan.value;
  const pihak = inputPihak.value.trim();

  if (!text) {
    alert("Silakan masukkan uraian kejadian konflik terlebih dahulu.");
    return;
  }

  setLoadingState(true);

  try {
    const response = await fetch(`${API_BASE_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: text,
        kecamatan: kecamatan,
        pihak_terlibat: pihak || "Masyarakat / Warga"
      }),
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.detail || "Gagal memproses prediksi.");
    }

    const data = await response.json();
    renderPredictionResult(data);
    await loadHistory();
  } catch (err) {
    alert(`Terjadi Kesalahan: ${err.message}`);
  } finally {
    setLoadingState(false);
  }
}

// Render Prediction Result
function renderPredictionResult(data) {
  emptyResult.classList.add("hidden");
  resultContent.classList.remove("hidden");

  // Category
  resCategory.textContent = data.category || "Tidak Terklasifikasi";
  resKecamatan.textContent = data.kecamatan || "Purwokerto Timur";
  resPihak.textContent = data.pihak_terlibat || "-";

  // Risk Badge & Color
  const colorMap = {
    merah: "merah",
    oranye: "oranye",
    hijau: "hijau",
  };
  const colorClass = colorMap[data.risk_color?.toLowerCase()] || "hijau";

  resRiskBadge.textContent = `${data.risk_level} (${colorClass.toUpperCase()})`;
  resRiskBadge.className = `badge badge-risk ${colorClass}`;

  // Override Alert
  if (data.is_override) {
    overrideAlert.classList.remove("hidden");
    overrideText.textContent = `Terdeteksi kata kunci darurat: [${(data.keywords_detected || []).join(", ")}]. Sistem meng-override prediksi ML ke Risiko TINGGI.`;
  } else {
    overrideAlert.classList.add("hidden");
  }

  // Keywords Box
  if (data.keywords_detected && data.keywords_detected.length > 0) {
    keywordsBox.classList.remove("hidden");
    kwTags.innerHTML = data.keywords_detected
      .map((kw) => `<span class="kw-tag">${kw}</span>`)
      .join("");
  } else {
    keywordsBox.classList.add("hidden");
  }

  // Recommendation Card
  recCard.className = `recommendation-card ${colorClass}`;
  resRecommendation.textContent = data.recommendation;

  // Scroll smoothly to result
  resultContent.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// Reset Result UI
function resetResultUI() {
  emptyResult.classList.remove("hidden");
  resultContent.classList.add("hidden");
}

// Set Loading State for Submit Button
function setLoadingState(isLoading) {
  const btnText = btnSubmit.querySelector(".btn-text");
  const spinner = btnSubmit.querySelector(".spinner");

  if (isLoading) {
    btnSubmit.disabled = true;
    btnText.classList.add("hidden");
    spinner.classList.remove("hidden");
  } else {
    btnSubmit.disabled = false;
    btnText.classList.remove("hidden");
    spinner.classList.add("hidden");
  }
}

// Load History from Backend API
async function loadHistory() {
  try {
    const res = await fetch(`${API_BASE_URL}/history`);
    if (!res.ok) throw new Error("Gagal mengambil riwayat");

    historyData = await res.json();
    updateStats(historyData);
    renderCharts(historyData);
    filterAndRenderHistory();
  } catch (err) {
    historyTableBody.innerHTML = `
      <tr>
        <td colspan="9" class="text-center" style="color:#ef4444;">
          <i class="fa-solid fa-triangle-exclamation"></i> Gagal memuat data riwayat dari server backend.
        </td>
      </tr>`;
  }
}

// Update Stats Counter
function updateStats(data) {
  const total = data.length;
  const tinggi = data.filter((item) => item.tingkat_risiko === "Tinggi").length;
  const sedang = data.filter((item) => item.tingkat_risiko === "Sedang").length;
  const rendah = data.filter((item) => item.tingkat_risiko === "Rendah").length;

  statTotal.textContent = total;
  statTinggi.textContent = tinggi;
  statSedang.textContent = sedang;
  statRendah.textContent = rendah;
}

// Render Analytics Charts (Chart.js)
function renderCharts(data) {
  if (typeof Chart === "undefined") return;

  // 1. Category Chart Data
  const catCounts = {};
  data.forEach(item => {
    const cat = item.kategori || "Lainnya";
    catCounts[cat] = (catCounts[cat] || 0) + 1;
  });

  const catLabels = Object.keys(catCounts);
  const catValues = Object.values(catCounts);

  const ctxCat = document.getElementById("categoryChart")?.getContext("2d");
  if (ctxCat) {
    if (categoryChartInstance) categoryChartInstance.destroy();
    categoryChartInstance = new Chart(ctxCat, {
      type: "doughnut",
      data: {
        labels: catLabels.length > 0 ? catLabels : ["Belum ada data"],
        datasets: [{
          data: catValues.length > 0 ? catValues : [1],
          backgroundColor: ["#2563eb", "#ea580c", "#16a34a", "#dc2626", "#8b5cf6", "#06b6d4", "#ec4899", "#64748b"]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom", labels: { font: { size: 11 } } } }
      }
    });
  }

  // 2. District Chart Data
  const distCounts = {};
  data.forEach(item => {
    const dist = item.kecamatan || "Purwokerto Timur";
    distCounts[dist] = (distCounts[dist] || 0) + 1;
  });

  const distLabels = Object.keys(distCounts);
  const distValues = Object.values(distCounts);

  const ctxDist = document.getElementById("districtChart")?.getContext("2d");
  if (ctxDist) {
    if (districtChartInstance) districtChartInstance.destroy();
    districtChartInstance = new Chart(ctxDist, {
      type: "bar",
      data: {
        labels: distLabels.length > 0 ? distLabels : ["Purwokerto Timur"],
        datasets: [{
          label: "Jumlah Konflik",
          data: distValues.length > 0 ? distValues : [0],
          backgroundColor: "#3b82f6",
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
        plugins: { legend: { display: false } }
      }
    });
  }
}

// Filter & Render History Table
function filterAndRenderHistory() {
  const searchTerm = historySearch.value.toLowerCase().trim();
  const selectedRisk = filterRisk.value;

  const filtered = historyData.filter((item) => {
    const matchesSearch =
      item.teks_input.toLowerCase().includes(searchTerm) ||
      item.kategori.toLowerCase().includes(searchTerm) ||
      (item.kecamatan && item.kecamatan.toLowerCase().includes(searchTerm));
    const matchesRisk =
      selectedRisk === "ALL" || item.tingkat_risiko === selectedRisk;
    return matchesSearch && matchesRisk;
  });

  if (filtered.length === 0) {
    historyTableBody.innerHTML = `
      <tr>
        <td colspan="9" class="text-center" style="color:var(--text-muted); padding:30px;">
          Tidak ada data riwayat laporan yang cocok.
        </td>
      </tr>`;
    return;
  }

  historyTableBody.innerHTML = filtered
    .map((item, index) => {
      const dateStr = item.created_at
        ? new Date(item.created_at).toLocaleString("id-ID", {
            dateStyle: "short",
            timeStyle: "short",
          })
        : "-";

      let pillClass = "pill-green";
      if (item.tingkat_risiko === "Tinggi") pillClass = "pill-red";
      else if (item.tingkat_risiko === "Sedang") pillClass = "pill-orange";

      const currentStatus = item.status_penanganan || "Dalam Proses";

      return `
        <tr>
          <td>${index + 1}</td>
          <td style="white-space:nowrap;">${dateStr}</td>
          <td><strong>${escapeHtml(item.kecamatan || "Purwokerto Timur")}</strong></td>
          <td>${escapeHtml(item.pihak_terlibat || "-")}</td>
          <td style="max-width:250px;">${escapeHtml(item.teks_input)}</td>
          <td>${escapeHtml(item.kategori)}</td>
          <td><span class="pill ${pillClass}">${item.tingkat_risiko}</span></td>
          <td>
            <select class="status-select" onchange="updateStatusPenanganan(${item.id}, this.value)">
              <option value="Dalam Proses" ${currentStatus === "Dalam Proses" ? "selected" : ""}>Dalam Proses</option>
              <option value="Mediasi" ${currentStatus === "Mediasi" ? "selected" : ""}>Mediasi</option>
              <option value="Tertangani" ${currentStatus === "Tertangani" ? "selected" : ""}>Tertangani</option>
            </select>
          </td>
          <td>
            <button class="btn-sm-danger" onclick="deleteHistoryItem(${item.id})" title="Hapus Riwayat">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </td>
        </tr>
      `;
    })
    .join("");
}

// Update Status Penanganan via API
async function updateStatusPenanganan(id, newStatus) {
  try {
    const res = await fetch(`${API_BASE_URL}/history/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status_penanganan: newStatus })
    });
    if (!res.ok) throw new Error("Gagal mengupdate status");
    await loadHistory();
  } catch (err) {
    alert("Terjadi kesalahan saat mengupdate status penanganan.");
  }
}

// Export Excel Function
function handleExportExcel() {
  window.open(`${API_BASE_URL}/export/excel`, "_blank");
}

// Delete History Item
async function deleteHistoryItem(id) {
  if (!confirm("Apakah Anda yakin ingin menghapus catatan riwayat ini?")) return;

  try {
    const res = await fetch(`${API_BASE_URL}/history/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      await loadHistory();
    } else {
      alert("Gagal menghapus riwayat.");
    }
  } catch (err) {
    alert("Terjadi kesalahan koneksi saat menghapus.");
  }
}

// Handle Clear All History
async function handleClearAllHistory() {
  if (historyData.length === 0) {
    alert("Riwayat masih kosong.");
    return;
  }

  if (!confirm("PERINGATAN: Apakah Anda yakin ingin menghapus SELURUH riwayat laporan?")) {
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/history`, {
      method: "DELETE",
    });
    if (res.ok) {
      await loadHistory();
    } else {
      alert("Gagal membersihkan riwayat.");
    }
  } catch (err) {
    alert("Terjadi kesalahan jaringan.");
  }
}

// Theme Toggle Functionality
function toggleTheme() {
  const isDark = document.body.classList.toggle("dark-mode");
  const icon = themeToggle.querySelector("i");

  if (isDark) {
    icon.className = "fa-solid fa-sun";
    localStorage.setItem("theme", "dark");
  } else {
    icon.className = "fa-solid fa-moon";
    localStorage.setItem("theme", "light");
  }
}

function setupTheme() {
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark") {
    document.body.classList.add("dark-mode");
    themeToggle.querySelector("i").className = "fa-solid fa-sun";
  }
}

// Print Recommendation Card
function printRecommendation() {
  const printWindow = window.open("", "_blank");
  const kat = resCategory.textContent;
  const risk = resRiskBadge.textContent;
  const rec = resRecommendation.textContent;
  const text = textInput.value;
  const kec = resKecamatan.textContent;
  const pihak = resPihak.textContent;

  printWindow.document.write(`
    <html>
      <head>
        <title>Lembar Rekomendasi Penanganan Konflik - BAKESBANGPOL Banyumas</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; color: #111; line-height: 1.6; }
          h2 { text-align: center; margin-bottom: 5px; }
          p.sub { text-align: center; color: #555; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 10px; }
          .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          .meta-table td { padding: 8px; border: 1px solid #ccc; }
          .meta-table td.bg { background: #f0f0f0; font-weight: bold; width: 180px; }
          .rec-box { background: #f9f9f9; border-left: 5px solid #2563eb; padding: 15px; margin-top: 20px; font-size: 1.1em; }
          .footer-sig { margin-top: 50px; text-align: right; }
        </style>
      </head>
      <body>
        <h2>BADAN KESATUAN BANGSA DAN POLITIK KABUPATEN BANYUMAS</h2>
        <p class="sub">LEMBAR REKOMENDASI SPK PENANGANAN KONFLIK SOSIAL</p>
        
        <table class="meta-table">
          <tr>
            <td class="bg">Tanggal Analisis</td>
            <td>${new Date().toLocaleString("id-ID")}</td>
          </tr>
          <tr>
            <td class="bg">Kecamatan Lokasi</td>
            <td><strong>${escapeHtml(kec)}</strong></td>
          </tr>
          <tr>
            <td class="bg">Pihak Terlibat</td>
            <td>${escapeHtml(pihak)}</td>
          </tr>
          <tr>
            <td class="bg">Uraian Laporan</td>
            <td>${escapeHtml(text)}</td>
          </tr>
          <tr>
            <td class="bg">Hasil Klasifikasi Kategori</td>
            <td>${escapeHtml(kat)}</td>
          </tr>
          <tr>
            <td class="bg">Tingkat Risiko Sosial</td>
            <td><strong>${escapeHtml(risk)}</strong></td>
          </tr>
        </table>

        <h3>REKOMENDASI & TINDAKAN LAPANGAN:</h3>
        <div class="rec-box">
          ${escapeHtml(rec)}
        </div>

        <div class="footer-sig">
          <p>Purwokerto, ${new Date().toLocaleDateString("id-ID", { dateStyle: "long" })}</p>
          <br><br><br>
          <p><strong>Tim Satgas Penanganan Konflik Bakesbangpol Banyumas</strong></p>
        </div>

        <script>
          window.onload = function() { window.print(); window.close(); }
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

// Utility: Escape HTML
function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
