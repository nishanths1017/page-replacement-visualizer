/**
 * Page Replacement Algorithm Visualizer Logic (Enhanced)
 * Features: Proper state init, explanation panel, Chart.js memory handling, 
 * clean un-redundant step objects, robust input formatting, keyboard hotkeys.
 */

const state = {
    pages: [],
    framesCount: 0,
    algo: 'FIFO',
    isCompareMode: false,
    
    // Default initialization
    simulationSteps: [], 
    compareSteps: { FIFO: [], LRU: [], OPT: [], MRU: [] }, 
    
    currentStep: 0,
    isPlaying: false,
    playInterval: null,
    playDelay: 1000
};

const algoDescriptions = {
    'FIFO': 'First-In, First-Out replaces the oldest page residing in memory.',
    'LRU': 'Least Recently Used replaces the page that has not been used for the longest period of time.',
    'OPT': 'Optimal Page Replacement replaces the page that will not be used for the longest time in the future.',
    'MRU': 'Most Recently Used replaces the page that was accessed most recently.'
};

// --- ALGORITHMS (PURE FUNCTIONS) ---
function parseInput(pageStr, frameStr) {
    let frames = parseInt(frameStr, 10);
    if (isNaN(frames) || frames <= 0 || frames > 10) {
        throw new Error("Frame size must be a number between 1 and 10.");
    }
    if (!pageStr || !pageStr.trim()) {
        throw new Error("Page reference string cannot be empty.");
    }
    
    // Robust cleanup: "7,, 0, ,1" or "7 0 1" -> [7, 0, 1]
    let pages = pageStr.split(/[\s,]+/)
        .map(p => p.trim())
        .filter(p => p !== '');
        
    for (let p of pages) {
        if (isNaN(parseInt(p, 10))) {
            throw new Error(`Invalid page format: "${p}". Only numeric values are allowed.`);
        }
    }
    pages = pages.map(p => parseInt(p, 10));
    
    if (pages.length === 0) throw new Error("No valid pages provided.");
    if (pages.length > 100) throw new Error("Attempting to process too many pages. Limit is 100.");
    if (frames > pages.length) {
        // Technically valid, but inform user
        console.warn("Frame size is larger than the sequence of pages. No page replacements will occur.");
    }
        
    return { pages, frames };
}

function initFrames(count) {
    return Array(count).fill(null);
}

function runFIFO(pages, framesCount) {
    let frames = initFrames(framesCount);
    let steps = [];
    let replaceIdx = 0;
    
    for (const page of pages) {
        let hit = frames.includes(page);
        let currentReplacedIdx = -1;
        let explanation = "";
        let newFrames = [...frames]; // snapshot
        
        if (!hit) {
            let emptyIdx = frames.indexOf(null);
            if (emptyIdx !== -1) {
                newFrames[emptyIdx] = page;
                currentReplacedIdx = emptyIdx;
                explanation = `Page <b>${page}</b> caused a FAULT and was loaded into an empty frame.`;
            } else {
                let replacedPage = newFrames[replaceIdx];
                newFrames[replaceIdx] = page;
                currentReplacedIdx = replaceIdx;
                replaceIdx = (replaceIdx + 1) % framesCount;
                explanation = `Page <b>${page}</b> caused a FAULT. Replaced page <b>${replacedPage}</b> as it was the oldest loaded in memory (FIFO).`;
            }
        } else {
            explanation = `Page <b>${page}</b> caused a HIT. It is already in memory.`;
        }
        
        steps.push({ page, frames: newFrames, hit, replacedIdx: hit ? -1 : currentReplacedIdx, explanation });
        frames = newFrames;
    }
    return steps;
}

