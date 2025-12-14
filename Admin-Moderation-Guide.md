# Admin & Moderation Guide

## Table of Contents
1. [Introduction](#introduction)
2. [Accessing the Admin Panel](#accessing-the-admin-panel)
3. [Admin Roles & Permissions](#admin-roles--permissions)
4. [User Management](#user-management)
5. [Moderation Features](#moderation-features)
6. [Chat Monitoring](#chat-monitoring)
7. [Role Management](#role-management)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)

---

## Introduction

The Same-network Chatroom includes a powerful admin panel for managing users, moderating content, and maintaining a safe environment. This guide covers all administrative and moderation features available to help you effectively manage your chatroom.

### What You Can Do as an Admin
- **User Management**: View, search, and manage all registered users
- **Moderation**: Ban users, mute users, issue warnings
- **Chat Monitoring**: View all chat messages and conversations
- **Role Assignment**: Assign roles to users with different permission levels
- **Statistics**: Monitor server health and user activity

---

## Accessing the Admin Panel

### Step 1: Start the Server
```bash
cd Chatroom_Github
npm start
```

The server will start on two ports:
- **Main Chatroom**: `http://your-ip:3000` (accessible to all users on the network)
- **Admin Panel**: `http://127.0.0.1:8001` (localhost only, for security)

### Step 2: Access the Admin Panel
1. Open your browser
2. Navigate to `http://127.0.0.1:8001` or `http://localhost:8001`
3. **Important**: The admin panel can ONLY be accessed from the server machine itself (localhost) for security reasons

### Default SuperAdmin Account
On first startup, a SuperAdmin account is automatically created:
- **Username**: `SuperAdmin`
- **Password**: `SuperAdmin@2024`

⚠️ **Security Note**: Change this password immediately after first login by logging into the main chatroom with these credentials, then ask another admin to change your password via the admin panel.

---

## Admin Roles & Permissions

The system has five built-in roles with different permission levels:

### 1. SuperAdmin (Level 100) 👑
**Badge**: 👑 超级管理员 (Super Administrator)  
**Color**: Red (#FF0000)  
**Permissions**: Full access to everything (`all` permissions)
- Cannot be banned or muted
- Cannot have their role changed
- Cannot be deleted
- Full control over all features

### 2. Admin (Level 80) ⭐
**Badge**: ⭐ 管理员 (Administrator)  
**Color**: Orange (#FF6B00)  
**Permissions**:
- `ban` - Ban and unban users
- `mute` - Mute and unmute users
- `view_chats` - View all chat messages
- `manage_users` - Manage user accounts
- `manage_rooms` - Manage group chats

### 3. Moderator (Level 50) 🛡️
**Badge**: 🛡️ 版主 (Moderator)  
**Color**: Blue (#00A0FF)  
**Permissions**:
- `mute` - Mute and unmute users
- `view_reports` - View user reports
- `manage_rooms` - Manage group chats

### 4. VIP (Level 20) 💎
**Badge**: 💎 VIP  
**Color**: Gold (#FFD700)  
**Permissions**: None (honorary role)

### 5. User (Level 0)
**Badge**: None  
**Color**: Gray (#666666)  
**Permissions**: None (regular user)

---

## User Management

### Viewing Users

1. Go to the **Admin Panel** at `http://localhost:8001`
2. Click on the **"用户管理" (User Management)** tab (active by default)
3. You'll see a table with all registered users showing:
   - Username
   - Nickname
   - Role (with color-coded badge)
   - Status (Online/Offline, Banned, Muted)
   - Registration date
   - Available actions

### Search Users
Use the search box at the top of the user list to filter users by username or nickname in real-time.

### User Actions

For each user (except SuperAdmin), you can:

#### 1. **Ban User** 🚫
Prevents user from logging in or accessing the chatroom.

**Steps**:
1. Click the **"封禁" (Ban)** button next to the user
2. Enter a ban reason (e.g., "Spamming", "Inappropriate content")
3. Select ban duration:
   - 1 hour
   - 1 day
   - 7 days
   - 30 days
   - Permanent
4. Click **"确认封禁" (Confirm Ban)**

**What happens**:
- User is immediately disconnected if online
- User cannot log back in until ban expires
- Ban reason is stored for reference

#### 2. **Unban User** ✅
Removes an existing ban.

**Steps**:
1. Find the banned user (they'll have a red "已封禁" badge)
2. Click the **"解封" (Unban)** button
3. User can immediately log in again

#### 3. **Mute User** 🔇
Prevents user from sending messages but allows them to stay online and read messages.

**Steps**:
1. Click the **"禁言" (Mute)** button next to the user
2. Enter a mute reason
3. Select mute duration:
   - 5 minutes
   - 30 minutes
   - 1 hour
   - 1 day
   - Permanent
4. Click **"确认禁言" (Confirm Mute)**

**What happens**:
- User receives a notification they've been muted
- User cannot send messages until mute expires
- User can still read messages and stay online

#### 4. **Unmute User** 🔊
Removes a mute and allows user to send messages again.

#### 5. **Set Role** 👤
Changes the user's role.

**Steps**:
1. Click the **"设置角色" (Set Role)** button
2. Select the desired role from the dropdown
3. Click **"确认" (Confirm)**

**Notes**:
- Cannot change SuperAdmin's role
- Cannot promote users to SuperAdmin (security)
- User receives notification of role change if online
- Role changes are immediate

#### 6. **Change Password** 🔑
Reset a user's password (useful if they forget it).

**Steps**:
1. Click the **🔑** button next to the user
2. Enter a new password (minimum 6 characters)
3. Confirm the password
4. Click **"确认修改" (Confirm Change)**

**What happens**:
- Password is immediately changed
- User is forcibly logged out
- User must log in with the new password

⚠️ **Warning**: User will be disconnected immediately and must use the new password.

#### 7. **Delete User** 🗑️
Permanently removes a user and all their data.

**Steps**:
1. Click the **🗑️** button next to the user
2. Confirm the deletion in the popup

**What happens**:
- User account is permanently deleted
- All friendships are removed
- User is removed from all group chats
- If user owns groups, ownership transfers to another member or group is deleted
- All bans/mutes/warnings for this user are deleted
- **This action CANNOT be undone**

⚠️ **Critical**: This permanently deletes all user data. Use with extreme caution.

---

## Moderation Features

### Automatic Profanity Filter

The system includes an automatic profanity filter that works in the background:

**How it works**:
- Detects profanity in Chinese and English
- Automatically replaces offensive words with asterisks (*)
- Works on all messages automatically
- No admin action required

**Profanity categories filtered**:
- Chinese swear words and insults
- English swear words and slurs
- Common variations and abbreviations

### Warning System

Admins can issue warnings to users for minor infractions through the chat interface. The warning system helps track user behavior and provides graduated moderation.

**How warnings work**:
- Admins can send warnings to users through the real-time chat connection
- Each warning is logged with the reason, admin who issued it, and timestamp
- Warnings are tracked per user in the system
- Warning history is stored in `/data/warnings.json`

**Automatic escalation**:
- 3+ warnings within a short period may trigger automatic temporary mute
- This provides a graduated response to repeated minor violations
- Admins can view a user's warning history when making moderation decisions

### Monitoring Active Users

**Dashboard Statistics** (top of admin panel):
- **总用户数** (Total Users): All registered accounts
- **在线用户** (Online Users): Currently connected users
- **群聊数量** (Total Rooms): Number of group chats
- **消息总数** (Total Messages): All messages sent
- **封禁用户** (Banned Users): Currently banned users
- **禁言用户** (Muted Users): Currently muted users

Click the **🔄 刷新 (Refresh)** button to update statistics.

---

## Chat Monitoring

### Viewing Messages

1. Click the **"消息记录" (Message History)** tab
2. The left panel shows all chat conversations:
   - Private chats (format: `user1_odp_user2_odp`)
   - Group chats (format: `room_roomId`)
3. Click a chat to view its messages on the right panel

**Message Details**:
- Sender name
- Message content (with profanity filtered)
- Timestamp

**Use cases**:
- Investigate user reports
- Review suspicious activity
- Moderate group chats
- Check compliance with rules

### Viewing Group Chats

1. Click the **"群聊管理" (Group Management)** tab
2. See all group chats with:
   - Group name
   - Owner
   - Member count
   - Creation date
3. Click **"查看消息" (View Messages)** to see group's chat history

---

## Role Management

### Creating Custom Roles

You can create custom roles beyond the built-in ones:

**Steps**:
1. Go to the **"角色管理" (Role Management)** tab
2. Click **"创建新角色" (Create New Role)**
3. Fill in the details:
   - **角色名称** (Role Name): Unique identifier (e.g., `VIP_PLUS`, `HELPER`)
   - **颜色** (Color): Choose a color for the role badge
   - **等级** (Level): 0-99 (determines hierarchy, cannot exceed 99)
   - **徽章显示** (Badge): Display text (e.g., "🌟 高级会员")
   - **权限** (Permissions): Check boxes for:
     - `ban` - Can ban users
     - `mute` - Can mute users
     - `view_chats` - Can view all chats
     - `manage_users` - Can manage users
     - `manage_rooms` - Can manage groups
4. Click **"创建" (Create)**

**Example Custom Roles**:
- **VIP_PLUS** (Level 25): Enhanced VIP with special badge
- **HELPER** (Level 30): Can mute users and manage rooms
- **TRIAL_MOD** (Level 40): Limited moderator permissions

### Deleting Custom Roles

1. Find the custom role in the role list
2. Click **"删除" (Delete)**
3. Confirm the deletion

**What happens**:
- Role is permanently deleted
- All users with this role are reset to "User" role
- Built-in roles (SuperAdmin, Admin, Moderator, VIP, User) cannot be deleted

---

## Best Practices

### Security

1. **Change Default Password**: Change SuperAdmin password immediately
2. **Limit Admin Accounts**: Only give Admin/SuperAdmin to trusted individuals
3. **Use Moderators**: For larger communities, use Moderator role for day-to-day moderation
4. **Regular Audits**: Periodically review user list and roles
5. **Secure the Server**: Only access admin panel from the server machine

### Moderation Guidelines

1. **Start with Warnings**: For first-time minor offenses
2. **Temporary Bans First**: Use time-limited bans before permanent ones
3. **Document Reasons**: Always provide clear reasons for bans/mutes
4. **Be Consistent**: Apply rules fairly to all users
5. **Graduated Response**:
   - 1st offense: Warning or short mute (5-30 minutes)
   - 2nd offense: Longer mute (1-24 hours) or short ban (1 day)
   - 3rd offense: Longer ban (7-30 days)
   - Serious offenses: Immediate ban or account deletion

### User Management

1. **Regular Monitoring**: Check dashboard statistics daily
2. **Review Messages**: Periodically check chat logs for issues
3. **Handle Reports Quickly**: Address user complaints promptly
4. **Backup Data**: The `/data` folder contains all user data - back it up regularly
5. **Group Management**: Monitor group chats for rule violations

### Role Assignment

1. **Use Hierarchy**: Assign roles based on trust level
2. **Trial Periods**: Use custom roles for trial moderators
3. **Clear Responsibilities**: Define what each role is expected to do
4. **Document Changes**: Keep a log of role changes (external to system)

---

## Troubleshooting

### Cannot Access Admin Panel

**Problem**: Admin panel at `http://localhost:8001` doesn't load

**Solutions**:
1. Verify server is running: Check console for "🔐 管理后台已启动!"
2. Check you're accessing from the server machine (not another device)
3. Try `http://127.0.0.1:8001` instead of `localhost`
4. Check if port 8001 is available (not used by another service)

### User Still Banned After Unban

**Problem**: User cannot log in after clicking unban

**Solutions**:
1. Refresh the admin panel and verify ban is removed
2. Check the user isn't also muted
3. Have user try logging in again (they may be using cached credentials)
4. Check `/data/bans.json` file to ensure ban was removed

### Role Changes Not Applying

**Problem**: User's role doesn't change

**Solutions**:
1. Refresh both admin panel and have user refresh their chat window
2. User may need to log out and log back in
3. Check console for errors
4. Verify the role exists (check Role Management tab)

### Messages Not Showing

**Problem**: Cannot view messages in admin panel

**Solutions**:
1. Verify messages exist (check Total Messages in dashboard)
2. Click on a specific chat in the left panel
3. Check `/data/messages.json` file exists and has content
4. Refresh the admin panel

### Cannot Delete User

**Problem**: Delete button doesn't work

**Solutions**:
1. Cannot delete SuperAdmin accounts (by design)
2. Refresh the page and try again
3. Check browser console for errors
4. Verify you have proper permissions

---

## Technical Details

### Data Storage

All data is stored in `/Chatroom_Github/data/`:
- `users.json` - User accounts
- `bans.json` - Ban and mute records
- `messages.json` - All chat messages
- `rooms.json` - Group chat information
- `custom_roles.json` - Custom created roles
- `friends.json` - Friend relationships
- `friend_requests.json` - Pending friend requests
- `warnings.json` - User warning history

### Admin API Endpoints

The admin panel uses these REST API endpoints (all require localhost access):

- `GET /api/stats` - Dashboard statistics
- `GET /api/users` - User list
- `GET /api/messages` - Chat messages
- `GET /api/rooms` - Group chats
- `GET /api/roles` - All roles
- `POST /api/ban` - Ban a user
- `POST /api/unban` - Unban a user
- `POST /api/mute` - Mute a user
- `POST /api/unmute` - Unmute a user
- `POST /api/setRole` - Change user role
- `POST /api/changePassword` - Reset user password
- `POST /api/roles/create` - Create custom role
- `DELETE /api/roles/:name` - Delete custom role
- `DELETE /api/users/:odp` - Delete user

### Ports

- **Port 3000**: Main chatroom (accessible on network)
- **Port 8001**: Admin panel (localhost only)

You can change these in `/server/index.js`:
```javascript
const PORT = process.env.PORT || 3000;
const ADMIN_PORT = 8001;
```

---

## Quick Reference Card

### Common Admin Tasks

| Task | Steps |
|------|-------|
| **Ban User** | User Management → Click "封禁" → Set reason & duration → Confirm |
| **Mute User** | User Management → Click "禁言" → Set reason & duration → Confirm |
| **Change Role** | User Management → Click "设置角色" → Select role → Confirm |
| **View Chat** | Message History → Click chat in left panel |
| **Create Role** | Role Management → "创建新角色" → Fill details → Create |
| **Reset Password** | User Management → Click 🔑 → Enter new password → Confirm |
| **Delete User** | User Management → Click 🗑️ → Confirm deletion |

### Keyboard Shortcuts

- `Ctrl + R` / `F5` - Refresh page
- `Ctrl + F` - Search users (when in search box)

### Admin URLs

- **Admin Panel**: `http://localhost:8001`
- **Main Chatroom**: `http://localhost:3000`

---

## Support & Contributing

For issues or feature requests:
- GitHub: [Felix201209/Same-network-Chatroom](https://github.com/Felix201209/Same-network-Chatroom)

---

**Last Updated**: 2025-12-14  
**Version**: 1.0 (BETA)

---

© 2025 Felix Yu Peng Zheng. Licensed under CC BY-NC-ND 4.0.
