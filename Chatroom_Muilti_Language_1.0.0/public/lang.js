// Frontend internationalization
const translations = {
  zh: {
    // Navigation
    'nav.contacts': '联系人',
    'nav.chatList': '聊天',
    'nav.moments': '朋友圈',
    'nav.profile': '我的',
    
    // Login/Register
    'login.title': '登录',
    'login.username': '用户名',
    'login.password': '密码',
    'login.button': '登录',
    'login.register': '注册新账号',
    'register.title': '注册',
    'register.nickname': '昵称',
    'register.confirmPassword': '确认密码',
    'register.button': '注册',
    'register.backToLogin': '返回登录',
    
    // Chat
    'chat.inputPlaceholder': '输入消息...',
    'chat.send': '发送',
    'chat.selectChat': '选择一个聊天开始对话',
    'chat.privateChat': '私聊',
    'chat.groupChat': '群聊',
    'chat.typing': '正在输入...',
    'chat.online': '在线',
    'chat.offline': '离线',
    
    // Messages
    'message.text': '文本',
    'message.image': '图片',
    'message.file': '文件',
    'message.voice': '语音',
    'message.reply': '回复',
    'message.delete': '删除',
    'message.copy': '复制',
    
    // Friends
    'friend.add': '添加好友',
    'friend.request': '好友请求',
    'friend.accept': '接受',
    'friend.reject': '拒绝',
    'friend.remove': '删除好友',
    'friend.search': '搜索好友',
    
    // Group
    'group.create': '创建群聊',
    'group.name': '群名称',
    'group.members': '成员',
    'group.invite': '邀请',
    'group.leave': '退出群聊',
    'group.disband': '解散群聊',
    'group.announcement': '群公告',
    
    // Profile
    'profile.edit': '编辑资料',
    'profile.avatar': '头像',
    'profile.nickname': '昵称',
    'profile.signature': '个性签名',
    'profile.changePassword': '修改密码',
    'profile.logout': '退出登录',
    
    // Notifications
    'notif.newMessage': '新消息',
    'notif.friendRequest': '好友请求',
    'notif.groupInvite': '群聊邀请',
    'notif.offlineMessages': '条离线消息',
    'notif.connected': '已连接',
    'notif.disconnected': '已断开',
    'notif.connecting': '连接中...',
    
    // Buttons
    'btn.confirm': '确认',
    'btn.cancel': '取消',
    'btn.save': '保存',
    'btn.delete': '删除',
    'btn.edit': '编辑',
    'btn.send': '发送',
    'btn.close': '关闭',
    
    // File upload
    'file.selectImage': '选择图片',
    'file.selectFile': '选择文件',
    'file.recording': '录音中...',
    'file.uploading': '上传中...',
    'file.uploadSuccess': '上传成功',
    'file.uploadFailed': '上传失败',
    
    // Errors
    'error.networkError': '网络错误',
    'error.loginFailed': '登录失败',
    'error.registerFailed': '注册失败',
    'error.messageFailed': '发送失败',
    'error.required': '此项必填',
    
    // Status
    'status.sending': '发送中',
    'status.sent': '已发送',
    'status.delivered': '已送达',
    'status.queued': '已排队',
    'status.read': '已读'
  },
  
  en: {
    // Navigation
    'nav.contacts': 'Contacts',
    'nav.chatList': 'Chats',
    'nav.moments': 'Moments',
    'nav.profile': 'Me',
    
    // Login/Register
    'login.title': 'Login',
    'login.username': 'Username',
    'login.password': 'Password',
    'login.button': 'Login',
    'login.register': 'Register',
    'register.title': 'Register',
    'register.nickname': 'Nickname',
    'register.confirmPassword': 'Confirm Password',
    'register.button': 'Register',
    'register.backToLogin': 'Back to Login',
    
    // Chat
    'chat.inputPlaceholder': 'Type a message...',
    'chat.send': 'Send',
    'chat.selectChat': 'Select a chat to start messaging',
    'chat.privateChat': 'Private Chat',
    'chat.groupChat': 'Group Chat',
    'chat.typing': 'typing...',
    'chat.online': 'Online',
    'chat.offline': 'Offline',
    
    // Messages
    'message.text': 'Text',
    'message.image': 'Image',
    'message.file': 'File',
    'message.voice': 'Voice',
    'message.reply': 'Reply',
    'message.delete': 'Delete',
    'message.copy': 'Copy',
    
    // Friends
    'friend.add': 'Add Friend',
    'friend.request': 'Friend Request',
    'friend.accept': 'Accept',
    'friend.reject': 'Reject',
    'friend.remove': 'Remove Friend',
    'friend.search': 'Search Friends',
    
    // Group
    'group.create': 'Create Group',
    'group.name': 'Group Name',
    'group.members': 'Members',
    'group.invite': 'Invite',
    'group.leave': 'Leave Group',
    'group.disband': 'Disband Group',
    'group.announcement': 'Announcement',
    
    // Profile
    'profile.edit': 'Edit Profile',
    'profile.avatar': 'Avatar',
    'profile.nickname': 'Nickname',
    'profile.signature': 'Signature',
    'profile.changePassword': 'Change Password',
    'profile.logout': 'Logout',
    
    // Notifications
    'notif.newMessage': 'New Message',
    'notif.friendRequest': 'Friend Request',
    'notif.groupInvite': 'Group Invite',
    'notif.offlineMessages': 'offline messages',
    'notif.connected': 'Connected',
    'notif.disconnected': 'Disconnected',
    'notif.connecting': 'Connecting...',
    
    // Buttons
    'btn.confirm': 'Confirm',
    'btn.cancel': 'Cancel',
    'btn.save': 'Save',
    'btn.delete': 'Delete',
    'btn.edit': 'Edit',
    'btn.send': 'Send',
    'btn.close': 'Close',
    
    // File upload
    'file.selectImage': 'Select Image',
    'file.selectFile': 'Select File',
    'file.recording': 'Recording...',
    'file.uploading': 'Uploading...',
    'file.uploadSuccess': 'Upload Success',
    'file.uploadFailed': 'Upload Failed',
    
    // Errors
    'error.networkError': 'Network Error',
    'error.loginFailed': 'Login Failed',
    'error.registerFailed': 'Register Failed',
    'error.messageFailed': 'Send Failed',
    'error.required': 'Required',
    
    // Status
    'status.sending': 'Sending',
    'status.sent': 'Sent',
    'status.delivered': 'Delivered',
    'status.queued': 'Queued',
    'status.read': 'Read'
  }
};