function runLRU(pages, framesCount) {
    let frames = initFrames(framesCount);
    let steps = [];
    let age = Array(framesCount).fill(0); 
    let currentTime = 0;

    for (const page of pages) {
        currentTime++;
        let hit = frames.includes(page);
        let currentReplacedIdx = -1;
        let explanation = "";
        let newFrames = [...frames];

        if (hit) {
            let hitIdx = frames.indexOf(page);
            age[hitIdx] = currentTime;
            explanation = `Page <b>${page}</b> caused a HIT. Updated its recent usage timestamp.`;
        } else {
            let emptyIdx = frames.indexOf(null);
            if (emptyIdx !== -1) {
                newFrames[emptyIdx] = page;
                age[emptyIdx] = currentTime;
                currentReplacedIdx = emptyIdx;
                explanation = `Page <b>${page}</b> caused a FAULT and was loaded into an empty frame.`;
            } else {
                let lruIdx = 0;
                let minTime = age[0];
                for (let i = 1; i < framesCount; i++) {
                    if (age[i] < minTime) {
                        minTime = age[i];
                        lruIdx = i;
                    }
                }
                let replacedPage = newFrames[lruIdx];
                newFrames[lruIdx] = page;
                age[lruIdx] = currentTime;
                currentReplacedIdx = lruIdx;
                explanation = `Page <b>${page}</b> caused a FAULT. Replaced page <b>${replacedPage}</b> because it was the least recently used.`;
            }
        }

        steps.push({ page, frames: newFrames, hit, replacedIdx: hit ? -1 : currentReplacedIdx, explanation });
        frames = newFrames;
    }
    return steps;
}

function runOPT(pages, framesCount) {
    let frames = initFrames(framesCount);
    let steps = [];
    
    for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        let hit = frames.includes(page);
        let currentReplacedIdx = -1;
        let explanation = "";
        let newFrames = [...frames];

        if (!hit) {
            let emptyIdx = frames.indexOf(null);
            if (emptyIdx !== -1) {
                newFrames[emptyIdx] = page;
                currentReplacedIdx = emptyIdx;
                explanation = `Page <b>${page}</b> caused a FAULT and was loaded into an empty frame.`;
            } else {
                let furthestIdx = -1;
                let furthestDist = -1;
                let neverUsedFound = false;
                
                for (let j = 0; j < framesCount; j++) {
                    let framePage = frames[j];
                    let nextUse = pages.slice(i + 1).indexOf(framePage);
                    if (nextUse === -1) {
                        furthestIdx = j;
                        neverUsedFound = true;
                        break;
                    }
                    if (nextUse > furthestDist) {
                        furthestDist = nextUse;
                        furthestIdx = j;
                    }
                }
                
                let replacedPage = newFrames[furthestIdx];
                newFrames[furthestIdx] = page;
                currentReplacedIdx = furthestIdx;
                
                let reason = neverUsedFound ? "it is never used again" : "it is used farthest in the future";
                explanation = `Page <b>${page}</b> caused a FAULT. Replaced page <b>${replacedPage}</b> because ${reason}.`;
            }
        } else {
            explanation = `Page <b>${page}</b> caused a HIT. It is already in memory.`;
        }
        steps.push({ page, frames: newFrames, hit, replacedIdx: hit ? -1 : currentReplacedIdx, explanation });
        frames = newFrames;
    }
    return steps;
}

function runMRU(pages, framesCount) {
    let frames = initFrames(framesCount);
    let steps = [];
    let mruIdx = -1; 

    for (const page of pages) {
        let hit = frames.includes(page);
        let currentReplacedIdx = -1;
        let explanation = "";
        let newFrames = [...frames];

        if (hit) {
            mruIdx = frames.indexOf(page);
            explanation = `Page <b>${page}</b> caused a HIT. Updated as most recently used.`;
        } else {
            let emptyIdx = frames.indexOf(null);
            if (emptyIdx !== -1) {
                newFrames[emptyIdx] = page;
                currentReplacedIdx = emptyIdx;
                mruIdx = emptyIdx;
                explanation = `Page <b>${page}</b> caused a FAULT and was loaded into an empty frame.`;
            } else {
                let replacedPage = newFrames[mruIdx];
                newFrames[mruIdx] = page;
                currentReplacedIdx = mruIdx;
                explanation = `Page <b>${page}</b> caused a FAULT. Replaced page <b>${replacedPage}</b> because it was the most recently used.`;
            }
        }
        steps.push({ page, frames: newFrames, hit, replacedIdx: hit ? -1 : currentReplacedIdx, explanation });
        frames = newFrames;
    }
    return steps;
}

const algorithms = {
    'FIFO': runFIFO,
    'LRU': runLRU,
    'OPT': runOPT,
    'MRU': runMRU
};

