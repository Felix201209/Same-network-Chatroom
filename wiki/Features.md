# Features Overview

This document provides a comprehensive overview of all features available in the Same-network Chatroom application.

## 🔐 User Authentication

### Registration
- Create new user accounts with username and password
- Username validation (3-20 characters, alphanumeric and underscore only)
- Password requirements (minimum 6 characters, must contain at least one letter)
- Optional profile information:
  - Nickname (display name)
  - Avatar (profile picture)
  - Personal signature
- Profanity filter for usernames and nicknames

### Login
- Secure login with username and password
- Password hashing using SHA-256
- Session restoration on reconnect
- Auto-login for SuperAdmin on localhost
- Protection against duplicate logins (force logout from other devices)

### Password Management
- Change password from user settings
- Admin can reset user passwords via admin panel

## 💬 Messaging System

### Private Messages
- One-on-one chat with other users
- Real-time message delivery
- Message types supported:
  - **Text** - Plain text messages with emoji support
  - **Images** - Image files (JPEG, PNG, GIF, etc.)
  - **Videos** - Video files
  - **Audio/Voice** - Voice messages and audio files
  - **Files** - Any file type (up to 100MB)
- Message features:
  - Reply to specific messages
  - Emoji reactions on messages
  - "Typing" indicator
  - Message status (sent/delivered)
  - Timestamp on all messages

### Message Restrictions
- Non-friends can send one message and must wait for a reply
- Admins can message anyone without restrictions
- After first reply, conversation opens up fully
- Encourages adding friends for unrestricted communication

### Group Chats (Rooms)
- Create group chat rooms
- Custom room names and avatars
- Room features:
  - **Members** - Add/remove members
  - **Admins** - Group admins with moderation powers
  - **Owner** - Group creator with full control
  - **Announcements** - Post important messages
  - **Invite System** - Invite friends to join
  - **Settings** - Configure who can invite new members
  - **Leave/Disband** - Users can leave, owner can disband

### Content Moderation
- Automatic profanity filter
- Profanity detection in Chinese and English
- Inappropriate words are replaced with asterisks
- Filter applies to:
  - Messages (private and group)
  - Usernames and nicknames
  - Group names
  - Moments content

## 👥 Friend System

### Friend Requests
- Send friend requests to other users
- View pending friend requests
- Accept or reject requests
- Notification system for new requests

### Friend List
- View all friends with online/offline status
- Remove friends
- Friends can message each other freely

### Friend Benefits
- Unlimited messaging (no first-message restriction)
- See friends' moments and activity
- Quick access to friend chats

## 🎭 User Profiles

### Profile Information
- **Nickname** - Display name (editable)
- **Avatar** - Profile picture (upload custom image)
- **Signature** - Personal status message
- **Role Badge** - Shows user's role and rank

### Profile Customization
- Update profile from settings
- Upload custom avatar images
- Change personal signature anytime

## 📱 Moments (Social Feed)

### Post Moments
- Share text updates
- Attach multiple images
- Visible to all users
- Profanity filter applies

### Interact with Moments
- Like posts
- Comment on posts
- View who liked each post
- Timestamp on all posts

### Moment Management
- Delete your own posts
- Admins can delete any post
- System keeps the 100 most recent moments

## 🎮 Games

Built-in multiplayer games to play with friends:

### Available Games
1. **五子棋 (Gomoku)** - Five in a Row
2. **井字棋 (Tic-Tac-Toe)** - Classic tic-tac-toe
3. **猜数字 (Number Guessing)** - Guess the number game
4. **石头剪刀布 (Rock-Paper-Scissors)** - Quick match game

### Game Features
- Send game invitations
- Accept or decline invites
- Real-time gameplay
- Play while chatting

## 👑 Role & Permission System

### Built-in Roles

