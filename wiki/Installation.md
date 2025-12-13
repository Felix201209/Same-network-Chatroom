# Installation Guide

This guide will help you set up and run the Same-network Chatroom on your local network.

## Prerequisites

- **Node.js**: Version 14.0 or higher
- **npm**: Usually comes with Node.js
- **Network**: All devices must be on the same local network (LAN)

## Step 1: Download or Clone

```bash
git clone https://github.com/Felixadjasidsa/Same-network-Chatroom.git
cd Same-network-Chatroom
```

## Step 2: Extract Node Modules

The project includes a pre-packaged `node_modules.zip` file to simplify installation.

```bash
cd Chatroom_Github
unzip node_modules.zip
```

If you prefer to install dependencies manually:

```bash
cd Chatroom_Github
npm install
```

## Step 3: Start the Server

```bash
npm start
```

Or directly:

```bash
node server/index.js
```

## Step 4: Access the Application

Once the server starts, you'll see output like this:

```
========================================
🚀 聊天室服务器已启动!
========================================
📍 本机管理员专属访问: http://localhost:3000
📍 其他人局域网访问: http://192.168.1.100:3000
========================================
📁 数据目录: /path/to/data
👥 已注册用户: 1
💬 群聊数量: 0
========================================

========================================
🔐 管理后台已启动!
========================================
📍 管理后台: http://127.0.0.1:8001
⚠️  只能通过 127.0.0.1 访问
========================================
```

### For the Server Host (Admin)

- **Main App**: `http://localhost:3000` or `http://127.0.0.1:3000`
- **Admin Panel**: `http://127.0.0.1:8001`

### For Other Users on the Network

Replace `192.168.1.100` with your actual server IP address:
- **Main App**: `http://192.168.1.100:3000`

## Finding Your IP Address

### Windows
```cmd
ipconfig
```
Look for "IPv4 Address" under your active network adapter.

### macOS/Linux
```bash
ifconfig
```
or
```bash
ip addr show
```

### From the Application
The login page displays the server IP address automatically for easy sharing with other users.

## Port Configuration

The application uses two ports:

- **Port 3000**: Main chatroom application (customizable via `PORT` environment variable)
- **Port 8001**: Admin panel (customizable by changing `ADMIN_PORT` in code)

### Changing the Default Port

```bash
PORT=8080 npm start
```

## Firewall Configuration

Ensure your firewall allows incoming connections on the configured ports:

### Windows Firewall
```cmd
netsh advfirewall firewall add rule name="Chatroom" dir=in action=allow protocol=TCP localport=3000
```

### Linux (ufw)
```bash
sudo ufw allow 3000/tcp
sudo ufw allow 8001/tcp
```

### macOS
System Preferences → Security & Privacy → Firewall → Firewall Options → Add application

## First-Time Setup

1. **Server starts automatically** with a SuperAdmin account
2. **SuperAdmin credentials**:
   - Username: `SuperAdmin`
   - Password: `SuperAdmin@2024`
   - Can only login from localhost (127.0.0.1)

3. **Other users** need to register their own accounts

## Data Storage

All data is stored in JSON files under the `Chatroom_Github/data/` directory:

- `users.json` - User accounts and profiles
- `messages.json` - Chat message history
- `rooms.json` - Group chat rooms
- `friends.json` - Friend relationships
- `friend_requests.json` - Pending friend requests
- `bans.json` - Banned and muted users
- `moments.json` - Social media posts
- `custom_roles.json` - Custom user roles
- `warnings.json` - User warnings
- `reports.json` - User reports
- `games.json` - Active game sessions

## Uploaded Files

Files uploaded by users are stored in:
- `Chatroom_Github/uploads/avatars/` - User avatars
- `Chatroom_Github/uploads/images/` - Image messages
- `Chatroom_Github/uploads/videos/` - Video messages
- `Chatroom_Github/uploads/voices/` - Voice messages
- `Chatroom_Github/uploads/files/` - Other files

## Troubleshooting

### Port Already in Use

If port 3000 or 8001 is already in use:

```bash
# Kill process on port 3000 (Unix/macOS)
lsof -ti:3000 | xargs kill -9

# Kill process on port 3000 (Windows)
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

Or use a different port:
```bash
PORT=8080 npm start
```

### Cannot Connect from Other Devices

1. Check that all devices are on the same network
2. Verify firewall settings
3. Ensure the server is listening on `0.0.0.0` (not just localhost)
4. Try accessing by IP instead of hostname

### Missing node_modules

If you see module errors:
```bash
cd Chatroom_Github
npm install
```

### Permission Errors (Linux/macOS)

If you get permission errors when running on ports below 1024:
```bash
sudo npm start
```

Or use a port number above 1024.

## Stopping the Server

Press `Ctrl+C` in the terminal where the server is running.

## Running as a Background Service

### Using PM2 (Recommended)

```bash
npm install -g pm2
cd Chatroom_Github
pm2 start server/index.js --name "chatroom"
pm2 save
pm2 startup
```

### Using screen (Unix/Linux)

```bash
screen -S chatroom
npm start
# Press Ctrl+A, then D to detach
# To reattach: screen -r chatroom
```

## Updating

To update to the latest version:

```bash
git pull origin main
cd Chatroom_Github
npm install  # If dependencies changed
npm start
```

**Note**: Your data files will be preserved during updates.

## Backup

To backup your data:

```bash
# Backup data directory
cp -r Chatroom_Github/data/ backup-data-$(date +%Y%m%d)/

# Backup uploads
cp -r Chatroom_Github/uploads/ backup-uploads-$(date +%Y%m%d)/
```

## System Requirements

### Minimum
- CPU: 1 GHz or faster
- RAM: 512 MB
- Disk: 100 MB for application + space for uploaded files
- Network: 100 Mbps LAN

### Recommended
- CPU: 2 GHz dual-core or faster
- RAM: 1 GB
- Disk: 1 GB for application + space for uploaded files
- Network: 1 Gbps LAN

## Next Steps

- Read the [User Guide](User-Guide.md) to learn how to use the chatroom
- Check the [Admin Guide](Admin-Guide.md) to learn about administration
- Explore the [Features](Features.md) documentation
