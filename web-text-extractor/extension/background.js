// 后台脚本

let socket = null;
let isConnected = false;

// 连接到本地WebSocket服务器
function connectToLocalServer() {
  try {
    socket = new WebSocket('ws://localhost:8765');
    
    socket.onopen = () => {
      console.log('连接到本地服务器成功');
      isConnected = true;
    };
    
    socket.onmessage = (event) => {
      console.log('收到本地服务器消息:', event.data);
      handleServerMessage(event.data);
    };
    
    socket.onclose = () => {
      console.log('本地服务器连接关闭');
      isConnected = false;
      // 尝试重连
      setTimeout(connectToLocalServer, 5000);
    };
    
    socket.onerror = (error) => {
      console.error('WebSocket错误:', error);
      isConnected = false;
    };
  } catch (error) {
    console.error('连接本地服务器失败:', error);
    isConnected = false;
    // 尝试重连
    setTimeout(connectToLocalServer, 5000);
  }
}

// 处理服务器消息
function handleServerMessage(message) {
  try {
    const data = JSON.parse(message);
    
    if (data.type === 'extraction_complete') {
      console.log('提取完成:', data);
      // 可以在这里添加通知用户的逻辑
    } else if (data.type === 'error') {
      console.error('提取错误:', data.error);
      // 可以在这里添加错误通知逻辑
    }
  } catch (error) {
    console.error('解析服务器消息失败:', error);
  }
}

// 发送提取请求
function sendExtractionRequest(url) {
  if (!isConnected || !socket) {
    console.error('未连接到本地服务器');
    return false;
  }
  
  try {
    const request = {
      type: 'extract',
      url: url
    };
    socket.send(JSON.stringify(request));
    console.log('发送提取请求:', url);
    return true;
  } catch (error) {
    console.error('发送请求失败:', error);
    return false;
  }
}

// 监听扩展图标点击
chrome.action.onClicked.addListener((tab) => {
  if (!tab.url || tab.url.startsWith('chrome://')) {
    console.error('无法提取Chrome内部页面');
    return;
  }
  
  console.log('提取网页:', tab.url);
  
  // 发送提取请求
  const success = sendExtractionRequest(tab.url);
  
  if (success) {
    // 显示提取中通知
    chrome.action.setBadgeText({ text: '提取中', tabId: tab.id });
    chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
    
    // 3秒后清除徽章
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '', tabId: tab.id });
    }, 3000);
  } else {
    // 显示错误通知
    chrome.action.setBadgeText({ text: '错误', tabId: tab.id });
    chrome.action.setBadgeBackgroundColor({ color: '#F44336' });
    
    // 3秒后清除徽章
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '', tabId: tab.id });
    }, 3000);
  }
});

// 初始化连接
connectToLocalServer();

// 监听消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'extract_url') {
    const success = sendExtractionRequest(message.url);
    sendResponse({ success: success });
  }
  return true;
});
