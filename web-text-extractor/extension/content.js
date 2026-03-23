// 内容脚本

// 监听来自后台的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'get_page_info') {
    const pageInfo = {
      url: window.location.href,
      title: document.title,
      body: document.body.innerHTML
    };
    sendResponse(pageInfo);
  }
  return true;
});

// 可以在这里添加页面交互逻辑
console.log('网页文字提取器内容脚本已加载');
