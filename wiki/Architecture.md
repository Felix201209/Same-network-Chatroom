# Architecture Documentation

This document explains the technical architecture and design of the Same-network Chatroom application.

## Overview

The application follows a client-server architecture with real-time bidirectional communication using WebSockets.

```
┌─────────────────────────────────────────────────┐
│                   Clients                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ Browser  │  │ Browser  │  │ Browser  │      │
│  │  User 1  │  │  User 2  │  │  Admin   │      │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘      │
└───────┼─────────────┼─────────────┼─────────────┘
        │             │             │
        │    WebSocket (Socket.IO)  │
        │             │             │
┌───────▼─────────────▼─────────────▼─────────────┐
│              Server (Node.js)                    │
│  ┌──────────────────────────────────────────┐   │
│  │     Express HTTP Server (Port 3000)      │   │
│  └──────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────┐   │
│  │     Socket.IO WebSocket Server           │   │
│  └──────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────┐   │
│  │     Admin Panel Server (Port 8001)       │   │
│  └──────────────────────────────────────────┘   │
└──────────────────┬───────────────────────────────┘
                   │
┌──────────────────▼───────────────────────────────┐
│            Data Layer (File System)              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │  JSON    │  │  JSON    │  │ Uploaded │       │
│  │  Files   │  │  Files   │  │  Files   │       │
│  └──────────┘  └──────────┘  └──────────┘       │
└──────────────────────────────────────────────────┘
```

## Technology Stack

### Backend
- **Runtime**: Node.js
- **Web Framework**: Express.js
- **Real-time Communication**: Socket.IO
- **File Upload**: Multer
- **UUID Generation**: uuid
- **Cryptography**: crypto (built-in)

### Frontend
- **HTML5**: Semantic markup
- **CSS3**: Modern styling with Flexbox/Grid
- **JavaScript**: ES6+ (Vanilla JS, no frameworks)
- **Icons**: Font Awesome 6
- **Fonts**: Noto Sans SC (Google Fonts)

### Data Storage
- **Format**: JSON
- **Storage**: File system
- **Files**: Multiple JSON files for different data types

## Project Structure

```
Same-network-Chatroom/
├── Chatroom_Github/
│   ├── server/
│   │   ├── index.js          # Main server file
│   │   └── index.js.backup   # Backup
│   ├── public/               # Client application
│   │   ├── index.html        # Main HTML
│   │   ├── script.js         # Client JavaScript
│   │   └── style.css         # Client styles
│   ├── admin/                # Admin panel
│   │   └── index.html        # Admin interface (all-in-one)
│   ├── data/                 # JSON data files
│   │   ├── users.json
│   │   ├── messages.json
│   │   ├── rooms.json
│   │   ├── friends.json
│   │   ├── friend_requests.json
│   │   ├── bans.json
│   │   ├── moments.json
│   │   ├── custom_roles.json
│   │   ├── warnings.json
│   │   └── reports.json
│   ├── uploads/              # Uploaded files
│   │   ├── avatars/
│   │   ├── images/
│   │   ├── videos/
│   │   ├── voices/
│   │   └── files/
│   ├── package.json          # Dependencies
│   └── package-lock.json
├── README.md
└── LICENSE
```

## Server Architecture

### Main Server (server/index.js)

The server is organized into several logical sections:

#### 1. **Configuration & Setup**
```javascript
const PORT = 3000          // Main app port
const ADMIN_PORT = 8001    // Admin panel port
```

#### 2. **Role System**
Defines 5 built-in roles with hierarchical levels:
- SuperAdmin (100)
- Admin (80)
- Moderator (50)
- VIP (20)
- User (0)

Each role has:
- Name
- Level (for hierarchy)
- Color (for display)
- Badge (emoji + text)
- Permissions array

#### 3. **Profanity Filter**
- List of inappropriate words (Chinese & English)
- Detection function
- Filtering function (replaces with asterisks)

#### 4. **Data Management**
Functions for loading/saving JSON:
- `loadJSON(filePath, defaultValue)`
- `saveJSON(filePath, data)`

#### 5. **Helper Functions**
- `hashPassword()` - SHA-256 hashing
- `getChatId()` - Generate unique chat IDs
- `formatRemaining()` - Format time remaining
- `getLocalIP()` - Get server IP address
- `hasPermission()` - Check user permissions
- `checkBan()` / `checkMute()` - Check restrictions

