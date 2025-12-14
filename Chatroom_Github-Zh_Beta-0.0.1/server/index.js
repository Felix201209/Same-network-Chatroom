const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const os = require('os');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 100 * 1024 * 1024
});

const PORT = process.env.PORT || 3000;
const ADMIN_PORT = 8001;

// ===== 角色和权限定义 =====
const ROLES = {
  SUPER_ADMIN: {
    name: 'SuperAdmin',
    level: 100,
    color: '#FF0000',
    badge: '👑 超级管理员',
    permissions: ['all']
  },
  ADMIN: {
    name: 'Admin',
    level: 80,
    color: '#FF6B00',
    badge: '⭐ 管理员',
    permissions: ['ban', 'mute', 'view_chats', 'manage_users', 'manage_rooms']
  },
  MODERATOR: {
    name: 'Moderator',
    level: 50,
    color: '#00A0FF',
    badge: '🛡️ 版主',
    permissions: ['mute', 'view_reports', 'manage_rooms']
  },
  VIP: {
    name: 'VIP',
    level: 20,
    color: '#FFD700',
    badge: '💎 VIP',
    permissions: []
  },
  USER: {
    name: 'User',
    level: 0,
    color: '#666666',
    badge: '',
    permissions: []
  }
};

// ===== 脏话过滤系统 =====
const PROFANITY_LIST = [
  // 中文脏话
  '傻逼', '操你妈', '草泥马', '你妈的', '妈的', '他妈的', '去你妈', '滚你妈',
  '狗日的', '王八蛋', '混蛋', '畜生', '废物', '垃圾', '白痴', '智障',
  '脑残', '弱智', '煞笔', 'sb', 'SB', '尼玛', '你麻痹', '麻痹',
  '贱人', '婊子', '妓女', '鸡巴', '屌', '屎', '尿', '屁眼',
  '日你', '干你', '艹', '肏', '逼', '骚货', '浪货', '死全家','滚蛋', '去死', 'ntm','nm', '鸡吧', 
  // 英文脏话
  'fuck', 'shit', 'bitch', 'asshole', 'dick', 'cock', 'pussy',
  'bastard', 'damn', 'crap', 'nigger', 'nigga', 'whore', 'slut'
];

// 转义正则表达式特殊字符
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsProfanity(text) {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  return PROFANITY_LIST.some(word => lowerText.includes(word.toLowerCase()));
}

function filterProfanity(text) {
  if (!text) return text;
  let filtered = text;
  PROFANITY_LIST.forEach(word => {
    const regex = new RegExp(escapeRegExp(word), 'gi');
    filtered = filtered.replace(regex, '*'.repeat(word.length));
  });
  return filtered;
}

// ===== 数据存储路径 =====
const dataDir = path.join(__dirname, '../data');
const uploadsDir = path.join(__dirname, '../uploads');
const avatarsDir = path.join(uploadsDir, 'avatars');
const filesDir = path.join(uploadsDir, 'files');
const voicesDir = path.join(uploadsDir, 'voices');
const imagesDir = path.join(uploadsDir, 'images');
const videosDir = path.join(uploadsDir, 'videos');
const adminDir = path.join(__dirname, '../admin');

// 创建所有必要的目录
[dataDir, uploadsDir, avatarsDir, filesDir, voicesDir, imagesDir, videosDir, adminDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// ===== 数据文件路径 =====
const usersFile = path.join(dataDir, 'users.json');
const messagesFile = path.join(dataDir, 'messages.json');
const roomsFile = path.join(dataDir, 'rooms.json');
const bansFile = path.join(dataDir, 'bans.json');
const friendsFile = path.join(dataDir, 'friends.json');
const friendRequestsFile = path.join(dataDir, 'friend_requests.json');
const customRolesFile = path.join(dataDir, 'custom_roles.json');
const momentsFile = path.join(dataDir, 'moments.json');
const offlineMessagesFile = path.join(dataDir, 'offline_messages.json');
const gamesFile = path.join(dataDir, 'games.json');
const reportsFile = path.join(dataDir, 'reports.json');
const warningsFile = path.join(dataDir, 'warnings.json');

// ===== 数据存储工具函数 =====
function loadJSON(filePath, defaultValue = {}) {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error(`加载 ${filePath} 失败:`, e);
  }
  return defaultValue;
}

function saveJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error(`保存 ${filePath} 失败:`, e);
  }
}

// ===== 加载持久化数据 =====
let registeredUsers = loadJSON(usersFile, {});
let allMessages = loadJSON(messagesFile, {});
let allRooms = loadJSON(roomsFile, {});
let bans = loadJSON(bansFile, { banned: {}, muted: {} });
let friends = loadJSON(friendsFile, {});
let friendRequests = loadJSON(friendRequestsFile, {});
let customRoles = loadJSON(customRolesFile, {});
let allMoments = loadJSON(momentsFile, []);
let offlineMessages = loadJSON(offlineMessagesFile, {});
let activeGames = loadJSON(gamesFile, {});
let reports = loadJSON(reportsFile, []);
let warnings = loadJSON(warningsFile, {});

// ===== 运行时数据 =====
const onlineSockets = new Map();
const userSockets = new Map();

// ===== 工具函数 =====
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function getChatId(odp1, odp2) {
  return [odp1, odp2].sort().join('_');
}

