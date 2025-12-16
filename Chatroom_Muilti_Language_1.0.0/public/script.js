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

// Page elements
let loginPage = null;
let mainPage = null; // Actually mainApp in HTML

// ===== 1.0.0 增强功能 =====
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY_BASE = 1000;
let isConnected = false;
let connectionStatus = 'disconnected'; // 'connected', 'connecting', 'disconnected'
let messageQueue = []; // 消息队列（带确认）
let pendingMessages = new Map(); // 待确认的消息
let messageIdCounter = 0;
const processedMessageIds = new Set(); // 消息去重集合
let lastMessageTime = 0;
const MESSAGE_DEBOUNCE_MS = 150; // 消息发送防抖
let unreadCounts = {}; // 每个聊天的未读消息计数
let notificationPermission = 'default'; // 浏览器通知权限

// ===== 游戏变量 =====
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

// ===== Emoji List =====
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

// ===== Init App (for auto-login) =====
function initApp() {
  // Initialize all necessary components after auto-login
  initSocket();
  initEventListeners();
  initEmojiPanel();
  updateServerAddress();
  initConnectionStatusIndicator();
  
  // Connect socket with current user
  if (currentUser && socket) {
    socket.emit('authenticate', currentUser);
  }
}

// ===== Initialization =====
document.addEventListener('DOMContentLoaded', async () => {
  // Get page elements
  loginPage = document.getElementById('loginPage');
  mainPage = document.getElementById('mainApp'); // Main application page
  
  // Check if already auto-logged in by inline script
  const alreadyAutoLoggedIn = localStorage.getItem('auto_login_success') === 'true' && window._autoLoginUser;
  
  if (alreadyAutoLoggedIn) {
    console.log('[script.js] 检测到内联脚本已自动登录，直接初始化');
    currentUser = window._autoLoginUser;
    localStorage.removeItem('auto_login_success'); // 清除标记
    initApp();
    return;
  }
  
  // Check auto-login for SuperAdmin (127.0.0.1 only) - fallback
  const autoLoggedIn = await checkAutoLogin();
  if (autoLoggedIn) {
    console.log('[自动登录] 成功，切换到主界面');
    // Auto-login successful, hide login page and show main interface
    if (loginPage) {
      loginPage.style.display = 'none';
      loginPage.classList.remove('active');
    }
    if (mainPage) {
      mainPage.style.display = 'flex';
      mainPage.classList.add('active');
    }
    initApp();
    return;
  }
  
  // Request notification permission
  await requestNotificationPermission();
  
  initSocket();
  initEventListeners();
  initEmojiPanel();
  updateServerAddress();
  initConnectionStatusIndicator();
});

// ===== Connection Status Indicator (1.0.0) =====
function initConnectionStatusIndicator() {
  // Create status indicator if not exists
  if (!document.querySelector('.connection-status')) {
    const indicator = document.createElement('div');
    indicator.className = 'connection-status disconnected';
    indicator.innerHTML = '<span class="status-dot"></span><span class="status-text">Disconnected</span>';
    document.body.appendChild(indicator);
  }
}

function updateConnectionStatus(status) {
  connectionStatus = status;
  const indicator = document.querySelector('.connection-status');
  if (!indicator) return;
  
  indicator.className = 'connection-status ' + status;
  const statusText = {
    'connected': '已连接',
    'connecting': '连接中...',
    'disconnected': '未连接'
  };
  indicator.querySelector('.status-text').textContent = statusText[status] || status;
}

// ===== Browser Notification System (1.0.0) =====
async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.log('Browser does not support notifications');
    return;
  }
  
  notificationPermission = Notification.permission;
  
  if (notificationPermission === 'default') {
    // Will request permission when user first uses the app
    console.log('Notification permission not yet requested');
  }
}

async function askNotificationPermission() {
  if (!('Notification' in window)) return;
  
  if (Notification.permission === 'default') {
    const permission = await Notification.requestPermission();
    notificationPermission = permission;
    
    if (permission === 'granted') {
      showToast('通知已启用', 'success');
    }
  }
}

function showBrowserNotification(title, options = {}) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  
  // Don't show notification if window is focused and chat is open
  if (document.hasFocus() && currentChat && 
      ((options.chatType === 'private' && currentChat.id === options.senderId) ||
       (options.chatType === 'room' && currentChat.id === options.roomId))) {
    return;
  }
  
  const notification = new Notification(title, {
    icon: options.icon || '/uploads/default-avatar.png',
    body: options.body || '',
    tag: options.tag || 'chatroom-notification',
    requireInteraction: false
  });
  
  notification.onclick = () => {
    window.focus();
    if (options.onClick) options.onClick();
    notification.close();
  };
  
  // Auto close after 5 seconds
  setTimeout(() => notification.close(), 5000);
}

// ===== Unread Message Management (1.0.0) =====
function incrementUnread(chatId, chatType) {
  // Don't count if chat is currently open
  if (currentChat && currentChat.id === chatId) return;
  
  if (!unreadCounts[chatId]) {
    unreadCounts[chatId] = { count: 0, type: chatType };
  }
  unreadCounts[chatId].count++;
  
  updateUnreadBadges();
  updateBrowserTabTitle();
}

function clearUnread(chatId) {
  if (unreadCounts[chatId]) {
    unreadCounts[chatId].count = 0;
  }
  updateUnreadBadges();
  updateBrowserTabTitle();
}

function updateUnreadBadges() {
  // Update contact list badges
  Object.keys(unreadCounts).forEach(chatId => {
    const count = unreadCounts[chatId].count;
    const contactElement = document.querySelector(`[data-user-odp="${chatId}"], [data-room-id="${chatId}"]`);
    
    if (contactElement) {
      let badge = contactElement.querySelector('.unread-badge');
      
      if (count > 0) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'unread-badge';
          contactElement.appendChild(badge);
        }
        badge.textContent = count > 99 ? '99+' : count;
        badge.style.display = 'block';
      } else if (badge) {
        badge.style.display = 'none';
      }
    }
  });
}

function updateBrowserTabTitle() {
  const totalUnread = Object.values(unreadCounts).reduce((sum, item) => sum + item.count, 0);
  
  if (totalUnread > 0) {
    document.title = `(${totalUnread}) Same-Network Chatroom`;
  } else {
    document.title = 'Same-Network Chatroom';
  }
}

// ===== Message Queue System (1.0.0) =====
function generateMessageId() {
  return `msg_${Date.now()}_${++messageIdCounter}`;
}

function sendMessageWithQueue(event, data) {
  const msgId = generateMessageId();
  const message = {
    id: msgId,
    event: event,
    data: data,
    timestamp: Date.now(),
    retries: 0
  };
  
  if (isConnected) {
    socket.emit(event, { ...data, _msgId: msgId });
    pendingMessages.set(msgId, message);
    
    // Remove from pending after timeout (assume success)
    setTimeout(() => {
      pendingMessages.delete(msgId);
    }, 5000);
  } else {
    // Queue for later
    messageQueue.push(message);
    showToast('消息已排队 - 重连后将发送', 'warning');
  }
}

function processPendingMessages() {
  // Send queued messages
  while (messageQueue.length > 0 && isConnected) {
    const message = messageQueue.shift();
    socket.emit(message.event, { ...message.data, _msgId: message.id });
    pendingMessages.set(message.id, message);
  }
  
  // Retry failed messages
  pendingMessages.forEach((message, msgId) => {
    if (Date.now() - message.timestamp > 5000 && message.retries < 3) {
      message.retries++;
      socket.emit(message.event, { ...message.data, _msgId: msgId });
    } else if (message.retries >= 3) {
      pendingMessages.delete(msgId);
      showToast('消息发送失败', 'error');
    }
  });
}

// ===== Check Auto Login =====
async function checkAutoLogin() {
  try {
    const res = await fetch('/api/auto-login');
    const data = await res.json();
    
    if (data.autoLogin && data.user) {
      console.log('[自动登录] 检测到本地访问，自动登录为超级管理员');
      currentUser = data.user;
      localStorage.setItem('chatroom_user', JSON.stringify(currentUser));
      // 标记为已自动登录
      window.autoLoggedIn = true;
      return true;
    }
    return false;
  } catch (e) {
    console.log('[自动登录] 检查失败:', e);
    return false;
  }
}

