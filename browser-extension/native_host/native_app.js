// 简单的Native Messaging测试应用
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('Native Messaging应用已启动');
console.log('等待来自Chrome扩展的消息...');

// 可能的项目路径列表（按优先级排序）
function getPossibleProjectRoots() {
    const possiblePaths = [];
    
    // 1. 当前目录的上级上级目录（默认路径）
    possiblePaths.push(path.join(__dirname, '..', '..'));
    
    // 2. 当前目录（脚本所在目录）
    possiblePaths.push(__dirname);
    
    // 3. 常见的工作目录
    const cwd = process.cwd();
    if (cwd !== __dirname) {
        possiblePaths.push(cwd);
    }
    
    // 4. 用户主目录下的常见位置
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
    
    // 5. Windows常见的代码目录
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
    
    // 6. macOS和Linux常见的代码目录
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
    
    // 7. 从环境变量获取可能的路径
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
    
    // 如果没有找到，使用默认路径
    const defaultPath = path.join(__dirname, '..', '..');
    console.log('! 未找到有效的项目目录，使用默认路径:', defaultPath);
    return defaultPath;
}

// 获取项目output文件夹路径
function getProjectOutputFolder() {
    const projectRoot = findProjectRoot();
    return path.join(projectRoot, 'output');
}

// 移动文件到项目output文件夹
function moveToProjectOutput(sourcePath, filename) {
    try {
        const projectOutputFolder = getProjectOutputFolder();
        
        // 确保项目output文件夹存在
        if (!fs.existsSync(projectOutputFolder)) {
            fs.mkdirSync(projectOutputFolder, { recursive: true });
        }
        
        const targetPath = path.join(projectOutputFolder, filename);
        
        // 检查目标文件是否已存在
        if (fs.existsSync(targetPath)) {
            console.log(`跳过已存在文件: ${filename}`);
            return false;
        }
        
        // 复制文件（跨设备移动需要先复制）
        fs.copyFileSync(sourcePath, targetPath);
        console.log(`复制文件到项目output: ${filename}`);
        
        // 删除源文件
        fs.unlinkSync(sourcePath);
        console.log(`删除源文件: ${filename}`);
        
        return true;
    } catch (error) {
        console.error(`移动文件失败: ${error.message}`);
        return false;
    }
}

