#!/bin/bash
# 快速清理端口脚本

echo "🔪 Killing processes on ports 3000 and 8001..."

# Kill node processes
pkill -f "node.*start.js" 2>/dev/null
pkill -f "node.*server/index.js" 2>/dev/null

# Kill processes on specific ports
lsof -ti:3000 | xargs kill -9 2>/dev/null
lsof -ti:8001 | xargs kill -9 2>/dev/null

sleep 1

# Check if ports are free
if lsof -ti:3000 >/dev/null 2>&1; then
    echo "❌ Port 3000 still in use"
else
    echo "✅ Port 3000 is free"
fi

if lsof -ti:8001 >/dev/null 2>&1; then
    echo "❌ Port 8001 still in use"
else
    echo "✅ Port 8001 is free"
fi

echo ""
echo "Ready to start! Run: npm start"