// ===== Socket Initialization (1.0.0 Enhanced Reconnection) =====
function initSocket() {
  updateConnectionStatus('connecting');
  
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
    updateConnectionStatus('connected');
    
    // 处理待发送消息
    processPendingMessages();
    
    // 如果存在保存的用户信息，尝试恢复会话
    const savedUser = localStorage.getItem('chatroom_user');
    
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        console.log('[自动恢复] 尝试恢复会话:', user.username);
        socket.emit('session:restore', { odp: user.odp, username: user.username });
      } catch (e) {
        console.log('[自动恢复] 解析用户信息失败');
        localStorage.removeItem('chatroom_user');
      }
    }
  });
  
  socket.on('disconnect', (reason) => {
    console.log('Disconnected from server:', reason);
    isConnected = false;
    updateConnectionStatus('disconnected');
    
    // Only show disconnect message in main app
    if (currentUser) {
      if (reason === 'io server disconnect') {
        showToast('被服务器断开连接', 'error');
      } else {
        showToast('连接丢失，正在重连...', 'warning');
      }
    }
  });
  
  // 1.0.0: Enhanced reconnection event handling
  socket.on('reconnect_attempt', (attemptNumber) => {
    reconnectAttempts = attemptNumber;
    updateConnectionStatus('connecting');
    console.log(`[Reconnect] Attempt ${attemptNumber}...`);
    if (attemptNumber > 3) {
      showToast(`正在重连 (第 ${attemptNumber} 次尝试)...`, 'warning');
    }
  });
  
  socket.on('reconnect', () => {
    console.log('[Reconnect] Success');
    isConnected = true;
    updateConnectionStatus('connected');
    showToast('重连成功', 'success');
    
    // Restore state after reconnection
    if (currentUser) {
      socket.emit('users:getOnline');
      socket.emit('friends:get');
      
      // Restore current chat if any
      if (currentChat) {
        if (currentChat.type === 'private') {
          loadPrivateMessages(currentChat.id);
        } else if (currentChat.type === 'room') {
          loadRoomMessages(currentChat.id);
        }
      }
    }
  });
  
  socket.on('reconnect_failed', () => {
    console.log('[Reconnect] Failed');
    updateConnectionStatus('disconnected');
    showToast('无法连接服务器，请检查网络', 'error');
  });
  
  socket.on('connect_error', (error) => {
    console.log('[Connect Error]', error);
    updateConnectionStatus('disconnected');
  });
  
  // 会话恢复成功
  socket.on('session:restored', (data) => {
    console.log('[会话恢复] 成功:', data.user.nickname);
    console.log('[会话恢复] 用户数据:', data.user);
    currentUser = data.user;
    localStorage.setItem('chatroom_user', JSON.stringify(currentUser));
    
    // 立即显示主界面
    setTimeout(() => {
      showMainApp();
    }, 100);
    
    // 首次登录时请求通知权限
    askNotificationPermission();
  });
  
  // 会话恢复失败
  socket.on('session:fail', () => {
    console.log('[会话恢复] 失败，需要重新登录');
    localStorage.removeItem('chatroom_user');
    currentUser = null;
    window.autoLoggedIn = false;
    // 只有不在登录页面时才重定向
    const loginPage = document.getElementById('loginPage');
    if (!loginPage || !loginPage.classList.contains('active')) {
      showLoginPage();
    }
  });
  
  // Registration successful
  socket.on('register:success', (data) => {
    currentUser = data.user;
    localStorage.setItem('chatroom_user', JSON.stringify(currentUser));
    showMainApp();
    showToast('注册成功！', 'success');
  });
  
  // Registration failed
  socket.on('register:fail', (data) => {
    showToast(data.message || '注册失败', 'error');
  });
  
  // Login successful
  socket.on('login:success', (data) => {
    currentUser = data.user;
    localStorage.setItem('chatroom_user', JSON.stringify(currentUser));
    showMainApp();
    showToast('登录成功！', 'success');
  });
  
  // Login failed
  socket.on('login:fail', (data) => {
    showToast(data.message || '登录失败', 'error');
  });
  
  // Forced offline
  socket.on('force:logout', (data) => {
    showToast(data.message || '您已被强制下线', 'error');
    logout();
  });
  
  // Online users list
  socket.on('users:list', (data) => {
    // Server sends array directly
    const userList = Array.isArray(data) ? data : (data.users || []);
    // Update online users list
    onlineUsers = userList.map(u => ({ ...u, online: true }));
    // Update contacts (merge online users)
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
  
  // Also listen to users:online (compatibility)
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
  
  // User online
  socket.on('user:online', (user) => {
    // Update onlineUsers
    const existingOnline = onlineUsers.find(u => u.odp === user.odp);
    if (!existingOnline) {
      onlineUsers.push({ ...user, online: true });
    }
    
    const existing = contacts.find(c => c.odp === user.odp);
    if (!existing && user.odp !== currentUser?.odp) {
      contacts.push({ ...user, online: true });
      renderContacts();
      updateOnlineCount();
      showToast(`${user.nickname} 已上线`, 'info');
    } else if (existing) {
      existing.online = true;
      renderContacts();
      updateOnlineCount();
    }
  });
  
  // User offline
  socket.on('user:offline', (data) => {
    // Remove from onlineUsers
    onlineUsers = onlineUsers.filter(u => u.odp !== data.odp);
    
    const contact = contacts.find(c => c.odp === data.odp);
    if (contact) {
      contact.online = false;
      renderContacts();
      updateOnlineCount();
    }
  });
  
  // Received private message (Beta 0.1.0 Deduplication)
  socket.on('message:private', (msg) => {
    // Message deduplication check
    if (msg.id && processedMessageIds.has(msg.id)) {
      console.log('[Dedup] Skipping duplicate message:', msg.id);
      return;
    }
    if (msg.id) {
      processedMessageIds.add(msg.id);
      // Limit set size to prevent memory leak
      if (processedMessageIds.size > 1000) {
        const arr = Array.from(processedMessageIds);
        arr.splice(0, 500).forEach(id => processedMessageIds.delete(id));
      }
    }
    
    const senderId = msg.from || msg.senderId;
    const receiverId = msg.to || msg.receiverId;
    
    // Determine chat partner ID
    const chatPartnerId = senderId === currentUser.odp ? receiverId : senderId;
    
    // Store message
    if (!chatMessages[chatPartnerId]) chatMessages[chatPartnerId] = [];
    
    // Avoid duplicate messages
    const exists = chatMessages[chatPartnerId].find(m => m.id === msg.id);
    if (!exists) {
      chatMessages[chatPartnerId].push(msg);
    }
    
    // If currently chatting with this person, display message
    if (currentChat && currentChat.type === 'private' && currentChat.id === chatPartnerId) {
      if (!exists) {
        appendMessage(msg);
        scrollToBottom();
        // Clear unread when viewing
        clearUnread(chatPartnerId);
      }
    } else if (senderId !== currentUser.odp) {
      // 1.0.0: Increment unread count
      incrementUnread(chatPartnerId, 'private');
      
      // Show browser notification
      showBrowserNotification(
        msg.senderName || 'New Message',
        {
          body: getMessagePreview(msg),
          icon: msg.senderAvatar || '/uploads/default-avatar.png',
          chatType: 'private',
          senderId: chatPartnerId,
          onClick: () => {
            // Open the chat when notification is clicked
            const contact = contacts.find(c => c.odp === chatPartnerId);
            if (contact) {
              openPrivateChat(contact);
            }
          }
        }
      );
      
      // Show toast notification
      showToast(`${msg.senderName}: ${getMessagePreview(msg)}`, 'info');
    }
    
    // Update chat list
    updateChatList();
  });
  
  // 1.0.0: 处理离线消息（消息队列）
  socket.on('message:offline', (msg) => {
    console.log('[离线消息] 收到排队消息:', msg);
    
    // 与普通私聊消息相同的处理
    const senderId = msg.from || msg.senderId;
    const receiverId = msg.to || msg.receiverId;
    const chatPartnerId = senderId === currentUser.odp ? receiverId : senderId;
    
    // 存储消息
    if (!chatMessages[chatPartnerId]) chatMessages[chatPartnerId] = [];
    
    // 避免重复消息
    const exists = chatMessages[chatPartnerId].find(m => m.id === msg.id);
    if (!exists) {
      chatMessages[chatPartnerId].push(msg);
      
      // 增加未读计数（仅当不在查看此聊天时）
      if (!currentChat || currentChat.type !== 'private' || currentChat.id !== chatPartnerId) {
        incrementUnread(chatPartnerId, 'private');
      }
    }
    
    // 更新聊天列表以显示新消息
    updateChatList();
    
    // 如果正在查看此聊天，显示消息
    if (currentChat && currentChat.type === 'private' && currentChat.id === chatPartnerId) {
      if (!exists) {
        appendMessage(msg);
        scrollToBottom();
        clearUnread(chatPartnerId);
      }
    }
  });
  
  // Received group message
  socket.on('message:room', (msg) => {
    const roomId = msg.roomId;
    if (!chatMessages[roomId]) chatMessages[roomId] = [];
    
    // Avoid duplicate messages
    const exists = chatMessages[roomId].find(m => m.id === msg.id);
    if (!exists) {
      chatMessages[roomId].push(msg);
    }
    
    if (currentChat && currentChat.type === 'room' && currentChat.id === roomId) {
      if (!exists) {
        appendMessage(msg);
        scrollToBottom();
        // Clear unread when viewing
        clearUnread(roomId);
      }
    } else if (msg.senderId !== currentUser.odp) {
      // 1.0.0: Increment unread count
      incrementUnread(roomId, 'room');
      
      // Check for @mentions
      const isMentioned = msg.content && msg.content.includes(`@${currentUser.nickname}`);
      
      // Show browser notification (with higher priority for @mentions)
      if (isMentioned || Math.random() > 0.7) { // Show some room messages
        showBrowserNotification(
          `${msg.roomName || 'Group'}${isMentioned ? ' (mentioned you)' : ''}`,
          {
            body: `${msg.senderName}: ${getMessagePreview(msg)}`,
            icon: msg.roomAvatar || '/uploads/default-avatar.png',
            chatType: 'room',
            roomId: roomId,
            onClick: () => {
              // Open the room when notification is clicked
              const room = rooms.find(r => r.id === roomId);
              if (room) {
                openRoomChat(room);
              }
            }
          }
        );
      }
      
      // Show toast for @mentions
      if (isMentioned) {
        showToast(`在 ${msg.roomName} @了你: ${msg.senderName} - ${getMessagePreview(msg)}`, 'info');
      }
    }
      showToast(`[${msg.roomName}] ${msg.senderName}: ${getMessagePreview(msg)}`, 'info');
    }
    
    updateChatList();
  });
  
  // Group chat list
  socket.on('rooms:list', (data) => {
    rooms = data.rooms || [];
    updateGroupCount();
  });
  
  // Group created successfully
  socket.on('room:created', (room) => {
    rooms.push(room);
    updateGroupCount();
    showToast(`群组 "${room.name}" 创建成功`, 'success');
    closeModal('createGroupModal');
  });
  
  // Join group
  socket.on('room:joined', (room) => {
    if (!rooms.find(r => r.id === room.id)) {
      rooms.push(room);
      updateGroupCount();
    }
  });
  
  // Other user is typing
  socket.on('user:typing', (data) => {
    if (currentChat && currentChat.type === 'private' && currentChat.id === data.from) {
      showTypingIndicator();
    }
  });
  
  // Message history
  socket.on('messages:history', (data) => {
    const chatId = data.chatId;
    chatMessages[chatId] = data.messages || [];
    if (currentChat && (currentChat.id === chatId || getChatId(currentUser.odp, currentChat.id) === chatId)) {
      renderMessages();
    }
  });
  
  // ===== Friend System Events =====
  socket.on('friend:requests', (requests) => {
    console.log('[Friend Request] Received request list:', requests.length, 'items');
    pendingFriendRequests = requests;
    renderFriendRequests(requests);
    updateFriendRequestBadge();
  });
  
  socket.on('friend:newRequest', (request) => {
    console.log('[Friend Request] Received new request:', request.senderInfo?.nickname);
    showToast(`${request.senderInfo?.nickname || '某人'} 想添加你为好友`, 'info');
    // Refresh friend request list
    socket.emit('friend:getRequests');
  });
  
  socket.on('friend:added', (data) => {
    showToast(`你和 ${data.friendInfo.nickname} 已成为好友`, 'success');
    // Update contacts list
    const contact = contacts.find(c => c.odp === data.friendOdp);
    if (contact) {
      contact.isFriend = true;
    }
    renderContacts();
    // Refresh friend request list
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
    // Update friend status, including offline friends
    friendsList.forEach(friend => {
      const existingContact = contacts.find(c => c.odp === friend.odp);
      if (existingContact) {
        existingContact.isFriend = true;
        existingContact.online = friend.online;
      } else {
        // Add offline friends to contacts list
        contacts.push({
          ...friend,
          isFriend: true
        });
      }
    });
    renderContacts();
  });
  
  // ===== Message Error =====
  socket.on('message:error', (data) => {
    if (data.type === 'mute' && data.detail) {
      // Show mute details popup
      showMuteAlert(data.detail);
    } else {
      showToast(data.message, 'error');
    }
  });
  
  // ===== User Muted =====
  socket.on('user:muted', (data) => {
    showMuteAlert(data);
  });
  
  socket.on('user:unmuted', () => {
    showToast('禁言已解除', 'success');
    closeMuteAlert();
  });
  
  // ===== Role Changed =====
  socket.on('user:roleChanged', (data) => {
    currentUser.role = data.role;
    currentUser.roleInfo = data.roleInfo;
    localStorage.setItem('chatroom_user', JSON.stringify(currentUser));
    showToast(`你的角色已更改为: ${data.roleInfo.badge || data.role}`, 'info');
    updateProfileDisplay();
  });
  
  // ===== Group Management =====
  socket.on('room:kicked', (data) => {
    showToast(`你已被移出群组 "${data.roomName}"`, 'error');
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
    // If viewing this group settings, update member list
    if (currentSettingsRoomId === room.id) {
      document.getElementById('roomNameInput').value = room.name || '';
      document.getElementById('memberCountBadge').textContent = `(${room.members.length} members)`;
      renderRoomMembers(room);
    }
    renderContacts();
  });
  
  socket.on('room:inviteSuccess', (data) => {
    showToast(`成功邀请了 ${data.count} 人`, 'success');
  });
  
  socket.on('room:error', (data) => {
    showToast(data.message, 'error');
  });
  
  // ===== Moments =====
  socket.on('moments:list', (data) => {
    moments = data || [];
    renderMomentsList();
  });
  
  socket.on('moments:new', (moment) => {
    moments.unshift(moment);
    renderMomentsList();
  });
  
  socket.on('moments:updated', (updatedMoment) => {
    // Beta 0.1.0: Fixed moments comment not refreshing
    const idx = moments.findIndex(m => m.id === updatedMoment.id);
    if (idx !== -1) {
      // Preserve local data fields, merge update
      moments[idx] = { ...moments[idx], ...updatedMoment };
      // Force re-render
      requestAnimationFrame(() => {
        renderMomentsList();
      });
    } else {
      // If not in local list, add to list
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

  // ===== Game System Socket Events =====
  // Received game invite
  socket.on('game:invited', (data) => {
    pendingGameInvite = data;
    
    const toast = document.getElementById('gameInviteToast');
    const avatarEl = document.getElementById('inviteAvatar');
    
    if (data.fromInfo?.avatar) {
      avatarEl.innerHTML = `<img src="${data.fromInfo.avatar}" alt="">`;
    } else {
      avatarEl.innerHTML = `<i class="fas fa-user"></i>`;
    }
    
    document.getElementById('inviteFrom').textContent = data.fromInfo?.nickname || 'Someone';
    document.getElementById('inviteGame').textContent = GAME_NAMES[data.gameType];
    
    toast.classList.add('active');
    
    // Auto close after 10 seconds
    setTimeout(() => {
      if (pendingGameInvite && pendingGameInvite.gameId === data.gameId) {
        declineGameInvite();
      }
    }, 10000);
  });

  // Game start
  socket.on('game:start', (data) => {
    currentGame = data.gameId;
    document.getElementById('gameStatus').textContent = 'In Game';
    document.getElementById('gameStatus').classList.add('playing');
    initGameContent(currentGameType);
  });

  // Received opponent move
  socket.on('game:move', (data) => {
    if (!gameState) return;
    handleGameMove(data);
  });

  // Opponent left game
  socket.on('game:left', () => {
    showToast('对手已离开游戏', 'warning');
    showGameResult('对手离开了游戏', true);
  });

  // Invite declined
  socket.on('game:declined', () => {
    showToast('对手拒绝了游戏邀请', 'info');
    closeGamePanel();
  });

  // ===== Poke =====
  socket.on('user:poked', (data) => {
    showPokeAnimation(data.from, data.fromNickname);
  });

  // ===== Message Reactions =====
  socket.on('message:reacted', (data) => {
    updateMessageReaction(data);
  });
}

// Beta 0.1.0: Fixed poke animation for better browser compatibility
function showPokeAnimation(fromId, fromNickname) {
  // Remove old animation elements
  document.querySelectorAll('.poke-animation, .poke-toast').forEach(el => el.remove());
  
  // Create poke animation
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
  
  // Create toast
  const toastEl = document.createElement('div');
  toastEl.className = 'poke-toast';
  toastEl.textContent = `${fromNickname || 'Someone'} poked you!`;
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
  
  // Vibration effect (if supported)
  try {
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100, 50, 100]);
    }
  } catch (e) {
    console.log('Vibration API not supported');
  }
  
  // Play sound effect (use try-catch to prevent errors)
  try {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleVkbCitejcSdXjEcKnOt07RhGwk5gsGwdzgCL22k1bNjKB47WkabUSwdL25nh');
    audio.volume = 0.3;
    audio.play().catch(() => {});
  } catch (e) {
    console.log('Sound playback failed');
  }
  
  // Remove after 3 seconds
  setTimeout(() => {
    pokeEl.remove();
    toastEl.remove();
  }, 3000);
}

