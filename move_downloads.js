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
        'dev/pala',
        'Downloads/pala',
        'OneDrive/pala',
        'OneDrive/Documents/pala',
        'OneDrive/Desktop/pala',
        'Dropbox/pala',
        'Google Drive/pala',
        'gdrive/pala'
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
            'D:\\dev\\pala',
            'C:\\code\\pala',
            'C:\\projects\\pala',
            'C:\\workspace\\pala',
            'C:\\dev\\pala',
            'E:\\code\\pala',
            'E:\\projects\\pala',
            'E:\\workspace\\pala',
            'E:\\dev\\pala',
            'F:\\code\\pala',
            'F:\\projects\\pala',
            'F:\\workspace\\pala',
            'F:\\dev\\pala'
        ];
        possiblePaths.push(...winLocations);
    }
    
    // 5. macOS和Linux常见的代码目录
    if (process.platform === 'darwin' || process.platform === 'linux') {
        const unixLocations = [
            '/Users/' + path.basename(homeDir) + '/pala',
            '/Users/' + path.basename(homeDir) + '/code/pala',
            '/Users/' + path.basename(homeDir) + '/projects/pala',
            '/home/' + path.basename(homeDir) + '/pala',
            '/home/' + path.basename(homeDir) + '/code/pala',
            '/home/' + path.basename(homeDir) + '/projects/pala',
            '/opt/pala',
            '/usr/local/pala'
        ];
        possiblePaths.push(...unixLocations);
    }
    
    // 6. 从环境变量获取可能的路径
    if (process.env.PALA_HOME) {
        possiblePaths.push(process.env.PALA_HOME);
    }
    if (process.env.PROJECT_HOME) {
        possiblePaths.push(path.join(process.env.PROJECT_HOME, 'pala'));
    }
    if (process.env.WORKSPACE) {
        possiblePaths.push(path.join(process.env.WORKSPACE, 'pala'));
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
    console.log('='.repeat(60));
    console.log('开始移动文件操作');
    console.log('='.repeat(60));
    console.log('项目根目录:', projectRoot);
    console.log('项目output文件夹:', projectOutputFolder);
    console.log('浏览器下载路径:', downloadsFolder);
    console.log('='.repeat(60));
    
    try {
        // 检查下载文件夹是否存在
        if (!fs.existsSync(downloadsFolder)) {
            console.log('! 浏览器下载文件夹不存在，无需移动');
            return;
        }
        console.log('✓ 浏览器下载文件夹存在:', downloadsFolder);

        const files = fs.readdirSync(downloadsFolder);
        console.log(`✓ 找到 ${files.length} 个文件在下载根目录`);

        let movedCount = 0;
        let skippedCount = 0;
        let failedCount = 0;

        files.forEach(file => {
            // 只处理以screen_reader开头的文件
            if (!file.startsWith('screen_reader_') || !file.endsWith('.txt')) {
                skippedCount++;
                return;
            }
            
            const sourcePath = path.join(downloadsFolder, file);
            const targetPath = path.join(projectOutputFolder, file);

            // 检查是否是文件
            try {
                const stats = fs.statSync(sourcePath);
                if (!stats.isFile()) {
                    console.log(`! 跳过非文件项: ${file}`);
                    skippedCount++;
                    return;
                }
                console.log(`\n处理文件: ${file}`);
                console.log(`源路径: ${sourcePath}`);
                console.log(`目标路径: ${targetPath}`);
            } catch (error) {
                console.error(`✗ 无法访问文件: ${file}`, error.message);
                failedCount++;
                return;
            }

            try {
                // 如果目标文件已存在，先删除
                if (fs.existsSync(targetPath)) {
                    console.log(`! 目标文件已存在，删除中...`);
                    fs.unlinkSync(targetPath);
                    console.log(`✓ 删除已存在的目标文件: ${file}`);
                }

                // 复制文件
                console.log('复制文件中...');
                fs.copyFileSync(sourcePath, targetPath);
                console.log(`✓ 复制文件: ${file}`);

                // 删除源文件
                console.log('删除源文件中...');
                fs.unlinkSync(sourcePath);
                console.log(`✓ 删除源文件: ${file}`);

                movedCount++;
                console.log(`✓ 文件移动成功`);
            } catch (error) {
                console.error(`✗ 移动文件失败 ${file}:`, error.message);
                failedCount++;
            }
        });

        console.log('\n' + '='.repeat(60));
        console.log('移动文件操作总结');
        console.log('='.repeat(60));
        console.log(`成功移动: ${movedCount} 个文件`);
        console.log(`跳过: ${skippedCount} 个文件/文件夹`);
        console.log(`失败: ${failedCount} 个文件`);
        console.log(`目标文件夹: ${projectOutputFolder}`);
        console.log('='.repeat(60));

    } catch (error) {
        console.error('='.repeat(60));
        console.error('移动文件时出错:');
        console.error('错误信息:', error.message);
        console.error('错误堆栈:', error.stack);
        console.error('='.repeat(60));
    }
}

// 执行移动
moveFilesFromDownloads();

// 如果作为模块被调用，导出函数
module.exports = { moveFilesFromDownloads };