// --- DOM ELEMENTS ---
const els = {
    pageInput: document.getElementById('page-reference'),
    frameInput: document.getElementById('frame-size'),
    algoSelect: document.getElementById('algo-select'),
    compareMode: document.getElementById('compare-mode'),
    btnStart: document.getElementById('btn-start'),
    btnNext: document.getElementById('btn-next'),
    btnAuto: document.getElementById('btn-auto'),
    btnReset: document.getElementById('btn-reset'),
    btnExportImg: document.getElementById('btn-export-img'),
    btnExportPdf: document.getElementById('btn-export-pdf'),
    speedSlider: document.getElementById('speed-slider'),
    speedDisplay: document.getElementById('speed-display'),
    errorToast: document.getElementById('error-message'),
    themeToggle: document.getElementById('theme-toggle'),
    singleView: document.getElementById('single-view'),
    compareView: document.getElementById('compare-view'),
    memoryGrid: document.getElementById('memory-grid'),
    
    // Indicators & explanations
    stepIndicator: document.getElementById('step-indicator'),
    currentPageIndicator: document.getElementById('current-page-indicator'),
    currentAlgoTitle: document.getElementById('current-algo-title'),
    algoInfo: document.getElementById('algo-info'),
    stepExplanation: document.getElementById('step-explanation'),
    
    // Stats
    statFaults: document.getElementById('stat-faults'),
    statHits: document.getElementById('stat-hits'),
    statHitRatio: document.getElementById('stat-hit-ratio'),
    statFaultRatio: document.getElementById('stat-fault-ratio'),
    
    // Compare Mode Elements
    compareCards: {
        'FIFO': document.getElementById('compare-fifo'),
        'LRU': document.getElementById('compare-lru'),
        'OPT': document.getElementById('compare-opt'),
        'MRU': document.getElementById('compare-mru')
    }
};

let chartInstance = null;

// --- INITIALIZATION ---
function init() {
    loadFromLocalStorage();
    setupEventListeners();
    updateThemeIcon();
}

function setupEventListeners() {
    els.btnStart.addEventListener('click', startSimulation);
    els.btnNext.addEventListener('click', () => { pauseAutoPlay(); nextStep(); });
    els.btnAuto.addEventListener('click', toggleAutoPlay);
    els.btnReset.addEventListener('click', resetSimulation);
    els.btnExportImg.addEventListener('click', exportImage);
    els.btnExportPdf.addEventListener('click', exportPDF);
    els.compareMode.addEventListener('change', toggleCompareMode);
    els.themeToggle.addEventListener('click', toggleTheme);
    
    els.speedSlider.addEventListener('input', (e) => {
        let val = parseInt(e.target.value);
        state.playDelay = val;
        els.speedDisplay.innerText = (val / 1000).toFixed(1) + 's';
        if (state.isPlaying) {
            clearInterval(state.playInterval);
            state.playInterval = setInterval(nextStep, state.playDelay); // robust handling
        }
    });

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        // Ensure simulation is active and we aren't typing in an input
        if (e.target.tagName !== 'INPUT') {
            if (e.code === 'Space' && !els.btnStart.disabled && !els.btnAuto.disabled) {
                e.preventDefault();
                toggleAutoPlay();
            } else if (e.code === 'ArrowRight' && !els.btnNext.disabled) {
                e.preventDefault();
                pauseAutoPlay();
                nextStep();
            }
        }
    });
}

// --- CORE WORKFLOW ---
function showError(msg) {
    els.errorToast.innerText = msg;
    els.errorToast.classList.remove('hidden');
    setTimeout(() => els.errorToast.classList.add('hidden'), 4000);
}

function toggleCompareMode() {
    state.isCompareMode = els.compareMode.checked;
    if (state.isCompareMode) {
        els.singleView.classList.add('hidden');
        els.compareView.classList.remove('hidden');
        els.algoSelect.disabled = true; 
    } else {
        els.singleView.classList.remove('hidden');
        els.compareView.classList.add('hidden');
        els.algoSelect.disabled = false;
    }
    // Clean slate on toggle
    if (state.simulationSteps.length > 0 || state.compareSteps.FIFO.length > 0) {
        resetSimulation();
    }
}

