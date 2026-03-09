// ============================================
// SUPABASE КОНФИГ
// ============================================
const SUPABASE_URL = 'https://wdcwxvxkvyncybsefotj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_VMEPI3FAZoKDgX4ae_pqcg_Euvs40hM';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ============================================
// ПРОВЕРКА ЭЛЕМЕНТОВ ПЕРЕД ИСПОЛЬЗОВАНИЕМ
// ============================================
function safeElement(id) {
    return document.getElementById(id);
}

// ============================================
// СОГЛАШЕНИЕ
// ============================================
const agreementScreen = safeElement('agreementScreen');
const mainContent = safeElement('mainContent');
const schoolCheckbox = safeElement('schoolCheckbox');
const enterBtn = safeElement('enterSiteBtn');

if (agreementScreen && mainContent && schoolCheckbox && enterBtn) {
    if (localStorage.getItem('agreement62') === 'accepted') {
        agreementScreen.style.display = 'none';
        mainContent.style.display = 'block';
        initApp();
    }

    schoolCheckbox.addEventListener('change', function() {
        enterBtn.disabled = !this.checked;
    });

    enterBtn.addEventListener('click', function() {
        localStorage.setItem('agreement62', 'accepted');
        agreementScreen.style.display = 'none';
        mainContent.style.display = 'block';
        initApp();
    });
}

// ============================================
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// ============================================
let userIp = null;
let primeUser = JSON.parse(localStorage.getItem('primeUser') || 'null');
let userVotes = {};
let lastCommentTime = null;
let allCandidates = [];
let currentPair = [];
let selectedCandidateId = null;
let comments = [];
let autoRefreshEnabled = true;

// ============================================
// ПОЛУЧЕНИЕ IP
// ============================================
async function getUserIp() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
    } catch {
        return 'user-' + Math.random().toString(36).substring(2, 10);
    }
}

// ============================================
// СООБЩЕНИЯ
// ============================================
function showMessage(text, type) {
    const container = safeElement('messageContainer');
    if (!container) return;
    
    const msg = document.createElement('div');
    msg.className = `message ${type}`;
    msg.textContent = text;
    container.appendChild(msg);
    setTimeout(() => msg.remove(), 3000);
}

// ============================================
// PRIME СИСТЕМА
// ============================================
function updatePrimeUI() {
    const primeIcon = safeElement('primeIcon');
    const primeName = safeElement('primeName');
    const primeStatus = safeElement('primeStatus');
    const commentName = safeElement('commentName');
    
    if (primeUser && primeStatus) {
        primeStatus.style.display = 'flex';
        if (primeName) primeName.textContent = primeUser.username;
        
        if (commentName) {
            commentName.value = primeUser.username;
            commentName.disabled = true;
            commentName.style.background = '#f0f0f0';
        }
    } else {
        if (primeStatus) primeStatus.style.display = 'none';
        if (commentName) {
            commentName.value = '';
            commentName.disabled = false;
            commentName.style.background = 'white';
        }
    }
}

const primeBtn = safeElement('primeBtn');
if (primeBtn) {
    primeBtn.addEventListener('click', async function() {
        const username = safeElement('primeUsername')?.value.trim();
        const password = safeElement('primePassword')?.value.trim();
        
        if (!username || !password) {
            showMessage('Введите ник и пароль', 'error');
            return;
        }
        
        const { data, error } = await supabaseClient
            .from('verified_users')
            .select('*')
            .eq('username', username)
            .eq('password', password)
            .single();
        
        if (error || !data) {
            showMessage('Неверный ник или пароль', 'error');
            return;
        }
        
        primeUser = { username, id: data.id };
        localStorage.setItem('primeUser', JSON.stringify(primeUser));
        updatePrimeUI();
        showMessage('Добро пожаловать в PRIME!', 'success');
    });
}

window.logoutPrime = function() {
    primeUser = null;
    localStorage.removeItem('primeUser');
    updatePrimeUI();
    showMessage('Вы вышли из PRIME', 'info');
};

