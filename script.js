// ============================================
// SUPABASE КОНФИГ
// ============================================
const SUPABASE_URL = 'https://wdcwxvxkvyncybsefotj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_VMEPI3FAZoKDgX4ae_pqcg_Euvs40hM';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ============================================
// СОГЛАШЕНИЕ
// ============================================
const agreementScreen = document.getElementById('agreementScreen');
const mainContent = document.getElementById('mainContent');
const schoolCheckbox = document.getElementById('schoolCheckbox');
const enterBtn = document.getElementById('enterSiteBtn');

// Функция для входа на сайт
function enterSite() {
    console.log('Вход на сайт');
    localStorage.setItem('agreement62', 'accepted');
    
    const agreementScreen = document.getElementById('agreementScreen');
    const mainContent = document.getElementById('mainContent');
    
    if (agreementScreen) {
        agreementScreen.style.cssText = 'display: none !important; visibility: hidden !important; opacity: 0 !important;';
    }
    
    if (mainContent) {
        mainContent.style.cssText = 'display: block !important; visibility: visible !important; opacity: 1 !important;';
    }
    
    agreementScreen.classList.remove('active', 'show');
    
    initApp();
}

// Проверка при загрузке
if (localStorage.getItem('agreement62') === 'accepted') {
    console.log('Уже был вход, показываем контент');
    agreementScreen.style.display = 'none';
    mainContent.style.display = 'block';
    initApp();
}

// Обработчик чекбокса
if (schoolCheckbox) {
    schoolCheckbox.addEventListener('change', function() {
        enterBtn.disabled = !this.checked;
        console.log('Чекбокс изменен, кнопка:', enterBtn.disabled ? 'заблокирована' : 'активна');
    });
}

// Обработчик кнопки
if (enterBtn) {
    enterBtn.addEventListener('click', function(e) {
        e.preventDefault();
        console.log('Кнопка нажата');
        if (schoolCheckbox && schoolCheckbox.checked) {
            enterSite();
        }
    });
}

// ============================================
// СОСТОЯНИЕ
// ============================================
let allCandidates = [];
let currentPair = [];
let selectedCandidateId = null;
let userIp = null;
let userVotes = {};
let userVoteCount = 0;
let comboCount = 0;
let lastVoteTime = null;
let lastCommentTime = null;
let comments = [];

// Переменные для верификации
let verifiedUser = null;
let verifiedUserName = null;
let verifiedUserData = null;

// Имена для случайных комментаторов
const randomNames = ['Аноним'];

// ============================================
// ЗАПРЕЩЁННЫЕ СЛОВА
// ============================================
const bannedWords = [
    'порно', 'секс', 'еблан', 'дебил', 'дурак', 'идиот',
    'хуй', 'пизда', 'блядь', 'сука', 'гандон', 'шлюха', 'проститутка',
    'porn', 'sex', 'fuck', 'shit', 'bitch',
    'сайт', 'заработок', 'деньги', 'крипта', 'биткоин',
    'казино', 'закладки', 'casino', 'bet',
    'меф', 'куплю', 'продаю', 'наркотики'
];

function checkBannedWords(text) {
    if (!text) return false;
    const lowerText = text.toLowerCase();
    return bannedWords.some(word => lowerText.includes(word));
}

// ============================================
// ОТПРАВКА ПОДОЗРЕНИЙ В АДМИНКУ
// ============================================
async function reportSuspiciousActivity(type, details) {
    try {
        await supabaseClient
            .from('suspicious_activity')
            .insert({
                type: type,
                details: details,
                ip_address: userIp,
                user_agent: navigator.userAgent,
                timestamp: new Date()
            });
    } catch (error) {
        console.error('Ошибка отправки в админку:', error);
    }
}

// ============================================
// ПОЛУЧЕНИЕ IP
// ============================================
async function getUserIp() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        userIp = data.ip;
        return userIp;
    } catch {
        userIp = 'user-' + Math.random().toString(36).substring(2, 10);
        return userIp;
    }
}

// ============================================
// СИСТЕМА ВЕРИФИКАЦИИ
// ============================================
document.getElementById('verifyBtn').addEventListener('click', verifyUser);
document.getElementById('verifyPassword').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') verifyUser();
});

