// ==========================================
// DATA DEFAULT AWAL
// ==========================================
const DEFAULT_CRITERIA = [
    { code: "C1", name: "Harga", weight: 0.2168, type: "cost" },
    { code: "C2", name: "Kualitas Rasa", weight: 0.1858, type: "benefit" },
    { code: "C3", name: "Kekuatan Aroma", weight: 0.1832, type: "benefit" },
    { code: "C4", name: "Konsistensi Sajian", weight: 0.2159, type: "benefit" },
    { code: "C5", name: "Aftertaste", weight: 0.1983, type: "benefit" }
];

const DEFAULT_ALTERNATIVES = [
    { name: "Robusta Pupuan Bali", values: [120000, 3.5, 3.5, 4, 3] },
    { name: "City Plus Coffee (Robusta)", values: [130000, 3.5, 4, 4, 3.5] },
    { name: "Local Blend (Arabika 30% : Robusta 70%)", values: [150000, 4, 4, 4.5, 4] },
    { name: "Robusta Bangka", values: [100000, 3, 3, 3.5, 3] },
    { name: "Ijen Lestari", values: [220000, 4.5, 4.5, 4, 4.5] }
];

// State Aplikasi
let criteriaState = [];
let alternativesState = [];
let lastCalculationResult = null;
let cidAutoIncrement = 1;
let aidAutoIncrement = 1;
let barChartInstance = null;
let radarChartInstance = null;
let sensitivityWeights = [];

// Inisialisasi saat window dimuat
window.onload = function () {
    resetDefaultData();
};