#### 6. **Socket.IO Event Handlers**

**Authentication Events**:
- `user:register` - New user registration
- `user:login` - User login
- `session:restore` - Restore previous session

**Messaging Events**:
- `message:private` - Send private message
- `message:room` - Send room message
- `messages:get` - Get message history
- `message:react` - Add emoji reaction

**Friend System Events**:
- `friend:request` - Send friend request
- `friend:accept` - Accept request
- `friend:reject` - Reject request
- `friend:remove` - Remove friend
- `friends:get` - Get friend list

**Room Events**:
- `room:create` - Create room
- `room:join` - Join room
- `room:leave` - Leave room
- `room:kick` - Kick member
- `room:update` - Update room settings
- `room:invite` - Invite members

**User Events**:
- `user:typing` - Typing indicator
- `user:updateProfile` - Update profile
- `user:changePassword` - Change password
- `poke` - Poke another user

**Moments Events**:
- `moments:get` - Get moments feed
- `moments:post` - Post moment
- `moments:like` - Like moment
- `moments:comment` - Comment on moment
- `moments:delete` - Delete moment

**Game Events**:
- `game:invite` - Invite to game
- `game:accept` - Accept invitation
- `game:decline` - Decline invitation
- `game:move` - Make game move
- `game:leave` - Leave game

**Admin Events**:
- `admin:getReports` - Get reports
- `admin:handleReport` - Handle report
- `admin:warnUser` - Warn user
- `admin:muteUser` - Mute user
- `admin:unmuteUser` - Unmute user

**Connection Events**:
- `connect` - Client connected
- `disconnect` - Client disconnected

### Admin Server

Separate Express server on port 8001 with REST API:

**API Endpoints**:
- `GET /api/stats` - Server statistics
- `GET /api/users` - All users
- `GET /api/messages` - Message history
- `GET /api/rooms` - All rooms
- `GET /api/roles` - Role list
- `POST /api/ban` - Ban user
- `POST /api/unban` - Unban user
- `POST /api/mute` - Mute user
- `POST /api/unmute` - Unmute user
- `POST /api/setRole` - Change user role
- `POST /api/changePassword` - Reset password
- `POST /api/roles/create` - Create custom role
- `DELETE /api/roles/:name` - Delete custom role
- `DELETE /api/users/:odp` - Delete user

**Security**: Local access only (127.0.0.1)

## Client Architecture

### Main Application (public/)

#### HTML Structure (index.html)
```
<body>
  <!-- Login Page -->
  <div id="loginPage">
    <div id="loginForm">...</div>
    <div id="registerForm">...</div>
  </div>
  
  <!-- Main App -->
  <div id="mainApp">
    <nav class="main-nav">...</nav>      <!-- Navigation -->
    <div class="content">
      <div id="chatsTab">...</div>       <!-- Chats -->
      <div id="contactsTab">...</div>    <!-- Contacts -->
      <div id="discoverTab">...</div>    <!-- Discover -->
      <div id="profileTab">...</div>     <!-- Profile -->
    </div>
  </div>
</body>
```

#### JavaScript Organization (script.js)

**Global Variables**:
- `socket` - Socket.IO connection
- `currentUser` - Logged-in user data
- `currentChat` - Active chat
- `contacts` - User's contacts
- `rooms` - User's rooms
- `onlineUsers` - Online user list
- `chatMessages` - Message cache

**Core Functions**:

1. **Initialization**
   - `initSocket()` - Setup Socket.IO
   - `initEventListeners()` - Bind UI events
   - `initEmojiPanel()` - Setup emoji picker
   - `checkAutoLogin()` - Auto-login SuperAdmin

2. **Authentication**
   - `handleLogin()` - Process login
   - `handleRegister()` - Process registration
   - `handleLogout()` - Logout user

3. **UI Management**
   - `showMainApp()` - Display main interface
   - `showLoginPage()` - Display login
   - `switchTab()` - Navigate between tabs
   - `showChat()` - Open chat window

4. **Messaging**
   - `sendMessage()` - Send message
   - `displayMessage()` - Render message
   - `loadChatHistory()` - Load messages
   - `handleFileUpload()` - Upload files

5. **Friend System**
   - `sendFriendRequest()` - Send request
   - `acceptFriendRequest()` - Accept request
   - `rejectFriendRequest()` - Reject request
   - `removeFriend()` - Remove friend

