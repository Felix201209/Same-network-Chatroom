// ===== 全局变量 =====
let socket = null;
let currentUser = null;
let currentChat = null; // { type: 'private'|'room', id: odp/roomId, name: string }
let contacts = [];
let rooms = [];
let onlineUsers = []; // 在线用户列表
let chatMessages = {};
let typingTimeout = null;
let isRecording = false;
let mediaRecorder = null;
let audioChunks = [];
let recordingStartTime = null;
let replyingTo = null;
let avatarDataUrl = null;
let pendingFriendRequests = []; // 待处理的好友请求

// ===== Beta 0.1.0 性能优化 =====
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY_BASE = 1000;
let isConnected = false;
let pendingMessages = []; // 断线时缓存的消息
const processedMessageIds = new Set(); // 消息去重集合
let lastMessageTime = 0;
const MESSAGE_DEBOUNCE_MS = 150; // 发送消息防抖动

// ===== 游戏相关变量 =====
let currentGame = null;
let currentGameType = null;
let gameState = null;
let pendingGameInvite = null;
const GAME_NAMES = {
  gomoku: '五子棋',
  tictactoe: '井字棋',
  guess: '猜数字',
  rps: '石头剪刀布'
};

// ===== 表情列表 =====
const emojis = [
  '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😊',
  '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '🥲', '😋',
  '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐',
  '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '😮‍💨', '🤥',
  '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮',
  '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸', '😎',
  '🤓', '🧐', '😕', '😟', '🙁', '☹️', '😮', '😯', '😲', '😳',
  '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖',
  '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬',
  '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👋', '🙏',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
  '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '🔥', '✨'
];

// ===== 初始化 =====
document.addEventListener('DOMContentLoaded', async () => {
  // 先检查是否可以自动登录（127.0.0.1访问时自动登录SuperAdmin）
  await checkAutoLogin();
  
  initSocket();
  initEventListeners();
  initEmojiPanel();
  updateServerAddress();
});

// ===== 检查自动登录 =====
async function checkAutoLogin() {
  try {
    const res = await fetch('/api/auto-login');
    const data = await res.json();
    
    if (data.autoLogin && data.user) {
      console.log('[自动登录] 检测到本地访问，自动登录SuperAdmin');
      currentUser = data.user;
      localStorage.setItem('chatroom_user', JSON.stringify(currentUser));
      // 标记已自动登录
      window.autoLoggedIn = true;
    }
  } catch (e) {
    console.log('[自动登录] 检查失败:', e);
  }
}

// ===== Socket 初始化 (Beta 0.1.0 优化重连机制) =====
function initSocket() {
  socket = io({
    reconnection: true,
    reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
    reconnectionDelay: RECONNECT_DELAY_BASE,
    reconnectionDelayMax: 5000,
    timeout: 10000,
    transports: ['websocket', 'polling']
  });
  
  socket.on('connect', () => {
    console.log('已连接到服务器');
    isConnected = true;
    reconnectAttempts = 0;
    
    // 发送缓存的消息
    if (pendingMessages.length > 0) {
      console.log(`[重连] 发送 ${pendingMessages.length} 条缓存消息`);
      pendingMessages.forEach(msg => socket.emit(msg.event, msg.data));
      pendingMessages = [];
    }
    
    // 如果有保存的用户信息，尝试恢复会话
    const savedUser = localStorage.getItem('chatroom_user');
    
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        console.log('[自动恢复] 尝试恢复会话:', user.username);
        socket.emit('session:restore', { odp: user.odp, username: user.username });
        
        // 如果是自动登录，直接显示主界面
        if (window.autoLoggedIn) {
          showMainApp();
        }
      } catch (e) {
        console.log('[自动恢复] 解析用户信息失败');
        localStorage.removeItem('chatroom_user');
      }
    }
  });
  
  socket.on('disconnect', (reason) => {
    console.log('与服务器断开连接:', reason);
    isConnected = false;
    // 只在主应用界面显示断开提示
    if (currentUser) {
      if (reason === 'io server disconnect') {
        showToast('被服务器断开连接', 'error');
      } else {
        showToast('连接已断开，正在重连...', 'warning');
      }
    }
  });
  
  // Beta 0.1.0: 重连事件处理
  socket.on('reconnect_attempt', (attemptNumber) => {
    reconnectAttempts = attemptNumber;
    console.log(`[重连] 尝试第 ${attemptNumber} 次重连...`);
    if (attemptNumber > 3) {
      showToast(`正在重连 (第${attemptNumber}次)...`, 'warning');
    }
  });
  
  socket.on('reconnect', () => {
    console.log('[重连] 重连成功');
    showToast('已重新连接', 'success');
    // 重新加载数据
    if (currentUser) {
      socket.emit('users:getOnline');
      socket.emit('friends:get');
    }
  });
  
  socket.on('reconnect_failed', () => {
    console.log('[重连] 重连失败');
    showToast('无法连接服务器，请检查网络', 'error');
  });
  
  // 会话恢复成功
  socket.on('session:restored', (data) => {
    console.log('[会话恢复] 成功:', data.user.nickname);
    currentUser = data.user;
    localStorage.setItem('chatroom_user', JSON.stringify(currentUser));
    showMainApp();
  });
  
  // 会话恢复失败
  socket.on('session:fail', () => {
    console.log('[会话恢复] 失败，需要重新登录');
    localStorage.removeItem('chatroom_user');
    currentUser = null;
    // 只有当前不在登录页时才跳转
    const loginPage = document.getElementById('loginPage');
    if (!loginPage || !loginPage.classList.contains('active')) {
      showLoginPage();
    }
  });
  
  // 注册成功
  socket.on('register:success', (data) => {
    currentUser = data.user;
    localStorage.setItem('chatroom_user', JSON.stringify(currentUser));
    showMainApp();
    showToast('注册成功！', 'success');
  });
  
  // 注册失败
  socket.on('register:fail', (data) => {
    showToast(data.message || '注册失败', 'error');
  });
  
  // 登录成功
  socket.on('login:success', (data) => {
    currentUser = data.user;
    localStorage.setItem('chatroom_user', JSON.stringify(currentUser));
    showMainApp();
    showToast('登录成功！', 'success');
  });
  
  // 登录失败
  socket.on('login:fail', (data) => {
    showToast(data.message || '登录失败', 'error');
  });
  
  // 强制下线
  socket.on('force:logout', (data) => {
    showToast(data.message || '您已被强制下线', 'error');
    logout();
  });
  
  // 在线用户列表
  socket.on('users:list', (data) => {
    // 服务器直接发送数组
    const userList = Array.isArray(data) ? data : (data.users || []);
    // 更新在线用户列表
    onlineUsers = userList.map(u => ({ ...u, online: true }));
    // 更新contacts（合并在线用户）
    userList.forEach(u => {
      const existing = contacts.find(c => c.odp === u.odp);
      if (existing) {
        Object.assign(existing, u, { online: true });
      } else {
        contacts.push({ ...u, online: true });
      }
    });
    renderContacts();
    updateOnlineCount();
  });
  
  // 也监听 users:online (兼容)
  socket.on('users:online', (data) => {
    const userList = Array.isArray(data) ? data : (data.users || []);
    onlineUsers = userList.map(u => ({ ...u, online: true }));
    userList.forEach(u => {
      const existing = contacts.find(c => c.odp === u.odp);
      if (existing) {
        Object.assign(existing, u, { online: true });
      } else {
        contacts.push({ ...u, online: true });
      }
    });
    renderContacts();
    updateOnlineCount();
  });
  
  // 用户上线
  socket.on('user:online', (user) => {
    // 更新onlineUsers
    const existingOnline = onlineUsers.find(u => u.odp === user.odp);
    if (!existingOnline) {
      onlineUsers.push({ ...user, online: true });
    }
    
    const existing = contacts.find(c => c.odp === user.odp);
    if (!existing && user.odp !== currentUser?.odp) {
      contacts.push({ ...user, online: true });
      renderContacts();
      updateOnlineCount();
      showToast(`${user.nickname} 上线了`, 'info');
    } else if (existing) {
      existing.online = true;
      renderContacts();
      updateOnlineCount();
    }
  });
  
  // 用户下线
  socket.on('user:offline', (data) => {
    // 从onlineUsers移除
    onlineUsers = onlineUsers.filter(u => u.odp !== data.odp);
    
    const contact = contacts.find(c => c.odp === data.odp);
    if (contact) {
      contact.online = false;
      renderContacts();
      updateOnlineCount();
    }
  });
  
  // 收到私聊消息 (Beta 0.1.0 优化去重)
  socket.on('message:private', (msg) => {
    // 消息去重检查
    if (msg.id && processedMessageIds.has(msg.id)) {
      console.log('[去重] 跳过重复消息:', msg.id);
      return;
    }
    if (msg.id) {
      processedMessageIds.add(msg.id);
      // 限制集合大小，防止内存泄漏
      if (processedMessageIds.size > 1000) {
        const arr = Array.from(processedMessageIds);
        arr.splice(0, 500).forEach(id => processedMessageIds.delete(id));
      }
    }
    
    const senderId = msg.from || msg.senderId;
    const receiverId = msg.to || msg.receiverId;
    
    // 确定聊天对象的ID（如果我是发送者，对象是接收者；反之亦然）
    const chatPartnerId = senderId === currentUser.odp ? receiverId : senderId;
    
    // 存储消息
    if (!chatMessages[chatPartnerId]) chatMessages[chatPartnerId] = [];
    
    // 避免重复添加消息
    const exists = chatMessages[chatPartnerId].find(m => m.id === msg.id);
    if (!exists) {
      chatMessages[chatPartnerId].push(msg);
    }
    
    // 如果当前正在和这个人聊天，显示消息
    if (currentChat && currentChat.type === 'private' && currentChat.id === chatPartnerId) {
      if (!exists) {
        appendMessage(msg);
        scrollToBottom();
      }
    } else if (senderId !== currentUser.odp) {
      // 不是自己发的消息才显示通知
      showToast(`${msg.senderName}: ${getMessagePreview(msg)}`, 'info');
    }
    
    // 更新聊天列表
    updateChatList();
  });
  
  // 收到群聊消息
  socket.on('message:room', (msg) => {
    const roomId = msg.roomId;
    if (!chatMessages[roomId]) chatMessages[roomId] = [];
    chatMessages[roomId].push(msg);
    
    if (currentChat && currentChat.type === 'room' && currentChat.id === roomId) {
      appendMessage(msg);
      scrollToBottom();
    } else {
      showToast(`[${msg.roomName}] ${msg.senderName}: ${getMessagePreview(msg)}`, 'info');
    }
    
    updateChatList();
  });
  
  // 群聊列表
  socket.on('rooms:list', (data) => {
    rooms = data.rooms || [];
    updateGroupCount();
  });
  
  // 群聊创建成功
  socket.on('room:created', (room) => {
    rooms.push(room);
    updateGroupCount();
    showToast(`群聊 "${room.name}" 创建成功`, 'success');
    closeModal('createGroupModal');
  });
  
  // 加入群聊
  socket.on('room:joined', (room) => {
    if (!rooms.find(r => r.id === room.id)) {
      rooms.push(room);
      updateGroupCount();
    }
  });
  
  // 对方正在输入
  socket.on('user:typing', (data) => {
    if (currentChat && currentChat.type === 'private' && currentChat.id === data.from) {
      showTypingIndicator();
    }
  });
  
  // 历史消息
  socket.on('messages:history', (data) => {
    const chatId = data.chatId;
    chatMessages[chatId] = data.messages || [];
    if (currentChat && (currentChat.id === chatId || getChatId(currentUser.odp, currentChat.id) === chatId)) {
      renderMessages();
    }
  });
  
  // ===== 好友系统事件 =====
  socket.on('friend:requests', (requests) => {
    console.log('[好友请求] 收到请求列表:', requests.length, '条');
    pendingFriendRequests = requests;
    renderFriendRequests(requests);
    updateFriendRequestBadge();
  });
  
  socket.on('friend:newRequest', (request) => {
    console.log('[好友请求] 收到新请求:', request.senderInfo?.nickname);
    showToast(`${request.senderInfo?.nickname || '某人'} 请求添加你为好友`, 'info');
    // 刷新好友请求列表
    socket.emit('friend:getRequests');
  });
  
  socket.on('friend:added', (data) => {
    showToast(`你和 ${data.friendInfo.nickname} 已成为好友`, 'success');
    // 更新联系人列表
    const contact = contacts.find(c => c.odp === data.friendOdp);
    if (contact) {
      contact.isFriend = true;
    }
    renderContacts();
    // 刷新好友请求列表
    socket.emit('friend:getRequests');
  });
  
  socket.on('friend:removed', (data) => {
    const contact = contacts.find(c => c.odp === data.friendOdp);
    if (contact) {
      contact.isFriend = false;
    }
    renderContacts();
  });
  
  socket.on('friend:error', (data) => {
    showToast(data.message, 'error');
  });
  
  socket.on('friend:requestSent', () => {
    showToast('好友请求已发送', 'success');
  });
  
  socket.on('friends:list', (friendsList) => {
    // 更新联系人的好友状态，包括离线好友
    friendsList.forEach(friend => {
      const existingContact = contacts.find(c => c.odp === friend.odp);
      if (existingContact) {
        existingContact.isFriend = true;
        existingContact.online = friend.online;
      } else {
        // 离线好友也添加到联系人列表
        contacts.push({
          ...friend,
          isFriend: true
        });
      }
    });
    renderContacts();
  });
  
  // ===== 消息错误 =====
  socket.on('message:error', (data) => {
    if (data.type === 'mute' && data.detail) {
      // 显示禁言详情弹窗
      showMuteAlert(data.detail);
    } else {
      showToast(data.message, 'error');
    }
  });
  
  // ===== 用户被禁言 =====
  socket.on('user:muted', (data) => {
    showMuteAlert(data);
  });
  
  socket.on('user:unmuted', () => {
    showToast('禁言已解除', 'success');
    closeMuteAlert();
  });
  
  // ===== 角色变更 =====
  socket.on('user:roleChanged', (data) => {
    currentUser.role = data.role;
    currentUser.roleInfo = data.roleInfo;
    localStorage.setItem('chatroom_user', JSON.stringify(currentUser));
    showToast(`您的角色已变更为: ${data.roleInfo.badge || data.role}`, 'info');
    updateProfileDisplay();
  });
  
  // ===== 群聊管理 =====
  socket.on('room:kicked', (data) => {
    showToast(`您已被踢出群聊 "${data.roomName}"`, 'error');
    rooms = rooms.filter(r => r.id !== data.roomId);
    if (currentChat && currentChat.id === data.roomId) {
      closeChat();
    }
  });
  
  socket.on('room:updated', (room) => {
    const idx = rooms.findIndex(r => r.id === room.id);
    if (idx !== -1) {
      rooms[idx] = room;
    }
    // 如果正在查看这个群的设置，更新成员列表
    if (currentSettingsRoomId === room.id) {
      document.getElementById('roomNameInput').value = room.name || '';
      document.getElementById('memberCountBadge').textContent = `(${room.members.length}人)`;
      renderRoomMembers(room);
    }
    renderContacts();
  });
  
  socket.on('room:inviteSuccess', (data) => {
    showToast(`成功邀请 ${data.count} 人入群`, 'success');
  });
  
  socket.on('room:error', (data) => {
    showToast(data.message, 'error');
  });
  
  // ===== 朋友圈 =====
  socket.on('moments:list', (data) => {
    moments = data || [];
    renderMomentsList();
  });
  
  socket.on('moments:new', (moment) => {
    moments.unshift(moment);
    renderMomentsList();
  });
  
  socket.on('moments:updated', (updatedMoment) => {
    // Beta 0.1.0: 修复朋友圈评论不刷新问题
    const idx = moments.findIndex(m => m.id === updatedMoment.id);
    if (idx !== -1) {
      // 保留本地数据中可能存在的字段，合并更新
      moments[idx] = { ...moments[idx], ...updatedMoment };
      // 强制重新渲染
      requestAnimationFrame(() => {
        renderMomentsList();
      });
    } else {
      // 如果本地没有这条动态，添加到列表
      moments.unshift(updatedMoment);
      renderMomentsList();
    }
  });
  
  socket.on('moments:deleted', (data) => {
    moments = moments.filter(m => m.id !== data.momentId);
    renderMomentsList();
  });
  
  socket.on('moments:error', (data) => {
    showToast(data.message, 'error');
  });

  // ===== 游戏系统 socket 事件 =====
  // 收到游戏邀请
  socket.on('game:invited', (data) => {
    pendingGameInvite = data;
    
    const toast = document.getElementById('gameInviteToast');
    const avatarEl = document.getElementById('inviteAvatar');
    
    if (data.fromInfo?.avatar) {
      avatarEl.innerHTML = `<img src="${data.fromInfo.avatar}" alt="">`;
    } else {
      avatarEl.innerHTML = `<i class="fas fa-user"></i>`;
    }
    
    document.getElementById('inviteFrom').textContent = data.fromInfo?.nickname || '某人';
    document.getElementById('inviteGame').textContent = GAME_NAMES[data.gameType];
    
    toast.classList.add('active');
    
    // 10秒后自动关闭
    setTimeout(() => {
      if (pendingGameInvite && pendingGameInvite.gameId === data.gameId) {
        declineGameInvite();
      }
    }, 10000);
  });

  // 游戏开始
  socket.on('game:start', (data) => {
    currentGame = data.gameId;
    document.getElementById('gameStatus').textContent = '游戏中';
    document.getElementById('gameStatus').classList.add('playing');
    initGameContent(currentGameType);
  });

  // 收到对方的移动
  socket.on('game:move', (data) => {
    if (!gameState) return;
    handleGameMove(data);
  });

  // 对方离开游戏
  socket.on('game:left', () => {
    showToast('对方已离开游戏', 'warning');
    showGameResult('对方离开了游戏', true);
  });

  // 邀请被拒绝
  socket.on('game:declined', () => {
    showToast('对方拒绝了游戏邀请', 'info');
    closeGamePanel();
  });

  // ===== 戳一戳 =====
  socket.on('user:poked', (data) => {
    showPokeAnimation(data.from, data.fromNickname);
  });

  // ===== 消息反应 =====
  socket.on('message:reacted', (data) => {
    updateMessageReaction(data);
  });
}