// ==========================================
// NAVIGASI ANTAR MODUL
// ==========================================
function switchModule(moduleNumber) {
    // Validasi saat ingin berpindah dari Modul 1 ke modul berikutnya
    if (moduleNumber === 2 || moduleNumber === 3 || moduleNumber === 4) {
        const critCheck = validateCriteriaModule();
        if (!critCheck.valid) {
            showNotification("Validasi Kriteria Belum Terpenuhi", critCheck.message, true);
            if (critCheck.cid) highlightInvalidCriterionInput(critCheck.cid);
            activateModuleDirect(1);
            return;
        }
    }

    // Validasi saat ingin berpindah ke Modul 3 atau 4 (Hasil/Sensitivitas)
    if (moduleNumber === 3 || moduleNumber === 4) {
        const matCheck = validateMatrixModule();
        if (!matCheck.valid) {
            showNotification("Validasi Matriks Belum Terpenuhi", matCheck.message, true);
            if (matCheck.aid && matCheck.cid) highlightInvalidAlternativeInput(matCheck.aid, matCheck.cid);
            activateModuleDirect(2);
            return;
        }
        if (!lastCalculationResult) {
            hitungEDAS(false);
            if (!lastCalculationResult) return;
        }
    }

    activateModuleDirect(moduleNumber);

    if (moduleNumber === 4) {
        initSensitivityModule();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function activateModuleDirect(moduleNumber) {
    for (let i = 1; i <= 4; i++) {
        const panel = document.getElementById("module" + i);
        const tab = document.getElementById("tabModul" + i);
        if (panel && tab) {
            const isActive = i === moduleNumber;
            panel.classList.toggle("active", isActive);
            tab.classList.toggle("active", isActive);
            const badge = tab.querySelector("span");
            if (badge) {
                badge.className = isActive
                    ? "w-5 h-5 rounded-full bg-white/20 text-xs flex items-center justify-center font-bold"
                    : "w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-xs flex items-center justify-center font-bold";
            }
        }
    }
}

// ==========================================
// MODAL NOTIFIKASI
// ==========================================
function showNotification(title, message, isError = false) {
    const modal = document.getElementById("customModal");
    const modalIcon = document.getElementById("modalIcon");
    const modalTitle = document.getElementById("modalTitle");
    const modalMessage = document.getElementById("modalMessage");

    modalTitle.innerText = title;
    modalMessage.innerText = message;

    if (isError) {
        modalIcon.className = "w-12 h-12 rounded-full mx-auto flex items-center justify-center mb-3 text-lg bg-rose-100 text-rose-600";
        modalIcon.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
    } else {
        modalIcon.className = "w-12 h-12 rounded-full mx-auto flex items-center justify-center mb-3 text-lg bg-indigo-100 text-indigo-600";
        modalIcon.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
    }

    modal.classList.remove("hidden");
}

function closeModal() {
    document.getElementById("customModal").classList.add("hidden");
}

// ==========================================
// RESET & PRESET BOBOT
// ==========================================
function resetDefaultData() {
    criteriaState = [];
    alternativesState = [];
    cidAutoIncrement = 1;
    aidAutoIncrement = 1;

    DEFAULT_CRITERIA.forEach(c => {
        criteriaState.push({
            id: cidAutoIncrement++,
            code: c.code,
            name: c.name,
            weight: c.weight,
            type: c.type
        });
    });

    DEFAULT_ALTERNATIVES.forEach(a => {
        let valMap = {};
        criteriaState.forEach((crit, idx) => {
            valMap[crit.id] = a.values[idx] !== undefined ? a.values[idx] : 0;
        });
        alternativesState.push({
            id: aidAutoIncrement++,
            name: a.name,
            values: valMap
        });
    });

    renderAllTables();
    updateTotalWeightBadge();

    document.getElementById("topRecommendationContainer").classList.add("hidden");
    document.getElementById("chartsContainer").classList.add("hidden");
    document.getElementById("accordionContainer").classList.add("hidden");
    document.getElementById("rankingTableBody").innerHTML = `
        <tr>
            <td colspan="8" class="p-6 text-center text-slate-400 text-sm">
                Data belum dihitung. Tekan tombol <strong>"Hitung EDAS"</strong> untuk memproses perangkingan.
            </td>
        </tr>
    `;
    lastCalculationResult = null;
    switchModule(1);
}

function applyPreset(presetType) {
    if (criteriaState.length === 0) return;

    if (presetType === "default") {
        const defMap = { "C1": 0.2168, "C2": 0.1858, "C3": 0.1832, "C4": 0.2159, "C5": 0.1983 };
        criteriaState.forEach(c => {
            if (defMap[c.code] !== undefined) c.weight = defMap[c.code];
        });
    } else if (presetType === "quality") {
        // Prioritas rasa, aroma & aftertaste
        criteriaState.forEach(c => {
            if (c.code === "C2") c.weight = 0.30;
            else if (c.code === "C3") c.weight = 0.25;
            else if (c.code === "C5") c.weight = 0.20;
            else if (c.code === "C4") c.weight = 0.15;
            else c.weight = 0.10;
        });
    } else if (presetType === "cost") {
        // Prioritas efisiensi biaya
        criteriaState.forEach(c => {
            if (c.code === "C1") c.weight = 0.40;
            else if (c.code === "C4") c.weight = 0.20;
            else if (c.code === "C2") c.weight = 0.15;
            else if (c.code === "C3") c.weight = 0.15;
            else c.weight = 0.10;
        });
    } else if (presetType === "equal") {
        const eq = parseFloat((1 / criteriaState.length).toFixed(4));
        criteriaState.forEach(c => c.weight = eq);
    }

    normalizeWeights();
    renderCriteriaTable();
}

function normalizeWeights() {
    const total = criteriaState.reduce((sum, c) => sum + (c.weight || 0), 0);
    if (total <= 0) return;
    criteriaState.forEach(c => {
        c.weight = parseFloat((c.weight / total).toFixed(4));
    });
    // Koreksi pembulatan kecil pada elemen terakhir agar tepat 1.0000
    const newTotal = criteriaState.reduce((sum, c) => sum + c.weight, 0);
    const diff = 1.0 - newTotal;
    if (criteriaState.length > 0 && Math.abs(diff) < 0.05) {
        criteriaState[criteriaState.length - 1].weight = parseFloat((criteriaState[criteriaState.length - 1].weight + diff).toFixed(4));
    }
    renderCriteriaTable();
    updateTotalWeightBadge();
}

// ==========================================
// VALIDASI & INPUT HELPER
// ==========================================

// Blokir karakter non-angka positif: '-', '+', 'e', 'E'
function blockInvalidNumberKeys(event) {
    if (event.key === '-' || event.key === '+' || event.key === 'e' || event.key === 'E') {
        event.preventDefault();
        return false;
    }
}

// Berikan umpan balik visual (border merah / highlight) pada elemen input
function setInputValidationStyle(inputEl, isValid) {
    if (!inputEl) return;
    if (isValid) {
        inputEl.classList.remove("border-rose-500", "bg-rose-50", "ring-1", "ring-rose-500", "text-rose-900");
        inputEl.classList.add("border-slate-300", "bg-white", "text-slate-800");
    } else {
        inputEl.classList.remove("border-slate-300", "bg-white", "text-slate-800");
        inputEl.classList.add("border-rose-500", "bg-rose-50", "ring-1", "ring-rose-500", "text-rose-900");
    }
}

function highlightInvalidCriterionInput(cid) {
    const el = document.getElementById("crit_weight_" + cid);
    if (el) {
        setInputValidationStyle(el, false);
        el.focus();
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function highlightInvalidAlternativeInput(aid, cid) {
    const el = document.getElementById(`alt_input_${aid}_${cid}`);
    if (el) {
        setInputValidationStyle(el, false);
        el.focus();
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

// Fungsi Validasi Modul 1 (Kriteria & Bobot)
function validateCriteriaModule() {
    if (criteriaState.length < 1) {
        return { valid: false, message: "Minimal harus terdapat 1 kriteria evaluasi biji kopi." };
    }

    for (const c of criteriaState) {
        if (isNaN(c.weight) || c.weight <= 0 || c.weight > 1) {
            return {
                valid: false,
                cid: c.id,
                message: `Bobot kriteria '${c.name}' (${c.code}) bernilai ${c.weight}. Setiap bobot wajib bernilai positif antara 0.0001 dan 1.0000 (tidak boleh 0, negatif, kosong, atau huruf).`
            };
        }
    }

    const total = criteriaState.reduce((sum, c) => sum + (c.weight || 0), 0);
    if (Math.abs(total - 1.0) > 0.0001) {
        return {
            valid: false,
            message: `Total penjumlahan seluruh bobot kriteria saat ini adalah ${total.toFixed(4)}. Total bobot wajib tepat sama dengan 1.0000. Silakan klik tombol 'Normalisasi Total = 1' atau sesuaikan bobot Anda.`
        };
    }

    return { valid: true };
}

// Fungsi Validasi Modul 2 (Alternatif & Matriks Nilai)
function validateMatrixModule() {
    if (alternativesState.length < 2) {
        return {
            valid: false,
            message: "Metode EDAS memerlukan minimal 2 alternatif biji kopi untuk melakukan perbandingan dan perankingan."
        };
    }

    for (const a of alternativesState) {
        if (!a.name || a.name.trim() === "") {
            return {
                valid: false,
                message: "Ditemukan alternatif dengan nama kosong. Mohon lengkapi seluruh nama alternatif biji kopi."
            };
        }
        for (const c of criteriaState) {
            const val = a.values[c.id];
            if (val === undefined || isNaN(val) || val <= 0) {
                return {
                    valid: false,
                    aid: a.id,
                    cid: c.id,
                    message: `Nilai kinerja alternatif '${a.name}' pada kriteria '${c.name}' (${c.code}) bernilai ${val !== undefined ? val : 'kosong'}. Dalam metode EDAS, semua nilai alternatif wajib berupa angka positif (> 0) karena menjadi pembagi solusi rata-rata (AV). Dilarang memasukkan angka 0, nilai negatif, atau membiarkan kosong.`
                };
            }
        }
    }

    return { valid: true };
}

// ==========================================
// RENDER TABEL (MODUL 1 & MODUL 2)
// ==========================================
function renderAllTables() {
    renderCriteriaTable();
    renderAlternativeTable();
}

function renderCriteriaTable() {
    const tbody = document.getElementById("criteriaTableBody");
    tbody.innerHTML = "";

    criteriaState.forEach((c, index) => {
        c.code = "C" + (index + 1);
        const percent = ((c.weight || 0) * 100).toFixed(2) + "%";
        const isValidWeight = !isNaN(c.weight) && c.weight > 0 && c.weight <= 1;
        const inputClass = isValidWeight
            ? "w-28 text-center px-2 py-1.5 border border-slate-300 rounded-md text-xs sm:text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            : "w-28 text-center px-2 py-1.5 border-2 border-rose-500 bg-rose-50 text-rose-900 rounded-md text-xs sm:text-sm focus:ring-1 focus:ring-rose-500 focus:outline-none";

        const tr = document.createElement("tr");
        tr.className = "hover:bg-slate-50 transition";
        tr.innerHTML = `
            <td class="p-3 text-center font-bold text-slate-700">${c.code}</td>
            <td class="p-3">
                <input type="text" value="${c.name}" onchange="updateCriterionName(${c.id}, this.value)"
                    class="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs sm:text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-none">
            </td>
            <td class="p-3 text-center">
                <input type="number" id="crit_weight_${c.id}" step="0.0001" min="0.0001" max="1" value="${c.weight}"
                    onkeydown="blockInvalidNumberKeys(event)"
                    oninput="onCriterionWeightInput(${c.id}, this)"
                    onchange="updateCriterionWeight(${c.id}, this.value, this)"
                    class="${inputClass}">
            </td>
            <td class="p-3 text-center text-xs text-slate-500 font-medium" id="crit_percent_${c.id}">${percent}</td>
            <td class="p-3 text-center">
                <select onchange="updateCriterionType(${c.id}, this.value)"
                    class="px-2 py-1.5 border border-slate-300 rounded-md text-xs sm:text-sm bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none">
                    <option value="benefit" ${c.type === 'benefit' ? 'selected' : ''}>Benefit</option>
                    <option value="cost" ${c.type === 'cost' ? 'selected' : ''}>Cost</option>
                </select>
            </td>
            <td class="p-3 text-center no-print">
                <button onclick="removeCriterion(${c.id})" class="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded transition" title="Hapus Kriteria">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    updateTotalWeightBadge();
}

function onCriterionWeightInput(cid, inputEl) {
    const raw = inputEl.value;
    const val = parseFloat(raw);
    const isValid = !isNaN(val) && val > 0 && val <= 1;
    setInputValidationStyle(inputEl, isValid);

    const c = criteriaState.find(item => item.id === cid);
    if (c) {
        c.weight = isValid ? val : (isNaN(val) ? 0 : val);
        const percentEl = document.getElementById("crit_percent_" + cid);
        if (percentEl) {
            percentEl.innerText = ((c.weight || 0) * 100).toFixed(2) + "%";
        }
    }
    updateTotalWeightBadge();
}

function addCriterion() {
    const nextIdx = criteriaState.length + 1;
    const newCid = cidAutoIncrement++;
    criteriaState.push({
        id: newCid,
        code: "C" + nextIdx,
        name: "Kriteria Baru " + nextIdx,
        weight: 0.10,
        type: "benefit"
    });

    alternativesState.forEach(a => {
        // Inisialisasi nilai dengan angka positif (> 0)
        a.values[newCid] = 1;
    });

    normalizeWeights();
    renderAllTables();
}

function updateCriterionName(cid, val) {
    const c = criteriaState.find(item => item.id === cid);
    if (c) c.name = val;
    renderAlternativeTable();
}

function updateCriterionWeight(cid, val, inputEl) {
    const parsed = parseFloat(val);
    const isValid = !isNaN(parsed) && parsed > 0 && parsed <= 1;
    if (inputEl) setInputValidationStyle(inputEl, isValid);

    const c = criteriaState.find(item => item.id === cid);
    if (c) {
        c.weight = isNaN(parsed) ? 0 : parsed;
        const percentEl = document.getElementById("crit_percent_" + cid);
        if (percentEl) {
            percentEl.innerText = ((c.weight || 0) * 100).toFixed(2) + "%";
        }
    }
    updateTotalWeightBadge();
}

function updateCriterionType(cid, val) {
    const c = criteriaState.find(item => item.id === cid);
    if (c) c.type = val;
    renderAlternativeTable();
}

function removeCriterion(cid) {
    if (criteriaState.length <= 1) {
        showNotification("Peringatan", "Minimal harus ada 1 kriteria penilaian.", true);
        return;
    }
    criteriaState = criteriaState.filter(item => item.id !== cid);
    alternativesState.forEach(a => {
        delete a.values[cid];
    });
    normalizeWeights();
    renderAllTables();
}

function updateTotalWeightBadge() {
    const total = criteriaState.reduce((sum, c) => sum + (c.weight || 0), 0);
    const badge = document.getElementById("statusBobotBadge");
    const hasInvalidWeight = criteriaState.some(c => isNaN(c.weight) || c.weight <= 0 || c.weight > 1);
    const isSumValid = Math.abs(total - 1.0) <= 0.0001;
    const isValid = isSumValid && !hasInvalidWeight;

    if (badge) {
        if (isValid) {
            badge.className = "text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200";
            badge.innerHTML = `<i class="fa-solid fa-circle-check mr-1"></i> Total Bobot: ${total.toFixed(4)} (100% Sesuai Aturan)`;
        } else {
            badge.className = "text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200";
            badge.innerHTML = `<i class="fa-solid fa-triangle-exclamation mr-1"></i> Total Bobot: ${total.toFixed(4)} (Wajib = 1.0000)`;
        }
    }

    updateCriteriaValidationAlert(total, hasInvalidWeight, isSumValid);
}

function updateCriteriaValidationAlert(total, hasInvalidWeight, isSumValid) {
    const alertBox = document.getElementById("criteriaValidationAlert");
    const alertText = document.getElementById("criteriaValidationAlertText");
    if (!alertBox || !alertText) return;

    if (hasInvalidWeight) {
        alertBox.classList.remove("hidden");
        alertText.innerHTML = `<strong>Validasi Gagal:</strong> Terdapat bobot kriteria yang bernilai 0, negatif, kosong, atau melebihi 1. Setiap bobot kriteria <strong>wajib berupa angka positif (> 0 dan &le; 1)</strong>.`;
    } else if (!isSumValid) {
        alertBox.classList.remove("hidden");
        alertText.innerHTML = `<strong>Total Bobot Tidak Tepat:</strong> Jumlah seluruh bobot kriteria adalah <strong>${total.toFixed(4)}</strong> (selisih: ${(total - 1.0).toFixed(4)}). Aturan EDAS mewajibkan total bobot <strong>tepat sama dengan 1.0000</strong>. Silakan klik tombol <strong>"Normalisasi Total = 1"</strong> untuk penyesuaian otomatis.`;
    } else {
        alertBox.classList.add("hidden");
    }
}

// ==========================================
// PENGELOLAAN ALTERNATIF (MODUL 2)
// ==========================================
function renderAlternativeTable(filterQuery = "") {
    const headerRow = document.getElementById("altHeader");
    const tbody = document.getElementById("altTableBody");

    headerRow.innerHTML = `
        <th class="p-3 border-b border-slate-200 min-w-[200px]">Biji Kopi (Alternatif)</th>
    `;
    criteriaState.forEach(c => {
        const th = document.createElement("th");
        th.className = "p-3 border-b border-slate-200 text-center min-w-[130px]";
        th.innerHTML = `
            <div class="font-bold text-slate-800">${c.code}</div>
            <div class="text-[10px] font-normal text-slate-500 truncate max-w-[130px] mx-auto" title="${c.name}">${c.name}</div>
            <span class="inline-block px-1.5 py-0.5 text-[10px] rounded font-semibold ${c.type === 'benefit' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">
                ${c.type.toUpperCase()}
            </span>
        `;
        headerRow.appendChild(th);
    });

    const actionTh = document.createElement("th");
    actionTh.className = "p-3 border-b border-slate-200 w-20 text-center no-print";
    actionTh.innerText = "Aksi";
    headerRow.appendChild(actionTh);

    tbody.innerHTML = "";
    const query = filterQuery.toLowerCase().trim();

    alternativesState.forEach(a => {
        if (query && !a.name.toLowerCase().includes(query)) {
            return;
        }

        const tr = document.createElement("tr");
        tr.className = "hover:bg-slate-50 transition";

        let rowHtml = `
            <td class="p-3">
                <input type="text" value="${a.name}" onchange="updateAlternativeName(${a.id}, this.value)"
                    class="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs sm:text-sm font-medium text-slate-800 focus:ring-1 focus:ring-indigo-500 focus:outline-none">
            </td>
        `;

        criteriaState.forEach(c => {
            const rawVal = a.values[c.id];
            const val = rawVal !== undefined ? rawVal : 0;
            const isValid = !isNaN(val) && val > 0;
            const inputClass = isValid
                ? "w-28 text-center px-2 py-1.5 border border-slate-300 rounded-md text-xs sm:text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                : "w-28 text-center px-2 py-1.5 border-2 border-rose-500 bg-rose-50 text-rose-900 rounded-md text-xs sm:text-sm focus:ring-1 focus:ring-rose-500 focus:outline-none";

            rowHtml += `
                <td class="p-3 text-center">
                    <input type="number" id="alt_input_${a.id}_${c.id}" step="any" min="0.01" value="${val}"
                        onkeydown="blockInvalidNumberKeys(event)"
                        oninput="onAlternativeValueInput(${a.id}, ${c.id}, this)"
                        onchange="updateAlternativeValue(${a.id}, ${c.id}, this.value, this)"
                        class="${inputClass}">
                </td>
            `;
        });

        rowHtml += `
            <td class="p-3 text-center no-print">
                <button onclick="removeAlternative(${a.id})" class="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded transition" title="Hapus Alternatif">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </td>
        `;

        tr.innerHTML = rowHtml;
        tbody.appendChild(tr);
    });

    updateMatrixValidationAlert();
}

function onAlternativeValueInput(aid, cid, inputEl) {
    const raw = inputEl.value;
    const val = parseFloat(raw);
    const isValid = !isNaN(val) && val > 0;
    setInputValidationStyle(inputEl, isValid);

    const a = alternativesState.find(item => item.id === aid);
    if (a) {
        a.values[cid] = isValid ? val : (isNaN(val) ? 0 : val);
    }
    updateMatrixValidationAlert();
}

function filterAlternatives(val) {
    renderAlternativeTable(val);
}

function addAlternative() {
    const nextIdx = alternativesState.length + 1;
    const newAid = aidAutoIncrement++;
    let valMap = {};
    criteriaState.forEach(c => {
        // Wajib default bernilai positif (> 0)
        valMap[c.id] = 1;
    });

    alternativesState.push({
        id: newAid,
        name: "Varietas Kopi " + nextIdx,
        values: valMap
    });

    renderAlternativeTable();
}

function updateAlternativeName(aid, val) {
    const a = alternativesState.find(item => item.id === aid);
    if (a) a.name = val;
}

function updateAlternativeValue(aid, cid, val, inputEl) {
    const parsed = parseFloat(val);
    const isValid = !isNaN(parsed) && parsed > 0;
    if (inputEl) setInputValidationStyle(inputEl, isValid);

    const a = alternativesState.find(item => item.id === aid);
    if (a) {
        a.values[cid] = isNaN(parsed) ? 0 : parsed;
    }
    updateMatrixValidationAlert();
}

function removeAlternative(aid) {
    if (alternativesState.length <= 2) {
        showNotification("Peringatan", "Minimal harus ada 2 alternatif biji kopi agar perankingan EDAS valid.", true);
        return;
    }
    alternativesState = alternativesState.filter(item => item.id !== aid);
    renderAlternativeTable();
}

function updateMatrixValidationAlert() {
    const alertBox = document.getElementById("matrixValidationAlert");
    const alertText = document.getElementById("matrixValidationAlertText");
    if (!alertBox || !alertText) return;

    if (alternativesState.length < 2) {
        alertBox.classList.remove("hidden");
        alertText.innerHTML = `<strong>Jumlah Alternatif Kurang:</strong> Metode EDAS memerlukan <strong>minimal 2 alternatif biji kopi</strong> untuk proses perankingan. Silakan klik tombol <strong>"Tambah Alternatif"</strong>.`;
        return;
    }

    let invalidCount = 0;
    for (const a of alternativesState) {
        for (const c of criteriaState) {
            const val = a.values[c.id];
            if (val === undefined || isNaN(val) || val <= 0) {
                invalidCount++;
            }
        }
    }

    if (invalidCount > 0) {
        alertBox.classList.remove("hidden");
        alertText.innerHTML = `<strong>Nilai Tidak Valid Ditemukan (${invalidCount} sel):</strong> Dalam algoritma EDAS, seluruh nilai kinerja alternatif <strong>wajib berupa angka positif (> 0)</strong> karena menjadi pembagi solusi rata-rata (AV). Dilarang memasukkan angka 0, nilai negatif, atau membiarkan sel kosong.`;
    } else {
        alertBox.classList.add("hidden");
    }
}

// ==========================================
// HITUNG EDAS LENGKAP (MODUL 3)
// ==========================================
function executeEDASCore(criteria, weights, alternatives) {
    const m = alternatives.length;
    const n = criteria.length;

    if (m < 2) {
        throw new Error("Minimal diperlukan 2 alternatif untuk proses perankingan metode EDAS.");
    }
    if (n < 1) {
        throw new Error("Minimal diperlukan 1 kriteria untuk proses perhitungan metode EDAS.");
    }

    // 1. Matriks Keputusan (X)
    let X = [];
    for (let i = 0; i < m; i++) {
        let row = [];
        for (let j = 0; j < n; j++) {
            const cid = criteria[j].id;
            const val = alternatives[i].values[cid];
            if (val === undefined || isNaN(val) || val <= 0) {
                throw new Error(`Nilai kinerja alternatif '${alternatives[i].name}' pada kriteria '${criteria[j].name}' (${criteria[j].code}) bernilai ${val}. Seluruh nilai kinerja wajib berupa angka positif (> 0).`);
            }
            row.push(val);
        }
        X.push(row);
    }

    // 2. Solusi Rata-rata (AV) dengan Division by Zero Guard
    let AV = [];
    for (let j = 0; j < n; j++) {
        let sum = 0;
        for (let i = 0; i < m; i++) sum += X[i][j];
        const avg = sum / m;
        if (isNaN(avg) || avg <= 0) {
            throw new Error(`Kriteria '${criteria[j].name}' (${criteria[j].code}) memiliki nilai rata-rata (AV) = ${avg} (<= 0). Pembagian dengan nol dicegah. Setiap kriteria harus memiliki nilai alternatif positif (> 0).`);
        }
        AV.push(avg);
    }

    // 3. Jarak Positif & Negatif dari Rata-rata (PDA & NDA)
    let PDA = Array.from({ length: m }, () => Array(n).fill(0));
    let NDA = Array.from({ length: m }, () => Array(n).fill(0));

    for (let i = 0; i < m; i++) {
        for (let j = 0; j < n; j++) {
            const x = X[i][j];
            const av = AV[j];
            const type = criteria[j].type;

            if (av <= 0) {
                PDA[i][j] = 0;
                NDA[i][j] = 0;
            } else if (type === "benefit") {
                PDA[i][j] = Math.max(0, (x - av) / av);
                NDA[i][j] = Math.max(0, (av - x) / av);
            } else {
                PDA[i][j] = Math.max(0, (av - x) / av);
                NDA[i][j] = Math.max(0, (x - av) / av);
            }
        }
    }

    // 4. Jumlah Terbobot Jarak Positif & Negatif (SP & SN)
    let SP = [];
    let SN = [];
    for (let i = 0; i < m; i++) {
        let spSum = 0;
        let snSum = 0;
        for (let j = 0; j < n; j++) {
            spSum += weights[j] * PDA[i][j];
            snSum += weights[j] * NDA[i][j];
        }
        SP.push(spSum);
        SN.push(snSum);
    }

    // 5. Normalisasi NSP & NSN (Guard Division by Zero jika max(SP) === 0 atau max(SN) === 0)
    let maxSP = Math.max(...SP);
    let maxSN = Math.max(...SN);

    let NSP = SP.map(sp => (maxSP <= 0 ? 0 : sp / maxSP));
    let NSN = SN.map(sn => (maxSN <= 0 ? 1 : 1 - (sn / maxSN)));

    // 6. Penilaian Skor Akhir (Appraisal Score - AS)
    let AS = [];
    for (let i = 0; i < m; i++) {
        AS.push(0.5 * (NSP[i] + NSN[i]));
    }

    // 7. Perangkingan
    let results = [];
    for (let i = 0; i < m; i++) {
        results.push({
            index: i,
            name: alternatives[i].name,
            sp: SP[i],
            sn: SN[i],
            nsp: NSP[i],
            nsn: NSN[i],
            as: AS[i]
        });
    }
    results.sort((a, b) => b.as - a.as);

    return {
        criteria: criteria,
        weights: weights,
        alternatives: alternatives,
        X: X,
        AV: AV,
        PDA: PDA,
        NDA: NDA,
        SP: SP,
        SN: SN,
        NSP: NSP,
        NSN: NSN,
        AS: AS,
        ranking: results
    };
}

function hitungEDAS(navigateToModule = true) {
    const critCheck = validateCriteriaModule();
    if (!critCheck.valid) {
        showNotification("Validasi Kriteria Gagal", critCheck.message, true);
        if (critCheck.cid) highlightInvalidCriterionInput(critCheck.cid);
        activateModuleDirect(1);
        return;
    }

    const matCheck = validateMatrixModule();
    if (!matCheck.valid) {
        showNotification("Validasi Matriks Alternatif Gagal", matCheck.message, true);
        if (matCheck.aid && matCheck.cid) highlightInvalidAlternativeInput(matCheck.aid, matCheck.cid);
        activateModuleDirect(2);
        return;
    }

    let weights = criteriaState.map(c => c.weight);
    try {
        lastCalculationResult = executeEDASCore(criteriaState, weights, alternativesState);
    } catch (err) {
        showNotification("Kesalahan Perhitungan EDAS", err.message, true);
        return;
    }

    renderRankingView(lastCalculationResult.ranking);
    renderStepByStepView(lastCalculationResult);
    renderCharts(lastCalculationResult);

    if (navigateToModule) {
        activateModuleDirect(3);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

// Render Tabel Peringkat
function renderRankingView(results) {
    const tbody = document.getElementById("rankingTableBody");
    tbody.innerHTML = "";

    results.forEach((item, idx) => {
        const tr = document.createElement("tr");
        const isTop = idx === 0;

        tr.className = isTop ? "bg-indigo-50/70 font-semibold" : "hover:bg-slate-50 transition";
        tr.innerHTML = `
            <td class="p-3 text-center">
                <span class="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${idx === 0 ? 'bg-amber-400 text-slate-900 shadow-xs' :
                idx === 1 ? 'bg-slate-300 text-slate-800' :
                    idx === 2 ? 'bg-amber-700/30 text-amber-900' : 'text-slate-600'
            }">
                    ${idx + 1}
                </span>
            </td>
            <td class="p-3">
                <div class="font-medium text-slate-900">${item.name}</div>
            </td>
            <td class="p-3 text-center text-xs text-slate-600">${item.sp.toFixed(4)}</td>
            <td class="p-3 text-center text-xs text-slate-600">${item.sn.toFixed(4)}</td>
            <td class="p-3 text-center text-xs text-slate-600">${item.nsp.toFixed(4)}</td>
            <td class="p-3 text-center text-xs text-slate-600">${item.nsn.toFixed(4)}</td>
            <td class="p-3 text-center font-bold text-sm text-indigo-700">${item.as.toFixed(4)}</td>
            <td class="p-3 text-center">
                ${isTop ?
                `<span class="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                        <i class="fa-solid fa-crown text-amber-500 text-[10px]"></i> Rekomendasi
                    </span>` :
                `<span class="text-xs text-slate-400">Alternatif</span>`
            }
            </td>
        `;
        tbody.appendChild(tr);
    });

    const best = results[0];
    const topCard = document.getElementById("topRecommendationContainer");
    topCard.innerHTML = `
        <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center text-2xl shadow-xs">
                    <i class="fa-solid fa-award"></i>
                </div>
                <div>
                    <span class="text-xs font-bold tracking-wider uppercase text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">Rekomendasi Terbaik</span>
                    <h3 class="text-lg sm:text-xl font-bold text-slate-900 mt-0.5">${best.name}</h3>
                    <p class="text-xs text-slate-600 mt-0.5">Skor Penilaian (AS) tertinggi: <strong>${best.as.toFixed(4)}</strong>.</p>
                </div>
            </div>
            <div class="bg-white px-4 py-2.5 rounded-lg border border-indigo-100 shadow-xs text-center shrink-0">
                <span class="text-[10px] uppercase font-semibold text-slate-400 block">Skor Akhir (AS)</span>
                <span class="text-xl font-extrabold text-indigo-600">${best.as.toFixed(4)}</span>
            </div>
        </div>
    `;
    topCard.classList.remove("hidden");
    document.getElementById("chartsContainer").classList.remove("hidden");
    document.getElementById("accordionContainer").classList.remove("hidden");
}

// ==========================================
// GRAFIK VISUALISASI (CHART.JS)
// ==========================================
function renderCharts(data) {
    if (typeof Chart === "undefined") return;

    // 1. Bar Chart Skor AS
    const barCtx = document.getElementById("rankingBarChart");
    if (barCtx) {
        if (barChartInstance) barChartInstance.destroy();

        const labels = data.ranking.map(r => r.name);
        const scores = data.ranking.map(r => parseFloat(r.as.toFixed(4)));
        const colors = data.ranking.map((_, idx) => idx === 0 ? "rgba(79, 70, 229, 0.9)" : "rgba(148, 163, 184, 0.7)");

        barChartInstance = new Chart(barCtx, {
            type: "bar",
            data: {
                labels: labels,
                datasets: [{
                    label: "Skor Penilaian (AS)",
                    data: scores,
                    backgroundColor: colors,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 1.0,
                        ticks: { font: { size: 10 } }
                    },
                    x: {
                        ticks: { font: { size: 10 } }
                    }
                }
            }
        });
    }

    // 2. Radar Chart Profil Alternatif Teratas (Max 3)
    const radarCtx = document.getElementById("radarChart");
    if (radarCtx) {
        if (radarChartInstance) radarChartInstance.destroy();

        const top3 = data.ranking.slice(0, 3);
        const criteriaLabels = data.criteria.map(c => c.name);
        const palette = [
            { bg: "rgba(79, 70, 229, 0.2)", border: "rgb(79, 70, 229)" },
            { bg: "rgba(16, 185, 129, 0.2)", border: "rgb(16, 185, 129)" },
            { bg: "rgba(245, 158, 11, 0.2)", border: "rgb(245, 158, 11)" }
        ];

        const datasets = top3.map((altItem, idx) => {
            const rawAlt = data.alternatives.find(a => a.name === altItem.name);
            const values = data.criteria.map(c => {
                const val = rawAlt && rawAlt.values[c.id] !== undefined ? rawAlt.values[c.id] : 0;
                const colMax = Math.max(...data.alternatives.map(a => a.values[c.id] || 0));
                return colMax > 0 ? parseFloat(((val / colMax) * 5).toFixed(2)) : 0;
            });
            return {
                label: altItem.name,
                data: values,
                backgroundColor: palette[idx % palette.length].bg,
                borderColor: palette[idx % palette.length].border,
                pointBackgroundColor: palette[idx % palette.length].border,
                borderWidth: 2
            };
        });

        radarChartInstance = new Chart(radarCtx, {
            type: "radar",
            data: {
                labels: criteriaLabels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: "bottom",
                        labels: { boxWidth: 12, font: { size: 10 } }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const datasetLabel = context.dataset.label || '';
                                const crit = data.criteria[context.dataIndex];
                                const rawAlt = data.alternatives.find(a => a.name === datasetLabel);
                                const originalVal = rawAlt && rawAlt.values[crit.id] !== undefined ? rawAlt.values[crit.id] : 0;
                                const displayVal = originalVal >= 1000
                                    ? 'Rp ' + originalVal.toLocaleString('id-ID')
                                    : originalVal;
                                return `${datasetLabel} (${crit.name}): ${displayVal}`;
                            }
                        }
                    }
                },
                scales: {
                    r: {
                        ticks: { display: false },
                        suggestedMin: 0,
                        suggestedMax: 5
                    }
                }
            }
        });
    }
}

// ==========================================
// RINCIAN STEP-BY-STEP PERHITUNGAN
// ==========================================
function renderStepByStepView(data) {
    const tableHtml = (headers, rows) => `
        <table class="w-full text-xs text-left border border-slate-200">
            <thead><tr class="bg-slate-100 text-slate-700">
                ${headers.map((h, i) => `<th class="p-2 border ${i > 0 || headers.length === data.criteria.length ? 'text-center' : ''}">${h}</th>`).join('')}
            </tr></thead>
            <tbody>
                ${rows.map(r => `<tr class="hover:bg-slate-100">${r.map((c, i) => `<td class="p-2 border ${i > 0 || r.length === data.criteria.length ? 'text-center' : 'font-medium'}">${c}</td>`).join('')}</tr>`).join('')}
            </tbody>
        </table>`;

    const critCodes = data.criteria.map(c => c.code);
    const altNames = data.alternatives.map(a => a.name);

    document.getElementById("step1Container").innerHTML = tableHtml(
        ["Alternatif", ...critCodes],
        data.X.map((row, i) => [altNames[i], ...row])
    );
    document.getElementById("step2Container").innerHTML = tableHtml(
        data.criteria.map(c => `${c.code} (${c.type})`),
        [data.AV.map(av => `<span class="font-semibold text-indigo-700">${av.toFixed(4)}</span>`)]
    );
    document.getElementById("step3Container").innerHTML = tableHtml(
        ["Alternatif", ...critCodes],
        data.PDA.map((row, i) => [altNames[i], ...row.map(v => v.toFixed(4))])
    );
    document.getElementById("step4Container").innerHTML = tableHtml(
        ["Alternatif", ...critCodes],
        data.NDA.map((row, i) => [altNames[i], ...row.map(v => v.toFixed(4))])
    );
    document.getElementById("step56Container").innerHTML = tableHtml(
        ["Alternatif", "SP", "SN", "NSP", "NSN", "Skor AS"],
        data.alternatives.map((_, i) => [
            altNames[i],
            data.SP[i].toFixed(4),
            data.SN[i].toFixed(4),
            data.NSP[i].toFixed(4),
            data.NSN[i].toFixed(4),
            `<span class="font-bold text-indigo-700">${data.AS[i].toFixed(4)}</span>`
        ])
    );
}

// ==========================================
// MODUL 4: ANALISIS SENSITIVITAS INTERAKTIF
// ==========================================
function initSensitivityModule() {
    sensitivityWeights = criteriaState.map(c => c.weight);
    renderSensitivitySliders();
    runSensitivityCalculation();
}

function renderSensitivitySliders() {
    const container = document.getElementById("sensitivitySlidersContainer");
    container.innerHTML = `<h3 class="font-bold text-slate-800 text-xs uppercase mb-3">Simulasi Bobot Kriteria</h3>`;

    criteriaState.forEach((c, idx) => {
        const val = sensitivityWeights[idx] !== undefined ? sensitivityWeights[idx] : c.weight;
        const percent = (val * 100).toFixed(0);

        const div = document.createElement("div");
        div.className = "space-y-1";
        div.innerHTML = `
            <div class="flex justify-between text-xs">
                <span class="font-medium text-slate-700">${c.code} - ${c.name}</span>
                <span class="font-bold text-indigo-600" id="sensVal_${idx}">${val.toFixed(2)} (${percent}%)</span>
            </div>
            <input type="range" min="0" max="1" step="0.05" value="${val}"
                oninput="onSensitivitySliderChange(${idx}, this.value)"
                class="w-full accent-indigo-600 cursor-pointer">
        `;
        container.appendChild(div);
    });
}

function onSensitivitySliderChange(changedIdx, rawNewVal) {
    const newVal = parseFloat(rawNewVal);
    const n = criteriaState.length;
    if (n <= 1) return;

    sensitivityWeights[changedIdx] = newVal;
    const remainingWeight = Math.max(0, 1.0 - newVal);
    const otherCurrentSum = sensitivityWeights.reduce((sum, w, idx) => idx === changedIdx ? sum : sum + w, 0);

    for (let i = 0; i < n; i++) {
        if (i !== changedIdx) {
            if (otherCurrentSum > 0) {
                sensitivityWeights[i] = (sensitivityWeights[i] / otherCurrentSum) * remainingWeight;
            } else {
                sensitivityWeights[i] = remainingWeight / (n - 1);
            }
        }
    }

    // Update label slider
    for (let i = 0; i < n; i++) {
        const lbl = document.getElementById(`sensVal_${i}`);
        if (lbl) {
            lbl.innerText = `${sensitivityWeights[i].toFixed(2)} (${(sensitivityWeights[i] * 100).toFixed(0)}%)`;
        }
    }

    runSensitivityCalculation();
}

function resetSensitivity() {
    sensitivityWeights = criteriaState.map(c => c.weight);
    renderSensitivitySliders();
    runSensitivityCalculation();
}

function runSensitivityCalculation() {
    if (!lastCalculationResult) return;

    const baseRank = lastCalculationResult.ranking;
    const originalWinner = baseRank[0].name;

    const simResult = executeEDASCore(criteriaState, sensitivityWeights, alternativesState);
    const newWinner = simResult.ranking[0].name;

    // Badge status stabilitas keputusan
    const badge = document.getElementById("sensitivityStabilityBadge");
    if (originalWinner === newWinner) {
        badge.className = "p-3 rounded-lg border text-xs font-semibold bg-emerald-50 text-emerald-800 border-emerald-200 flex items-center gap-2";
        badge.innerHTML = `<i class="fa-solid fa-shield-check text-emerald-600 text-sm"></i> Keputusan Stabil: <strong>${originalWinner}</strong> tetap menjadi rekomendasi utama pada variasi bobot ini.`;
    } else {
        badge.className = "p-3 rounded-lg border text-xs font-semibold bg-amber-50 text-amber-800 border-amber-200 flex items-center gap-2";
        badge.innerHTML = `<i class="fa-solid fa-arrow-right-arrow-left text-amber-600 text-sm"></i> Sensitif terhadap Bobot: Rekomendasi bergeser dari <strong>${originalWinner}</strong> menjadi <strong>${newWinner}</strong>.`;
    }

    // Render tabel simulasi
    const tbody = document.getElementById("sensitivityTableBody");
    tbody.innerHTML = "";

    simResult.ranking.forEach((item, newIdx) => {
        const oldIdx = baseRank.findIndex(b => b.name === item.name);
        let changeHtml = "";
        if (oldIdx === newIdx) {
            changeHtml = `<span class="text-slate-400 text-xs">Tetap</span>`;
        } else if (newIdx < oldIdx) {
            changeHtml = `<span class="text-emerald-600 text-xs font-semibold"><i class="fa-solid fa-arrow-up"></i> +${oldIdx - newIdx}</span>`;
        } else {
            changeHtml = `<span class="text-rose-600 text-xs font-semibold"><i class="fa-solid fa-arrow-down"></i> -${newIdx - oldIdx}</span>`;
        }

        const tr = document.createElement("tr");
        tr.className = newIdx === 0 ? "bg-indigo-50/50 font-semibold" : "";
        tr.innerHTML = `
            <td class="p-2.5 text-center font-bold">${newIdx + 1}</td>
            <td class="p-2.5">${item.name}</td>
            <td class="p-2.5 text-center font-mono text-xs">${item.as.toFixed(4)}</td>
            <td class="p-2.5 text-center">${changeHtml}</td>
        `;
        tbody.appendChild(tr);
    });
}

// ==========================================
// EKSPOR KE EXCEL (.XLSX)
// ==========================================
function exportExcel() {
    if (!lastCalculationResult || !lastCalculationResult.ranking || lastCalculationResult.ranking.length === 0) {
        showNotification("Belum Ada Hasil", "Lakukan perhitungan EDAS terlebih dahulu sebelum ekspor ke Excel.", true);
        return;
    }

    if (typeof XLSX === "undefined") {
        showNotification("Pustaka Belum Siap", "Pustaka SheetJS belum termuat. Periksa koneksi internet.", true);
        return;
    }

    const wb = XLSX.utils.book_new();

    // Sheet 1: Hasil Perangkingan
    const rankingRows = [
        ["Peringkat", "Alternatif Biji Kopi", "Skor Penilaian (AS)", "SP", "SN", "NSP", "NSN", "Status"]
    ];
    lastCalculationResult.ranking.forEach((item, idx) => {
        rankingRows.push([
            idx + 1,
            item.name,
            parseFloat(item.as.toFixed(4)),
            parseFloat(item.sp.toFixed(4)),
            parseFloat(item.sn.toFixed(4)),
            parseFloat(item.nsp.toFixed(4)),
            parseFloat(item.nsn.toFixed(4)),
            idx === 0 ? "Rekomendasi Utama" : "Alternatif"
        ]);
    });
    const wsRanking = XLSX.utils.aoa_to_sheet(rankingRows);
    wsRanking["!cols"] = [
        { wch: 10 }, { wch: 25 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 18 }
    ];
    XLSX.utils.book_append_sheet(wb, wsRanking, "Hasil Perangkingan");

    // Sheet 2: Matriks Evaluasi
    const matrixHeader = ["Alternatif Biji Kopi"];
    lastCalculationResult.criteria.forEach(c => matrixHeader.push(`${c.code} - ${c.name} (${c.type.toUpperCase()})`));
    const matrixRows = [matrixHeader];

    lastCalculationResult.alternatives.forEach(alt => {
        const row = [alt.name];
        lastCalculationResult.criteria.forEach(c => {
            row.push(alt.values[c.id] !== undefined ? alt.values[c.id] : 0);
        });
        matrixRows.push(row);
    });
    const wsMatrix = XLSX.utils.aoa_to_sheet(matrixRows);
    wsMatrix["!cols"] = [{ wch: 22 }].concat(lastCalculationResult.criteria.map(() => ({ wch: 22 })));
    XLSX.utils.book_append_sheet(wb, wsMatrix, "Matriks Evaluasi");

    // Sheet 3: Daftar Kriteria & Bobot
    const criteriaRows = [
        ["Kode", "Nama Kriteria", "Bobot Relatif", "Persentase", "Tipe Kriteria"]
    ];
    lastCalculationResult.criteria.forEach(c => {
        criteriaRows.push([
            c.code,
            c.name,
            c.weight,
            `${(c.weight * 100).toFixed(1)}%`,
            c.type.toUpperCase()
        ]);
    });
    const wsCriteria = XLSX.utils.aoa_to_sheet(criteriaRows);
    wsCriteria["!cols"] = [{ wch: 8 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, wsCriteria, "Kriteria & Bobot");

    // Tulis dan unduh file .xlsx resmi
    XLSX.writeFile(wb, "Hasil_SPK_EDAS_Pemilihan_Biji_Kopi.xlsx");
}

// ==========================================
// CETAK / SIMPAN KE PDF RESMI
// ==========================================
function printReport() {
    if (!lastCalculationResult) {
        if (Math.abs(criteriaState.reduce((sum, c) => sum + (c.weight || 0), 0) - 1.0) >= 0.005) {
            normalizeWeights();
        }
        hitungEDAS(false);
    }
    const dateStr = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    document.getElementById("printDatePlaceholder")?.replaceChildren("Tanggal Cetak: " + dateStr);
    window.print();
}

