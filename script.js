// ============================================
// SUPABASE КОНФИГ
// ============================================
const SUPABASE_URL = 'https://wdcwxvxkvyncybsefotj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_VMEPI3FAZoKDgX4ae_pqcg_Euvs40hM';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ============================================
// СОСТОЯНИЕ
// ============================================
let userIp = null;
let browserId = localStorage.getItem('browserId');
if (!browserId) {
    browserId = 'user_' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('browserId', browserId);
}

// Запрещённые слова
const bannedWords = [
    'порно', 'секс', 'еблан', 'дебил', 'дурак', 'идиот',
    'хуй', 'пизда', 'блядь', 'сука', 'гандон', 'шлюха',
    'porn', 'sex', 'fuck', 'shit', 'bitch',
    'сайт', 'заработок', 'деньги', 'крипта', 'биткоин',
    'казино', 'закладки', 'casino', 'bet'
];

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================
async function getUserIp() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
    } catch {
        return browserId;
    }
}

function checkBannedWords(text) {
    if (!text) return false;
    const lowerText = text.toLowerCase();
    return bannedWords.some(word => lowerText.includes(word));
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showMessage(text, type) {
    const container = document.getElementById('messageContainer');
    if (!container) return;
    
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
    userIp = await getUserIp();
    document.getElementById('userId').textContent = browserId.substring(0, 8);
    
    // Загружаем треды на главной
    if (document.getElementById('threadsList')) {
        loadThreads();
        
        // Обработчик создания треда
        document.getElementById('createThreadBtn')?.addEventListener('click', createThread);
    }
}

// Загрузка тредов
async function loadThreads() {
    const sortBy = document.getElementById('sortFilter')?.value || 'bump';
    const search = document.getElementById('searchFilter')?.value || '';
    
    try {
        let query = supabaseClient
            .from('threads')
            .select('*');
        
        if (sortBy === 'bump') query = query.order('bump_time', { ascending: false });
        if (sortBy === 'new') query = query.order('created_at', { ascending: false });
        if (sortBy === 'hot') query = query.order('reply_count', { ascending: false });
        
        const { data, error } = await query;
        if (error) throw error;
        
        let filtered = data || [];
        if (search) {
            filtered = filtered.filter(t => 
                t.title.toLowerCase().includes(search.toLowerCase()) ||
                t.content.toLowerCase().includes(search.toLowerCase())
            );
        }
        
        displayThreads(filtered);
    } catch (error) {
        console.error('Ошибка загрузки тредов:', error);
        document.getElementById('threadsList').innerHTML = '<div class="loading">Ошибка загрузки</div>';
    }
}

// Отображение тредов
function displayThreads(threads) {
    const container = document.getElementById('threadsList');
    
    if (!threads || threads.length === 0) {
        container.innerHTML = '<div class="loading">Пока нет тем</div>';
        return;
    }
    
    let html = '';
    threads.forEach(thread => {
        const date = new Date(thread.created_at).toLocaleString('ru', {
            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
        });
        
        const pinnedClass = thread.is_pinned ? 'pinned' : '';
        const hotClass = thread.is_hot ? 'hot' : '';
        const badges = [];
        if (thread.is_pinned) badges.push('<span class="thread-badge pinned">📌 Закреплено</span>');
        if (thread.is_hot) badges.push('<span class="thread-badge hot">🔥 Горячее</span>');
        
        html += `
            <div class="thread-card ${pinnedClass} ${hotClass}" onclick="openThread(${thread.id})">
                <div class="thread-header">
                    <div class="thread-title">${escapeHtml(thread.title)}</div>
                    <div class="thread-badges">${badges.join('')}</div>
                </div>
                <div class="thread-content">${escapeHtml(thread.content)}</div>
                <div class="thread-footer">
                    <div class="thread-stats">
                        <span class="thread-stat">💬 ${thread.reply_count || 0}</span>
                        <span class="thread-stat">👤 ${escapeHtml(thread.author_name)}</span>
                        <span class="thread-stat">🕒 ${date}</span>
                    </div>
                    <div class="thread-report" onclick="reportThread(${thread.id}, event)">⚠️ Пожаловаться</div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Создание треда
async function createThread() {
    const title = document.getElementById('threadTitle')?.value.trim();
    const content = document.getElementById('threadContent')?.value.trim();
    
    if (!title || !content) {
        showMessage('Заполните заголовок и текст', 'error');
        return;
    }
    
    if (title.length > 100 || content.length > 500) {
        showMessage('Слишком длинное сообщение', 'error');
        return;
    }
    
    if (checkBannedWords(title) || checkBannedWords(content)) {
        showMessage('Сообщение содержит запрещённые слова', 'error');
        return;
    }
    
    try {
        const { error } = await supabaseClient
            .from('threads')
            .insert({
                title: title,
                content: content,
                author_ip: userIp,
                author_name: 'Аноним',
                reply_count: 0
            });
        
        if (error) throw error;
        
        showMessage('Тема создана!', 'success');
        document.getElementById('threadTitle').value = '';
        document.getElementById('threadContent').value = '';
        loadThreads();
    } catch (error) {
        showMessage('Ошибка: ' + error.message, 'error');
    }
}

// Открыть тред
window.openThread = function(threadId) {
    window.location.href = `thread.html?id=${threadId}`;
}

// Пожаловаться на тред
window.reportThread = async function(threadId, event) {
    event.stopPropagation();
    
    const reason = prompt('Укажите причину жалобы (необязательно):');
    
    try {
        await supabaseClient
            .from('reports')
            .insert({
                target_type: 'thread',
                target_id: threadId,
                reason: reason || 'Без причины',
                reporter_ip: userIp
            });
        
        showMessage('Жалоба отправлена', 'success');
    } catch (error) {
        showMessage('Ошибка', 'error');
    }
}

// Фильтры
document.getElementById('sortFilter')?.addEventListener('change', loadThreads);
document.getElementById('searchFilter')?.addEventListener('input', debounce(loadThreads, 500));

function debounce(func, wait) {
    let timeout;
    return function() {
        clearTimeout(timeout);
        timeout = setTimeout(func, wait);
    };
}

// Запуск
initApp();