// Beta 0.1.0: 修复戳一戳动画，提高浏览器兼容性
function showPokeAnimation(fromId, fromNickname) {
  // 移除旧的动画元素
  document.querySelectorAll('.poke-animation, .poke-toast').forEach(el => el.remove());
  
  // 创建戳一戳动画
  const pokeEl = document.createElement('div');
  pokeEl.className = 'poke-animation';
  pokeEl.textContent = '👆';
  pokeEl.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 80px;
    z-index: 9999;
    animation: pokeShake 0.5s ease-in-out;
    pointer-events: none;
  `;
  document.body.appendChild(pokeEl);
  
  // 创建提示
  const toastEl = document.createElement('div');
  toastEl.className = 'poke-toast';
  toastEl.textContent = `${fromNickname || '某人'} 戳了戳你！`;
  toastEl.style.cssText = `
    position: fixed;
    top: 60%;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0,0,0,0.8);
    color: white;
    padding: 12px 24px;
    border-radius: 24px;
    font-size: 16px;
    z-index: 9999;
    animation: fadeInUp 0.3s ease;
  `;
  document.body.appendChild(toastEl);
  
  // 震动效果（如果支持）
  try {
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100, 50, 100]);
    }
  } catch (e) {
    console.log('震动API不支持');
  }
  
  // 播放音效 (使用try-catch防止错误)
  try {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleVkbCitejcSdXjEcKnOt07RhGwk5gsGwdzgCL22k1bNjKB47WkabUSwdL25nh');
    audio.volume = 0.3;
    audio.play().catch(() => {});
  } catch (e) {
    console.log('音效播放失败');
  }
  
  // 3秒后移除
  setTimeout(() => {
    pokeEl.remove();
    toastEl.remove();
  }, 3000);
}

function updateMessageReaction(data) {
  const { messageId, reactions, roomId, recipientId } = data;
  
  // 更新本地消息数据
  let messages;
  if (roomId) {
    messages = roomMessages[roomId] || [];
  } else if (recipientId) {
    // 私聊消息可能在两个key下
    messages = privateMessages[recipientId] || privateMessages[data.senderId] || [];
  }
  
  const msgIdx = messages?.findIndex(m => m.id === messageId);
  if (msgIdx !== -1 && messages) {
    messages[msgIdx].reactions = reactions;
    
    // 如果正在查看这个聊天，重新渲染
    if (currentChat) {
      if ((roomId && currentChat.id === roomId) || 
          (recipientId && (currentChat.id === recipientId || currentChat.id === data.senderId))) {
        renderMessages();
      }
    }
  }
}

// ===== 事件监听器初始化 =====
function initEventListeners() {
  // 登录/注册表单切换
  document.getElementById('showRegisterForm')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'block';
  });
  
  document.getElementById('showLoginForm')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('loginForm').style.display = 'block';
  });
  
  // 登录按钮
  document.getElementById('loginBtn')?.addEventListener('click', login);
  
  // 注册按钮
  document.getElementById('registerBtn')?.addEventListener('click', register);
  
  // 回车登录
  document.getElementById('loginPassword')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') login();
  });
  
  document.getElementById('registerConfirmPassword')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') register();
  });
  
  // 头像上传
  document.getElementById('avatarInput')?.addEventListener('change', handleAvatarUpload);
  
  // 导航切换
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => switchTab(item.dataset.tab));
  });
  
  // 搜索
  document.getElementById('searchBtn')?.addEventListener('click', toggleSearch);
  document.getElementById('searchCancel')?.addEventListener('click', toggleSearch);
  document.getElementById('searchInput')?.addEventListener('input', handleSearch);
  
  // 添加聊天
  document.getElementById('addChatBtn')?.addEventListener('click', showAddChatMenu);
  
  // 创建群聊
  document.getElementById('newGroupBtn')?.addEventListener('click', () => openModal('createGroupModal'));
  document.getElementById('closeGroupModal')?.addEventListener('click', () => closeModal('createGroupModal'));
  document.getElementById('cancelGroupBtn')?.addEventListener('click', () => closeModal('createGroupModal'));
  document.getElementById('confirmGroupBtn')?.addEventListener('click', createGroup);
  
  // 群聊列表
  document.getElementById('groupChatsBtn')?.addEventListener('click', showGroupList);
  
  // 聊天窗口
  document.getElementById('backBtn')?.addEventListener('click', closeChat);
  document.getElementById('sendBtn')?.addEventListener('click', sendMessage);
  document.getElementById('messageInput')?.addEventListener('keydown', handleMessageKeydown);
  document.getElementById('messageInput')?.addEventListener('input', handleTyping);
  document.getElementById('chatMenuBtn')?.addEventListener('click', openChatMenu);
  
  // 表情面板
  document.getElementById('emojiBtn')?.addEventListener('click', toggleEmojiPanel);
  
  // 附件面板
  document.getElementById('attachBtn')?.addEventListener('click', toggleAttachPanel);
  document.getElementById('attachImage')?.addEventListener('click', () => document.getElementById('imageInput').click());
  document.getElementById('attachVideo')?.addEventListener('click', () => document.getElementById('videoInput').click());
  document.getElementById('attachFile')?.addEventListener('click', () => document.getElementById('fileInput').click());
  document.getElementById('attachCamera')?.addEventListener('click', () => document.getElementById('cameraInput').click());
  document.getElementById('attachVoice')?.addEventListener('click', showVoiceRecordingTip);
  
  // 文件上传
  document.getElementById('imageInput')?.addEventListener('change', (e) => uploadFile(e, 'image'));
  document.getElementById('videoInput')?.addEventListener('change', (e) => uploadFile(e, 'video'));
  document.getElementById('fileInput')?.addEventListener('change', (e) => uploadFile(e, 'file'));
  document.getElementById('cameraInput')?.addEventListener('change', (e) => uploadFile(e, 'image'));
  
  // 语音录制（按住说话）
  const voiceBtn = document.getElementById('voiceBtn');
  if (voiceBtn) {
    voiceBtn.addEventListener('mousedown', startRecording);
    voiceBtn.addEventListener('mouseup', stopRecording);
    voiceBtn.addEventListener('mouseleave', cancelRecording);
    voiceBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      startRecording(e);
    });
    voiceBtn.addEventListener('touchend', stopRecording);
    voiceBtn.addEventListener('touchcancel', cancelRecording);
  }
  
  // 语音录制旧方式（兼容）
  document.getElementById('voiceBtn')?.addEventListener('mousedown', startRecording);
  document.getElementById('voiceBtn')?.addEventListener('mouseup', stopRecording);
  document.getElementById('voiceBtn')?.addEventListener('mouseleave', cancelRecording);
  document.getElementById('voiceBtn')?.addEventListener('touchstart', startRecording);
  document.getElementById('voiceBtn')?.addEventListener('touchend', stopRecording);
  
  // 图片预览
  document.getElementById('closePreview')?.addEventListener('click', closeImagePreview);
  document.getElementById('imagePreviewModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'imagePreviewModal') closeImagePreview();
  });
  
  // 回复取消
  document.getElementById('replyCancelBtn')?.addEventListener('click', cancelReply);
  
  // 主题切换
  document.getElementById('darkModeToggle')?.addEventListener('change', toggleDarkMode);
  
  // 发现页功能
  document.getElementById('momentsBtn')?.addEventListener('click', openMoments);
  document.getElementById('onlineUsersBtn')?.addEventListener('click', openOnlineUsers);
  document.getElementById('broadcastBtn')?.addEventListener('click', openBroadcast);
  document.getElementById('helpBtn')?.addEventListener('click', openHelp);
  
  // 朋友圈相关
  document.getElementById('postMomentBtn')?.addEventListener('click', () => openModal('postMomentModal'));
  document.getElementById('submitMomentBtn')?.addEventListener('click', submitMoment);
  document.getElementById('addMomentImage')?.addEventListener('click', () => document.getElementById('momentImageInput').click());
  document.getElementById('momentImageInput')?.addEventListener('change', handleMomentImages);
  
  // 个人页功能
  document.getElementById('editProfileBtn')?.addEventListener('click', openEditProfile);
  document.getElementById('settingsBtn')?.addEventListener('click', () => openModal('settingsModal'));
  document.getElementById('aboutBtn')?.addEventListener('click', () => openModal('aboutModal'));
  document.getElementById('saveProfileBtn')?.addEventListener('click', saveProfile);
  document.getElementById('changeAvatarBtn')?.addEventListener('click', () => document.getElementById('editAvatarInput').click());
  document.getElementById('editAvatarInput')?.addEventListener('change', handleEditAvatar);
  
  // 设置页功能
  document.getElementById('logoutBtn')?.addEventListener('click', logout);
  document.getElementById('changePasswordBtn')?.addEventListener('click', () => openModal('changePasswordModal'));
  document.getElementById('submitPasswordBtn')?.addEventListener('click', changePassword);
  document.getElementById('clearCacheBtn')?.addEventListener('click', clearCache);
  
  // 点击空白处关闭面板
  document.addEventListener('click', (e) => {
    const emojiPanel = document.getElementById('emojiPanel');
    const attachPanel = document.getElementById('attachPanel');
    const emojiBtn = document.getElementById('emojiBtn');
    const attachBtn = document.getElementById('attachBtn');
    
    if (emojiPanel?.classList.contains('active') && 
        !emojiPanel.contains(e.target) && 
        !emojiBtn?.contains(e.target)) {
      emojiPanel.classList.remove('active');
    }
    
    if (attachPanel?.classList.contains('active') && 
        !attachPanel.contains(e.target) && 
        !attachBtn?.contains(e.target)) {
      attachPanel.classList.remove('active');
    }
  });
}

// ===== 登录 =====
function login() {
  const username = document.getElementById('loginUsername')?.value.trim();
  const password = document.getElementById('loginPassword')?.value;
  
  if (!username || !password) {
    showToast('请输入用户名和密码', 'error');
    return;
  }
  
  socket.emit('user:login', { username, password });
}

// ===== 密码验证 =====
function validatePassword(password) {
  if (password.length < 6) {
    return { valid: false, message: '密码至少需要6个字符' };
  }
  if (!/[a-zA-Z]/.test(password)) {
    return { valid: false, message: '密码需要包含至少一个字母' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: '密码需要包含至少一个数字' };
  }
  return { valid: true };
}

// ===== 用户名验证 =====
function validateUsername(username) {
  if (username.length < 3 || username.length > 20) {
    return { valid: false, message: '用户名需要3-20个字符' };
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return { valid: false, message: '用户名只能包含字母、数字和下划线' };
  }
  return { valid: true };
}

// ===== 注册 =====
function register() {
  const username = document.getElementById('registerUsername')?.value.trim();
  const nickname = document.getElementById('registerNickname')?.value.trim();
  const password = document.getElementById('registerPassword')?.value;
  const confirmPassword = document.getElementById('registerConfirmPassword')?.value;
  const signature = document.getElementById('registerSignature')?.value.trim();
  
  if (!username || !nickname || !password) {
    showToast('请填写用户名、昵称和密码', 'error');
    return;
  }
  
  // 验证用户名
  const usernameCheck = validateUsername(username);
  if (!usernameCheck.valid) {
    showToast(usernameCheck.message, 'error');
    return;
  }
  
  // 验证密码
  const passwordCheck = validatePassword(password);
  if (!passwordCheck.valid) {
    showToast(passwordCheck.message, 'error');
    // 高亮密码提示
    const hint = document.getElementById('passwordHint');
    if (hint) {
      hint.style.color = '#E74C3C';
      setTimeout(() => hint.style.color = '', 3000);
    }
    return;
  }
  
  if (password !== confirmPassword) {
    showToast('两次输入的密码不一致', 'error');
    return;
  }
  
  socket.emit('user:register', {
    username,
    nickname,
    password,
    signature,
    avatar: avatarDataUrl || ''
  });
}

// ===== 登出 =====
function logout() {
  closeModal('settingsModal');
  currentUser = null;
  currentChat = null;
  contacts = [];
  rooms = [];
  chatMessages = {};;
  localStorage.removeItem('chatroom_user');
  
  document.getElementById('loginPage').classList.add('active');
  document.getElementById('mainApp').classList.remove('active');
  
  // 清空表单
  document.getElementById('loginUsername').value = '';
  document.getElementById('loginPassword').value = '';
}

// ===== 显示登录页面 =====
function showLoginPage() {
  document.getElementById('mainApp').classList.remove('active');
  document.getElementById('loginPage').classList.add('active');
  
  // 清空表单
  document.getElementById('loginUsername').value = '';
  document.getElementById('loginPassword').value = '';
  document.getElementById('registerUsername').value = '';
  document.getElementById('registerPassword').value = '';
  document.getElementById('registerConfirmPassword').value = '';
  document.getElementById('registerNickname').value = '';
  document.getElementById('registerSignature').value = '';
  
  // 显示登录表单
  document.getElementById('loginForm').style.display = 'block';
  document.getElementById('registerForm').style.display = 'none';
}

// ===== 显示主应用 =====
function showMainApp() {
  document.getElementById('loginPage').classList.remove('active');
  document.getElementById('mainApp').classList.add('active');
  
  // 更新个人信息显示
  updateProfileDisplay();
  
  // 请求在线用户和好友列表
  socket.emit('users:getOnline');
  socket.emit('friends:get');
}

// ===== 更新个人资料显示 =====
function updateProfileDisplay() {
  if (!currentUser) return;
  
  document.getElementById('myNickname').textContent = currentUser.nickname;
  document.getElementById('mySignature').textContent = currentUser.signature || '这个人很懒，什么都没写';
  document.getElementById('myUserId').textContent = currentUser.odp?.substring(0, 8) || '--';
  
  const avatarEl = document.getElementById('myAvatar');
  if (currentUser.avatar) {
    avatarEl.innerHTML = `<img src="${currentUser.avatar}" alt="头像">`;
  }
}

// ===== 头像上传处理 =====
function handleAvatarUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  if (!file.type.startsWith('image/')) {
    showToast('请选择图片文件', 'error');
    return;
  }
  
  if (file.size > 2 * 1024 * 1024) {
    showToast('图片大小不能超过2MB', 'error');
    return;
  }
  
  const reader = new FileReader();
  reader.onload = (event) => {
    avatarDataUrl = event.target.result;
    const preview = document.getElementById('avatarPreview');
    preview.innerHTML = `<img src="${avatarDataUrl}" alt="头像">`;
  };
  reader.readAsDataURL(file);
}

// ===== 更新服务器地址显示 =====
function updateServerAddress() {
  fetch('/api/server-info')
    .then(res => res.json())
    .then(data => {
      const address = `${data.ip}:${data.port}`;
      document.getElementById('serverAddress').textContent = address;
      const lanAddress = document.getElementById('lanAddress');
      if (lanAddress) lanAddress.textContent = address;
    })
    .catch(() => {
      document.getElementById('serverAddress').textContent = window.location.host;
    });
}

// ===== 切换标签页 =====
function switchTab(tabName) {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.tab === tabName);
  });
  
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `${tabName}Tab`);
  });
}

// ===== 渲染联系人列表 =====
function renderContacts() {
  const container = document.getElementById('contactList');
  if (!container) return;
  
  // 过滤掉自己
  const filteredContacts = contacts.filter(c => c.odp !== currentUser?.odp);
  
  if (filteredContacts.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-users"></i>
        <p>暂无联系人</p>
        <span>等待其他用户上线</span>
      </div>
    `;
    return;
  }
  
  container.innerHTML = filteredContacts.map(contact => {
    const roleInfo = contact.roleInfo || {};
    const badge = roleInfo.badge || '';
    const badgeColor = roleInfo.color || '#666';
    
    return `
      <div class="contact-item" data-odp="${contact.odp}" onclick="openPrivateChat('${contact.odp}')">
        <div class="contact-avatar ${contact.online ? 'online' : ''}">
          ${contact.avatar ? `<img src="${contact.avatar}" alt="${contact.nickname}">` : `<i class="fas fa-user"></i>`}
          <span class="status-dot ${contact.online ? 'online' : 'offline'}"></span>
        </div>
        <div class="contact-info">
          <div class="contact-name-row">
            <h3>${escapeHtml(contact.nickname)}</h3>
            ${badge ? `<span class="role-badge" style="background: ${badgeColor}; color: #fff;">${badge}</span>` : ''}
            ${contact.isFriend ? `<span class="friend-badge"><i class="fas fa-user-check"></i></span>` : ''}
          </div>
          <p>${escapeHtml(contact.signature || '暂无签名')}</p>
        </div>
        ${!contact.isFriend ? `
        <button class="add-friend-btn" onclick="event.stopPropagation(); sendFriendRequest('${contact.odp}')" title="添加好友">
          <i class="fas fa-user-plus"></i> 加好友
        </button>
        ` : ''}
      </div>
    `;
  }).join('');
}

