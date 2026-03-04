const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = 8765;

// 可能的项目路径列表（按优先级排序）
function getPossibleProjectRoots() {
    const possiblePaths = [];
    
    // 1. 当前目录（脚本所在目录）
    possiblePaths.push(__dirname);
    
    // 2. 常见的工作目录
    const cwd = process.cwd();
    if (cwd !== __dirname) {
        possiblePaths.push(cwd);
    }
    
    // 3. 用户主目录下的常见位置
    const homeDir = os.homedir();
    const commonLocations = [
        'pala',
        'code/pala',
        'projects/pala',
        'Documents/pala',
        'Desktop/pala',
        'workspace/pala',
        'dev/pala'
    ];
    
    for (const location of commonLocations) {
        possiblePaths.push(path.join(homeDir, location));
    }
    
    // 4. Windows常见的代码目录
    if (process.platform === 'win32') {
        const winLocations = [
            'D:\\code\\pala',
            'D:\\projects\\pala',
            'D:\\workspace\\pala',
            'C:\\code\\pala',
            'C:\\projects\\pala',
            'C:\\workspace\\pala',
            'E:\\code\\pala',
            'E:\\projects\\pala',
        ];
        possiblePaths.push(...winLocations);
    }
    
    return possiblePaths;
}

// 查找有效的项目根目录
function findProjectRoot() {
    const possiblePaths = getPossibleProjectRoots();
    
    for (const testPath of possiblePaths) {
        // 检查是否是有效的项目目录（包含browser-extension文件夹或output文件夹）
        const hasBrowserExtension = fs.existsSync(path.join(testPath, 'browser-extension'));
        const hasOutputFolder = fs.existsSync(path.join(testPath, 'output'));
        const hasManifest = fs.existsSync(path.join(testPath, 'browser-extension', 'manifest.json'));
        
        if (hasBrowserExtension || hasOutputFolder || hasManifest) {
            console.log('✓ 找到有效的项目目录:', testPath);
            return testPath;
        }
    }
    
    // 如果没有找到，使用当前目录
    console.log('! 未找到有效的项目目录，使用当前目录:', __dirname);
    return __dirname;
}

// 获取项目根目录
const projectRoot = findProjectRoot();
const projectOutputFolder = path.join(projectRoot, 'output');

console.log('='.repeat(60));
console.log('文件移动服务器启动中...');
console.log('项目根目录:', projectRoot);
console.log('项目output文件夹:', projectOutputFolder);
console.log('='.repeat(60));

// 确保项目output文件夹存在
if (!fs.existsSync(projectOutputFolder)) {
    fs.mkdirSync(projectOutputFolder, { recursive: true });
    console.log('创建项目output文件夹:', projectOutputFolder);
}

// 移动文件函数
function moveFilesFromDownloads(customProjectRoot) {
    // 使用自定义项目路径或默认路径
    const targetProjectRoot = customProjectRoot || projectRoot;
    const targetOutputFolder = path.join(targetProjectRoot, 'output');
    
    const downloadsFolder = path.join(os.homedir(), 'Downloads');
    
    console.log('目标项目根目录:', targetProjectRoot);
    console.log('目标output文件夹:', targetOutputFolder);
    console.log('浏览器下载根目录:', downloadsFolder);
    
    try {
        // 确保目标output文件夹存在
        if (!fs.existsSync(targetOutputFolder)) {
            fs.mkdirSync(targetOutputFolder, { recursive: true });
            console.log('创建目标output文件夹:', targetOutputFolder);
        }
        
        // 检查下载文件夹是否存在
        if (!fs.existsSync(downloadsFolder)) {
            console.log('浏览器下载文件夹不存在，无需移动');
            return 0;
        }

        const files = fs.readdirSync(downloadsFolder);
        console.log(`找到 ${files.length} 个文件/文件夹在下载根目录`);

        let movedCount = 0;

        files.forEach(file => {
            // 只处理以screen_reader开头的文件
            if (!file.startsWith('screen_reader_') || !file.endsWith('.txt')) {
                return;
            }
            
            const sourcePath = path.join(downloadsFolder, file);
            const targetPath = path.join(targetOutputFolder, file);

            // 检查是否是文件
            try {
                const stats = fs.statSync(sourcePath);
                if (!stats.isFile()) {
                    console.log(`跳过非文件项: ${file}`);
                    return;
                }
            } catch (error) {
                console.log(`无法访问文件: ${file}`, error.message);
                return;
            }

            try {
                // 如果目标文件已存在，先删除
                if (fs.existsSync(targetPath)) {
                    fs.unlinkSync(targetPath);
                    console.log(`删除已存在的目标文件: ${file}`);
                }

                // 复制文件
                fs.copyFileSync(sourcePath, targetPath);
                console.log(`✓ 复制文件: ${file}`);

                // 删除源文件
                fs.unlinkSync(sourcePath);
                console.log(`✓ 删除源文件: ${file}`);

                movedCount++;
            } catch (error) {
                console.error(`✗ 移动文件失败 ${file}:`, error.message);
            }
        });

        console.log(`\n总结: 成功移动 ${movedCount} 个文件到 ${targetOutputFolder}`);
        return movedCount;

    } catch (error) {
        console.error('移动文件时出错:', error.message);
        return 0;
    }
}

// 创建HTTP服务器
const server = http.createServer((req, res) => {
    // 设置CORS头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    if (req.url === '/move' && req.method === 'POST') {
        console.log('\n' + '='.repeat(60));
        console.log('收到移动文件请求');
        console.log('='.repeat(60));
        
        // 读取请求体获取项目路径
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', () => {
            let customProjectRoot = null;
            
            try {
                if (body) {
                    const data = JSON.parse(body);
                    customProjectRoot = data.projectRoot;
                    console.log('收到自定义项目路径:', customProjectRoot);
                }
            } catch (e) {
                console.log('解析请求体失败，使用默认路径');
            }
            
            const movedCount = moveFilesFromDownloads(customProjectRoot);
            const targetOutputFolder = customProjectRoot ? 
                path.join(customProjectRoot, 'output') : projectOutputFolder;
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                movedCount: movedCount,
                projectOutputFolder: targetOutputFolder,
                timestamp: new Date().toISOString()
            }));
        });
        
        return;
    } else if (req.url === '/ping' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            message: 'pong',
            timestamp: new Date().toISOString()
        }));
    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: 'Not found'
        }));
    }
});

server.listen(PORT, () => {
    console.log('='.repeat(60));
    console.log(`文件移动服务器运行在 http://localhost:${PORT}`);
    console.log('可用端点:');
    console.log(`  GET  http://localhost:${PORT}/ping  - 检查服务器状态`);
    console.log(`  POST http://localhost:${PORT}/move  - 移动下载的文件`);
    console.log('='.repeat(60));
});

// 优雅关闭
process.on('SIGINT', () => {
    console.log('\n正在关闭服务器...');
    server.close(() => {
        console.log('服务器已关闭');
        process.exit(0);
    });
});