// 导出文本到指定文件夹
function exportTextToFile(filename, content, outputFolder) {
    console.log('='.repeat(60));
    console.log('开始导出文本到文件');
    console.log('='.repeat(60));
    console.log('原始文件名:', filename);
    console.log('输出文件夹:', outputFolder);
    console.log('内容长度:', content.length, '字符');
    console.log('='.repeat(60));
    
    try {
        // 标准化路径
        const normalizedFolder = path.normalize(outputFolder);
        console.log('标准化后的文件夹路径:', normalizedFolder);
        
        // 验证文件名
        if (!filename || filename.trim() === '') {
            throw new Error('文件名不能为空');
        }
        
        // 清理文件名中的非法字符
        const sanitizedFilename = filename.replace(/[<>:"|?*]/g, '_');
        console.log('清理后的文件名:', sanitizedFilename);
        
        // 检查是否是相对路径output
        if (normalizedFolder === 'output' || normalizedFolder === '.\\output' || normalizedFolder === './output') {
            console.log('检测到相对路径output，直接保存到项目output文件夹');
            
            const projectOutputFolder = getProjectOutputFolder();
            console.log('项目output文件夹:', projectOutputFolder);
            
            // 确保项目output文件夹存在
            if (!fs.existsSync(projectOutputFolder)) {
                console.log('项目output文件夹不存在，创建中...');
                fs.mkdirSync(projectOutputFolder, { recursive: true });
                console.log('✓ 创建项目output文件夹成功');
            } else {
                console.log('✓ 项目output文件夹已存在');
            }
            
            const projectFilepath = path.join(projectOutputFolder, sanitizedFilename);
            console.log('目标文件路径:', projectFilepath);
            
            // 直接写入项目output文件夹
            console.log('写入文件中...');
            fs.writeFileSync(projectFilepath, content, 'utf8');
            console.log('✓ 文件写入成功');
            
            const fileSize = fs.statSync(projectFilepath).size;
            console.log(`文件大小: ${fileSize} 字节`);
            
            console.log('='.repeat(60));
            console.log('导出成功');
            console.log('='.repeat(60));
            
            return {
                success: true,
                filepath: projectFilepath,
                filename: sanitizedFilename,
                size: fileSize,
                timestamp: new Date().toISOString(),
                moved: true
            };
        }
        
        // 确保输出文件夹存在
        if (!fs.existsSync(normalizedFolder)) {
            console.log('输出文件夹不存在，创建中...');
            fs.mkdirSync(normalizedFolder, { recursive: true });
            console.log('✓ 创建输出文件夹成功');
        } else {
            console.log('✓ 输出文件夹已存在');
        }
        
        // 组合完整文件路径
        const filepath = path.join(normalizedFolder, sanitizedFilename);
        console.log('目标文件路径:', filepath);
        
        // 写入文件
        console.log('写入文件中...');
        fs.writeFileSync(filepath, content, 'utf8');
        console.log('✓ 文件写入成功');
        
        const fileSize = fs.statSync(filepath).size;
        console.log(`文件大小: ${fileSize} 字节`);
        
        console.log('='.repeat(60));
        console.log('导出成功');
        console.log('='.repeat(60));
        
        return {
            success: true,
            filepath: filepath,
            filename: sanitizedFilename,
            size: fileSize,
            timestamp: new Date().toISOString(),
            moved: false
        };
    } catch (error) {
        console.error('='.repeat(60));
        console.error('导出文件失败:');
        console.error('错误信息:', error.message);
        console.error('错误堆栈:', error.stack);
        console.error('='.repeat(60));
        
        return {
            success: false,
            error: error.message,
            filename: filename,
            outputFolder: outputFolder,
            timestamp: new Date().toISOString(),
            moved: false
        };
    }
}

// 处理Native消息
function handleNativeMessage(message) {
    console.log('收到消息:', JSON.stringify(message, null, 2));
    
    if (message.action === 'export_text_to_file') {
        const result = exportTextToFile(message.filename, message.content, message.outputFolder);
        return result;
    } else if (message.action === 'move_file_to_output') {
        const result = moveFileToOutput(message.sourcePath, message.filename);
        return result;
    } else if (message.action === 'execute_move_script') {
        const result = executeMoveScript();
        return result;
    } else if (message.action === 'ping' || message.action === 'test') {
        return {
            success: true,
            message: 'pong',
            timestamp: new Date().toISOString()
        };
    } else {
        return {
            success: false,
            error: '未知的消息类型',
            timestamp: new Date().toISOString()
        };
    }
}

// 执行移动脚本
function executeMoveScript() {
    try {
        console.log('='.repeat(60));
        console.log('开始执行移动脚本');
        console.log('='.repeat(60));
        
        const projectRoot = findProjectRoot();
        const projectOutputFolder = getProjectOutputFolder();
        const downloadsFolder = path.join(os.homedir(), 'Downloads');
        const downloadsOutputFolder = path.join(downloadsFolder, 'output');
        
        console.log('项目根目录:', projectRoot);
        console.log('项目output文件夹:', projectOutputFolder);
        console.log('浏览器下载根目录:', downloadsFolder);
        console.log('浏览器下载output文件夹:', downloadsOutputFolder);
        console.log('='.repeat(60));
        
        // 确保项目output文件夹存在
        if (!fs.existsSync(projectOutputFolder)) {
            console.log('项目output文件夹不存在，创建中...');
            fs.mkdirSync(projectOutputFolder, { recursive: true });
            console.log('✓ 创建项目output文件夹成功');
        } else {
            console.log('✓ 项目output文件夹已存在');
        }
        
        let movedCount = 0;
        let skippedCount = 0;
        let failedCount = 0;
        
        // 检查浏览器下载根目录
        if (fs.existsSync(downloadsFolder)) {
            console.log('✓ 浏览器下载文件夹存在，检查文件...');
            const files = fs.readdirSync(downloadsFolder);
            console.log(`✓ 找到 ${files.length} 个文件/文件夹在下载根目录`);
            
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
        } else {
            console.log('! 浏览器下载文件夹不存在，无需移动');
        }
        
        // 检查浏览器下载的output文件夹
        if (fs.existsSync(downloadsOutputFolder)) {
            console.log('\n检查浏览器下载的output文件夹...');
            const outputFiles = fs.readdirSync(downloadsOutputFolder);
            console.log(`找到 ${outputFiles.length} 个文件/文件夹在下载output文件夹`);
            
            outputFiles.forEach(file => {
                // 只处理以screen_reader开头的文件
                if (!file.startsWith('screen_reader_') || !file.endsWith('.txt')) {
                    skippedCount++;
                    return;
                }
                
                const sourcePath = path.join(downloadsOutputFolder, file);
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
            
            // 尝试删除空的output文件夹
            try {
                const remainingFiles = fs.readdirSync(downloadsOutputFolder);
                if (remainingFiles.length === 0) {
                    fs.rmdirSync(downloadsOutputFolder);
                    console.log('✓ 删除空的output文件夹');
                } else {
                    console.log(`output文件夹中还有 ${remainingFiles.length} 个文件/文件夹，不删除`);
                }
            } catch (e) {
                console.log('无法删除output文件夹:', e.message);
            }
        } else {
            console.log('! 浏览器下载output文件夹不存在，无需移动');
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('移动文件操作总结');
        console.log('='.repeat(60));
        console.log(`成功移动: ${movedCount} 个文件`);
        console.log(`跳过: ${skippedCount} 个文件/文件夹`);
        console.log(`失败: ${failedCount} 个文件`);
        console.log(`目标文件夹: ${projectOutputFolder}`);
        console.log('='.repeat(60));
        
        return {
            success: true,
            movedCount: movedCount,
            projectOutputFolder: projectOutputFolder,
            timestamp: new Date().toISOString()
        };
        
    } catch (error) {
        console.error('='.repeat(60));
        console.error('执行移动脚本失败:');
        console.error('错误信息:', error.message);
        console.error('错误堆栈:', error.stack);
        console.error('='.repeat(60));
        return {
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
}

// 移动文件到项目output文件夹
function moveFileToOutput(sourcePath, filename) {
    try {
        console.log(`移动文件: ${sourcePath} -> ${filename}`);
        
        const projectOutputFolder = getProjectOutputFolder();
        
        // 确保项目output文件夹存在
        if (!fs.existsSync(projectOutputFolder)) {
            fs.mkdirSync(projectOutputFolder, { recursive: true });
            console.log(`创建output文件夹: ${projectOutputFolder}`);
        }
        
        const targetPath = path.join(projectOutputFolder, filename);
        
        // 如果源文件存在，移动它
        if (fs.existsSync(sourcePath)) {
            // 如果目标文件已存在，先删除
            if (fs.existsSync(targetPath)) {
                fs.unlinkSync(targetPath);
                console.log(`删除已存在的目标文件: ${filename}`);
            }
            
            // 复制文件
            fs.copyFileSync(sourcePath, targetPath);
            console.log(`复制文件到: ${targetPath}`);
            
            // 删除源文件
            fs.unlinkSync(sourcePath);
            console.log(`删除源文件: ${sourcePath}`);
            
            const fileSize = fs.statSync(targetPath).size;
            
            return {
                success: true,
                filepath: targetPath,
                filename: filename,
                size: fileSize,
                timestamp: new Date().toISOString()
            };
        } else {
            // 源文件不存在，可能是路径问题，尝试查找
            console.log(`源文件不存在: ${sourcePath}`);
            
            // 尝试从文件名推断路径
            const downloadsPath = path.join(process.env.USERPROFILE || process.env.HOME, 'Downloads', 'output', filename);
            
            if (fs.existsSync(downloadsPath)) {
                // 如果目标文件已存在，先删除
                if (fs.existsSync(targetPath)) {
                    fs.unlinkSync(targetPath);
                }
                
                fs.copyFileSync(downloadsPath, targetPath);
                console.log(`从下载文件夹复制文件: ${downloadsPath} -> ${targetPath}`);
                
                fs.unlinkSync(downloadsPath);
                console.log(`删除下载文件夹中的源文件: ${downloadsPath}`);
                
                // 尝试删除空的output文件夹
                const outputDir = path.dirname(downloadsPath);
                try {
                    fs.rmdirSync(outputDir);
                    console.log(`删除空的output文件夹: ${outputDir}`);
                } catch (e) {
                    // 文件夹不为空或删除失败，忽略
                }
                
                const fileSize = fs.statSync(targetPath).size;
                
                return {
                    success: true,
                    filepath: targetPath,
                    filename: filename,
                    size: fileSize,
                    timestamp: new Date().toISOString()
                };
            }
            
            return {
                success: false,
                error: '源文件不存在',
                sourcePath: sourcePath,
                timestamp: new Date().toISOString()
            };
        }
    } catch (error) {
        console.error(`移动文件失败: ${error.message}`);
        return {
            success: false,
            error: error.message,
            sourcePath: sourcePath,
            filename: filename,
            timestamp: new Date().toISOString()
        };
    }
}

// 设置Native Messaging通信
let buffer = Buffer.alloc(0);
let expectedLength = 0;

process.stdin.on('readable', () => {
    try {
        let chunk;
        while ((chunk = process.stdin.read()) !== null) {
            buffer = Buffer.concat([buffer, chunk]);
            
            while (buffer.length >= 4) {
                if (expectedLength === 0) {
                    expectedLength = buffer.readUInt32LE(0);
                    buffer = buffer.slice(4);
                }
                
                if (buffer.length >= expectedLength) {
                    const messageData = buffer.slice(0, expectedLength);
                    buffer = buffer.slice(expectedLength);
                    
                    const messageStr = messageData.toString('utf8');
                    expectedLength = 0;
                    
                    try {
                        const message = JSON.parse(messageStr);
                        const response = handleNativeMessage(message);
                        const responseJson = JSON.stringify(response);
                        
                        const lengthBuffer = Buffer.alloc(4);
                        lengthBuffer.writeUInt32LE(Buffer.byteLength(responseJson, 'utf8'), 0);
                        
                        process.stdout.write(lengthBuffer);
                        process.stdout.write(responseJson);
                    } catch (parseError) {
                        const errorResponse = JSON.stringify({
                            success: false,
                            error: '无效的JSON格式',
                            timestamp: new Date().toISOString()
                        });
                        
                        const lengthBuffer = Buffer.alloc(4);
                        lengthBuffer.writeUInt32LE(Buffer.byteLength(errorResponse, 'utf8'), 0);
                        
                        process.stdout.write(lengthBuffer);
                        process.stdout.write(errorResponse);
                    }
                } else {
                    break;
                }
            }
        }
    } catch (error) {
        console.error('处理消息时出错:', error);
    }
});

process.stdin.on('error', (error) => {
    console.error('stdin错误:', error);
});

process.stdout.on('error', (error) => {
    console.error('stdout错误:', error);
});

process.on('SIGINT', () => {
    console.log('Native Messaging应用已停止');
    process.exit(0);
});