// ===== 更新在线人数 =====
function updateOnlineCount() {
  const onlineCount = contacts.filter(c => c.online && c.odp !== currentUser?.odp).length;
  const countEl = document.getElementById('onlineCount');
  if (countEl) countEl.textContent = onlineCount;
}

// ===== 更新群聊数量 =====
function updateGroupCount() {
  const countEl = document.getElementById('groupCount');
  if (countEl) countEl.textContent = rooms.length;
}

// ===== 打开私聊 =====
function openPrivateChat(odp) {
  const contact = contacts.find(c => c.odp === odp);
  if (!contact) {
    showToast('联系人不存在', 'error');
    return;
  }
  
  currentChat = {
    type: 'private',
    id: odp,
    name: contact.nickname,
    avatar: contact.avatar,
    online: contact.online
  };
  
  // 请求历史消息
  socket.emit('messages:get', {
    type: 'private',
    targetId: odp
  });
  
  showChatWindow();
}

// ===== 打开群聊 =====
function openRoomChat(roomId) {
  const room = rooms.find(r => r.id === roomId);
  if (!room) {
    showToast('群聊不存在', 'error');
    return;
  }
  
  currentChat = {
    type: 'room',
    id: roomId,
    name: room.name
  };
  
  // 请求历史消息
  socket.emit('messages:get', {
    type: 'room',
    targetId: roomId
  });
  
  showChatWindow();
}

// ===== 显示聊天窗口 =====
function showChatWindow() {
  const chatWindow = document.getElementById('chatWindow');
  chatWindow.classList.add('active');
  
  document.getElementById('chatTitle').textContent = currentChat.name;
  
  const statusEl = document.getElementById('chatStatus');
  if (currentChat.type === 'private') {
    statusEl.textContent = currentChat.online ? '在线' : '离线';
    statusEl.className = `chat-status ${currentChat.online ? 'online' : 'offline'}`;
  } else {
    const room = rooms.find(r => r.id === currentChat.id);
    statusEl.textContent = room ? `${room.members?.length || 0}人` : '';
    statusEl.className = 'chat-status';
  }
  
  renderMessages();
}

// ===== 关闭聊天窗口 =====
function closeChat() {
  const chatWindow = document.getElementById('chatWindow');
  chatWindow.classList.remove('active');
  currentChat = null;
  
  // 关闭面板
  document.getElementById('emojiPanel')?.classList.remove('active');
  document.getElementById('attachPanel')?.classList.remove('active');
}

