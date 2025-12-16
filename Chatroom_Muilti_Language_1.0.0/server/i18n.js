// Server-side internationalization for console messages
const messages = {
  zh: {
    // Server startup
    'server.starting': '🚀 聊天室服务器启动中...',
    'server.started': '🚀 聊天室服务器已启动！',
    'server.localAccess': '📍 本机管理员访问',
    'server.lanAccess': '📍 局域网访问',
    'server.dataDir': '📁 数据目录',
    'server.registeredUsers': '👥 注册用户',
    'server.groupChats': '💬 群聊',
    'server.adminPanel': '🔐 管理面板已启动！',
    'server.adminPanelUrl': '📍 管理面板',
    'server.adminRestriction': '⚠️  仅可通过 127.0.0.1 访问',
    
    // User actions
    'user.register': '注册',
    'user.login': '登录',
    'user.logout': '登出',
    'user.sessionRecovered': '会话恢复',
    'user.online': '上线',
    'user.offline': '离线',
    
    // Messages
    'message.private': '私聊',
    'message.room': '群聊',
    'message.offlineQueue': '离线队列',
    'message.queuedFor': '消息已为',
    'message.queued': '排队',
    'message.sending': '发送',
    
    // Admin actions
    'admin.ban': '封禁',
    'admin.unban': '解封',
    'admin.mute': '禁言',
    'admin.unmute': '解除禁言',
    'admin.roleChange': '角色变更',
    'admin.passwordChange': '密码变更',
    'admin.passwordChanged': '密码已由管理员修改',
    
    // Security
    'security.dedup': '去重',
    'security.duplicateMessage': '检测到重复消息',
    'security.rateLimitWarning': '限流警告',
    'security.autoMuted': '自动禁言',
    
    // Friends
    'friend.request': '好友请求',
    'friend.accept': '接受好友',
    'friend.reject': '拒绝好友',
    'friend.remove': '删除好友',
    
    // Rooms
    'room.create': '创建群聊',
    'room.join': '加入群聊',
    'room.leave': '离开群聊',
    'room.disband': '解散群聊',
    'room.kick': '踢出成员',
    
    // Offline messages
    'offline.sending': '离线消息',
    'offline.sendingCount': '向',
    'offline.messages': '发送',
    'offline.queuedMessages': '条排队消息'
  },
  
  en: {
    // Server startup
    'server.starting': '🚀 Starting chatroom server...',
    'server.started': '🚀 Chatroom server started!',
    'server.localAccess': '📍 Local admin access',
    'server.lanAccess': '📍 LAN access',
    'server.dataDir': '📁 Data directory',
    'server.registeredUsers': '👥 Registered users',
    'server.groupChats': '💬 Group chats',
    'server.adminPanel': '🔐 Admin panel started!',
    'server.adminPanelUrl': '📍 Admin panel',
    'server.adminRestriction': '⚠️  Can only access via 127.0.0.1',
    
    // User actions
    'user.register': 'Register',
    'user.login': 'Login',
    'user.logout': 'Logout',
    'user.sessionRecovered': 'Session Recovered',
    'user.online': 'Online',
    'user.offline': 'Offline',
    
    // Messages
    'message.private': 'Private',
    'message.room': 'Group',
    'message.offlineQueue': 'Offline Queue',
    'message.queuedFor': 'Message queued for',
    'message.queued': 'queued',
    'message.sending': 'sending',
    
    // Admin actions
    'admin.ban': 'Ban',
    'admin.unban': 'Unban',
    'admin.mute': 'Mute',
    'admin.unmute': 'Unmute',
    'admin.roleChange': 'Role Change',
    'admin.passwordChange': 'Password Change',
    'admin.passwordChanged': 'password has been changed by admin',
    
    // Security
    'security.dedup': 'Dedup',
    'security.duplicateMessage': 'Duplicate message detected',
    'security.rateLimitWarning': 'Rate limit warning',
    'security.autoMuted': 'Auto-muted',
    
    // Friends
    'friend.request': 'Friend Request',
    'friend.accept': 'Accept Friend',
    'friend.reject': 'Reject Friend',
    'friend.remove': 'Remove Friend',
    
    // Rooms
    'room.create': 'Create Room',
    'room.join': 'Join Room',
    'room.leave': 'Leave Room',
    'room.disband': 'Disband Room',
    'room.kick': 'Kick Member',
    
    // Offline messages
    'offline.sending': 'Offline Messages',
    'offline.sendingCount': 'Sending',
    'offline.messages': 'queued messages to',
    'offline.queuedMessages': 'queued messages'
  }
};

class I18n {
  constructor(lang = 'zh') {
    this.lang = lang;
  }
  
  setLang(lang) {
    this.lang = lang;
  }
  
  getLang() {
    return this.lang;
  }
  
  t(key, defaultValue = '') {
    return messages[this.lang]?.[key] || messages['zh']?.[key] || defaultValue || key;
  }
  
  // Helper method for formatted console logs
  log(key, ...args) {
    console.log(`[${this.t(key)}]`, ...args);
  }
}

// Detect language from command line arguments or environment
function detectLang() {
  const args = process.argv.slice(2);
  const langArg = args.find(arg => arg.startsWith('--lang='));
  
  if (langArg) {
    return langArg.split('=')[1];
  }
  
  return process.env.SERVER_LANG || 'zh';
}

module.exports = { I18n, detectLang };
