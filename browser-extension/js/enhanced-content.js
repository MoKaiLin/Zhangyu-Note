class EnhancedTextExtractor {
  constructor() {
    this.extractedText = '';
    this.isExtracting = false;
    this.popup = null;
    this.currentChunk = '';
    this.chunks = [];
    this.footnotes = [];
    this.processedElements = new Set();
    this.processedTextHashes = new Set();
    this.idToTextMap = new Map();
    this.isUserScrolling = false;
    this.readElements = [];
    this.lastExtractedText = '';
    this.beforeUnloadHandler = null;
    this.popStateHandler = null;
    this.hashChangeHandler = null;
    this.globalClickHandler = null;
    this.keyDownHandler = null;
    this.linkMonitorInterval = null;
    this.originalLocationMethods = null;
    this.originalSetHref = null;
    this.currentHighlightedElement = null;
    this.highlightTimeout = null;
    this.mainContent = [];
    this.footnotes = [];
    this.mutationObserver = null;
    this.currentUrl = window.location.href;

    this.deduplication = new ContentDeduplication({
      similarityThreshold: 0.7,
      enableFuzzyMatching: true,
      enableCache: true,
      cacheSize: 10000,
      fingerprintAlgorithm: 'simhash'
    });

    this.linkManager = new LinkContentManager({
      maxDepth: 1,
      crawlStrategy: 'breadth',
      timeout: 5000,
      maxRetries: 3,
      enableAsync: true,
      batchSize: 5
    });

    this.contentExtractor = new SmartContentExtractor({
      minContentLength: 10,
      maxContentLength: 10000,
      enableMLFiltering: false,
      enableAdFiltering: true,
      enableNoiseFiltering: true
    });

    this.existingFingerprints = [];
    this.setupEventListeners();
    this.loadSettings();
  }

  setupEventListeners() {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.action === 'start_extraction') {
        this.startExtraction();
      }
    });

    let scrollTimeout;
    window.addEventListener('scroll', () => {
      if (this.isExtracting) {
        console.log('检测到滚动事件');
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          console.log('滚动延迟300ms后执行提取');
          requestAnimationFrame(() => {
            this.realTimeExtraction();
          });
        }, 300);
      }
    });
  }

  startExtraction() {
    this.isExtracting = true;
    this.extractedText = '';
    this.chunks = [];
    this.footnotes = [];
    this.mainContent = [];
    this.processedElements.clear();
    this.processedTextHashes.clear();
    this.idToTextMap.clear();
    this.readElements = [];
    this.lastExtractedText = '';
    this.existingFingerprints = [];
    this.deduplication.resetStatistics();
    this.linkManager.resetStatistics();
    this.contentExtractor.resetStatistics();
    this.currentUrl = window.location.href;
    this.setupUrlChangeMonitoring();
    this.createPopup();
    this.disableLinks();
    this.setupMutationObserver();
    this.showStatus('读屏已开始', 'success');
    this.realTimeExtraction();
  }

  createPopup() {
    if (this.popup) {
      this.popup.remove();
    }

    this.popup = document.createElement('div');
    this.popup.id = 'text-extractor-popup';
    this.popup.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      width: 350px;
      max-height: 500px;
      background: white;
      border: 1px solid #ddd;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      padding: 15px;
      font-size: 14px;
      line-height: 1.5;
      overflow: hidden;
      z-index: 9999;
      font-family: Arial, sans-serif;
      display: flex;
      flex-direction: column;
    `;

    this.popup.addEventListener('scroll', (e) => {
      e.stopPropagation();
      e.preventDefault();
    });
    this.popup.addEventListener('wheel', (e) => {
      e.stopPropagation();
    });
    this.popup.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });
    this.popup.addEventListener('mouseup', (e) => {
      e.stopPropagation();
    });
    this.popup.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
      padding-bottom: 10px;
      border-bottom: 1px solid #eee;
    `;

    const title = document.createElement('div');
    title.textContent = '读屏提取';
    title.style.cssText = `
      font-weight: bold;
      font-size: 16px;
      color: #333;
    `;

    const closeButton = document.createElement('button');
    closeButton.textContent = '×';
    closeButton.style.cssText = `
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
      color: #999;
      padding: 0;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    closeButton.addEventListener('click', (e) => {
      e.stopPropagation();
      this.stopExtraction();
    });

    const settingsButton = document.createElement('button');
    settingsButton.textContent = '⚙️';
    settingsButton.title = '设置';
    settingsButton.style.cssText = `
      background: none;
      border: none;
      font-size: 16px;
      cursor: pointer;
      color: #666;
      padding: 0;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 10px;
    `;
    settingsButton.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showSettingsPanel();
    });

    header.appendChild(title);
    header.appendChild(settingsButton);
    header.appendChild(closeButton);
    this.popup.appendChild(header);

    const statsPanel = document.createElement('div');
    statsPanel.id = 'stats-panel';
    statsPanel.style.cssText = `
      margin-bottom: 10px;
      padding: 8px;
      background: #f5f5f5;
      border-radius: 4px;
      font-size: 12px;
      color: #666;
    `;
    statsPanel.innerHTML = `
      <div>已读: 0条 | 重复: 0条 | 过滤: 0条</div>
      <div>缓存命中: 0次 | 缓存未命中: 0次</div>
    `;
    this.popup.appendChild(statsPanel);

    const contentDiv = document.createElement('div');
    contentDiv.id = 'popup-content';
    contentDiv.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding-right: 5px;
      max-height: 300px;
    `;
    this.popup.appendChild(contentDiv);

    const statusPanel = document.createElement('div');
    statusPanel.id = 'status-panel';
    statusPanel.style.cssText = `
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid #eee;
      font-size: 12px;
      color: #666;
      text-align: center;
    `;
    statusPanel.textContent = '已读: 0条 (0%)';
    this.popup.appendChild(statusPanel);

    const actionPanel = document.createElement('div');
    actionPanel.style.cssText = `
      margin-top: 10px;
      display: flex;
      gap: 10px;
    `;

    const exportButton = document.createElement('button');
    exportButton.textContent = '导出';
    exportButton.style.cssText = `
      flex: 1;
      padding: 8px 12px;
      background: #1890ff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    `;
    exportButton.addEventListener('click', (e) => {
      e.stopPropagation();
      this.exportContent();
    });

    const clearButton = document.createElement('button');
    clearButton.textContent = '清除';
    clearButton.style.cssText = `
      flex: 1;
      padding: 8px 12px;
      background: #f5f5f5;
      color: #333;
      border: 1px solid #ddd;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    `;
    clearButton.addEventListener('click', (e) => {
      e.stopPropagation();
      this.clearContent();
    });

    actionPanel.appendChild(exportButton);
    actionPanel.appendChild(clearButton);
    this.popup.appendChild(actionPanel);

    document.body.appendChild(this.popup);
    this.contentDiv = contentDiv;
    this.statsPanel = statsPanel;

    contentDiv.addEventListener('scroll', () => {
      this.isUserScrolling = true;
    });
  }

  realTimeExtraction() {
    if (!this.isExtracting) {
      return;
    }

    console.log('开始实时提取...');
    const visibleContent = this.getVisibleContent();
    
    if (visibleContent && visibleContent.trim().length > 0) {
      console.log('提取到可见内容，长度:', visibleContent.length);
      console.log('提取到的内容预览:', visibleContent.substring(0, 200) + '...');
      
      if (visibleContent !== this.lastExtractedText) {
        console.log('内容与上次不同，开始处理...');
        const processedContent = this.processContent(visibleContent);
        console.log('处理后的内容长度:', processedContent ? processedContent.length : 0);
        
        if (processedContent && processedContent.trim().length > 0) {
          console.log('处理完成，更新悬浮窗...');
          console.log('处理后的内容预览:', processedContent.substring(0, 200) + '...');
          this.updatePopup(processedContent);
          this.lastExtractedText = visibleContent;
          this.updateStatistics();
        } else {
          console.log('处理后的内容为空');
        }
      } else {
        console.log('内容与上次相同，跳过');
      }
    } else {
      console.log('没有提取到可见内容');
    }
  }

  getVisibleContent() {
    console.log('开始提取可见内容...');
    
    const visibleElements = this.getVisibleElementsFromDOM(document.body);
    console.log('可见元素数量:', visibleElements.length);
    
    if (visibleElements.length > 0) {
      const newElements = this.filterNewElements(visibleElements);
      console.log('新元素数量:', newElements.length);
      
      if (newElements.length > 0) {
        console.log('前3个新元素内容:');
        newElements.slice(0, 3).forEach((item, index) => {
          console.log(`元素 ${index}:`, item.text.substring(0, 100) + '...');
        });
        
        const newContent = newElements
          .map(item => item.text)
          .join('\n\n');
        
        console.log(`找到 ${newElements.length} 个新元素，内容长度: ${newContent.length}`);
        return newContent;
      } else {
        console.log('没有找到新元素');
      }
    } else {
      console.log('没有找到可见元素');
    }

    return '';
  }

  getVisibleElementsFromDOM(mainElement) {
    const visibleElements = [];
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    console.log('视口尺寸:', viewportWidth, 'x', viewportHeight);

    const selectors = 'p, div, span, h1, h2, h3, h4, h5, h6, article, section, li, blockquote, pre, td, th, label, a';
    const elements = mainElement.querySelectorAll(selectors);
    console.log(`找到 ${elements.length} 个候选元素`);

    elements.forEach((element, index) => {
      try {
        if (this.shouldSkipElement(element)) {
          return;
        }

        const text = element.textContent.trim();
        if (text.length < 3) {
          return;
        }

        const rect = element.getBoundingClientRect();

        if (rect.width === 0 || rect.height === 0) {
          return;
        }

        if (rect.width < 20 || rect.height < 10) {
          return;
        }

        const isPartiallyVisible = (
          rect.bottom > -100 &&
          rect.top < viewportHeight + 100 &&
          rect.right > -50 &&
          rect.left < viewportWidth + 50
        );

        if (isPartiallyVisible) {
          visibleElements.push({
            element: element,
            text: text,
            type: 'text',
            position: { top: rect.top, left: rect.left }
          });
        }
      } catch (error) {
        console.log(`元素 ${index}: 获取rect失败`, error);
      }
    });

    console.log(`找到 ${visibleElements.length} 个可见有效元素`);
    return visibleElements;
  }

  shouldSkipElement(element) {
    const tagName = element.tagName.toLowerCase();
    const className = (element.className || '').toString().toLowerCase();
    const id = (element.id || '').toLowerCase();
    const role = (element.getAttribute('role') || '').toLowerCase();

    const adPatterns = [
      'ad-', 'ads-', 'advert', 'advertisement', 'sponsor', 'promo', 'promotion',
      'banner', 'pop-up', 'popup', 'modal', 'dialog', 'overlay',
      'google_ads', 'dfp', 'adsense', 'doubleclick', 'adcontainer',
      '广告', '推广', '赞助', '弹窗'
    ];

    for (const pattern of adPatterns) {
      if (className.includes(pattern) || id.includes(pattern)) {
        return true;
      }
    }

    const navPatterns = [
      'nav', 'navbar', 'navigation', 'menu', 'header', 'footer', 'sidebar',
      'toolbar', 'breadcrumb', 'pagination', 'pager', 'tabs', 'tablist',
      '导航', '菜单', '侧边', '页脚', '页头', '目录'
    ];

    for (const pattern of navPatterns) {
      if (className.includes(pattern) || id.includes(pattern)) {
        return true;
      }
    }

    const socialPatterns = [
      'social', 'share', 'sharing', 'like', 'follow', 'comment',
      'facebook', 'twitter', 'weibo', 'wechat', 'qq',
      '分享', '评论', '点赞', '关注'
    ];

    for (const pattern of socialPatterns) {
      if (className.includes(pattern) || id.includes(pattern)) {
        return true;
      }
    }

    const cookiePatterns = [
      'cookie', 'consent', 'gdpr', 'notice',
      '隐私', '同意'
    ];

    for (const pattern of cookiePatterns) {
      if (className.includes(pattern) || id.includes(pattern)) {
        return true;
      }
    }

    if (role === 'navigation' || role === 'complementary' || role === 'banner' || 
        role === 'search' || role === 'contentinfo') {
      return true;
    }

    const parentNav = element.closest('nav, header, footer, aside, .sidebar, #sidebar, #header, #footer');
    if (parentNav) {
      return true;
    }

    return false;
  }

  getVisibleElements(elements) {
    const visibleElements = [];
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    console.log('视口尺寸:', viewportWidth, 'x', viewportHeight);

    elements.forEach((item, index) => {
      if (!item.element) {
        console.log(`元素 ${index}: 没有element属性，跳过`);
        return;
      }

      const element = item.element;
      
      try {
        const rect = element.getBoundingClientRect();
        console.log(`元素 ${index}: rect=`, {
          top: rect.top.toFixed(2),
          bottom: rect.bottom.toFixed(2),
          left: rect.left.toFixed(2),
          right: rect.right.toFixed(2),
          width: rect.width.toFixed(2),
          height: rect.height.toFixed(2)
        });

        if (rect.width === 0 || rect.height === 0) {
          console.log(`元素 ${index}: 尺寸为0，跳过`);
          return;
        }

        const isPartiallyVisible = (
          rect.bottom > -50 &&     // 允许部分在上方50px
          rect.top < viewportHeight + 50 &&  // 允许部分在下方50px
          rect.right > -20 &&      // 允许部分在左侧20px
          rect.left < viewportWidth + 20    // 允许部分在右侧20px
        );

        if (isPartiallyVisible) {
          console.log(`元素 ${index}: 可见`);
          visibleElements.push(item);
        } else {
          console.log(`元素 ${index}: 不可见，跳过`);
        }
      } catch (error) {
        console.log(`元素 ${index}: 获取rect失败`, error);
      }
    });

    return visibleElements;
  }

  filterNewElements(elements) {
    const newElements = [];
    const processedTexts = new Set();
    
    console.log('开始过滤新元素，输入元素数量:', elements.length);
    console.log('已处理文本数量:', this.processedTextHashes.size);
    
    elements.forEach((item, index) => {
      if (!item.element) {
        console.log(`元素 ${index}: 没有element属性，跳过`);
        return;
      }

      let text = item.text.trim();
      if (text.length < 10) {
        console.log(`元素 ${index}: 文本太短，跳过`);
        return;
      }

      text = text.replace(/\s+/g, ' ').trim();

      const noisePatterns = [
        /^(登录|注册|登录注册|首页|上一步|下一步|上一页|下一页|返回|关闭|取消|确认|提交|保存)/,
        /(登录|注册|登录注册|首页|上一步|下一步|上一页|下一页|返回|关闭|取消|确认|提交|保存)$/,
        /^\d+$/,
        /^[\d\s,\.\-\+\(\)]+$/,
        /^[a-zA-Z]+$/,
        /^[\u0000-\u007F]+$/,
        /(百度百科|搜狗百科|360百科|互动百科|维基百科)/,
        /(视频|图片|地图|新闻|贴吧|知道|网盘|文库|资讯|采购)/,
        /(历史上的今天|冷知识|图解百科|秒懂百科|特色百科|动态百科)/,
        /(百科团队|校园团|分类达人团|热词团|繁星团|蝌蚪团)/,
        /(权威合作|合作模式|常见问题|联系方式|个人中心)/,
        /(编辑|讨论|上传视频|收藏|赞|分享)/,
        /^\[.*\]$/,
        /^【.*】$/,
        /^[\*\-\•·○●\s]*$/,
        /^(Chapter|Section|Part|Page)\s*\d+/i,
        /^(第[一二三四五六七八九十百千]+[章节篇部]|[0-9]+[.、])/,
        /^\d+[\.\)]\s*\d+[\.\)]/,
      ];

      for (const pattern of noisePatterns) {
        if (pattern.test(text)) {
          console.log(`元素 ${index}: 匹配噪声模式，跳过`);
          return;
        }
      }

      if (processedTexts.has(text)) {
        console.log(`元素 ${index}: 文本已处理过，跳过`);
        return;
      }

      const textHash = this.simpleHash(text);
      if (this.processedTextHashes.has(textHash)) {
        console.log(`元素 ${index}: 文本hash已存在，跳过`);
        return;
      }

      let isDuplicatePosition = false;
      for (const existingText of processedTexts) {
        if (this.isSimilarText(text, existingText)) {
          console.log(`元素 ${index}: 与已处理文本相似，跳过`);
          isDuplicatePosition = true;
          break;
        }
      }

      if (isDuplicatePosition) {
        return;
      }

      console.log(`元素 ${index}: 新元素，添加到列表`);
      processedTexts.add(text);
      this.processedTextHashes.add(textHash);
      item.text = text;
      newElements.push(item);
    });

    console.log('过滤完成，新元素数量:', newElements.length);
    return newElements;
  }

  isSimilarText(text1, text2) {
    if (text1 === text2) {
      return true;
    }

    const len1 = text1.length;
    const len2 = text2.length;
    const maxLen = Math.max(len1, len2);
    
    if (maxLen === 0) {
      return true;
    }

    const shorter = len1 < len2 ? text1 : text2;
    const longer = len1 < len2 ? text2 : text1;
    
    if (longer.includes(shorter)) {
      const ratio = shorter.length / longer.length;
      return ratio > 0.8;
    }

    let matchCount = 0;
    const minLen = Math.min(len1, len2);
    
    for (let i = 0; i < minLen; i++) {
      if (text1[i] === text2[i]) {
        matchCount++;
      }
    }

    const similarity = matchCount / minLen;
    return similarity > 0.9;
  }

  generateElementId(element) {
    let id = element.id;
    
    if (id) {
      return `id:${id}`;
    }

    const className = element.className;
    if (className && typeof className === 'string' && className.trim()) {
      const trimmedClassName = className.trim();
      if (trimmedClassName.length < 50) {
        return `class:${trimmedClassName}`;
      }
    }

    const tagName = element.tagName;
    const parent = element.parentElement;
    
    if (parent) {
      const siblings = Array.from(parent.children);
      const index = siblings.indexOf(element);
      const parentId = this.generateElementId(parent);
      return `${parentId}:${tagName}:${index}`;
    }

    return `tag:${tagName}`;
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString();
  }

  highlightElements(elements) {
    if (!this.isExtracting) {
      return;
    }

    if (this.highlightTimeout) {
      clearTimeout(this.highlightTimeout);
    }

    elements.forEach(item => {
      if (item.element && this.isExtracting) {
        this.highlightElement(item.element);
      }
    });

    this.highlightTimeout = setTimeout(() => {
      this.clearHighlights();
    }, 2000);
  }

  highlightElement(element) {
    if (!element || !this.isExtracting) {
      return;
    }

    if (element.hasAttribute('data-highlighted')) {
      return;
    }

    const originalOutline = element.style.outline;
    const originalOutlineOffset = element.style.outlineOffset;
    const originalBoxShadow = element.style.boxShadow;

    element.setAttribute('data-original-outline', originalOutline || '');
    element.setAttribute('data-original-outline-offset', originalOutlineOffset || '');
    element.setAttribute('data-original-box-shadow', originalBoxShadow || '');
    element.setAttribute('data-highlighted', 'true');

    element.style.outline = '3px solid #1890ff';
    element.style.outlineOffset = '2px';
    element.style.boxShadow = '0 0 10px rgba(24, 144, 255, 0.5)';
    element.style.transition = 'all 0.3s ease';

    this.currentHighlightedElement = element;
  }

  clearHighlights() {
    const highlightedElements = document.querySelectorAll('[data-highlighted]');
    
    highlightedElements.forEach(element => {
      const originalOutline = element.getAttribute('data-original-outline');
      const originalOutlineOffset = element.getAttribute('data-original-outline-offset');
      const originalBoxShadow = element.getAttribute('data-original-box-shadow');

      element.style.outline = originalOutline || '';
      element.style.outlineOffset = originalOutlineOffset || '';
      element.style.boxShadow = originalBoxShadow || '';
      element.style.transition = '';

      element.removeAttribute('data-highlighted');
      element.removeAttribute('data-original-outline');
      element.removeAttribute('data-original-outline-offset');
      element.removeAttribute('data-original-box-shadow');
    });

    this.currentHighlightedElement = null;
  }

  processContent(content) {
    const paragraphs = content.split('\n\n').filter(p => p.trim().length > 0);
    let processedText = '';
    let addedCount = 0;
    let duplicateCount = 0;
    let typeDistribution = {
      heading: 0,
      paragraph: 0,
      list: 0,
      code: 0,
      quote: 0,
      text: 0
    };

    console.log('开始处理内容，段落数量:', paragraphs.length);

    paragraphs.forEach((paragraph, index) => {
      const trimmedParagraph = paragraph.trim();
      
      if (trimmedParagraph.length === 0) {
        return;
      }

      console.log(`处理段落 ${index}: 长度=${trimmedParagraph.length}, 内容=${trimmedParagraph.substring(0, 100)}...`);

      const elementType = this.getElementType(trimmedParagraph);
      typeDistribution[elementType]++;
      const typeLabel = this.getTypeLabel(elementType);
      
      const isFootnote = this.isFootnote(trimmedParagraph);
      
      if (isFootnote) {
        this.footnotes.push({
          text: trimmedParagraph,
          type: elementType,
          label: typeLabel
        });
        console.log(`⊗ 检测到脚注:`, trimmedParagraph.substring(0, 50) + '...');
      } else {
        this.mainContent.push({
          text: trimmedParagraph,
          type: elementType,
          label: typeLabel
        });
        processedText += `${typeLabel} ${trimmedParagraph}\n\n`;
        addedCount++;
      }
    });

    this.currentDuplicateCount = duplicateCount;
    this.currentAddedCount = addedCount;
    this.currentTypeDistribution = typeDistribution;

    console.log(`处理完成，添加了 ${addedCount} 个段落，处理后的内容长度: ${processedText.length}`);
    return processedText;
  }

  isFootnote(text) {
    const footnoteKeywords = [
      '脚注', '注释', '注', '备注', '说明', '解释',
      'reference', 'note', 'footnote', 'annotation', 'comment',
      '附录', '补充', '附加', '额外',
      '附录', '补充说明', '补充材料', '参考资料',
      '引用', '出处', '来源', '参考',
      '参考文献', '参考资料', '引用来源',
      '数据来源', '信息来源', '资料来源'
    ];

    for (const keyword of footnoteKeywords) {
      if (text.includes(keyword)) {
        return true;
      }
    }

    if (text.length < 50 && /^\[.*\]$/.test(text)) {
      return true;
    }

    if (/^\d+[\.\)]/.test(text) && text.length < 100) {
      return true;
    }

    if (/^—|^—|^——/.test(text)) {
      return true;
    }

    return false;
  }

  getElementType(text) {
    if (this.isHeading(text)) {
      return 'heading';
    } else if (this.isList(text)) {
      return 'list';
    } else if (this.isCode(text)) {
      return 'code';
    } else if (this.isQuote(text)) {
      return 'quote';
    } else if (this.isParagraph(text)) {
      return 'paragraph';
    } else {
      return 'text';
    }
  }

  isHeading(text) {
    if (text.length > 100) {
      return false;
    }

    const headingPatterns = [
      /^第[一二三四五六七八九十百千]+[章节篇]/,
      /^[一二三四五六七八九十百千]+、/,
      /^[0-9]+[.、]/,
      /^[A-Z][.、]/,
      /^[IVX]+[.、]/,
      /^(一|二|三|四|五|六|七|八|九|十|百|千|万|亿)[$$、]/,
      /^(Chapter|Section|Part)\s+[0-9]+/i
    ];

    for (const pattern of headingPatterns) {
      if (pattern.test(text)) {
        return true;
      }
    }

    return false;
  }

  isList(text) {
    const listPatterns = [
      /^[-•·○●]/,
      /^\d+[.)、]/,
      /^[a-z][.)、]/,
      /^[A-Z][.)、]/,
      /^[IVX]+[.)、]/
    ];

    for (const pattern of listPatterns) {
      if (pattern.test(text)) {
        return true;
      }
    }

    return false;
  }

  isCode(text) {
    const codePatterns = [
      /function\s+\w+\s*\(/,
      /class\s+\w+/,
      /import\s+.*from/,
      /export\s+(default\s+)?/,
      /const\s+\w+\s*=/,
      /let\s+\w+\s*=/,
      /var\s+\w+\s*=/,
      /if\s*\(/,
      /for\s*\(/,
      /while\s*\(/,
      /return\s+/,
      /=>\s*{/,
      /<\w+.*>/,
      /def\s+\w+\s*\(/,
      /print\s*\(/,
      /console\.log\s*\(/,
      /\/\/.*$/,
      /\/\*.*\*\//
    ];

    for (const pattern of codePatterns) {
      if (pattern.test(text)) {
        return true;
      }
    }

    return false;
  }

  isQuote(text) {
    const quotePatterns = [
      /^["'"「『【（]/,
      /[""'」』】）]$/,
      /^引用|^摘录|^原文|^出处/i,
      /^—|^—|^——/
    ];

    for (const pattern of quotePatterns) {
      if (pattern.test(text)) {
        return true;
      }
    }

    return false;
  }

  isParagraph(text) {
    return text.length > 50 && text.length < 500;
  }

  getTypeLabel(type) {
    const labels = {
      heading: '【标题】',
      paragraph: '【正文】',
      list: '【列表】',
      code: '【代码】',
      quote: '【引用】',
      text: '【文本】'
    };
    return labels[type] || '【文本】';
  }

  updatePopup(text) {
    if (this.contentDiv) {
      this.contentDiv.textContent = text;
      if (!this.isUserScrolling) {
        setTimeout(() => {
          if (this.contentDiv) {
            this.contentDiv.scrollTop = this.contentDiv.scrollHeight;
          }
        }, 0);
      }
    }
  }

  updateStatistics() {
    if (this.statsPanel) {
      const dedupStats = this.deduplication.getStatistics();
      const extractorStats = this.contentExtractor.getStatistics();
      
      this.statsPanel.innerHTML = `
        <div>已读: ${dedupStats.totalProcessed}条 | 重复: ${dedupStats.duplicatesFound}条 | 过滤: ${extractorStats.filteredElements}条</div>
        <div>缓存命中: ${dedupStats.cacheHits}次 | 缓存未命中: ${dedupStats.cacheMisses}次</div>
      `;
    }

    if (this.popup) {
      const statusPanel = this.popup.querySelector('#status-panel');
      if (statusPanel) {
        const dedupStats = this.deduplication.getStatistics();
        const percentage = dedupStats.totalProcessed > 0 ? 
          ((dedupStats.duplicatesFound / dedupStats.totalProcessed) * 100).toFixed(1) : 0;
        statusPanel.textContent = `已读: ${dedupStats.totalProcessed}条 (重复率: ${percentage}%)`;
      }
    }
  }

  exportContent() {
    const dedupStats = this.deduplication.getStatistics();
    const extractorStats = this.contentExtractor.getStatistics();
    
    const fullContent = this.contentDiv ? this.contentDiv.textContent : '';
    
    if (fullContent.trim().length === 0 && this.mainContent.length === 0) {
      this.showStatus('没有可导出的内容', 'warning');
      return;
    }

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '-');
    const filename = `screen_reader_${dateStr}_${timeStr}`;

    const mainContentText = this.mainContent.map(item => `${item.label} ${item.text}`).join('\n\n');
    const footnotesText = this.footnotes.map(item => `${item.label} ${item.text}`).join('\n\n');

    let exportText = '';
    
    exportText += '='.repeat(60) + '\n';
    exportText += '网页文字提取报告\n';
    exportText += '='.repeat(60) + '\n\n';
    
    exportText += `导出时间: ${now.toLocaleString()}\n`;
    exportText += `页面URL: ${window.location.href}\n`;
    exportText += `页面标题: ${document.title}\n\n`;
    
    exportText += '='.repeat(60) + '\n';
    exportText += '统计信息\n';
    exportText += '='.repeat(60) + '\n\n';
    
    exportText += `总提取内容数: ${dedupStats.totalProcessed}\n`;
    exportText += `重复内容数: ${dedupStats.duplicatesFound}\n`;
    exportText += `有效内容数: ${dedupStats.totalProcessed - dedupStats.duplicatesFound}\n`;
    exportText += `正文段落数: ${this.mainContent.length}\n`;
    exportText += `脚注条目数: ${this.footnotes.length}\n`;
    exportText += `缓存命中次数: ${dedupStats.cacheHits}\n`;
    exportText += `缓存未命中次数: ${dedupStats.cacheMisses}\n\n`;
    
    if (this.currentTypeDistribution) {
      exportText += '内容类型分布:\n';
      exportText += `  标题: ${this.currentTypeDistribution.heading}条\n`;
      exportText += `  正文: ${this.currentTypeDistribution.paragraph}条\n`;
      exportText += `  列表: ${this.currentTypeDistribution.list}条\n`;
      exportText += `  代码: ${this.currentTypeDistribution.code}条\n`;
      exportText += `  引用: ${this.currentTypeDistribution.quote}条\n`;
      exportText += `  文本: ${this.currentTypeDistribution.text}条\n\n`;
    }
    
    exportText += '='.repeat(60) + '\n';
    exportText += '正文内容\n';
    exportText += '='.repeat(60) + '\n\n';
    exportText += mainContentText;
    exportText += '\n\n';
    
    if (this.footnotes.length > 0) {
      exportText += '='.repeat(60) + '\n';
      exportText += '脚注/附加内容\n';
      exportText += '='.repeat(60) + '\n\n';
      exportText += footnotesText;
      exportText += '\n\n';
    }
    
    exportText += '='.repeat(60) + '\n';
    exportText += '报告结束\n';
    exportText += '='.repeat(60) + '\n';

    const exportData = {
      content: exportText,
      filename: filename,
      statistics: {
        deduplication: dedupStats,
        extractor: extractorStats,
        mainContentCount: this.mainContent.length,
        footnotesCount: this.footnotes.length,
        typeDistribution: this.currentTypeDistribution
      }
    };

    chrome.runtime.sendMessage({
      action: 'export_content',
      data: exportData
    }, (response) => {
      if (chrome.runtime.lastError) {
        this.showStatus('导出失败: ' + chrome.runtime.lastError.message, 'error');
      } else if (response && response.error) {
        this.showStatus('导出失败: ' + response.error, 'error');
      } else {
        this.showStatus('导出成功', 'success');
      }
    });
  }

  clearContent() {
    this.extractedText = '';
    this.chunks = [];
    this.footnotes = [];
    this.mainContent = [];
    this.processedElements.clear();
    this.processedTextHashes.clear();
    this.idToTextMap.clear();
    this.readElements = [];
    this.lastExtractedText = '';
    this.existingFingerprints = [];
    this.deduplication.clearCache();
    this.deduplication.resetStatistics();
    this.linkManager.resetStatistics();
    this.contentExtractor.resetStatistics();
    
    if (this.contentDiv) {
      this.contentDiv.textContent = '';
    }
    
    this.updateStatistics();
    this.showStatus('内容已清除', 'info');
  }

  stopExtraction() {
    this.isExtracting = false;
    
    if (this.highlightTimeout) {
      clearTimeout(this.highlightTimeout);
      this.highlightTimeout = null;
    }
    
    this.clearHighlights();
    this.cleanupUrlChangeMonitoring();
    this.cleanupMutationObserver();
    
    if (this.popup) {
      this.popup.remove();
      this.popup = null;
    }
    
    this.enableLinks();
    this.showStatus('读屏已停止', 'info');
  }

  disableLinks() {
    console.log('禁用所有链接...');
    
    const links = document.querySelectorAll('a');
    console.log(`找到 ${links.length} 个链接`);
    
    links.forEach(link => {
      if (link.hasAttribute('data-link-disabled')) {
        return;
      }
      
      link.addEventListener('click', (e) => {
        if (this.isExtracting) {
          console.log('拦截到链接点击:', link.textContent, link.href);
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          return false;
        }
      }, true);
      
      link.addEventListener('contextmenu', (e) => {
        if (this.isExtracting) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
      }, true);
      
      link.addEventListener('mousedown', (e) => {
        if (this.isExtracting) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
      }, true);
      
      link.addEventListener('mouseup', (e) => {
        if (this.isExtracting) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
      }, true);
      
      link.addEventListener('dblclick', (e) => {
        if (this.isExtracting) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
      }, true);
      
      const originalHref = link.getAttribute('href');
      link.setAttribute('data-original-href', originalHref || '');
      link.setAttribute('data-link-disabled', 'true');
      
      link.style.cursor = 'default';
      link.style.pointerEvents = 'none';
      link.style.opacity = '0.7';
      link.style.userSelect = 'none';
      link.style.textDecoration = 'none';
    });
    
    console.log('所有链接已禁用');
  }

  enableLinks() {
    console.log('恢复所有链接...');
    
    const links = document.querySelectorAll('a[data-link-disabled]');
    console.log(`找到 ${links.length} 个禁用的链接`);
    
    links.forEach(link => {
      link.removeEventListener('click', this.linkClickHandler, true);
      link.removeEventListener('contextmenu', this.linkContextMenuHandler, true);
      link.removeEventListener('mousedown', this.linkMouseDownHandler, true);
      link.removeEventListener('mouseup', this.linkMouseUpHandler, true);
      link.removeEventListener('dblclick', this.linkDblClickHandler, true);
      
      const originalHref = link.getAttribute('data-original-href');
      if (originalHref) {
        link.setAttribute('href', originalHref);
      }
      
      link.removeAttribute('data-link-disabled');
      link.removeAttribute('data-original-href');
      
      link.style.cursor = '';
      link.style.pointerEvents = '';
      link.style.opacity = '';
      link.style.userSelect = '';
      link.style.textDecoration = '';
    });
    
    console.log('所有链接已恢复');
  }

  showStatus(message, type = 'info') {
    console.log(`状态: ${message}`);

    const colors = {
      success: '#52c41a',
      info: '#1890ff',
      warning: '#faad14',
      error: '#ff4d4f'
    };

    const messageEl = document.createElement('div');
    messageEl.className = 'reader-status-message';
    messageEl.style.cssText = `
      position: fixed;
      top: 60px;
      right: 20px;
      z-index: 99997;
      background: ${colors[type] || colors.info};
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      font-family: Arial, sans-serif;
      font-size: 12px;
      opacity: 0.9;
      animation: fadeInOut 3s ease;
    `;
    messageEl.textContent = message;
    document.body.appendChild(messageEl);

    setTimeout(() => {
      if (messageEl.parentNode) {
        messageEl.parentNode.removeChild(messageEl);
      }
    }, 3000);
  }

  setupUrlChangeMonitoring() {
    this.beforeUnloadHandler = () => {
      console.log('检测到页面即将跳转，停止读屏');
      this.stopExtraction();
    };

    this.popStateHandler = () => {
      console.log('检测到URL变化:', window.location.href);
      if (window.location.href !== this.currentUrl) {
        console.log('URL已改变，停止读屏');
        this.stopExtraction();
      }
    };

    this.hashChangeHandler = () => {
      console.log('检测到hash变化:', window.location.hash);
      if (window.location.href !== this.currentUrl) {
        console.log('URL已改变，停止读屏');
        this.stopExtraction();
      }
    };

    window.addEventListener('beforeunload', this.beforeUnloadHandler);
    window.addEventListener('popstate', this.popStateHandler);
    window.addEventListener('hashchange', this.hashChangeHandler);

    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function(...args) {
      originalPushState.apply(this, args);
      console.log('检测到pushState:', args);
      if (window.location.href !== this.currentUrl) {
        console.log('URL已改变，停止读屏');
        if (window.extractor && window.extractor.isExtracting) {
          window.extractor.stopExtraction();
        }
      }
    };

    history.replaceState = function(...args) {
      originalReplaceState.apply(this, args);
      console.log('检测到replaceState:', args);
      if (window.location.href !== this.currentUrl) {
        console.log('URL已改变，停止读屏');
        if (window.extractor && window.extractor.isExtracting) {
          window.extractor.stopExtraction();
        }
      }
    };

    this.originalLocationMethods = {
      pushState: originalPushState,
      replaceState: originalReplaceState
    };

    setInterval(() => {
      if (this.isExtracting && window.location.href !== this.currentUrl) {
        console.log('定期检查：URL已改变，停止读屏');
        console.log('当前URL:', window.location.href);
        console.log('原始URL:', this.currentUrl);
        this.stopExtraction();
      }
    }, 1000);
  }

  cleanupUrlChangeMonitoring() {
    if (this.beforeUnloadHandler) {
      window.removeEventListener('beforeunload', this.beforeUnloadHandler);
      this.beforeUnloadHandler = null;
    }

    if (this.popStateHandler) {
      window.removeEventListener('popstate', this.popStateHandler);
      this.popStateHandler = null;
    }

    if (this.hashChangeHandler) {
      window.removeEventListener('hashchange', this.hashChangeHandler);
      this.hashChangeHandler = null;
    }

    if (this.originalLocationMethods) {
      history.pushState = this.originalLocationMethods.pushState;
      history.replaceState = this.originalLocationMethods.replaceState;
      this.originalLocationMethods = null;
    }
  }

  setupMutationObserver() {
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
    }

    this.mutationObserver = new MutationObserver((mutations) => {
      if (!this.isExtracting) return;

      let hasContentChanges = false;
      
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          // 检查是否添加了新的内容节点
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // 检查是否是包含文本的元素
              if (node.textContent && node.textContent.trim().length > 0) {
                hasContentChanges = true;
              }
              // 检查是否有子元素包含文本
              const textNodes = node.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, div, span');
              if (textNodes.length > 0) {
                hasContentChanges = true;
              }
            }
          });
        } else if (mutation.type === 'characterData') {
          // 文本内容变化
          hasContentChanges = true;
        }
      });

      if (hasContentChanges) {
        console.log('检测到DOM内容变化，重新提取文本...');
        // 延迟执行，避免频繁提取
        setTimeout(() => {
          if (this.isExtracting) {
            this.realTimeExtraction();
          }
        }, 500);
      }
    });

    // 开始观察整个文档的变化
    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      characterDataOldValue: false
    });

    console.log('MutationObserver已启动，开始监听DOM变化...');
  }

  cleanupMutationObserver() {
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
      console.log('MutationObserver已停止');
    }
  }

  showSettingsPanel() {
    if (this.settingsPanel) {
      this.settingsPanel.style.display = 'block';
      return;
    }

    this.settingsPanel = document.createElement('div');
    this.settingsPanel.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 400px;
      background: white;
      border: 1px solid #ddd;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      padding: 20px;
      z-index: 10000;
      font-family: Arial, sans-serif;
    `;

    const settingsHeader = document.createElement('div');
    settingsHeader.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 1px solid #eee;
    `;

    const settingsTitle = document.createElement('h3');
    settingsTitle.textContent = '设置';
    settingsTitle.style.cssText = `
      margin: 0;
      font-size: 18px;
      color: #333;
    `;

    const closeSettingsButton = document.createElement('button');
    closeSettingsButton.textContent = '×';
    closeSettingsButton.style.cssText = `
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
      color: #999;
      padding: 0;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    closeSettingsButton.addEventListener('click', (e) => {
      e.stopPropagation();
      this.settingsPanel.style.display = 'none';
    });

    settingsHeader.appendChild(settingsTitle);
    settingsHeader.appendChild(closeSettingsButton);
    this.settingsPanel.appendChild(settingsHeader);

    const settingsContent = document.createElement('div');
    settingsContent.style.cssText = `
      max-height: 400px;
      overflow-y: auto;
    `;

    // 过滤设置
    const filterSection = document.createElement('div');
    filterSection.style.cssText = `
      margin-bottom: 20px;
    `;

    const filterTitle = document.createElement('h4');
    filterTitle.textContent = '内容过滤';
    filterTitle.style.cssText = `
      margin: 0 0 10px 0;
      font-size: 14px;
      color: #666;
    `;
    filterSection.appendChild(filterTitle);

    // 广告过滤
    const adFilterDiv = document.createElement('div');
    adFilterDiv.style.cssText = `
      margin-bottom: 10px;
      display: flex;
      align-items: center;
    `;
    const adFilterCheckbox = document.createElement('input');
    adFilterCheckbox.type = 'checkbox';
    adFilterCheckbox.id = 'adFilter';
    adFilterCheckbox.checked = this.contentExtractor.config.enableAdFiltering;
    adFilterCheckbox.style.cssText = `
      margin-right: 8px;
    `;
    const adFilterLabel = document.createElement('label');
    adFilterLabel.textContent = '过滤广告';
    adFilterLabel.htmlFor = 'adFilter';
    adFilterLabel.style.cssText = `
      font-size: 14px;
      color: #333;
      cursor: pointer;
    `;
    adFilterDiv.appendChild(adFilterCheckbox);
    adFilterDiv.appendChild(adFilterLabel);
    filterSection.appendChild(adFilterDiv);

    // 噪声过滤
    const noiseFilterDiv = document.createElement('div');
    noiseFilterDiv.style.cssText = `
      margin-bottom: 10px;
      display: flex;
      align-items: center;
    `;
    const noiseFilterCheckbox = document.createElement('input');
    noiseFilterCheckbox.type = 'checkbox';
    noiseFilterCheckbox.id = 'noiseFilter';
    noiseFilterCheckbox.checked = this.contentExtractor.config.enableNoiseFiltering;
    noiseFilterCheckbox.style.cssText = `
      margin-right: 8px;
    `;
    const noiseFilterLabel = document.createElement('label');
    noiseFilterLabel.textContent = '过滤导航和噪声内容';
    noiseFilterLabel.htmlFor = 'noiseFilter';
    noiseFilterLabel.style.cssText = `
      font-size: 14px;
      color: #333;
      cursor: pointer;
    `;
    noiseFilterDiv.appendChild(noiseFilterCheckbox);
    noiseFilterDiv.appendChild(noiseFilterLabel);
    filterSection.appendChild(noiseFilterDiv);

    // 视频过滤
    const videoFilterDiv = document.createElement('div');
    videoFilterDiv.style.cssText = `
      margin-bottom: 10px;
      display: flex;
      align-items: center;
    `;
    const videoFilterCheckbox = document.createElement('input');
    videoFilterCheckbox.type = 'checkbox';
    videoFilterCheckbox.id = 'videoFilter';
    videoFilterCheckbox.checked = true;
    videoFilterCheckbox.style.cssText = `
      margin-right: 8px;
    `;
    const videoFilterLabel = document.createElement('label');
    videoFilterLabel.textContent = '过滤视频和iframe';
    videoFilterLabel.htmlFor = 'videoFilter';
    videoFilterLabel.style.cssText = `
      font-size: 14px;
      color: #333;
      cursor: pointer;
    `;
    videoFilterDiv.appendChild(videoFilterCheckbox);
    videoFilterDiv.appendChild(videoFilterLabel);
    filterSection.appendChild(videoFilterDiv);

    settingsContent.appendChild(filterSection);

    // 去重设置
    const dedupSection = document.createElement('div');
    dedupSection.style.cssText = `
      margin-bottom: 20px;
    `;

    const dedupTitle = document.createElement('h4');
    dedupTitle.textContent = '文本去重';
    dedupTitle.style.cssText = `
      margin: 0 0 10px 0;
      font-size: 14px;
      color: #666;
    `;
    dedupSection.appendChild(dedupTitle);

    const dedupThresholdDiv = document.createElement('div');
    dedupThresholdDiv.style.cssText = `
      margin-bottom: 10px;
    `;
    const dedupThresholdLabel = document.createElement('label');
    dedupThresholdLabel.textContent = '相似度阈值（0-1）:';
    dedupThresholdLabel.style.cssText = `
      font-size: 14px;
      color: #333;
      display: block;
      margin-bottom: 5px;
    `;
    const dedupThresholdInput = document.createElement('input');
    dedupThresholdInput.type = 'range';
    dedupThresholdInput.min = '0';
    dedupThresholdInput.max = '1';
    dedupThresholdInput.step = '0.1';
    dedupThresholdInput.value = this.deduplication.config.similarityThreshold;
    dedupThresholdInput.style.cssText = `
      width: 100%;
    `;
    const dedupThresholdValue = document.createElement('span');
    dedupThresholdValue.textContent = this.deduplication.config.similarityThreshold;
    dedupThresholdValue.style.cssText = `
      font-size: 12px;
      color: #666;
      display: block;
      margin-top: 5px;
    `;
    dedupThresholdInput.addEventListener('input', (e) => {
      dedupThresholdValue.textContent = e.target.value;
    });
    dedupThresholdDiv.appendChild(dedupThresholdLabel);
    dedupThresholdDiv.appendChild(dedupThresholdInput);
    dedupThresholdDiv.appendChild(dedupThresholdValue);
    dedupSection.appendChild(dedupThresholdDiv);

    settingsContent.appendChild(dedupSection);

    // 内容长度设置
    const lengthSection = document.createElement('div');
    lengthSection.style.cssText = `
      margin-bottom: 20px;
    `;

    const lengthTitle = document.createElement('h4');
    lengthTitle.textContent = '内容长度';
    lengthTitle.style.cssText = `
      margin: 0 0 10px 0;
      font-size: 14px;
      color: #666;
    `;
    lengthSection.appendChild(lengthTitle);

    const minLengthDiv = document.createElement('div');
    minLengthDiv.style.cssText = `
      margin-bottom: 10px;
    `;
    const minLengthLabel = document.createElement('label');
    minLengthLabel.textContent = '最小内容长度:';
    minLengthLabel.style.cssText = `
      font-size: 14px;
      color: #333;
      display: block;
      margin-bottom: 5px;
    `;
    const minLengthInput = document.createElement('input');
    minLengthInput.type = 'number';
    minLengthInput.min = '0';
    minLengthInput.value = this.contentExtractor.config.minContentLength;
    minLengthInput.style.cssText = `
      width: 100%;
      padding: 5px;
      border: 1px solid #ddd;
      border-radius: 4px;
    `;
    minLengthDiv.appendChild(minLengthLabel);
    minLengthDiv.appendChild(minLengthInput);
    lengthSection.appendChild(minLengthDiv);

    settingsContent.appendChild(lengthSection);

    // 保存按钮
    const saveButton = document.createElement('button');
    saveButton.textContent = '保存设置';
    saveButton.style.cssText = `
      background: #4CAF50;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      width: 100%;
      margin-top: 20px;
    `;
    saveButton.addEventListener('click', (e) => {
      e.stopPropagation();
      
      // 保存设置
      this.contentExtractor.config.enableAdFiltering = adFilterCheckbox.checked;
      this.contentExtractor.config.enableNoiseFiltering = noiseFilterCheckbox.checked;
      this.deduplication.config.similarityThreshold = parseFloat(dedupThresholdInput.value);
      this.contentExtractor.config.minContentLength = parseInt(minLengthInput.value);
      
      // 保存到本地存储
      chrome.storage.local.set({
        extractorSettings: {
          enableAdFiltering: adFilterCheckbox.checked,
          enableNoiseFiltering: noiseFilterCheckbox.checked,
          similarityThreshold: parseFloat(dedupThresholdInput.value),
          minContentLength: parseInt(minLengthInput.value)
        }
      }, () => {
        console.log('设置已保存');
        this.showStatus('设置已保存', 'success');
        this.settingsPanel.style.display = 'none';
      });
    });

    settingsContent.appendChild(saveButton);
    this.settingsPanel.appendChild(settingsContent);

    document.body.appendChild(this.settingsPanel);
  }

  loadSettings() {
    // 从本地存储加载设置
    chrome.storage.local.get('extractorSettings', (result) => {
      if (result.extractorSettings) {
        const settings = result.extractorSettings;
        if (settings.enableAdFiltering !== undefined) {
          this.contentExtractor.config.enableAdFiltering = settings.enableAdFiltering;
        }
        if (settings.enableNoiseFiltering !== undefined) {
          this.contentExtractor.config.enableNoiseFiltering = settings.enableNoiseFiltering;
        }
        if (settings.similarityThreshold !== undefined) {
          this.deduplication.config.similarityThreshold = settings.similarityThreshold;
        }
        if (settings.minContentLength !== undefined) {
          this.contentExtractor.config.minContentLength = settings.minContentLength;
        }
        console.log('设置已加载:', settings);
      }
    });
  }
}

window.extractor = new EnhancedTextExtractor();