// ===== 渲染消息列表 =====
function renderMessages() {
  const container = document.getElementById('messagesList');
  if (!container || !currentChat) return;
  
  const chatId = currentChat.type === 'private' 
    ? getChatId(currentUser.odp, currentChat.id)
    : currentChat.id;
  
  const messages = chatMessages[chatId] || chatMessages[currentChat.id] || [];
  
  if (messages.length === 0) {
    container.innerHTML = `
      <div class="messages-empty">
        <p>暂无消息，发送第一条消息吧</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = messages.map(msg => createMessageHTML(msg)).join('');
  scrollToBottom();
}

// ===== 追加消息 =====
function appendMessage(msg) {
  const container = document.getElementById('messagesList');
  if (!container) return;
  
  // 移除空状态
  const emptyState = container.querySelector('.messages-empty');
  if (emptyState) emptyState.remove();
  
  container.insertAdjacentHTML('beforeend', createMessageHTML(msg));
}

// ===== 创建消息HTML =====
function createMessageHTML(msg) {
  const senderId = msg.from || msg.senderId;
  const isMine = senderId === currentUser.odp;
  const time = formatTime(msg.timestamp);
  
  let contentHTML = '';
  switch (msg.type) {
    case 'text':
      contentHTML = `<p class="message-text">${escapeHtml(msg.content).replace(/\n/g, '<br>')}</p>`;
      break;
    case 'image':
      contentHTML = `<img class="message-image" src="${msg.content}" onclick="showImagePreview('${msg.content}')" alt="图片">`;
      break;
    case 'video':
      contentHTML = `<video class="message-video" src="${msg.content}" controls></video>`;
      break;
    case 'file':
      contentHTML = `
        <a class="message-file" href="${msg.content}" download="${msg.fileName || msg.filename || '文件'}">
          <i class="fas fa-file"></i>
          <span>${escapeHtml(msg.fileName || msg.filename || '文件')}</span>
        </a>
      `;
      break;
    case 'voice':
      contentHTML = `
        <div class="message-voice" onclick="playVoice(this, '${msg.content}')">
          <i class="fas fa-play"></i>
          <span>${msg.duration || '0'}s</span>
        </div>
      `;
      break;
    default:
      contentHTML = `<p class="message-text">${escapeHtml(msg.content)}</p>`;
  }
  
  // 获取角色信息
  const roleInfo = msg.senderRoleInfo || {};
  const roleBadge = roleInfo.badge || '';
  const roleColor = roleInfo.color || '#666';
  const showBadge = roleBadge && msg.senderRole !== 'USER';
  
  return `
    <div class="message ${isMine ? 'mine' : 'other'}" data-id="${msg.id}" oncontextmenu="showMessageMenu(event, '${msg.id}')">
      ${!isMine ? `
        <div class="message-avatar">
          ${msg.senderAvatar ? `<img src="${msg.senderAvatar}" alt="">` : `<i class="fas fa-user"></i>`}
        </div>
      ` : ''}
      <div class="message-content">
        ${!isMine ? `
          <div class="message-header">
            <span class="message-sender">${escapeHtml(msg.senderName)}</span>
            ${showBadge ? `<span class="role-badge" style="background: ${roleColor}; color: #fff;">${roleBadge}</span>` : ''}
          </div>
        ` : ''}
        ${isMine && showBadge ? `
          <div class="message-header mine">
            ${showBadge ? `<span class="role-badge" style="background: ${roleColor}; color: #fff;">${roleBadge}</span>` : ''}
          </div>
        ` : ''}
        ${msg.replyTo ? `
          <div class="message-reply">
            <span>回复 ${escapeHtml(msg.replyTo.senderName)}</span>
            <p>${escapeHtml(getMessagePreview(msg.replyTo))}</p>
          </div>
        ` : ''}
        ${contentHTML}
        ${msg.reactions && Object.keys(msg.reactions).length > 0 ? `
          <div class="message-reactions">
            ${Object.entries(msg.reactions).map(([emoji, users]) => `
              <span class="reaction ${users.includes(currentUser.odp) ? 'mine' : ''}" onclick="toggleReaction('${msg.id}', '${emoji}')">${emoji} ${users.length}</span>
            `).join('')}
          </div>
        ` : ''}
        <span class="message-time">${time}</span>
      </div>
      ${isMine ? `
        <div class="message-avatar">
          ${currentUser.avatar ? `<img src="${currentUser.avatar}" alt="">` : `<i class="fas fa-user"></i>`}
        </div>
      ` : ''}
    </div>
  `;
}

// ===== 发送消息 (Beta 0.1.0 优化防抖动和断线缓存) =====
function sendMessage() {
  const input = document.getElementById('messageInput');
  const content = input.textContent.trim();
  
  if (!content || !currentChat) return;
  
  // 防抖动检查
  const now = Date.now();
  if (now - lastMessageTime < MESSAGE_DEBOUNCE_MS) {
    console.log('[防抖] 发送过快，跳过');
    return;
  }
  lastMessageTime = now;
  
  const msg = {
    type: 'text',
    content: content,
    replyTo: replyingTo
  };
  
  const eventName = currentChat.type === 'private' ? 'message:private' : 'message:room';
  const eventData = currentChat.type === 'private' 
    ? { to: currentChat.id, ...msg }
    : { roomId: currentChat.id, ...msg };
  
  // 如果断线，缓存消息
  if (!isConnected) {
    pendingMessages.push({ event: eventName, data: eventData });
    showToast('网络断开，消息将在重连后发送', 'warning');
  } else {
    socket.emit(eventName, eventData);
  }
  
  // 清空输入
  input.textContent = '';
  cancelReply();
  
  // 关闭面板
  document.getElementById('emojiPanel')?.classList.remove('active');
  document.getElementById('attachPanel')?.classList.remove('active');
}

// ===== 处理消息输入按键 =====
function handleMessageKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

// ===== 处理输入状态 =====
function handleTyping() {
  if (currentChat?.type === 'private') {
    socket.emit('user:typing', { to: currentChat.id });
  }
}

// ===== 显示正在输入提示 =====
function showTypingIndicator() {
  const indicator = document.getElementById('typingIndicator');
  if (indicator) {
    indicator.classList.add('active');
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      indicator.classList.remove('active');
    }, 3000);
  }
}

// ===== 初始化表情面板 =====
function initEmojiPanel() {
  const grid = document.getElementById('emojiGrid');
  if (!grid) return;
  
  grid.innerHTML = emojis.map(emoji => `
    <span class="emoji-item" onclick="insertEmoji('${emoji}')">${emoji}</span>
  `).join('');
}

// ===== 切换表情面板 =====
function toggleEmojiPanel() {
  const panel = document.getElementById('emojiPanel');
  const attachPanel = document.getElementById('attachPanel');
  
  attachPanel?.classList.remove('active');
  panel?.classList.toggle('active');
}

// ===== 切换附件面板 =====
function toggleAttachPanel() {
  const panel = document.getElementById('attachPanel');
  const emojiPanel = document.getElementById('emojiPanel');
  
  emojiPanel?.classList.remove('active');
  panel?.classList.toggle('active');
}

// ===== 插入表情 =====
function insertEmoji(emoji) {
  const input = document.getElementById('messageInput');
  input.textContent += emoji;
  input.focus();
}

// ===== 上传文件 =====
function uploadFile(e, type) {
  const file = e.target.files[0];
  if (!file) return;
  
  const maxSize = type === 'video' ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
  if (file.size > maxSize) {
    showToast(`文件大小不能超过${type === 'video' ? '100MB' : '10MB'}`, 'error');
    return;
  }
  
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', type);
  
  showToast('正在上传...', 'info');
  
  fetch('/api/upload', {
    method: 'POST',
    body: formData
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        const msg = {
          type: type,
          content: data.url,
          fileName: file.name
        };
        
        if (currentChat.type === 'private') {
          socket.emit('message:private', { to: currentChat.id, ...msg });
        } else {
          socket.emit('message:room', { roomId: currentChat.id, ...msg });
        }
        
        showToast('发送成功', 'success');
      } else {
        showToast('上传失败', 'error');
      }
    })
    .catch(() => {
      showToast('上传失败', 'error');
    });
  
  e.target.value = '';
  document.getElementById('attachPanel')?.classList.remove('active');
}

// ===== 语音录制提示 =====
function showVoiceRecordingTip() {
  showToast('请长按底部语音按钮录制', 'info');
  document.getElementById('attachPanel')?.classList.remove('active');
}

// ===== 语音录制 =====
async function startRecording(e) {
  e.preventDefault();
  
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    
    mediaRecorder.ondataavailable = (event) => {
      audioChunks.push(event.data);
    };
    
    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      sendVoiceMessage(audioBlob);
      stream.getTracks().forEach(track => track.stop());
    };
    
    mediaRecorder.start();
    isRecording = true;
    recordingStartTime = Date.now();
    
    document.getElementById('voiceRecording')?.classList.add('active');
    updateRecordingTime();
  } catch (err) {
    showToast('无法访问麦克风', 'error');
  }
}

function stopRecording(e) {
  e.preventDefault();
  
  if (mediaRecorder && isRecording) {
    mediaRecorder.stop();
    isRecording = false;
    document.getElementById('voiceRecording')?.classList.remove('active');
  }
}

function cancelRecording(e) {
  if (mediaRecorder && isRecording) {
    mediaRecorder.stop();
    isRecording = false;
    audioChunks = [];
    document.getElementById('voiceRecording')?.classList.remove('active');
  }
}

function updateRecordingTime() {
  if (!isRecording) return;
  
  const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
  const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
  const seconds = (elapsed % 60).toString().padStart(2, '0');
  
  const timeEl = document.getElementById('recordingTime');
  if (timeEl) timeEl.textContent = `${minutes}:${seconds}`;
  
  if (elapsed < 60) {
    requestAnimationFrame(updateRecordingTime);
  } else {
    stopRecording({ preventDefault: () => {} });
  }
}

function sendVoiceMessage(blob) {
  const formData = new FormData();
  formData.append('file', blob, 'voice.webm');
  formData.append('type', 'voice');
  
  const duration = Math.floor((Date.now() - recordingStartTime) / 1000);
  
  fetch('/api/upload', {
    method: 'POST',
    body: formData
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        const msg = {
          type: 'voice',
          content: data.url,
          duration: duration
        };
        
        if (currentChat.type === 'private') {
          socket.emit('message:private', { to: currentChat.id, ...msg });
        } else {
          socket.emit('message:room', { roomId: currentChat.id, ...msg });
        }
      }
    });
}

// ===== 播放语音 =====
function playVoice(element, src) {
  const audio = new Audio(src);
  const icon = element.querySelector('i');
  
  icon.className = 'fas fa-pause';
  audio.play();
  
  audio.onended = () => {
    icon.className = 'fas fa-play';
  };
}

// ===== 创建群聊 =====
function createGroup() {
  const name = document.getElementById('groupNameInput')?.value.trim();
  const desc = document.getElementById('groupDescInput')?.value.trim();
  
  if (!name) {
    showToast('请输入群聊名称', 'error');
    return;
  }
  
  const selectedMembers = Array.from(document.querySelectorAll('.member-checkbox:checked'))
    .map(cb => cb.value);
  
  socket.emit('room:create', {
    name,
    description: desc,
    members: selectedMembers
  });
}

// ===== 显示群聊列表 =====
function showGroupList() {
  if (rooms.length === 0) {
    showToast('暂无群聊', 'info');
    return;
  }
  
  // 创建一个简单的群聊列表模态框
  const html = `
    <div class="modal active" id="groupListModal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>群聊列表</h2>
          <button class="modal-close" onclick="closeModal('groupListModal')">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <div class="group-list">
            ${rooms.map(room => `
              <div class="contact-item" onclick="closeModal('groupListModal'); openRoomChat('${room.id}')">
                <div class="contact-avatar">
                  <i class="fas fa-users"></i>
                </div>
                <div class="contact-info">
                  <h3>${escapeHtml(room.name)}</h3>
                  <p>${room.members?.length || 0}人</p>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', html);
}

// ===== 打开模态框 =====
function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  
  modal.classList.add('active');
  
  // 如果是创建群聊模态框，填充成员列表
  if (id === 'createGroupModal') {
    const memberSelect = document.getElementById('memberSelect');
    if (memberSelect) {
      const filteredContacts = contacts.filter(c => c.odp !== currentUser?.odp);
      memberSelect.innerHTML = filteredContacts.map(contact => `
        <label class="member-item">
          <input type="checkbox" class="member-checkbox" value="${contact.odp}">
          <div class="member-avatar">
            ${contact.avatar ? `<img src="${contact.avatar}" alt="">` : `<i class="fas fa-user"></i>`}
          </div>
          <span>${escapeHtml(contact.nickname)}</span>
        </label>
      `).join('') || '<p>暂无可添加的联系人</p>';
    }
  }
}

// ===== 关闭模态框 =====
function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove('active');
    // 如果是临时创建的模态框，移除它
    if (id === 'groupListModal') {
      modal.remove();
    }
  }
}

// ===== 图片预览 =====
function showImagePreview(src) {
  const modal = document.getElementById('imagePreviewModal');
  const img = document.getElementById('previewImage');
  if (modal && img) {
    img.src = src;
    modal.classList.add('active');
  }
}

function closeImagePreview() {
  const modal = document.getElementById('imagePreviewModal');
  if (modal) modal.classList.remove('active');
}

// ===== 消息右键菜单 =====
let currentMenuMessageId = null;

function showMessageMenu(event, messageId) {
  event.preventDefault();
  event.stopPropagation();
  
  currentMenuMessageId = messageId;
  
  // 查找消息
  const messages = currentChat.type === 'private' 
    ? (privateMessages[currentChat.id] || [])
    : (roomMessages[currentChat.id] || []);
  const msg = messages.find(m => m.id === messageId);
  
  if (!msg) return;
  
  // 创建或获取菜单
  let menu = document.getElementById('messageContextMenu');
  if (!menu) {
    menu = document.createElement('div');
    menu.id = 'messageContextMenu';
    menu.className = 'context-menu';
    menu.innerHTML = `
      <div class="context-menu-reactions">
        <span onclick="reactToMessage('👍')">👍</span>
        <span onclick="reactToMessage('❤️')">❤️</span>
        <span onclick="reactToMessage('😂')">😂</span>
        <span onclick="reactToMessage('😮')">😮</span>
        <span onclick="reactToMessage('😢')">😢</span>
        <span onclick="reactToMessage('🔥')">🔥</span>
      </div>
      <div class="context-menu-item" onclick="replyToMessage()">
        <span class="icon">↩️</span> 回复
      </div>
      <div class="context-menu-item" onclick="copyMessageContent()">
        <span class="icon">📋</span> 复制
      </div>
      <div class="context-menu-item delete-item" onclick="deleteMessage()">
        <span class="icon">🗑️</span> 删除
      </div>
    `;
    document.body.appendChild(menu);
  }
  
  // 显示/隐藏删除选项（只有自己的消息可以删除）
  const deleteItem = menu.querySelector('.delete-item');
  if (deleteItem) {
    deleteItem.style.display = (msg.senderId === currentUser.id) ? 'flex' : 'none';
  }
  
  // 定位菜单
  const x = event.clientX;
  const y = event.clientY;
  
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  menu.classList.add('active');
  
  // 确保菜单不超出屏幕
  setTimeout(() => {
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      menu.style.left = (window.innerWidth - rect.width - 10) + 'px';
    }
    if (rect.bottom > window.innerHeight) {
      menu.style.top = (window.innerHeight - rect.height - 10) + 'px';
    }
  }, 0);
  
  // 点击其他地方关闭菜单
  document.addEventListener('click', closeMessageMenu);
}

function closeMessageMenu() {
  const menu = document.getElementById('messageContextMenu');
  if (menu) menu.classList.remove('active');
  document.removeEventListener('click', closeMessageMenu);
}

function reactToMessage(emoji) {
  if (!currentMenuMessageId || !currentChat) return;
  
  socket.emit('message:react', {
    messageId: currentMenuMessageId,
    emoji: emoji,
    roomId: currentChat.type === 'room' ? currentChat.id : null,
    recipientId: currentChat.type === 'private' ? currentChat.id : null
  });
  
  closeMessageMenu();
}

function replyToMessage() {
  if (!currentMenuMessageId || !currentChat) return;
  
  const messages = currentChat.type === 'private' 
    ? (privateMessages[currentChat.id] || [])
    : (roomMessages[currentChat.id] || []);
  const msg = messages.find(m => m.id === currentMenuMessageId);
  
  if (msg) {
    setReply(msg);
  }
  
  closeMessageMenu();
}

function copyMessageContent() {
  if (!currentMenuMessageId || !currentChat) return;
  
  const messages = currentChat.type === 'private' 
    ? (privateMessages[currentChat.id] || [])
    : (roomMessages[currentChat.id] || []);
  const msg = messages.find(m => m.id === currentMenuMessageId);
  
  if (msg && msg.content) {
    navigator.clipboard.writeText(msg.content).then(() => {
      showToast('已复制到剪贴板');
    }).catch(() => {
      showToast('复制失败');
    });
  }
  
  closeMessageMenu();
}

function deleteMessage() {
  if (!currentMenuMessageId || !currentChat) return;
  
  // TODO: 实现删除消息功能
  showToast('消息删除功能开发中');
  closeMessageMenu();
}

// ===== 戳一戳功能 =====
function pokeUser(userId, username) {
  if (!userId || userId === currentUser.id) {
    showToast('不能戳自己哦');
    return;
  }
  
  socket.emit('user:poke', { targetId: userId });
  showToast(`你戳了戳 ${username}`);
}

// ===== 回复消息 =====
function setReply(msg) {
  replyingTo = msg;
  const preview = document.getElementById('replyPreview');
  if (preview) {
    document.getElementById('replyToName').textContent = msg.senderName;
    document.getElementById('replyToContent').textContent = getMessagePreview(msg);
    preview.classList.add('active');
  }
}

function cancelReply() {
  replyingTo = null;
  const preview = document.getElementById('replyPreview');
  if (preview) preview.classList.remove('active');
}

// ===== 消息反应切换 =====
function toggleReaction(messageId, emoji) {
  if (!currentChat) return;
  
  socket.emit('message:react', {
    messageId: messageId,
    emoji: emoji,
    roomId: currentChat.type === 'room' ? currentChat.id : null,
    recipientId: currentChat.type === 'private' ? currentChat.id : null
  });
}

// ===== 搜索功能 =====
function toggleSearch() {
  const searchBar = document.getElementById('searchBar');
  searchBar?.classList.toggle('active');
  
  if (searchBar?.classList.contains('active')) {
    document.getElementById('searchInput')?.focus();
  } else {
    document.getElementById('searchInput').value = '';
    // 重新渲染完整列表
    renderContacts();
    updateChatList();
  }
}

function handleSearch() {
  const query = document.getElementById('searchInput')?.value.trim().toLowerCase();
  // TODO: 实现搜索过滤
}

// ===== 更新聊天列表 =====
function updateChatList() {
  const container = document.getElementById('chatList');
  if (!container) return;
  
  const chats = [];
  
  // 收集私聊
  contacts.forEach(contact => {
    if (contact.odp === currentUser?.odp) return;
    
    const chatId = getChatId(currentUser.odp, contact.odp);
    const messages = chatMessages[chatId] || chatMessages[contact.odp] || [];
    const lastMsg = messages[messages.length - 1];
    
    if (lastMsg) {
      chats.push({
        type: 'private',
        id: contact.odp,
        name: contact.nickname,
        avatar: contact.avatar,
        online: contact.online,
        lastMessage: lastMsg,
        timestamp: lastMsg.timestamp
      });
    }
  });
  
  // 收集群聊
  rooms.forEach(room => {
    const messages = chatMessages[room.id] || [];
    const lastMsg = messages[messages.length - 1];
    
    chats.push({
      type: 'room',
      id: room.id,
      name: room.name,
      isRoom: true,
      lastMessage: lastMsg,
      timestamp: lastMsg?.timestamp || room.createdAt
    });
  });
  
  // 按时间排序
  chats.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  
  if (chats.length === 0) {
    container.innerHTML = `
      <div class="empty-state" id="emptyChatState">
        <i class="fas fa-comments"></i>
        <p>暂无聊天</p>
        <span>点击右上角开始新的对话</span>
      </div>
    `;
    return;
  }
  
  container.innerHTML = chats.map(chat => {
    // Beta 0.1.0: 修复群聊头像加载问题
    let avatarHtml = '';
    if (chat.isRoom) {
      // 群聊头像 - 优先使用群头像，否则使用默认图标
      const room = rooms.find(r => r.id === chat.id);
      if (room?.avatar) {
        avatarHtml = `<img src="${room.avatar}" alt="${escapeHtml(chat.name)}" onerror="this.style.display='none';this.parentElement.innerHTML='<i class=\\'fas fa-users\\'></i>'">`;
      } else {
        avatarHtml = `<i class="fas fa-users"></i>`;
      }
    } else {
      avatarHtml = chat.avatar 
        ? `<img src="${chat.avatar}" alt="${escapeHtml(chat.name)}" onerror="this.style.display='none';this.parentElement.innerHTML='<i class=\\'fas fa-user\\'></i>'">`
        : `<i class="fas fa-user"></i>`;
    }
    
    return `
      <div class="chat-item" onclick="${chat.type === 'private' ? `openPrivateChat('${chat.id}')` : `openRoomChat('${chat.id}')`}">
        <div class="chat-avatar ${chat.online ? 'online' : ''}">
          ${avatarHtml}
          ${!chat.isRoom ? `<span class="status-dot ${chat.online ? 'online' : 'offline'}"></span>` : ''}
        </div>
        <div class="chat-info">
          <div class="chat-top">
            <h3>${escapeHtml(chat.name)}</h3>
            <span class="chat-time">${chat.lastMessage ? formatTime(chat.lastMessage.timestamp) : ''}</span>
          </div>
          <p class="chat-preview">${chat.lastMessage ? getMessagePreview(chat.lastMessage) : '暂无消息'}</p>
        </div>
      </div>
    `;
  }).join('');
}

// ===== 添加聊天菜单 =====
function showAddChatMenu() {
  // 切换到联系人页面
  switchTab('contacts');
}

// ===== 主题切换 =====
function toggleDarkMode() {
  document.body.classList.toggle('dark-mode');
  localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
}

// ===== 工具函数 =====
function getChatId(odp1, odp2) {
  return [odp1, odp2].sort().join('_');
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000 && date.getDate() === now.getDate()) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }
  if (diff < 172800000) return '昨天';
  
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

function getMessagePreview(msg) {
  if (!msg) return '';
  switch (msg.type) {
    case 'text': return msg.content?.substring(0, 30) + (msg.content?.length > 30 ? '...' : '');
    case 'image': return '[图片]';
    case 'video': return '[视频]';
    case 'file': return '[文件]';
    case 'voice': return '[语音]';
    default: return msg.content?.substring(0, 30) || '';
  }
}

function scrollToBottom() {
  const container = document.getElementById('messagesContainer');
  if (container) {
    setTimeout(() => {
      container.scrollTop = container.scrollHeight;
    }, 100);
  }
}

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  
  const icon = toast.querySelector('.toast-icon');
  const msg = toast.querySelector('.toast-message');
  
  const icons = {
    success: 'fas fa-check-circle',
    error: 'fas fa-times-circle',
    info: 'fas fa-info-circle',
    warning: 'fas fa-exclamation-circle'
  };
  
  icon.className = `toast-icon ${icons[type] || icons.info}`;
  msg.textContent = message;
  toast.className = `toast ${type} active`;
  
  setTimeout(() => {
    toast.classList.remove('active');
  }, 3000);
}

// ===== 加载暗色模式设置 =====
if (localStorage.getItem('darkMode') === 'true') {
  document.body.classList.add('dark-mode');
  const toggle = document.getElementById('darkModeToggle');
  if (toggle) toggle.checked = true;
}

// ========================================
// ===== 发现页功能实现 =====
// ========================================

// 朋友圈数据存储
let moments = [];
let momentImages = [];

// ===== 朋友圈 =====
function openMoments() {
  openModal('momentsModal');
  loadMoments();
}

function loadMoments() {
  const container = document.getElementById('momentsList');
  if (!container) return;
  
  // 从服务器获取朋友圈
  socket.emit('moments:get');
}

function renderMomentsList() {
  const container = document.getElementById('momentsList');
  if (!container) return;
  
  if (moments.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-camera-retro"></i>
        <p>暂无动态</p>
        <span>点击右上角发布第一条动态</span>
      </div>
    `;
    return;
  }
  
  container.innerHTML = moments.map(moment => `
    <div class="moment-item" data-id="${moment.id}">
      <div class="moment-avatar">
        ${moment.avatar ? `<img src="${moment.avatar}" alt="">` : `<i class="fas fa-user"></i>`}
      </div>
      <div class="moment-content">
        <h4>${escapeHtml(moment.nickname)}</h4>
        <p class="moment-text">${escapeHtml(moment.content)}</p>
        ${moment.images && moment.images.length > 0 ? `
          <div class="moment-images-grid">
            ${moment.images.map(img => `<img src="${img}" onclick="showImagePreview('${img}')">`).join('')}
          </div>
        ` : ''}
        <div class="moment-footer">
          <span class="moment-time">${formatTime(moment.timestamp)}</span>
          <div class="moment-actions">
            <button onclick="likeMoment('${moment.id}')">
              <i class="fas fa-heart ${moment.likes?.includes(currentUser?.odp) ? 'liked' : ''}"></i>
              ${moment.likes?.length || 0}
            </button>
            <button onclick="commentMoment('${moment.id}')">
              <i class="fas fa-comment"></i>
              ${moment.comments?.length || 0}
            </button>
            ${moment.odp === currentUser?.odp ? `
              <button onclick="deleteMoment('${moment.id}')" style="color: #FF6B6B;">
                <i class="fas fa-trash"></i>
              </button>
            ` : ''}
          </div>
        </div>
        ${moment.comments && moment.comments.length > 0 ? `
          <div class="moment-comments">
            ${moment.comments.map(c => `
              <p><strong>${escapeHtml(c.nickname)}:</strong> ${escapeHtml(c.content)}</p>
            `).join('')}
          </div>
        ` : ''}
      </div>
    </div>
  `).join('');
}

function handleMomentImages(e) {
  const files = Array.from(e.target.files);
  const container = document.getElementById('momentImages');
  
  files.forEach(file => {
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        momentImages.push(event.target.result);
        renderMomentImages();
      };
      reader.readAsDataURL(file);
    }
  });
  e.target.value = '';
}

function renderMomentImages() {
  const container = document.getElementById('momentImages');
  if (!container) return;
  
  container.innerHTML = momentImages.map((img, i) => `
    <div class="moment-image-item">
      <img src="${img}" alt="">
      <button onclick="removeMomentImage(${i})"><i class="fas fa-times"></i></button>
    </div>
  `).join('');
}

function removeMomentImage(index) {
  momentImages.splice(index, 1);
  renderMomentImages();
}

