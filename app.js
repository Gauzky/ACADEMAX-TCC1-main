// =============================================
// === INICIALIZAÇÃO E SEGURANÇA ===
// =============================================
if (!localStorage.getItem('academax_user')) {
    // Compatibilidade: migra chave antiga se existir
    const legacy = localStorage.getItem('gympro_user');
    if (legacy) {
        localStorage.setItem('academax_user', legacy);
        localStorage.removeItem('gympro_user');
    } else {
        window.location.href = 'login.html';
    }
}

const loggedUser = JSON.parse(localStorage.getItem('academax_user') || '{}');
const API = 'https://academaxx.com.br/api';

let targetUserIdForWorkout = null;
let globalClients = [];
let DB = { workouts: [], history: [] };

// =============================================
// === TOAST (substitui todos os alert()) ===
// =============================================
function showToast(message, type = 'info') {
    const existing = document.getElementById('academax-toast');
    if (existing) existing.remove();

    const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', info: 'fa-circle-info', warning: 'fa-triangle-exclamation' };
    const colors = { success: '#10b981', error: '#ef4444', info: 'var(--primary)', warning: '#f59e0b' };

    const toast = document.createElement('div');
    toast.id = 'academax-toast';
    toast.innerHTML = `<i class="fa-solid ${icons[type]}" style="color:${colors[type]};font-size:18px;flex-shrink:0;"></i><span style="flex:1;font-size:14px;font-weight:500;">${message}</span>`;
    Object.assign(toast.style, {
        position: 'fixed', bottom: '110px', left: '50%', transform: 'translateX(-50%) translateY(20px)',
        background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px',
        padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '12px',
        boxShadow: '0 8px 30px rgba(0,0,0,0.4)', zIndex: '999', maxWidth: '90vw',
        opacity: '0', transition: 'all 0.3s ease', whiteSpace: 'nowrap'
    });
    document.body.appendChild(toast);
    requestAnimationFrame(() => { toast.style.opacity = '1'; toast.style.transform = 'translateX(-50%) translateY(0)'; });
    setTimeout(() => {
        toast.style.opacity = '0'; toast.style.transform = 'translateX(-50%) translateY(10px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// =============================================
// === LOADING SPINNER NOS BOTÕES ===
// =============================================
function setButtonLoading(btn, loading) {
    if (!btn) return;
    if (loading) {
        btn.dataset.originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Aguarde...';
        btn.disabled = true;
    } else {
        btn.innerHTML = btn.dataset.originalText || btn.innerHTML;
        btn.disabled = false;
    }
}

// =============================================
// === CARREGAMENTO DO BANCO ===
// =============================================
async function loadDB() {
    try {
        const resWorkouts = await fetch(`${API}/workouts/${loggedUser.id}`);
        DB.workouts = await resWorkouts.json();
        const resHistory = await fetch(`${API}/history/${loggedUser.id}`);
        DB.history = await resHistory.json();
        renderDashboard();
        renderWorkouts();
        renderHistory();
    } catch (error) {
        console.error("Erro ao carregar banco de dados:", error);
        showToast("Erro ao conectar. O servidor pode estar iniciando...", "warning");
    }
}

// =============================================
// === BIBLIOTECA DE EXERCÍCIOS ===
// =============================================
const exerciseLibrary = [
    { name: "Supino Reto", muscle: "Peito", img: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=200&q=80", video: "rT7DgCr-3pg" },
    { name: "Supino Inclinado", muscle: "Peito", img: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=200&q=80", video: "8iPEnn-ltC8" },
    { name: "Crucifixo", muscle: "Peito", img: "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=200&q=80", video: "e7XVB3pXyIQ" },
    { name: "Crossover", muscle: "Peito", img: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=200&q=80", video: "I5i1b5J4fPw" },
    { name: "Flexão de Braço", muscle: "Peito", img: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2dcb?auto=format&fit=crop&w=200&q=80", video: "IODKqqHjHnI" },
    { name: "Puxada Frontal", muscle: "Costas", img: "https://images.unsplash.com/photo-1517960451124-7d9b3f0a8f0b?auto=format&fit=crop&w=200&q=80", video: "CAo7hKvxeXQ" },
    { name: "Remada Curvada", muscle: "Costas", img: "https://images.unsplash.com/photo-1583500178690-f7f4aca4d0b1?auto=format&fit=crop&w=200&q=80", video: "kBji6j5XNQ4" },
    { name: "Remada Baixa", muscle: "Costas", img: "https://images.unsplash.com/photo-1597347306199-68b3a8d1c9e1?auto=format&fit=crop&w=200&q=80", video: "pApl4TKy1UM" },
    { name: "Levantamento Terra", muscle: "Costas", img: "https://images.unsplash.com/photo-1584466977773-e625c64c8d3b?auto=format&fit=crop&w=200&q=80", video: "Nyju6b1Z3UE" },
    { name: "Agachamento", muscle: "Pernas", img: "https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=200&q=80", video: "ultWZbUMPL8" },
    { name: "Leg Press", muscle: "Pernas", img: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=200&q=80", video: "IZQ0Q1N_NtU" },
    { name: "Cadeira Extensora", muscle: "Pernas", img: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=200&q=80", video: "t3D1F4q6p9w" },
    { name: "Panturrilha", muscle: "Pernas", img: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=200&q=80", video: "3b5d1w5p2Q8" },
    { name: "Rosca Direta", muscle: "Bíceps", img: "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=200&q=80", video: "kwG2ipFRgfo" },
    { name: "Rosca Martelo", muscle: "Bíceps", img: "https://images.unsplash.com/photo-1583500178690-f7f4aca4d0b1?auto=format&fit=crop&w=200&q=80", video: "z4eR3Nk5L6o" },
    { name: "Tríceps Pulley", muscle: "Tríceps", img: "https://images.unsplash.com/photo-1597347306199-68b3a8d1c9e1?auto=format&fit=crop&w=200&q=80", video: "2j5j3w4Q5e" },
    { name: "Tríceps Testa", muscle: "Tríceps", img: "https://images.unsplash.com/photo-1584466977773-e625c64c8d3b?auto=format&fit=crop&w=200&q=80", video: "5l3qJ4N8wQ" },
    { name: "Desenvolvimento", muscle: "Ombro", img: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=200&q=80", video: "q4eR3Nk5L6" },
    { name: "Elevação Lateral", muscle: "Ombro", img: "https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=200&q=80", video: "3d1w5p2Q8c" },
    { name: "Abdominal Supra", muscle: "Abdômen", img: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2dcb?auto=format&fit=crop&w=200&q=80", video: "IODKqqHjHnI" },
    { name: "Prancha", muscle: "Abdômen", img: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=200&q=80", video: "ASdvN98wQ" }
];

// =============================================
// === NAVEGAÇÃO ===
// =============================================
function navigateTo(viewName) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active-view'));
    document.getElementById(`view-${viewName}`).classList.add('active-view');
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    if (typeof event !== 'undefined' && event && event.target) {
        const btn = event.target.classList.contains('nav-btn') ? event.target : event.target.closest('.nav-btn');
        if (btn) btn.classList.add('active');
    }
    if (viewName === 'dashboard') renderDashboard();
    if (viewName === 'workouts') renderWorkouts();
    if (viewName === 'history') renderHistory();
    if (viewName === 'progression') renderProgression();
    if (viewName === 'clients') renderClients();
    if (viewName === 'profile') loadProfileData();
}

// =============================================
// === DASHBOARD ===
// =============================================
function renderDashboard() {
    document.getElementById('today-workout').innerText = DB.workouts.length > 0
        ? `${DB.workouts[0].name} - ${DB.workouts[0].desc}`
        : "Nenhum treino criado";
    document.getElementById('total-workouts').innerText = DB.history.length;
    let totalVol = 0;
    DB.history.forEach(s => totalVol += s.volume);
    document.getElementById('total-volume').innerText = totalVol.toFixed(1);
    const resumeBtn = document.getElementById('resume-btn');
    resumeBtn.style.display = (activeWorkout && activeExerciseIndex < flatSets.length) ? 'flex' : 'none';
    initWeightChart();
}

let weightChart = null;
function initWeightChart() {
    const ctx = document.getElementById('weightChart');
    if (!ctx) return;
    const context = ctx.getContext('2d');
    if (weightChart) weightChart.destroy();

    // Usa dados reais do histórico (últimas 7 sessões)
    let labels = [], data = [];
    if (DB.history.length > 0) {
        const recent = DB.history.slice(-7);
        recent.forEach(h => {
            labels.push(new Date(h.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
            data.push(parseFloat(h.volume.toFixed(1)));
        });
    } else {
        labels = ['Sem dados'];
        data = [0];
    }

    const isLight = document.body.classList.contains('light-mode');
    const lineColor = isLight ? '#3b82f6' : '#b5c7eb';
    const tickColor = isLight ? '#64748b' : '#6b6e76';

    weightChart = new Chart(context, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Volume (kg)',
                data,
                borderColor: lineColor,
                backgroundColor: isLight ? 'rgba(59,130,246,0.08)' : 'rgba(181,199,235,0.1)',
                borderWidth: 3, fill: true, tension: 0.4,
                pointBackgroundColor: lineColor, pointRadius: 4
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: tickColor } },
                x: { grid: { display: false }, ticks: { color: tickColor } }
            }
        }
    });
}

// =============================================
// === TREINOS ===
// =============================================
function renderWorkouts() {
    const list = document.getElementById('workouts-list');
    list.innerHTML = DB.workouts.length === 0 ? "<p class='subtitle'>Nenhum treino criado.</p>" : "";
    DB.workouts.forEach(w => {
        list.innerHTML += `
            <div class="workout-item">
                <div class="workout-info">
                    <h3>${w.name}</h3>
                    <p>${w.desc} - ${w.exercises.length} exercícios</p>
                </div>
                <div class="workout-actions">
                    <button class="btn-action btn-edit" onclick="editWorkout('${w.id}')"><i class="fa-solid fa-pen-to-square"></i> Editar</button>
                    <button class="btn-action btn-delete" onclick="deleteWorkout('${w.id}')"><i class="fa-solid fa-trash-can"></i> Excluir</button>
                    <button class="btn-action btn-start" onclick="startWorkout('${w.id}')"><i class="fa-solid fa-play"></i> Iniciar</button>
                </div>
            </div>`;
    });
}

function renderHistory() {
    const list = document.getElementById('history-list');
    list.innerHTML = DB.history.length === 0 ? "<p class='subtitle'>Nenhum treino realizado.</p>" : "";
    DB.history.slice().reverse().forEach(h => {
        list.innerHTML += `
            <div class="workout-item">
                <div class="workout-info">
                    <h3>${h.workoutName}</h3>
                    <p>${new Date(h.date).toLocaleDateString('pt-BR')} | Volume: ${h.volume.toFixed(1)} kg</p>
                </div>
            </div>`;
    });
}

function openVideo(name) {
    window.open(`https://www.youtube.com/results?search_query=Como+fazer+${encodeURIComponent(name)}`, '_blank');
}

// =============================================
// === MODAL DE CRIAR/EDITAR TREINO ===
// =============================================
let tempExercisesToAdd = [];
let editingWorkoutId = null;
let currentMuscleTab = "Peito";

function openCreateWorkoutModal() {
    editingWorkoutId = null;
    tempExercisesToAdd = [];
    document.getElementById('new-workout-name').value = "";
    document.getElementById('new-workout-desc').value = "";
    document.getElementById('form-modal-title').innerText = "Criar Novo Treino";
    document.getElementById('save-workout-btn').innerHTML = '<i class="fa-solid fa-check"></i> Salvar';
    document.getElementById('create-workout-modal').classList.remove('hidden');
    renderAddedExercises();
    renderLibrary();
}

function editWorkout(id) {
    const workout = DB.workouts.find(w => w.id === id);
    if (!workout) return;
    editingWorkoutId = id;
    tempExercisesToAdd = JSON.parse(JSON.stringify(workout.exercises));
    document.getElementById('new-workout-name').value = workout.name;
    document.getElementById('new-workout-desc').value = workout.desc;
    document.getElementById('form-modal-title').innerText = "Editar Treino";
    document.getElementById('save-workout-btn').innerHTML = '<i class="fa-solid fa-pen"></i> Atualizar';
    document.getElementById('create-workout-modal').classList.remove('hidden');
    renderAddedExercises();
    renderLibrary();
}

async function deleteWorkout(id) {
    if (!confirm("Excluir este treino?")) return;
    try {
        await fetch(`${API}/workouts/${id}`, { method: 'DELETE' });
        DB.workouts = DB.workouts.filter(w => w.id !== id);
        renderWorkouts();
        showToast("Treino excluído!", "success");
    } catch (err) {
        DB.workouts = DB.workouts.filter(w => w.id !== id);
        renderWorkouts();
        showToast("Treino excluído!", "success");
    }
}

function renderLibrary() {
    const tabsDiv = document.getElementById('exercises-tabs');
    const muscles = [...new Set(exerciseLibrary.map(ex => ex.muscle))];
    tabsDiv.innerHTML = "";
    muscles.forEach(m => {
        tabsDiv.innerHTML += `<button class="tab-btn ${m === currentMuscleTab ? 'active-tab' : ''}" onclick="changeMuscleTab('${m}')">${m}</button>`;
    });
    const libDiv = document.getElementById('exercises-library');
    libDiv.innerHTML = "";
    exerciseLibrary.filter(ex => ex.muscle === currentMuscleTab).forEach((ex) => {
        const globalIndex = exerciseLibrary.indexOf(ex);
        libDiv.innerHTML += `
            <div class="exercise-lib-item">
                <img src="${ex.img}" alt="${ex.name}" class="ex-thumb" onerror="this.onerror=null;this.src='https://placehold.co/200x200/1f2024/b5c7eb?text=AcadeMax';">
                <div class="ex-info">
                    <span>${ex.name}</span>
                    <button class="btn-video" onclick="openVideo('${ex.name}')"><i class="fa-solid fa-circle-play"></i> Ver Vídeo</button>
                </div>
                <button class="btn-add-lib" onclick="openExerciseConfig(${globalIndex})"><i class="fa-solid fa-plus"></i> Add</button>
            </div>`;
    });
}

function changeMuscleTab(muscle) {
    currentMuscleTab = muscle;
    renderLibrary();
}

function renderAddedExercises() {
    const addedDiv = document.getElementById('added-exercises-list');
    document.getElementById('added-count').innerText = tempExercisesToAdd.length;
    if (tempExercisesToAdd.length === 0) {
        addedDiv.innerHTML = "<p style='color: var(--text-muted); font-size: 13px; padding: 5px 0;'>Nenhum exercício adicionado.</p>";
        return;
    }
    addedDiv.innerHTML = "";
    tempExercisesToAdd.forEach((ex, index) => {
        addedDiv.innerHTML += `
            <div class="added-item">
                <span><i class="fa-solid fa-check"></i> ${ex.name} (${ex.sets.length} séries)</span>
                <button class="btn-remove" onclick="removeAddedExercise(${index})">Remover</button>
            </div>`;
    });
}

function removeAddedExercise(index) {
    tempExercisesToAdd.splice(index, 1);
    renderAddedExercises();
}

function closeCreateModal() {
    targetUserIdForWorkout = null;
    document.getElementById('create-workout-modal').classList.add('hidden');
}

// =============================================
// === MODAL DE CONFIGURAR EXERCÍCIO ===
// =============================================
let currentExerciseConfig = null;
let tempSetsCount = 3;

function openExerciseConfig(libIndex) {
    currentExerciseConfig = exerciseLibrary[libIndex];
    tempSetsCount = 3;
    document.getElementById('modal-title').innerText = currentExerciseConfig.name;
    document.getElementById('exercise-modal').classList.remove('hidden');
    updateSetsUI();
}

function adjustSets(val) {
    tempSetsCount += val;
    if (tempSetsCount < 1) tempSetsCount = 1;
    updateSetsUI();
}

function updateSetsUI() {
    document.getElementById('sets-count').innerText = tempSetsCount;
    const container = document.getElementById('sets-config-container');
    let html = `<div class="set-row-labels"><span>Série</span><span>Reps</span><span>Carga (kg)</span></div>`;
    for (let i = 0; i < tempSetsCount; i++) {
        html += `<div class="set-row"><span class="set-num-label">${i + 1}</span><input type="number" value="10" id="reps-${i}"><input type="number" value="20" id="weight-${i}"></div>`;
    }
    container.innerHTML = html;
}

function saveExercise() {
    let sets = [];
    for (let i = 0; i < tempSetsCount; i++) {
        sets.push({
            reps: parseInt(document.getElementById(`reps-${i}`).value),
            weight: parseFloat(document.getElementById(`weight-${i}`).value)
        });
    }
    tempExercisesToAdd.push({ name: currentExerciseConfig.name, sets: sets, restTime: 60 });
    document.getElementById('exercise-modal').classList.add('hidden');
    renderAddedExercises();
    showToast(`${currentExerciseConfig.name} adicionado!`, "success");
}

function closeModal() {
    document.getElementById('exercise-modal').classList.add('hidden');
}

async function saveNewWorkout() {
    const name = document.getElementById('new-workout-name').value;
    const desc = document.getElementById('new-workout-desc').value;
    if (!name || tempExercisesToAdd.length === 0) {
        showToast("Dê um nome e adicione pelo menos um exercício.", "warning");
        return;
    }
    const saveBtn = document.getElementById('save-workout-btn');
    setButtonLoading(saveBtn, true);
    const userId = targetUserIdForWorkout || loggedUser.id;
    try {
        await fetch(`${API}/workouts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, desc, exercises: tempExercisesToAdd, userId })
        });
    } catch (err) { /* continua mesmo offline */ }
    if (!targetUserIdForWorkout) {
        const newWorkout = { id: Date.now().toString(), name, desc, exercises: tempExercisesToAdd };
        if (editingWorkoutId) {
            const workout = DB.workouts.find(w => w.id === editingWorkoutId);
            workout.name = name; workout.desc = desc; workout.exercises = tempExercisesToAdd;
            showToast("Treino atualizado!", "success");
        } else {
            DB.workouts.push(newWorkout);
            showToast("Treino criado com sucesso!", "success");
        }
        renderWorkouts();
    } else {
        viewClient(targetUserIdForWorkout);
        showToast("Treino recomendado ao cliente!", "success");
    }
    editingWorkoutId = null;
    targetUserIdForWorkout = null;
    setButtonLoading(saveBtn, false);
    closeCreateModal();
}

// =============================================
// === MODO TREINO ATIVO ===
// =============================================
let activeWorkout = null;
let activeExerciseIndex = 0;
let flatSets = [];
let timerInterval = null;
let timeLeft = 0;

function startWorkout(workoutId) {
    if (!workoutId && DB.workouts.length > 0) workoutId = DB.workouts[0].id;
    activeWorkout = DB.workouts.find(w => w.id === workoutId);
    if (!activeWorkout) { showToast("Crie um treino primeiro.", "warning"); return; }
    clearInterval(timerInterval); timeLeft = 0; flatSets = [];
    activeWorkout.exercises.forEach(ex => {
        ex.sets.forEach((set, setIdx) => {
            flatSets.push({
                exName: ex.name, setIdx, totalSets: ex.sets.length,
                plannedReps: set.reps, plannedWeight: set.weight, restTime: ex.restTime
            });
        });
    });
    activeExerciseIndex = 0;
    navigateTo('active-workout');
    renderActiveSet();
}

function resumeWorkout() {
    if (!activeWorkout || activeExerciseIndex >= flatSets.length) {
        showToast("Nenhum treino em andamento.", "info"); return;
    }
    clearInterval(timerInterval); timeLeft = 0;
    document.getElementById('rest-timer').classList.add('hidden');
    document.getElementById('exercise-active-view').classList.remove('hidden');
    navigateTo('active-workout');
    renderActiveSet();
}

function renderActiveSet() {
    if (activeExerciseIndex >= flatSets.length) { finishWorkout(); return; }
    const currentSet = flatSets[activeExerciseIndex];
    document.getElementById('active-exercise-name').innerText = currentSet.exName;
    document.getElementById('active-set-num').innerText = currentSet.setIdx + 1;
    document.getElementById('active-total-sets').innerText = currentSet.totalSets;
    document.getElementById('active-reps').value = currentSet.plannedReps;
    document.getElementById('active-weight').value = currentSet.plannedWeight;
    document.getElementById('workout-progress').style.width = `${(activeExerciseIndex / flatSets.length) * 100}%`;
    document.getElementById('rest-timer').classList.add('hidden');
    document.getElementById('exercise-active-view').classList.remove('hidden');
}

function completeSet() {
    const currentSet = flatSets[activeExerciseIndex];
    currentSet.actualReps = parseInt(document.getElementById('active-reps').value);
    currentSet.actualWeight = parseFloat(document.getElementById('active-weight').value);
    activeExerciseIndex++;
    startRestTimer(currentSet.restTime);
}

function startRestTimer(seconds) {
    document.getElementById('exercise-active-view').classList.add('hidden');
    document.getElementById('rest-timer').classList.remove('hidden');
    timeLeft = seconds;
    document.getElementById('timer-display').innerText = timeLeft;
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeLeft--;
        document.getElementById('timer-display').innerText = timeLeft;
        if (timeLeft <= 0) { clearInterval(timerInterval); renderActiveSet(); }
    }, 1000);
}

function adjustTimer(val) {
    timeLeft = Math.max(0, timeLeft + val);
    document.getElementById('timer-display').innerText = timeLeft;
}

function skipRest() {
    clearInterval(timerInterval);
    timeLeft = 0;
    renderActiveSet();
}

async function finishWorkout() {
    clearInterval(timerInterval); timeLeft = 0;
    if (activeWorkout) {
        let volume = 0;
        flatSets.forEach(s => { if (s.actualReps && s.actualWeight) volume += (s.actualReps * s.actualWeight); });
        try {
            await fetch(`${API}/history`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: loggedUser.id, workoutId: activeWorkout.id, volume, sets: flatSets })
            });
        } catch (err) { /* salva localmente mesmo assim */ }
        DB.history.push({ id: Date.now().toString(), workoutName: activeWorkout.name, date: new Date().toISOString(), volume, sets: flatSets });
        showToast(`🎉 Treino concluído! Volume: ${volume.toFixed(1)} kg`, "success");
    }
    activeWorkout = null; activeExerciseIndex = 0; flatSets = [];
    navigateTo('dashboard');
}

// =============================================
// === EVOLUÇÃO ===
// =============================================
let progressionChart = null;

function renderProgression() {
    const select = document.getElementById('progression-select');
    select.innerHTML = '<option value="">Selecione...</option>';
    const uniqueExercises = new Set();
    let allRecords = [];
    DB.history.forEach(session => {
        session.sets.forEach(set => {
            if (set.exName) uniqueExercises.add(set.exName);
            if (set.actualWeight) allRecords.push({ date: new Date(session.date).toLocaleDateString('pt-BR'), weight: set.actualWeight });
        });
    });
    const exArray = Array.from(uniqueExercises).sort();
    exArray.forEach(ex => { select.innerHTML += `<option value="${ex}">${ex}</option>`; });
    calculateTimeStats(allRecords);
    document.getElementById('progression-stats').classList.add('hidden');
    document.getElementById('progression-list').innerHTML = "";
    if (progressionChart) progressionChart.destroy();
    if (exArray.length > 0) { select.value = exArray[0]; loadExerciseProgression(exArray[0]); }
    else { document.getElementById('progression-list').innerHTML = "<p class='subtitle'>Nenhum treino realizado ainda. Faça um treino para ver sua evolução!</p>"; }
}

function calculateTimeStats(records) {
    if (records.length === 0) {
        document.getElementById('stat-week').innerText = "0 kg";
        document.getElementById('stat-month').innerText = "0 kg";
        document.getElementById('stat-year').innerText = "0 kg";
        return;
    }
    const today = new Date();
    let maxWeek = 0, maxMonth = 0, maxYear = 0;
    records.forEach(rec => {
        const parts = rec.date.split('/');
        const recDate = new Date(parts[2], parts[1] - 1, parts[0]);
        if (recDate.getFullYear() === today.getFullYear()) {
            if (rec.weight > maxYear) maxYear = rec.weight;
            if (recDate.getMonth() === today.getMonth()) {
                if (rec.weight > maxMonth) maxMonth = rec.weight;
                const diffDays = Math.floor((today - recDate) / (1000 * 60 * 60 * 24));
                if (diffDays <= 7 && rec.weight > maxWeek) maxWeek = rec.weight;
            }
        }
    });
    document.getElementById('stat-week').innerText = maxWeek + " kg";
    document.getElementById('stat-month').innerText = maxMonth + " kg";
    document.getElementById('stat-year').innerText = maxYear + " kg";
}

function loadExerciseProgression(exName) {
    if (!exName) {
        document.getElementById('progression-stats').classList.add('hidden');
        document.getElementById('progression-list').innerHTML = "";
        if (progressionChart) progressionChart.destroy();
        return;
    }
    let records = [];
    DB.history.forEach(session => {
        session.sets.forEach(set => {
            if (set.exName === exName && set.actualWeight)
                records.push({ date: new Date(session.date).toLocaleDateString('pt-BR'), weight: set.actualWeight, reps: set.actualReps });
        });
    });
    if (records.length === 0) {
        document.getElementById('progression-stats').classList.add('hidden');
        document.getElementById('progression-list').innerHTML = "<p class='subtitle'>Sem dados para este exercício.</p>";
        return;
    }
    const weights = records.map(r => r.weight);
    document.getElementById('prog-start-weight').innerText = weights[0] + " kg";
    document.getElementById('prog-max-weight').innerText = Math.max(...weights) + " kg";
    document.getElementById('progression-stats').classList.remove('hidden');
    const listDiv = document.getElementById('progression-list');
    listDiv.innerHTML = "";
    records.slice().reverse().forEach(rec => {
        const isRecord = rec.weight === Math.max(...weights);
        listDiv.innerHTML += `
            <div class="prog-item">
                <div class="prog-date">
                    <span class="day">${rec.date}</span>
                    <span class="reps">${rec.reps} reps</span>
                </div>
                <div style="display:flex;align-items:center;">
                    <span class="prog-weight">${rec.weight} kg</span>
                    ${isRecord ? '<span class="prog-record"><i class="fa-solid fa-trophy"></i> Recorde</span>' : ''}
                </div>
            </div>`;
    });
    const isLight = document.body.classList.contains('light-mode');
    const lineColor = isLight ? '#3b82f6' : '#b5c7eb';
    const tickColor = isLight ? '#64748b' : '#6b6e76';
    const ctx = document.getElementById('progressionChart').getContext('2d');
    if (progressionChart) progressionChart.destroy();
    progressionChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: records.map(r => r.date),
            datasets: [{
                label: 'Carga (kg)', data: weights,
                borderColor: lineColor,
                backgroundColor: isLight ? 'rgba(59,130,246,0.08)' : 'rgba(181,199,235,0.1)',
                borderWidth: 3, fill: true, tension: 0.3,
                pointBackgroundColor: lineColor, pointRadius: 4
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { labels: { color: isLight ? '#1e293b' : '#f2f5f7' } } },
            scales: {
                y: { beginAtZero: false, grid: { color: 'rgba(128,128,128,0.1)' }, ticks: { color: tickColor } },
                x: { grid: { color: 'rgba(128,128,128,0.1)' }, ticks: { color: tickColor } }
            }
        }
    });
}

// =============================================
// === CALCULADORA DE IMC ===
// =============================================
function calculateIMC() {
    const weight = parseFloat(document.getElementById('calc-weight').value);
    const heightCm = parseFloat(document.getElementById('calc-height').value);
    const gender = document.getElementById('calc-gender').value;
    const waist = parseFloat(document.getElementById('calc-waist').value);
    const neck = parseFloat(document.getElementById('calc-neck').value);
    if (!weight || !heightCm) { showToast("Preencha pelo menos peso e altura!", "warning"); return; }
    const heightM = heightCm / 100;
    const imc = weight / (heightM * heightM);
    let imcClass = "Peso normal";
    if (imc < 18.5) imcClass = "Abaixo do peso";
    else if (imc >= 25 && imc < 30) imcClass = "Sobrepeso";
    else if (imc >= 30) imcClass = "Obesidade";
    let fatPercent = "--";
    let fatClass = "Preencha cintura e pescoço";
    if (waist && neck) {
        if (gender === 'male') {
            fatPercent = 495 / (1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(heightCm)) - 450;
        } else {
            fatPercent = 163.205 * Math.log10(waist - neck) - 97.684 * Math.log10(heightCm) - 78.387;
        }
        if (fatPercent !== "--" && !isNaN(fatPercent)) {
            fatPercent = fatPercent.toFixed(1);
            if (gender === 'male') {
                if (fatPercent < 6) fatClass = "Essencial"; else if (fatPercent < 14) fatClass = "Atleta";
                else if (fatPercent < 18) fatClass = "Boa forma"; else if (fatPercent < 25) fatClass = "Aceitável";
                else fatClass = "Elevada";
            } else {
                if (fatPercent < 14) fatClass = "Essencial"; else if (fatPercent < 21) fatClass = "Atleta";
                else if (fatPercent < 25) fatClass = "Boa forma"; else if (fatPercent < 31) fatClass = "Aceitável";
                else fatClass = "Elevada";
            }
        }
    }
    document.getElementById('res-imc').innerText = imc.toFixed(1);
    document.getElementById('res-imc-class').innerText = imcClass;
    document.getElementById('res-fat').innerText = fatPercent;
    document.getElementById('res-fat-class').innerText = fatClass;
    document.getElementById('imc-result').classList.remove('hidden');
}

// =============================================
// === PERFIL ===
// =============================================
function loadProfileData() {
    const userData = loggedUser;
    const birthdate = userData.birthdate
        ? new Date(userData.birthdate).toLocaleDateString('pt-BR')
        : 'Não informado';
    const memberSince = userData.createdAt
        ? new Date(userData.createdAt).toLocaleDateString('pt-BR')
        : 'Não informado';

    document.getElementById('view-profile').innerHTML = `
        <h1>Perfil</h1>
        <div class="card" style="text-align:center;">
            ${userData.picture
                ? `<img src="${userData.picture}" alt="Foto" style="width:100px;height:100px;border-radius:50%;margin:0 auto 15px;display:block;border:3px solid var(--primary);object-fit:cover;">`
                : `<div style="width:100px;height:100px;border-radius:50%;background:var(--bg-input);display:flex;align-items:center;justify-content:center;margin:0 auto 15px;"><i class="fa-solid fa-user" style="font-size:40px;color:var(--text-muted);"></i></div>`}
            <h3 style="font-size:22px;margin-bottom:5px;">${userData.name || 'Atleta'}</h3>
            ${userData.isAdmin
                ? '<span style="display:inline-block;font-size:11px;background:var(--primary);color:#0b0c0e;padding:4px 12px;border-radius:10px;margin-bottom:20px;font-weight:600;">Administrador</span>'
                : '<span style="display:inline-block;font-size:11px;background:var(--bg-input);color:var(--text-muted);padding:4px 12px;border-radius:10px;margin-bottom:20px;">Cliente</span>'}
            <div style="text-align:left;margin-top:15px;">
                <p style="margin-bottom:12px;display:flex;align-items:center;gap:12px;"><i class="fa-solid fa-envelope" style="color:var(--primary);width:20px;text-align:center;"></i> ${userData.email || 'Não informado'}</p>
                <p style="margin-bottom:12px;display:flex;align-items:center;gap:12px;"><i class="fa-solid fa-phone" style="color:var(--primary);width:20px;text-align:center;"></i> ${userData.phone || 'Telefone não cadastrado'}</p>
                <p style="margin-bottom:12px;display:flex;align-items:center;gap:12px;"><i class="fa-solid fa-cake-candles" style="color:var(--primary);width:20px;text-align:center;"></i> ${birthdate}</p>
                <p style="display:flex;align-items:center;gap:12px;"><i class="fa-solid fa-calendar-plus" style="color:var(--primary);width:20px;text-align:center;"></i> Membro desde ${memberSince}</p>
            </div>
            <button class="btn-primary btn-full" style="margin-top:20px;" onclick="editProfile()"><i class="fa-solid fa-pen"></i> Editar Perfil</button>
        </div>

        <div class="card">
            <h3 style="margin-bottom:15px;font-size:14px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">Resumo</h3>
            <div class="grid-2">
                <div style="text-align:center;">
                    <p style="font-size:28px;font-weight:800;color:var(--primary);">${DB.history.length}</p>
                    <p style="font-size:13px;color:var(--text-muted);">Treinos feitos</p>
                </div>
                <div style="text-align:center;">
                    <p style="font-size:28px;font-weight:800;color:var(--success);">${DB.workouts.length}</p>
                    <p style="font-size:13px;color:var(--text-muted);">Treinos criados</p>
                </div>
            </div>
        </div>

        <button class="btn-danger-outline btn-full" onclick="logout()"><i class="fa-solid fa-right-from-bracket"></i> Sair da Conta</button>
    `;
}

function editProfile() {
    const userData = loggedUser;
    document.getElementById('view-profile').innerHTML = `
        <h1>Editar Perfil</h1>
        <div class="card">
            <label>Nome</label>
            <input type="text" id="edit-name" value="${userData.name || ''}" style="margin-bottom:15px;">
            <label>URL da Foto de Perfil</label>
            <input type="text" id="edit-picture" value="${userData.picture || ''}" placeholder="Cole o link da imagem aqui" style="margin-bottom:15px;">
            <label>Telefone</label>
            <input type="tel" id="edit-phone" value="${userData.phone || ''}" placeholder="Ex: (11) 99999-9999" style="margin-bottom:15px;">
            <div class="modal-actions" style="margin-top:10px;">
                <button class="btn-danger-outline" onclick="loadProfileData()">Cancelar</button>
                <button class="btn-primary" id="save-profile-btn" onclick="saveProfile()"><i class="fa-solid fa-check"></i> Salvar</button>
            </div>
        </div>
    `;
}

async function saveProfile() {
    const newName = document.getElementById('edit-name').value;
    const newPicture = document.getElementById('edit-picture').value;
    const newPhone = document.getElementById('edit-phone').value;
    if (!newName) { showToast("O nome não pode ficar vazio!", "warning"); return; }
    const saveBtn = document.getElementById('save-profile-btn');
    setButtonLoading(saveBtn, true);
    try {
        const res = await fetch(`${API}/users/${loggedUser.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName, picture: newPicture, phone: newPhone })
        });
        const data = await res.json();
        if (data.error) { showToast(data.error, "error"); setButtonLoading(saveBtn, false); return; }
        localStorage.setItem('academax_user', JSON.stringify(data));
        showToast("Perfil atualizado com sucesso!", "success");
        loadProfileData();
    } catch (err) {
        showToast("Erro de conexão.", "error");
        setButtonLoading(saveBtn, false);
    }
}

function logout() {
    if (confirm("Deseja realmente sair da conta?")) {
        localStorage.removeItem('academax_user');
        window.location.href = 'login.html';
    }
}

// =============================================
// === PAINEL ADMIN (CLIENTES) ===
// =============================================
function checkAdminStatus() {
    const navClients = document.getElementById('nav-clients');
    navClients.style.display = loggedUser.isAdmin ? 'flex' : 'none';
}

async function renderClients() {
    const list = document.getElementById('clients-list');
    list.innerHTML = "<p class='subtitle'>Carregando clientes...</p>";
    try {
        const res = await fetch(`${API}/users`);
        globalClients = await res.json();
        if (globalClients.length === 0) { list.innerHTML = "<p class='subtitle'>Nenhum cliente cadastrado.</p>"; return; }
        list.innerHTML = "";
        globalClients.forEach(u => {
            list.innerHTML += `
                <div class="client-card">
                    <div class="client-info">
                        <div class="client-avatar">${u.picture ? `<img src="${u.picture}" alt="${u.name}">` : `<i class="fa-solid fa-user"></i>`}</div>
                        <div class="client-details">
                            <h3>${u.name} ${u.isAdmin ? '<span class="admin-badge">ADMIN</span>' : ''}</h3>
                            <p>${u.email}</p>
                        </div>
                    </div>
                    <button class="manage-btn" onclick="viewClient('${u.id}')"><i class="fa-solid fa-gear"></i> Gerenciar</button>
                </div>`;
        });
    } catch (err) {
        list.innerHTML = "<p class='subtitle'>Erro ao carregar clientes.</p>";
        showToast("Erro ao carregar clientes.", "error");
    }
}

async function viewClient(id) {
    const client = globalClients.find(u => u.id === id);
    if (!client) return;
    document.getElementById('manage-client-title').innerText = "Gerenciar: " + client.name;
    document.getElementById('manage-client-content').innerHTML = "<p class='subtitle'>Carregando dados...</p>";
    let workoutsHTML = "<p class='subtitle'>Nenhum treino recomendado ainda.</p>";
    try {
        const resWorkouts = await fetch(`${API}/workouts/${id}`);
        const clientWorkouts = await resWorkouts.json();
        if (clientWorkouts.length > 0) {
            workoutsHTML = "";
            clientWorkouts.forEach(w => {
                workoutsHTML += `<div class="workout-item"><div class="workout-info"><h3>${w.name}</h3><p>${w.desc} - ${w.exercises.length} exercícios</p></div></div>`;
            });
        }
    } catch (err) { workoutsHTML = "<p class='subtitle'>Erro ao carregar treinos.</p>"; }

    document.getElementById('manage-client-content').innerHTML = `
        <div class="card">
            <h3 style="margin-bottom:15px;"><i class="fa-solid fa-user-pen"></i> Editar Perfil</h3>
            <label>Nome</label><input type="text" id="admin-edit-name" value="${client.name}" style="margin-bottom:15px;">
            <label>URL da Foto</label><input type="text" id="admin-edit-picture" value="${client.picture || ''}" style="margin-bottom:15px;">
            <label>Telefone</label><input type="tel" id="admin-edit-phone" value="${client.phone || ''}" style="margin-bottom:20px;">
            <button class="btn-primary btn-full" id="admin-save-btn" onclick="adminSaveClient('${id}')"><i class="fa-solid fa-check"></i> Salvar Alterações</button>
        </div>
        <div class="card">
            <div class="header-flex" style="margin-bottom:15px;">
                <h3 style="margin:0;"><i class="fa-solid fa-dumbbell"></i> Treinos Recomendados</h3>
                <button class="btn-primary" style="width:auto;margin:0;padding:10px 15px;font-size:14px;" onclick="adminAddWorkout('${id}')"><i class="fa-solid fa-plus"></i> Recomendar</button>
            </div>
            <div class="workouts-list">${workoutsHTML}</div>
        </div>
        <div class="card danger-zone">
            <h3 style="margin-bottom:15px;"><i class="fa-solid fa-triangle-exclamation"></i> Zona de Perigo</h3>
            <button class="btn-danger btn-full" onclick="adminDeleteClient('${id}')"><i class="fa-solid fa-trash-can"></i> Excluir Conta</button>
        </div>
    `;
    navigateTo('manage-client');
}

async function adminSaveClient(id) {
    const newName = document.getElementById('admin-edit-name').value;
    const newPicture = document.getElementById('admin-edit-picture').value;
    const newPhone = document.getElementById('admin-edit-phone').value;
    const saveBtn = document.getElementById('admin-save-btn');
    setButtonLoading(saveBtn, true);
    try {
        const res = await fetch(`${API}/users/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName, picture: newPicture, phone: newPhone })
        });
        const data = await res.json();
        if (data.error) { showToast(data.error, "error"); setButtonLoading(saveBtn, false); return; }
        const index = globalClients.findIndex(u => u.id === id);
        if (index >= 0) globalClients[index] = data;
        showToast("Perfil atualizado!", "success");
        viewClient(id);
    } catch (err) {
        showToast("Erro de conexão.", "error");
        setButtonLoading(saveBtn, false);
    }
}

async function adminDeleteClient(id) {
    if (!confirm("EXCLUIR este cliente permanentemente?")) return;
    try {
        const res = await fetch(`${API}/users/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.error) { showToast(data.error, "error"); return; }
        showToast("Cliente excluído!", "success");
        navigateTo('clients');
        renderClients();
    } catch (err) {
        showToast("Erro de conexão.", "error");
    }
}

function adminAddWorkout(id) {
    targetUserIdForWorkout = id;
    openCreateWorkoutModal();
}

// =============================================
// === TEMA CLARO / ESCURO ===
// =============================================
function toggleTheme() {
    document.body.classList.toggle('light-mode');
    const isLight = document.body.classList.contains('light-mode');
    localStorage.setItem('academax_theme', isLight ? 'light' : 'dark');
    const toggleIcon = document.querySelector('.theme-toggle i');
    if (toggleIcon) toggleIcon.className = isLight ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
}

function applyTheme() {
    if (localStorage.getItem('academax_theme') === 'light') {
        document.body.classList.add('light-mode');
        const toggleIcon = document.querySelector('.theme-toggle i');
        if (toggleIcon) toggleIcon.className = 'fa-solid fa-moon';
    }
}

// =============================================
// === INICIALIZA APP ===
// =============================================
applyTheme();
checkAdminStatus();
loadDB();

// =============================================
// === NUTRIÇÃO ===
// =============================================
function calculateNutrition() {
    const weight  = parseFloat(document.getElementById('nutr-weight').value);
    const height  = parseFloat(document.getElementById('nutr-height').value);
    const age     = parseFloat(document.getElementById('nutr-age').value);
    const gender  = document.getElementById('nutr-gender').value;
    const activity = parseFloat(document.getElementById('nutr-activity').value);
    const goal    = document.getElementById('nutr-goal').value;

    if (!weight || !height || !age) { showToast("Preencha todos os campos!", "warning"); return; }

    // TMB (Harris-Benedict revisado)
    let tmb;
    if (gender === 'male') {
        tmb = 88.362 + (13.397 * weight) + (4.799 * height) - (5.677 * age);
    } else {
        tmb = 447.593 + (9.247 * weight) + (3.098 * height) - (4.330 * age);
    }
    const tdee = Math.round(tmb * activity);

    // Ajuste por objetivo
    const goalAdjust = { cut: -400, maintain: 0, bulk: 300 };
    const goalLabels = { cut: 'Déficit calórico (emagrecer)', maintain: 'Manutenção', bulk: 'Superávit (ganhar massa)' };
    const goalCal = tdee + goalAdjust[goal];

    // Distribuição de macros por objetivo (% de kcal)
    const macroPct = {
        cut:      { prot: 0.35, carb: 0.40, fat: 0.25 },
        maintain: { prot: 0.25, carb: 0.50, fat: 0.25 },
        bulk:     { prot: 0.25, carb: 0.50, fat: 0.25 }
    };
    const pct = macroPct[goal];
    const protG  = Math.round((goalCal * pct.prot) / 4);
    const carbG  = Math.round((goalCal * pct.carb) / 4);
    const fatG   = Math.round((goalCal * pct.fat)  / 9);
    const water  = (weight * 0.035).toFixed(1);

    // Atualiza tela
    document.getElementById('nutr-tdee').innerText     = tdee;
    document.getElementById('nutr-goal-cal').innerText = goalCal;
    document.getElementById('nutr-goal-label').innerText = goalLabels[goal];
    document.getElementById('macro-prot').innerText    = protG + 'g';
    document.getElementById('macro-carb').innerText    = carbG + 'g';
    document.getElementById('macro-fat').innerText     = fatG  + 'g';
    document.getElementById('macro-water').innerText   = water + 'L';
    document.getElementById('macro-prot-cal').innerText = Math.round(protG * 4) + ' kcal';
    document.getElementById('macro-carb-cal').innerText = Math.round(carbG * 4) + ' kcal';
    document.getElementById('macro-fat-cal').innerText  = Math.round(fatG  * 9) + ' kcal';

    // Barras de macro
    const pctProt = Math.round(pct.prot * 100);
    const pctCarb = Math.round(pct.carb * 100);
    const pctFat  = Math.round(pct.fat  * 100);
    document.getElementById('macro-bars').innerHTML = `
        <div class="macro-bar-row">
            <span class="macro-bar-label" style="color:#10b981;">Proteína</span>
            <div class="macro-bar-track"><div class="macro-bar-fill" style="width:${pctProt}%;background:#10b981;"></div></div>
            <span class="macro-bar-pct">${pctProt}%</span>
        </div>
        <div class="macro-bar-row">
            <span class="macro-bar-label" style="color:#f59e0b;">Carboidrato</span>
            <div class="macro-bar-track"><div class="macro-bar-fill" style="width:${pctCarb}%;background:#f59e0b;"></div></div>
            <span class="macro-bar-pct">${pctCarb}%</span>
        </div>
        <div class="macro-bar-row">
            <span class="macro-bar-label" style="color:#ef4444;">Gordura</span>
            <div class="macro-bar-track"><div class="macro-bar-fill" style="width:${pctFat}%;background:#ef4444;"></div></div>
            <span class="macro-bar-pct">${pctFat}%</span>
        </div>`;

    // Dicas por objetivo
    const tips = {
        cut: [
            { icon: 'fa-fire', color: '#ef4444', text: 'Priorize proteína para preservar massa muscular durante o déficit.' },
            { icon: 'fa-droplet', color: '#3b82f6', text: 'Beba bastante água — ela ajuda a controlar a fome e acelera o metabolismo.' },
            { icon: 'fa-clock', color: '#f59e0b', text: 'Distribua as refeições ao longo do dia para evitar picos de fome.' },
            { icon: 'fa-triangle-exclamation', color: '#f59e0b', text: 'Não reduza calorias demais de uma vez. Déficits maiores que 500 kcal/dia podem causar perda de músculo.' }
        ],
        maintain: [
            { icon: 'fa-scale-balanced', color: '#10b981', text: 'Mantenha consistência nas refeições para estabilizar o metabolismo.' },
            { icon: 'fa-dumbbell', color: 'var(--primary)', text: 'Treinamento de força aliado à manutenção calórica favorece a recomposição corporal.' },
            { icon: 'fa-leaf', color: '#10b981', text: 'Priorize alimentos integrais e minimize ultraprocessados.' }
        ],
        bulk: [
            { icon: 'fa-arrow-trend-up', color: '#10b981', text: 'Superávit controlado de 200–300 kcal minimiza ganho de gordura desnecessário.' },
            { icon: 'fa-egg', color: '#f59e0b', text: 'Consuma proteína distribuída em várias refeições para maximizar a síntese muscular.' },
            { icon: 'fa-bolt', color: '#f59e0b', text: 'Carboidratos antes e depois do treino otimizam desempenho e recuperação.' },
            { icon: 'fa-bed', color: 'var(--primary)', text: 'O crescimento muscular acontece no descanso — durma pelo menos 7–8 horas por noite.' }
        ]
    };
    document.getElementById('nutr-tips').innerHTML = tips[goal]
        .map(t => `<div class="nutr-tip-item"><i class="fa-solid ${t.icon}" style="color:${t.color};"></i><p>${t.text}</p></div>`)
        .join('');

    document.getElementById('nutr-result').classList.remove('hidden');
    showToast("Cálculo concluído!", "success");
}

// =============================================
// === FICHA DE SAÚDE ===
// =============================================
let selectedObjetivo = '';
let selectedNivel    = '';

const fichaConditions = [
    { id: 'cond_cardio',    label: 'Problema cardíaco',    icon: 'fa-heart-pulse',   color: 'red'    },
    { id: 'cond_pressao',   label: 'Pressão alta',          icon: 'fa-gauge-high',    color: 'red'    },
    { id: 'cond_diabetes',  label: 'Diabetes',              icon: 'fa-syringe',       color: 'yellow' },
    { id: 'cond_coluna',    label: 'Problema na coluna',    icon: 'fa-bone',          color: 'yellow' },
    { id: 'cond_joelho',    label: 'Problema no joelho',    icon: 'fa-person-walking',color: 'yellow' },
    { id: 'cond_ombro',     label: 'Problema no ombro',     icon: 'fa-person-skiing', color: 'yellow' },
    { id: 'cond_asma',      label: 'Asma / resp. dificult.',icon: 'fa-lungs',         color: 'blue'   },
    { id: 'cond_cirurgia',  label: 'Cirurgia recente',      icon: 'fa-scissors',      color: 'red'    },
    { id: 'cond_gravida',   label: 'Gravidez',              icon: 'fa-baby',          color: 'blue'   },
    { id: 'cond_outro',     label: 'Outro problema',        icon: 'fa-notes-medical', color: 'yellow' },
];

const fichaObjetivos = [
    { value: 'hipertrofia', label: 'Hipertrofia',    icon: 'fa-dumbbell'       },
    { value: 'emagrecer',   label: 'Emagrecer',      icon: 'fa-fire'           },
    { value: 'saude',       label: 'Saúde geral',    icon: 'fa-heart'          },
    { value: 'condicion',   label: 'Condicionamento',icon: 'fa-person-running' },
    { value: 'reabilit',    label: 'Reabilitação',   icon: 'fa-kit-medical'    },
    { value: 'flexib',      label: 'Flexibilidade',  icon: 'fa-child-reaching' },
];

function renderHealthForm(existingData) {
    const d = existingData || {};
    selectedObjetivo = d.objetivo || '';
    selectedNivel    = d.nivel    || '';

    const condChecks = fichaConditions.map(c => `
        <label class="health-check-item">
            <input type="checkbox" id="${c.id}" ${d.conditions && d.conditions.includes(c.id) ? 'checked' : ''}>
            <i class="fa-solid ${c.icon}" style="color:var(--${c.color === 'red' ? 'danger' : c.color === 'green' ? 'success' : 'primary'});font-size:16px;"></i>
            ${c.label}
        </label>`).join('');

    const objBtns = fichaObjetivos.map(o => `
        <button class="objetivo-btn ${selectedObjetivo === o.value ? 'selected' : ''}"
            onclick="selectObjetivo('${o.value}')">
            <i class="fa-solid ${o.icon}"></i>${o.label}
        </button>`).join('');

    return `
        <div class="health-section">
            <p class="health-section-title"><i class="fa-solid fa-notes-medical"></i> Condições de Saúde</p>
            <div class="health-check-grid">${condChecks}</div>
            <div class="input-group" style="margin-top:14px;">
                <label>Medicamentos em uso (opcional)</label>
                <input type="text" id="ficha-medicamentos" value="${d.medicamentos || ''}" placeholder="Ex: Losartana, Metformina...">
            </div>
            <div class="input-group">
                <label>Observações / Restrições adicionais</label>
                <input type="text" id="ficha-obs" value="${d.obs || ''}" placeholder="Ex: dor no joelho esquerdo ao agachar">
            </div>
        </div>
        <div class="health-section">
            <p class="health-section-title"><i class="fa-solid fa-bullseye"></i> Objetivo Principal</p>
            <div class="objetivo-btn-grid" id="objetivo-grid">${objBtns}</div>
        </div>
        <div class="health-section">
            <p class="health-section-title"><i class="fa-solid fa-gauge"></i> Nível de Experiência</p>
            <div class="nivel-btn-grid">
                <button class="nivel-btn ${selectedNivel === 'iniciante' ? 'selected' : ''}" onclick="selectNivel('iniciante')">🌱 Iniciante</button>
                <button class="nivel-btn ${selectedNivel === 'intermediario' ? 'selected' : ''}" onclick="selectNivel('intermediario')">💪 Intermediário</button>
                <button class="nivel-btn ${selectedNivel === 'avancado' ? 'selected' : ''}" onclick="selectNivel('avancado')">🔥 Avançado</button>
            </div>
        </div>
        <button class="btn-primary btn-full" id="save-ficha-btn" onclick="saveFicha()">
            <i class="fa-solid fa-floppy-disk"></i> Salvar Ficha
        </button>`;
}

function selectObjetivo(value) {
    selectedObjetivo = value;
    document.querySelectorAll('.objetivo-btn').forEach(b => b.classList.remove('selected'));
    event.target.closest('.objetivo-btn').classList.add('selected');
}

function selectNivel(value) {
    selectedNivel = value;
    document.querySelectorAll('.nivel-btn').forEach(b => b.classList.remove('selected'));
    event.target.closest('.nivel-btn').classList.add('selected');
}

function getFichaData() {
    const checkedConditions = fichaConditions
        .filter(c => document.getElementById(c.id) && document.getElementById(c.id).checked)
        .map(c => c.id);
    return {
        conditions:    checkedConditions,
        medicamentos:  document.getElementById('ficha-medicamentos')?.value || '',
        obs:           document.getElementById('ficha-obs')?.value || '',
        objetivo:      selectedObjetivo,
        nivel:         selectedNivel,
        updatedAt:     new Date().toISOString()
    };
}

async function saveFicha() {
    const btn = document.getElementById('save-ficha-btn');
    setButtonLoading(btn, true);
    const fichaData = getFichaData();
    try {
        await fetch(`${API}/users/${loggedUser.id}/ficha`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fichaData)
        });
    } catch (err) { /* salva localmente mesmo sem backend */ }
    // Salva localmente no usuário logado
    const updated = { ...loggedUser, ficha: fichaData };
    localStorage.setItem('academax_user', JSON.stringify(updated));
    Object.assign(loggedUser, updated);
    showToast("Ficha salva com sucesso!", "success");
    setButtonLoading(btn, false);
    loadProfileData(); // Volta para o perfil mostrando a ficha salva
}

// Versão admin — salva a ficha de um cliente específico
async function saveAdminFicha(clientId) {
    const btn = document.getElementById('save-admin-ficha-btn');
    setButtonLoading(btn, true);
    const fichaData = getFichaData();
    try {
        await fetch(`${API}/users/${clientId}/ficha`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fichaData)
        });
        const idx = globalClients.findIndex(u => u.id === clientId);
        if (idx >= 0) globalClients[idx].ficha = fichaData;
        showToast("Ficha do cliente salva!", "success");
    } catch (err) {
        showToast("Erro ao salvar no servidor.", "error");
    }
    setButtonLoading(btn, false);
}

function renderFichaBadges(ficha) {
    if (!ficha || (!ficha.conditions?.length && !ficha.objetivo && !ficha.nivel)) {
        return `<p style="color:var(--text-muted);font-size:14px;">Ficha não preenchida ainda.</p>`;
    }
    const hasAlert = ficha.conditions?.some(c => ['cond_cardio','cond_pressao','cond_cirurgia'].includes(c));
    const condLabels = Object.fromEntries(fichaConditions.map(c => [c.id, { label: c.label, color: c.color }]));
    const objLabels  = Object.fromEntries(fichaObjetivos.map(o => [o.value, o.label]));
    const nivelLabel = { iniciante: '🌱 Iniciante', intermediario: '💪 Intermediário', avancado: '🔥 Avançado' };

    let html = '';
    if (hasAlert) {
        html += `<div class="health-alert-banner"><i class="fa-solid fa-triangle-exclamation"></i> Atenção: este aluno possui restrições de saúde importantes. Adapte os treinos!</div>`;
    }
    if (ficha.conditions?.length) {
        html += `<div style="margin-bottom:12px;"><p style="font-size:12px;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Condições</p>`;
        html += ficha.conditions.map(c => condLabels[c]
            ? `<span class="health-badge ${condLabels[c].color}">${condLabels[c].label}</span>`
            : '').join('');
        html += `</div>`;
    }
    if (ficha.objetivo) {
        html += `<div style="margin-bottom:8px;"><p style="font-size:12px;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Objetivo</p><span class="health-badge green">${objLabels[ficha.objetivo] || ficha.objetivo}</span></div>`;
    }
    if (ficha.nivel) {
        html += `<div style="margin-bottom:8px;"><p style="font-size:12px;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Nível</p><span class="health-badge blue">${nivelLabel[ficha.nivel] || ficha.nivel}</span></div>`;
    }
    if (ficha.medicamentos) {
        html += `<div style="margin-bottom:8px;"><p style="font-size:12px;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Medicamentos</p><p style="font-size:14px;">${ficha.medicamentos}</p></div>`;
    }
    if (ficha.obs) {
        html += `<div><p style="font-size:12px;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Observações</p><p style="font-size:14px;">${ficha.obs}</p></div>`;
    }
    return html;
}

// =============================================
// === PERFIL (REESCRITO COM FICHA) ===
// =============================================
// Sobrescreve a função loadProfileData anterior
loadProfileData = function() {
    const userData = loggedUser;
    const birthdate   = userData.birthdate  ? new Date(userData.birthdate).toLocaleDateString('pt-BR') : 'Não informado';
    const memberSince = userData.createdAt  ? new Date(userData.createdAt).toLocaleDateString('pt-BR') : 'Não informado';
    const fichaHTML   = renderFichaBadges(userData.ficha);

    document.getElementById('view-profile').innerHTML = `
        <h1>Perfil</h1>
        <div class="card" style="text-align:center;">
            ${userData.picture
                ? `<img src="${userData.picture}" alt="Foto" style="width:100px;height:100px;border-radius:50%;margin:0 auto 15px;display:block;border:3px solid var(--primary);object-fit:cover;">`
                : `<div style="width:100px;height:100px;border-radius:50%;background:var(--bg-input);display:flex;align-items:center;justify-content:center;margin:0 auto 15px;"><i class="fa-solid fa-user" style="font-size:40px;color:var(--text-muted);"></i></div>`}
            <h3 style="font-size:22px;margin-bottom:5px;">${userData.name || 'Atleta'}</h3>
            ${userData.isAdmin
                ? '<span style="display:inline-block;font-size:11px;background:var(--primary);color:#0b0c0e;padding:4px 12px;border-radius:10px;margin-bottom:20px;font-weight:600;">Administrador</span>'
                : '<span style="display:inline-block;font-size:11px;background:var(--bg-input);color:var(--text-muted);padding:4px 12px;border-radius:10px;margin-bottom:20px;">Cliente</span>'}
            <div style="text-align:left;margin-top:15px;">
                <p style="margin-bottom:12px;display:flex;align-items:center;gap:12px;"><i class="fa-solid fa-envelope" style="color:var(--primary);width:20px;text-align:center;"></i> ${userData.email || 'Não informado'}</p>
                <p style="margin-bottom:12px;display:flex;align-items:center;gap:12px;"><i class="fa-solid fa-phone" style="color:var(--primary);width:20px;text-align:center;"></i> ${userData.phone || 'Não cadastrado'}</p>
                <p style="margin-bottom:12px;display:flex;align-items:center;gap:12px;"><i class="fa-solid fa-cake-candles" style="color:var(--primary);width:20px;text-align:center;"></i> ${birthdate}</p>
                <p style="display:flex;align-items:center;gap:12px;"><i class="fa-solid fa-calendar-plus" style="color:var(--primary);width:20px;text-align:center;"></i> Membro desde ${memberSince}</p>
            </div>
            <button class="btn-primary btn-full" style="margin-top:20px;" onclick="editProfile()"><i class="fa-solid fa-pen"></i> Editar Perfil</button>
        </div>

        <div class="card">
            <h3 style="margin-bottom:15px;font-size:14px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">Resumo</h3>
            <div class="grid-2">
                <div style="text-align:center;">
                    <p style="font-size:28px;font-weight:800;color:var(--primary);">${DB.history.length}</p>
                    <p style="font-size:13px;color:var(--text-muted);">Treinos feitos</p>
                </div>
                <div style="text-align:center;">
                    <p style="font-size:28px;font-weight:800;color:var(--success);">${DB.workouts.length}</p>
                    <p style="font-size:13px;color:var(--text-muted);">Treinos criados</p>
                </div>
            </div>
        </div>

        <div class="card">
            <div class="header-flex" style="margin-bottom:15px;">
                <h3 style="margin:0;font-size:16px;font-weight:700;"><i class="fa-solid fa-notes-medical" style="color:var(--primary);margin-right:8px;"></i>Ficha de Saúde</h3>
                <button class="btn-action btn-edit" onclick="showFichaForm()"
                    style="padding:8px 14px;font-size:13px;">
                    <i class="fa-solid fa-pen-to-square"></i> ${userData.ficha ? 'Editar' : 'Preencher'}
                </button>
            </div>
            <div id="ficha-preview">${fichaHTML}</div>
            <div id="ficha-form-container" class="hidden" style="margin-top:16px;">
                ${renderHealthForm(userData.ficha)}
            </div>
        </div>

        <button class="btn-danger-outline btn-full" onclick="logout()"><i class="fa-solid fa-right-from-bracket"></i> Sair da Conta</button>
    `;
};

function showFichaForm() {
    const container = document.getElementById('ficha-form-container');
    const preview   = document.getElementById('ficha-preview');
    container.classList.toggle('hidden');
    preview.style.display = container.classList.contains('hidden') ? 'block' : 'none';
}

// Injeta ficha na tela de gerenciar cliente (admin)
function injectAdminFicha(client) {
    const fichaSection = document.getElementById('admin-ficha-section');
    if (!fichaSection) return;
    fichaSection.innerHTML = `
        <div class="card" style="margin-top:16px;">
            <div class="header-flex" style="margin-bottom:15px;">
                <h3 style="margin:0;font-size:16px;font-weight:700;">
                    <i class="fa-solid fa-notes-medical" style="color:var(--primary);margin-right:8px;"></i>Ficha de Saúde
                </h3>
                <button class="btn-action btn-edit" onclick="toggleAdminFichaForm('${client.id}')" style="padding:8px 14px;font-size:13px;">
                    <i class="fa-solid fa-pen-to-square"></i> ${client.ficha ? 'Editar' : 'Preencher'}
                </button>
            </div>
            <div id="admin-ficha-preview">${renderFichaBadges(client.ficha)}</div>
            <div id="admin-ficha-form" class="hidden" style="margin-top:16px;">
                ${renderHealthForm(client.ficha)}
                <button class="btn-primary btn-full" id="save-admin-ficha-btn"
                    onclick="saveAdminFicha('${client.id}')" style="margin-top:10px;">
                    <i class="fa-solid fa-floppy-disk"></i> Salvar Ficha do Cliente
                </button>
            </div>
        </div>`;
}

function toggleAdminFichaForm(clientId) {
    const form    = document.getElementById('admin-ficha-form');
    const preview = document.getElementById('admin-ficha-preview');
    form.classList.toggle('hidden');
    preview.style.display = form.classList.contains('hidden') ? 'block' : 'none';
}

// Patch na viewClient para incluir a ficha
const _origViewClient = viewClient;
viewClient = async function(id) {
    await _origViewClient(id);
    const client = globalClients.find(u => u.id === id);
    if (client) {
        // Adiciona placeholder para a ficha depois que o HTML for injetado
        const content = document.getElementById('manage-client-content');
        const fichaDiv = document.createElement('div');
        fichaDiv.id = 'admin-ficha-section';
        content.appendChild(fichaDiv);
        injectAdminFicha(client);
    }
};
