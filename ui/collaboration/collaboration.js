import {
  initCollabSocket, on, isConnected,
  listChats, createChat as wsCreateChat,
  renameChat as wsRenameChat,
  deleteChat as wsDeleteChat,
  clearChat  as wsClearChat,
  joinChannel, leaveChannel,
  sendMessage as wsSendMessage,
  sendTyping,
  inviteToChat as wsInviteToChat,
} from './socket.js';

(function () {
  'use strict';

  // ---------- CONFIG ----------
  const CURRENT_USER = window.CURRENT_USER || 'engineer';

  // ---------- STATE ----------
  let chats = [];
  let currentChatId = null;
  let contextChatId = null;
  let newChatVisibility = 'private';
  let inited = false;
  let creatingChat = false;
  let renamingChat = false;
  let deletingChat = false;
  let clearingChat = false;
  let invitingChat = false;

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);

  const chatListEl    = $('chatList');
  const messagesEl    = $('messages');
  const chatActiveEl  = $('chatActive');
  const chatEmptyEl   = $('chatEmpty');
  const chatNameEl    = $('chatName');
  const chatAvatarEl  = $('chatAvatar');
  const chatStatusEl  = $('chatStatus');
  const messageInput  = $('messageInput');
  const toastEl       = $('toast');
  const contextMenu   = $('chatContextMenu');

  // ============================================================
  // TOAST
  // ============================================================
  const TOAST_ICONS = {
    success: 'fa-circle-check',
    error:   'fa-circle-exclamation',
    warning: 'fa-triangle-exclamation',
    info:    'fa-circle-info',
  };

  function toast(msg, type = 'success') {
    if (!toastEl) { console.log(type, msg); return; }
    const icon = TOAST_ICONS[type] || TOAST_ICONS.info;
    toastEl.className = 'toast ' + type;
    toastEl.innerHTML = `<i class="fas ${icon}"></i><span>${escapeHtml(msg)}</span>`;
    toastEl.classList.add('show');
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(() => toastEl.classList.remove('show'), 3000);
  }

  // ============================================================
  // HELPERS
  // ============================================================
  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function initials(name) {
    return String(name || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  }

  function formatTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    return sameDay
      ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleString();
  }

  function avatarFor(name) {
    return String(name || '#').replace(/^#/, '').slice(0, 2).toUpperCase() || '#';
  }

  // ============================================================
  // MODAL HELPERS
  // ============================================================
  function openModal(id) {
    const el = $(id);
    if (el) el.classList.add('active');
  }

  function closeModal(id) {
    const el = $(id);
    if (el) el.classList.remove('active');
  }

  function closeAllModals() {
    document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
    if (contextMenu) contextMenu.classList.remove('active');
  }

  // ============================================================
  // CHATS — LOAD
  // ============================================================
  async function loadChats() {
    try {
      chats = await listChats();
      renderChatList();

      if (chats.length && currentChatId === null) {
        selectChat(chats[0].id);
      } else if (currentChatId !== null && !chats.find(c => c.id === currentChatId)) {
        currentChatId = null;
        chatActiveEl.style.display = 'none';
        chatEmptyEl.style.display = 'flex';
      } else if (currentChatId !== null) {
        selectChat(currentChatId);
      }
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  function renderChatList() {
    if (!chats.length) {
      chatListEl.innerHTML = `
        <div class="chat-list-empty">
          <i class="fas fa-comments" style="font-size:1.5rem;opacity:.3;display:block;margin-bottom:8px;"></i>
          No chats yet
        </div>`;
      return;
    }

    chatListEl.innerHTML = chats.map(c => {
      const msgs = c.messages || [];
      const last = msgs[msgs.length - 1];
      const preview = last
        ? `${last.author}: ${String(last.text || '').slice(0, 40)}`
        : 'No messages';
      const unread = c.unread || 0;

      const vis = c.visibility || 'private';
      const visIcon  = vis === 'public' ? 'fa-globe' : 'fa-lock';
      const visTitle = vis === 'public' ? 'Public' : 'Private';

      return `
        <div class="chat-item ${c.id === currentChatId ? 'active' : ''}" data-id="${escapeHtml(c.id)}">
          <div class="chat-item-avatar">${escapeHtml(avatarFor(c.name))}</div>
          <div class="chat-item-info">
            <span class="chat-item-name">
              ${escapeHtml(c.name || 'Untitled')}
              <i class="fas ${visIcon} chat-visibility-icon" title="${visTitle}"></i>
            </span>
            <span class="chat-item-preview">${escapeHtml(preview)}</span>
          </div>
          ${unread ? `<span class="chat-item-badge">${unread}</span>` : ''}
        </div>
      `;
    }).join('');

    chatListEl.querySelectorAll('.chat-item').forEach(el => {
      el.addEventListener('click', () => selectChat(el.dataset.id));
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        openContextMenu(e.clientX, e.clientY, el.dataset.id);
      });
    });
  }

  // ============================================================
  // SELECT CHAT
  // ============================================================
  function selectChat(id) {
    const chat = chats.find(c => c.id === id);
    if (!chat) return;

    if (currentChatId && currentChatId !== id) {
      const prev = chats.find(c => c.id === currentChatId);
      if (prev?.name) leaveChannel(prev.name).catch(() => {});
    }

    currentChatId = id;
    chat.messages = chat.messages || [];
    chat.unread = 0;

    chatNameEl.textContent = chat.name || 'Untitled';
    chatAvatarEl.textContent = avatarFor(chat.name);

    const vis = chat.visibility || 'private';
    chatStatusEl.innerHTML = vis === 'public'
      ? '<i class="fas fa-globe"></i> Public'
      : '<i class="fas fa-lock"></i> Private';

    chatEmptyEl.style.display = 'none';
    chatActiveEl.style.display = 'flex';

    renderChatList();
    renderMessages();
    messageInput?.focus();

    if (isConnected() && chat.name) {
      joinChannel(chat.name).catch(err => console.warn('[collab] join failed', err));
    }
  }

  // ============================================================
  // MESSAGES
  // ============================================================
  function renderMessages() {
    const chat = chats.find(c => c.id === currentChatId);
    if (!chat) return;

    const msgs = chat.messages || [];
    if (!msgs.length) {
      messagesEl.innerHTML = '<div class="messages-empty">No messages yet. Say hi <i class="fas fa-hand-peace"></i></div>';
      return;
    }

    messagesEl.innerHTML = msgs.map(m => {
      const isOwn = m.author === CURRENT_USER;
      return `
        <div class="message ${isOwn ? 'own' : ''}">
          <div class="message-avatar">${escapeHtml(initials(m.author))}</div>
          <div class="message-bubble">
            <div class="message-meta">
              <span class="message-author">${escapeHtml(m.author || 'unknown')}</span>
              <span>${formatTime(m.created_at)}</span>
            </div>
            <div class="message-text">${escapeHtml(m.text)}</div>
          </div>
        </div>
      `;
    }).join('');

    requestAnimationFrame(() => {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    });
  }

  // ============================================================
  // VISIBILITY TOGGLE
  // ============================================================
  function setVisibility(value) {
    newChatVisibility = value === 'public' ? 'public' : 'private';
    document.querySelectorAll('#newChatVisibility .visibility-option').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === newChatVisibility);
    });
  }

  function initVisibilityToggle() {
    document.querySelectorAll('#newChatVisibility .visibility-option').forEach(btn => {
      btn.addEventListener('click', () => setVisibility(btn.dataset.value));
    });
  }

  // ============================================================
  // CREATE
  // ============================================================
  function createChat() {
    const input = $('newChatName');
    if (input) input.value = 'general';
    setVisibility('private');
    openModal('newChatModal');
    setTimeout(() => input?.focus(), 50);
  }

  async function submitCreateChat() {
    if (creatingChat) return;
    creatingChat = true;

    const input = $('newChatName');
    const name = (input?.value || '').trim();

    if (!name) {
      toast('Enter chat name', 'error');
      input?.focus();
      creatingChat = false;
      return;
    }

    const btn = $('newChatConfirm');
    if (btn) btn.disabled = true;

    try {
      const chat = await wsCreateChat(name, newChatVisibility);
      if (!chats.some(c => c.id === chat.id)) chats.push(chat);
      currentChatId = chat.id;
      renderChatList();
      selectChat(chat.id);
      closeModal('newChatModal');
      toast('Chat created', 'success');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      if (btn) btn.disabled = false;
      creatingChat = false;
    }
  }

  // ============================================================
  // RENAME
  // ============================================================
  function renameChat(id) {
    const chatId = id ?? currentChatId;
    const chat = chats.find(c => c.id === chatId);
    if (!chat) return;

    const input = $('renameChatName');
    if (input) input.value = chat.name || '';

    contextChatId = chatId;
    openModal('renameChatModal');
    setTimeout(() => input?.focus(), 50);
  }

  async function submitRenameChat() {
    if (renamingChat) return;
    renamingChat = true;

    const chatId = contextChatId ?? currentChatId;
    const chat = chats.find(c => c.id === chatId);
    if (!chat) { renamingChat = false; return; }

    const input = $('renameChatName');
    const newName = (input?.value || '').trim();
    if (!newName) { toast('Enter chat name', 'error'); renamingChat = false; return; }
    if (newName === chat.name) { closeModal('renameChatModal'); renamingChat = false; return; }

    const btn = $('renameChatConfirm');
    if (btn) btn.disabled = true;

    try {
      const updated = await wsRenameChat(chat.name, newName);
      chat.id = updated.id;
      chat.name = updated.name;
      if (currentChatId === chatId) currentChatId = updated.id;
      renderChatList();
      chatNameEl.textContent = newName;
      chatAvatarEl.textContent = avatarFor(newName);
      closeModal('renameChatModal');
      toast('Chat renamed', 'success');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      if (btn) btn.disabled = false;
      renamingChat = false;
    }
  }

  // ============================================================
  // DELETE
  // ============================================================
  function deleteChat(id) {
    const chatId = id ?? currentChatId;
    const chat = chats.find(c => c.id === chatId);
    if (!chat) return;

    contextChatId = chatId;
    $('deleteChatName').textContent = `"${chat.name || 'Untitled'}"`;
    openModal('deleteChatModal');
  }

  async function submitDeleteChat() {
    if (deletingChat) return;
    deletingChat = true;

    const chatId = contextChatId ?? currentChatId;
    const chat = chats.find(c => c.id === chatId);
    if (!chat) { deletingChat = false; return; }

    const btn = $('deleteChatConfirm');
    if (btn) btn.disabled = true;

    try {
      await wsDeleteChat(chat.name);
      chats = chats.filter(c => c.id !== chatId);
      if (currentChatId === chatId) {
        currentChatId = null;
        chatActiveEl.style.display = 'none';
        chatEmptyEl.style.display = 'flex';
      }
      renderChatList();
      if (chats.length && currentChatId === null) selectChat(chats[0].id);
      closeModal('deleteChatModal');
      toast('Chat deleted', 'success');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      if (btn) btn.disabled = false;
      deletingChat = false;
    }
  }

  // ============================================================
  // CLEAR
  // ============================================================
  function clearChat(id) {
    const chatId = id ?? currentChatId;
    const chat = chats.find(c => c.id === chatId);
    if (!chat) return;

    contextChatId = chatId;
    $('clearChatName').textContent = `"${chat.name || 'Untitled'}"`;
    openModal('clearChatModal');
  }

  async function submitClearChat() {
    if (clearingChat) return;
    clearingChat = true;

    const chatId = contextChatId ?? currentChatId;
    const chat = chats.find(c => c.id === chatId);
    if (!chat) { clearingChat = false; return; }

    const btn = $('clearChatConfirm');
    if (btn) btn.disabled = true;

    try {
      await wsClearChat(chat.name);
      chat.messages = [];
      if (currentChatId === chatId) renderMessages();
      renderChatList();
      closeModal('clearChatModal');
      toast('Messages cleared', 'success');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      if (btn) btn.disabled = false;
      clearingChat = false;
    }
  }

  // ============================================================
  // INVITE
  // ============================================================
  function openInviteModal(id) {
    const chatId = id ?? currentChatId;
    const chat = chats.find(c => c.id === chatId);
    if (!chat) return;

    contextChatId = chatId;

    const userInput = $('inviteUser');
    if (userInput) userInput.value = '';
    const roleInput = $('inviteRole');
    if (roleInput) roleInput.value = 'member';

    openModal('inviteModal');
    setTimeout(() => userInput?.focus(), 50);
  }

  async function submitInvite() {
    if (invitingChat) return;
    invitingChat = true;

    const chatId = contextChatId ?? currentChatId;
    const chat = chats.find(c => c.id === chatId);
    const username = ($('inviteUser')?.value || '').trim();
    const role = $('inviteRole')?.value || 'member';

    if (!chat) { invitingChat = false; return; }
    if (!username) {
      toast('Enter username', 'error');
      $('inviteUser')?.focus();
      invitingChat = false;
      return;
    }

    const btn = $('inviteConfirm');
    if (btn) btn.disabled = true;

    try {
      if (typeof wsInviteToChat === 'function') {
        await wsInviteToChat(chat.name, username, role);
        closeModal('inviteModal');
        toast(`Invited ${username} (${role})`, 'success');
      } else {
        closeModal('inviteModal');
        toast(`Invite for ${username} (${role}) — server event not implemented`, 'info');
      }
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      if (btn) btn.disabled = false;
      invitingChat = false;
    }
  }

  // ============================================================
  // SEND MESSAGE
  // ============================================================
  async function sendMessage() {
  if (currentChatId === null) return;
  const text = messageInput.value.trim();
  if (!text) return;

  const chat = chats.find(c => c.id === currentChatId);
  if (!chat) return;

  const tmpId = 'tmp-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
  const tmp = {
    id: tmpId,
    author: CURRENT_USER,
    text,
    created_at: new Date().toISOString(),
  };

  chat.messages = chat.messages || [];
  chat.messages.push(tmp);
  messageInput.value = '';
  autoResize();
  renderMessages();
  renderChatList();

  try {
    const saved = await wsSendMessage(chat.name, text);

    // Заменяем tmp на серверное только если tmp ещё в списке.
    // Если on('message') уже заменил его — findIndex вернёт -1, ничего не делаем.
    const idx = chat.messages.findIndex(m => m.id === tmpId);
    if (idx !== -1 && saved) {
      chat.messages[idx] = {
        id: saved.id,
        author: saved.userName,
        text: saved.text,
        created_at: new Date(saved.time).toISOString(),
      };
      renderMessages();
      renderChatList();
    }
  } catch (e) {
    toast(e.message, 'error');
    // Убираем только свой tmp — по уникальному id, а не по тексту
    chat.messages = chat.messages.filter(m => m.id !== tmpId);
    renderMessages();
    renderChatList();
  }
}

  // ============================================================
  // AUTO RESIZE
  // ============================================================
  function autoResize() {
    if (!messageInput) return;
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 140) + 'px';
  }

  // ============================================================
  // CONTEXT MENU
  // ============================================================
  function openContextMenu(x, y, chatId) {
    if (!contextMenu) return;
    contextChatId = chatId;
    contextMenu.classList.add('active');
    const rect = contextMenu.getBoundingClientRect();
    const left = Math.min(x, window.innerWidth - rect.width - 8);
    const top  = Math.min(y, window.innerHeight - rect.height - 8);
    contextMenu.style.left = left + 'px';
    contextMenu.style.top = top + 'px';
  }

  function closeContextMenu() {
    if (contextMenu) contextMenu.classList.remove('active');
  }

  function handleContextAction(action) {
    const id = contextChatId;
    closeContextMenu();
    switch (action) {
      case 'open':   if (id) selectChat(id); break;
      case 'rename': renameChat(id); break;
      case 'clear':  clearChat(id); break;
      case 'invite': if (id) openInviteModal(id); break;
      case 'delete': deleteChat(id); break;
    }
  }

  // ============================================================
  // COMPOSER
  // ============================================================
  function initComposer() {
    $('attachBtn')?.addEventListener('click', () => toast('attach coming soon', 'info'));
    // $('attachInput')?.addEventListener('change', (e) => toast('Video call coming soon', 'info'));
    //   const files = Array.from(e.target.files || []);
    //   if (!files.length) return;
    //   files.forEach(f => toast(`Attached: ${f.name}`, 'info'));
    //   e.target.value = '';
    // });

    $('callBtn')?.addEventListener('click', () => toast('audio call coming soon', 'info'));
    //   const btn = $('callBtn');
    //   const active = btn.classList.toggle('active');
    //   toast(active ? 'Calling...' : 'Call ended', 'info');
    //   btn.title = active ? 'End call' : 'Voice call';
    // });

    $('videoBtn')?.addEventListener('click', () => toast('video call coming soon', 'info'));
  }

  // ============================================================
  // THEME
  // ============================================================
  function initThemeToggle() {
    const t = $('themeToggle');
    const root = document.documentElement;
    if (!t) return;
    t.addEventListener('click', () => {
      const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      localStorage.setItem('hercules_theme', next);
    });
  }

  // ============================================================
  // EVENTS
  // ============================================================
  function initEvents() {
    $('newChatBtn')?.addEventListener('click', createChat);
    $('deleteChatBtn')?.addEventListener('click', () => deleteChat());
    $('renameChatBtn')?.addEventListener('click', () => renameChat());
    $('clearChatBtn')?.addEventListener('click',  () => clearChat());

    $('newChatConfirm')?.addEventListener('click', submitCreateChat);
    $('renameChatConfirm')?.addEventListener('click', submitRenameChat);
    $('deleteChatConfirm')?.addEventListener('click', submitDeleteChat);
    $('clearChatConfirm')?.addEventListener('click', submitClearChat);
    $('inviteConfirm')?.addEventListener('click', submitInvite);

    $('newChatName')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); submitCreateChat(); }
    });
    $('renameChatName')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); submitRenameChat(); }
    });
    $('inviteUser')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); submitInvite(); }
    });

    document.querySelectorAll('[data-close]').forEach(el => {
      el.addEventListener('click', closeAllModals);
    });

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.remove('active');
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeAllModals();
    });

    contextMenu?.querySelectorAll('.context-item').forEach(item => {
      item.addEventListener('click', () => handleContextAction(item.dataset.action));
    });

    document.addEventListener('click', (e) => {
      if (!contextMenu) return;
      if (!contextMenu.contains(e.target)) closeContextMenu();
    });

    window.addEventListener('scroll', closeContextMenu, true);
    window.addEventListener('resize', closeContextMenu);

    $('sendBtn')?.addEventListener('click', sendMessage);
    messageInput?.addEventListener('input', autoResize);
    messageInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });

    let typingTimer = null;
    messageInput?.addEventListener('input', () => {
      const chat = chats.find(c => c.id === currentChatId);
      if (!chat || !isConnected()) return;
      sendTyping(chat.name, true);
      clearTimeout(typingTimer);
      typingTimer = setTimeout(() => sendTyping(chat.name, false), 1500);
    });
  }

  // ============================================================
  // INIT
  // ============================================================
  async function init() {
    if (inited) return;
    inited = true;

    initThemeToggle();
    initVisibilityToggle();
    initComposer();
    initEvents();

    if (typeof loadMenu === 'function') {
      try { loadMenu(); } catch (e) { console.warn('loadMenu failed', e); }
    }

    await initCollabSocket();

    on('message', (msg) => {
  const chat = chats.find(c => c.name === msg.channel);
  if (!chat) return;

  chat.messages = chat.messages || [];

  // уже есть с таким id — не дублируем
  if (chat.messages.some(m => m.id === msg.id)) return;

  // эхо собственного сообщения: ищем tmp с тем же текстом
  if (msg.userName === CURRENT_USER) {
    const tmpIdx = chat.messages.findIndex(
      m => typeof m.id === 'string' && m.id.startsWith('tmp-') && m.text === msg.text
    );
    if (tmpIdx !== -1) {
      chat.messages[tmpIdx] = {
        id: msg.id,
        author: msg.userName,
        text: msg.text,
        created_at: new Date(msg.time).toISOString(),
      };
      if (currentChatId === chat.id) renderMessages();
      renderChatList();
      return;
    }
  }

  // чужое сообщение — добавляем
  chat.messages.push({
    id: msg.id,
    author: msg.userName,
    text: msg.text,
    created_at: new Date(msg.time).toISOString(),
  });

  if (currentChatId === chat.id) renderMessages();
  else chat.unread = (chat.unread || 0) + 1;
  renderChatList();
});

    on('chats:created', (chat) => {
      if (chats.some(c => c.id === chat.id)) return;
      chats.push(chat);
      renderChatList();
    });

    on('chats:deleted', ({ name }) => {
      chats = chats.filter(c => c.id !== name);
      if (currentChatId === name) {
        currentChatId = null;
        chatActiveEl.style.display = 'none';
        chatEmptyEl.style.display = 'flex';
      }
      renderChatList();
    });

    on('chats:cleared', ({ name }) => {
      const chat = chats.find(c => c.id === name);
      if (chat) {
        chat.messages = [];
        if (currentChatId === name) renderMessages();
        renderChatList();
      }
    });

    on('chats:renamed', ({ oldName, chat }) => {
      const local = chats.find(c => c.id === oldName);
      if (local) {
        local.id = chat.id;
        local.name = chat.name;
        if (currentChatId === oldName) currentChatId = chat.id;
        renderChatList();
      }
    });

    loadChats();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();