function submitMoment() {
  const content = document.getElementById('momentContent')?.value.trim();
  
  if (!content && momentImages.length === 0) {
    showToast('请输入内容或添加图片', 'error');
    return;
  }
  
  // 发送到服务器
  socket.emit('moments:post', {
    content,
    images: [...momentImages]
  });
  
  // 清空表单
  document.getElementById('momentContent').value = '';
  momentImages = [];
  renderMomentImages();
  
  closeModal('postMomentModal');
  showToast('发布成功', 'success');
}

function likeMoment(momentId) {
  socket.emit('moments:like', { momentId });
}

function commentMoment(momentId) {
  const comment = prompt('输入评论:');
  if (!comment || !comment.trim()) return;
  
  socket.emit('moments:comment', { momentId, content: comment.trim() });
}

function deleteMoment(momentId) {
  if (confirm('确定要删除这条动态吗？')) {
    socket.emit('moments:delete', { momentId });
  }
}

// 暴露到全局
window.likeMoment = likeMoment;
window.commentMoment = commentMoment;
window.deleteMoment = deleteMoment;

// ===== 在线用户 =====
function openOnlineUsers() {
  // 创建在线用户弹窗
  const existingModal = document.getElementById('onlineUsersModal');
  if (existingModal) existingModal.remove();
  
  const modal = document.createElement('div');
  modal.id = 'onlineUsersModal';
  modal.className = 'modal active';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 500px;">
      <div class="modal-header">
        <h2><i class="fas fa-users"></i> 在线用户</h2>
        <button class="modal-close" onclick="closeOnlineUsersModal()">&times;</button>
      </div>
      <div class="modal-body" style="max-height: 400px; overflow-y: auto;">
        <div id="onlineUsersList">
          ${onlineUsers.length === 0 ? `
            <div class="empty-state">
              <i class="fas fa-user-slash"></i>
              <p>暂无其他在线用户</p>
            </div>
          ` : onlineUsers.map(user => `
            <div class="contact-item" onclick="startChatWithUser('${user.odp}', '${escapeHtml(user.nickname || user.username)}')">
              <div class="avatar">
                ${user.avatar ? `<img src="${user.avatar}" alt="">` : `<i class="fas fa-user"></i>`}
              </div>
              <div class="info">
                <h4>${escapeHtml(user.nickname || user.username)}</h4>
                <p>${user.signature || '在线'}</p>
              </div>
              <span class="status-dot online"></span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function closeOnlineUsersModal() {
  const modal = document.getElementById('onlineUsersModal');
  if (modal) modal.remove();
}

function startChatWithUser(odp, nickname) {
  closeOnlineUsersModal();
  openChat('private', odp, nickname);
  // 切换到聊天页
  switchTab('chats');
}

// ===== 公告板 =====
function openBroadcast() {
  const existingModal = document.getElementById('broadcastModal');
  if (existingModal) existingModal.remove();
  
  const modal = document.createElement('div');
  modal.id = 'broadcastModal';
  modal.className = 'modal active';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 500px;">
      <div class="modal-header">
        <h2><i class="fas fa-bullhorn"></i> 公告板</h2>
        <button class="modal-close" onclick="closeBroadcastModal()">&times;</button>
      </div>
      <div class="modal-body" style="max-height: 400px; overflow-y: auto;">
        <div class="broadcast-notice" style="padding: 20px; background: var(--bg-input); border-radius: var(--radius-md); margin-bottom: 16px;">
          <h4 style="margin-bottom: 8px; color: var(--primary);">
            <i class="fas fa-info-circle"></i> 欢迎使用局域网聊天室
          </h4>
          <p style="color: var(--text-secondary); font-size: 14px; line-height: 1.6;">
            这是一个局域网内的即时通讯工具，您可以与同一网络内的其他用户聊天。
          </p>
        </div>
        <div class="broadcast-notice" style="padding: 20px; background: var(--bg-input); border-radius: var(--radius-md);">
          <h4 style="margin-bottom: 8px;">
            <i class="fas fa-lightbulb"></i> 功能特点
          </h4>
          <ul style="color: var(--text-secondary); font-size: 14px; line-height: 1.8; padding-left: 20px;">
            <li>私聊和群聊</li>
            <li>好友系统</li>
            <li>朋友圈动态</li>
            <li>发送图片、文件、语音</li>
            <li>深色模式</li>
          </ul>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function closeBroadcastModal() {
  const modal = document.getElementById('broadcastModal');
  if (modal) modal.remove();
}

// ===== 使用帮助 =====
function openHelp() {
  const existingModal = document.getElementById('helpModal');
  if (existingModal) existingModal.remove();
  
  const modal = document.createElement('div');
  modal.id = 'helpModal';
  modal.className = 'modal active';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 550px;">
      <div class="modal-header">
        <h2><i class="fas fa-question-circle"></i> 使用帮助</h2>
        <button class="modal-close" onclick="closeHelpModal()">&times;</button>
      </div>
      <div class="modal-body" style="max-height: 450px; overflow-y: auto;">
        <div class="help-section" style="margin-bottom: 20px;">
          <h4 style="margin-bottom: 10px; color: var(--primary);">💬 如何开始聊天？</h4>
          <p style="color: var(--text-secondary); font-size: 14px; line-height: 1.6;">
            1. 点击"联系人"页面的"+"按钮添加好友<br>
            2. 搜索用户名并发送好友请求<br>
            3. 对方同意后即可开始聊天
          </p>
        </div>
        <div class="help-section" style="margin-bottom: 20px;">
          <h4 style="margin-bottom: 10px; color: var(--primary);">👥 如何创建群聊？</h4>
          <p style="color: var(--text-secondary); font-size: 14px; line-height: 1.6;">
            1. 在"联系人"页面点击"新建群聊"<br>
            2. 输入群名称并选择成员<br>
            3. 点击创建即可
          </p>
        </div>
        <div class="help-section" style="margin-bottom: 20px;">
          <h4 style="margin-bottom: 10px; color: var(--primary);">📷 如何发送图片/文件？</h4>
          <p style="color: var(--text-secondary); font-size: 14px; line-height: 1.6;">
            1. 在聊天界面点击输入框左侧的"+"按钮<br>
            2. 选择要发送的类型（图片、视频、文件等）<br>
            3. 选择文件后自动发送
          </p>
        </div>
        <div class="help-section" style="margin-bottom: 20px;">
          <h4 style="margin-bottom: 10px; color: var(--primary);">🌙 如何切换深色模式？</h4>
          <p style="color: var(--text-secondary); font-size: 14px; line-height: 1.6;">
            在"我"页面找到"主题"选项，点击开关即可切换深色/浅色模式。
          </p>
        </div>
        <div class="help-section">
          <h4 style="margin-bottom: 10px; color: var(--primary);">🔗 如何邀请其他人？</h4>
          <p style="color: var(--text-secondary); font-size: 14px; line-height: 1.6;">
            将页面底部显示的局域网地址发送给同一网络内的朋友，他们在浏览器打开即可加入聊天室。
          </p>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function closeHelpModal() {
  const modal = document.getElementById('helpModal');
  if (modal) modal.remove();
}

// 暴露到全局
window.openOnlineUsers = openOnlineUsers;
window.closeOnlineUsersModal = closeOnlineUsersModal;
window.startChatWithUser = startChatWithUser;
window.openBroadcast = openBroadcast;
window.closeBroadcastModal = closeBroadcastModal;
window.openHelp = openHelp;
window.closeHelpModal = closeHelpModal;

// ===== 扫一扫（保留但不使用） =====
let scanStream = null;

function openScan() {
  showToast('此功能在PC端不可用', 'info');
}

async function startScan() {
  const video = document.getElementById('scanVideo');
  const result = document.getElementById('scanResult');
  
  try {
    scanStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    });
    video.srcObject = scanStream;
    result.innerHTML = '<p>摄像头已启动，请将二维码对准扫描框</p>';
    
    // 简单的二维码检测（实际需要使用二维码解析库）
    // 这里只是模拟
  } catch (err) {
    result.innerHTML = `
      <p style="color: var(--text-muted);">无法访问摄像头</p>
      <p style="font-size: 12px; color: var(--text-muted);">请确保已授予摄像头权限</p>
    `;
  }
}

function stopScan() {
  if (scanStream) {
    scanStream.getTracks().forEach(track => track.stop());
    scanStream = null;
  }
}

// 关闭扫一扫时停止摄像头
const originalCloseModal = closeModal;
closeModal = function(id) {
  if (id === 'scanModal') {
    stopScan();
  }
  originalCloseModal(id);
};

// ===== 摇一摇 =====
let shakeTimeout = null;
let lastShakeTime = 0;

function openShake() {
  openModal('shakeModal');
  initShake();
}

function initShake() {
  // 检测设备是否支持摇一摇
  if ('DeviceMotionEvent' in window) {
    // 请求权限（iOS 13+需要）
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
      DeviceMotionEvent.requestPermission()
        .then(response => {
          if (response === 'granted') {
            window.addEventListener('devicemotion', handleShake);
          }
        })
        .catch(console.error);
    } else {
      window.addEventListener('devicemotion', handleShake);
    }
  }
}

function handleShake(event) {
  const { accelerationIncludingGravity } = event;
  if (!accelerationIncludingGravity) return;
  
  const { x, y, z } = accelerationIncludingGravity;
  const acceleration = Math.sqrt(x * x + y * y + z * z);
  
  const now = Date.now();
  if (acceleration > 25 && now - lastShakeTime > 1000) {
    lastShakeTime = now;
    performShake();
  }
}

function performShake() {
  const icon = document.getElementById('shakeIcon');
  const result = document.getElementById('shakeResult');
  
  // 动画效果
  icon.classList.add('shaking');
  setTimeout(() => icon.classList.remove('shaking'), 500);
  
  // 随机匹配在线用户
  const availableContacts = contacts.filter(c => c.odp !== currentUser?.odp && c.online);
  
  if (availableContacts.length === 0) {
    result.innerHTML = '<p>暂时没有找到在线用户</p>';
    return;
  }
  
  const matched = availableContacts[Math.floor(Math.random() * availableContacts.length)];
  
  result.innerHTML = `
    <div class="shake-matched">
      <div class="matched-avatar">
        ${matched.avatar ? `<img src="${matched.avatar}" alt="">` : `<i class="fas fa-user"></i>`}
      </div>
      <h4>${escapeHtml(matched.nickname)}</h4>
      <p>${escapeHtml(matched.signature || '暂无签名')}</p>
      <button class="btn btn-primary" onclick="closeModal('shakeModal'); openPrivateChat('${matched.odp}')">
        打个招呼
      </button>
    </div>
  `;
  
  showToast('摇到一个人！', 'success');
}

// ===== 附近的人 =====
function openNearby() {
  openModal('nearbyModal');
  loadNearbyUsers();
}

function loadNearbyUsers() {
  const container = document.getElementById('nearbyList');
  if (!container) return;
  
  // 使用所有在线用户作为"附近的人"
  const nearbyUsers = contacts.filter(c => c.odp !== currentUser?.odp);
  
  if (nearbyUsers.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-map-marker-alt"></i>
        <p>附近暂无用户</p>
        <span>等待其他用户上线</span>
      </div>
    `;
    return;
  }
  
  container.innerHTML = nearbyUsers.map(user => `
    <div class="nearby-item" onclick="closeModal('nearbyModal'); openPrivateChat('${user.odp}')">
      <div class="nearby-avatar">
        ${user.avatar ? `<img src="${user.avatar}" alt="">` : `<i class="fas fa-user"></i>`}
        <span class="status-dot ${user.online ? 'online' : 'offline'}"></span>
      </div>
      <div class="nearby-info">
        <h4>${escapeHtml(user.nickname)}</h4>
        <p>${escapeHtml(user.signature || '暂无签名')}</p>
      </div>
      <span class="nearby-distance">91.78m</span>
    </div>
  `).join('');
}

// ========================================
// ===== 个人页功能实现 =====
// ========================================

let editAvatarDataUrl = null;

function openEditProfile() {
  openModal('editProfileModal');
  
  // 填充当前信息
  document.getElementById('editNickname').value = currentUser?.nickname || '';
  document.getElementById('editSignature').value = currentUser?.signature || '';
  
  const avatarPreview = document.getElementById('editAvatarPreview');
  if (currentUser?.avatar) {
    avatarPreview.innerHTML = `<img src="${currentUser.avatar}" alt="">`;
  } else {
    avatarPreview.innerHTML = '<i class="fas fa-user"></i>';
  }
  editAvatarDataUrl = null;
}

function handleEditAvatar(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  if (!file.type.startsWith('image/')) {
    showToast('请选择图片文件', 'error');
    return;
  }
  
  const reader = new FileReader();
  reader.onload = (event) => {
    editAvatarDataUrl = event.target.result;
    const preview = document.getElementById('editAvatarPreview');
    preview.innerHTML = `<img src="${editAvatarDataUrl}" alt="">`;
  };
  reader.readAsDataURL(file);
}

function saveProfile() {
  const nickname = document.getElementById('editNickname')?.value.trim();
  const signature = document.getElementById('editSignature')?.value.trim();
  
  if (!nickname) {
    showToast('昵称不能为空', 'error');
    return;
  }
  
  // 发送到服务器更新
  socket.emit('user:update', {
    nickname,
    signature,
    avatar: editAvatarDataUrl || currentUser?.avatar
  });
  
  // 本地更新
  currentUser.nickname = nickname;
  currentUser.signature = signature;
  if (editAvatarDataUrl) {
    currentUser.avatar = editAvatarDataUrl;
  }
  
  localStorage.setItem('chatroom_user', JSON.stringify(currentUser));
  updateProfileDisplay();
  
  closeModal('editProfileModal');
  showToast('资料更新成功', 'success');
}

function changePassword() {
  const oldPassword = document.getElementById('oldPassword')?.value;
  const newPassword = document.getElementById('newPassword')?.value;
  const confirmPassword = document.getElementById('confirmNewPassword')?.value;
  
  if (!oldPassword || !newPassword || !confirmPassword) {
    showToast('请填写所有字段', 'error');
    return;
  }
  
  const passwordCheck = validatePassword(newPassword);
  if (!passwordCheck.valid) {
    showToast(passwordCheck.message, 'error');
    return;
  }
  
  if (newPassword !== confirmPassword) {
    showToast('两次输入的新密码不一致', 'error');
    return;
  }
  
  socket.emit('user:changePassword', {
    oldPassword,
    newPassword
  });
  
  // 监听结果（需要在服务器添加对应处理）
  showToast('密码修改请求已发送', 'info');
  closeModal('changePasswordModal');
  
  // 清空表单
  document.getElementById('oldPassword').value = '';
  document.getElementById('newPassword').value = '';
  document.getElementById('confirmNewPassword').value = '';
}

function clearCache() {
  if (confirm('确定要清除所有缓存数据吗？这将清除本地存储的聊天记录和设置。')) {
    // 保留用户登录信息
    const user = localStorage.getItem('chatroom_user');
    localStorage.clear();
    if (user) {
      localStorage.setItem('chatroom_user', user);
    }
    
    chatMessages = {};
    showToast('缓存已清除', 'success');
  }
}

// 添加Socket事件监听
socket.on('user:updateSuccess', (data) => {
  currentUser = { ...currentUser, ...data.user };
  localStorage.setItem('chatroom_user', JSON.stringify(currentUser));
  updateProfileDisplay();
});

socket.on('password:changed', () => {
  showToast('密码修改成功', 'success');
});

socket.on('password:error', (data) => {
  showToast(data.message || '密码修改失败', 'error');
});

// ===== 好友系统函数 =====
function sendFriendRequest(targetOdp) {
  socket.emit('friend:request', { targetOdp });
}

function acceptFriendRequest(requestId) {
  socket.emit('friend:accept', { requestId });
}

function rejectFriendRequest(requestId) {
  socket.emit('friend:reject', { requestId });
}

function removeFriend(friendOdp) {
  if (confirm('确定要删除这个好友吗？')) {
    socket.emit('friend:remove', { friendOdp });
  }
}

function renderFriendRequests(requests) {
  const container = document.getElementById('friendRequestsList');
  const emptyState = document.getElementById('emptyRequestsState');
  
  if (!container) return;
  
  // 更新角标
  updateFriendRequestBadge();
  
  if (requests.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 40px; text-align: center; color: var(--text-muted);">
        <i class="fas fa-user-plus" style="font-size: 40px; margin-bottom: 10px;"></i>
        <p>暂无好友请求</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = requests.map(req => {
    const sender = req.senderInfo || {};
    return `
      <div class="friend-request-item">
        <div class="avatar">
          ${sender.avatar ? `<img src="${sender.avatar}" alt="">` : `<i class="fas fa-user"></i>`}
        </div>
        <div class="request-info">
          <div class="name">${escapeHtml(sender.nickname || '未知用户')}</div>
          <div class="time">请求添加你为好友</div>
        </div>
        <div class="request-actions">
          <button class="accept-btn" onclick="acceptFriendRequest('${req.id}')">接受</button>
          <button class="reject-btn" onclick="rejectFriendRequest('${req.id}')">拒绝</button>
        </div>
      </div>
    `;
  }).join('');
}

// 更新好友请求角标
function updateFriendRequestBadge() {
  const badge = document.getElementById('friendRequestBadge');
  if (badge) {
    const count = pendingFriendRequests.length;
    if (count > 0) {
      badge.textContent = count;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }
}
// ===== 面板控制函数 =====
function openFriendRequestsPanel() {
  document.getElementById('friendRequestsPanel').classList.add('active');
  document.getElementById('friendRequestsOverlay').classList.add('active');
  socket.emit('friend:getRequests');
}

function closeFriendRequestsPanel() {
  document.getElementById('friendRequestsPanel').classList.remove('active');
  document.getElementById('friendRequestsOverlay').classList.remove('active');
}

// 暴露到全局作用域供onclick使用
window.openFriendRequestsPanel = openFriendRequestsPanel;
window.closeFriendRequestsPanel = closeFriendRequestsPanel;

// ===== 聊天菜单 =====
function openChatMenu() {
  if (!currentChat) return;
  
  // 如果是群聊，打开群聊设置面板
  if (currentChat.type === 'room') {
    openRoomSettingsPanel(currentChat.id);
  } else {
    // 私聊显示用户信息菜单
    showPrivateChatMenu();
  }
}

function showPrivateChatMenu() {
  // 创建私聊菜单
  const existingMenu = document.getElementById('privateChatMenu');
  if (existingMenu) existingMenu.remove();
  
  const targetUser = onlineUsers.find(u => u.odp === currentChat.id) || contacts.find(c => c.odp === currentChat.id);
  const isFriend = contacts.some(c => c.odp === currentChat.id && c.isFriend);
  const isAdmin = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'ADMIN' || currentUser?.role === 'MODERATOR';
  
  const menu = document.createElement('div');
  menu.id = 'privateChatMenu';
  menu.className = 'dropdown-menu active';
  menu.style.cssText = 'position: fixed; top: 60px; right: 20px; z-index: 1002;';
  menu.innerHTML = `
    <div class="dropdown-content" style="background: var(--bg-white); border-radius: var(--radius-md); box-shadow: var(--shadow-lg); min-width: 200px; overflow: hidden;">
      <div style="padding: 16px; border-bottom: 1px solid var(--border); text-align: center;">
        <div class="avatar" style="width: 60px; height: 60px; margin: 0 auto 10px; border-radius: 50%; background: var(--bg-input); display: flex; align-items: center; justify-content: center; font-size: 24px;">
          ${targetUser?.avatar ? `<img src="${targetUser.avatar}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">` : `<i class="fas fa-user" style="color: var(--text-muted);"></i>`}
        </div>
        <h4 style="font-size: 16px; margin-bottom: 4px;">${escapeHtml(currentChat.name)}</h4>
        ${targetUser?.signature ? `<p style="font-size: 12px; color: var(--text-muted);">${escapeHtml(targetUser.signature)}</p>` : ''}
        ${targetUser?.roleInfo?.badge ? `<span style="font-size: 11px; color: ${targetUser.roleInfo.color};">${targetUser.roleInfo.badge}</span>` : ''}
      </div>
      <div style="padding: 8px 0;">
        <button onclick="pokeUserFromMenu('${currentChat.id}', '${escapeHtml(currentChat.name)}')" style="width: 100%; padding: 12px 16px; background: none; border: none; text-align: left; cursor: pointer; display: flex; align-items: center; gap: 10px; color: var(--text-primary);">
          <i class="fas fa-hand-pointer" style="color: #FF6B6B;"></i>
          <span>戳一戳</span>
        </button>
        ${!isFriend ? `
          <button onclick="sendFriendRequestFromMenu('${currentChat.id}')" style="width: 100%; padding: 12px 16px; background: none; border: none; text-align: left; cursor: pointer; display: flex; align-items: center; gap: 10px; color: var(--text-primary);">
            <i class="fas fa-user-plus" style="color: var(--primary);"></i>
            <span>添加好友</span>
          </button>
        ` : ''}
        <button onclick="openReportModal('${currentChat.id}', '${escapeHtml(currentChat.name)}')" style="width: 100%; padding: 12px 16px; background: none; border: none; text-align: left; cursor: pointer; display: flex; align-items: center; gap: 10px; color: var(--text-primary);">
          <i class="fas fa-flag" style="color: #f59e0b;"></i>
          <span>举报用户</span>
        </button>
        ${isAdmin ? `
          <div style="border-top: 1px solid var(--border); margin: 4px 0;"></div>
          <button onclick="openAdminWarnModal('${currentChat.id}', '${escapeHtml(currentChat.name)}')" style="width: 100%; padding: 12px 16px; background: none; border: none; text-align: left; cursor: pointer; display: flex; align-items: center; gap: 10px; color: var(--text-primary);">
            <i class="fas fa-exclamation-triangle" style="color: #f59e0b;"></i>
            <span>警告用户</span>
          </button>
          <button onclick="openAdminMuteModal('${currentChat.id}', '${escapeHtml(currentChat.name)}')" style="width: 100%; padding: 12px 16px; background: none; border: none; text-align: left; cursor: pointer; display: flex; align-items: center; gap: 10px; color: var(--text-primary);">
            <i class="fas fa-volume-mute" style="color: #ef4444;"></i>
            <span>禁言用户</span>
          </button>
        ` : ''}
        <div style="border-top: 1px solid var(--border); margin: 4px 0;"></div>
        <button onclick="clearChatHistory('${currentChat.id}')" style="width: 100%; padding: 12px 16px; background: none; border: none; text-align: left; cursor: pointer; display: flex; align-items: center; gap: 10px; color: var(--text-primary);">
          <i class="fas fa-trash-alt" style="color: #FF6B6B;"></i>
          <span>清空聊天记录</span>
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(menu);
  
  // 点击其他地方关闭
  setTimeout(() => {
    document.addEventListener('click', closePrivateChatMenu);
  }, 100);
}

function closePrivateChatMenu() {
  const menu = document.getElementById('privateChatMenu');
  if (menu) menu.remove();
  document.removeEventListener('click', closePrivateChatMenu);
}

function sendFriendRequestFromMenu(odp) {
  socket.emit('friend:request', { to: odp });
  showToast('好友请求已发送', 'success');
  closePrivateChatMenu();
}

function pokeUserFromMenu(odp, username) {
  pokeUser(odp, username);
  closePrivateChatMenu();
}

function clearChatHistory(targetId) {
  if (confirm('确定要清空与该用户的聊天记录吗？')) {
    // 仅清除本地显示，实际记录保留在服务器
    const messagesList = document.getElementById('messagesList');
    if (messagesList) messagesList.innerHTML = '';
    showToast('聊天记录已清空', 'success');
    closePrivateChatMenu();
  }
}

// 暴露到全局
window.openChatMenu = openChatMenu;
window.showPrivateChatMenu = showPrivateChatMenu;
window.closePrivateChatMenu = closePrivateChatMenu;
window.sendFriendRequestFromMenu = sendFriendRequestFromMenu;
window.pokeUserFromMenu = pokeUserFromMenu;
window.clearChatHistory = clearChatHistory;
window.showMessageMenu = showMessageMenu;
window.reactToMessage = reactToMessage;
window.replyToMessage = replyToMessage;
window.copyMessageContent = copyMessageContent;
window.deleteMessage = deleteMessage;
window.toggleReaction = toggleReaction;
window.pokeUser = pokeUser;

let currentSettingsRoomId = null;

function openRoomSettingsPanel(roomId) {
  currentSettingsRoomId = roomId;
  document.getElementById('roomSettingsPanel').classList.add('active');
  document.getElementById('roomSettingsOverlay').classList.add('active');
  
  const room = rooms.find(r => r.id === roomId);
  if (room) {
    document.getElementById('roomNameInput').value = room.name || '';
    document.getElementById('roomAnnouncementInput').value = room.announcement || '';
    
    // 显示群头像
    const avatarDisplay = document.getElementById('roomAvatarDisplay');
    if (room.avatar) {
      avatarDisplay.innerHTML = `<img src="${room.avatar}" alt="" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
    } else {
      avatarDisplay.innerHTML = '<i class="fas fa-users"></i>';
    }
    
    // 更新退出/解散按钮
    const leaveBtn = document.getElementById('leaveRoomBtn');
    if (room.owner === currentUser.odp) {
      leaveBtn.textContent = '解散群聊';
      leaveBtn.style.background = '#dc2626';
    } else {
      leaveBtn.textContent = '退出群聊';
      leaveBtn.style.background = '#FF6B6B';
    }
    
    renderRoomMembers(room);
  }
}

function closeRoomSettingsPanel() {
  document.getElementById('roomSettingsPanel').classList.remove('active');
  document.getElementById('roomSettingsOverlay').classList.remove('active');
  currentSettingsRoomId = null;
}

// 暴露到全局作用域供onclick使用
window.openRoomSettingsPanel = openRoomSettingsPanel;
window.closeRoomSettingsPanel = closeRoomSettingsPanel;

function renderRoomMembers(room) {
  const container = document.getElementById('roomMembersList');
  if (!container || !room.members) return;
  
  const isOwner = room.owner === currentUser.odp;
  const isAdmin = room.admins && room.admins.includes(currentUser.odp);
  
  container.innerHTML = room.members.map(memberOdp => {
    const user = onlineUsers.find(u => u.odp === memberOdp) || { nickname: '未知用户', odp: memberOdp };
    const isMemberOwner = memberOdp === room.owner;
    const isMemberAdmin = room.admins && room.admins.includes(memberOdp);
    const canKick = (isOwner || isAdmin) && !isMemberOwner && memberOdp !== currentUser.odp;
    
    return `
      <div class="member-item">
        <div class="avatar">
          ${user.avatar ? `<img src="${user.avatar}" alt="">` : `<i class="fas fa-user"></i>`}
        </div>
        <div class="info">
          <div class="name">${escapeHtml(user.nickname || user.username)}</div>
          <div class="role-tag">${isMemberOwner ? '群主' : (isMemberAdmin ? '管理员' : '成员')}</div>
        </div>
        ${canKick ? `<button class="kick-btn" onclick="kickFromRoom('${room.id}', '${memberOdp}')">踢出</button>` : ''}
      </div>
    `;
  }).join('');
}

function saveRoomName() {
  if (!currentSettingsRoomId) return;
  
  const newName = document.getElementById('roomNameInput').value.trim();
  if (newName) {
    updateRoomSettings(currentSettingsRoomId, newName, {});
    showToast('群名称已更新');
  }
}

// ===== 邀请成员入群 =====
function openInviteMembersModal() {
  if (!currentSettingsRoomId) return;
  
  const room = rooms.find(r => r.id === currentSettingsRoomId);
  if (!room) return;
  
  const container = document.getElementById('inviteMembersList');
  if (!container) return;
  
  // 获取好友列表（排除已在群内的）
  const availableFriends = contacts.filter(c => !room.members.includes(c.odp));
  
  if (availableFriends.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-users"></i>
        <p>所有好友都已在群内</p>
      </div>
    `;
  } else {
    container.innerHTML = availableFriends.map(friend => `
      <label class="member-select-item">
        <input type="checkbox" class="invite-member-checkbox" value="${friend.odp}">
        <div class="avatar">
          ${friend.avatar ? `<img src="${friend.avatar}" alt="">` : `<i class="fas fa-user"></i>`}
        </div>
        <span class="name">${escapeHtml(friend.nickname || friend.username)}</span>
      </label>
    `).join('');
  }
  
  openModal('inviteMembersModal');
}

function inviteSelectedMembers() {
  if (!currentSettingsRoomId) return;
  
  const selectedMembers = Array.from(document.querySelectorAll('.invite-member-checkbox:checked'))
    .map(cb => cb.value);
  
  if (selectedMembers.length === 0) {
    showToast('请选择要邀请的好友', 'error');
    return;
  }
  
  socket.emit('room:invite', {
    roomId: currentSettingsRoomId,
    targetOdps: selectedMembers
  });
  
  closeModal('inviteMembersModal');
}

// 暴露到全局
window.openInviteMembersModal = openInviteMembersModal;
window.inviteSelectedMembers = inviteSelectedMembers;
window.saveRoomName = saveRoomName;

// ===== 群聊管理函数 =====
function kickFromRoom(roomId, targetOdp) {
  if (confirm('确定要踢出这个成员吗？')) {
    socket.emit('room:kick', { roomId, targetOdp });
  }
}

function updateRoomSettings(roomId, name, settings) {
  socket.emit('room:update', { roomId, name, settings });
}

function setRoomAdmin(roomId, targetOdp, isAdmin) {
  socket.emit('room:setAdmin', { roomId, targetOdp, isAdmin });
}

// 暴露到全局
window.kickFromRoom = kickFromRoom;
window.updateRoomSettings = updateRoomSettings;
window.setRoomAdmin = setRoomAdmin;

// ===== 群聊高级管理 =====
function uploadRoomAvatar() {
  document.getElementById('roomAvatarInput').click();
}

function handleRoomAvatarUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  if (!file.type.startsWith('image/')) {
    showToast('请选择图片文件', 'error');
    return;
  }
  
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    document.getElementById('roomAvatarDisplay').innerHTML = `<img src="${dataUrl}" alt="" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
    
    // 发送到服务器
    socket.emit('room:updateAvatar', {
      roomId: currentSettingsRoomId,
      avatar: dataUrl
    });
    showToast('群头像已更新', 'success');
  };
  reader.readAsDataURL(file);
}

function saveRoomAnnouncement() {
  if (!currentSettingsRoomId) return;
  
  const announcement = document.getElementById('roomAnnouncementInput').value.trim();
  socket.emit('room:updateAnnouncement', {
    roomId: currentSettingsRoomId,
    announcement: announcement
  });
  showToast('群公告已发布', 'success');
}

function leaveOrDisbandRoom() {
  if (!currentSettingsRoomId) return;
  
  const room = rooms.find(r => r.id === currentSettingsRoomId);
  if (!room) return;
  
  const isOwner = room.owner === currentUser.odp;
  
  if (isOwner) {
    if (confirm('确定要解散该群聊吗？此操作不可恢复！')) {
      socket.emit('room:disband', { roomId: currentSettingsRoomId });
      closeRoomSettingsPanel();
      closeChat();
    }
  } else {
    if (confirm('确定要退出该群聊吗？')) {
      socket.emit('room:leave', { roomId: currentSettingsRoomId });
      closeRoomSettingsPanel();
      closeChat();
    }
  }
}

// 暴露新函数
window.uploadRoomAvatar = uploadRoomAvatar;
window.handleRoomAvatarUpload = handleRoomAvatarUpload;
window.saveRoomAnnouncement = saveRoomAnnouncement;
window.leaveOrDisbandRoom = leaveOrDisbandRoom;

// ===== 禁言提示弹窗 =====
function showMuteAlert(detail) {
  // 移除旧弹窗
  closeMuteAlert();
  
  const alert = document.createElement('div');
  alert.id = 'muteAlertModal';
  alert.className = 'mute-alert-modal';
  alert.innerHTML = `
    <div class="mute-alert-content">
      <div class="mute-alert-icon">
        <i class="fas fa-volume-mute"></i>
      </div>
      <h3>您已被禁言</h3>
      <div class="mute-alert-details">
        <div class="mute-detail-row">
          <span class="label">禁言原因:</span>
          <span class="value">${escapeHtml(detail.reason || '违反规定')}</span>
        </div>
        <div class="mute-detail-row">
          <span class="label">禁言时长:</span>
          <span class="value">${detail.permanent ? '永久' : detail.duration}</span>
        </div>
        ${!detail.permanent ? `
        <div class="mute-detail-row">
          <span class="label">剩余时间:</span>
          <span class="value remaining">${detail.remaining}</span>
        </div>
        ` : ''}
      </div>
      <button class="mute-alert-btn" onclick="closeMuteAlert()">我知道了</button>
    </div>
  `;
  document.body.appendChild(alert);
  
  // 添加样式
  if (!document.getElementById('muteAlertStyles')) {
    const style = document.createElement('style');
    style.id = 'muteAlertStyles';
    style.textContent = `
      .mute-alert-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.6);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 9999;
        animation: fadeIn 0.3s ease;
      }
      .mute-alert-content {
        background: white;
        padding: 30px;
        border-radius: 16px;
        text-align: center;
        max-width: 360px;
        width: 90%;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        animation: slideUp 0.3s ease;
      }
      .dark-mode .mute-alert-content {
        background: #2a2a2a;
        color: #fff;
      }
      .mute-alert-icon {
        width: 70px;
        height: 70px;
        background: linear-gradient(135deg, #FF6B6B, #FF8E53);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 20px;
      }
      .mute-alert-icon i {
        font-size: 32px;
        color: white;
      }
      .mute-alert-content h3 {
        font-size: 20px;
        margin-bottom: 20px;
        color: #333;
      }
      .dark-mode .mute-alert-content h3 {
        color: #fff;
      }
      .mute-alert-details {
        background: #f5f5f5;
        padding: 15px;
        border-radius: 10px;
        margin-bottom: 20px;
        text-align: left;
      }
      .dark-mode .mute-alert-details {
        background: #333;
      }
      .mute-detail-row {
        display: flex;
        justify-content: space-between;
        padding: 8px 0;
        border-bottom: 1px solid #eee;
      }
      .dark-mode .mute-detail-row {
        border-bottom-color: #444;
      }
      .mute-detail-row:last-child {
        border-bottom: none;
      }
      .mute-detail-row .label {
        color: #888;
        font-size: 14px;
      }
      .mute-detail-row .value {
        font-weight: 600;
        font-size: 14px;
        color: #333;
      }
      .dark-mode .mute-detail-row .value {
        color: #fff;
      }
      .mute-detail-row .value.remaining {
        color: #FF6B6B;
      }
      .mute-alert-btn {
        background: linear-gradient(135deg, #667eea, #764ba2);
        color: white;
        border: none;
        padding: 12px 40px;
        border-radius: 25px;
        font-size: 16px;
        cursor: pointer;
        transition: transform 0.2s, box-shadow 0.2s;
      }
      .mute-alert-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 5px 20px rgba(102,126,234,0.4);
      }
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes slideUp {
        from { transform: translateY(30px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }
}

function closeMuteAlert() {
  const alert = document.getElementById('muteAlertModal');
  if (alert) {
    alert.remove();
  }
}

// ===== 获取好友请求 =====
socket.on('friend:getRequests', () => {
  socket.emit('friend:getRequests');
});

// ===== 事件绑定 =====
document.addEventListener('DOMContentLoaded', function() {
  // 好友请求按钮
  const friendRequestsBtn = document.getElementById('friendRequestsBtn');
  if (friendRequestsBtn) {
    friendRequestsBtn.addEventListener('click', openFriendRequestsPanel);
  }
  
  // 游戏中心按钮
  const gamesBtn = document.getElementById('gamesBtn');
  if (gamesBtn) {
    gamesBtn.addEventListener('click', openGamesModal);
  }
});

// ===== 游戏系统 =====

// 打开游戏中心
function openGamesModal() {
  document.getElementById('gamesModal').classList.add('active');
}

// 选择游戏
function selectGame(gameType) {
  currentGameType = gameType;
  document.getElementById('selectedGameName').textContent = GAME_NAMES[gameType];
  closeModal('gamesModal');
  
  // 渲染好友列表
  renderFriendListForGame();
  document.getElementById('gameInviteModal').classList.add('active');
}

// 渲染游戏邀请好友列表
function renderFriendListForGame() {
  const container = document.getElementById('friendListForGame');
  const friendsList = contacts.filter(c => c.isFriend);
  
  if (friendsList.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-user-friends"></i>
        <p>暂无好友</p>
        <span>添加好友后才能邀请游戏</span>
      </div>
    `;
    return;
  }
  
  container.innerHTML = friendsList.map(friend => `
    <div class="friend-item-game">
      <div class="avatar">
        ${friend.avatar ? `<img src="${friend.avatar}" alt="">` : `<i class="fas fa-user"></i>`}
      </div>
      <div class="info">
        <div class="name">${escapeHtml(friend.nickname)}</div>
        <div class="status ${friend.online ? 'online' : ''}">${friend.online ? '在线' : '离线'}</div>
      </div>
      <button class="invite-btn" onclick="sendGameInvite('${friend.odp}')" ${!friend.online ? 'disabled' : ''}>
        ${friend.online ? '邀请' : '离线'}
      </button>
    </div>
  `).join('');
}

// 发送游戏邀请
function sendGameInvite(friendOdp) {
  if (!currentGameType) return;
  
  socket.emit('game:invite', {
    to: friendOdp,
    gameType: currentGameType
  });
  
  closeModal('gameInviteModal');
  showToast('游戏邀请已发送，等待对方响应...', 'info');
  
  // 打开游戏面板等待
  openGamePanel(currentGameType, friendOdp, true);
}

// 接受游戏邀请
function acceptGameInvite() {
  if (!pendingGameInvite) return;
  
  socket.emit('game:accept', {
    gameId: pendingGameInvite.gameId,
    from: pendingGameInvite.from
  });
  
  document.getElementById('gameInviteToast').classList.remove('active');
  openGamePanel(pendingGameInvite.gameType, pendingGameInvite.from, false);
  pendingGameInvite = null;
}

// 拒绝游戏邀请
function declineGameInvite() {
  if (!pendingGameInvite) return;
  
  socket.emit('game:decline', {
    gameId: pendingGameInvite.gameId,
    from: pendingGameInvite.from
  });
  
  document.getElementById('gameInviteToast').classList.remove('active');
  pendingGameInvite = null;
}

// 打开游戏面板
function openGamePanel(gameType, opponentOdp, isHost) {
  currentGameType = gameType;
  const opponent = contacts.find(c => c.odp === opponentOdp);
  
  document.getElementById('gamePanelTitle').textContent = GAME_NAMES[gameType];
  document.getElementById('gameStatus').textContent = '等待对方加入...';
  document.getElementById('gameStatus').classList.remove('playing');
  
  // 初始化游戏状态
  gameState = {
    type: gameType,
    opponent: opponentOdp,
    opponentInfo: opponent,
    isHost: isHost,
    myTurn: isHost,
    board: null,
    score: { me: 0, opponent: 0 }
  };
  
  // 根据游戏类型初始化内容
  initGameContent(gameType);
  
  document.getElementById('gamePanel').classList.add('active');
}

// 关闭游戏面板
function closeGamePanel() {
  document.getElementById('gamePanel').classList.remove('active');
  
  if (currentGame) {
    socket.emit('game:leave', { gameId: currentGame });
  }
  
  currentGame = null;
  currentGameType = null;
  gameState = null;
}

// 初始化游戏内容
function initGameContent(gameType) {
  const content = document.getElementById('gameContent');
  const controls = document.getElementById('gameControls');
  
  switch (gameType) {
    case 'gomoku':
      initGomoku(content, controls);
      break;
    case 'tictactoe':
      initTicTacToe(content, controls);
      break;
    case 'guess':
      initGuessGame(content, controls);
      break;
    case 'rps':
      initRPSGame(content, controls);
      break;
  }
}

// 五子棋初始化
function initGomoku(content, controls) {
  gameState.board = Array(15).fill(null).map(() => Array(15).fill(null));
  
  const myPiece = gameState.isHost ? 'black' : 'white';
  const opponentPiece = gameState.isHost ? 'white' : 'black';
  
  content.innerHTML = `
    <div class="game-info">
      <div class="player-info ${gameState.myTurn ? 'active' : ''}">
        <div class="avatar">
          ${currentUser.avatar ? `<img src="${currentUser.avatar}" alt="">` : `<i class="fas fa-user"></i>`}
        </div>
        <span class="name">我</span>
        <div class="piece ${myPiece}"></div>
      </div>
      <div class="turn-indicator">${gameState.myTurn ? '你的回合' : '对方回合'}</div>
      <div class="player-info ${!gameState.myTurn ? 'active' : ''}">
        <div class="avatar">
          ${gameState.opponentInfo?.avatar ? `<img src="${gameState.opponentInfo.avatar}" alt="">` : `<i class="fas fa-user"></i>`}
        </div>
        <span class="name">${gameState.opponentInfo?.nickname || '对手'}</span>
        <div class="piece ${opponentPiece}"></div>
      </div>
    </div>
    <div class="game-board gomoku" id="gomokuBoard">
      ${Array(15).fill(null).map((_, row) => 
        Array(15).fill(null).map((_, col) => 
          `<div class="board-cell" data-row="${row}" data-col="${col}" onclick="makeGomokuMove(${row}, ${col})"></div>`
        ).join('')
      ).join('')}
    </div>
  `;
  
  controls.innerHTML = `
    <button class="secondary-btn" onclick="closeGamePanel()">退出游戏</button>
  `;
}

// 五子棋落子
function makeGomokuMove(row, col) {
  if (!gameState || !gameState.myTurn) return;
  if (gameState.board[row][col]) return;
  
  const piece = gameState.isHost ? 'black' : 'white';
  gameState.board[row][col] = piece;
  
  const cell = document.querySelector(`.board-cell[data-row="${row}"][data-col="${col}"]`);
  cell.classList.add(piece);
  
  socket.emit('game:move', {
    gameId: currentGame,
    move: { row, col, piece }
  });
  
  gameState.myTurn = false;
  updateTurnIndicator();
  
  // 检查胜利
  if (checkGomokuWin(row, col, piece)) {
    showGameResult('你赢了！', true);
  }
}

// 检查五子棋胜利
function checkGomokuWin(row, col, piece) {
  const directions = [
    [[0, 1], [0, -1]], // 横
    [[1, 0], [-1, 0]], // 竖
    [[1, 1], [-1, -1]], // 对角
    [[1, -1], [-1, 1]]  // 反对角
  ];
  
  for (const [dir1, dir2] of directions) {
    let count = 1;
    const winCells = [[row, col]];
    
    for (const [dr, dc] of [dir1, dir2]) {
      let r = row + dr, c = col + dc;
      while (r >= 0 && r < 15 && c >= 0 && c < 15 && gameState.board[r][c] === piece) {
        count++;
        winCells.push([r, c]);
        r += dr;
        c += dc;
      }
    }
    
    if (count >= 5) {
      winCells.forEach(([r, c]) => {
        document.querySelector(`.board-cell[data-row="${r}"][data-col="${c}"]`).classList.add('win');
      });
      return true;
    }
  }
  return false;
}

// 井字棋初始化
function initTicTacToe(content, controls) {
  gameState.board = Array(9).fill(null);
  
  const myPiece = gameState.isHost ? 'x' : 'o';
  
  content.innerHTML = `
    <div class="game-info">
      <div class="player-info ${gameState.myTurn ? 'active' : ''}">
        <span class="name">我 (${myPiece.toUpperCase()})</span>
      </div>
      <div class="turn-indicator">${gameState.myTurn ? '你的回合' : '对方回合'}</div>
      <div class="player-info ${!gameState.myTurn ? 'active' : ''}">
        <span class="name">${gameState.opponentInfo?.nickname || '对手'} (${myPiece === 'x' ? 'O' : 'X'})</span>
      </div>
    </div>
    <div class="game-board tictactoe" id="tictactoeBoard">
      ${Array(9).fill(null).map((_, i) => 
        `<div class="board-cell" data-index="${i}" onclick="makeTicTacToeMove(${i})"></div>`
      ).join('')}
    </div>
  `;
  
  controls.innerHTML = `
    <button class="secondary-btn" onclick="closeGamePanel()">退出游戏</button>
  `;
}

// 井字棋落子
function makeTicTacToeMove(index) {
  if (!gameState || !gameState.myTurn) return;
  if (gameState.board[index]) return;
  
  const piece = gameState.isHost ? 'x' : 'o';
  gameState.board[index] = piece;
  
  const cell = document.querySelector(`.board-cell[data-index="${index}"]`);
  cell.classList.add(piece);
  
  socket.emit('game:move', {
    gameId: currentGame,
    move: { index, piece }
  });
  
  gameState.myTurn = false;
  updateTurnIndicator();
  
  const winner = checkTicTacToeWin();
  if (winner) {
    showGameResult(winner === piece ? '你赢了！' : '你输了', winner === piece);
  } else if (gameState.board.every(c => c)) {
    showGameResult('平局！', false);
  }
}

// 检查井字棋胜利
function checkTicTacToeWin() {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // 横
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // 竖
    [0, 4, 8], [2, 4, 6] // 对角
  ];
  
  for (const [a, b, c] of lines) {
    if (gameState.board[a] && gameState.board[a] === gameState.board[b] && gameState.board[a] === gameState.board[c]) {
      [a, b, c].forEach(i => {
        document.querySelector(`.board-cell[data-index="${i}"]`).classList.add('win');
      });
      return gameState.board[a];
    }
  }
  return null;
}

