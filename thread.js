// ============================================
// СОСТОЯНИЕ ТРЕДА
// ============================================
let currentThreadId = null;
let currentThread = null;
let userReactions = {};

// Получаем ID треда из URL
function getThreadIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
}

// Загрузка треда
async function loadThread() {
    currentThreadId = getThreadIdFromUrl();
    if (!currentThreadId) {
        window.location.href = 'index.html';
        return;
    }
    
    try {
        // Загружаем основной тред
        const { data: thread, error: threadError } = await supabaseClient
            .from('threads')
            .select('*')
            .eq('id', currentThreadId)
            .single();
        
        if (threadError) throw threadError;
        currentThread = thread;
        
        // Загружаем ответы
        const { data: replies, error: repliesError } = await supabaseClient
            .from('replies')
            .select('*')
            .eq('thread_id', currentThreadId)
            .order('created_at', { ascending: true });
        
        if (repliesError) throw repliesError;
        
        // Загружаем реакции пользователя
        await loadUserReactions();
        
        displayThread(thread, replies || []);
        
        // Обновляем счётчик просмотров (опционально)
    } catch (error) {
        console.error('Ошибка загрузки треда:', error);
        document.getElementById('threadContainer').innerHTML = '<div class="loading">Ошибка загрузки</div>';
    }
}

// Загрузка реакций пользователя
async function loadUserReactions() {
    if (!userIp) return;
    
    try {
        const { data } = await supabaseClient
            .from('reactions')
            .select('*')
            .eq('ip_address', userIp);
        
        userReactions = {};
        data?.forEach(r => {
            if (!userReactions[r.target_type]) userReactions[r.target_type] = {};
            if (!userReactions[r.target_type][r.target_id]) userReactions[r.target_type][r.target_id] = {};
            userReactions[r.target_type][r.target_id][r.reaction_type] = true;
        });
    } catch (error) {
        console.error('Ошибка загрузки реакций:', error);
    }
}

// Отображение треда
function displayThread(thread, replies) {
    const container = document.getElementById('threadContainer');
    const repliesContainer = document.getElementById('repliesList');
    
    const threadDate = new Date(thread.created_at).toLocaleString('ru', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
    });
    
    // Проверяем реакции пользователя на тред
    const userLiked = userReactions?.thread?.[thread.id]?.like || false;
    const userDisliked = userReactions?.thread?.[thread.id]?.dislike || false;
    const userFired = userReactions?.thread?.[thread.id]?.fire || false;
    
    container.innerHTML = `
        <div class="main-thread">
            <div class="main-thread-header">
                <div class="main-thread-title">${escapeHtml(thread.title)}</div>
                <div class="main-thread-meta">
                    <span>👤 ${escapeHtml(thread.author_name)}</span>
                    <span>🕒 ${threadDate}</span>
                </div>
            </div>
            <div class="main-thread-content">${escapeHtml(thread.content)}</div>
            <div class="reactions">
                <button class="reaction-btn ${userLiked ? 'active' : ''}" onclick="addReaction('thread', ${thread.id}, 'like')">
                    👍 <span class="reaction-count" id="thread-like-${thread.id}">${thread.likes || 0}</span>
                </button>
                <button class="reaction-btn ${userDisliked ? 'active' : ''}" onclick="addReaction('thread', ${thread.id}, 'dislike')">
                    👎 <span class="reaction-count" id="thread-dislike-${thread.id}">${thread.dislikes || 0}</span>
                </button>
                <button class="reaction-btn ${userFired ? 'active' : ''}" onclick="addReaction('thread', ${thread.id}, 'fire')">
                    🔥 <span class="reaction-count" id="thread-fire-${thread.id}">${thread.fires || 0}</span>
                </button>
            </div>
        </div>
    `;
    
    // Отображаем ответы
    if (replies.length === 0) {
        repliesContainer.innerHTML = '<div class="loading">Пока нет ответов. Будьте первым!</div>';
    } else {
        let repliesHtml = '';
        replies.forEach(reply => {
            const replyDate = new Date(reply.created_at).toLocaleString('ru', {
                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
            });
            
            const replyUserLiked = userReactions?.reply?.[reply.id]?.like || false;
            const replyUserDisliked = userReactions?.reply?.[reply.id]?.dislike || false;
            const replyUserFired = userReactions?.reply?.[reply.id]?.fire || false;
            
            repliesHtml += `
                <div class="reply-card">
                    <div class="reply-header">
                        <span class="reply-author">${escapeHtml(reply.author_name)}</span>
                        <span class="reply-date">${replyDate}</span>
                    </div>
                    <div class="reply-content">${escapeHtml(reply.content)}</div>
                    <div class="reply-reactions">
                        <button class="reply-reaction-btn ${replyUserLiked ? 'active' : ''}" onclick="addReaction('reply', ${reply.id}, 'like')">
                            👍 ${reply.likes || 0}
                        </button>
                        <button class="reply-reaction-btn ${replyUserDisliked ? 'active' : ''}" onclick="addReaction('reply', ${reply.id}, 'dislike')">
                            👎 ${reply.dislikes || 0}
                        </button>
                        <button class="reply-reaction-btn ${replyUserFired ? 'active' : ''}" onclick="addReaction('reply', ${reply.id}, 'fire')">
                            🔥 ${reply.fires || 0}
                        </button>
                        <span class="reply-report" onclick="reportReply(${reply.id})">⚠️ Пожаловаться</span>
                    </div>
                </div>
            `;
        });
        repliesContainer.innerHTML = repliesHtml;
    }
}