// ============================================
// ЗАГРУЗКА КАНДИДАТОВ
// ============================================
async function loadCandidates() {
    const { data } = await supabaseClient
        .from('candidates')
        .select('*')
        .order('votes', { ascending: false });
    
    allCandidates = data || [];
    if (allCandidates.length < 2) return;
    
    const battleContainer = safeElement('battleContainer');
    if (battleContainer) battleContainer.style.display = 'block';
    
    selectNewPair();
}

function selectNewPair() {
    const available = allCandidates.filter(c => !userVotes[c.id]);
    
    if (available.length >= 2) {
        let first, second;
        do {
            const shuffled = [...available].sort(() => 0.5 - Math.random());
            first = shuffled[0];
            second = shuffled[1];
        } while (first.id === second.id);
        currentPair = [first, second];
    } else {
        const shuffled = [...allCandidates].sort(() => 0.5 - Math.random());
        currentPair = [shuffled[0], shuffled[1]];
    }
    
    renderBattle();
}

function renderBattle() {
    const grid = safeElement('battleGrid');
    if (!grid || !currentPair[0]) return;
    
    grid.innerHTML = `
        <div class="candidate-card ${userVotes[currentPair[0].id] ? 'voted' : ''}" onclick="selectCandidate(${currentPair[0].id})">
            <img src="${currentPair[0].photo_url || 'https://i.pravatar.cc/300'}">
            <div class="candidate-name">${currentPair[0].name}</div>
            <div class="candidate-class">${currentPair[0].class || ''}</div>
            <span class="rating">❤️ ${currentPair[0].votes || 0}</span>
        </div>
        <div class="candidate-card ${userVotes[currentPair[1].id] ? 'voted' : ''}" onclick="selectCandidate(${currentPair[1].id})">
            <img src="${currentPair[1].photo_url || 'https://i.pravatar.cc/300'}">
            <div class="candidate-name">${currentPair[1].name}</div>
            <div class="candidate-class">${currentPair[1].class || ''}</div>
            <span class="rating">❤️ ${currentPair[1].votes || 0}</span>
        </div>
    `;
}

window.selectCandidate = function(id) {
    selectedCandidateId = id;
    document.querySelectorAll('.candidate-card').forEach(c => c.classList.remove('selected'));
    const card = document.getElementById(`card-${id}`);
    if (card) card.classList.add('selected');
};

const voteBtn = safeElement('voteBtn');
if (voteBtn) {
    voteBtn.addEventListener('click', async function() {
        if (!selectedCandidateId) {
            showMessage('Выберите кандидата', 'error');
            return;
        }
        
        const winner = currentPair.find(c => c.id === selectedCandidateId);
        const loser = currentPair.find(c => c.id !== selectedCandidateId);
        
        if (!winner || !loser) return;
        
        if (userVotes[winner.id]) {
            showMessage('Вы уже голосовали', 'error');
            return;
        }
        
        await Promise.all([
            supabaseClient.from('candidates').update({ votes: (winner.votes||0) + 100 }).eq('id', winner.id),
            supabaseClient.from('candidates').update({ votes: Math.max(0, (loser.votes||0) - 50) }).eq('id', loser.id),
            supabaseClient.from('votes').insert({ candidate_id: winner.id, ip_address: userIp })
        ]);
        
        userVotes[winner.id] = true;
        showMessage(`+100 ${winner.name}!`, 'success');
        loadCandidates();
    });
}

// ============================================
// ЗАГРУЗКА ГОЛОСОВ ПОЛЬЗОВАТЕЛЯ
// ============================================
async function loadUserVotes() {
    if (!userIp) return;
    
    const { data } = await supabaseClient
        .from('votes')
        .select('candidate_id')
        .eq('ip_address', userIp);
    
    if (data) {
        userVotes = {};
        data.forEach(v => userVotes[v.candidate_id] = true);
        const badge = safeElement('voteCountBadge');
        if (badge) badge.textContent = data.length;
    }
}