// 猜数字初始化
function initGuessGame(content, controls) {
  gameState.targetNumber = null;
  gameState.guessHistory = [];
  gameState.maxGuesses = 10;
  
  if (gameState.isHost) {
    // 主机设置数字
    content.innerHTML = `
      <div class="guess-game">
        <div class="guess-hint">设置一个1-100的数字让对方猜</div>
        <div class="guess-input-group">
          <input type="number" class="guess-input" id="setNumberInput" min="1" max="100" placeholder="1-100">
          <button class="guess-btn" onclick="setTargetNumber()">确定</button>
        </div>
      </div>
    `;
  } else {
    content.innerHTML = `
      <div class="guess-game">
        <div class="guess-hint">等待对方设置数字...</div>
      </div>
    `;
  }
  
  controls.innerHTML = `
    <button class="secondary-btn" onclick="closeGamePanel()">退出游戏</button>
  `;
}

// 设置目标数字
function setTargetNumber() {
  const input = document.getElementById('setNumberInput');
  const num = parseInt(input.value);
  
  if (isNaN(num) || num < 1 || num > 100) {
    showToast('请输入1-100之间的数字', 'error');
    return;
  }
  
  gameState.targetNumber = num;
  
  socket.emit('game:move', {
    gameId: currentGame,
    move: { action: 'setNumber', number: num }
  });
  
  document.getElementById('gameContent').innerHTML = `
    <div class="guess-game">
      <div class="guess-hint">你设置的数字是: ${num}</div>
      <p>等待对方猜测...</p>
      <div class="guess-history" id="guessHistory"></div>
    </div>
  `;
}

