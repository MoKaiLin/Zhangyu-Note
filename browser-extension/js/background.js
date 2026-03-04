chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.sendMessage(tab.id, { action: 'start_extraction' });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'save_text' || message.action === 'export_content') {
    console.log('='.repeat(60));
    console.log('收到保存文件消息');
    console.log('消息类型:', message.action);
    
    const text = message.text || message.data?.content || '';
    const filename = message.filename || message.data?.filename || 'output';
    
    console.log('文件名:', filename);
    console.log('文本长度:', text.length);
    console.log('扩展ID:', message.extensionId);
    console.log('='.repeat(60));
    
    // 首先尝试使用Native Messaging保存到output文件夹
    saveViaNativeMessaging(text, filename)
      .then((result) => {
        console.log('='.repeat(60));
        console.log('✓ Native Messaging保存成功');
        console.log('✓ 保存位置:', result.filepath);
        console.log('='.repeat(60));
        sendResponse({ success: true, filepath: result.filepath });
      })
      .catch((error) => {
        console.error('='.repeat(60));
        console.error('✗ Native Messaging失败:', error);
        console.error('='.repeat(60));
        
        // 如果Native Messaging失败，使用备用方法
        console.log('尝试使用备用方法保存文件...');
        saveViaDownloadsAPI(text, filename)
          .then((result) => {
            console.log('='.repeat(60));
            console.log('✓ 备用方法保存成功');
            console.log('✓ 保存位置:', result.filepath);
            console.log('='.repeat(60));
            sendResponse({ success: true, filepath: result.filepath });
          })
          .catch((fallbackError) => {
            console.error('='.repeat(60));
            console.error('✗ 备用方法也失败:', fallbackError);
            console.error('='.repeat(60));
            sendResponse({ 
              success: false, 
              error: '文件保存失败: ' + error.message
            });
          });
      });
    return true; // 保持消息通道开启以支持异步响应
  }
});

// 方法1: 使用Native Messaging保存到output文件夹（最优方法）
function saveViaNativeMessaging(text, filename) {
  return new Promise((resolve, reject) => {
    try {
      console.log('使用Native Messaging保存文件...');
      
      // 构建output文件夹路径（相对路径）
      const outputFolder = 'output';
      console.log('输出文件夹:', outputFolder);

      // 发送消息到Native Host
      chrome.runtime.sendNativeMessage(
        'com.textextractor.native',
        {
          action: 'export_text_to_file',
          filename: `${filename}.txt`,
          content: text,
          outputFolder: outputFolder
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error('Native Messaging错误:', chrome.runtime.lastError);
            reject(new Error('Native Messaging失败: ' + chrome.runtime.lastError.message));
          } else if (response && response.success) {
            console.log('Native Messaging成功:', response);
            resolve(response);
          } else {
            console.error('Native Host返回错误:', response?.error);
            reject(new Error(response?.error || '保存文件失败'));
          }
        }
      );
    } catch (error) {
      console.error('Native Messaging保存时出错:', error);
      reject(error);
    }
  });
}

