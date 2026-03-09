const SUPABASE_URL = 'https://wdcwxvxkvyncybsefotj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_VMEPI3FAZoKDgX4ae_pqcg_Euvs40hM';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ============================================
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// ============================================
let userIp = null;
let primeUser = JSON.parse(localStorage.getItem('primeUser') || 'null');
let userVotes = {};
let lastCommentTime = null;
let lastUpdateVoteTime = null;

// ============================================
// PRIME СИСТЕМА
// ============================================
function updatePrimeUI() {
    const primeIcon = document.getElementById('primeIcon');
    const primeName = document.getElementById('primeName');
    const primeStatus = document.getElementById('primeStatus');
    
    if (primeUser) {
        primeIcon.style.display = 'inline';
        primeName.textContent = primeUser.username;
        primeStatus.style.display = 'flex';
        
        // Автозаполнение имени в комментариях
        const commentName = document.getElementById('commentName');
        if (commentName) {
            commentName.value = primeUser.username;
            commentName.disabled = true;
        }
    } else {
        primeIcon.style.display = 'none';
        primeName.textContent = '';
        primeStatus.style.display = 'none';
        
        const commentName = document.getElementById('commentName');
        if (commentName) {
            commentName.value = '';
            commentName.disabled = false;
        }
    }
}

document.getElementById('primeBtn')?.addEventListener('click', async function() {
    const username = document.getElementById('primeUsername').value.trim();
    const password = document.getElementById('primePassword').value.trim();
    
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

window.logoutPrime = function() {
    primeUser = null;
    localStorage.removeItem('primeUser');
    updatePrimeUI();
    showMessage('Вы вышли из PRIME', 'info');
};

// ============================================
// БИТВА
// ============================================
let allCandidates = [];
let currentPair = [];
let selectedCandidateId = null;

async function loadCandidates() {
    const { data } = await supabaseClient
        .from('candidates')
        .select('*')
        .order('votes', { ascending: false });
    
    allCandidates = data || [];
    if (allCandidates.length < 2) return;
    
    document.getElementById('battleContainer').style.display = 'block';
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
    const grid = document.getElementById('battleGrid');
    if (!grid || !currentPair[0]) return;
    
    grid.innerHTML = `
        <div class="candidate-card" onclick="selectCandidate(${currentPair[0].id})">
            <img src="${currentPair[0].photo_url || 'https://i.pravatar.cc/300'}">
            <h3>${currentPair[0].name}</h3>
            <p>${currentPair[0].class || ''}</p>
            <span class="rating">❤️ ${currentPair[0].votes || 0}</span>
        </div>
        <div class="candidate-card" onclick="selectCandidate(${currentPair[1].id})">
            <img src="${currentPair[1].photo_url || 'https://i.pravatar.cc/300'}">
            <h3>${currentPair[1].name}</h3>
            <p>${currentPair[1].class || ''}</p>
            <span class="rating">❤️ ${currentPair[1].votes || 0}</span>
        </div>
    `;
}

window.selectCandidate = function(id) {
    selectedCandidateId = id;
    document.querySelectorAll('.candidate-card').forEach(c => c.classList.remove('selected'));
    document.getElementById(`card-${id}`)?.classList.add('selected');
};

document.getElementById('voteBtn')?.addEventListener('click', async function() {
    if (!selectedCandidateId) {
        showMessage('Выберите кандидата', 'error');
        return;
    }
    
    const winner = currentPair.find(c => c.id === selectedCandidateId);
    const loser = currentPair.find(c => c.id !== selectedCandidateId);
    
    if (userVotes[winner.id]) {
        showMessage('Вы уже голосовали', 'error');
        return;
    }
    
    await Promise.all([
        supabaseClient.from('candidates').update({ votes: (winner.votes||0)+100 }).eq('id', winner.id),
        supabaseClient.from('candidates').update({ votes: Math.max(0, (loser.votes||0)-50) }).eq('id', loser.id),
        supabaseClient.from('votes').insert({ candidate_id: winner.id, ip_address: userIp })
    ]);
    
    userVotes[winner.id] = true;
    showMessage(`+100 ${winner.name}!`, 'success');
    loadCandidates();
});

// ============================================
// КОММЕНТАРИИ
// ============================================
async function loadComments() {
    const { data } = await supabaseClient
        .from('comments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
    
    displayComments(data || []);
}

function displayComments(comments) {
    const list = document.getElementById('commentsList');
    if (!list) return;
    
    if (comments.length === 0) {
        list.innerHTML = '<div class="loading">Нет комментариев</div>';
        return;
    }
    
    let html = '';
    comments.forEach(c => {
        const date = new Date(c.created_at).toLocaleString('ru', {
            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
        });
        
        const primeBadge = c.is_verified ? 
            '<span class="prime-badge"><img src="verified.png" width="12" height="12"> PRIME</span>' : '';
        
        html += `
            <div class="comment-item">
                <div class="comment-header">
                    <span>${c.name} ${primeBadge}</span>
                    <span class="comment-date">${date}</span>
                </div>
                <div class="comment-message">${c.message}</div>
            </div>
        `;
    });
    list.innerHTML = html;
}

document.getElementById('submitComment')?.addEventListener('click', async function() {
    const message = document.getElementById('commentMessage').value.trim();
    
    if (!message) {
        showMessage('Напишите комментарий', 'error');
        return;
    }
    
    if (lastCommentTime && Date.now() - lastCommentTime < 5000) {
        showMessage('Слишком часто! Подождите 5 сек', 'error');
        return;
    }
    
    const commentData = {
        name: primeUser?.username || 'Аноним',
        message: message,
        ip_address: userIp,
        is_verified: !!primeUser
    };
    
    await supabaseClient.from('comments').insert(commentData);
    lastCommentTime = Date.now();
    document.getElementById('commentMessage').value = '';
    showMessage('Комментарий добавлен', 'success');
    loadComments();
});

// ============================================
// ОБНОВЛЕНИЯ
// ============================================
let updates = [];

async function loadUpdates() {
    const { data } = await supabaseClient
        .from('update_suggestions')
        .select('*')
        .eq('status', 'approved')
        .order('votes', { ascending: false });
    
    updates = data || [];
    displayUpdates();
}

function displayUpdates() {
    const list = document.getElementById('updatesList');
    if (!list) return;
    
    if (updates.length === 0) {
        list.innerHTML = '<div class="loading">Нет голосований</div>';
        return;
    }
    
    let html = '';
    updates.forEach(u => {
        html += `
            <div class="update-item" id="update-${u.id}">
                <div>
                    <h4>${u.title}</h4>
                    <p>${u.description || ''}</p>
                </div>
                <div>
                    <span class="update-vote-count">❤️ ${u.votes || 0}</span>
                    <button class="update-vote-btn" onclick="voteUpdate(${u.id})">Голосовать</button>
                </div>
            </div>
        `;
    });
    list.innerHTML = html;
}

window.voteUpdate = async function(id) {
    if (!userIp) return;
    
    const fourHoursAgo = new Date(Date.now() - 4*60*60*1000).toISOString();
    const { data: recent } = await supabaseClient
        .from('update_votes')
        .select('*')
        .eq('ip_address', userIp)
        .gt('voted_at', fourHoursAgo);
    
    if (recent && recent.length > 0) {
        showMessage('Голосовать можно раз в 4 часа', 'error');
        return;
    }
    
    const update = updates.find(u => u.id === id);
    await supabaseClient
        .from('update_suggestions')
        .update({ votes: (update.votes||0) + 1 })
        .eq('id', id);
    
    await supabaseClient
        .from('update_votes')
        .insert({ suggestion_id: id, ip_address: userIp });
    
    showMessage('Голос учтён!', 'success');
    loadUpdates();
};

document.getElementById('suggestBtn')?.addEventListener('click', async function() {
    const title = document.getElementById('suggestTitle').value.trim();
    const desc = document.getElementById('suggestDesc').value.trim();
    
    if (!title) {
        showMessage('Введите название', 'error');
        return;
    }
    
    await supabaseClient
        .from('update_suggestions')
        .insert({
            title: title,
            description: desc,
            status: 'pending'
        });
    
    showMessage('Предложение отправлено!', 'success');
    document.getElementById('suggestTitle').value = '';
    document.getElementById('suggestDesc').value = '';
});

// ============================================
// ЗАПУСК
// ============================================
async function init() {
    userIp = await getUserIp();
    updatePrimeUI();
    
    if (document.getElementById('battleGrid')) loadCandidates();
    if (document.getElementById('commentsList')) loadComments();
    if (document.getElementById('updatesList')) loadUpdates();
}

init();