function formatRemaining(ms) {
  if (ms <= 0) return '已结束';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}天${hours % 24}小时`;
  if (hours > 0) return `${hours}小时${minutes % 60}分钟`;
  if (minutes > 0) return `${minutes}分钟`;
  return `${seconds}秒`;
}

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// ===== 初始化 SuperAdmin =====
function initSuperAdmin() {
  const superAdminId = 'super-admin-001';
  if (!registeredUsers[superAdminId]) {
    registeredUsers[superAdminId] = {
      odp: superAdminId,
      username: 'SuperAdmin',
      password: hashPassword('SuperAdmin@2024'),
      nickname: 'SuperAdmin',
      avatar: null,
      signature: '系统管理员',
      role: 'SUPER_ADMIN',
      createdAt: new Date().toISOString(),
      friends: [],
      groups: []
    };
    saveJSON(usersFile, registeredUsers);
    console.log('✅ SuperAdmin 账户已创建 (密码: SuperAdmin@2024)');
  }
}

// ===== 权限检查 =====
function hasPermission(user, permission) {
  if (!user || !user.role) return false;
  const role = ROLES[user.role] || customRoles[user.role] || ROLES.USER;
  return role.permissions.includes('all') || role.permissions.includes(permission);
}

function getRoleInfo(roleName) {
  return ROLES[roleName] || customRoles[roleName] || ROLES.USER;
}

// ===== 封禁检查 =====
function checkBan(odp) {
  const ban = bans.banned[odp];
  if (!ban) return null;
  if (ban.permanent) return ban;
  if (ban.until && new Date(ban.until) > new Date()) return ban;
  delete bans.banned[odp];
  saveJSON(bansFile, bans);
  return null;
}

function checkMute(odp) {
  const mute = bans.muted[odp];
  if (!mute) return null;
  if (mute.permanent) return mute;
  if (mute.until && new Date(mute.until) > new Date()) return mute;
  delete bans.muted[odp];
  saveJSON(bansFile, bans);
  return null;
}

// ===== 好友系统 =====
function areFriends(odp1, odp2) {
  const userFriends = friends[odp1] || [];
  return userFriends.includes(odp2);
}

function canSendMessage(senderOdp, receiverOdp) {
  // 如果是好友，允许发送
  if (areFriends(senderOdp, receiverOdp)) return { allowed: true };
  
  // 检查发送者是否是管理员（管理员不受限制）
  const sender = registeredUsers[senderOdp];
  if (sender) {
    const senderRole = sender.role;
    if (senderRole === 'SUPER_ADMIN' || senderRole === 'ADMIN' || senderRole === 'MODERATOR') {
      return { allowed: true };
    }
  }
  
  // 普通用户：检查是否已发送过消息且对方未回复
  const chatId = getChatId(senderOdp, receiverOdp);
  const messages = allMessages[chatId] || [];
  const senderMessages = messages.filter(m => m.senderId === senderOdp);
  const receiverReplied = messages.some(m => m.senderId === receiverOdp);
  
  if (senderMessages.length >= 1 && !receiverReplied) {
    return { allowed: false, reason: '对方还未回复，请等待对方回复或添加好友后再发送消息' };
  }
  
  return { allowed: true, isFirstMessage: senderMessages.length === 0 };
}

// ===== 警告用户 =====
function warnUser(targetOdp, reason, adminOdp) {
  const target = registeredUsers[targetOdp];
  const admin = registeredUsers[adminOdp];
  
  if (!warnings[targetOdp]) {
    warnings[targetOdp] = [];
  }
  
  const warning = {
    id: uuidv4(),
    reason,
    by: adminOdp,
    byName: admin?.nickname,
    createdAt: Date.now()
  };
  
  warnings[targetOdp].push(warning);
  saveJSON(warningsFile, warnings);
  
  // 通知被警告的用户
  const targetSocketId = userSockets.get(targetOdp);
  if (targetSocketId) {
    io.to(targetSocketId).emit('user:warned', {
      reason,
      byName: admin?.nickname,
      warningCount: warnings[targetOdp].length
    });
  }
  
  console.log(`[警告] ${admin?.nickname} 警告了 ${target?.nickname}: ${reason}`);
  
  // 如果警告次数达到3次，自动禁言30分钟
  if (warnings[targetOdp].length >= 3) {
    const until = Date.now() + 30 * 60 * 1000;
    bans.muted[targetOdp] = {
      by: 'system',
      reason: '累计3次警告，自动禁言',
      until,
      permanent: false
    };
    saveJSON(bansFile, bans);
    
    if (targetSocketId) {
      io.to(targetSocketId).emit('user:muted', {
        reason: '累计3次警告，自动禁言30分钟',
        duration: '30分钟',
        permanent: false
      });
    }
    
    // 清空警告记录
    warnings[targetOdp] = [];
    saveJSON(warningsFile, warnings);
  }
}

// ===== 通知管理员 =====
function notifyAdmins(event, data) {
  userSockets.forEach((socketId, odp) => {
    const user = registeredUsers[odp];
    if (user && hasPermission(user, 'view_reports')) {
      io.to(socketId).emit(event, data);
    }
  });
}

// ===== 获取用户公开信息 =====
function getUserPublicInfo(user) {
  const roleInfo = getRoleInfo(user.role);
  return {
    odp: user.odp,
    nickname: user.nickname,
    avatar: user.avatar,
    signature: user.signature,
    role: user.role,
    roleInfo: {
      name: roleInfo.name,
      color: roleInfo.color,
      badge: roleInfo.badge,
      level: roleInfo.level
    }
  };
}

// ===== 获取用户私有信息 =====
function getUserPrivateInfo(user) {
  const roleInfo = getRoleInfo(user.role);
  return {
    odp: user.odp,
    username: user.username,
    nickname: user.nickname,
    avatar: user.avatar,
    signature: user.signature,
    role: user.role,
    roleInfo: {
      name: roleInfo.name,
      color: roleInfo.color,
      badge: roleInfo.badge,
      level: roleInfo.level,
      permissions: roleInfo.permissions
    },
    friends: friends[user.odp] || []
  };
}

// ===== 配置文件上传 =====
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let dest = filesDir;
    if (file.mimetype.startsWith('image/')) dest = imagesDir;
    else if (file.mimetype.startsWith('video/')) dest = videosDir;
    else if (file.mimetype.startsWith('audio/')) dest = voicesDir;
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } });

// ===== Express 中间件 =====
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));
app.use('/uploads', express.static(uploadsDir));

// ===== API 路由 =====
app.get('/api/server-info', (req, res) => {
  res.json({ ip: getLocalIP(), port: PORT });
});

// 检查是否本地访问，自动登录SuperAdmin
app.get('/api/auto-login', (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;
  const isLocal = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
  
  if (isLocal) {
    const superAdmin = registeredUsers['super-admin-001'];
    if (superAdmin) {
      res.json({ 
        autoLogin: true, 
        user: getUserPrivateInfo(superAdmin)
      });
    } else {
      res.json({ autoLogin: false });
    }
  } else {
    res.json({ autoLogin: false });
  }
});

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, error: '没有文件' });
  
  let urlPath = '/uploads/files/';
  if (req.file.mimetype.startsWith('image/')) urlPath = '/uploads/images/';
  else if (req.file.mimetype.startsWith('video/')) urlPath = '/uploads/videos/';
  else if (req.file.mimetype.startsWith('audio/')) urlPath = '/uploads/voices/';
  
  res.json({
    success: true,
    url: `${urlPath}${req.file.filename}`,
    filename: req.file.originalname,
    size: req.file.size,
    type: req.file.mimetype
  });
});

app.post('/api/upload-avatar', upload.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '没有文件' });
  
  const newPath = path.join(avatarsDir, req.file.filename);
  if (req.file.path !== newPath) {
    fs.renameSync(req.file.path, newPath);
  }
  
  res.json({ url: `/uploads/avatars/${req.file.filename}` });
});

// ===== Socket.IO 连接处理 =====
io.on('connection', (socket) => {
  console.log(`[连接] ${socket.id}`);

  // ===== 辅助函数 =====
  function sendOnlineUsers(socket, excludeodp) {
    const onlineList = [];
    userSockets.forEach((socketId, odp) => {
      if (odp !== excludeodp) {
        const user = registeredUsers[odp];
        if (user) {
          onlineList.push({
            ...getUserPublicInfo(user),
            status: 'online',
            isFriend: areFriends(excludeodp, odp)
          });
        }
      }
    });
    socket.emit('users:list', onlineList);
  }

  function sendUserRooms(socket, odp) {
    const userRooms = [];
    Object.values(allRooms).forEach(room => {
      if (room.members.includes(odp)) {
        userRooms.push(room);
        socket.join(room.id);
      }
    });
    socket.emit('rooms:list', { rooms: userRooms });
  }

  function sendFriendRequests(socket, odp) {
    const requests = friendRequests[odp] || [];
    const pendingRequests = requests.filter(r => r.status === 'pending').map(r => ({
      ...r,
      senderInfo: getUserPublicInfo(registeredUsers[r.from])
    }));
    socket.emit('friend:requests', pendingRequests);
  }

  // ===== 会话恢复 =====
  socket.on('session:restore', (data) => {
    const { odp, username } = data;
    
    if (!odp || !registeredUsers[odp]) {
      return socket.emit('session:fail');
    }
    
    const ban = checkBan(odp);
    if (ban) {
      return socket.emit('login:fail', { 
        message: `账号已被封禁${ban.permanent ? '(永久)' : `至 ${new Date(ban.until).toLocaleString()}`}，原因: ${ban.reason}` 
      });
    }
    
    const user = registeredUsers[odp];
    
    if (userSockets.has(odp)) {
      const oldSocketId = userSockets.get(odp);
      if (oldSocketId !== socket.id) {
        const oldSocket = io.sockets.sockets.get(oldSocketId);
        if (oldSocket) {
          oldSocket.emit('force:logout', { message: '您的账号在其他设备登录' });
          oldSocket.disconnect();
        }
      }
    }
    
    onlineSockets.set(socket.id, odp);
    userSockets.set(odp, socket.id);
    
    socket.broadcast.emit('user:online', getUserPublicInfo(user));
    
    console.log(`[会话恢复] ${user.nickname} (${username})`);
    
    socket.emit('session:restored', { user: getUserPrivateInfo(user) });
    sendOnlineUsers(socket, user.odp);
    sendUserRooms(socket, user.odp);
    sendFriendRequests(socket, user.odp);
  });

  // ===== 用户注册 =====
  socket.on('user:register', (data) => {
    const { username, password, nickname, avatar, signature } = data;
    
    if (!username || !password) {
      return socket.emit('register:fail', { message: '用户名和密码不能为空' });
    }
    
    if (username.toLowerCase() === 'superadmin' || nickname?.toLowerCase() === 'superadmin') {
      return socket.emit('register:fail', { message: '该用户名/昵称不可用' });
    }
    
    // 脏话检测 - 用户名
    if (containsProfanity(username)) {
      return socket.emit('register:fail', { message: '用户名包含不当内容，请修改' });
    }
    
    // 脏话检测 - 昵称
    if (containsProfanity(nickname)) {
      return socket.emit('register:fail', { message: '昵称包含不当内容，请修改' });
    }
    
    if (username.length < 3 || username.length > 20) {
      return socket.emit('register:fail', { message: '用户名长度需要3-20个字符' });
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return socket.emit('register:fail', { message: '用户名只能包含字母、数字和下划线' });
    }
    
    if (password.length < 6) {
      return socket.emit('register:fail', { message: '密码至少需要6个字符' });
    }
    
    if (!/[a-zA-Z]/.test(password)) {
      return socket.emit('register:fail', { message: '密码需要包含至少一个字母' });
    }
    
    const existingUser = Object.values(registeredUsers).find(u => u.username.toLowerCase() === username.toLowerCase());
    if (existingUser) {
      return socket.emit('register:fail', { message: '用户名已存在' });
    }
    
    const odp = uuidv4();
    const user = {
      odp,
      username,
      password: hashPassword(password),
      nickname: nickname || username,
      avatar: avatar || null,
      signature: signature || '',
      role: 'USER',
      createdAt: new Date().toISOString(),
      friends: [],
      groups: []
    };
    
    registeredUsers[odp] = user;
    saveJSON(usersFile, registeredUsers);
    
    friends[odp] = [];
    saveJSON(friendsFile, friends);
    
    onlineSockets.set(socket.id, odp);
    userSockets.set(odp, socket.id);
    
    socket.broadcast.emit('user:online', getUserPublicInfo(user));
    
    console.log(`[注册] ${nickname || username} (${username})`);
    
    socket.emit('register:success', { user: getUserPrivateInfo(user) });
    sendOnlineUsers(socket, user.odp);
  });

  // ===== 用户登录 =====
  socket.on('user:login', (data) => {
    const { username, password } = data;
    
    if (!username || !password) {
      return socket.emit('login:fail', { message: '请输入用户名和密码' });
    }
    
    const user = Object.values(registeredUsers).find(u => u.username === username);
    if (!user) {
      return socket.emit('login:fail', { message: '用户不存在' });
    }
    
    if (user.password !== hashPassword(password)) {
      return socket.emit('login:fail', { message: '密码错误' });
    }
    
    const ban = checkBan(user.odp);
    if (ban) {
      return socket.emit('login:fail', { 
        message: `账号已被封禁${ban.permanent ? '(永久)' : `至 ${new Date(ban.until).toLocaleString()}`}，原因: ${ban.reason}` 
      });
    }
    
    if (user.role === 'SUPER_ADMIN') {
      const clientIP = socket.handshake.address;
      const isLocal = clientIP === '127.0.0.1' || clientIP === '::1' || clientIP === '::ffff:127.0.0.1';
      if (!isLocal) {
        return socket.emit('login:fail', { message: '该账号只能在本地登录' });
      }
    }
    
    if (userSockets.has(user.odp)) {
      const oldSocketId = userSockets.get(user.odp);
      const oldSocket = io.sockets.sockets.get(oldSocketId);
      if (oldSocket) {
        oldSocket.emit('force:logout', { message: '您的账号在其他设备登录' });
        oldSocket.disconnect();
      }
    }
    
    onlineSockets.set(socket.id, user.odp);
    userSockets.set(user.odp, socket.id);
    
    socket.broadcast.emit('user:online', getUserPublicInfo(user));
    
    console.log(`[登录] ${user.nickname} (${username})`);
    
    socket.emit('login:success', { user: getUserPrivateInfo(user) });
    sendOnlineUsers(socket, user.odp);
    sendUserRooms(socket, user.odp);
    sendFriendRequests(socket, user.odp);
  });

  // ===== 获取在线用户 =====
  socket.on('users:getOnline', () => {
    const myodp = onlineSockets.get(socket.id);
    if (myodp) {
      sendOnlineUsers(socket, myodp);
    }
  });

  // ===== 好友系统 =====
  socket.on('friend:request', (data) => {
    const senderOdp = onlineSockets.get(socket.id);
    if (!senderOdp) return;
    
    const { targetOdp } = data;
    if (!targetOdp || !registeredUsers[targetOdp]) {
      return socket.emit('friend:error', { message: '用户不存在' });
    }
    
    if (senderOdp === targetOdp) {
      return socket.emit('friend:error', { message: '不能添加自己为好友' });
    }
    
    if (areFriends(senderOdp, targetOdp)) {
      return socket.emit('friend:error', { message: '已经是好友了' });
    }
    
    const targetRequests = friendRequests[targetOdp] || [];
    const existingRequest = targetRequests.find(r => r.from === senderOdp && r.status === 'pending');
    if (existingRequest) {
      return socket.emit('friend:error', { message: '已发送过好友请求，请等待对方回应' });
    }
    
    const request = {
      id: uuidv4(),
      from: senderOdp,
      to: targetOdp,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    
    if (!friendRequests[targetOdp]) friendRequests[targetOdp] = [];
    friendRequests[targetOdp].push(request);
    saveJSON(friendRequestsFile, friendRequests);
    
    const targetSocketId = userSockets.get(targetOdp);
    if (targetSocketId) {
      io.to(targetSocketId).emit('friend:newRequest', {
        ...request,
        senderInfo: getUserPublicInfo(registeredUsers[senderOdp])
      });
    }
    
    socket.emit('friend:requestSent', { targetOdp });
    console.log(`[好友请求] ${registeredUsers[senderOdp].nickname} -> ${registeredUsers[targetOdp].nickname}`);
  });

  socket.on('friend:accept', (data) => {
    const myOdp = onlineSockets.get(socket.id);
    if (!myOdp) return;
    
    const { requestId } = data;
    const myRequests = friendRequests[myOdp] || [];
    const request = myRequests.find(r => r.id === requestId);
    
    if (!request || request.status !== 'pending') {
      return socket.emit('friend:error', { message: '好友请求不存在或已处理' });
    }
    
    request.status = 'accepted';
    saveJSON(friendRequestsFile, friendRequests);
    
    if (!friends[myOdp]) friends[myOdp] = [];
    if (!friends[request.from]) friends[request.from] = [];
    
    if (!friends[myOdp].includes(request.from)) {
      friends[myOdp].push(request.from);
    }
    if (!friends[request.from].includes(myOdp)) {
      friends[request.from].push(myOdp);
    }
    saveJSON(friendsFile, friends);
    
    socket.emit('friend:added', { friendOdp: request.from, friendInfo: getUserPublicInfo(registeredUsers[request.from]) });
    
    const senderSocketId = userSockets.get(request.from);
    if (senderSocketId) {
      io.to(senderSocketId).emit('friend:added', { friendOdp: myOdp, friendInfo: getUserPublicInfo(registeredUsers[myOdp]) });
    }
    
    console.log(`[成为好友] ${registeredUsers[myOdp].nickname} <-> ${registeredUsers[request.from].nickname}`);
  });

  socket.on('friend:reject', (data) => {
    const myOdp = onlineSockets.get(socket.id);
    if (!myOdp) return;
    
    const { requestId } = data;
    const myRequests = friendRequests[myOdp] || [];
    const request = myRequests.find(r => r.id === requestId);
    
    if (!request || request.status !== 'pending') {
      return socket.emit('friend:error', { message: '好友请求不存在或已处理' });
    }
    
    request.status = 'rejected';
    saveJSON(friendRequestsFile, friendRequests);
    
    socket.emit('friend:rejected', { requestId });
  });

  socket.on('friend:remove', (data) => {
    const myOdp = onlineSockets.get(socket.id);
    if (!myOdp) return;
    
    const { friendOdp } = data;
    
    if (friends[myOdp]) {
      friends[myOdp] = friends[myOdp].filter(f => f !== friendOdp);
    }
    if (friends[friendOdp]) {
      friends[friendOdp] = friends[friendOdp].filter(f => f !== myOdp);
    }
    saveJSON(friendsFile, friends);
    
    socket.emit('friend:removed', { friendOdp });
    
    const friendSocketId = userSockets.get(friendOdp);
    if (friendSocketId) {
      io.to(friendSocketId).emit('friend:removed', { friendOdp: myOdp });
    }
  });

  // 获取好友请求列表
  socket.on('friend:getRequests', () => {
    const myOdp = onlineSockets.get(socket.id);
    if (!myOdp) return;
    sendFriendRequests(socket, myOdp);
  });

  socket.on('friends:get', () => {
    const myOdp = onlineSockets.get(socket.id);
    if (!myOdp) return;
    
    const myFriends = (friends[myOdp] || []).map(fOdp => {
      const friend = registeredUsers[fOdp];
      if (!friend) return null;
      return {
        ...getUserPublicInfo(friend),
        online: userSockets.has(fOdp)
      };
    }).filter(f => f !== null);
    
    socket.emit('friends:list', myFriends);
  });

  // ===== 私聊消息 =====
  socket.on('message:private', (data) => {
    const senderId = onlineSockets.get(socket.id);
    if (!senderId) return;
    
    const sender = registeredUsers[senderId];
    if (!sender) return;
    
    const mute = checkMute(senderId);
    if (mute) {
      const remaining = mute.permanent ? '永久' : formatRemaining(new Date(mute.until) - Date.now());
      return socket.emit('message:error', { 
        message: `您已被禁言`,
        type: 'mute',
        detail: {
          reason: mute.reason || '违反规定',
          duration: mute.permanent ? '永久' : `至 ${new Date(mute.until).toLocaleString()}`,
          remaining: remaining,
          permanent: mute.permanent
        }
      });
    }
    
    const receiverId = data.to || data.receiverId;
    const { type, filename, filesize, duration, replyTo } = data;
    let { content } = data;
    
    if (!receiverId || !content) return;
    
    // 脏话检测 - 文本消息
    if (type === 'text' || !type) {
      if (containsProfanity(content)) {
        content = filterProfanity(content);
      }
    }
    
    const canSend = canSendMessage(senderId, receiverId);
    if (!canSend.allowed) {
      return socket.emit('message:error', { message: canSend.reason });
    }
    
    const message = {
      id: uuidv4(),
      type: type || 'text',
      content,
      filename,
      filesize,
      duration,
      from: senderId,
      to: receiverId,
      senderId,
      senderName: sender.nickname,
      senderAvatar: sender.avatar,
      senderRole: sender.role,
      senderRoleInfo: getRoleInfo(sender.role),
      receiverId,
      timestamp: Date.now(),
      status: 'sent',
      replyTo: replyTo || null,
      isFirstMessage: canSend.isFirstMessage || false
    };
    
    const chatId = getChatId(senderId, receiverId);
    if (!allMessages[chatId]) {
      allMessages[chatId] = [];
    }
    allMessages[chatId].push(message);
    saveJSON(messagesFile, allMessages);
    
    const receiverSocketId = userSockets.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('message:private', message);
      message.status = 'delivered';
    }
    
    socket.emit('message:private', message);
    
    console.log(`[私聊] ${sender.nickname} -> ${registeredUsers[receiverId]?.nickname || receiverId}: ${type === 'text' ? content.slice(0, 20) : `[${type}]`}`);
  });

  // ===== 戳一戳 =====
  socket.on('poke', (data) => {
    const senderOdp = onlineSockets.get(socket.id);
    if (!senderOdp) return;
    
    const { targetOdp } = data;
    const sender = registeredUsers[senderOdp];
    const target = registeredUsers[targetOdp];
    
    if (!target) return;
    
    const targetSocketId = userSockets.get(targetOdp);
    if (targetSocketId) {
      io.to(targetSocketId).emit('poked', {
        from: senderOdp,
        fromName: sender.nickname,
        fromAvatar: sender.avatar
      });
    }
    
    // 发送系统消息给双方
    const chatId = getChatId(senderOdp, targetOdp);
    const systemMsg = {
      id: uuidv4(),
      type: 'system',
      content: `${sender.nickname} 戳了戳 ${target.nickname}`,
      timestamp: Date.now()
    };
    
    if (!allMessages[chatId]) allMessages[chatId] = [];
    allMessages[chatId].push(systemMsg);
    saveJSON(messagesFile, allMessages);
    
    socket.emit('message:private', systemMsg);
    if (targetSocketId) {
      io.to(targetSocketId).emit('message:private', systemMsg);
    }
    
    console.log(`[戳一戳] ${sender.nickname} 戳了 ${target.nickname}`);
  });

  // ===== 消息表情反应 =====
  socket.on('message:react', (data) => {
    const senderOdp = onlineSockets.get(socket.id);
    if (!senderOdp) return;
    
    const { messageId, emoji, chatType, chatId } = data;
    const sender = registeredUsers[senderOdp];
    
    const messagesKey = chatType === 'room' ? `room_${chatId}` : chatId;
    const messages = allMessages[messagesKey];
    
    if (!messages) return;
    
    const message = messages.find(m => m.id === messageId);
    if (!message) return;
    
    if (!message.reactions) message.reactions = {};
    if (!message.reactions[emoji]) message.reactions[emoji] = [];
    
    const existingIndex = message.reactions[emoji].indexOf(senderOdp);
    if (existingIndex > -1) {
      message.reactions[emoji].splice(existingIndex, 1);
      if (message.reactions[emoji].length === 0) {
        delete message.reactions[emoji];
      }
    } else {
      message.reactions[emoji].push(senderOdp);
    }
    
    saveJSON(messagesFile, allMessages);
    
    const reactionData = {
      messageId,
      reactions: message.reactions,
      reactedBy: senderOdp,
      reactedByName: sender.nickname,
      emoji
    };
    
    if (chatType === 'room') {
      io.to(chatId).emit('message:reacted', reactionData);
    } else {
      socket.emit('message:reacted', reactionData);
      const otherOdp = chatId.split('_').find(id => id !== senderOdp);
      const otherSocketId = userSockets.get(otherOdp);
      if (otherSocketId) {
        io.to(otherSocketId).emit('message:reacted', reactionData);
      }
    }
  });

  // ===== 获取消息历史 =====
  socket.on('messages:get', (data) => {
    const myodp = onlineSockets.get(socket.id);
    if (!myodp) return socket.emit('messages:history', { chatId: data?.targetId, messages: [] });
    
    const { type, targetId } = data;
    
    if (type === 'private') {
      const chatId = getChatId(myodp, targetId);
      const messages = allMessages[chatId] || [];
      socket.emit('messages:history', { chatId: targetId, messages });
    } else if (type === 'room') {
      const messages = allMessages[`room_${targetId}`] || [];
      socket.emit('messages:history', { chatId: targetId, messages });
    }
  });

  // ===== 群聊消息 =====
  socket.on('message:room', (data) => {
    const senderId = onlineSockets.get(socket.id);
    if (!senderId) return;
    
    const sender = registeredUsers[senderId];
    if (!sender) return;
    
    const mute = checkMute(senderId);
    if (mute) {
      const remaining = mute.permanent ? '永久' : formatRemaining(new Date(mute.until) - Date.now());
      return socket.emit('message:error', { 
        message: `您已被禁言`,
        type: 'mute',
        detail: {
          reason: mute.reason || '违反规定',
          duration: mute.permanent ? '永久' : `至 ${new Date(mute.until).toLocaleString()}`,
          remaining: remaining,
          permanent: mute.permanent
        }
      });
    }
    
    const { roomId, type, filename, filesize, duration, replyTo } = data;
    let { content } = data;
    
    if (!roomId || !content) return;
    
    // 脏话检测 - 群聊消息
    if (type === 'text' || !type) {
      if (containsProfanity(content)) {
        content = filterProfanity(content);
      }
    }
    
    const room = allRooms[roomId];
    if (!room || !room.members.includes(senderId)) {
      return socket.emit('message:error', { message: '您不是该群成员' });
    }
    
    const message = {
      id: uuidv4(),
      roomId,
      roomName: room.name,
      type: type || 'text',
      content,
      filename,
      filesize,
      duration,
      senderId,
      senderName: sender.nickname,
      senderAvatar: sender.avatar,
      senderRole: sender.role,
      senderRoleInfo: getRoleInfo(sender.role),
      timestamp: Date.now(),
      replyTo: replyTo || null
    };
    
    if (!allMessages[`room_${roomId}`]) {
      allMessages[`room_${roomId}`] = [];
    }
    allMessages[`room_${roomId}`].push(message);
    saveJSON(messagesFile, allMessages);
    
    io.to(roomId).emit('message:room', message);
    
    console.log(`[群聊:${room.name}] ${sender.nickname}: ${type === 'text' ? content.slice(0, 20) : `[${type}]`}`);
  });

  // ===== 创建群聊 =====
  socket.on('room:create', (data) => {
    const creatorOdp = onlineSockets.get(socket.id);
    if (!creatorOdp) return;
    
    const { name, members = [] } = data;
    
    if (!name || name.length < 2) {
      return socket.emit('room:error', { message: '群名称至少需要2个字符' });
    }
    
    // 脏话检测 - 群名
    if (containsProfanity(name)) {
      return socket.emit('room:error', { message: '群名称包含不当内容，请修改' });
    }
    
    const roomId = uuidv4();
    const allMembers = [...new Set([creatorOdp, ...members])];
    
    const room = {
      id: roomId,
      name,
      owner: creatorOdp,
      admins: [],
      members: allMembers,
      createdAt: new Date().toISOString(),
      settings: {
        allowInvite: true,
        muteAll: false
      }
    };
    
    allRooms[roomId] = room;
    saveJSON(roomsFile, allRooms);
    
    allMembers.forEach(memberOdp => {
      const memberSocketId = userSockets.get(memberOdp);
      if (memberSocketId) {
        const memberSocket = io.sockets.sockets.get(memberSocketId);
        if (memberSocket) {
          memberSocket.join(roomId);
          io.to(memberSocketId).emit('room:joined', room);
        }
      }
    });
    
    socket.emit('room:created', room);
    console.log(`[创建群聊] ${name} by ${registeredUsers[creatorOdp].nickname}`);
  });

  // ===== 群聊管理 =====
  socket.on('room:kick', (data) => {
    const myOdp = onlineSockets.get(socket.id);
    if (!myOdp) return;
    
    const { roomId, targetOdp } = data;
    const room = allRooms[roomId];
    
    if (!room) return socket.emit('room:error', { message: '群聊不存在' });
    
    const user = registeredUsers[myOdp];
    const isOwner = room.owner === myOdp;
    const isAdmin = room.admins?.includes(myOdp);
    const hasAdminPerm = hasPermission(user, 'manage_rooms');
    
    if (!isOwner && !isAdmin && !hasAdminPerm) {
      return socket.emit('room:error', { message: '您没有权限踢人' });
    }
    
    if (targetOdp === room.owner) {
      return socket.emit('room:error', { message: '不能踢出群主' });
    }
    
    room.members = room.members.filter(m => m !== targetOdp);
    room.admins = (room.admins || []).filter(a => a !== targetOdp);
    saveJSON(roomsFile, allRooms);
    
    const targetSocketId = userSockets.get(targetOdp);
    if (targetSocketId) {
      const targetSocket = io.sockets.sockets.get(targetSocketId);
      if (targetSocket) {
        targetSocket.leave(roomId);
        io.to(targetSocketId).emit('room:kicked', { roomId, roomName: room.name });
      }
    }
    
    io.to(roomId).emit('room:memberLeft', { roomId, memberOdp: targetOdp });
    
    console.log(`[踢出群聊] ${registeredUsers[targetOdp]?.nickname} 被踢出 ${room.name}`);
  });

  socket.on('room:update', (data) => {
    const myOdp = onlineSockets.get(socket.id);
    if (!myOdp) return;
    
    const { roomId, name, settings } = data;
    const room = allRooms[roomId];
    
    if (!room) return socket.emit('room:error', { message: '群聊不存在' });
    
    const user = registeredUsers[myOdp];
    const isOwner = room.owner === myOdp;
    const hasAdminPerm = hasPermission(user, 'manage_rooms');
    
    if (!isOwner && !hasAdminPerm) {
      return socket.emit('room:error', { message: '只有群主可以修改群设置' });
    }
    
    // 脏话检测 - 群名修改
    if (name && containsProfanity(name)) {
      return socket.emit('room:error', { message: '群名称包含不当内容，请修改' });
    }
    
    if (name) room.name = name;
    if (settings) room.settings = { ...room.settings, ...settings };
    
    saveJSON(roomsFile, allRooms);
    
    io.to(roomId).emit('room:updated', room);
  });

  socket.on('room:setAdmin', (data) => {
    const myOdp = onlineSockets.get(socket.id);
    if (!myOdp) return;
    
    const { roomId, targetOdp, isAdmin } = data;
    const room = allRooms[roomId];
    
    if (!room) return socket.emit('room:error', { message: '群聊不存在' });
    if (room.owner !== myOdp) return socket.emit('room:error', { message: '只有群主可以设置管理员' });
    
    if (!room.admins) room.admins = [];
    
    if (isAdmin && !room.admins.includes(targetOdp)) {
      room.admins.push(targetOdp);
    } else if (!isAdmin) {
      room.admins = room.admins.filter(a => a !== targetOdp);
    }
    
    saveJSON(roomsFile, allRooms);
    io.to(roomId).emit('room:updated', room);
  });

  // ===== 邀请成员入群 =====
  socket.on('room:invite', (data) => {
    const myOdp = onlineSockets.get(socket.id);
    if (!myOdp) return;
    
    const { roomId, targetOdps } = data;
    const room = allRooms[roomId];
    
    if (!room) return socket.emit('room:error', { message: '群聊不存在' });
    if (!room.members.includes(myOdp)) return socket.emit('room:error', { message: '您不是该群成员' });
    
    // 检查群设置是否允许邀请
    if (room.settings && room.settings.allowInvite === false) {
      const isOwner = room.owner === myOdp;
      const isAdmin = room.admins?.includes(myOdp);
      if (!isOwner && !isAdmin) {
        return socket.emit('room:error', { message: '该群禁止普通成员邀请新人' });
      }
    }
    
    const inviter = registeredUsers[myOdp];
    const newMembers = [];
    
    for (const targetOdp of targetOdps) {
      if (!room.members.includes(targetOdp) && registeredUsers[targetOdp]) {
        room.members.push(targetOdp);
        newMembers.push(targetOdp);
        
        // 加入socket房间
        const targetSocketId = userSockets.get(targetOdp);
        if (targetSocketId) {
          const targetSocket = io.sockets.sockets.get(targetSocketId);
          if (targetSocket) {
            targetSocket.join(roomId);
            io.to(targetSocketId).emit('room:joined', room);
          }
        }
      }
    }
    
    if (newMembers.length > 0) {
      saveJSON(roomsFile, allRooms);
      
      // 发送系统消息通知群内成员
      const newMemberNames = newMembers.map(odp => registeredUsers[odp]?.nickname || '未知用户').join('、');
      const systemMsg = {
        id: uuidv4(),
        roomId,
        type: 'system',
        content: `${inviter.nickname} 邀请了 ${newMemberNames} 加入群聊`,
        timestamp: Date.now()
      };
      
      if (!allMessages[`room_${roomId}`]) {
        allMessages[`room_${roomId}`] = [];
      }
      allMessages[`room_${roomId}`].push(systemMsg);
      saveJSON(messagesFile, allMessages);
      
      io.to(roomId).emit('message:room', systemMsg);
      io.to(roomId).emit('room:updated', room);
      
      console.log(`[邀请入群] ${inviter.nickname} 邀请了 ${newMemberNames} 加入 ${room.name}`);
    }
    
    socket.emit('room:inviteSuccess', { count: newMembers.length });
  });

  // ===== 更新群头像 =====
  socket.on('room:updateAvatar', (data) => {
    const myOdp = onlineSockets.get(socket.id);
    if (!myOdp) return;
    
    const { roomId, avatar } = data;
    const room = allRooms[roomId];
    
    if (!room) return socket.emit('room:error', { message: '群聊不存在' });
    if (room.owner !== myOdp) return socket.emit('room:error', { message: '只有群主可以修改群头像' });
    
    room.avatar = avatar;
    saveJSON(roomsFile, allRooms);
    
    io.to(roomId).emit('room:updated', room);
    console.log(`[群头像] ${room.name} 的群头像已更新`);
  });

  // ===== 更新群公告 =====
  socket.on('room:updateAnnouncement', (data) => {
    const myOdp = onlineSockets.get(socket.id);
    if (!myOdp) return;
    
    const { roomId, announcement } = data;
    const room = allRooms[roomId];
    
    if (!room) return socket.emit('room:error', { message: '群聊不存在' });
    
    const isOwner = room.owner === myOdp;
    const isAdmin = room.admins?.includes(myOdp);
    if (!isOwner && !isAdmin) {
      return socket.emit('room:error', { message: '只有群主或管理员可以发布公告' });
    }
    
    room.announcement = announcement;
    saveJSON(roomsFile, allRooms);
    
    // 发送系统消息通知群公告
    const announcer = registeredUsers[myOdp];
    const systemMsg = {
      id: uuidv4(),
      roomId,
      type: 'system',
      content: `📢 群公告：${announcement}`,
      timestamp: Date.now()
    };
    
    if (!allMessages[`room_${roomId}`]) {
      allMessages[`room_${roomId}`] = [];
    }
    allMessages[`room_${roomId}`].push(systemMsg);
    saveJSON(messagesFile, allMessages);
    
    io.to(roomId).emit('message:room', systemMsg);
    io.to(roomId).emit('room:updated', room);
    console.log(`[群公告] ${announcer.nickname} 在 ${room.name} 发布了公告`);
  });

  // ===== 退出群聊 =====
  socket.on('room:leave', (data) => {
    const myOdp = onlineSockets.get(socket.id);
    if (!myOdp) return;
    
    const { roomId } = data;
    const room = allRooms[roomId];
    
    if (!room) return socket.emit('room:error', { message: '群聊不存在' });
    if (room.owner === myOdp) return socket.emit('room:error', { message: '群主不能退出群聊，请先转让群主或解散群聊' });
    
    room.members = room.members.filter(m => m !== myOdp);
    if (room.admins) room.admins = room.admins.filter(a => a !== myOdp);
    
    saveJSON(roomsFile, allRooms);
    
    socket.leave(roomId);
    
    const leaver = registeredUsers[myOdp];
    const systemMsg = {
      id: uuidv4(),
      roomId,
      type: 'system',
      content: `${leaver.nickname} 退出了群聊`,
      timestamp: Date.now()
    };
    
    if (!allMessages[`room_${roomId}`]) {
      allMessages[`room_${roomId}`] = [];
    }
    allMessages[`room_${roomId}`].push(systemMsg);
    saveJSON(messagesFile, allMessages);
    
    io.to(roomId).emit('message:room', systemMsg);
    io.to(roomId).emit('room:updated', room);
    socket.emit('room:left', { roomId });
    
    console.log(`[退出群聊] ${leaver.nickname} 退出了 ${room.name}`);
  });

  // ===== 解散群聊 =====
  socket.on('room:disband', (data) => {
    const myOdp = onlineSockets.get(socket.id);
    if (!myOdp) return;
    
    const { roomId } = data;
    const room = allRooms[roomId];
    
    if (!room) return socket.emit('room:error', { message: '群聊不存在' });
    if (room.owner !== myOdp) return socket.emit('room:error', { message: '只有群主可以解散群聊' });
    
    const roomName = room.name;
    
    // 通知所有成员
    io.to(roomId).emit('room:disbanded', { roomId, roomName });
    
    // 删除群聊
    delete allRooms[roomId];
    saveJSON(roomsFile, allRooms);
    
    // 删除群消息
    delete allMessages[`room_${roomId}`];
    saveJSON(messagesFile, allMessages);
    
    console.log(`[解散群聊] ${registeredUsers[myOdp].nickname} 解散了 ${roomName}`);
  });

  // ===== 正在输入 =====
  socket.on('user:typing', (data) => {
    const senderId = onlineSockets.get(socket.id);
    if (!senderId) return;
    
    const receiverSocketId = userSockets.get(data.to);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('user:typing', { from: senderId });
    }
  });

  // ===== 修改密码 =====
  socket.on('user:changePassword', (data) => {
    const myOdp = onlineSockets.get(socket.id);
    if (!myOdp) return;
    
    const { oldPassword, newPassword } = data;
    const user = registeredUsers[myOdp];
    
    if (!user) return socket.emit('password:error', { message: '用户不存在' });
    
    if (user.password !== hashPassword(oldPassword)) {
      return socket.emit('password:error', { message: '原密码错误' });
    }
    
    if (newPassword.length < 6) {
      return socket.emit('password:error', { message: '新密码至少需要6个字符' });
    }
    
    user.password = hashPassword(newPassword);
    saveJSON(usersFile, registeredUsers);
    
    socket.emit('password:changed');
  });

  // ===== 更新个人资料 =====
  socket.on('user:updateProfile', (data) => {
    const myOdp = onlineSockets.get(socket.id);
    if (!myOdp) return;
    
    const user = registeredUsers[myOdp];
    if (!user) return;
    
    const { nickname, signature, avatar } = data;
    
    if (nickname?.toLowerCase() === 'superadmin') {
      return socket.emit('profile:error', { message: '该昵称不可用' });
    }
    
    if (nickname) user.nickname = nickname;
    if (signature !== undefined) user.signature = signature;
    if (avatar !== undefined) user.avatar = avatar;
    
    saveJSON(usersFile, registeredUsers);
    
    socket.emit('profile:updated', getUserPrivateInfo(user));
    socket.broadcast.emit('user:updated', getUserPublicInfo(user));
  });

  // ===== 朋友圈功能 =====
  socket.on('moments:get', () => {
    socket.emit('moments:list', allMoments);
  });

  socket.on('moments:post', (data) => {
    const myOdp = onlineSockets.get(socket.id);
    if (!myOdp) return;
    
    const user = registeredUsers[myOdp];
    if (!user) return;
    
    const { content, images } = data;
    
    if (!content && (!images || images.length === 0)) {
      return socket.emit('moments:error', { message: '内容不能为空' });
    }
    
    // 脏话检测
    if (containsProfanity(content)) {
      return socket.emit('moments:error', { message: '内容包含不当词汇' });
    }
    
    const moment = {
      id: uuidv4(),
      odp: myOdp,
      nickname: user.nickname,
      avatar: user.avatar,
      content: content || '',
      images: images || [],
      likes: [],
      comments: [],
      timestamp: Date.now()
    };
    
    allMoments.unshift(moment);
    // 只保留最近100条朋友圈
    if (allMoments.length > 100) {
      allMoments = allMoments.slice(0, 100);
    }
    saveJSON(momentsFile, allMoments);
    
    // 广播给所有在线用户
    io.emit('moments:new', moment);
    
    console.log(`[朋友圈] ${user.nickname} 发布了新动态`);
  });

  socket.on('moments:like', (data) => {
    const myOdp = onlineSockets.get(socket.id);
    if (!myOdp) return;
    
    const { momentId } = data;
    const moment = allMoments.find(m => m.id === momentId);
    
    if (!moment) return;
    
    const likeIndex = moment.likes.indexOf(myOdp);
    if (likeIndex === -1) {
      moment.likes.push(myOdp);
    } else {
      moment.likes.splice(likeIndex, 1);
    }
    
    saveJSON(momentsFile, allMoments);
    io.emit('moments:updated', moment);
  });

  socket.on('moments:comment', (data) => {
    const myOdp = onlineSockets.get(socket.id);
    if (!myOdp) return;
    
    const user = registeredUsers[myOdp];
    if (!user) return;
    
    const { momentId, content } = data;
    
    if (!content) return;
    
    // 脏话检测
    if (containsProfanity(content)) {
      return socket.emit('moments:error', { message: '评论包含不当词汇' });
    }
    
    const moment = allMoments.find(m => m.id === momentId);
    if (!moment) return;
    
    moment.comments.push({
      id: uuidv4(),
      odp: myOdp,
      nickname: user.nickname,
      content: filterProfanity(content),
      timestamp: Date.now()
    });
    
    saveJSON(momentsFile, allMoments);
    io.emit('moments:updated', moment);
  });

  socket.on('moments:delete', (data) => {
    const myOdp = onlineSockets.get(socket.id);
    if (!myOdp) return;
    
    const user = registeredUsers[myOdp];
    const { momentId } = data;
    
    const momentIndex = allMoments.findIndex(m => m.id === momentId);
    if (momentIndex === -1) return;
    
    const moment = allMoments[momentIndex];
    
    // 只有本人或管理员可以删除
    const hasAdminPerm = hasPermission(user, 'manage_users');
    if (moment.odp !== myOdp && !hasAdminPerm) {
      return socket.emit('moments:error', { message: '无权删除此动态' });
    }
    
    allMoments.splice(momentIndex, 1);
    saveJSON(momentsFile, allMoments);
    io.emit('moments:deleted', { momentId });
  });

  // ===== 游戏系统 =====
  
  // 发送游戏邀请
  socket.on('game:invite', (data) => {
    const fromOdp = onlineSockets.get(socket.id);
    if (!fromOdp) return;
    
    const { to, gameType } = data;
    const toSocketId = userSockets.get(to);
    
    if (!toSocketId) {
      return socket.emit('game:error', { message: '对方不在线' });
    }
    
    const gameId = uuidv4();
    activeGames[gameId] = {
      id: gameId,
      type: gameType,
      players: [fromOdp, to],
      host: fromOdp,
      state: 'waiting',
      createdAt: Date.now()
    };
    
    const fromUser = registeredUsers[fromOdp];
    
    io.to(toSocketId).emit('game:invited', {
      gameId,
      from: fromOdp,
      fromInfo: getUserPublicInfo(fromUser),
      gameType
    });
    
    console.log(`[游戏] ${fromUser.nickname} 邀请 ${registeredUsers[to]?.nickname} 玩 ${gameType}`);
  });
  
  // 接受游戏邀请
  socket.on('game:accept', (data) => {
    const { gameId, from } = data;
    const myOdp = onlineSockets.get(socket.id);
    if (!myOdp) return;
    
    const game = activeGames[gameId];
    if (!game || game.state !== 'waiting') {
      return socket.emit('game:error', { message: '游戏不存在或已开始' });
    }
    
    game.state = 'playing';
    
    // 通知双方游戏开始
    const hostSocketId = userSockets.get(game.host);
    const guestSocketId = userSockets.get(myOdp);
    
    if (hostSocketId) {
      io.to(hostSocketId).emit('game:start', { gameId, opponent: myOdp });
    }
    if (guestSocketId) {
      io.to(guestSocketId).emit('game:start', { gameId, opponent: game.host });
    }
    
    console.log(`[游戏] ${registeredUsers[myOdp]?.nickname} 接受了游戏邀请，游戏开始`);
  });
  
  // 拒绝游戏邀请
  socket.on('game:decline', (data) => {
    const { gameId, from } = data;
    
    const game = activeGames[gameId];
    if (game) {
      const hostSocketId = userSockets.get(game.host);
      if (hostSocketId) {
        io.to(hostSocketId).emit('game:declined');
      }
      delete activeGames[gameId];
    }
  });
  
  // 游戏移动
  socket.on('game:move', (data) => {
    const { gameId, move } = data;
    const myOdp = onlineSockets.get(socket.id);
    if (!myOdp) return;
    
    const game = activeGames[gameId];
    if (!game) return;
    
    // 找到对手
    const opponentOdp = game.players.find(p => p !== myOdp);
    const opponentSocketId = userSockets.get(opponentOdp);
    
    if (opponentSocketId) {
      // 处理猜数字游戏的特殊逻辑
      if (game.type === 'guess' && move.action === 'guess' && game.targetNumber !== undefined) {
        let result;
        if (move.guess === game.targetNumber) {
          result = 'correct';
        } else if (move.guess > game.targetNumber) {
          result = 'high';
        } else {
          result = 'low';
        }
        
        // 发送结果给猜的人
        socket.emit('game:move', { move: { action: 'result', guess: move.guess, result } });
        // 发送猜测给设置数字的人
        io.to(opponentSocketId).emit('game:move', { move: { action: 'guess', guess: move.guess } });
      } else if (game.type === 'guess' && move.action === 'setNumber') {
        game.targetNumber = move.number;
        io.to(opponentSocketId).emit('game:move', { move });
      } else {
        io.to(opponentSocketId).emit('game:move', { move });
      }
    }
  });
  
  // 离开游戏
  socket.on('game:leave', (data) => {
    const { gameId } = data;
    const myOdp = onlineSockets.get(socket.id);
    if (!myOdp) return;
    
    const game = activeGames[gameId];
    if (game) {
      const opponentOdp = game.players.find(p => p !== myOdp);
      const opponentSocketId = userSockets.get(opponentOdp);
      
      if (opponentSocketId) {
        io.to(opponentSocketId).emit('game:left');
      }
      
      delete activeGames[gameId];
    }
  });

  // ===== 举报用户 =====
  socket.on('report:user', (data) => {
    const reporterOdp = onlineSockets.get(socket.id);
    if (!reporterOdp) return;
    
    const { targetOdp, reason, messageId, chatId } = data;
    if (!targetOdp || !reason) {
      return socket.emit('report:error', { message: '请填写举报原因' });
    }
    
    const reporter = registeredUsers[reporterOdp];
    const target = registeredUsers[targetOdp];
    
    if (!target) {
      return socket.emit('report:error', { message: '用户不存在' });
    }
    
    const report = {
      id: uuidv4(),
      reporterOdp,
      reporterName: reporter?.nickname,
      targetOdp,
      targetName: target?.nickname,
      reason,
      messageId,
      chatId,
      status: 'pending', // pending, handled, dismissed
      createdAt: Date.now()
    };
    
    reports.push(report);
    saveJSON(reportsFile, reports);
    
    // 通知管理员
    notifyAdmins('report:new', report);
    
    socket.emit('report:success', { message: '举报已提交，管理员会尽快处理' });
    console.log(`[举报] ${reporter?.nickname} 举报了 ${target?.nickname}: ${reason}`);
  });

  // ===== 管理员获取举报列表 =====
  socket.on('admin:getReports', () => {
    const myOdp = onlineSockets.get(socket.id);
    if (!myOdp) return;
    
    const user = registeredUsers[myOdp];
    if (!hasPermission(user, 'view_reports')) {
      return socket.emit('admin:error', { message: '无权限查看举报' });
    }
    
    socket.emit('admin:reports', reports.filter(r => r.status === 'pending'));
  });

  // ===== 管理员处理举报 =====
  socket.on('admin:handleReport', (data) => {
    const adminOdp = onlineSockets.get(socket.id);
    if (!adminOdp) return;
    
    const admin = registeredUsers[adminOdp];
    if (!hasPermission(admin, 'view_reports')) {
      return socket.emit('admin:error', { message: '无权限处理举报' });
    }
    
    const { reportId, action, muteMinutes, reason } = data;
    const report = reports.find(r => r.id === reportId);
    
    if (!report) {
      return socket.emit('admin:error', { message: '举报不存在' });
    }
    
    report.status = 'handled';
    report.handledBy = adminOdp;
    report.handledAt = Date.now();
    report.action = action;
    
    if (action === 'warn') {
      // 警告用户
      warnUser(report.targetOdp, reason || report.reason, adminOdp);
    } else if (action === 'mute') {
      // 禁言用户
      const until = Date.now() + (muteMinutes || 30) * 60 * 1000;
      bans.muted[report.targetOdp] = {
        by: adminOdp,
        reason: reason || report.reason,
        until,
        permanent: false
      };
      saveJSON(bansFile, bans);
      
      const targetSocketId = userSockets.get(report.targetOdp);
      if (targetSocketId) {
        io.to(targetSocketId).emit('user:muted', {
          reason: reason || report.reason,
          duration: `${muteMinutes || 30}分钟`,
          permanent: false
        });
      }
    }
    
    saveJSON(reportsFile, reports);
    socket.emit('admin:reportHandled', { reportId, action });
  });

  // ===== 管理员警告用户 =====
  socket.on('admin:warnUser', (data) => {
    const adminOdp = onlineSockets.get(socket.id);
    if (!adminOdp) return;
    
    const admin = registeredUsers[adminOdp];
    if (!hasPermission(admin, 'mute')) {
      return socket.emit('admin:error', { message: '无权限警告用户' });
    }
    
    const { targetOdp, reason } = data;
    if (!targetOdp || !reason) return;
    
    warnUser(targetOdp, reason, adminOdp);
    socket.emit('admin:warnSuccess', { message: '警告已发送' });
  });

  // ===== 管理员禁言用户 =====
  socket.on('admin:muteUser', (data) => {
    const adminOdp = onlineSockets.get(socket.id);
    if (!adminOdp) return;
    
    const admin = registeredUsers[adminOdp];
    if (!hasPermission(admin, 'mute')) {
      return socket.emit('admin:error', { message: '无权限禁言用户' });
    }
    
    const { targetOdp, minutes, reason } = data;
    const target = registeredUsers[targetOdp];
    
    if (!target) {
      return socket.emit('admin:error', { message: '用户不存在' });
    }
    
    // 不能禁言比自己等级高的用户
    const adminRole = getRoleInfo(admin.role);
    const targetRole = getRoleInfo(target.role);
    if (targetRole.level >= adminRole.level) {
      return socket.emit('admin:error', { message: '无法禁言同级或更高级别的用户' });
    }
    
    const until = Date.now() + (minutes || 30) * 60 * 1000;
    bans.muted[targetOdp] = {
      by: adminOdp,
      reason: reason || '违反聊天规则',
      until,
      permanent: false
    };
    saveJSON(bansFile, bans);
    
    const targetSocketId = userSockets.get(targetOdp);
    if (targetSocketId) {
      io.to(targetSocketId).emit('user:muted', {
        reason: reason || '违反聊天规则',
        duration: `${minutes || 30}分钟`,
        permanent: false
      });
    }
    
    socket.emit('admin:muteSuccess', { message: `已禁言 ${target.nickname} ${minutes || 30}分钟` });
    console.log(`[禁言] ${admin.nickname} 禁言了 ${target.nickname} ${minutes || 30}分钟`);
  });

  // ===== 管理员解除禁言 =====
  socket.on('admin:unmuteUser', (data) => {
    const adminOdp = onlineSockets.get(socket.id);
    if (!adminOdp) return;
    
    const admin = registeredUsers[adminOdp];
    if (!hasPermission(admin, 'mute')) {
      return socket.emit('admin:error', { message: '无权限解除禁言' });
    }
    
    const { targetOdp } = data;
    delete bans.muted[targetOdp];
    saveJSON(bansFile, bans);
    
    const targetSocketId = userSockets.get(targetOdp);
    if (targetSocketId) {
      io.to(targetSocketId).emit('user:unmuted');
    }
    
    socket.emit('admin:unmuteSuccess', { message: '已解除禁言' });
  });

  // ===== 断开连接 =====
  socket.on('disconnect', () => {
    const odp = onlineSockets.get(socket.id);
    if (odp) {
      const user = registeredUsers[odp];
      if (user) {
        console.log(`[离线] ${user.nickname}`);
        socket.broadcast.emit('user:offline', { odp });
      }
      onlineSockets.delete(socket.id);
      userSockets.delete(odp);
    }
  });
});

// ===== 管理后台 =====
const adminApp = express();
const adminServer = http.createServer(adminApp);

adminApp.use(express.json());
adminApp.use(express.static(adminDir));

function localOnly(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const isLocal = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
  if (!isLocal) {
    return res.status(403).json({ error: '只允许本地访问' });
  }
  next();
}

adminApp.use(localOnly);

adminApp.get('/api/stats', (req, res) => {
  res.json({
    users: Object.keys(registeredUsers).length,
    online: userSockets.size,
    rooms: Object.keys(allRooms).length,
    messages: Object.values(allMessages).reduce((sum, msgs) => sum + msgs.length, 0),
    banned: Object.keys(bans.banned).length,
    muted: Object.keys(bans.muted).length
  });
});

adminApp.get('/api/users', (req, res) => {
  const users = Object.values(registeredUsers).map(u => ({
    odp: u.odp,
    username: u.username,
    nickname: u.nickname,
    role: u.role,
    roleInfo: getRoleInfo(u.role),
    createdAt: u.createdAt,
    online: userSockets.has(u.odp),
    banned: bans.banned[u.odp] || null,
    muted: bans.muted[u.odp] || null
  }));
  res.json(users);
});

adminApp.get('/api/messages', (req, res) => {
  const { chatId, limit = 100 } = req.query;
  if (chatId) {
    const messages = allMessages[chatId] || [];
    res.json(messages.slice(-parseInt(limit)));
  } else {
    const allChats = Object.entries(allMessages).map(([id, msgs]) => ({
      chatId: id,
      messageCount: msgs.length,
      lastMessage: msgs[msgs.length - 1]
    }));
    res.json(allChats);
  }
});

adminApp.get('/api/rooms', (req, res) => {
  res.json(Object.values(allRooms));
});

adminApp.post('/api/ban', (req, res) => {
  const { odp, reason, duration, permanent } = req.body;
  
  if (!odp || !registeredUsers[odp]) {
    return res.status(400).json({ error: '用户不存在' });
  }
  
  if (registeredUsers[odp].role === 'SUPER_ADMIN') {
    return res.status(403).json({ error: '无法封禁超级管理员' });
  }
  
  bans.banned[odp] = {
    reason: reason || '违反规定',
    permanent: !!permanent,
    until: permanent ? null : new Date(Date.now() + (duration || 86400000)).toISOString(),
    createdAt: new Date().toISOString()
  };
  saveJSON(bansFile, bans);
  
  const socketId = userSockets.get(odp);
  if (socketId) {
    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit('force:logout', { message: `您的账号已被封禁，原因: ${reason || '违反规定'}` });
      socket.disconnect();
    }
  }
  
  console.log(`[封禁] ${registeredUsers[odp].nickname} - ${reason || '违反规定'}`);
  res.json({ success: true });
});

adminApp.post('/api/unban', (req, res) => {
  const { odp } = req.body;
  delete bans.banned[odp];
  saveJSON(bansFile, bans);
  console.log(`[解封] ${registeredUsers[odp]?.nickname}`);
  res.json({ success: true });
});

adminApp.post('/api/mute', (req, res) => {
  const { odp, reason, duration, permanent } = req.body;
  
  if (!odp || !registeredUsers[odp]) {
    return res.status(400).json({ error: '用户不存在' });
  }
  
  if (registeredUsers[odp].role === 'SUPER_ADMIN') {
    return res.status(403).json({ error: '无法禁言超级管理员' });
  }
  
  bans.muted[odp] = {
    reason: reason || '违反规定',
    permanent: !!permanent,
    until: permanent ? null : new Date(Date.now() + (duration || 3600000)).toISOString(),
    createdAt: new Date().toISOString()
  };
  saveJSON(bansFile, bans);
  
  const socketId = userSockets.get(odp);
  if (socketId) {
    io.to(socketId).emit('user:muted', bans.muted[odp]);
  }
  
  console.log(`[禁言] ${registeredUsers[odp].nickname} - ${reason || '违反规定'}`);
  res.json({ success: true });
});

adminApp.post('/api/unmute', (req, res) => {
  const { odp } = req.body;
  delete bans.muted[odp];
  saveJSON(bansFile, bans);
  
  const socketId = userSockets.get(odp);
  if (socketId) {
    io.to(socketId).emit('user:unmuted');
  }
  
  console.log(`[解除禁言] ${registeredUsers[odp]?.nickname}`);
  res.json({ success: true });
});

adminApp.post('/api/setRole', (req, res) => {
  const { odp, role } = req.body;
  
  if (!odp || !registeredUsers[odp]) {
    return res.status(400).json({ error: '用户不存在' });
  }
  
  if (registeredUsers[odp].role === 'SUPER_ADMIN') {
    return res.status(403).json({ error: '无法修改超级管理员的角色' });
  }
  
  if (role === 'SUPER_ADMIN') {
    return res.status(403).json({ error: '无法设置为超级管理员' });
  }
  
  if (!ROLES[role] && !customRoles[role]) {
    return res.status(400).json({ error: '角色不存在' });
  }
  
  registeredUsers[odp].role = role;
  saveJSON(usersFile, registeredUsers);
  
  const socketId = userSockets.get(odp);
  if (socketId) {
    io.to(socketId).emit('user:roleChanged', {
      role: role,
      roleInfo: getRoleInfo(role)
    });
  }
  
  console.log(`[角色变更] ${registeredUsers[odp].nickname} -> ${role}`);
  res.json({ success: true });
});

// 修改用户密码
adminApp.post('/api/changePassword', (req, res) => {
  const { odp, newPassword } = req.body;
  
  if (!odp || !registeredUsers[odp]) {
    return res.status(400).json({ error: '用户不存在' });
  }
  
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: '密码长度至少6位' });
  }
  
  registeredUsers[odp].password = hashPassword(newPassword);
  saveJSON(usersFile, registeredUsers);
  
  // 强制用户重新登录
  const socketId = userSockets.get(odp);
  if (socketId) {
    io.to(socketId).emit('force:logout', { message: '您的密码已被管理员修改，请重新登录' });
  }
  
  console.log(`[密码修改] ${registeredUsers[odp].nickname} 的密码已被管理员修改`);
  res.json({ success: true, message: `已修改 ${registeredUsers[odp].nickname} 的密码` });
});

adminApp.get('/api/roles', (req, res) => {
  res.json({ builtIn: ROLES, custom: customRoles });
});

adminApp.post('/api/roles/create', (req, res) => {
  const { name, color, badge, level, permissions } = req.body;
  
  if (!name || ROLES[name] || customRoles[name]) {
    return res.status(400).json({ error: '角色名无效或已存在' });
  }
  
  customRoles[name] = {
    name,
    color: color || '#666666',
    badge: badge || '',
    level: level || 10,
    permissions: permissions || []
  };
  saveJSON(customRolesFile, customRoles);
  
  res.json({ success: true, role: customRoles[name] });
});

adminApp.delete('/api/roles/:name', (req, res) => {
  const { name } = req.params;
  
  if (ROLES[name]) {
    return res.status(400).json({ error: '无法删除内置角色' });
  }
  
  if (!customRoles[name]) {
    return res.status(404).json({ error: '角色不存在' });
  }
  
  Object.values(registeredUsers).forEach(user => {
    if (user.role === name) {
      user.role = 'USER';
    }
  });
  saveJSON(usersFile, registeredUsers);
  
  delete customRoles[name];
  saveJSON(customRolesFile, customRoles);
  
  res.json({ success: true });
});

// 删除用户
adminApp.delete('/api/users/:odp', (req, res) => {
  const { odp } = req.params;
  
  if (!registeredUsers[odp]) {
    return res.status(404).json({ error: '用户不存在' });
  }
  
  if (registeredUsers[odp].role === 'SUPER_ADMIN') {
    return res.status(403).json({ error: '无法删除超级管理员' });
  }
  
  // 踢出在线用户
  const socketId = userSockets.get(odp);
  if (socketId) {
    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit('force:logout', { message: '您的账号已被删除' });
      socket.disconnect();
    }
    userSockets.delete(odp);
  }
  
  const username = registeredUsers[odp].username;
  const nickname = registeredUsers[odp].nickname;
  
  // 删除用户数据
  delete registeredUsers[odp];
  saveJSON(usersFile, registeredUsers);
  
  // 删除好友关系
  delete friends[odp];
  Object.keys(friends).forEach(key => {
    friends[key] = (friends[key] || []).filter(f => f !== odp);
  });
  saveJSON(friendsFile, friends);
  
  // 删除好友请求
  delete friendRequests[odp];
  saveJSON(friendRequestsFile, friendRequests);
  
  // 删除封禁/禁言记录
  delete bans.banned[odp];
  delete bans.muted[odp];
  saveJSON(bansFile, bans);
  
  // 从群聊中移除
  Object.values(allRooms).forEach(room => {
    room.members = room.members.filter(m => m !== odp);
    room.admins = (room.admins || []).filter(a => a !== odp);
    // 如果是群主，转移给第一个成员或删除群
    if (room.owner === odp) {
      if (room.members.length > 0) {
        room.owner = room.members[0];
      } else {
        delete allRooms[room.id];
      }
    }
  });
  saveJSON(roomsFile, allRooms);
  
  console.log(`[删除用户] ${nickname} (${username})`);
  res.json({ success: true });
});

// ===== 启动服务器 =====
initSuperAdmin();

server.listen(PORT, '0.0.0.0', () => {
  const localIP = getLocalIP();
  console.log('\n========================================');
  console.log('🚀 聊天室服务器已启动!');
  console.log('========================================');
  console.log(`📍 本机管理员专属访问: http://localhost:${PORT}`);
  console.log(`📍 其他人局域网访问: http://${localIP}:${PORT}`);
  console.log('========================================');
  console.log(`📁 数据目录: ${dataDir}`);
  console.log(`👥 已注册用户: ${Object.keys(registeredUsers).length}`);
  console.log(`💬 群聊数量: ${Object.keys(allRooms).length}`);
  console.log('========================================\n');
});

adminServer.listen(ADMIN_PORT, '127.0.0.1', () => {
  console.log('========================================');
  console.log('🔐 管理后台已启动!');
  console.log('========================================');
  console.log(`📍 管理后台: http://127.0.0.1:${ADMIN_PORT}`);
  console.log('⚠️  只能通过 127.0.0.1 访问');
  console.log('========================================\n');
});
