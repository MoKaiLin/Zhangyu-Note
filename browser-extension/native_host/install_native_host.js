#!/usr/bin/env node

/**
 * Native Messaging 安装脚本
 * 用于在不同操作系统上自动配置 Native Messaging 主机
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('='.repeat(60));
console.log('Native Messaging 安装脚本');
console.log('='.repeat(60));

// 获取当前目录
const currentDir = __dirname;
console.log('当前目录:', currentDir);

// 获取本机应用路径
const nativeAppPath = path.join(currentDir, 'native_app.js');
const startBatPath = path.join(currentDir, 'start.bat');
const startShPath = path.join(currentDir, 'start.sh');

console.log('Native App 路径:', nativeAppPath);
console.log('启动脚本路径:', startBatPath);

// 检查文件是否存在
if (!fs.existsSync(nativeAppPath)) {
    console.error('错误: native_app.js 文件不存在');
    process.exit(1);
}

// 创建启动脚本（如果不存在）
if (!fs.existsSync(startBatPath) && os.platform() === 'win32') {
    const batContent = '@echo off\ncd /d "%~dp0"\necho [%date% %time%] Native Host started >> native_host.log\necho Current directory: %cd% >> native_host.log\nnode native_app.js 2>> native_host.log';
    fs.writeFileSync(startBatPath, batContent);
    console.log('创建 Windows 启动脚本:', startBatPath);
}

if (!fs.existsSync(startShPath) && (os.platform() === 'darwin' || os.platform() === 'linux')) {
    const shContent = '#!/bin/bash\ncd "$(dirname "$0")"\necho "[$(date)] Native Host started" >> native_host.log\necho "Current directory: $(pwd)" >> native_host.log\nnode native_app.js 2>> native_host.log';
    fs.writeFileSync(startShPath, shContent);
    // 设置执行权限
    fs.chmodSync(startShPath, '755');
    console.log('创建 Unix 启动脚本:', startShPath);
}

// 确定启动脚本路径
let launcherPath;
if (os.platform() === 'win32') {
    launcherPath = startBatPath;
} else {
    launcherPath = startShPath;
}

console.log('使用的启动脚本:', launcherPath);

// 创建配置文件内容
const configContent = {
    "name": "com.textextractor.native",
    "description": "网页文字提取器本地应用",
    "path": launcherPath,
    "type": "stdio",
    "allowed_origins": [
        "chrome-extension://*"
    ]
};

// 确定配置文件保存位置
let configDir;
let configFileName = 'com.textextractor.native.json';

if (os.platform() === 'win32') {
    // Windows 配置位置
    configDir = path.join(process.env.APPDATA, 'Google', 'Chrome', 'NativeMessagingHosts');
} else if (os.platform() === 'darwin') {
    // macOS 配置位置
    configDir = path.join(os.homedir(), 'Library', 'Application Support', 'Google', 'Chrome', 'NativeMessagingHosts');
} else {
    // Linux 配置位置
    configDir = path.join(os.homedir(), '.config', 'google-chrome', 'NativeMessagingHosts');
}

const configPath = path.join(configDir, configFileName);
console.log('配置文件保存位置:', configPath);

// 确保配置目录存在
if (!fs.existsSync(configDir)) {
    try {
        fs.mkdirSync(configDir, { recursive: true });
        console.log('创建配置目录:', configDir);
    } catch (error) {
        console.error('创建配置目录失败:', error.message);
        process.exit(1);
    }
}

// 写入配置文件
try {
    fs.writeFileSync(configPath, JSON.stringify(configContent, null, 2));
    console.log('✓ 配置文件写入成功:', configPath);
} catch (error) {
    console.error('写入配置文件失败:', error.message);
    process.exit(1);
}

console.log('\n' + '='.repeat(60));
console.log('安装完成!');
console.log('='.repeat(60));
console.log('Native Messaging 主机已成功配置');
console.log('\n使用说明:');
console.log('1. 启动 native_app.js: node native_app.js');
console.log('2. 或使用启动脚本:');
console.log('   - Windows: 双击 start.bat');
console.log('   - macOS/Linux: 运行 ./start.sh');
console.log('\n现在您的扩展应该可以与本地应用通信了');
console.log('='.repeat(60));