function startSimulation() {
    try {
        const { pages, frames } = parseInput(els.pageInput.value, els.frameInput.value);
        state.pages = pages;
        state.framesCount = frames;
        state.algo = els.algoSelect.value;
        state.currentStep = 0;
        
        saveToLocalStorage(els.pageInput.value, frames, state.algo);
        pauseAutoPlay();
        
        els.btnNext.disabled = false;
        els.btnAuto.disabled = false;
        els.btnExportImg.disabled = false;
        els.btnExportPdf.disabled = false;
        
        if (state.isCompareMode) {
            state.compareSteps = {
                'FIFO': runFIFO(pages, frames),
                'LRU': runLRU(pages, frames),
                'OPT': runOPT(pages, frames),
                'MRU': runMRU(pages, frames),
            };
            Object.values(els.compareCards).forEach(card => card.querySelector('.mini-grid').innerHTML = '');
            updateCompareChart(0, 0, 0, 0); 
        } else {
            state.simulationSteps = algorithms[state.algo](pages, frames);
            els.memoryGrid.innerHTML = '';
            els.currentAlgoTitle.innerText = els.algoSelect.options[els.algoSelect.selectedIndex].text;
            els.algoInfo.innerText = algoDescriptions[state.algo];
            els.stepExplanation.innerText = "Start simulation to see step-by-step explanations.";
            els.currentPageIndicator.innerText = `Current Page: -`;
            
            updateStats({ faults: 0, hits: 0, total: 0 });
            els.stepIndicator.innerText = `Step 0 / ${state.simulationSteps.length}`;
        }
        
    } catch (err) {
        showError(err.message);
    }
}

function nextStep() {
    if (state.isCompareMode) {
        if (!state.compareSteps.FIFO || state.compareSteps.FIFO.length === 0) return;
        const total = state.compareSteps.FIFO.length;
        if (state.currentStep < total) {
            renderCompareStep(state.currentStep);
            state.currentStep++;
            if (state.currentStep === total) pauseAutoPlay();
        }
    } else {
        if (!state.simulationSteps || state.simulationSteps.length === 0) return;
        const total = state.simulationSteps.length;
        if (state.currentStep < total) {
            renderSingleStep(state.currentStep);
            state.currentStep++;
            if (state.currentStep === total) pauseAutoPlay();
        }
    }
}

function toggleAutoPlay() {
    if (state.isPlaying) {
        pauseAutoPlay();
    } else {
        // If reached the end, reset grid first
        let total = state.isCompareMode ? state.pages.length : state.simulationSteps.length;
        if (total > 0 && state.currentStep >= total) {
            resetGridOnly();
        }
        state.isPlaying = true;
        els.btnAuto.innerHTML = '<i class="fas fa-pause"></i> Pause';
        els.btnAuto.classList.replace('btn-secondary', 'btn-primary');
        
        // Ensure no redundant intervals
        clearInterval(state.playInterval);
        state.playInterval = setInterval(nextStep, state.playDelay);
    }
}

function pauseAutoPlay() {
    state.isPlaying = false;
    clearInterval(state.playInterval);
    els.btnAuto.innerHTML = '<i class="fas fa-forward"></i> Auto Play';
    els.btnAuto.classList.replace('btn-primary', 'btn-secondary');
}

function resetSimulation() {
    pauseAutoPlay();
    state.simulationSteps = [];
    state.compareSteps = { FIFO: [], LRU: [], OPT: [], MRU: [] };
    state.currentStep = 0;
    
    // UI resets
    els.memoryGrid.innerHTML = '';
    els.btnNext.disabled = true;
    els.btnAuto.disabled = true;
    els.btnExportImg.disabled = true;
    els.btnExportPdf.disabled = true;
    els.stepIndicator.innerText = 'Step 0 / 0';
    els.currentPageIndicator.innerText = `Current Page: -`;
    els.stepExplanation.innerText = "Start simulation to see explanations.";
    updateStats({ faults: 0, hits: 0, total: 0 });
    
    // Compare Mode resets
    Object.values(els.compareCards).forEach(card => {
        card.querySelector('.mini-grid').innerHTML = '';
        card.querySelector('.cfaults').innerText = '0';
        card.querySelector('.chits').innerText = '0';
    });
    if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
    }
}

function resetGridOnly() {
    state.currentStep = 0;
    if (state.isCompareMode) {
        Object.values(els.compareCards).forEach(card => card.querySelector('.mini-grid').innerHTML = '');
        updateCompareChart(0, 0, 0, 0);
    } else {
        els.memoryGrid.innerHTML = '';
        els.stepExplanation.innerText = "Simulation restarted.";
        els.currentPageIndicator.innerText = `Current Page: -`;
        updateStats({ faults: 0, hits: 0, total: 0 });
        els.stepIndicator.innerText = `Step 0 / ${state.simulationSteps.length}`;
    }
}

// --- UI RENDERING ---

