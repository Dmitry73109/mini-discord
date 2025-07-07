// --- Логин и переменные ---
const loginScreen = document.getElementById('login-screen');
const loginForm = document.getElementById('login-form');
const loginName = document.getElementById('login-name');
const app = document.getElementById('app');

let currentUser = null;
let currentType = 'public';
let currentChannel = 'general';

const HARDCODED_DM = 'Bot';

const fileInput = document.getElementById('file-input');
const fileBtn = document.getElementById('file-btn');

// --- Голосовой чат эмуляция ---
let inVoice = false;

function getVoiceUsers() {
  let raw = localStorage.getItem('voice_users');
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}
function setVoiceUsers(users) {
  localStorage.setItem('voice_users', JSON.stringify(users));
}

const voiceToggle = document.getElementById('voice-toggle');
const voiceStatus = document.getElementById('voice-status');
const voiceUsersDiv = document.getElementById('voice-users');

function updateVoicePanel() {
  const users = getVoiceUsers();
  inVoice = users.includes(currentUser);
  voiceStatus.textContent = inVoice
    ? 'Вы в голосовом чате'
    : 'Вы не в голосовом чате';
  voiceToggle.textContent = inVoice ? 'Выйти' : 'Войти';
  voiceStatus.style.color = inVoice ? '#40fd7e' : '#f27171';
  voiceUsersDiv.innerHTML = users.length
    ? 'В голосе: ' + users.map(u =>
        `<span${u === currentUser ? ' style="background:#5865f2;color:#fff"' : ''}>${u}</span>`
      ).join('')
    : '<span style="color:#888">Пока никого нет</span>';
}

voiceToggle.onclick = function() {
  let users = getVoiceUsers();
  if (users.includes(currentUser)) {
    users = users.filter(u => u !== currentUser);
  } else {
    users.push(currentUser);
  }
  setVoiceUsers(users);
  updateVoicePanel();
  renderUserList();
};

window.addEventListener('storage', function(e) {
  if (e.key === 'voice_users') {
    updateVoicePanel();
    renderUserList();
  }
});

window.addEventListener('DOMContentLoaded', () => {
  const savedName = localStorage.getItem('discord_nick');
  if (savedName) {
    currentUser = savedName;
    showChat();
  }
});

loginForm.addEventListener('submit', e => {
  e.preventDefault();
  const name = loginName.value.trim();
  if (name.length < 2) {
    alert('Имя слишком короткое');
    return;
  }
  localStorage.setItem('discord_nick', name);
  currentUser = name;
  showChat();
});

function showChat() {
  loginScreen.style.display = 'none';
  app.style.display = '';
  renderUserList();
  renderDmList();
  loadMessages();
  updateVoicePanel();
}

// --- Сообщения и чат ---
const messagesDiv = document.getElementById('messages');
const chatForm = document.getElementById('chat-form');
const messageInput = document.getElementById('message-input');

// --- Переключение каналов ---
document.querySelector('.channel[data-type="public"]').addEventListener('click', function() {
  setActiveChannel('public', 'general');
});

function setActiveChannel(type, name) {
  currentType = type;
  currentChannel = name;
  document.querySelectorAll('.channel, .dm-channel').forEach(el => el.classList.remove('active'));
  if (type === 'public') {
    document.querySelector('.channel[data-type="public"]').classList.add('active');
  } else {
    document.querySelector(`.dm-channel[data-user="${name}"]`).classList.add('active');
  }
  loadMessages();
}

// --- DM ---
function getDmKey(user1, user2) {
  return 'dm_' + [user1, user2].sort().join('_');
}