// 石头剪刀布初始化
function initRPSGame(content, controls) {
  gameState.myChoice = null;
  gameState.opponentChoice = null;
  gameState.round = 1;
  gameState.score = { me: 0, opponent: 0 };
  
  content.innerHTML = `
    <div class="rps-game">
      <div class="rps-score">第 ${gameState.round} 局 | ${gameState.score.me} : ${gameState.score.opponent}</div>
      <div class="rps-choices">
        <div class="rps-choice" data-choice="rock" onclick="makeRPSChoice('rock')">🪨</div>
        <div class="rps-choice" data-choice="paper" onclick="makeRPSChoice('paper')">📄</div>
        <div class="rps-choice" data-choice="scissors" onclick="makeRPSChoice('scissors')">✂️</div>
      </div>
      <p>选择你的出拳</p>
    </div>
  `;
  
  controls.innerHTML = `
    <button class="secondary-btn" onclick="closeGamePanel()">退出游戏</button>
  `;
}

// 石头剪刀布出拳
function makeRPSChoice(choice) {
  if (gameState.myChoice) return;
  
  gameState.myChoice = choice;
  
  document.querySelectorAll('.rps-choice').forEach(el => {
    if (el.dataset.choice === choice) {
      el.classList.add('selected');
    }
  });
  
  socket.emit('game:move', {
    gameId: currentGame,
    move: { choice }
  });
  
  if (gameState.opponentChoice) {
    resolveRPSRound();
  } else {
    document.querySelector('.rps-game p').textContent = '等待对方出拳...';
  }
}