6. **Room Management**
   - `createRoom()` - Create new room
   - `inviteToRoom()` - Invite members
   - `leaveRoom()` - Leave room
   - `updateRoomSettings()` - Change settings

7. **Profile**
   - `updateProfile()` - Update user info
   - `uploadAvatar()` - Change avatar
   - `changePassword()` - Change password

8. **Moments**
   - `postMoment()` - Create post
   - `likeMoment()` - Like post
   - `commentMoment()` - Add comment
   - `deleteMoment()` - Delete post

9. **Games**
   - `inviteToGame()` - Send game invite
   - `acceptGameInvite()` - Accept invite
   - `makeGameMove()` - Play move
   - `leaveGame()` - Quit game

### Admin Panel (admin/index.html)

Single-page application with all HTML, CSS, and JavaScript in one file.

**Features**:
- Statistics dashboard
- User management table
- Message browser
- Room management
- Role management
- Modal dialogs for actions

## Data Models

### User
```javascript
{
  odp: "uuid",              // Unique ID
  username: "string",       // Login name
  password: "hashed",       // SHA-256 hash
  nickname: "string",       // Display name
  avatar: "url",            // Avatar URL
  signature: "string",      // Status message
  role: "USER",             // Role key
  createdAt: "ISO date",    // Registration date
  friends: [],              // Friend ODP list
  groups: []                // Room ID list
}
```

### Message (Private)
```javascript
{
  id: "uuid",
  type: "text",             // text|image|video|audio|file
  content: "string",        // Message content or file URL
  senderId: "odp",
  senderName: "string",
  senderAvatar: "url",
  senderRole: "string",
  receiverId: "odp",
  timestamp: 1234567890,
  status: "sent",           // sent|delivered
  replyTo: "message-id",    // Reply reference
  reactions: {}             // Emoji reactions
}
```

### Message (Room)
```javascript
{
  id: "uuid",
  roomId: "uuid",
  roomName: "string",
  type: "text",
  content: "string",
  senderId: "odp",
  senderName: "string",
  senderAvatar: "url",
  senderRole: "string",
  timestamp: 1234567890,
  replyTo: "message-id",
  reactions: {}
}
```

### Room
```javascript
{
  id: "uuid",
  name: "string",
  owner: "odp",             // Owner ODP
  admins: [],               // Admin ODP array
  members: [],              // All member ODPs
  avatar: "url",            // Room avatar
  announcement: "string",   // Room announcement
  createdAt: "ISO date",
  settings: {
    allowInvite: true,      // Can members invite?
    muteAll: false          // All muted except admins
  }
}
```

### Friend Request
```javascript
{
  id: "uuid",
  from: "odp",
  to: "odp",
  status: "pending",        // pending|accepted|rejected
  createdAt: "ISO date"
}
```

### Moment
```javascript
{
  id: "uuid",
  odp: "odp",
  nickname: "string",
  avatar: "url",
  content: "string",
  images: [],               // Image URLs
  likes: [],                // ODP array
  comments: [               // Comment array
    {
      id: "uuid",
      odp: "odp",
      nickname: "string",
      content: "string",
      timestamp: 1234567890
    }
  ],
  timestamp: 1234567890
}
```

### Ban/Mute
```javascript
{
  banned: {
    "odp": {
      reason: "string",
      by: "admin-odp",
      permanent: false,
      until: "ISO date",
      createdAt: "ISO date"
    }
  },
  muted: {
    "odp": { /* same structure */ }
  }
}
```

### Report
```javascript
{
  id: "uuid",
  reporterOdp: "odp",
  reporterName: "string",
  targetOdp: "odp",
  targetName: "string",
  reason: "string",
  messageId: "uuid",        // Optional
  chatId: "string",         // Optional
  status: "pending",        // pending|handled|dismissed
  createdAt: 1234567890,
  handledBy: "odp",         // Admin who handled
  handledAt: 1234567890,
  action: "warn"            // warn|mute|ban
}
```

### Game
```javascript
{
  id: "uuid",
  type: "gomoku",           // Game type
  players: ["odp1", "odp2"],
  host: "odp",
  state: "playing",         // waiting|playing|finished
  targetNumber: 42,         // For guess game
  createdAt: 1234567890
}
```

## Communication Protocol

### Socket.IO Events Flow