function getDmList() {
  let raw = localStorage.getItem('dm_list_' + currentUser);
  let list = raw ? JSON.parse(raw) : [];
  if (!list.includes(HARDCODED_DM)) list.unshift(HARDCODED_DM);
  if (!list.includes(currentUser)) list.unshift(currentUser);
  // NEW: Автозаполнение DM для текущего юзера по истории
  for (let i = 0; i < localStorage.length; i++) {
    let key = localStorage.key(i);
    if (key.startsWith('dm_')) {
      let names = key.substring(3).split('_');
      if (names.includes(currentUser)) {
        let other = names[0] === currentUser ? names[1] : names[0];
        if (!list.includes(other)) {
          list.push(other);
        }
      }
    }
  }
  return list;
}
function saveDmList(list) {
  if (!list.includes(HARDCODED_DM)) list.unshift(HARDCODED_DM);
  if (!list.includes(currentUser)) list.unshift(currentUser);
  localStorage.setItem('dm_list_' + currentUser, JSON.stringify(list));
}
function renderDmList() {
  const dmList = getDmList();
  const container = document.getElementById('dm-list');
  container.innerHTML = '';
  dmList.forEach(user => {
    const div = document.createElement('div');
    div.className = 'dm-channel';
    div.dataset.user = user;
    // Аватар
    const avatar = document.createElement('span');
    avatar.className = 'dm-avatar';
    avatar.textContent = user[0] ? user[0].toUpperCase() : '?';
    // Контекстное меню
    avatar.oncontextmenu = div.oncontextmenu = (e) => {
      e.preventDefault();
      showContextMenu(user, e.pageX, e.pageY);
      return false;
    };
    // Ник
    const nick = document.createElement('span');
    nick.className = 'dm-nick';
    nick.textContent = '@' + user;
    // (self)
    if (user === currentUser) {
      const self = document.createElement('span');
      self.className = 'dm-self';
      self.textContent = ' (self)';
      div.appendChild(avatar);
      div.appendChild(nick);
      div.appendChild(self);
    } else {
      div.appendChild(avatar);
      div.appendChild(nick);
    }
    if (currentType === 'dm' && currentChannel === user) div.classList.add('active');
    div.onclick = () => setActiveChannel('dm', user);
    container.appendChild(div);
  });
}


// --- Новый DM ---
document.getElementById('dm-form').addEventListener('submit', e => {
  e.preventDefault();
  const input = document.getElementById('dm-input');
  const user = input.value.trim();
  input.value = '';
  if (!user) return;
  let dmList = getDmList();
  if (!dmList.includes(user)) {
    dmList.push(user);
    saveDmList(dmList);
    renderDmList();
  }
  setActiveChannel('dm', user);
});

// --- Получение/сохранение сообщений ---
function getMessages() {
  if (currentType === 'public') {
    const raw = localStorage.getItem('channel_general');
    return raw ? JSON.parse(raw) : [];
  } else {
    const key = getDmKey(currentUser, currentChannel);
    let messages = localStorage.getItem(key);
    if (!messages && currentChannel === HARDCODED_DM) {
      const botHello = [{
        user: HARDCODED_DM,
        text: 'Привет! Это личный чат с ботом. Задай мне вопрос!',
        time: Date.now()
      }];
      saveMessages(botHello);
      messages = JSON.stringify(botHello);
    }
    return messages ? JSON.parse(messages) : [];
  }
}
function saveMessages(messages) {
  if (currentType === 'public') {
    localStorage.setItem('channel_general', JSON.stringify(messages));
  } else {
    const key = getDmKey(currentUser, currentChannel);
    localStorage.setItem(key, JSON.stringify(messages));
  }
}