// 解决石头剪刀布回合
function resolveRPSRound() {
  const rpsWins = {
    rock: 'scissors',
    paper: 'rock',
    scissors: 'paper'
  };
  
  const choiceEmoji = {
    rock: '🪨',
    paper: '📄',
    scissors: '✂️'
  };
  
  let result;
  if (gameState.myChoice === gameState.opponentChoice) {
    result = 'draw';
  } else if (rpsWins[gameState.myChoice] === gameState.opponentChoice) {
    result = 'win';
    gameState.score.me++;
  } else {
    result = 'lose';
    gameState.score.opponent++;
  }
  
  const content = document.getElementById('gameContent');
  content.innerHTML = `
    <div class="rps-game">
      <div class="rps-score">第 ${gameState.round} 局 | ${gameState.score.me} : ${gameState.score.opponent}</div>
      <div class="rps-vs">
        <div class="rps-player">
          <div class="choice-display ${result === 'win' ? 'win' : result === 'lose' ? 'lose' : ''}">${choiceEmoji[gameState.myChoice]}</div>
          <div class="name">我</div>
        </div>
        <span style="font-size: 24px;">VS</span>
        <div class="rps-player">
          <div class="choice-display ${result === 'lose' ? 'win' : result === 'win' ? 'lose' : ''}">${choiceEmoji[gameState.opponentChoice]}</div>
          <div class="name">${gameState.opponentInfo?.nickname || '对手'}</div>
        </div>
      </div>
      <div class="rps-result ${result}">${result === 'win' ? '你赢了！' : result === 'lose' ? '你输了' : '平局'}</div>
    </div>
  `;
  
  // 检查是否游戏结束（三局两胜）
  if (gameState.score.me >= 2) {
    setTimeout(() => showGameResult('恭喜你赢得比赛！', true), 1500);
  } else if (gameState.score.opponent >= 2) {
    setTimeout(() => showGameResult('很遗憾，你输了', false), 1500);
  } else {
    // 继续下一局
    setTimeout(() => {
      gameState.round++;
      gameState.myChoice = null;
      gameState.opponentChoice = null;
      initRPSGame(content, document.getElementById('gameControls'));
    }, 2000);
  }
}

// 更新回合指示器
function updateTurnIndicator() {
  const indicator = document.querySelector('.turn-indicator');
  if (indicator) {
    indicator.textContent = gameState.myTurn ? '你的回合' : '对方回合';
  }
  
  document.querySelectorAll('.player-info').forEach((el, i) => {
    if ((i === 0 && gameState.myTurn) || (i === 1 && !gameState.myTurn)) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });
}

// 显示游戏结果
function showGameResult(message, isWin) {
  const content = document.getElementById('gameContent');
  content.innerHTML = `
    <div style="text-align: center;">
      <div style="font-size: 64px; margin-bottom: 20px;">${isWin ? '🎉' : '😢'}</div>
      <h2 style="font-size: 28px; margin-bottom: 20px;">${message}</h2>
      <button class="primary-btn" onclick="closeGamePanel()" style="padding: 14px 32px; font-size: 16px; background: var(--primary); color: white; border: none; border-radius: var(--radius-lg); cursor: pointer;">
        返回
      </button>
    </div>
  `;
  
  document.getElementById('gameControls').innerHTML = '';
  document.getElementById('gameStatus').textContent = '游戏结束';
}

// 处理游戏移动
function handleGameMove(data) {
  switch (currentGameType) {
    case 'gomoku':
      if (data.move.row !== undefined) {
        const { row, col, piece } = data.move;
        gameState.board[row][col] = piece;
        const cell = document.querySelector(`.board-cell[data-row="${row}"][data-col="${col}"]`);
        cell.classList.add(piece);
        gameState.myTurn = true;
        updateTurnIndicator();
        
        if (checkGomokuWin(row, col, piece)) {
          showGameResult('你输了', false);
        }
      }
      break;
      
    case 'tictactoe':
      if (data.move.index !== undefined) {
        const { index, piece } = data.move;
        gameState.board[index] = piece;
        const cell = document.querySelector(`.board-cell[data-index="${index}"]`);
        cell.classList.add(piece);
        gameState.myTurn = true;
        updateTurnIndicator();
        
        const winner = checkTicTacToeWin();
        if (winner) {
          const myPiece = gameState.isHost ? 'x' : 'o';
          showGameResult(winner === myPiece ? '你赢了！' : '你输了', winner === myPiece);
        } else if (gameState.board.every(c => c)) {
          showGameResult('平局！', false);
        }
      }
      break;
      
    case 'guess':
      if (data.move.action === 'setNumber') {
        gameState.targetNumber = data.move.number;
        document.getElementById('gameContent').innerHTML = `
          <div class="guess-game">
            <div class="guess-hint">猜一个1-100之间的数字</div>
            <div class="guess-input-group">
              <input type="number" class="guess-input" id="guessInput" min="1" max="100" placeholder="输入你的猜测">
              <button class="guess-btn" onclick="makeGuess()">猜</button>
            </div>
            <div class="guess-history" id="guessHistory"></div>
          </div>
        `;
      } else if (data.move.action === 'guess') {
        const historyEl = document.getElementById('guessHistory');
        const guess = data.move.guess;
        let resultClass = '', resultText = '';
        
        if (guess === gameState.targetNumber) {
          resultClass = 'correct';
          resultText = '正确！';
          setTimeout(() => showGameResult('对方猜中了，你输了', false), 1000);
        } else if (guess > gameState.targetNumber) {
          resultClass = 'high';
          resultText = '太大了';
        } else {
          resultClass = 'low';
          resultText = '太小了';
        }
        
        historyEl.innerHTML = `
          <div class="guess-item">
            <span class="guess-number">${guess}</span>
            <span class="guess-result ${resultClass}">${resultText}</span>
          </div>
        ` + historyEl.innerHTML;
      } else if (data.move.action === 'result') {
        const historyEl = document.getElementById('guessHistory');
        let resultClass = '', resultText = '';
        
        if (data.move.result === 'correct') {
          resultClass = 'correct';
          resultText = '正确！';
          setTimeout(() => showGameResult('恭喜你猜中了！', true), 1000);
        } else if (data.move.result === 'high') {
          resultClass = 'high';
          resultText = '太大了';
        } else {
          resultClass = 'low';
          resultText = '太小了';
        }
        
        historyEl.innerHTML = `
          <div class="guess-item">
            <span class="guess-number">${data.move.guess}</span>
            <span class="guess-result ${resultClass}">${resultText}</span>
          </div>
        ` + historyEl.innerHTML;
      }
      break;
      
    case 'rps':
      gameState.opponentChoice = data.move.choice;
      if (gameState.myChoice) {
        resolveRPSRound();
      }
      break;
  }
}

// 猜数字
function makeGuess() {
  const input = document.getElementById('guessInput');
  const guess = parseInt(input.value);
  
  if (isNaN(guess) || guess < 1 || guess > 100) {
    showToast('请输入1-100之间的数字', 'error');
    return;
  }
  
  input.value = '';
  
  socket.emit('game:move', {
    gameId: currentGame,
    move: { action: 'guess', guess }
  });
}

// ========== 举报系统 ==========
let reportTarget = null;
let reportTargetName = '';

function openReportModal(targetOdp, targetName) {
  reportTarget = targetOdp;
  reportTargetName = targetName;
  closePrivateChatMenu();
  
  // 创建举报弹窗
  let modal = document.getElementById('reportModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'reportModal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 400px;">
        <div class="modal-header">
          <h3><i class="fas fa-flag" style="color: #f59e0b;"></i> 举报用户</h3>
          <button class="close-btn" onclick="closeModal('reportModal')"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body">
          <p style="margin-bottom: 16px;">举报用户：<strong id="reportTargetName"></strong></p>
          <div class="form-group">
            <label>举报类型</label>
            <select id="reportType" style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: var(--radius-sm);">
              <option value="spam">垃圾信息/广告</option>
              <option value="abuse">辱骂/骚扰</option>
              <option value="inappropriate">不当内容</option>
              <option value="scam">诈骗/欺诈</option>
              <option value="other">其他</option>
            </select>
          </div>
          <div class="form-group">
            <label>详细描述</label>
            <textarea id="reportReason" placeholder="请详细描述举报原因..." style="width: 100%; min-height: 100px; padding: 10px; border: 1px solid var(--border); border-radius: var(--radius-sm); resize: vertical;"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="secondary-btn" onclick="closeModal('reportModal')">取消</button>
          <button class="primary-btn" onclick="submitReport()" style="background: #f59e0b;">
            <i class="fas fa-paper-plane"></i> 提交举报
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  
  document.getElementById('reportTargetName').textContent = reportTargetName;
  document.getElementById('reportType').value = 'abuse';
  document.getElementById('reportReason').value = '';
  modal.classList.add('active');
}

function submitReport() {
  const type = document.getElementById('reportType').value;
  const reason = document.getElementById('reportReason').value.trim();
  
  if (!reason) {
    showToast('请填写举报原因', 'error');
    return;
  }
  
  socket.emit('report:user', {
    targetOdp: reportTarget,
    reason: `[${type}] ${reason}`
  });
  
  closeModal('reportModal');
  showToast('举报已提交，管理员会尽快处理', 'success');
  reportTarget = null;
  reportTargetName = '';
}

// 收到举报通知（管理员）
socket.on('report:new', (report) => {
  showToast(`收到新举报：${report.targetName} 被举报 ${report.type}`, 'warning');
});

// ========== 管理员操作 ==========
let warnTarget = null;
let warnTargetName = '';
let muteTarget = null;
let muteTargetName = '';

function openAdminWarnModal(targetOdp, targetName) {
  warnTarget = targetOdp;
  warnTargetName = targetName;
  closePrivateChatMenu();
  
  let modal = document.getElementById('adminWarnModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'adminWarnModal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 400px;">
        <div class="modal-header">
          <h3><i class="fas fa-exclamation-triangle" style="color: #f59e0b;"></i> 警告用户</h3>
          <button class="close-btn" onclick="closeModal('adminWarnModal')"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body">
          <p style="margin-bottom: 16px;">警告用户：<strong id="warnTargetName"></strong></p>
          <div class="form-group">
            <label>警告原因</label>
            <textarea id="warnReason" placeholder="请输入警告原因..." style="width: 100%; min-height: 80px; padding: 10px; border: 1px solid var(--border); border-radius: var(--radius-sm); resize: vertical;"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="secondary-btn" onclick="closeModal('adminWarnModal')">取消</button>
          <button class="primary-btn" onclick="submitWarn()" style="background: #f59e0b;">
            <i class="fas fa-exclamation-triangle"></i> 发送警告
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  
  document.getElementById('warnTargetName').textContent = warnTargetName;
  document.getElementById('warnReason').value = '';
  modal.classList.add('active');
}

function submitWarn() {
  const reason = document.getElementById('warnReason').value.trim();
  
  if (!reason) {
    showToast('请填写警告原因', 'error');
    return;
  }
  
  socket.emit('admin:warnUser', {
    targetOdp: warnTarget,
    reason: reason
  });
  
  closeModal('adminWarnModal');
  showToast('已向用户发送警告', 'success');
  warnTarget = null;
  warnTargetName = '';
}

function openAdminMuteModal(targetOdp, targetName) {
  muteTarget = targetOdp;
  muteTargetName = targetName;
  closePrivateChatMenu();
  
  let modal = document.getElementById('adminMuteModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'adminMuteModal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 400px;">
        <div class="modal-header">
          <h3><i class="fas fa-volume-mute" style="color: #ef4444;"></i> 禁言用户</h3>
          <button class="close-btn" onclick="closeModal('adminMuteModal')"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body">
          <p style="margin-bottom: 16px;">禁言用户：<strong id="muteTargetName"></strong></p>
          <div class="form-group">
            <label>禁言时长</label>
            <select id="muteDuration" style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: var(--radius-sm);">
              <option value="5">5分钟</option>
              <option value="15">15分钟</option>
              <option value="30">30分钟</option>
              <option value="60">1小时</option>
              <option value="1440">24小时</option>
              <option value="10080">7天</option>
            </select>
          </div>
          <div class="form-group">
            <label>禁言原因</label>
            <textarea id="muteReason" placeholder="请输入禁言原因..." style="width: 100%; min-height: 80px; padding: 10px; border: 1px solid var(--border); border-radius: var(--radius-sm); resize: vertical;"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="secondary-btn" onclick="closeModal('adminMuteModal')">取消</button>
          <button class="primary-btn" onclick="submitMute()" style="background: #ef4444;">
            <i class="fas fa-volume-mute"></i> 确认禁言
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  
  document.getElementById('muteTargetName').textContent = muteTargetName;
  document.getElementById('muteDuration').value = '15';
  document.getElementById('muteReason').value = '';
  modal.classList.add('active');
}

function submitMute() {
  const duration = parseInt(document.getElementById('muteDuration').value);
  const reason = document.getElementById('muteReason').value.trim();
  
  if (!reason) {
    showToast('请填写禁言原因', 'error');
    return;
  }
  
  socket.emit('admin:muteUser', {
    targetOdp: muteTarget,
    minutes: duration,
    reason: reason
  });
  
  closeModal('adminMuteModal');
  showToast(`已禁言用户 ${duration} 分钟`, 'success');
  muteTarget = null;
  muteTargetName = '';
}

// 收到管理员警告
socket.on('user:warned', (data) => {
  // 创建警告弹窗
  let warningModal = document.getElementById('warningNotifyModal');
  if (!warningModal) {
    warningModal = document.createElement('div');
    warningModal.id = 'warningNotifyModal';
    warningModal.className = 'modal';
    warningModal.innerHTML = `
      <div class="modal-content" style="max-width: 400px; text-align: center;">
        <div style="padding: 30px 20px;">
          <div style="width: 80px; height: 80px; margin: 0 auto 20px; border-radius: 50%; background: #fef3c7; display: flex; align-items: center; justify-content: center;">
            <i class="fas fa-exclamation-triangle" style="font-size: 40px; color: #f59e0b;"></i>
          </div>
          <h3 style="font-size: 20px; margin-bottom: 10px; color: #f59e0b;">系统警告</h3>
          <p style="color: var(--text-secondary); margin-bottom: 20px;">管理员向您发出了警告</p>
          <div style="background: #fef3c7; padding: 15px; border-radius: var(--radius-sm); margin-bottom: 20px; text-align: left;">
            <strong>警告原因：</strong>
            <p id="warningReason" style="margin-top: 5px;"></p>
          </div>
          <p style="font-size: 12px; color: var(--text-muted);" id="warningCount"></p>
          <button class="primary-btn" onclick="closeModal('warningNotifyModal')" style="width: 100%; margin-top: 15px;">我知道了</button>
        </div>
      </div>
    `;
    document.body.appendChild(warningModal);
  }
  
  document.getElementById('warningReason').textContent = data.reason;
  document.getElementById('warningCount').textContent = `您已被警告 ${data.warningCount} 次`;
  warningModal.classList.add('active');
});

// 暴露全局函数
window.openGamesModal = openGamesModal;
window.selectGame = selectGame;
window.sendGameInvite = sendGameInvite;
window.acceptGameInvite = acceptGameInvite;
window.declineGameInvite = declineGameInvite;
window.closeGamePanel = closeGamePanel;
window.makeGomokuMove = makeGomokuMove;
window.makeTicTacToeMove = makeTicTacToeMove;
window.setTargetNumber = setTargetNumber;
window.makeGuess = makeGuess;
window.makeRPSChoice = makeRPSChoice;
window.openReportModal = openReportModal;
window.submitReport = submitReport;
window.openAdminWarnModal = openAdminWarnModal;
window.submitWarn = submitWarn;
window.openAdminMuteModal = openAdminMuteModal;
window.submitMute = submitMute;