// ============================================
// ЗАГРУЗКА КОММЕНТАРИЕВ
// ============================================
async function loadComments() {
    const { data } = await supabaseClient
        .from('comments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
    
    comments = data || [];
    displayComments();
}

function displayComments() {
    const list = safeElement('commentsList');
    if (!list) return;
    
    if (comments.length === 0) {
        list.innerHTML = '<div class="chat-loading">Нет сообщений</div>';
        return;
    }
    
    let html = '';
    comments.forEach(c => {
        const date = new Date(c.created_at).toLocaleString('ru', {
            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
        });
        
        const premiumClass = c.is_verified ? 'premium' : '';
        
        html += `
            <div class="chat-message ${premiumClass}">
                <div class="chat-header-line">
                    <span class="chat-name">${c.name || 'Аноним'}</span>
                    <span class="chat-date">${date}</span>
                </div>
                <div class="chat-text">${c.message}</div>
            </div>
        `;
    });
    list.innerHTML = html;
}

// ============================================
// ОТПРАВКА КОММЕНТАРИЯ
// ============================================
const submitComment = safeElement('submitComment');
if (submitComment) {
    submitComment.addEventListener('click', async function() {
        const nameInput = safeElement('commentName');
        const messageInput = safeElement('commentMessage');
        
        let name = nameInput?.value.trim() || '';
        let message = messageInput?.value.trim();
        
        if (!message) {
            showMessage('Напишите сообщение', 'error');
            return;
        }
        
        if (lastCommentTime && Date.now() - lastCommentTime < 5000) {
            showMessage('Слишком часто! Подождите 5 сек', 'error');
            return;
        }
        
        if (!name) {
            name = 'Аноним';
        }
        
        const commentData = {
            name: name,
            message: message,
            ip_address: userIp,
            is_verified: !!primeUser,
            verified_as: primeUser?.username || null
        };
        
        await supabaseClient.from('comments').insert(commentData);
        
        lastCommentTime = Date.now();
        if (messageInput) messageInput.value = '';
        
        showMessage('Сообщение отправлено', 'success');
        loadComments();
    });
}

// ============================================
// ОБРАТНАЯ СВЯЗЬ
// ============================================
window.openFeedbackModal = function() {
    const modal = safeElement('feedbackModal');
    if (modal) modal.style.display = 'flex';
};

window.closeFeedbackModal = function() {
    const modal = safeElement('feedbackModal');
    if (modal) modal.style.display = 'none';
};

const submitFeedback = safeElement('submitFeedback');
if (submitFeedback) {
    submitFeedback.addEventListener('click', async function() {
        const name = safeElement('feedbackName')?.value.trim() || 'Аноним';
        const type = safeElement('feedbackType')?.value;
        const message = safeElement('feedbackMessage')?.value.trim();
        
        if (!message) {
            showMessage('Напишите сообщение', 'error');
            return;
        }
        
        await supabaseClient.from('feedback').insert({
            type: type,
            name: name,
            message: message,
            ip_address: userIp,
            user_agent: navigator.userAgent
        });
        
        showMessage('Спасибо! Сообщение отправлено', 'success');
        closeFeedbackModal();
        
        const msgInput = safeElement('feedbackMessage');
        if (msgInput) msgInput.value = '';
    });
}

// ============================================
// АВТО-ОБНОВЛЕНИЕ
// ============================================
function startAutoRefresh() {
    setInterval(async () => {
        if (autoRefreshEnabled && localStorage.getItem('agreement62') === 'accepted') {
            await loadComments();
            await loadUserVotes();
            await loadCandidates();
        }
    }, 3000);
}

const autoRefreshToggle = safeElement('autoRefreshToggle');
if (autoRefreshToggle) {
    autoRefreshToggle.addEventListener('change', function(e) {
        autoRefreshEnabled = e.target.checked;
    });
}

// ============================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================
async function initApp() {
    userIp = await getUserIp();
    updatePrimeUI();
    await loadUserVotes();
    await loadCandidates();
    await loadComments();
    startAutoRefresh();
}