function loadMessages() {
  messagesDiv.innerHTML = '';
  const messages = getMessages();
  messages.forEach(msg => {
    addMessage(msg.user, msg.text || '', msg.time, msg.image || null);
  });
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// --- Отправка сообщений (текст) ---
if (chatForm) {
  chatForm.addEventListener('submit', e => {
    e.preventDefault();
    const text = messageInput.value.trim();
    if (!text) return;
    const messages = getMessages();
    const msgObj = { user: currentUser, text, time: Date.now() };
    messages.push(msgObj);
    saveMessages(messages);
    addMessage(currentUser, text, msgObj.time);
    if (currentType === 'dm') {
      let dmList = getDmList();
      if (!dmList.includes(currentChannel)) {
        dmList.push(currentChannel);
        saveDmList(dmList);
        renderDmList();
      }
      if (currentChannel === HARDCODED_DM) {
        setTimeout(() => {
          botAutoReply(text);
        }, 700 + Math.random()*800);
      }
    }
    messageInput.value = '';
  });
}

// --- Отправка фото ---
fileInput.addEventListener('change', function() {
  const file = this.files && this.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    alert('Изображение слишком большое! Макс 2 МБ.');
    this.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = function(e) {
    const imgData = e.target.result;
    sendImageMessage(imgData);
  };
  reader.readAsDataURL(file);
  this.value = '';
});

function sendImageMessage(imgData) {
  const messages = getMessages();
  const msgObj = { user: currentUser, image: imgData, time: Date.now() };
  messages.push(msgObj);
  saveMessages(messages);
  addMessage(currentUser, '', msgObj.time, imgData);
  if (currentType === 'dm' && currentChannel === HARDCODED_DM) {
    setTimeout(() => {
      botAutoReply('image');
    }, 900);
  }
}

// --- Универсальный вывод сообщения (текст или фото) ---
function addMessage(user, text, time = null, image = null) {
  const div = document.createElement('div');
  div.className = 'message-bubble';

  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.textContent = user[0] ? user[0].toUpperCase() : '?';
  if (user === HARDCODED_DM) avatar.style.background = '#40b7fd';
  if (user === currentUser) avatar.style.background = '#7983fa';

  avatar.dataset.user = user;
  avatar.style.cursor = (user !== HARDCODED_DM) ? 'pointer' : 'default';
  avatar.title = (user !== HARDCODED_DM) ? 'Перейти в личный чат с ' + user : '';
  avatar.onclick = function() {
    if (user === HARDCODED_DM) return;
    let dmList = getDmList();
    if (!dmList.includes(user)) {
      dmList.push(user);
      saveDmList(dmList);
      renderDmList();
    }
    setActiveChannel('dm', user);
  };

  // --- Контекстное меню по ПКМ
  avatar.oncontextmenu = function(e) {
    e.preventDefault();
    showContextMenu(user, e.pageX, e.pageY);
    return false;
  };

  const content = document.createElement('div');
  content.className = 'message-content';
  const meta = document.createElement('div');
  meta.className = 'message-meta';
  const nick = document.createElement('span');
  nick.className = 'message-nick';
  nick.textContent = user;
  if (user === HARDCODED_DM) nick.style.color = "#40b7fd";
  if (user === currentUser) nick.style.color = "#b5bcf5";
  const tm = document.createElement('span');
  tm.className = 'message-time';
  tm.textContent = time ? formatTime(time) : '';
  meta.appendChild(nick);
  meta.appendChild(tm);

  const msg = document.createElement('div');
  if (image) {
    msg.innerHTML = `<img src="${image}" alt="img" style="max-width:250px;max-height:210px;border-radius:11px;box-shadow:0 1px 12px #2223;margin:5px 0;">`;
  } else {
    msg.textContent = text;
  }

  content.appendChild(meta);
  content.appendChild(msg);

  div.appendChild(avatar);
  div.appendChild(content);

  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function botAutoReply(userText) {
  const answers = [
    "Это просто тестовый бот! 👾",
    "Спроси меня что-нибудь!",
    "Я просто говорю 'Привет!' 🤖",
    "Всё будет хорошо 😊",
    "Мне нравится твой вопрос, но я пока не умею отвечать.",
    "Погода отличная для чата!",
    "Хочешь анекдот? Их пока нет! 😅",
    "Я умею отвечать только на картинки и текст!"
  ];
  if (userText === 'image') {
    const botMsg = "Картинка получена! 👍";
    const messages = getMessages();
    const msgObj = { user: HARDCODED_DM, text: botMsg, time: Date.now() };
    messages.push(msgObj);
    saveMessages(messages);
    addMessage(HARDCODED_DM, botMsg, msgObj.time);
    return;
  }
  const botMsg = answers[Math.floor(Math.random() * answers.length)];
  const messages = getMessages();
  const msgObj = { user: HARDCODED_DM, text: botMsg, time: Date.now() };
  messages.push(msgObj);
  saveMessages(messages);
  addMessage(HARDCODED_DM, botMsg, msgObj.time);
}

// --- USERS ONLINE/OFFLINE ---
function getAllKnownUsers() {
  let users = new Set();
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith('dm_')) {
      const names = key.substring(3).split('_');
      names.forEach(n => users.add(n));
    }
  }
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith('dm_list_')) {
      const owner = key.substring(8);
      users.add(owner);
      try {
        const arr = JSON.parse(localStorage.getItem(key));
        arr.forEach(u => users.add(u));
      } catch {}
    }
  }
  users.delete(HARDCODED_DM);
  return Array.from(users);
}

