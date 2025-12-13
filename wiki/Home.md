# Same-network Chatroom Wiki

Welcome to the Same-network Chatroom documentation! This is a full-featured LAN (Local Area Network) chatroom application that allows users on the same network to communicate in real-time.

## 📚 Table of Contents

- [Installation Guide](Installation.md) - How to set up and run the application
- [Features Overview](Features.md) - Complete list of features
- [Architecture](Architecture.md) - Technical architecture and design
- [User Guide](User-Guide.md) - How to use the chatroom as a user
- [Admin Guide](Admin-Guide.md) - Administration and moderation guide
- [API Documentation](API-Documentation.md) - Server API reference
- [Development Guide](Development.md) - For developers wanting to contribute

## 🚀 Quick Start

```bash
cd Chatroom_Github
unzip node_modules.zip
npm start
```

Then access:
- **Users**: `http://<server-ip>:3000`
- **Admin Panel**: `http://127.0.0.1:8001` (local only)

## 🌟 Key Features

- **Real-time Messaging** - Private chats and group rooms
- **Friend System** - Add friends, send friend requests
- **Rich Media** - Send images, videos, audio, and files
- **Moments** - Social media-style posts with likes and comments
- **Admin System** - Role-based permissions, user management
- **Games** - Built-in games to play with friends
- **Profanity Filter** - Automatic content moderation
- **User Profiles** - Avatars, nicknames, signatures

## 🛠️ Technology Stack

- **Backend**: Node.js, Express, Socket.IO
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Data Storage**: JSON file-based storage
- **Real-time Communication**: WebSocket (Socket.IO)

## 📝 Language Support

Currently supports **Chinese** only. English support is planned for future releases.

## 🔐 Security Features

- Password hashing (SHA-256)
- Ban and mute system
- Warning system with auto-mute
- Local-only SuperAdmin access
- Content filtering and profanity detection

## 📞 Default Accounts

**SuperAdmin Account** (local access only):
- Username: `SuperAdmin`
- Password: `SuperAdmin@2024`
- Access: `http://127.0.0.1:3000`

## 🤝 Contributing

This is an open-source project. Contributions are welcome! Please see the [Development Guide](Development.md) for more information.

## 📄 License

This project is licensed under the terms specified in the LICENSE file.

## 🐛 Support

If you encounter any issues or have questions, please open an issue on the GitHub repository.
