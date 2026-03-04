const fs = require('fs');
const path = require('path');
const os = require('os');

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
console.log('项目根目录:', projectRoot);
console.log('项目output文件夹:', projectOutputFolder);
console.log('='.repeat(60));

// 确保项目output文件夹存在
if (!fs.existsSync(projectOutputFolder)) {
    fs.mkdirSync(projectOutputFolder, { recursive: true });
    console.log('创建项目output文件夹:', projectOutputFolder);
}

// 获取浏览器默认下载路径
const downloadsFolder = path.join(os.homedir(), 'Downloads');

console.log('浏览器下载路径:', downloadsFolder);

// 移动文件函数
function moveFilesFromDownloads() {
    try {
        // 检查下载文件夹是否存在
        if (!fs.existsSync(downloadsFolder)) {
            console.log('浏览器下载文件夹不存在，无需移动');
            return;
        }

        const files = fs.readdirSync(downloadsFolder);
        console.log(`找到 ${files.length} 个文件在下载根目录`);

        let movedCount = 0;

        files.forEach(file => {
            // 只处理以screen_reader开头的文件
            if (!file.startsWith('screen_reader_') || !file.endsWith('.txt')) {
                return;
            }
            
            const sourcePath = path.join(downloadsFolder, file);
            const targetPath = path.join(projectOutputFolder, file);

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

        console.log(`\n总结: 成功移动 ${movedCount} 个文件到 ${projectOutputFolder}`);

    } catch (error) {
        console.error('移动文件时出错:', error.message);
    }
}

// 执行移动
moveFilesFromDownloads();

// 如果作为模块被调用，导出函数
module.exports = { moveFilesFromDownloads };