function updateMessageReaction(data) {
  const { messageId, reactions, roomId, recipientId } = data;
  
  // Update local message data
  let messages;
  if (roomId) {
    messages = roomMessages[roomId] || [];
  } else if (recipientId) {
    // Private messages may be under two keys
    messages = privateMessages[recipientId] || privateMessages[data.senderId] || [];
  }
  
  const msgIdx = messages?.findIndex(m => m.id === messageId);
  if (msgIdx !== -1 && messages) {
    messages[msgIdx].reactions = reactions;
    
    // If viewing this chat, re-render
    if (currentChat) {
      if ((roomId && currentChat.id === roomId) || 
          (recipientId && (currentChat.id === recipientId || currentChat.id === data.senderId))) {
        renderMessages();
      }
    }
  }
}

// ===== Event Listeners Initialization =====
function initEventListeners() {
  // Login/register form toggle
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
  
  // Login button
  document.getElementById('loginBtn')?.addEventListener('click', login);
  
  // Register button
  document.getElementById('registerBtn')?.addEventListener('click', register);
  
  // Enter to login
  document.getElementById('loginPassword')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') login();
  });
  
  document.getElementById('registerConfirmPassword')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') register();
  });
  
  // Avatar upload
  document.getElementById('avatarInput')?.addEventListener('change', handleAvatarUpload);
  
  // Navigation toggle
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => switchTab(item.dataset.tab));
  });
  
  // Search
  document.getElementById('searchBtn')?.addEventListener('click', toggleSearch);
  document.getElementById('searchCancel')?.addEventListener('click', toggleSearch);
  document.getElementById('searchInput')?.addEventListener('input', handleSearch);
  
  // Add chat
  document.getElementById('addChatBtn')?.addEventListener('click', showAddChatMenu);
  
  // Create group
  document.getElementById('newGroupBtn')?.addEventListener('click', () => openModal('createGroupModal'));
  document.getElementById('closeGroupModal')?.addEventListener('click', () => closeModal('createGroupModal'));
  document.getElementById('cancelGroupBtn')?.addEventListener('click', () => closeModal('createGroupModal'));
  document.getElementById('confirmGroupBtn')?.addEventListener('click', createGroup);
  
  // Group chat list
  document.getElementById('groupChatsBtn')?.addEventListener('click', showGroupList);
  
  // Chat window
  document.getElementById('backBtn')?.addEventListener('click', closeChat);
  document.getElementById('sendBtn')?.addEventListener('click', sendMessage);
  document.getElementById('messageInput')?.addEventListener('keydown', handleMessageKeydown);
  document.getElementById('messageInput')?.addEventListener('input', handleTyping);
  document.getElementById('chatMenuBtn')?.addEventListener('click', openChatMenu);
  
  // Emoji panel
  document.getElementById('emojiBtn')?.addEventListener('click', toggleEmojiPanel);
  
  // Attachment panel
  document.getElementById('attachBtn')?.addEventListener('click', toggleAttachPanel);
  document.getElementById('attachImage')?.addEventListener('click', () => document.getElementById('imageInput').click());
  document.getElementById('attachVideo')?.addEventListener('click', () => document.getElementById('videoInput').click());
  document.getElementById('attachFile')?.addEventListener('click', () => document.getElementById('fileInput').click());
  document.getElementById('attachCamera')?.addEventListener('click', () => document.getElementById('cameraInput').click());
  document.getElementById('attachVoice')?.addEventListener('click', showVoiceRecordingTip);
  
  // File upload
  document.getElementById('imageInput')?.addEventListener('change', (e) => uploadFile(e, 'image'));
  document.getElementById('videoInput')?.addEventListener('change', (e) => uploadFile(e, 'video'));
  document.getElementById('fileInput')?.addEventListener('change', (e) => uploadFile(e, 'file'));
  document.getElementById('cameraInput')?.addEventListener('change', (e) => uploadFile(e, 'image'));
  
  // Voice recording (hold to talk)
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
  
  // Voice recording old method (compatible)
  document.getElementById('voiceBtn')?.addEventListener('mousedown', startRecording);
  document.getElementById('voiceBtn')?.addEventListener('mouseup', stopRecording);
  document.getElementById('voiceBtn')?.addEventListener('mouseleave', cancelRecording);
  document.getElementById('voiceBtn')?.addEventListener('touchstart', startRecording);
  document.getElementById('voiceBtn')?.addEventListener('touchend', stopRecording);
  
  // Image preview
  document.getElementById('closePreview')?.addEventListener('click', closeImagePreview);
  document.getElementById('imagePreviewModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'imagePreviewModal') closeImagePreview();
  });
  
  // Cancel reply
  document.getElementById('replyCancelBtn')?.addEventListener('click', cancelReply);
  
  // Theme toggle
  document.getElementById('darkModeToggle')?.addEventListener('change', toggleDarkMode);
  
  // Discover page functions
  document.getElementById('momentsBtn')?.addEventListener('click', openMoments);
  document.getElementById('onlineUsersBtn')?.addEventListener('click', openOnlineUsers);
  document.getElementById('broadcastBtn')?.addEventListener('click', openBroadcast);
  document.getElementById('helpBtn')?.addEventListener('click', openHelp);
  
  // Moments related
  document.getElementById('postMomentBtn')?.addEventListener('click', () => openModal('postMomentModal'));
  document.getElementById('submitMomentBtn')?.addEventListener('click', submitMoment);
  document.getElementById('addMomentImage')?.addEventListener('click', () => document.getElementById('momentImageInput').click());
  document.getElementById('momentImageInput')?.addEventListener('change', handleMomentImages);
  
  // Profile page functions
  document.getElementById('editProfileBtn')?.addEventListener('click', openEditProfile);
  document.getElementById('settingsBtn')?.addEventListener('click', () => openModal('settingsModal'));
  document.getElementById('aboutBtn')?.addEventListener('click', () => openModal('aboutModal'));
  document.getElementById('saveProfileBtn')?.addEventListener('click', saveProfile);
  document.getElementById('changeAvatarBtn')?.addEventListener('click', () => document.getElementById('editAvatarInput').click());
  document.getElementById('editAvatarInput')?.addEventListener('change', handleEditAvatar);
  
  // Settings page functions
  document.getElementById('logoutBtn')?.addEventListener('click', logout);
  document.getElementById('changePasswordBtn')?.addEventListener('click', () => openModal('changePasswordModal'));
  document.getElementById('submitPasswordBtn')?.addEventListener('click', changePassword);
  document.getElementById('clearCacheBtn')?.addEventListener('click', clearCache);
  
  // Click blank area to close panel
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

// ===== Login =====
function login() {
  const username = document.getElementById('loginUsername')?.value.trim();
  const password = document.getElementById('loginPassword')?.value;
  
  if (!username || !password) {
    showToast('请输入用户名和密码', 'error');
    return;
  }
  
  socket.emit('user:login', { username, password });
}

// ===== Password validation =====
function validatePassword(password) {
  if (password.length < 6) {
    return { valid: false, message: '密码至少需要6个字符' };
  }
  if (!/[a-zA-Z]/.test(password)) {
    return { valid: false, message: '密码必须包含至少一个字母' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: '密码必须包含至少一个数字' };
  }
  return { valid: true };
}