// 方法2: 使用chrome.downloads API保存（备用方法）
function saveViaDownloadsAPI(text, filename) {
  return new Promise((resolve, reject) => {
    try {
      console.log('使用chrome.downloads API保存文件...');
      
      // 生成文件名
      const finalFilename = `${filename}.txt`;
      console.log('文件名:', finalFilename);

      // 使用data URL保存文件（service worker中不能使用URL.createObjectURL）
      const dataUrl = 'data:text/plain;charset=utf-8,' + encodeURIComponent(text);
      console.log('生成data URL成功');
      
      // 使用简单的文件名，不包含目录路径
      const relativePath = finalFilename;
      console.log('文件名:', relativePath);
      
      // 使用chrome.downloads API，不显示保存对话框
      chrome.downloads.download({
        url: dataUrl,
        filename: relativePath,
        saveAs: false,  // 自动保存，不显示对话框
        conflictAction: 'overwrite'  // 覆盖已存在的文件
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          console.error('下载API调用失败:', chrome.runtime.lastError);
          reject(new Error('浏览器下载失败: ' + chrome.runtime.lastError.message));
          return;
        }
        
        console.log('下载请求已提交，ID:', downloadId);
        
        // 监控下载完成
        const onDownloadComplete = (delta) => {
          if (delta.id === downloadId) {
            if (delta.state && delta.state.current === 'complete') {
              chrome.downloads.onChanged.removeListener(onDownloadComplete);
              console.log('下载完成');
              
              // 获取下载的完整路径
              chrome.downloads.search({ id: downloadId }, (items) => {
                if (items && items.length > 0) {
                  const filepath = items[0].filename;
                  console.log('实际保存路径:', filepath);
                  
                  // 延迟一点时间确保文件写入完成，然后执行移动脚本
                  setTimeout(async () => {
                    console.log('='.repeat(60));
                    console.log('开始尝试移动文件...');
                    console.log('='.repeat(60));
                    
                    let moved = false;
                    let moveError = null;
                    
                    // 方法1: 尝试通过HTTP服务器移动文件
                    try {
                      const result = await moveFilesViaHttpServer();
                      console.log('✓ HTTP服务器移动成功');
                      moved = true;
                    } catch (httpError) {
                      console.log('✗ HTTP服务器移动失败:', httpError.message);
                      
                      // 方法2: 尝试通过Native Messaging移动文件
                      try {
                        const result = await executeMoveScript();
                        console.log('✓ Native Messaging移动成功');
                        moved = true;
                      } catch (nativeError) {
                        console.log('✗ Native Messaging移动失败:', nativeError.message);
                        moveError = nativeError;
                      }
                    }
                    
                    if (moved) {
                      // 返回项目output文件夹的路径
                      const projectOutputPath = 'D:\\code\\pala\\output\\' + finalFilename;
                      console.log('='.repeat(60));
                      console.log('✓ 文件移动成功');
                      console.log('✓ 目标路径:', projectOutputPath);
                      console.log('='.repeat(60));
                      resolve({ filepath: projectOutputPath, moved: true });
                    } else {
                      console.warn('='.repeat(60));
                      console.warn('✗ 所有自动移动方法都失败');
                      console.warn('✗ 文件保留在:', filepath);
                      console.warn('✗ 请手动运行: node move_downloads.js');
                      console.warn('✗ 或启动HTTP服务器: node file_mover_server.js');
                      console.warn('='.repeat(60));
                      resolve({ filepath, moved: false, error: moveError?.message });
                    }
                  }, 1500); // 延迟1.5秒确保文件写入完成
                } else {
                  resolve({ filepath: relativePath });
                }
              });
            } else if (delta.error) {
              chrome.downloads.onChanged.removeListener(onDownloadComplete);
              console.error('下载出错:', delta.error.current);
              reject(new Error('下载失败: ' + delta.error.current));
            }
          }
        };
        
        chrome.downloads.onChanged.addListener(onDownloadComplete);
        
        // 超时处理
        setTimeout(() => {
          chrome.downloads.onChanged.removeListener(onDownloadComplete);
          console.error('下载超时');
          reject(new Error('下载超时'));
        }, 30000);
      });
    } catch (error) {
      console.error('下载过程中发生错误:', error);
      reject(new Error('下载失败: ' + error.message));
    }
  });
}

// 移动文件到正确的output文件夹
function moveFileToOutputFolder(sourcePath, filename) {
  return new Promise((resolve, reject) => {
    try {
      console.log('='.repeat(60));
      console.log('尝试移动文件到output文件夹...');
      console.log('源路径:', sourcePath);
      console.log('文件名:', filename);
      console.log('='.repeat(60));
      
      // 首先检查Native Host是否可用
      console.log('检查Native Host是否可用...');
      chrome.runtime.sendNativeMessage(
        'com.textextractor.native',
        { action: 'ping' },
        (pingResponse) => {
          if (chrome.runtime.lastError) {
            console.error('Native Host不可用:', chrome.runtime.lastError.message);
            console.log('尝试直接通过downloads API获取下载路径...');
            
            // Native Host不可用，尝试手动移动
            tryManualMove(sourcePath, filename)
              .then(resolve)
              .catch(reject);
            return;
          }
          
          console.log('Native Host可用，发送移动文件请求...');
          
          // 使用Native Messaging请求移动文件
          chrome.runtime.sendNativeMessage(
            'com.textextractor.native',
            {
              action: 'move_file_to_output',
              sourcePath: sourcePath,
              filename: filename
            },
            (response) => {
              if (chrome.runtime.lastError) {
                console.error('Native Messaging移动文件错误:', chrome.runtime.lastError);
                console.log('尝试手动移动文件...');
                tryManualMove(sourcePath, filename)
                  .then(resolve)
                  .catch(reject);
              } else if (response && response.success) {
                console.log('='.repeat(60));
                console.log('✓ Native Messaging移动文件成功');
                console.log('✓ 新路径:', response.filepath);
                console.log('='.repeat(60));
                resolve(response.filepath);
              } else {
                console.error('Native Host返回错误:', response?.error);
                console.log('尝试手动移动文件...');
                tryManualMove(sourcePath, filename)
                  .then(resolve)
                  .catch(reject);
              }
            }
          );
        }
      );
    } catch (error) {
      console.error('移动文件时出错:', error);
      tryManualMove(sourcePath, filename)
        .then(resolve)
        .catch(reject);
    }
  });
}