async function verifyUser() {
    const username = document.getElementById('verifyUsername').value.trim();
    const password = document.getElementById('verifyPassword').value.trim();
    
    if (!username || !password) {
        showMessage('Введите ник и пароль', 'error');
        return;
    }
    
    try {
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
        
        verifiedUser = username;
        verifiedUserName = username;
        verifiedUserData = data;
        
        const commentNameInput = document.getElementById('commentName');
        if (commentNameInput) {
            commentNameInput.value = username;
            commentNameInput.disabled = true;
            commentNameInput.style.background = '#f0f0f0';
            commentNameInput.style.color = '#2c3e50';
            commentNameInput.style.fontWeight = '600';
        }
        
        const statusDiv = document.getElementById('verifyStatus');
        const statusText = document.getElementById('verifyStatusText');
        statusText.innerHTML = `Вы вошли как <strong>${username}</strong> <img src="verified.png" width="14" height="14" style="display: inline; margin-left: 5px;">`;
        statusDiv.classList.add('active');
        
        document.getElementById('verifyUsername').value = '';
        document.getElementById('verifyPassword').value = '';
        
        showMessage('Верификация успешна!', 'success');
        await loadComments();
        
    } catch (error) {
        showMessage('Ошибка: ' + error.message, 'error');
    }
}

window.logoutVerification = function() {
    verifiedUser = null;
    verifiedUserName = null;
    verifiedUserData = null;
    
    const commentNameInput = document.getElementById('commentName');
    if (commentNameInput) {
        commentNameInput.value = '';
        commentNameInput.disabled = false;
        commentNameInput.style.background = 'white';
        commentNameInput.style.color = '#2c3e50';
        commentNameInput.style.fontWeight = 'normal';
    }
    
    document.getElementById('verifyStatus').classList.remove('active');
    showMessage('Вы вышли из системы', 'info');
    loadComments();
};

// ============================================
// ЗАГРУЗКА КОММЕНТАРИЕВ
// ============================================
async function loadComments() {
    try {
        const { data, error } = await supabaseClient
            .from('comments')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) throw error;
        comments = data || [];
        displayComments();
    } catch (error) {
        console.error('Ошибка загрузки комментариев:', error);
    }
}