// ===== Username validation =====
function validateUsername(username) {
  if (username.length < 3 || username.length > 20) {
    return { valid: false, message: '用户名必须为3-20个字符' };
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return { valid: false, message: '用户名只能包含字母、数字和下划线' };
  }
  return { valid: true };
}

// ===== Register =====
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
  
  // Validate username
  const usernameCheck = validateUsername(username);
  if (!usernameCheck.valid) {
    showToast(usernameCheck.message, 'error');
    return;
  }
  
  // Validate password
  const passwordCheck = validatePassword(password);
  if (!passwordCheck.valid) {
    showToast(passwordCheck.message, 'error');
    // Highlight password hint
    const hint = document.getElementById('passwordHint');
    if (hint) {
      hint.style.color = '#E74C3C';
      setTimeout(() => hint.style.color = '', 3000);
    }
    return;
  }
  
  if (password !== confirmPassword) {
    showToast('两次密码不一致', 'error');
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

// ===== Logout =====
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
  
  // Clear form
  document.getElementById('loginUsername').value = '';
  document.getElementById('loginPassword').value = '';
}

// ===== Show login page =====
function showLoginPage() {
  const loginPage = document.getElementById('loginPage');
  const mainApp = document.getElementById('mainApp');
  
  mainApp.classList.remove('active');
  mainApp.style.display = 'none';
  loginPage.classList.add('active');
  loginPage.style.display = 'block';
  
  // Clear form
  document.getElementById('loginUsername').value = '';
  document.getElementById('loginPassword').value = '';
  document.getElementById('registerUsername').value = '';
  document.getElementById('registerPassword').value = '';
  document.getElementById('registerConfirmPassword').value = '';
  document.getElementById('registerNickname').value = '';
  document.getElementById('registerSignature').value = '';
  
  // Show login form
  document.getElementById('loginForm').style.display = 'block';
  document.getElementById('registerForm').style.display = 'none';
}

// ===== Show main app =====
function showMainApp() {
  console.log('[showMainApp] 被调用, currentUser:', currentUser ? currentUser.nickname : 'null');
  
  if (!currentUser) {
    console.error('[错误] 无法显示主界面，用户信息不存在');
    showLoginPage();
    return;
  }
  
  const loginPage = document.getElementById('loginPage');
  const mainApp = document.getElementById('mainApp');
  
  if (!loginPage || !mainApp) {
    console.error('[错误] 页面元素不存在');
    return;
  }
  
  console.log('[界面切换] 隐藏登录页面，显示主界面');
  
  loginPage.classList.remove('active');
  loginPage.style.display = 'none';
  mainApp.classList.add('active');
  mainApp.style.display = 'block';
  
  console.log('[界面] 主界面已显示');
  
  // 更新个人信息显示
  updateProfileDisplay();
  
  // 请求在线用户和好友列表
  if (socket && socket.connected) {
    socket.emit('users:getOnline');
    socket.emit('friends:get');
  }
}

// ===== Update profile display =====
function updateProfileDisplay() {
  if (!currentUser) return;
  
  document.getElementById('myNickname').textContent = currentUser.nickname;
  document.getElementById('mySignature').textContent = currentUser.signature || 'This person is lazy and wrote nothing';
  document.getElementById('myUserId').textContent = currentUser.odp?.substring(0, 8) || '--';
  
  const avatarEl = document.getElementById('myAvatar');
  if (currentUser.avatar) {
    avatarEl.innerHTML = `<img src="${currentUser.avatar}" alt="Avatar">`;
  }
}

// ===== Avatar upload handling =====
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
    preview.innerHTML = `<img src="${avatarDataUrl}" alt="Avatar">`;
  };
  reader.readAsDataURL(file);
}

// ===== Update server address display =====
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

// ===== Switch tabs =====
function switchTab(tabName) {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.tab === tabName);
  });
  
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `${tabName}Tab`);
  });
}

// ===== Render contacts list =====
function renderContacts() {
  const container = document.getElementById('contactList');
  if (!container) return;
  
  // Filter out self
  const filteredContacts = contacts.filter(c => c.odp !== currentUser?.odp);
  
  if (filteredContacts.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-users"></i>
        <p>No contacts yet</p>
        <span>Waiting for other users to come online</span>
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
          <p>${escapeHtml(contact.signature || 'No bio')}</p>
        </div>
        ${!contact.isFriend ? `
        <button class="add-friend-btn" onclick="event.stopPropagation(); sendFriendRequest('${contact.odp}')" title="Add Friend">
          <i class="fas fa-user-plus"></i> Add
        </button>
        ` : ''}
      </div>
    `;
  }).join('');
}

// ===== Update online count =====
function updateOnlineCount() {
  const onlineCount = contacts.filter(c => c.online && c.odp !== currentUser?.odp).length;
  const countEl = document.getElementById('onlineCount');
  if (countEl) countEl.textContent = onlineCount;
}

// ===== Update group count =====
function updateGroupCount() {
  const countEl = document.getElementById('groupCount');
  if (countEl) countEl.textContent = rooms.length;
}

// ===== Open private chat =====
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
  
  // Request history messages
  socket.emit('messages:get', {
    type: 'private',
    targetId: odp
  });
  
  showChatWindow();
}

// ===== Open group chat =====
function openRoomChat(roomId) {
  const room = rooms.find(r => r.id === roomId);
  if (!room) {
    showToast('群组不存在', 'error');
    return;
  }
  
  currentChat = {
    type: 'room',
    id: roomId,
    name: room.name
  };
  
  // Request history messages
  socket.emit('messages:get', {
    type: 'room',
    targetId: roomId
  });
  
  showChatWindow();
}

// ===== Show chat window =====
function showChatWindow() {
  const chatWindow = document.getElementById('chatWindow');
  chatWindow.classList.add('active');
  
  // Hide empty state
  const emptyState = document.getElementById('chatEmptyState');
  if (emptyState) emptyState.style.display = 'none';
  
  document.getElementById('chatTitle').textContent = currentChat.name;
  
  const statusEl = document.getElementById('chatStatus');
  if (currentChat.type === 'private') {
    statusEl.textContent = currentChat.online ? 'Online' : 'Offline';
    statusEl.className = `chat-status ${currentChat.online ? 'online' : 'offline'}`;
  } else {
    const room = rooms.find(r => r.id === currentChat.id);
    statusEl.textContent = room ? `${room.members?.length || 0} members` : '';
    statusEl.className = 'chat-status';
  }
  
  renderMessages();
}

// ===== Close chat window =====
function closeChat() {
  const chatWindow = document.getElementById('chatWindow');
  chatWindow.classList.remove('active');
  currentChat = null;
  
  // Show empty state
  const emptyState = document.getElementById('chatEmptyState');
  if (emptyState) emptyState.style.display = 'flex';
  
  // Close panel
  document.getElementById('emojiPanel')?.classList.remove('active');
  document.getElementById('attachPanel')?.classList.remove('active');
}

// ===== Render message list =====
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
        <p>No messages yet, send the first one</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = messages.map(msg => createMessageHTML(msg)).join('');
  scrollToBottom();
}

// ===== Append message =====
function appendMessage(msg) {
  const container = document.getElementById('messagesList');
  if (!container) return;
  
  // Remove empty state
  const emptyState = container.querySelector('.messages-empty');
  if (emptyState) emptyState.remove();
  
  container.insertAdjacentHTML('beforeend', createMessageHTML(msg));
}

// ===== Create message HTML =====
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
      contentHTML = `<img class="message-image" src="${msg.content}" onclick="showImagePreview('${msg.content}')" alt="Image">`;
      break;
    case 'video':
      contentHTML = `<video class="message-video" src="${msg.content}" controls></video>`;
      break;
    case 'file':
      contentHTML = `
        <a class="message-file" href="${msg.content}" download="${msg.fileName || msg.filename || 'File'}">
          <i class="fas fa-file"></i>
          <span>${escapeHtml(msg.fileName || msg.filename || 'File')}</span>
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
  
  // Get role info
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
            <span>Reply ${escapeHtml(msg.replyTo.senderName)}</span>
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

// ===== Send message (Beta 0.1.0 Debounce and Offline Cache) =====
function sendMessage() {
  const input = document.getElementById('messageInput');
  const content = input.textContent.trim();
  
  if (!content || !currentChat) return;
  
  // Debounce check
  const now = Date.now();
  if (now - lastMessageTime < MESSAGE_DEBOUNCE_MS) {
    console.log('[Debounce] Sending too fast, skipped');
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
  
  // Cache message if offline
  if (!isConnected) {
    pendingMessages.push({ event: eventName, data: eventData });
    showToast('网络已断开，消息将在重连后发送', 'warning');
  } else {
    socket.emit(eventName, eventData);
  }
  
  // Clear input
  input.textContent = '';
  cancelReply();
  
  // Close panel
  document.getElementById('emojiPanel')?.classList.remove('active');
  document.getElementById('attachPanel')?.classList.remove('active');
}

// ===== Handle message input keypress =====
function handleMessageKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

// ===== Handle typing status =====
function handleTyping() {
  if (currentChat?.type === 'private') {
    socket.emit('user:typing', { to: currentChat.id });
  }
}

// ===== Show typing indicator =====
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

// ===== Initialize emoji panel =====
function initEmojiPanel() {
  const grid = document.getElementById('emojiGrid');
  if (!grid) return;
  
  grid.innerHTML = emojis.map(emoji => `
    <span class="emoji-item" onclick="insertEmoji('${emoji}')">${emoji}</span>
  `).join('');
}

// ===== Toggle emoji panel =====
function toggleEmojiPanel() {
  const panel = document.getElementById('emojiPanel');
  const attachPanel = document.getElementById('attachPanel');
  
  attachPanel?.classList.remove('active');
  panel?.classList.toggle('active');
}

// ===== Toggle attachment panel =====
function toggleAttachPanel() {
  const panel = document.getElementById('attachPanel');
  const emojiPanel = document.getElementById('emojiPanel');
  
  emojiPanel?.classList.remove('active');
  panel?.classList.toggle('active');
}

// ===== Insert emoji =====
function insertEmoji(emoji) {
  const input = document.getElementById('messageInput');
  input.textContent += emoji;
  input.focus();
}

// ===== Upload file =====
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
  
  showToast('上传中...', 'info');
  
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

// ===== Voice recording indicator =====
function showVoiceRecordingTip() {
  showToast('按住语音按钮开始录音', 'info');
  document.getElementById('attachPanel')?.classList.remove('active');
}

// ===== Voice recording =====
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

// ===== Play voice =====
function playVoice(element, src) {
  const audio = new Audio(src);
  const icon = element.querySelector('i');
  
  icon.className = 'fas fa-pause';
  audio.play();
  
  audio.onended = () => {
    icon.className = 'fas fa-play';
  };
}

// ===== Create group chat =====
function createGroup() {
  const name = document.getElementById('groupNameInput')?.value.trim();
  const desc = document.getElementById('groupDescInput')?.value.trim();
  
  if (!name) {
    showToast('请输入群组名称', 'error');
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

// ===== Show group list =====
function showGroupList() {
  if (rooms.length === 0) {
    showToast('还没有群组', 'info');
    return;
  }
  
  // Create a simple group list modal
  const html = `
    <div class="modal active" id="groupListModal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Group List</h2>
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
                  <p>${room.members?.length || 0}members</p>
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

// ===== Open modal =====
function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  
  modal.classList.add('active');
  
  // If create group modal, fill member list
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
      `).join('') || '<p>No contacts to add</p>';
    }
  }
}

// ===== Close modal =====
function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove('active');
    // If temp modal, remove it
    if (id === 'groupListModal') {
      modal.remove();
    }
  }
}