function createColumnDOM(stepData, frameCount) {
    const col = document.createElement('div');
    col.className = 'grid-col';
    
    // Header (Reference String)
    const header = document.createElement('div');
    header.className = 'cell header-cell';
    header.innerText = stepData.page;
    col.appendChild(header);
    
    // Memory Frames
    for (let i = 0; i < frameCount; i++) {
        const fCell = document.createElement('div');
        fCell.className = 'cell';
        const val = stepData.frames[i];
        
        if (val !== null && val !== undefined) {
            fCell.innerText = val;
            
            if (i === stepData.replacedIdx) {
                fCell.classList.add('bg-replaced');
            } else if (stepData.hit && val === stepData.page) {
                fCell.classList.add('bg-hit');
            } else if (!stepData.hit && val === stepData.page) {
                fCell.classList.add('bg-fault'); 
            }
        }
        col.appendChild(fCell);
    }
    
    // Footer (Status)
    const footer = document.createElement('div');
    footer.className = `cell footer-cell ${stepData.hit ? 'text-hit' : 'text-fault'}`;
    footer.innerHTML = stepData.hit ? '<i class="fas fa-check"></i>' : '<i class="fas fa-times"></i>';
    col.appendChild(footer);
    
    return col;
}

function renderSingleStep(stepIndex) {
    const stepObj = state.simulationSteps[stepIndex];
    
    // Append dynamically
    const col = createColumnDOM(stepObj, state.framesCount);
    els.memoryGrid.appendChild(col);
    els.memoryGrid.parentElement.scrollLeft = els.memoryGrid.parentElement.scrollWidth;
    
    // Update Info Display
    els.stepIndicator.innerText = `Step ${stepIndex + 1} / ${state.simulationSteps.length}`;
    els.currentPageIndicator.innerHTML = `Current Page: <b>${stepObj.page}</b>`;
    els.stepExplanation.innerHTML = stepObj.explanation;
    
    // Stats recalculation using step property `.hit` derivation
    let faults = 0;
    for(let i=0; i<=stepIndex; i++) {
        if(!state.simulationSteps[i].hit) faults++;
    }
    let hits = (stepIndex + 1) - faults;
    updateStats({ faults, hits, total: stepIndex + 1 });
}

function renderCompareStep(stepIndex) {
    const algos = ['FIFO', 'LRU', 'OPT', 'MRU'];
    let faultsObj = {};
    
    algos.forEach(algo => {
        const stepObj = state.compareSteps[algo][stepIndex];
        const card = els.compareCards[algo];
        const grid = card.querySelector('.mini-grid');
        
        const col = createColumnDOM(stepObj, state.framesCount);
        grid.appendChild(col);
        grid.parentElement.scrollLeft = grid.parentElement.scrollWidth;
        
        let faults = 0;
        for(let i=0; i<=stepIndex; i++) {
            if(!state.compareSteps[algo][i].hit) faults++;
        }
        faultsObj[algo] = faults;
        let hits = (stepIndex + 1) - faults;
        
        card.querySelector('.cfaults').innerText = faults;
        card.querySelector('.chits').innerText = hits;
    });
    
    updateCompareChart(faultsObj.FIFO, faultsObj.LRU, faultsObj.OPT, faultsObj.MRU);
}

function updateStats({ faults, hits, total }) {
    if (total === 0) {
        els.statFaults.innerText = '-';
        els.statHits.innerText = '-';
        els.statHitRatio.innerText = '-%';
        els.statFaultRatio.innerText = '-%';
        return;
    }
    els.statFaults.innerText = faults;
    els.statHits.innerText = hits;
    els.statHitRatio.innerText = ((hits / total) * 100).toFixed(1) + '%';
    els.statFaultRatio.innerText = ((faults / total) * 100).toFixed(1) + '%';
}

function updateCompareChart(f1, f2, f3, f4) {
    // Robust memory handling for Chart
    if (chartInstance) {
        chartInstance.destroy();
    }
    
    const ctx = document.getElementById('comparisonChart').getContext('2d');
    const isDark = document.body.classList.contains('dark-mode');
    const textColor = isDark ? '#f8fafc' : '#1e293b';
    
    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['FIFO', 'LRU', 'OPT', 'MRU'],
            datasets: [{
                label: 'Page Faults',
                data: [f1, f2, f3, f4],
                backgroundColor: [
                    'rgba(239, 68, 68, 0.7)',
                    'rgba(99, 102, 241, 0.7)',
                    'rgba(16, 185, 129, 0.7)',
                    'rgba(245, 158, 11, 0.7)'
                ],
                borderColor: [
                    'rgb(239, 68, 68)',
                    'rgb(99, 102, 241)',
                    'rgb(16, 185, 129)',
                    'rgb(245, 158, 11)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            maintainAspectRatio: false,
            scales: {
                y: { 
                    beginAtZero: true,
                    ticks: { precision: 0, color: textColor }
                },
                x: {
                    ticks: { color: textColor }
                }
            },
            plugins: {
                legend: { display: false }
            },
            animation: false
        }
    });
}