#### Login Flow
```
Client                          Server
  |                               |
  |------- user:login ----------->|
  |                               |
  |<----- login:success ---------|  (or login:fail)
  |<----- users:list ------------|  (online users)
  |<----- rooms:list ------------|  (user's rooms)
  |<----- friend:requests -------|  (pending requests)
  |                               |
  |<----- user:online ----------->|  (broadcast to others)
```

#### Private Message Flow
```
Sender                          Server                       Receiver
  |                               |                               |
  |---- message:private --------->|                               |
  |                               |                               |
  |                               |---- check mute/restrictions ->|
  |                               |---- save to messages.json --->|
  |                               |                               |
  |<--- message:private ----------|                               |
  |                               |---- message:private --------->|
  |                               |                               |
```

#### Room Message Flow
```
User                            Server                       Room Members
  |                               |                               |
  |---- message:room ------------>|                               |
  |                               |                               |
  |                               |---- validate membership ----->|
  |                               |---- save message ------------>|
  |                               |                               |
  |<------------- message:room (broadcast to room) ------------->|
```

## Security Architecture

### Authentication
1. Password stored as SHA-256 hash
2. No plain text passwords
3. Session-based authentication (socket ID)
4. Auto-logout on disconnect

### Authorization
1. Role-based access control (RBAC)
2. Hierarchical permission levels
3. SuperAdmin protected (localhost only)
4. Permission checks before actions

### Content Moderation
1. Profanity filter on text input
2. Automatic content filtering
3. Warning → Auto-mute system
4. Admin review system

### Network Security
1. Admin panel: localhost only
2. CORS not required (same-origin)
3. No authentication tokens (WebSocket connection-based)

## Scalability Considerations

### Current Limitations
- File-based storage (not ideal for high concurrency)
- In-memory online user tracking
- No horizontal scaling support
- Single server instance

### Potential Improvements
1. **Database**: Replace JSON files with MongoDB/PostgreSQL
2. **Redis**: For session management and caching
3. **Load Balancer**: Distribute connections
4. **CDN**: For uploaded files
5. **Message Queue**: For asynchronous processing

## Performance Optimizations

### Current Optimizations
1. **Lazy Loading**: Messages loaded on demand
2. **Moment Limit**: Only keep 100 recent moments
3. **File Streaming**: Large files streamed, not buffered
4. **Efficient Broadcasting**: Socket.IO rooms for targeted messages

### Monitoring
- Console logging for all major events
- User activity tracking
- Online user count
- Message statistics

## Error Handling

### Server-Side
```javascript
try {
  // Operation
} catch (e) {
  console.error('Error:', e);
  socket.emit('error', { message: 'Operation failed' });
}
```

### Client-Side
```javascript
socket.on('error', (data) => {
  showNotification(data.message, 'error');
});
```

### Validation
- Input validation on client and server
- Permission checks before actions
- Ban/mute checks before messaging
- File size limits enforced

## Development Workflow

### Code Organization
- Server logic in `server/index.js` (single file, ~2300 lines)
- Client logic in `public/script.js` (single file)
- Styles in `public/style.css`
- Admin in `admin/index.html` (all-in-one)

### No Build Process
- No transpilation needed
- No bundling required
- Direct file serving
- Simple deployment

### Dependencies
Minimal and stable:
- express (web server)
- socket.io (WebSocket)
- multer (file upload)
- uuid (ID generation)

## Testing Strategy

### Manual Testing
- Currently relies on manual testing
- No automated test suite

### Recommended Tests
1. **Unit Tests**: Helper functions
2. **Integration Tests**: Socket events
3. **E2E Tests**: User flows
4. **Load Tests**: Concurrent users

## Deployment Architecture

### Development
```
npm start → Node.js → Listens on 0.0.0.0:3000
```

### Production (Recommended)
```
PM2 → Node.js → Nginx Reverse Proxy → Internet
```

### With Process Manager
```bash
pm2 start server/index.js
pm2 save
pm2 startup
```

### With Docker (Future)
```dockerfile
FROM node:18
WORKDIR /app
COPY . .
RUN npm install
EXPOSE 3000 8001
CMD ["npm", "start"]
```

## Future Architecture Plans

1. **Microservices**: Separate services for auth, messaging, files
2. **Database**: Move to proper database
3. **API Gateway**: RESTful API + WebSocket
4. **Caching Layer**: Redis for performance
5. **File Storage**: S3-compatible storage
6. **Monitoring**: Application monitoring tools
7. **Logging**: Centralized logging system