function renderUserList() {
  const userList = document.getElementById('user-list');
  if (!userList) return;
  const all = getAllKnownUsers();
  userList.innerHTML = '';
  // Сначала online (только текущий), затем offline
  const users = [
    { nick: currentUser, online: true }
  ].concat(
    all.filter(u => u !== currentUser).map(nick => ({ nick, online: false }))
  );
  users.forEach(u => {
    const li = document.createElement('li');
    li.className = 'user-row' + (u.online ? ' online' : ' offline');
    // Аватар
    const avatar = document.createElement('div');
    avatar.className = 'user-avatar';
    avatar.textContent = u.nick[0] ? u.nick[0].toUpperCase() : '?';
    // Контекстное меню по ПКМ (на строку и на аватар)
    avatar.oncontextmenu = li.oncontextmenu = (e) => {
      e.preventDefault();
      showContextMenu(u.nick, e.pageX, e.pageY);
      return false;
    };
    // Ник
    const name = document.createElement('span');
    name.className = 'user-nick';
    name.textContent = u.nick;
    // Статус
    const status = document.createElement('span');
    status.className = 'user-status';
    status.textContent = u.online ? 'online' : 'offline';
    // "вы" пометка
    if (u.nick === currentUser) {
      const self = document.createElement('span');
      self.className = 'user-self';
      self.textContent = '(вы)';
      li.appendChild(avatar);
      li.appendChild(name);
      li.appendChild(self);
      li.appendChild(status);
    } else {
      li.appendChild(avatar);
      li.appendChild(name);
      li.appendChild(status);
    }
    // Клик — перейти в личку (не на себя, не на бота)
    if (u.nick !== currentUser && u.nick !== HARDCODED_DM) {
      li.onclick = () => setActiveChannel('dm', u.nick);
      avatar.onclick = () => setActiveChannel('dm', u.nick);
    }
    userList.appendChild(li);
  });
}


// --- Logout ---
document.getElementById('logout-btn').onclick = function() {
  localStorage.removeItem('discord_nick');
  currentUser = null;
  app.style.display = 'none';
  loginScreen.style.display = '';
  loginName.value = '';
};

// === Контекстное меню по аватарке ===

let contextMenuDiv = null;

function showContextMenu(user, x, y) {
  hideContextMenu();
  contextMenuDiv = document.createElement('div');
  contextMenuDiv.className = 'custom-context-menu';
  const btnChat = document.createElement('button');
  btnChat.textContent = 'Перейти в чат';
  btnChat.onclick = () => {
    hideContextMenu();
    if (user !== HARDCODED_DM) {
      let dmList = getDmList();
      if (!dmList.includes(user)) {
        dmList.push(user);
        saveDmList(dmList);
        renderDmList();
      }
      setActiveChannel('dm', user);
    }
  };
  contextMenuDiv.appendChild(btnChat);
  const divider = document.createElement('div');
  divider.className = 'divider';
  contextMenuDiv.appendChild(divider);
  const btnProfile = document.createElement('button');
  btnProfile.textContent = 'Открыть профиль';
  btnProfile.onclick = () => {
    hideContextMenu();
    showProfileModal(user);
  };
  contextMenuDiv.appendChild(btnProfile);
  contextMenuDiv.style.left = x + 'px';
  contextMenuDiv.style.top = y + 'px';
  document.body.appendChild(contextMenuDiv);
  setTimeout(() => {
    document.addEventListener('mousedown', onCtxClick, true);
    document.addEventListener('scroll', hideContextMenu, true);
    document.addEventListener('keydown', escCtxMenu, true);
  }, 0);
}

function hideContextMenu() {
  if (contextMenuDiv) {
    document.body.removeChild(contextMenuDiv);
    contextMenuDiv = null;
    document.removeEventListener('mousedown', onCtxClick, true);
    document.removeEventListener('scroll', hideContextMenu, true);
    document.removeEventListener('keydown', escCtxMenu, true);
  }
}
function onCtxClick(e) {
  if (contextMenuDiv && !contextMenuDiv.contains(e.target)) hideContextMenu();
}
function escCtxMenu(e) {
  if (e.key === "Escape") hideContextMenu();
}