// ===== Image preview =====
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

// ===== Message context menu =====
let currentMenuMessageId = null;

function showMessageMenu(event, messageId) {
  event.preventDefault();
  event.stopPropagation();
  
  currentMenuMessageId = messageId;
  
  // Find message
  const messages = currentChat.type === 'private' 
    ? (privateMessages[currentChat.id] || [])
    : (roomMessages[currentChat.id] || []);
  const msg = messages.find(m => m.id === messageId);
  
  if (!msg) return;
  
  // Create or get menu
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
        <span class="icon">↩️</span> Reply
      </div>
      <div class="context-menu-item" onclick="copyMessageContent()">
        <span class="icon">📋</span> Copy
      </div>
      <div class="context-menu-item delete-item" onclick="deleteMessage()">
        <span class="icon">🗑️</span> Delete
      </div>
    `;
    document.body.appendChild(menu);
  }
  
  // Show/hide delete option (only own messages)
  const deleteItem = menu.querySelector('.delete-item');
  if (deleteItem) {
    deleteItem.style.display = (msg.senderId === currentUser.id) ? 'flex' : 'none';
  }
  
  // Position menu
  const x = event.clientX;
  const y = event.clientY;
  
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  menu.classList.add('active');
  
  // Ensure menu stays on screen
  setTimeout(() => {
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      menu.style.left = (window.innerWidth - rect.width - 10) + 'px';
    }
    if (rect.bottom > window.innerHeight) {
      menu.style.top = (window.innerHeight - rect.height - 10) + 'px';
    }
  }, 0);
  
  // Click elsewhere to close menu
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
  
  // TODO: Implement delete message
  showToast('删除功能即将推出');
  closeMessageMenu();
}

// ===== Poke function =====
function pokeUser(userId, username) {
  if (!userId || userId === currentUser.id) {
    showToast('不能戳自己');
    return;
  }
  
  socket.emit('user:poke', { targetId: userId });
  showToast(`你戳了戳 ${username}`);
}

// ===== Reply message =====
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

// ===== Message reaction toggle =====
function toggleReaction(messageId, emoji) {
  if (!currentChat) return;
  
  socket.emit('message:react', {
    messageId: messageId,
    emoji: emoji,
    roomId: currentChat.type === 'room' ? currentChat.id : null,
    recipientId: currentChat.type === 'private' ? currentChat.id : null
  });
}

// ===== Search function =====
function toggleSearch() {
  const searchBar = document.getElementById('searchBar');
  searchBar?.classList.toggle('active');
  
  if (searchBar?.classList.contains('active')) {
    document.getElementById('searchInput')?.focus();
  } else {
    document.getElementById('searchInput').value = '';
    // Re-render full list
    renderContacts();
    updateChatList();
  }
}

function handleSearch() {
  const query = document.getElementById('searchInput')?.value.trim().toLowerCase();
  // TODO: Implement search filter
}

// ===== Update chat list =====
function updateChatList() {
  const container = document.getElementById('chatList');
  if (!container) return;
  
  const chats = [];
  
  // Collect private chats
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
  
  // Collect group chats
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
  
  // Sort by time
  chats.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  
  if (chats.length === 0) {
    container.innerHTML = `
      <div class="empty-state" id="emptyChatState">
        <i class="fas fa-comments"></i>
        <p>No chats yet</p>
        <span>Click the top right to start a new conversation</span>
      </div>
    `;
    return;
  }
  
  container.innerHTML = chats.map(chat => {
    // Beta 0.1.0: Fixed group avatar loading issue
    let avatarHtml = '';
    if (chat.isRoom) {
      // Group avatar - prefer group avatar, otherwise use default icon
      const room = rooms.find(r => r.id === chat.id);
      if (room?.avatar) {
        avatarHtml = `<img src="${room.avatar}" alt="${escapeHtml(chat.name)}" onerror="this.style.display='none';this.parentElement.innerHTML='<i class=\\'fas fa-users\\'></i>'">`
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
          <p class="chat-preview">${chat.lastMessage ? getMessagePreview(chat.lastMessage) : 'No messages'}</p>
        </div>
      </div>
    `;
  }).join('');
}

// ===== Add chat menu =====
function showAddChatMenu() {
  // Switch to contacts page
  switchTab('contacts');
}

// ===== Theme switch =====
function toggleDarkMode() {
  document.body.classList.toggle('dark-mode');
  localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
}

// ===== Utility functions =====
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
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
  if (diff < 86400000 && date.getDate() === now.getDate()) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }
  if (diff < 172800000) return 'Yesterday';
  
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

function getMessagePreview(msg) {
  if (!msg) return '';
  switch (msg.type) {
    case 'text': return msg.content?.substring(0, 30) + (msg.content?.length > 30 ? '...' : '');
    case 'image': return '[Image]';
    case 'video': return '[Video]';
    case 'file': return '[File]';
    case 'voice': return '[Voice]';
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

// ===== Load dark mode settings =====
if (localStorage.getItem('darkMode') === 'true') {
  document.body.classList.add('dark-mode');
  const toggle = document.getElementById('darkModeToggle');
  if (toggle) toggle.checked = true;
}

// ===== Language Switch (Client-side only) =====
// Check and redirect to correct language on page load
(function checkLanguageRedirect() {
  // Don't redirect if we just got here with a lang parameter
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('lang')) {
    // Save the language preference from URL
    const langParam = urlParams.get('lang');
    if (langParam === 'zh' || langParam === 'en') {
      localStorage.setItem('chatroom_language', langParam);
    }
    return; // Skip redirect, we're already on the right page
  }
  
  const savedLang = localStorage.getItem('chatroom_language');
  const currentLang = getCurrentLanguageFromHTML();
  
  if (savedLang && savedLang !== currentLang) {
    // Redirect to correct language immediately
    window.location.replace(`/?lang=${savedLang}`);
  }
})();

function initLanguageSwitch() {
  const langButtons = document.querySelectorAll('.lang-option');
  
  // Set active state based on current page
  const currentLang = getCurrentLanguageFromHTML();
  langButtons.forEach(btn => {
    if (btn.dataset.lang === currentLang) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  // Handle language switch
  langButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const selectedLang = btn.dataset.lang;
      const currentLang = getCurrentLanguageFromHTML();
      
      if (selectedLang !== currentLang) {
        // Save preference
        localStorage.setItem('chatroom_language', selectedLang);
        
        // Directly reload with language parameter (no toast needed on login page)
        window.location.href = `/?lang=${selectedLang}`;
      }
    });
  });
}

function getCurrentLanguageFromHTML() {
  // Detect from HTML lang attribute
  const htmlLang = document.documentElement.lang;
  if (htmlLang.includes('zh')) return 'zh';
  if (htmlLang.includes('en')) return 'en';
  
  return 'zh'; // default
}

// Initialize language switch on page load
document.addEventListener('DOMContentLoaded', () => {
  initLanguageSwitch();
});

// ========================================
// ===== Discover page implementation =====
// ========================================

// Moments data storage
let moments = [];
let momentImages = [];

// ===== Moments =====
function openMoments() {
  openModal('momentsModal');
  loadMoments();
}

function loadMoments() {
  const container = document.getElementById('momentsList');
  if (!container) return;
  
  // Get moments from server
  socket.emit('moments:get');
}