#### SuperAdmin (Level 100)
- **Badge**: 👑 超级管理员
- **Color**: Red (#FF0000)
- **Permissions**: All permissions
- **Special**: Can only login from localhost (127.0.0.1)
- **Restrictions**: Cannot be banned, muted, or have role changed

#### Admin (Level 80)
- **Badge**: ⭐ 管理员
- **Color**: Orange (#FF6B00)
- **Permissions**:
  - Ban users
  - Mute users
  - View all chats
  - Manage users
  - Manage rooms

#### Moderator (Level 50)
- **Badge**: 🛡️ 版主
- **Color**: Blue (#00A0FF)
- **Permissions**:
  - Mute users
  - View reports
  - Manage rooms

#### VIP (Level 20)
- **Badge**: 💎 VIP
- **Color**: Gold (#FFD700)
- **Permissions**: None (decorative role)

#### User (Level 0)
- **Badge**: None
- **Color**: Gray (#666666)
- **Permissions**: None (standard user)

### Custom Roles
- Admins can create custom roles via admin panel
- Configure custom:
  - Role name
  - Badge text and emoji
  - Color
  - Level (0-99)
  - Permissions

## 🛡️ Moderation Tools

### Warning System
- Admins can warn users for violations
- Users receive warnings with reason
- **Auto-mute**: 3 warnings = automatic 30-minute mute
- Warning counter resets after auto-mute

### Mute System
- Temporarily or permanently silence users
- Muted users cannot send messages
- Customizable mute duration
- Users see detailed mute information
- Automatic unmute when time expires

### Ban System
- Temporarily or permanently ban users
- Banned users cannot login
- Customizable ban duration
- Banned users see ban reason and duration
- Automatic unban when time expires

### Report System
- Users can report others for violations
- Report includes:
  - Target user
  - Reason
  - Optional message/chat context
- Admins receive notifications
- Admins can take action on reports

## 🔧 Admin Panel Features

### Statistics Dashboard
- Total users
- Online users count
- Total group rooms
- Total messages sent
- Banned users count
- Muted users count

### User Management
- View all registered users
- Search users by username or nickname
- See user status (online/offline/banned/muted)
- User actions:
  - Ban/Unban
  - Mute/Unmute
  - Change role
  - Reset password
  - Delete user account

### Message Monitoring
- View all chat conversations
- Browse message history
- Filter by chat/room

### Room Management
- View all group rooms
- See room members
- View room messages

### Role Management
- Create custom roles
- Set role permissions
- Delete custom roles
- View all role configurations

## 🎨 User Interface Features

### Design
- WeChat/WhatsApp-inspired modern interface
- Clean, intuitive layout
- Mobile-responsive design
- Dark theme aesthetic

### Navigation
- Bottom/side navigation bar
- Tabs for: Chats, Contacts, Discover, Profile
- Quick access to all features
- Badge notifications for new messages

### Chat Interface
- Message bubbles (sent/received)
- Sender avatars and names
- Timestamp display
- Role badges on messages
- Emoji picker
- File attachment options
- Voice recording
- Image/video preview

### Notifications
- New message alerts
- Friend request notifications
- System announcements
- Mute/ban notifications
- Game invitations

## 🔔 Poke Feature

- "Poke" friends to get their attention
- Sends a fun notification
- Creates a system message in chat
- Quick way to say "hello"

## 📤 File Uploads

### Supported Files
- **Images**: JPEG, PNG, GIF, WebP, etc.
- **Videos**: MP4, WebM, MOV, etc.
- **Audio**: MP3, WAV, OGG, etc.
- **Documents**: PDF, DOC, TXT, etc.
- **Other**: Any file type

### Upload Limits
- Maximum file size: 100 MB
- No limit on number of uploads
- Files stored permanently on server

### File Organization
- Avatar images in `/uploads/avatars/`
- Regular images in `/uploads/images/`
- Videos in `/uploads/videos/`
- Voice messages in `/uploads/voices/`
- Other files in `/uploads/files/`

## 🌐 Network Features

### Server Information
- Automatic IP detection
- Display server address on login page
- Support for IPv4
- Broadcasts on all network interfaces (0.0.0.0)

### Real-time Communication
- WebSocket-based (Socket.IO)
- Automatic reconnection
- Session restoration
- Low latency messaging

### Online Status
- Real-time online/offline tracking
- Online user list
- Presence indicators
- Status broadcasts to all users

## 🔒 Security Features

### Password Security
- SHA-256 password hashing
- Never store plain text passwords
- Secure password requirements

### Access Control
- Role-based permissions
- Level-based hierarchy (higher levels can moderate lower)
- Protected SuperAdmin account (local only)

### Content Security
- Profanity filtering
- Ban/mute system
- Warning system with auto-action
- Report system for user moderation

### Session Security
- Single-session enforcement (can't login from multiple devices)
- Force logout on new login
- Session restoration with validation

## 📊 Data Persistence

### Storage System
- JSON file-based storage
- Automatic saving on all changes
- No database setup required
- Human-readable data format

### Data Retention
- Unlimited message history
- Last 100 moments kept
- Permanent user accounts
- All uploaded files kept

## 🚀 Performance Features

### Optimization
- Socket.IO for efficient real-time communication
- File streaming for large uploads
- Lazy loading of message history
- Efficient data structures

### Scalability
- Supports multiple concurrent users
- Handles large file uploads (100MB)
- Efficient message broadcasting
- No practical user limit (limited by server resources)

## 🌍 Internationalization

### Current Support
- **Chinese (Simplified)**: Full support
- Interface, messages, and documentation in Chinese

### Future Plans
- English language support planned
- Multi-language interface system

## 💡 Additional Features

### Typing Indicators
- See when someone is typing
- Real-time updates
- Only in private chats

### Emoji Support
- Rich emoji picker
- Full emoji support in messages
- Emoji reactions on messages

### Message Reactions
- Add emoji reactions to any message
- Multiple users can react
- Remove your own reactions

### System Messages
- Automated notifications
- Room join/leave messages
- Friend system updates
- Game invitations

### Auto-features
- Auto-save all changes
- Auto-reconnect on disconnect
- Auto-restore session
- Auto-refresh online users

## 🔮 Future Enhancements

Based on the codebase structure, potential future features include:
- Video/voice calls
- Screen sharing
- More games
- File sharing with preview
- Message search
- User blocking
- Read receipts
- Message editing
- Message deletion
- Encrypted messages
- Mobile apps
- Desktop apps
