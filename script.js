// ==========================================
// DATA DEFAULT AWAL
// ==========================================
const DEFAULT_CRITERIA = [
    { code: "C1", name: "Harga Biji Kopi", weight: 0.25, type: "cost" },
    { code: "C2", name: "Kualitas Rasa", weight: 0.25, type: "benefit" },
    { code: "C3", name: "Kekuatan Aroma", weight: 0.20, type: "benefit" },
    { code: "C4", name: "Kemudahan Ekstraksi", weight: 0.15, type: "benefit" },
    { code: "C5", name: "Tingkat Cacat", weight: 0.15, type: "cost" }
];

const DEFAULT_ALTERNATIVES = [
    { name: "Arabika", values: [4, 5, 5, 3, 2] },
    { name: "Robusta", values: [2, 3, 3, 5, 3] },
    { name: "Liberika", values: [3, 3, 4, 3, 3] },
    { name: "Excelsa", values: [3, 4, 4, 4, 2] },
    { name: "Luwak", values: [5, 5, 5, 2, 1] }
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
window.onload = function() {
    resetDefaultData();
};

// ==========================================
// NAVIGASI ANTAR MODUL
// ==========================================
function switchModule(moduleNumber) {
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

    if (moduleNumber === 4) {
        if (!lastCalculationResult) hitungEDAS(false);
        initSensitivityModule();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
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
        const defMap = { "C1": 0.25, "C2": 0.25, "C3": 0.20, "C4": 0.15, "C5": 0.15 };
        criteriaState.forEach(c => {
            if (defMap[c.code] !== undefined) c.weight = defMap[c.code];
        });
    } else if (presetType === "quality") {
        // Prioritas rasa & aroma
        criteriaState.forEach(c => {
            if (c.code === "C2") c.weight = 0.35;
            else if (c.code === "C3") c.weight = 0.30;
            else if (c.code === "C1") c.weight = 0.15;
            else c.weight = 0.10;
        });
    } else if (presetType === "cost") {
        // Prioritas efisiensi biaya & cacat rendah
        criteriaState.forEach(c => {
            if (c.code === "C1") c.weight = 0.35;
            else if (c.code === "C5") c.weight = 0.25;
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
    // Koreksi pembulatan kecil pada elemen terakhir agar tepat 1.00
    const newTotal = criteriaState.reduce((sum, c) => sum + c.weight, 0);
    const diff = 1.0 - newTotal;
    if (criteriaState.length > 0 && Math.abs(diff) < 0.05) {
        criteriaState[criteriaState.length - 1].weight = parseFloat((criteriaState[criteriaState.length - 1].weight + diff).toFixed(4));
    }
    renderCriteriaTable();
    updateTotalWeightBadge();
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
        const percent = ((c.weight || 0) * 100).toFixed(1) + "%";
        const tr = document.createElement("tr");
        tr.className = "hover:bg-slate-50 transition";
        tr.innerHTML = `
            <td class="p-3 text-center font-bold text-slate-700">${c.code}</td>
            <td class="p-3">
                <input type="text" value="${c.name}" onchange="updateCriterionName(${c.id}, this.value)"
                    class="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs sm:text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-none">
            </td>
            <td class="p-3 text-center">
                <input type="number" step="0.01" min="0" max="1" value="${c.weight}" onchange="updateCriterionWeight(${c.id}, this.value)"
                    class="w-24 text-center px-2 py-1.5 border border-slate-300 rounded-md text-xs sm:text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-none">
            </td>
            <td class="p-3 text-center text-xs text-slate-500 font-medium">${percent}</td>
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
        a.values[newCid] = 0;
    });

    renderAllTables();
}

function updateCriterionName(cid, val) {
    const c = criteriaState.find(item => item.id === cid);
    if (c) c.name = val;
    renderAlternativeTable();
}

function updateCriterionWeight(cid, val) {
    const c = criteriaState.find(item => item.id === cid);
    if (c) c.weight = parseFloat(val) || 0;
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
    renderAllTables();
}

function updateTotalWeightBadge() {
    const total = criteriaState.reduce((sum, c) => sum + (c.weight || 0), 0);
    const badge = document.getElementById("statusBobotBadge");
    if (!badge) return;
    if (Math.abs(total - 1.0) < 0.005) {
        badge.className = "text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200";
        badge.innerHTML = `<i class="fa-solid fa-check-circle mr-1"></i> Total Bobot: ${total.toFixed(2)} (100%)`;
    } else {
        badge.className = "text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200";
        badge.innerHTML = `<i class="fa-solid fa-triangle-exclamation mr-1"></i> Total Bobot: ${total.toFixed(2)} (Wajib = 1.00)`;
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
        th.className = "p-3 border-b border-slate-200 text-center min-w-[120px]";
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
            const val = a.values[c.id] !== undefined ? a.values[c.id] : 0;
            rowHtml += `
                <td class="p-3 text-center">
                    <input type="number" step="0.01" value="${val}" onchange="updateAlternativeValue(${a.id}, ${c.id}, this.value)"
                        class="w-24 text-center px-2 py-1.5 border border-slate-300 rounded-md text-xs sm:text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-none">
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
}

function filterAlternatives(val) {
    renderAlternativeTable(val);
}

function addAlternative() {
    const nextIdx = alternativesState.length + 1;
    const newAid = aidAutoIncrement++;
    let valMap = {};
    criteriaState.forEach(c => {
        valMap[c.id] = 0;
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

function updateAlternativeValue(aid, cid, val) {
    const a = alternativesState.find(item => item.id === aid);
    if (a) {
        a.values[cid] = parseFloat(val) || 0;
    }
}

function removeAlternative(aid) {
    if (alternativesState.length <= 1) {
        showNotification("Peringatan", "Minimal harus ada 1 alternatif biji kopi.", true);
        return;
    }
    alternativesState = alternativesState.filter(item => item.id !== aid);
    renderAlternativeTable();
}

// ==========================================
// HITUNG EDAS LENGKAP (MODUL 3)
// ==========================================
function executeEDASCore(criteria, weights, alternatives) {
    const m = alternatives.length;
    const n = criteria.length;

    // 1. Matriks X
    let X = [];
    for (let i = 0; i < m; i++) {
        let row = [];
        for (let j = 0; j < n; j++) {
            const cid = criteria[j].id;
            row.push(alternatives[i].values[cid] !== undefined ? alternatives[i].values[cid] : 0);
        }
        X.push(row);
    }

    // 2. Solusi Rata-rata AV
    let AV = [];
    for (let j = 0; j < n; j++) {
        let sum = 0;
        for (let i = 0; i < m; i++) sum += X[i][j];
        AV.push(sum / m);
    }

    // 3. PDA & NDA
    let PDA = Array.from({ length: m }, () => Array(n).fill(0));
    let NDA = Array.from({ length: m }, () => Array(n).fill(0));

    for (let i = 0; i < m; i++) {
        for (let j = 0; j < n; j++) {
            const x = X[i][j];
            const av = AV[j];
            const type = criteria[j].type;

            if (av === 0) {
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

    // 4. SP & SN
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

    // 5. Normalisasi NSP & NSN
    let maxSP = Math.max(...SP);
    let maxSN = Math.max(...SN);

    let NSP = SP.map(sp => (maxSP === 0 ? 0 : sp / maxSP));
    let NSN = SN.map(sn => (maxSN === 0 ? 1 : 1 - (sn / maxSN)));

    // 6. Appraisal Score (AS)
    let AS = [];
    for (let i = 0; i < m; i++) {
        AS.push(0.5 * (NSP[i] + NSN[i]));
    }

    // 7. Ranking
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
    if (criteriaState.length === 0 || alternativesState.length === 0) {
        showNotification("Validasi Gagal", "Kriteria dan Alternatif tidak boleh kosong.", true);
        return;
    }

    let rawTotalWeight = criteriaState.reduce((sum, c) => sum + (c.weight || 0), 0);
    if (Math.abs(rawTotalWeight - 1.0) >= 0.005) {
        showNotification(
            "Total Bobot Belum Pas",
            `Total bobot saat ini: ${rawTotalWeight.toFixed(2)}. Gunakan tombol 'Normalisasi Total = 1' di Modul 1.`,
            true
        );
        switchModule(1);
        return;
    }

    let weights = criteriaState.map(c => c.weight);
    lastCalculationResult = executeEDASCore(criteriaState, weights, alternativesState);

    renderRankingView(lastCalculationResult.ranking);
    renderStepByStepView(lastCalculationResult);
    renderCharts(lastCalculationResult);

    if (navigateToModule) {
        switchModule(3);
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
                <span class="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                    idx === 0 ? 'bg-amber-400 text-slate-900 shadow-xs' :
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
            const values = data.criteria.map(c => rawAlt && rawAlt.values[c.id] !== undefined ? rawAlt.values[c.id] : 0);
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
                    }
                },
                scales: {
                    r: {
                        ticks: { display: false },
                        suggestedMin: 0
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