function renderMomentsList() {
  const container = document.getElementById('momentsList');
  if (!container) return;
  
  if (moments.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-camera-retro"></i>
        <p>No updates yet</p>
        <span>Click the top right to post your first update</span>
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
  
  // Send to server
  socket.emit('moments:post', {
    content,
    images: [...momentImages]
  });
  
  // Clear form
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
  const comment = prompt('请输入评论:');
  if (!comment || !comment.trim()) return;
  
  socket.emit('moments:comment', { momentId, content: comment.trim() });
}

function deleteMoment(momentId) {
  if (confirm('确定要删除这条动态吗?')) {
    socket.emit('moments:delete', { momentId });
  }
}

// Expose to global
window.likeMoment = likeMoment;
window.commentMoment = commentMoment;
window.deleteMoment = deleteMoment;

// ===== Online users =====
function openOnlineUsers() {
  // Create online users popup
  const existingModal = document.getElementById('onlineUsersModal');
  if (existingModal) existingModal.remove();
  
  const modal = document.createElement('div');
  modal.id = 'onlineUsersModal';
  modal.className = 'modal active';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 500px;">
      <div class="modal-header">
        <h2><i class="fas fa-users"></i> Online Users</h2>
        <button class="modal-close" onclick="closeOnlineUsersModal()">&times;</button>
      </div>
      <div class="modal-body" style="max-height: 400px; overflow-y: auto;">
        <div id="onlineUsersList">
          ${onlineUsers.length === 0 ? `
            <div class="empty-state">
              <i class="fas fa-user-slash"></i>
              <p>No other users online</p>
            </div>
          ` : onlineUsers.map(user => `
            <div class="contact-item" onclick="startChatWithUser('${user.odp}', '${escapeHtml(user.nickname || user.username)}')">
              <div class="avatar">
                ${user.avatar ? `<img src="${user.avatar}" alt="">` : `<i class="fas fa-user"></i>`}
              </div>
              <div class="info">
                <h4>${escapeHtml(user.nickname || user.username)}</h4>
                <p>${user.signature || 'Online'}</p>
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
  // Switch to chat page
  switchTab('chats');
}

// ===== Announcement board =====
function openBroadcast() {
  const existingModal = document.getElementById('broadcastModal');
  if (existingModal) existingModal.remove();
  
  const modal = document.createElement('div');
  modal.id = 'broadcastModal';
  modal.className = 'modal active';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 500px;">
      <div class="modal-header">
        <h2><i class="fas fa-bullhorn"></i> Announcements</h2>
        <button class="modal-close" onclick="closeBroadcastModal()">&times;</button>
      </div>
      <div class="modal-body" style="max-height: 400px; overflow-y: auto;">
        <div class="broadcast-notice" style="padding: 20px; background: var(--bg-input); border-radius: var(--radius-md); margin-bottom: 16px;">
          <h4 style="margin-bottom: 8px; color: var(--primary);">
            <i class="fas fa-info-circle"></i> Welcome to LAN Chat Room
          </h4>
          <p style="color: var(--text-secondary); font-size: 14px; line-height: 1.6;">
            This is a local network instant messaging tool where you can chat with other users on the same network.
          </p>
        </div>
        <div class="broadcast-notice" style="padding: 20px; background: var(--bg-input); border-radius: var(--radius-md);">
          <h4 style="margin-bottom: 8px;">
            <i class="fas fa-lightbulb"></i> Features
          </h4>
          <ul style="color: var(--text-secondary); font-size: 14px; line-height: 1.8; padding-left: 20px;">
            <li>Private and group chats</li>
            <li>Friends system</li>
            <li>Moments/Timeline</li>
            <li>Send images, files, voice messages</li>
            <li>Dark mode</li>
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

// ===== Usage help =====
function openHelp() {
  const existingModal = document.getElementById('helpModal');
  if (existingModal) existingModal.remove();
  
  const modal = document.createElement('div');
  modal.id = 'helpModal';
  modal.className = 'modal active';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 550px;">
      <div class="modal-header">
        <h2><i class="fas fa-question-circle"></i> Help</h2>
        <button class="modal-close" onclick="closeHelpModal()">&times;</button>
      </div>
      <div class="modal-body" style="max-height: 450px; overflow-y: auto;">
        <div class="help-section" style="margin-bottom: 20px;">
          <h4 style="margin-bottom: 10px; color: var(--primary);">💬 How to start chatting?</h4>
          <p style="color: var(--text-secondary); font-size: 14px; line-height: 1.6;">
            1. Click the "+" button on the Contacts page to add friends<br>
            2. Search for a username and send a friend request<br>
            3. Once accepted, you can start chatting
          </p>
        </div>
        <div class="help-section" style="margin-bottom: 20px;">
          <h4 style="margin-bottom: 10px; color: var(--primary);">👥 How to create a group?</h4>
          <p style="color: var(--text-secondary); font-size: 14px; line-height: 1.6;">
            1. Click "New Group" on the Contacts page<br>
            2. Enter the group name and select members<br>
            3. Click Create
          </p>
        </div>
        <div class="help-section" style="margin-bottom: 20px;">
          <h4 style="margin-bottom: 10px; color: var(--primary);">📷 How to send images/files?</h4>
          <p style="color: var(--text-secondary); font-size: 14px; line-height: 1.6;">
            1. Click the "+" button on the left side of the input box<br>
            2. Select the type to send (image, video, file, etc.)<br>
            3. Select the file and it will be sent automatically
          </p>
        </div>
        <div class="help-section" style="margin-bottom: 20px;">
          <h4 style="margin-bottom: 10px; color: var(--primary);">🌙 How to switch to dark mode?</h4>
          <p style="color: var(--text-secondary); font-size: 14px; line-height: 1.6;">
            Go to the "Me" page and find the "Theme" option, click the toggle to switch between dark/light mode.
          </p>
        </div>
        <div class="help-section">
          <h4 style="margin-bottom: 10px; color: var(--primary);">🔗 How to invite others?</h4>
          <p style="color: var(--text-secondary); font-size: 14px; line-height: 1.6;">
            Share the LAN address shown at the bottom of the page to friends on the same network, they can join by opening it in a browser.
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

// Expose to global
window.openOnlineUsers = openOnlineUsers;
window.closeOnlineUsersModal = closeOnlineUsersModal;
window.startChatWithUser = startChatWithUser;
window.openBroadcast = openBroadcast;
window.closeBroadcastModal = closeBroadcastModal;
window.openHelp = openHelp;
window.closeHelpModal = closeHelpModal;

// ===== Scan (reserved but unused) =====
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
    result.innerHTML = '<p>Camera started, point QR code at the scanner</p>';
    
    // Simple QR detection (actually need QR parse lib)
    // This is just simulation
  } catch (err) {
    result.innerHTML = `
      <p style="color: var(--text-muted);">Cannot access camera</p>
      <p style="font-size: 12px; color: var(--text-muted);">Please ensure camera permission is granted</p>
    `;
  }
}

function stopScan() {
  if (scanStream) {
    scanStream.getTracks().forEach(track => track.stop());
    scanStream = null;
  }
}

// Stop camera when closing scan
const originalCloseModal = closeModal;
closeModal = function(id) {
  if (id === 'scanModal') {
    stopScan();
  }
  originalCloseModal(id);
};

// ===== Shake =====
let shakeTimeout = null;
let lastShakeTime = 0;

function openShake() {
  openModal('shakeModal');
  initShake();
}

function initShake() {
  // Check if device supports shake
  if ('DeviceMotionEvent' in window) {
    // Request permission (needed for iOS 13+)
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
  
  // Animation effect
  icon.classList.add('shaking');
  setTimeout(() => icon.classList.remove('shaking'), 500);
  
  // Randomly match online users
  const availableContacts = contacts.filter(c => c.odp !== currentUser?.odp && c.online);
  
  if (availableContacts.length === 0) {
    result.innerHTML = '<p>No online users found at the moment</p>';
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
  
  showToast('找到一个人!', 'success');
}

// ===== People nearby =====
function openNearby() {
  openModal('nearbyModal');
  loadNearbyUsers();
}

function loadNearbyUsers() {
  const container = document.getElementById('nearbyList');
  if (!container) return;
  
  // Use all online users as "nearby people"
  const nearbyUsers = contacts.filter(c => c.odp !== currentUser?.odp);
  
  if (nearbyUsers.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-map-marker-alt"></i>
        <p>No nearby users</p>
        <span>Waiting for other users to come online</span>
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
        <p>${escapeHtml(user.signature || 'No signature')}</p>
      </div>
      <span class="nearby-distance">91.78m</span>
    </div>
  `).join('');
}

// ========================================
// ===== Profile page implementation =====
// ========================================

let editAvatarDataUrl = null;

function openEditProfile() {
  openModal('editProfileModal');
  
  // Fill current info
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
  
  // Send to server update
  socket.emit('user:update', {
    nickname,
    signature,
    avatar: editAvatarDataUrl || currentUser?.avatar
  });
  
  // Local update
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
    showToast('两次新密码不一致', 'error');
    return;
  }
  
  socket.emit('user:changePassword', {
    oldPassword,
    newPassword
  });
  
  // Listen for result
  showToast('密码修改请求已发送', 'info');
  closeModal('changePasswordModal');
  
  // Clear form
  document.getElementById('oldPassword').value = '';
  document.getElementById('newPassword').value = '';
  document.getElementById('confirmNewPassword').value = '';
}

function clearCache() {
  if (confirm('确定要清除所有缓存数据吗？这将清除本地存储的聊天记录和设置。')) {
    // Keep user login info
    const user = localStorage.getItem('chatroom_user');
    localStorage.clear();
    if (user) {
      localStorage.setItem('chatroom_user', user);
    }
    
    chatMessages = {};
    showToast('缓存已清除', 'success');
  }
}

// Add Socket event listeners
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

// ===== Friend system functions =====
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
  
  // Update badge
  updateFriendRequestBadge();
  
  if (requests.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 40px; text-align: center; color: var(--text-muted);">
        <i class="fas fa-user-plus" style="font-size: 40px; margin-bottom: 10px;"></i>
        <p>No friend requests</p>
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
          <div class="name">${escapeHtml(sender.nickname || 'Unknown User')}</div>
          <div class="time">Wants to add you as a friend</div>
        </div>
        <div class="request-actions">
          <button class="accept-btn" onclick="acceptFriendRequest('${req.id}')">Accept</button>
          <button class="reject-btn" onclick="rejectFriendRequest('${req.id}')">Decline</button>
        </div>
      </div>
    `;
  }).join('');
}

// Update friend request badge
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
// ===== Panel control functions =====
function openFriendRequestsPanel() {
  document.getElementById('friendRequestsPanel').classList.add('active');
  document.getElementById('friendRequestsOverlay').classList.add('active');
  socket.emit('friend:getRequests');
}

function closeFriendRequestsPanel() {
  document.getElementById('friendRequestsPanel').classList.remove('active');
  document.getElementById('friendRequestsOverlay').classList.remove('active');
}

// Expose to global scope for onclick use
window.openFriendRequestsPanel = openFriendRequestsPanel;
window.closeFriendRequestsPanel = closeFriendRequestsPanel;

// ===== Chat menu =====
function openChatMenu() {
  if (!currentChat) return;
  
  // If group chat, open group settings panel
  if (currentChat.type === 'room') {
    openRoomSettingsPanel(currentChat.id);
  } else {
    // Private chat shows user info menu
    showPrivateChatMenu();
  }
}

function showPrivateChatMenu() {
  // Create private chat menu
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
          <span>Poke</span>
        </button>
        ${!isFriend ? `
          <button onclick="sendFriendRequestFromMenu('${currentChat.id}')" style="width: 100%; padding: 12px 16px; background: none; border: none; text-align: left; cursor: pointer; display: flex; align-items: center; gap: 10px; color: var(--text-primary);">
            <i class="fas fa-user-plus" style="color: var(--primary);"></i>
            <span>Add Friend</span>
          </button>
        ` : ''}
        <button onclick="openReportModal('${currentChat.id}', '${escapeHtml(currentChat.name)}')" style="width: 100%; padding: 12px 16px; background: none; border: none; text-align: left; cursor: pointer; display: flex; align-items: center; gap: 10px; color: var(--text-primary);">
          <i class="fas fa-flag" style="color: #f59e0b;"></i>
          <span>Report User</span>
        </button>
        ${isAdmin ? `
          <div style="border-top: 1px solid var(--border); margin: 4px 0;"></div>
          <button onclick="openAdminWarnModal('${currentChat.id}', '${escapeHtml(currentChat.name)}')" style="width: 100%; padding: 12px 16px; background: none; border: none; text-align: left; cursor: pointer; display: flex; align-items: center; gap: 10px; color: var(--text-primary);">
            <i class="fas fa-exclamation-triangle" style="color: #f59e0b;"></i>
            <span>Warn User</span>
          </button>
          <button onclick="openAdminMuteModal('${currentChat.id}', '${escapeHtml(currentChat.name)}')" style="width: 100%; padding: 12px 16px; background: none; border: none; text-align: left; cursor: pointer; display: flex; align-items: center; gap: 10px; color: var(--text-primary);">
            <i class="fas fa-volume-mute" style="color: #ef4444;"></i>
            <span>Mute User</span>
          </button>
        ` : ''}
        <div style="border-top: 1px solid var(--border); margin: 4px 0;"></div>
        <button onclick="clearChatHistory('${currentChat.id}')" style="width: 100%; padding: 12px 16px; background: none; border: none; text-align: left; cursor: pointer; display: flex; align-items: center; gap: 10px; color: var(--text-primary);">
          <i class="fas fa-trash-alt" style="color: #FF6B6B;"></i>
          <span>Clear Chat History</span>
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(menu);
  
  // Click elsewhere to close
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
  if (confirm('确定要清除与该用户的聊天记录吗？')) {
    // Only clear local display, actual records remain on server
    const messagesList = document.getElementById('messagesList');
    if (messagesList) messagesList.innerHTML = '';
    showToast('聊天记录已清除', 'success');
    closePrivateChatMenu();
  }
}

// Expose to global
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
    
    // Show group avatar
    const avatarDisplay = document.getElementById('roomAvatarDisplay');
    if (room.avatar) {
      avatarDisplay.innerHTML = `<img src="${room.avatar}" alt="" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
    } else {
      avatarDisplay.innerHTML = '<i class="fas fa-users"></i>';
    }
    
    // Update leave/dissolve button
    const leaveBtn = document.getElementById('leaveRoomBtn');
    if (room.owner === currentUser.odp) {
      leaveBtn.textContent = 'Disband Group';
      leaveBtn.style.background = '#dc2626';
    } else {
      leaveBtn.textContent = 'Leave Group';
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

// Expose to global scope for onclick use
window.openRoomSettingsPanel = openRoomSettingsPanel;
window.closeRoomSettingsPanel = closeRoomSettingsPanel;

function renderRoomMembers(room) {
  const container = document.getElementById('roomMembersList');
  if (!container || !room.members) return;
  
  const isOwner = room.owner === currentUser.odp;
  const isAdmin = room.admins && room.admins.includes(currentUser.odp);
  
  container.innerHTML = room.members.map(memberOdp => {
    const user = onlineUsers.find(u => u.odp === memberOdp) || { nickname: 'Unknown User', odp: memberOdp };
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
          <div class="role-tag">${isMemberOwner ? 'Owner' : (isMemberAdmin ? 'Admin' : 'Member')}</div>
        </div>
        ${canKick ? `<button class="kick-btn" onclick="kickFromRoom('${room.id}', '${memberOdp}')">Kick</button>` : ''}
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

// ===== Invite members to group =====
function openInviteMembersModal() {
  if (!currentSettingsRoomId) return;
  
  const room = rooms.find(r => r.id === currentSettingsRoomId);
  if (!room) return;
  
  const container = document.getElementById('inviteMembersList');
  if (!container) return;
  
  // Get friends list (exclude existing members)
  const availableFriends = contacts.filter(c => !room.members.includes(c.odp));
  
  if (availableFriends.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-users"></i>
        <p>All friends are already in the group</p>
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

// Expose to global
window.openInviteMembersModal = openInviteMembersModal;
window.inviteSelectedMembers = inviteSelectedMembers;
window.saveRoomName = saveRoomName;

// ===== Group chat management =====
function kickFromRoom(roomId, targetOdp) {
  if (confirm('Are you sure you want to kick this member?')) {
    socket.emit('room:kick', { roomId, targetOdp });
  }
}

function updateRoomSettings(roomId, name, settings) {
  socket.emit('room:update', { roomId, name, settings });
}

function setRoomAdmin(roomId, targetOdp, isAdmin) {
  socket.emit('room:setAdmin', { roomId, targetOdp, isAdmin });
}

// Expose to global
window.kickFromRoom = kickFromRoom;
window.updateRoomSettings = updateRoomSettings;
window.setRoomAdmin = setRoomAdmin;

// ===== Group advanced management =====
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
    
    // Send to server
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
  showToast('公告已发布', 'success');
}

function leaveOrDisbandRoom() {
  if (!currentSettingsRoomId) return;
  
  const room = rooms.find(r => r.id === currentSettingsRoomId);
  if (!room) return;
  
  const isOwner = room.owner === currentUser.odp;
  
  if (isOwner) {
    if (confirm('确定要解散这个群组吗？此操作不可撤销！')) {
      socket.emit('room:disband', { roomId: currentSettingsRoomId });
      closeRoomSettingsPanel();
      closeChat();
    }
  } else {
    if (confirm('确定要退出这个群组吗？')) {
      socket.emit('room:leave', { roomId: currentSettingsRoomId });
      closeRoomSettingsPanel();
      closeChat();
    }
  }
}

// Expose new functions
window.uploadRoomAvatar = uploadRoomAvatar;
window.handleRoomAvatarUpload = handleRoomAvatarUpload;
window.saveRoomAnnouncement = saveRoomAnnouncement;
window.leaveOrDisbandRoom = leaveOrDisbandRoom;

// ===== Mute notification popup =====
function showMuteAlert(detail) {
  // Remove old popup
  closeMuteAlert();
  
  const alert = document.createElement('div');
  alert.id = 'muteAlertModal';
  alert.className = 'mute-alert-modal';
  alert.innerHTML = `
    <div class="mute-alert-content">
      <div class="mute-alert-icon">
        <i class="fas fa-volume-mute"></i>
      </div>
      <h3>You have been muted</h3>
      <div class="mute-alert-details">
        <div class="mute-detail-row">
          <span class="label">Reason:</span>
          <span class="value">${escapeHtml(detail.reason || 'Rule violation')}</span>
        </div>
        <div class="mute-detail-row">
          <span class="label">Duration:</span>
          <span class="value">${detail.permanent ? 'Permanent' : detail.duration}</span>
        </div>
        ${!detail.permanent ? `
        <div class="mute-detail-row">
          <span class="label">Remaining:</span>
          <span class="value remaining">${detail.remaining}</span>
        </div>
        ` : ''}
      </div>
      <button class="mute-alert-btn" onclick="closeMuteAlert()">I Understand</button>
    </div>
  `;
  document.body.appendChild(alert);
  
  // Add styles
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

// ===== Get friend requests =====
socket.on('friend:getRequests', () => {
  socket.emit('friend:getRequests');
});

// ===== Event bindings =====
document.addEventListener('DOMContentLoaded', function() {
  // Friend requests button
  const friendRequestsBtn = document.getElementById('friendRequestsBtn');
  if (friendRequestsBtn) {
    friendRequestsBtn.addEventListener('click', openFriendRequestsPanel);
  }
  
  // Game center button
  const gamesBtn = document.getElementById('gamesBtn');
  if (gamesBtn) {
    gamesBtn.addEventListener('click', openGamesModal);
  }
});

// ===== Game system =====

// Open game center
function openGamesModal() {
  document.getElementById('gamesModal').classList.add('active');
}

// Select game
function selectGame(gameType) {
  currentGameType = gameType;
  document.getElementById('selectedGameName').textContent = GAME_NAMES[gameType];
  closeModal('gamesModal');
  
  // Render friends list
  renderFriendListForGame();
  document.getElementById('gameInviteModal').classList.add('active');
}

// Render game invite friends list
function renderFriendListForGame() {
  const container = document.getElementById('friendListForGame');
  const friendsList = contacts.filter(c => c.isFriend);
  
  if (friendsList.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-user-friends"></i>
        <p>No friends yet</p>
        <span>Add friends to invite them to play</span>
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
        <div class="status ${friend.online ? 'online' : ''}">${friend.online ? 'Online' : 'Offline'}</div>
      </div>
      <button class="invite-btn" onclick="sendGameInvite('${friend.odp}')" ${!friend.online ? 'disabled' : ''}>
        ${friend.online ? 'Invite' : 'Offline'}
      </button>
    </div>
  `).join('');
}

// Send game invite
function sendGameInvite(friendOdp) {
  if (!currentGameType) return;
  
  socket.emit('game:invite', {
    to: friendOdp,
    gameType: currentGameType
  });
  
  closeModal('gameInviteModal');
  showToast('游戏邀请已发送，等待回应...', 'info');
  
  // Open game panel and wait
  openGamePanel(currentGameType, friendOdp, true);
}

// Accept game invite
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

// Reject game invite
function declineGameInvite() {
  if (!pendingGameInvite) return;
  
  socket.emit('game:decline', {
    gameId: pendingGameInvite.gameId,
    from: pendingGameInvite.from
  });
  
  document.getElementById('gameInviteToast').classList.remove('active');
  pendingGameInvite = null;
}

// Open game panel
function openGamePanel(gameType, opponentOdp, isHost) {
  currentGameType = gameType;
  const opponent = contacts.find(c => c.odp === opponentOdp);
  
  document.getElementById('gamePanelTitle').textContent = GAME_NAMES[gameType];
  document.getElementById('gameStatus').textContent = 'Waiting for opponent...';
  document.getElementById('gameStatus').classList.remove('playing');
  
  // Initialize game state
  gameState = {
    type: gameType,
    opponent: opponentOdp,
    opponentInfo: opponent,
    isHost: isHost,
    myTurn: isHost,
    board: null,
    score: { me: 0, opponent: 0 }
  };
  
  // Init content based on game type
  initGameContent(gameType);
  
  document.getElementById('gamePanel').classList.add('active');
}

// Close game panel
function closeGamePanel() {
  document.getElementById('gamePanel').classList.remove('active');
  
  if (currentGame) {
    socket.emit('game:leave', { gameId: currentGame });
  }
  
  currentGame = null;
  currentGameType = null;
  gameState = null;
}

// Initialize game content
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

// Gomoku initialize
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
        <span class="name">Me</span>
        <div class="piece ${myPiece}"></div>
      </div>
      <div class="turn-indicator">${gameState.myTurn ? 'Your Turn' : "Opponent's Turn"}</div>
      <div class="player-info ${!gameState.myTurn ? 'active' : ''}">
        <div class="avatar">
          ${gameState.opponentInfo?.avatar ? `<img src="${gameState.opponentInfo.avatar}" alt="">` : `<i class="fas fa-user"></i>`}
        </div>
        <span class="name">${gameState.opponentInfo?.nickname || 'Opponent'}</span>
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
    <button class="secondary-btn" onclick="closeGamePanel()">Exit Game</button>
  `;
}

// Gomoku place stone
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
  
  // Check victory
  if (checkGomokuWin(row, col, piece)) {
    showGameResult('You Win!', true);
  }
}

// Check Gomoku victory
function checkGomokuWin(row, col, piece) {
  const directions = [
    [[0, 1], [0, -1]], // horizontal
    [[1, 0], [-1, 0]], // vertical
    [[1, 1], [-1, -1]], // diagonal
    [[1, -1], [-1, 1]]  // anti-diagonal
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

// Tic-tac-toe initialize
function initTicTacToe(content, controls) {
  gameState.board = Array(9).fill(null);
  
  const myPiece = gameState.isHost ? 'x' : 'o';
  
  content.innerHTML = `
    <div class="game-info">
      <div class="player-info ${gameState.myTurn ? 'active' : ''}">
        <span class="name">Me (${myPiece.toUpperCase()})</span>
      </div>
      <div class="turn-indicator">${gameState.myTurn ? 'Your Turn' : "Opponent's Turn"}</div>
      <div class="player-info ${!gameState.myTurn ? 'active' : ''}">
        <span class="name">${gameState.opponentInfo?.nickname || 'Opponent'} (${myPiece === 'x' ? 'O' : 'X'})</span>
      </div>
    </div>
    <div class="game-board tictactoe" id="tictactoeBoard">
      ${Array(9).fill(null).map((_, i) => 
        `<div class="board-cell" data-index="${i}" onclick="makeTicTacToeMove(${i})"></div>`
      ).join('')}
    </div>
  `;
  
  controls.innerHTML = `
    <button class="secondary-btn" onclick="closeGamePanel()">Exit Game</button>
  `;
}

// Tic-tac-toe place
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
    showGameResult(winner === piece ? 'You Win!' : 'You Lose', winner === piece);
  } else if (gameState.board.every(c => c)) {
    showGameResult('Draw!', false);
  }
}

// Check Tic-tac-toe victory
function checkTicTacToeWin() {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // horizontal
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // vertical
    [0, 4, 8], [2, 4, 6] // diagonal
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

// Guess number initialize
function initGuessGame(content, controls) {
  gameState.targetNumber = null;
  gameState.guessHistory = [];
  gameState.maxGuesses = 10;
  
  if (gameState.isHost) {
    // Host sets number
    content.innerHTML = `
      <div class="guess-game">
        <div class="guess-hint">Set a number between 1-100 for your opponent to guess</div>
        <div class="guess-input-group">
          <input type="number" class="guess-input" id="setNumberInput" min="1" max="100" placeholder="1-100">
          <button class="guess-btn" onclick="setTargetNumber()">Confirm</button>
        </div>
      </div>
    `;
  } else {
    content.innerHTML = `
      <div class="guess-game">
        <div class="guess-hint">Waiting for opponent to set the number...</div>
      </div>
    `;
  }
  
  controls.innerHTML = `
    <button class="secondary-btn" onclick="closeGamePanel()">Exit Game</button>
  `;
}

// Set target number
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
      <div class="guess-hint">Your number is: ${num}</div>
      <p>Waiting for opponent to guess...</p>
      <div class="guess-history" id="guessHistory"></div>
    </div>
  `;
}

// Rock-paper-scissors initialize
function initRPSGame(content, controls) {
  gameState.myChoice = null;
  gameState.opponentChoice = null;
  gameState.round = 1;
  gameState.score = { me: 0, opponent: 0 };
  
  content.innerHTML = `
    <div class="rps-game">
      <div class="rps-score">Round ${gameState.round} | ${gameState.score.me} : ${gameState.score.opponent}</div>
      <div class="rps-choices">
        <div class="rps-choice" data-choice="rock" onclick="makeRPSChoice('rock')">🪨</div>
        <div class="rps-choice" data-choice="paper" onclick="makeRPSChoice('paper')">📄</div>
        <div class="rps-choice" data-choice="scissors" onclick="makeRPSChoice('scissors')">✂️</div>
      </div>
      <p>Choose your move</p>
    </div>
  `;
  
  controls.innerHTML = `
    <button class="secondary-btn" onclick="closeGamePanel()">Exit Game</button>
  `;
}

// Rock-paper-scissors play move
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
    document.querySelector('.rps-game p').textContent = 'Waiting for opponent...';
  }
}

// Resolve rock-paper-scissors round
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
      <div class="rps-score">Round ${gameState.round} | ${gameState.score.me} : ${gameState.score.opponent}</div>
      <div class="rps-vs">
        <div class="rps-player">
          <div class="choice-display ${result === 'win' ? 'win' : result === 'lose' ? 'lose' : ''}">${choiceEmoji[gameState.myChoice]}</div>
          <div class="name">Me</div>
        </div>
        <span style="font-size: 24px;">VS</span>
        <div class="rps-player">
          <div class="choice-display ${result === 'lose' ? 'win' : result === 'win' ? 'lose' : ''}">${choiceEmoji[gameState.opponentChoice]}</div>
          <div class="name">${gameState.opponentInfo?.nickname || 'Opponent'}</div>
        </div>
      </div>
      <div class="rps-result ${result}">${result === 'win' ? 'You Win!' : result === 'lose' ? 'You Lose' : 'Draw'}</div>
    </div>
  `;
  
  // Check if game over (best of 3)
  if (gameState.score.me >= 2) {
    setTimeout(() => showGameResult('Congratulations! You Win!', true), 1500);
  } else if (gameState.score.opponent >= 2) {
    setTimeout(() => showGameResult('Unfortunately, You Lose', false), 1500);
  } else {
    // Continue next round
    setTimeout(() => {
      gameState.round++;
      gameState.myChoice = null;
      gameState.opponentChoice = null;
      initRPSGame(content, document.getElementById('gameControls'));
    }, 2000);
  }
}

// Update turn indicator
function updateTurnIndicator() {
  const indicator = document.querySelector('.turn-indicator');
  if (indicator) {
    indicator.textContent = gameState.myTurn ? 'Your Turn' : "Opponent's Turn";
  }
  
  document.querySelectorAll('.player-info').forEach((el, i) => {
    if ((i === 0 && gameState.myTurn) || (i === 1 && !gameState.myTurn)) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });
}

// Show game result
function showGameResult(message, isWin) {
  const content = document.getElementById('gameContent');
  content.innerHTML = `
    <div style="text-align: center;">
      <div style="font-size: 64px; margin-bottom: 20px;">${isWin ? '🎉' : '😢'}</div>
      <h2 style="font-size: 28px; margin-bottom: 20px;">${message}</h2>
      <button class="primary-btn" onclick="closeGamePanel()" style="padding: 14px 32px; font-size: 16px; background: var(--primary); color: white; border: none; border-radius: var(--radius-lg); cursor: pointer;">
        Return
      </button>
    </div>
  `;
  
  document.getElementById('gameControls').innerHTML = '';
  document.getElementById('gameStatus').textContent = 'Game Over';
}

// Handle game move
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
          showGameResult('You Lose', false);
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
          showGameResult(winner === myPiece ? 'You Win!' : 'You Lose', winner === myPiece);
        } else if (gameState.board.every(c => c)) {
          showGameResult('Draw!', false);
        }
      }
      break;
      
    case 'guess':
      if (data.move.action === 'setNumber') {
        gameState.targetNumber = data.move.number;
        document.getElementById('gameContent').innerHTML = `
          <div class="guess-game">
            <div class="guess-hint">Guess a number between 1-100</div>
            <div class="guess-input-group">
              <input type="number" class="guess-input" id="guessInput" min="1" max="100" placeholder="Enter your guess">
              <button class="guess-btn" onclick="makeGuess()">Guess</button>
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
          resultText = 'Correct!';
          setTimeout(() => showGameResult('Opponent guessed it, you lose', false), 1000);
        } else if (guess > gameState.targetNumber) {
          resultClass = 'high';
          resultText = 'Too High';
        } else {
          resultClass = 'low';
          resultText = 'Too Low';
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
          resultText = 'Correct!';
          setTimeout(() => showGameResult('Congratulations! You guessed it!', true), 1000);
        } else if (data.move.result === 'high') {
          resultClass = 'high';
          resultText = 'Too High';
        } else {
          resultClass = 'low';
          resultText = 'Too Low';
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

// Guess number
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

// ========== Report system ==========
let reportTarget = null;
let reportTargetName = '';

function openReportModal(targetOdp, targetName) {
  reportTarget = targetOdp;
  reportTargetName = targetName;
  closePrivateChatMenu();
  
  // Create report popup
  let modal = document.getElementById('reportModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'reportModal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 400px;">
        <div class="modal-header">
          <h3><i class="fas fa-flag" style="color: #f59e0b;"></i> Report User</h3>
          <button class="close-btn" onclick="closeModal('reportModal')"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body">
          <p style="margin-bottom: 16px;">Report User: <strong id="reportTargetName"></strong></p>
          <div class="form-group">
            <label>Report Type</label>
            <select id="reportType" style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: var(--radius-sm);">
              <option value="spam">Spam/Advertising</option>
              <option value="abuse">Harassment/Abuse</option>
              <option value="inappropriate">Inappropriate Content</option>
              <option value="scam">Scam/Fraud</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea id="reportReason" placeholder="Please describe the reason for reporting..." style="width: 100%; min-height: 100px; padding: 10px; border: 1px solid var(--border); border-radius: var(--radius-sm); resize: vertical;"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="secondary-btn" onclick="closeModal('reportModal')">Cancel</button>
          <button class="primary-btn" onclick="submitReport()" style="background: #f59e0b;">
            <i class="fas fa-paper-plane"></i> Submit Report
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
    showToast('请输入举报理由', 'error');
    return;
  }
  
  socket.emit('report:user', {
    targetOdp: reportTarget,
    reason: `[${type}] ${reason}`
  });
  
  closeModal('reportModal');
  showToast('举报已提交，管理员将尽快处理', 'success');
  reportTarget = null;
  reportTargetName = '';
}

// Receive report notification (admin)
socket.on('report:new', (report) => {
  showToast(`新举报: ${report.targetName} 被举报 ${report.type}`, 'warning');
});

// ========== Admin operations ==========
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
          <h3><i class="fas fa-exclamation-triangle" style="color: #f59e0b;"></i> Warn User</h3>
          <button class="close-btn" onclick="closeModal('adminWarnModal')"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body">
          <p style="margin-bottom: 16px;">Warn User: <strong id="warnTargetName"></strong></p>
          <div class="form-group">
            <label>Warning Reason</label>
            <textarea id="warnReason" placeholder="Enter warning reason..." style="width: 100%; min-height: 80px; padding: 10px; border: 1px solid var(--border); border-radius: var(--radius-sm); resize: vertical;"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="secondary-btn" onclick="closeModal('adminWarnModal')">Cancel</button>
          <button class="primary-btn" onclick="submitWarn()" style="background: #f59e0b;">
            <i class="fas fa-exclamation-triangle"></i> Send Warning
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
    showToast('请输入警告理由', 'error');
    return;
  }
  
  socket.emit('admin:warnUser', {
    targetOdp: warnTarget,
    reason: reason
  });
  
  closeModal('adminWarnModal');
  showToast('警告已发送给用户', 'success');
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
          <h3><i class="fas fa-volume-mute" style="color: #ef4444;"></i> Mute User</h3>
          <button class="close-btn" onclick="closeModal('adminMuteModal')"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body">
          <p style="margin-bottom: 16px;">Mute User: <strong id="muteTargetName"></strong></p>
          <div class="form-group">
            <label>Mute Duration</label>
            <select id="muteDuration" style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: var(--radius-sm);">
              <option value="5">5 minutes</option>
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
              <option value="60">1 hour</option>
              <option value="1440">24 hours</option>
              <option value="10080">7 days</option>
            </select>
          </div>
          <div class="form-group">
            <label>Mute Reason</label>
            <textarea id="muteReason" placeholder="Enter mute reason..." style="width: 100%; min-height: 80px; padding: 10px; border: 1px solid var(--border); border-radius: var(--radius-sm); resize: vertical;"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="secondary-btn" onclick="closeModal('adminMuteModal')">Cancel</button>
          <button class="primary-btn" onclick="submitMute()" style="background: #ef4444;">
            <i class="fas fa-volume-mute"></i> Confirm Mute
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
    showToast('请输入禁言理由', 'error');
    return;
  }
  
  socket.emit('admin:muteUser', {
    targetOdp: muteTarget,
    minutes: duration,
    reason: reason
  });
  
  closeModal('adminMuteModal');
  showToast(`用户已被禁言 ${duration} 分钟`, 'success');
  muteTarget = null;
  muteTargetName = '';
}

// Receive admin warning
socket.on('user:warned', (data) => {
  // Create warning popup
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
          <h3 style="font-size: 20px; margin-bottom: 10px; color: #f59e0b;">System Warning</h3>
          <p style="color: var(--text-secondary); margin-bottom: 20px;">Admin has sent you a warning</p>
          <div style="background: #fef3c7; padding: 15px; border-radius: var(--radius-sm); margin-bottom: 20px; text-align: left;">
            <strong>Warning Reason:</strong>
            <p id="warningReason" style="margin-top: 5px;"></p>
          </div>
          <p style="font-size: 12px; color: var(--text-muted);" id="warningCount"></p>
          <button class="primary-btn" onclick="closeModal('warningNotifyModal')" style="width: 100%; margin-top: 15px;">I Understand</button>
        </div>
      </div>
    `;
    document.body.appendChild(warningModal);
  }
  
  document.getElementById('warningReason').textContent = data.reason;
  document.getElementById('warningCount').textContent = `You have been warned ${data.warningCount} times`;
  warningModal.classList.add('active');
});

// Expose global functions
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