// --- Модалка профиля ---
const profileModalBg = document.getElementById('profile-modal-bg');
const profileModal = document.getElementById('profile-modal');
if (profileModalBg) {
  profileModalBg.addEventListener('mousedown', function(e) {
    if (e.target === this) hideProfileModal();
  });
  profileModal.querySelector('.pm-close').onclick = hideProfileModal;
}
function showProfileModal(user) {
  if (!profileModalBg) return;
  profileModal.querySelector('.pm-avatar').textContent = user[0] ? user[0].toUpperCase() : '?';
  profileModal.querySelector('.pm-nick').textContent = user;
  profileModalBg.style.display = 'flex';
}
function hideProfileModal() {
  if (profileModalBg) profileModalBg.style.display = 'none';
}

// === Настройки для WebRTC голосового чата ===
const SIGNAL_SERVER = 'ws://localhost:3001'; // Замени на твой сервер, если не локалка
let wsSignal = null;
let rtcConnections = {};
let localStream = null;
let myRtcId = null;

// --- Войти в голосовой чат (WebRTC) ---
async function joinVoiceChat() {
  try {
    // Получаем аудио
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  } catch(e) {
    alert('Не удалось получить доступ к микрофону');
    return;
  }

  myRtcId = Math.random().toString(36).slice(2);
  wsSignal = new WebSocket(SIGNAL_SERVER);

  wsSignal.onopen = () => {
    wsSignal.send(JSON.stringify({ type: 'join', user: currentUser, rtcId: myRtcId }));
  };

  wsSignal.onmessage = async (event) => {
    const msg = JSON.parse(event.data);
    if (msg.rtcId === myRtcId) return;

    // JOIN — новый человек, инициируем соединение
    if (msg.type === 'join') {
      createOffer(msg.rtcId);
    }
    // OFFER
    if (msg.type === 'offer') {
      await createAnswer(msg.rtcId, msg.data);
    }
    // ANSWER
    if (msg.type === 'answer') {
      await rtcConnections[msg.rtcId].setRemoteDescription(new RTCSessionDescription(msg.data));
    }
    // ICE
    if (msg.type === 'ice') {
      await rtcConnections[msg.rtcId]?.addIceCandidate(new RTCIceCandidate(msg.data));
    }
  };

  wsSignal.onclose = leaveVoiceChat;
}

function createConnection(rtcId) {
  const conn = new RTCPeerConnection({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' }
    ]
  });

  // Локальный звук
  localStream.getTracks().forEach(track => conn.addTrack(track, localStream));

  conn.onicecandidate = (e) => {
    if (e.candidate && wsSignal && wsSignal.readyState === 1) {
      wsSignal.send(JSON.stringify({ type: 'ice', user: currentUser, rtcId: myRtcId, data: e.candidate }));
    }
  };

  conn.ontrack = (e) => {
    let audio = document.getElementById('audio_' + rtcId);
    if (!audio) {
      audio = document.createElement('audio');
      audio.id = 'audio_' + rtcId;
      audio.autoplay = true;
      audio.controls = false;
      document.body.appendChild(audio);
    }
    audio.srcObject = e.streams[0];
  };

  rtcConnections[rtcId] = conn;
  return conn;
}

async function createOffer(rtcId) {
  const conn = createConnection(rtcId);
  const offer = await conn.createOffer();
  await conn.setLocalDescription(offer);
  wsSignal.send(JSON.stringify({ type: 'offer', user: currentUser, rtcId: myRtcId, data: offer }));
}

async function createAnswer(rtcId, offer) {
  const conn = createConnection(rtcId);
  await conn.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await conn.createAnswer();
  await conn.setLocalDescription(answer);
  wsSignal.send(JSON.stringify({ type: 'answer', user: currentUser, rtcId: myRtcId, data: answer }));
}

function leaveVoiceChat() {
  if (wsSignal) try { wsSignal.close(); } catch{}
  wsSignal = null;
  Object.values(rtcConnections).forEach(conn => conn.close());
  rtcConnections = {};
  document.querySelectorAll('audio[id^="audio_"]').forEach(a => a.remove());
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
}

// --- Перехватываем клик по voiceToggle ---
voiceToggle.onclick = async function() {
  if (!inVoice) {
    await joinVoiceChat();
    // в updateVoicePanel() и локалсторедж ты уже добавляешь пользователя в список голосовых
    updateVoicePanel();
  } else {
    leaveVoiceChat();
    // убираем себя из голосового списка
    let users = getVoiceUsers().filter(u => u !== currentUser);
    setVoiceUsers(users);
    updateVoicePanel();
  }
};