// --- SETTINGS AND UTILS ---
function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    updateThemeIcon();
    // Re-draw chart on theme toggle if it exists
    if(chartInstance && state.isCompareMode && state.currentStep > 0) {
        const step = state.currentStep - 1;
        const countFaults = (algo) => state.compareSteps[algo].slice(0, step + 1).filter(s => !s.hit).length;
        updateCompareChart(countFaults('FIFO'), countFaults('LRU'), countFaults('OPT'), countFaults('MRU'));
    }
}

function updateThemeIcon() {
    const isDark = document.body.classList.contains('dark-mode');
    const icon = els.themeToggle.querySelector('i');
    icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
}

function saveToLocalStorage(pages, frames, algo) {
    localStorage.setItem('prv-pages', pages);
    localStorage.setItem('prv-frames', frames);
    localStorage.setItem('prv-algo', algo);
}

function loadFromLocalStorage() {
    const pages = localStorage.getItem('prv-pages');
    const frames = localStorage.getItem('prv-frames');
    const algo = localStorage.getItem('prv-algo');
    
    if (pages) els.pageInput.value = pages;
    if (frames) els.frameInput.value = frames;
    if (algo) els.algoSelect.value = algo;
}

function exportImage() {
    const element = document.getElementById('main-content');
    const isDark = document.body.classList.contains('dark-mode');
    
    // Halt animations on the actual DOM and force opaque backgrounds BEFORE cloning
    // This is bulletproof against html2canvas timing and iframe cloning bugs
    const style = document.createElement('style');
    style.id = 'export-overrides';
    style.innerHTML = `
        * { animation: none !important; transition: none !important; opacity: 1 !important; }
        #main-content {
            background: ${isDark ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' : 'linear-gradient(135deg, #f0f4f8 0%, #e2e8f0 100%)'} !important;
            padding: 20px !important;
            border-radius: 16px !important;
        }
        .glass-card {
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            background: ${isDark ? 'rgba(30, 41, 59, 1)' : 'rgba(255, 255, 255, 1)'} !important;
            box-shadow: none !important;
        }
    `;
    document.head.appendChild(style);

    // Give browser time to apply styles natively before snapping
    setTimeout(() => {
        html2canvas(element, { scale: 2, useCORS: true }).then(canvas => {
            const link = document.createElement('a');
            link.download = `PageReplacement_${state.isCompareMode ? 'Compare' : state.algo}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            document.head.removeChild(style);
        }).catch(err => {
            console.error(err);
            if (document.head.contains(style)) document.head.removeChild(style);
        });
    }, 100);
}

function exportPDF() {
    const element = document.getElementById('main-content');
    const isDark = document.body.classList.contains('dark-mode');
    
    const style = document.createElement('style');
    style.id = 'export-overrides';
    style.innerHTML = `
        * { animation: none !important; transition: none !important; opacity: 1 !important; }
        #main-content {
            background: ${isDark ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' : 'linear-gradient(135deg, #f0f4f8 0%, #e2e8f0 100%)'} !important;
            padding: 20px !important;
            border-radius: 16px !important;
        }
        .glass-card {
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            background: ${isDark ? 'rgba(30, 41, 59, 1)' : 'rgba(255, 255, 255, 1)'} !important;
            box-shadow: none !important;
        }
    `;
    document.head.appendChild(style);

    setTimeout(() => {
        const opt = {
            margin:       10,
            filename:     `PageReplacement_${state.isCompareMode ? 'Compare' : state.algo}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' }
        };
        
        html2pdf().set(opt).from(element).save().then(() => {
            document.head.removeChild(style);
        }).catch(err => {
            console.error(err);
            if (document.head.contains(style)) document.head.removeChild(style);
        });
    }, 100);
}

// Initialization
window.addEventListener('DOMContentLoaded', init);
