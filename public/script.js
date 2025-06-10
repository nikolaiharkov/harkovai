document.addEventListener('DOMContentLoaded', () => {
    // --- Referensi Elemen DOM ---
    const chatLog = document.getElementById('chat-log');
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const chatIdDisplay = document.getElementById('chat-id-display');
    const sidebar = document.getElementById('sidebar');
    const menuToggle = document.getElementById('menu-toggle');
    const chatHistoryList = document.getElementById('chat-history-list');
    const newChatSidebarButton = document.getElementById('new-chat-sidebar-button');
    const clearAllDataButton = document.getElementById('clear-all-data-button');
    const chatbotContainer = document.getElementById('chatbot-container');

    // --- Konfigurasi Keamanan Marked.js ---
    // Mencegah HTML mentah dirender dari output markdown
    marked.setOptions({
        sanitize: true,
    });

    // --- State Chat ---
    let chatHistory = [];
    let currentSessionId = null;

    // --- Fungsi Utama ---

    const toggleSidebar = () => sidebar.classList.toggle('-translate-x-full');
    
    const updateChatIdDisplay = () => {
        if (chatIdDisplay && currentSessionId) {
            chatIdDisplay.textContent = `ID Sesi: ${currentSessionId}`;
            chatIdDisplay.title = `ID Sesi Saat Ini: ${currentSessionId}`;
        }
    };

    const initializeChat = () => {
        currentSessionId = localStorage.getItem('harkovai_currentSessionId');
        if (currentSessionId) {
            const savedHistory = localStorage.getItem(currentSessionId);
            if (savedHistory) {
                chatHistory = JSON.parse(savedHistory);
                renderChatHistory();
            } else {
                startNewSession();
            }
        } else {
            startNewSession();
        }
        updateChatIdDisplay();
        loadAndRenderChatSessions();
    };

    const startNewSession = () => {
        chatLog.innerHTML = '';
        const newSessionId = `harkovai_session_${Date.now()}`;
        localStorage.setItem('harkovai_currentSessionId', newSessionId);
        currentSessionId = newSessionId;
        updateChatIdDisplay();
        
        chatHistory = [{
            text: 'Halo! Saya HarkovAI. Apa yang bisa saya bantu hari ini?',
            sender: 'bot',
            isError: false
        }];
        
        saveChatHistory();
        renderChatHistory();
        loadAndRenderChatSessions();
    };

    const switchSession = (sessionId) => {
        if (sessionId === currentSessionId) return;
        localStorage.setItem('harkovai_currentSessionId', sessionId);
        initializeChat();
        if (window.innerWidth < 768) {
            toggleSidebar();
        }
    };

    const deleteSession = (sessionId, event) => {
        event.stopPropagation();
        if (confirm('Apakah Anda yakin ingin menghapus riwayat chat ini?')) {
            localStorage.removeItem(sessionId);
            if (sessionId === currentSessionId) {
                localStorage.removeItem('harkovai_currentSessionId');
                initializeChat();
            } else {
                loadAndRenderChatSessions();
            }
        }
    };
    
    const loadAndRenderChatSessions = () => {
        chatHistoryList.innerHTML = '';
        Object.keys(localStorage)
            .filter(key => key.startsWith('harkovai_session_'))
            .forEach(key => {
                const historyData = JSON.parse(localStorage.getItem(key) || '[]');
                const firstUserMessage = historyData.find(msg => msg.sender === 'user')?.text || 'Chat Kosong';
                
                const sessionItem = document.createElement('div');
                sessionItem.className = `flex items-center justify-between p-2 rounded-md cursor-pointer group transition-all ${key === currentSessionId ? 'bg-cyan-800/50' : 'hover:bg-gray-700'}`;
                sessionItem.onclick = () => switchSession(key);

                sessionItem.innerHTML = `
                    <p class="truncate text-sm pr-2">${firstUserMessage}</p>
                    <button class="delete-session-btn flex-shrink-0 text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity" title="Hapus Chat">
                       <i class="fa-solid fa-trash-can fa-xs"></i>
                    </button>
                `;
                sessionItem.querySelector('.delete-session-btn').onclick = (e) => deleteSession(key, e);
                chatHistoryList.appendChild(sessionItem);
            });
    };

    const renderChatHistory = () => {
        chatLog.innerHTML = '';
        chatHistory.forEach(message => renderSingleMessage(message.text, message.sender, message.isError));
        scrollToBottom();
    };

    const saveChatHistory = () => {
        if (currentSessionId) {
            localStorage.setItem(currentSessionId, JSON.stringify(chatHistory));
        }
    };
    
    messageForm.addEventListener('submit', (e) => {
        e.preventDefault();
        handleUserMessage();
    });
    
    const handleNewChat = () => {
         if (confirm('Apakah Anda yakin ingin memulai percakapan baru? Riwayat chat ini akan disimpan.')) {
            startNewSession();
         }
    };
    newChatSidebarButton.addEventListener('click', handleNewChat);

    menuToggle.addEventListener('click', toggleSidebar);
    chatbotContainer.addEventListener('click', () => {
         if (!sidebar.classList.contains('-translate-x-full') && window.innerWidth < 768) {
             toggleSidebar();
         }
    });
    
    clearAllDataButton.addEventListener('click', () => {
        if (confirm('PERINGATAN: Ini akan menghapus SEMUA riwayat percakapan secara permanen. Lanjutkan?')) {
            Object.keys(localStorage)
                .filter(key => key.startsWith('harkovai_'))
                .forEach(key => localStorage.removeItem(key));
            startNewSession();
        }
    });

    const handleUserMessage = () => {
        const userInput = messageInput.value.trim();
        if (!userInput) return;
        
        const wasEmptyChat = chatHistory.filter(m => m.sender === 'user').length === 0;

        addMessageToHistory(userInput, 'user');
        messageInput.value = '';
        showTypingIndicator();
        
        // Mengirim pesan ke server Express, bukan langsung ke webhook
        sendMessageToServer(userInput);

        if (wasEmptyChat) {
            setTimeout(loadAndRenderChatSessions, 100);
        }
    };
    
    const addMessageToHistory = (text, sender, isError = false) => {
         const messageData = { text, sender, isError };
         chatHistory.push(messageData);
         saveChatHistory();
         renderSingleMessage(text, sender, isError);
    };

    // FUNGSI BARU: Mengirim pesan ke server Express
    const sendMessageToServer = async (message) => {
        try {
            // Panggilan fetch ke endpoint /api/chat di server Anda
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: message, sessionId: currentSessionId })
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.reply || `HTTP error! Status: ${response.status}`);
            }
            const data = await response.json();
            const botReply = data.reply || "Maaf, saya tidak menerima respon yang valid.";
            hideTypingIndicator();
            addMessageToHistory(botReply, 'bot');
        } catch (error) {
            console.error('Error sending message to server:', error);
            hideTypingIndicator();
            addMessageToHistory(`Maaf, terjadi kesalahan: ${error.message}`, 'bot', true);
        }
    };
    
    const renderSingleMessage = (text, sender, isError = false) => {
        const messageContainer = document.createElement('div');
        
        // PENTING: Gunakan marked.parse() hanya untuk konten bot yang bukan error
        // Ini melindungi dari XSS jika teks error mengandung HTML
        const content = (sender === 'bot' && !isError) ? marked.parse(text) : `<p>${text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`;

        let messageHTML;
        if (sender === 'user') {
            messageHTML = `<div class="flex items-start gap-3 justify-end"><div class="message-content bg-cyan-600 rounded-lg rounded-tr-none p-4 max-w-lg">${content}</div><div class="flex-shrink-0 h-8 w-8 rounded-full bg-gray-700 flex items-center justify-center"><i class="fa-solid fa-user text-white text-sm"></i></div></div>`;
        } else {
            const bgColor = isError ? 'bg-red-800/50' : 'bg-gray-800';
            const iconColor = isError ? 'from-red-500 to-orange-600' : 'from-cyan-500 to-purple-600';
            const icon = isError ? 'fa-solid fa-triangle-exclamation' : 'fa-solid fa-robot';
            messageHTML = `<div class="flex items-start gap-3"><div class="flex-shrink-0 h-8 w-8 rounded-full bg-gradient-to-br ${iconColor} flex items-center justify-center"><i class="${icon} text-white text-sm"></i></div><div class="message-content ${bgColor} rounded-lg rounded-tl-none p-4 max-w-lg relative group markdown-content">${content}${!isError ? `<button class="copy-btn absolute top-2 right-2 p-1 bg-gray-700 rounded-md text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" title="Salin ke clipboard"><i class="fa-solid fa-copy fa-xs"></i></button>` : ''}</div></div>`;
        }
        
        messageContainer.innerHTML = messageHTML;
        chatLog.appendChild(messageContainer);
        
        const copyButton = messageContainer.querySelector('.copy-btn');
        if (copyButton) {
            copyButton.addEventListener('click', () => copyToClipboard(text, copyButton));
        }

        scrollToBottom();
    };

    const showTypingIndicator = () => {
        const indicatorHTML = `<div id="typing-indicator" class="flex items-start gap-3"><div class="flex-shrink-0 h-8 w-8 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center"><i class="fa-solid fa-robot text-white text-sm"></i></div><div class="message-content bg-gray-800 rounded-lg rounded-tl-none p-4 max-w-lg flex items-center gap-2"><div class="typing-dot h-2 w-2 bg-gray-400 rounded-full"></div><div class="typing-dot h-2 w-2 bg-gray-400 rounded-full"></div><div class="typing-dot h-2 w-2 bg-gray-400 rounded-full"></div></div></div>`;
        chatLog.insertAdjacentHTML('beforeend', indicatorHTML);
        scrollToBottom();
        sendButton.disabled = true;
        messageInput.disabled = true;
    };

    const hideTypingIndicator = () => {
        const indicator = document.getElementById('typing-indicator');
        if (indicator) indicator.remove();
        sendButton.disabled = false;
        messageInput.disabled = false;
        messageInput.focus();
    };
    
    const copyToClipboard = (textToCopy, buttonElement) => {
        navigator.clipboard.writeText(textToCopy).then(() => {
            const originalIcon = buttonElement.innerHTML;
            buttonElement.innerHTML = '<i class="fa-solid fa-check fa-xs"></i>';
            buttonElement.disabled = true;
            setTimeout(() => {
                buttonElement.innerHTML = originalIcon;
                buttonElement.disabled = false;
            }, 2000);
        }).catch(err => console.error('Gagal menyalin teks: ', err));
    };

    const scrollToBottom = () => {
        chatLog.scrollTop = chatLog.scrollHeight;
    };

    initializeChat();
});