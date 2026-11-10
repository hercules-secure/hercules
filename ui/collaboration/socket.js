import { io } from 'https://cdn.socket.io/4.8.3/socket.io.esm.min.js';

let socket = null;
let cfg = null;
let initPromise = null;              // защита от параллельных вызовов
const listeners = new Map();

async function loadCollabConfig() {
  try {
    const res = await fetch('/api/config', { credentials: 'include' });
    if (!res.ok) return null;

    const data = await res.json();
    const collab = data?.settings?.collaboration || {};

    return {
      enabled:           collab.enabled === true,
      serverUrl:         String(collab.serverUrl || '').trim(),
      apiKey:            String(collab.apiKey || ''),
      workspace:         String(collab.workspace || 'default'),
      reconnectInterval: Number(collab.reconnectInterval || 5),
      verifyTls:         collab.verifyTls !== false,
    };
  } catch (e) {
    console.warn('[collab] config load failed:', e.message);
    return null;
  }
}

export async function initCollabSocket() {
  // Уже подключён — возвращаем как есть
  if (socket?.connected) return socket;

  // Идёт инициализация — ждём её
  if (initPromise) return initPromise;

  initPromise = (async () => {
    // Старый сокет, если был, но не подключён — закрываем
    if (socket) {
      try { socket.disconnect(); } catch {}
      socket = null;
    }

    cfg = await loadCollabConfig();
    if (!cfg || !cfg.enabled || !cfg.serverUrl) {
      console.info('[collab] disabled or not configured');
      return null;
    }

    socket = io(cfg.serverUrl, {
      path: '/socket.io',
      auth: {
        token: cfg.apiKey,
        workspace: cfg.workspace,
        userName: window.CURRENT_USER || 'engineer',
      },
      reconnectionDelay: cfg.reconnectInterval * 1000,
    });

    // Ждём реального connect
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('connect timeout')), 10000);

      socket.once('connect', () => {
        clearTimeout(timer);
        resolve();
      });
      socket.once('connect_error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });

    // Навешиваем обработчики ОДИН раз — после успешного connect
    socket.on('connect',       () => emit('connect'));
    socket.on('connect_error', (e) => emit('connect_error', e));
    socket.on('disconnect',    (r) => emit('disconnect', r));

    const EVENTS = [
      'connected',
      'chats:created', 'chats:renamed', 'chats:deleted', 'chats:cleared',
      'message', 'thread:reply', 'typing', 'user:offline',
    ];
    EVENTS.forEach(ev => socket.on(ev, (p) => emit(ev, p)));

    return socket;
  })();

  try {
    return await initPromise;
  } finally {
    initPromise = null;
  }
}

export function isConnected() {
  return !!socket?.connected;
}

export function disconnectCollabSocket() {
  if (socket) {
    try { socket.disconnect(); } catch {}
    socket = null;
  }
  initPromise = null;
}


function emit(ev, payload) {
  const set = listeners.get(ev);
  if (!set) return;
  set.forEach(fn => {
    try { fn(payload); } catch (e) { console.warn('[collab] handler error', e); }
  });
}

export function on(ev, handler) {
  if (!listeners.has(ev)) listeners.set(ev, new Set());
  listeners.get(ev).add(handler);
}

export function off(ev, handler) {
  listeners.get(ev)?.delete(handler);
}

function emitCb(ev, payload) {
  return new Promise((resolve, reject) => {
    if (!socket?.connected) return reject(new Error('not connected'));
    socket.emit(ev, payload, (res) => {
      if (res?.ok) resolve(res);
      else reject(new Error(res?.error || 'request failed'));
    });
  });
}

export async function listChats() {
  const res = await emitCb('chats:list', {});
  return res.chats || [];
}

export async function createChat(name, visibility = 'private') {
  const res = await emitCb('chats:create', { name, visibility });
  return res.chat;
}

export async function renameChat(oldName, newName) {
  const res = await emitCb('chats:rename', { oldName, newName });
  return res.chat;
}

export async function deleteChat(name) {
  await emitCb('chats:delete', { name });
  return true;
}

export async function clearChat(name) {
  await emitCb('chats:clear', { name });
  return true;
}

export async function joinChannel(name) {
  return emitCb('join', { channel: name });
}

export async function leaveChannel(name) {
  return emitCb('leave', { channel: name });
}

export async function sendMessage(channel, text) {
  const res = await emitCb('message', { channel, text });
  return res.message;
}

export function sendTyping(channel, isTyping) {
  if (!socket?.connected) return;
  socket.emit('typing', { channel, isTyping });
}

export async function inviteToChat(name, username, role = 'member') {
  return emitCb('chats:invite', { name, username, role });
}