// 手动移动文件的备用方案
function tryManualMove(sourcePath, filename) {
  return new Promise((resolve, reject) => {
    console.log('='.repeat(60));
    console.log('手动移动文件...');
    console.log('源路径:', sourcePath);
    console.log('='.repeat(60));
    
    // 由于service worker无法直接访问文件系统
    // 我们只能返回源路径，让用户知道文件位置
    console.log('Service Worker无法直接访问文件系统');
    console.log('文件保存在:', sourcePath);
    console.log('请手动运行: node move_downloads.js');
    
    // 尝试通过打开下载文件夹来提示用户
    chrome.downloads.showDefaultFolder();
    
    resolve(sourcePath);
  });
}

// 通过Native Host执行移动脚本
function executeMoveScript() {
  return new Promise((resolve, reject) => {
    console.log('='.repeat(60));
    console.log('尝试通过Native Host执行移动脚本...');
    console.log('='.repeat(60));
    
    chrome.runtime.sendNativeMessage(
      'com.textextractor.native',
      {
        action: 'execute_move_script'
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error('执行移动脚本失败:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else if (response && response.success) {
          console.log('='.repeat(60));
          console.log('✓ 移动脚本执行成功');
          console.log('✓ 移动文件数:', response.movedCount);
          console.log('='.repeat(60));
          resolve(response);
        } else {
          console.error('移动脚本返回错误:', response?.error);
          reject(new Error(response?.error || '执行移动脚本失败'));
        }
      }
    );
  });
}

// 通过HTTP服务器移动文件（备用方案）
async function moveFilesViaHttpServer() {
  console.log('='.repeat(60));
  console.log('尝试通过HTTP服务器移动文件...');
  console.log('='.repeat(60));
  
  try {
    // 首先检查服务器是否运行
    const pingResponse = await fetch('http://localhost:8765/ping', {
      method: 'GET',
      signal: AbortSignal.timeout(2000)
    });
    
    if (!pingResponse.ok) {
      throw new Error('HTTP服务器未响应');
    }
    
    console.log('HTTP服务器可用，发送移动请求...');
    
    // 获取扩展的安装路径
    const extensionUrl = chrome.runtime.getURL('');
    console.log('扩展URL:', extensionUrl);
    
    // 从扩展URL提取项目路径
    // 扩展URL格式: chrome-extension://<id>/
    // 我们需要找到实际的文件系统路径
    // 由于Service Worker无法直接访问文件系统，我们使用相对路径
    
    // 发送移动文件请求，不包含项目路径（让服务器使用默认路径）
    const moveResponse = await fetch('http://localhost:8765/move', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(10000)
    });
    
    if (!moveResponse.ok) {
      throw new Error('移动文件请求失败: ' + moveResponse.status);
    }
    
    const result = await moveResponse.json();
    console.log('='.repeat(60));
    console.log('✓ HTTP服务器移动文件成功');
    console.log('✓ 移动文件数:', result.movedCount);
    console.log('✓ 目标文件夹:', result.projectOutputFolder);
    console.log('='.repeat(60));
    
    return result;
  } catch (error) {
    console.error('HTTP服务器移动文件失败:', error.message);
    throw error;
  }
}