function displayComments() {
    const list = document.getElementById('commentsList');
    
    if (!comments || comments.length === 0) {
        list.innerHTML = '<div style="text-align:center; padding:20px; color:#7f8c8d;">Пока нет комментариев. Будьте первым!</div>';
        return;
    }

    let html = '';
    comments.forEach(comment => {
        const date = new Date(comment.created_at).toLocaleString('ru', {
            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
        });
        
        const commentClass = comment.is_verified ? 'comment-item verified-comment' : 'comment-item';
        const verifiedBadge = comment.is_verified ? 
            '<span class="verified-badge"><img src="verified.png" width="12" height="12">in PRIME</span>' : '';
        
        html += `
            <div class="${commentClass}">
                <div class="comment-header">
                    <span class="comment-name">
                        ${escapeHtml(comment.name || 'Аноним')}
                        ${verifiedBadge}
                    </span>
                    <span class="comment-date">${date}</span>
                </div>
                <div class="comment-message">${escapeHtml(comment.message)}</div>
            </div>
        `;
    });
    list.innerHTML = html;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// ОТПРАВКА КОММЕНТАРИЯ
// ============================================
document.getElementById('submitComment').addEventListener('click', submitComment);

async function submitComment() {
    const nameInput = document.getElementById('commentName');
    const messageInput = document.getElementById('commentMessage');
    
    let name = nameInput.value.trim();
    let message = messageInput.value.trim();

    if (lastCommentTime && (Date.now() - lastCommentTime) < 5 * 1000) {
        showMessage('Слишком часто! Подождите 5 секунд', 'error');
        await reportSuspiciousActivity('spam_comment', { message, ip: userIp });
        return;
    }

    if (checkBannedWords(message)) {
        showMessage('Сообщение содержит запрещённые слова', 'error');
        await reportSuspiciousActivity('banned_words_message', { message, ip: userIp });
        return;
    }

    if (checkBannedWords(name)) {
        showMessage('Имя содержит запрещённые слова', 'error');
        await reportSuspiciousActivity('banned_words_name', { name, ip: userIp });
        return;
    }

    if (!name) {
        name = randomNames[Math.floor(Math.random() * randomNames.length)];
    }

    if (!message) {
        showMessage('Напишите комментарий', 'error');
        return;
    }

    if (message.length > 200) {
        showMessage('Максимум 200 символов', 'error');
        return;
    }

    if (message.includes('✅') || message.includes('✔️') || message.includes('✓') || message.includes('👑')) {
        if (!verifiedUser) {
            showMessage('Нельзя использовать символы галочки без PREMIUM', 'error');
            return;
        }
    }

    try {
        const commentData = {
            name: name,
            message: message,
            ip_address: userIp,
            is_verified: !!verifiedUser,
            verified_as: verifiedUser
        };

        const { error } = await supabaseClient
            .from('comments')
            .insert(commentData);

        if (error) throw error;

        await supabaseClient
            .from('feedback')
            .insert({
                type: 'comment',
                name: name,
                message: message,
                ip_address: userIp,
                user_agent: navigator.userAgent,
                is_verified: !!verifiedUser
            });

        lastCommentTime = Date.now();
        nameInput.value = '';
        messageInput.value = '';
        
        showMessage('Комментарий добавлен!', 'success');
        await loadComments();
        
    } catch (error) {
        showMessage('Ошибка: ' + error.message, 'error');
    }
}

// ============================================
// ЗАГРУЗКА КАНДИДАТОВ
// ============================================
async function loadCandidates() {
    try {
        const { data, error } = await supabaseClient
            .from('candidates')
            .select('*')
            .order('votes', { ascending: false });

        if (error) throw error;

        allCandidates = (data || []).map(c => ({
            ...c,
            rarity: getRandomRarity()
        }));

        if (allCandidates.length < 2) {
            showMessage('Нужно минимум 2 кандидата', 'error');
            return;
        }

        document.getElementById('battleContainer').style.display = 'block';
        document.getElementById('ratingContainer').style.display = 'block';
        
        updateLeaderboard();
        selectNewPair();
    } catch (err) {
        showMessage('Ошибка загрузки: ' + err.message, 'error');
    }
}

function getRandomRarity() {
    const rand = Math.random();
    if (rand < 0.5) return 'common';
    if (rand < 0.75) return 'rare';
    if (rand < 0.9) return 'epic';
    return 'legendary';
}

const rarityNames = { common: 'Обычная', rare: 'Редкая', epic: 'Эпическая', legendary: 'Легендарная' };

// ============================================
// ЗАГРУЗКА ГОЛОСОВ
// ============================================
async function loadUserVotes() {
    if (!userIp) return;
    
    try {
        const { data } = await supabaseClient
            .from('votes')
            .select('candidate_id')
            .eq('ip_address', userIp);

        if (data) {
            userVotes = {};
            data.forEach(vote => {
                userVotes[vote.candidate_id] = true;
            });
            userVoteCount = data.length;
            document.getElementById('voteCountBadge').textContent = userVoteCount;
        }
    } catch (error) {
        console.error('Ошибка загрузки голосов:', error);
    }
}

// ============================================
// ВЫБОР ПАРЫ
// ============================================
function selectNewPair() {
    if (allCandidates.length < 2) return;
    
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
    
    renderBattle(currentPair);
    updatePrediction();
}

function renderBattle(pair) {
    const container = document.getElementById('battleGrid');
    
    container.innerHTML = `
        <div class="candidate-card ${userVotes[pair[0].id] ? 'voted' : ''}" 
             onclick="${!userVotes[pair[0].id] ? 'selectCandidate(' + pair[0].id + ')' : ''}" 
             id="card-${pair[0].id}">
            <span class="rarity-badge rarity-${pair[0].rarity}">${rarityNames[pair[0].rarity]}</span>
            <img src="${pair[0].photo_url || 'https://i.pravatar.cc/300'}" class="candidate-photo">
            <div class="candidate-info">
                <div class="candidate-name">${pair[0].name}</div>
                <div class="candidate-class">${pair[0].class || ''}</div>
                <span class="rating">❤️ ${pair[0].votes || 0}</span>
            </div>
        </div>
        
        <div class="candidate-card ${userVotes[pair[1].id] ? 'voted' : ''}" 
             onclick="${!userVotes[pair[1].id] ? 'selectCandidate(' + pair[1].id + ')' : ''}" 
             id="card-${pair[1].id}">
            <span class="rarity-badge rarity-${pair[1].rarity}">${rarityNames[pair[1].rarity]}</span>
            <img src="${pair[1].photo_url || 'https://i.pravatar.cc/300'}" class="candidate-photo">
            <div class="candidate-info">
                <div class="candidate-name">${pair[1].name}</div>
                <div class="candidate-class">${pair[1].class || ''}</div>
                <span class="rating">❤️ ${pair[1].votes || 0}</span>
            </div>
        </div>
    `;
    
    document.querySelectorAll('.candidate-card').forEach(c => c.classList.remove('selected'));
    selectedCandidateId = null;
}

window.selectCandidate = function(id) {
    document.querySelectorAll('.candidate-card').forEach(c => c.classList.remove('selected'));
    document.getElementById(`card-${id}`).classList.add('selected');
    selectedCandidateId = id;
};

function updatePrediction() {
    if (!currentPair || currentPair.length < 2) return;
    
    const total = (currentPair[0].votes || 0) + (currentPair[1].votes || 0);
    const left = total ? Math.round((currentPair[0].votes / total) * 100) : 50;
    const right = 100 - left;
    
    document.getElementById('predictionBars').innerHTML = `
        <div class="prediction-bar">
            <div class="prediction-fill" style="width: ${left}%;">${left}%</div>
        </div>
        <div class="prediction-bar">
            <div class="prediction-fill" style="width: ${right}%;">${right}%</div>
        </div>
    `;
}

// ============================================
// ГОЛОСОВАНИЕ
// ============================================
document.getElementById('voteBtn').addEventListener('click', async function() {
    if (!selectedCandidateId) {
        showMessage('Выберите девушку', 'error');
        return;
    }
    
    if (!currentPair || currentPair.length !== 2) return;
    
    const winner = currentPair.find(c => c.id === selectedCandidateId);
    const loser = currentPair.find(c => c.id !== selectedCandidateId);
    
    if (!winner || !loser) return;
    
    if (userVotes[winner.id]) {
        showMessage('Вы уже голосовали за этого кандидата', 'error');
        return;
    }

    try {
        const newWinnerVotes = (winner.votes || 0) + 100;
        const newLoserVotes = Math.max(0, (loser.votes || 0) - 50);

        await Promise.all([
            supabaseClient.from('candidates').update({ votes: newWinnerVotes }).eq('id', winner.id),
            supabaseClient.from('candidates').update({ votes: newLoserVotes }).eq('id', loser.id),
            supabaseClient.from('votes').insert({
                candidate_id: winner.id,
                ip_address: userIp,
                user_agent: navigator.userAgent
            })
        ]);

        winner.votes = newWinnerVotes;
        loser.votes = newLoserVotes;
        userVotes[winner.id] = true;
        userVoteCount++;
        
        document.getElementById('voteCountBadge').textContent = userVoteCount;
        
        if (userVoteCount >= 1) document.getElementById('ach1').classList.add('unlocked');
        
        updateLeaderboard();
        showMessage(`✅ +100 ${winner.name}!`, 'success');
        showRecommendations(winner.id);
        
        selectedCandidateId = null;
        selectNewPair();
        
    } catch (err) {
        showMessage('Ошибка: ' + err.message, 'error');
    }
});

// ============================================
// РЕКОМЕНДАЦИИ
// ============================================
function showRecommendations(excludeId) {
    const candidates = allCandidates.filter(c => 
        c.id !== excludeId && !userVotes[c.id]
    ).sort(() => 0.5 - Math.random()).slice(0, 3);
    
    const container = document.getElementById('recommendationsGrid');
    
    if (candidates.length === 0) {
        document.getElementById('recommendations').style.display = 'none';
        return;
    }
    
    let html = '';
    candidates.forEach(c => {
        html += `
            <div class="recommendation-card" onclick="selectAndScroll(${c.id})">
                <img src="${c.photo_url || 'https://i.pravatar.cc/300'}" class="recommendation-photo">
                <div class="recommendation-info">
                    <div class="recommendation-name">${c.name}</div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
    document.getElementById('recommendations').style.display = 'block';
}

window.selectAndScroll = function(id) {
    document.getElementById('recommendations').style.display = 'none';
    
    if (currentPair[0]?.id === id || currentPair[1]?.id === id) {
        selectCandidate(id);
        document.getElementById('battleContainer').scrollIntoView({ behavior: 'smooth' });
        return;
    }
    
    const candidate = allCandidates.find(c => c.id === id);
    if (!candidate) return;
    
    const other = currentPair[0]?.id === id ? currentPair[1] : currentPair[0];
    currentPair = [candidate, other];
    renderBattle(currentPair);
    selectCandidate(id);
    document.getElementById('battleContainer').scrollIntoView({ behavior: 'smooth' });
};

// ============================================
// РЕЙТИНГ
// ============================================
function updateLeaderboard() {
    const sorted = [...allCandidates].sort((a, b) => (b.votes || 0) - (a.votes || 0));
    const container = document.getElementById('ratingList');
    
    let html = '';
    sorted.slice(0, 10).forEach((c, index) => {
        html += `
            <div class="rating-item">
                <div class="rating-position">${index + 1}</div>
                <img src="${c.photo_url || 'https://i.pravatar.cc/300'}" class="rating-avatar">
                <div class="rating-info">
                    <div class="rating-name">${c.name}</div>
                </div>
                <div class="rating-score">❤️ ${c.votes || 0}</div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// ============================================
// СООБЩЕНИЯ
// ============================================
function showMessage(text, type) {
    const container = document.getElementById('messageContainer');
    const msg = document.createElement('div');
    msg.className = `message ${type}`;
    msg.textContent = text;
    container.appendChild(msg);
    setTimeout(() => msg.remove(), 3000);
}

// ============================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================
async function initApp() {
    await getUserIp();
    await loadUserVotes();
    await loadCandidates();
    await loadComments();
}