class I18nClient {
  constructor() {
    // Try to load saved language preference, default to Chinese
    this.currentLang = localStorage.getItem('app_language') || 'zh';
    this.listeners = [];
  }
  
  setLang(lang) {
    if (lang !== 'zh' && lang !== 'en') {
      console.warn(`Unsupported language: ${lang}, fallback to zh`);
      lang = 'zh';
    }
    this.currentLang = lang;
    localStorage.setItem('app_language', lang);
    
    // Notify all listeners
    this.listeners.forEach(callback => callback(lang));
    
    // Update document lang attribute
    document.documentElement.lang = lang;
  }
  
  getLang() {
    return this.currentLang;
  }
  
  t(key, defaultValue = '') {
    return translations[this.currentLang]?.[key] || translations['zh']?.[key] || defaultValue || key;
  }
  
  // Register a callback to be notified when language changes
  onLangChange(callback) {
    this.listeners.push(callback);
  }
  
  // Update all elements with data-i18n attribute
  updateDOM() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const text = this.t(key);
      
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        if (el.getAttribute('placeholder')) {
          el.setAttribute('placeholder', text);
        } else {
          el.value = text;
        }
      } else {
        el.textContent = text;
      }
    });
    
    // Update placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      el.setAttribute('placeholder', this.t(key));
    });
    
    // Update titles/tooltips
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      el.setAttribute('title', this.t(key));
    });
  }
}

// Global instance
const i18n = new I18nClient();

// Auto-update DOM when language changes
i18n.onLangChange(() => {
  i18n.updateDOM();
});

// Initialize DOM on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => i18n.updateDOM());
} else {
  i18n.updateDOM();
}
