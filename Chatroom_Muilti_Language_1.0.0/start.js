#!/usr/bin/env node
const readline = require('readline');
const { spawn } = require('child_process');
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('\n========================================');
console.log('🚀 Same-Network Chatroom v1.0.0');
console.log('========================================\n');
console.log('请选择语言 / Please select language:');
console.log('  1 - 中文 (Chinese)');
console.log('  2 - English');
console.log('========================================\n');

rl.question('请输入选项 / Enter option (1/2): ', (answer) => {
  const choice = answer.trim();
  let lang = 'zh';
  
  if (choice === '2' || choice.toLowerCase() === 'english' || choice.toLowerCase() === 'en') {
    lang = 'en';
  } else if (choice === '1' || choice.toLowerCase() === 'chinese' || choice.toLowerCase() === 'zh') {
    lang = 'zh';
  }
  
  console.log(`\n✅ 已选择: ${lang === 'zh' ? '中文' : 'English'}\n`);
  
  rl.close();
  
  // Start server with language parameter
  const serverProcess = spawn('node', ['server/index.js', `--lang=${lang}`], {
    cwd: __dirname,
    stdio: 'inherit',
    env: { ...process.env, SERVER_LANG: lang }
  });
  
  serverProcess.on('error', (err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
  
  serverProcess.on('exit', (code) => {
    process.exit(code);
  });
  
  // Handle termination signals
  process.on('SIGINT', () => {
    serverProcess.kill('SIGINT');
  });
  
  process.on('SIGTERM', () => {
    serverProcess.kill('SIGTERM');
  });
});