// Добавление реакции
async function addReaction(type, id, reactionType) {
    if (!userIp) return;
    
    // Проверка на 4 часа (можно реализовать)
    
    try {
        // Проверяем, есть ли уже такая реакция
        const existing = userReactions?.[type]?.[id]?.[reactionType];
        
        if (existing) {
            // Удаляем реакцию
            await supabaseClient
                .from('reactions')
                .delete()
                .eq('ip_address', userIp)
                .eq('target_type', type)
                .eq('target_id', id)
                .eq('reaction_type', reactionType);
            
            // Обновляем счётчик
            const field = reactionType + 's';
            const table = type === 'thread' ? 'threads' : 'replies';
            const { data } = await supabaseClient
                .from(table)
                .select(field)
                .eq('id', id)
                .single();
            
            const newValue = (data[field] || 0) - 1;
            await supabaseClient
                .from(table)
                .update({ [field]: newValue })
                .eq('id', id);
            
            // Обновляем локально
            delete userReactions[type][id][reactionType];
            document.getElementById(`${type}-${reactionType}-${id}`).textContent = newValue;
        } else {
            // Добавляем реакцию
            await supabaseClient
                .from('reactions')
                .insert({
                    target_type: type,
                    target_id: id,
                    reaction_type: reactionType,
                    ip_address: userIp
                });
            
            // Обновляем счётчик
            const field = reactionType + 's';
            const table = type === 'thread' ? 'threads' : 'replies';
            const { data } = await supabaseClient
                .from(table)
                .select(field)
                .eq('id', id)
                .single();
            
            const newValue = (data[field] || 0) + 1;
            await supabaseClient
                .from(table)
                .update({ [field]: newValue })
                .eq('id', id);
            
            // Обновляем локально
            if (!userReactions[type]) userReactions[type] = {};
            if (!userReactions[type][id]) userReactions[type][id] = {};
            userReactions[type][id][reactionType] = true;
            
            const btn = document.getElementById(`${type}-${reactionType}-${id}`);
            if (btn) btn.textContent = newValue;
        }
        
        // Перезагружаем отображение
        await loadThread();
        
    } catch (error) {
        console.error('Ошибка реакции:', error);
        showMessage('Ошибка', 'error');
    }
}

// Отправка ответа
document.getElementById('submitReply')?.addEventListener('click', async function() {
    const content = document.getElementById('replyContent')?.value.trim();
    
    if (!content) {
        showMessage('Напишите ответ', 'error');
        return;
    }
    
    if (content.length > 300) {
        showMessage('Слишком длинный ответ', 'error');
        return;
    }
    
    if (checkBannedWords(content)) {
        showMessage('Сообщение содержит запрещённые слова', 'error');
        return;
    }
    
    try {
        const { error } = await supabaseClient
            .from('replies')
            .insert({
                thread_id: currentThreadId,
                content: content,
                author_ip: userIp,
                author_name: 'Аноним'
            });
        
        if (error) throw error;
        
        // Обновляем bump_time и reply_count в треде
        await supabaseClient
            .from('threads')
            .update({ 
                bump_time: new Date(),
                reply_count: (currentThread.reply_count || 0) + 1 
            })
            .eq('id', currentThreadId);
        
        showMessage('Ответ добавлен!', 'success');
        document.getElementById('replyContent').value = '';
        await loadThread();
    } catch (error) {
        showMessage('Ошибка: ' + error.message, 'error');
    }
});

// Пожаловаться на ответ
window.reportReply = async function(replyId) {
    const reason = prompt('Укажите причину жалобы (необязательно):');
    
    try {
        await supabaseClient
            .from('reports')
            .insert({
                target_type: 'reply',
                target_id: replyId,
                reason: reason || 'Без причины',
                reporter_ip: userIp
            });
        
        showMessage('Жалоба отправлена', 'success');
    } catch (error) {
        showMessage('Ошибка', 'error');
    }
};

// Запуск
initApp().then(() => {
    loadThread();
});
