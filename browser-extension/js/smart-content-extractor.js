class SmartContentExtractor {
  constructor(config = {}) {
    this.config = {
      minContentLength: 50,
      maxContentLength: 10000,
      enableMLFiltering: false,
      enableAdFiltering: true,
      enableNoiseFiltering: true,
      ...config
    };

    this.adKeywords = [
      'ad', 'advertisement', 'sponsored', 'promotion', 'banner', 'ads',
      '推广', '广告', '赞助商', '合作伙伴'
    ];

    this.noiseKeywords = [
      'nav', 'navigation', 'menu', 'sidebar', 'footer', 'header',
      '导航', '菜单', '侧边栏', '页脚', '页眉',
      'login', 'register', '登录', '注册',
      'toc', 'table-of-contents', 'breadcrumb', 'pagination',
      '目录', '面包屑', '分页'
    ];

    this.uselessKeywords = [
      '点击', 'click', '查看', 'view',
      '详情', 'detail', 'details',
      '阅读全文', 'read more', '继续阅读',
      '更多', 'more', '查看更多'
    ];

    this.videoKeywords = [
      'video', '播放', '时长', 'watch', 'player', '播放器',
      '视频', '播放量', '观看次数', '订阅', '粉丝', '点赞', '投币', '收藏'
    ];

    this.statistics = {
      totalElements: 0,
      validElements: 0,
      filteredElements: 0,
      adElements: 0,
      noiseElements: 0,
      shortElements: 0
    };
  }

  extractContent(element) {
    this.resetStatistics();
    
    const mainContent = this.findMainContent(element);
    
    if (!mainContent) {
      console.warn('未找到主要内容区域');
      return { success: false, reason: 'no_main_content' };
    }

    const content = this.processMainContent(mainContent);
    
    return {
      success: true,
      content: content.text,
      elements: content.elements,
      statistics: this.getStatistics()
    };
  }

  findMainContent(element) {
    const mainSelectors = [
      '.mainContent',
      '.main-content',
      '.article-content',
      '.post-content',
      '.entry-content',
      '.content-body',
      '.contentTab__NeQjN',
      '.curTab_TmrcN',
      '.lemma-summary',
      '.para',
      '.summary-text',
      '.article-body',
      '.post-body',
      '.entry-body',
      '.text-content',
      '.rich-text',
      '.article',
      'main',
      '[role="main"]',
      '#content',
      '#main',
      '#article',
      '#post-content',
      '.content',
      '#contentTab'
    ];

    let mainElement = null;
    let maxScore = 0;

    for (const selector of mainSelectors) {
      const elements = element.querySelectorAll(selector);
      
      elements.forEach(el => {
        const score = this.calculateContentScore(el);
        if (score > maxScore) {
          maxScore = score;
          mainElement = el;
        }
      });
    }

    if (!mainElement) {
      mainElement = element;
    }

    return mainElement;
  }

  calculateContentScore(element) {
    let score = 0;

    const textContent = element.textContent.trim();
    const textLength = textContent.length;

    if (textLength > 100) score += 10;
    if (textLength > 500) score += 20;
    if (textLength > 1000) score += 30;

    const paragraphs = element.querySelectorAll('p').length;
    if (paragraphs > 3) score += 15;
    if (paragraphs > 10) score += 25;

    const headings = element.querySelectorAll('h1, h2, h3, h4, h5, h6').length;
    if (headings > 2) score += 10;
    if (headings > 5) score += 20;

    const images = element.querySelectorAll('img').length;
    if (images > 0) score += 5;
    if (images > 3) score += 10;

    const links = element.querySelectorAll('a').length;
    if (links < textLength / 100) score += 10;

    const className = (element.className || '').toLowerCase();
    const id = (element.id || '').toLowerCase();

    const contentKeywords = ['content', 'article', 'post', 'entry', 'main', '正文', '内容', '文章'];
    for (const keyword of contentKeywords) {
      if (className.includes(keyword) || id.includes(keyword)) {
        score += 20;
      }
    }

    const noiseKeywords = ['nav', 'menu', 'sidebar', 'footer', 'header', '导航', '菜单', '侧边栏'];
    for (const keyword of noiseKeywords) {
      if (className.includes(keyword) || id.includes(keyword)) {
        score -= 30;
      }
    }

    return Math.max(0, score);
  }

  processMainContent(mainElement) {
    console.log('开始处理主要内容区域...');
    const elements = mainElement.querySelectorAll('p, h1, h2, h3, h4, h5, h6, article, section, div, span, li, ul, ol, blockquote, pre, table, tr, td, th');
    console.log(`找到 ${elements.length} 个候选元素`);
    
    const validElements = [];
    const textContent = [];

    elements.forEach((element, index) => {
      this.statistics.totalElements++;

      if (this.shouldSkipElement(element)) {
        this.statistics.filteredElements++;
        console.log(`元素 ${index}: 被shouldSkipElement过滤`);
        return;
      }

      const text = element.textContent.trim();
      console.log(`元素 ${index}: 文本长度=${text.length}`);
      
      if (text.length < this.config.minContentLength) {
        this.statistics.shortElements++;
        console.log(`元素 ${index}: 文本太短（${text.length} < ${this.config.minContentLength}），跳过`);
        return;
      }

      if (text.length > this.config.maxContentLength) {
        console.log(`元素 ${index}: 文本太长（${text.length} > ${this.config.maxContentLength}），跳过`);
        return;
      }

      if (!this.isUsefulContent(text)) {
        this.statistics.filteredElements++;
        console.log(`元素 ${index}: 不是有用内容，跳过`);
        return;
      }

      console.log(`元素 ${index}: 有效元素，添加到列表`);
      validElements.push({
        element: element,
        text: text,
        type: this.getElementType(element),
        position: this.getElementPosition(element)
      });

      textContent.push(text);
      this.statistics.validElements++;
    });

    console.log(`处理完成：有效元素=${validElements.length}，过滤元素=${this.statistics.filteredElements}`);
    
    return {
      text: textContent.join('\n\n'),
      elements: validElements
    };
  }

  shouldSkipElement(element) {
    const className = (element.className || '').toLowerCase();
    const id = (element.id || '').toLowerCase();
    const tagName = element.tagName.toLowerCase();

    // 直接过滤视频和iframe标签
    if (tagName === 'video' || tagName === 'iframe') {
      return true;
    }

    if (tagName === 'table' || tagName === 'tr' || tagName === 'td' || tagName === 'th') {
      this.statistics.noiseElements++;
      return true;
    }

    if (this.isAdElement(className, id)) {
      this.statistics.adElements++;
      return true;
    }

    if (this.isNoiseElement(className, id, tagName)) {
      this.statistics.noiseElements++;
      return true;
    }

    if (this.isVideoElement(className, id)) {
      return true;
    }

    if (this.isNavigationElement(className, id)) {
      return true;
    }

    if (this.isCatalogElement(className, id, tagName)) {
      this.statistics.noiseElements++;
      return true;
    }

    return false;
  }

  isAdElement(className, id) {
    if (!this.config.enableAdFiltering) {
      return false;
    }

    const adPatterns = [
      /\bad\b/,
      /\badvertisement\b/,
      /\bsponsored\b/,
      /推广/,
      /广告/,
      /\bads\b/,
      /\bbanner-ad\b/,
      /\bpromotion-box\b/,
      /\bsponsor\b/,
      /\bpromoted\b/,
      /\bpaid\b/,
      /\badvert\b/,
      /\bcommercial\b/,
      /赞助商/,
      /合作推广/,
      /广告投放/,
      /adsense/,
      /doubleclick/,
      /ad-zone/,
      /ad-container/,
      /ad-wrapper/,
      /advertising/,
      /ad-placement/
    ];

    for (const pattern of adPatterns) {
      if (pattern.test(className) || pattern.test(id)) {
        return true;
      }
    }

    return false;
  }

  isNoiseElement(className, id, tagName) {
    if (!this.config.enableNoiseFiltering) {
      return false;
    }

    const noisePatterns = [
      /\bnav\b/,
      /\bnavigation\b/,
      /\bmenu\b/,
      /\bsidebar\b/,
      /\bfooter\b/,
      /\bheader\b/,
      /导航/,
      /菜单/,
      /侧边栏/,
      /\blogin\b/,
      /\bregister\b/,
      /登录/,
      /注册/,
      /\bwidget\b/,
      /\bshare\b/,
      /\bsocial\b/,
      /\bcomment\b/,
      /\brelated\b/,
      /\brecommended\b/,
      /\bfooter\b/,
      /\bheader\b/,
      /\bcopyright\b/,
      /\bterms\b/,
      /\bpolicy\b/,
      /\bprivacy\b/,
      /\bsitemap\b/,
      /\bcontact\b/,
      /\babout\b/,
      /\bauthor\b/,
      /\bprofile\b/,
      /\bfollow\b/,
      /\bsubscribe\b/,
      /\bnewsletter\b/,
      /\bsearch\b/,
      /\bsearch-results\b/,
      /\bpagination\b/,
      /\bbreadcrumb\b/,
      /\btoc\b/,
      /\btable-of-contents\b/,
      /分享/,
      /社交/,
      /评论/,
      /相关/,
      /推荐/,
      /版权/,
      /条款/,
      /政策/,
      /隐私/,
      /站点地图/,
      /联系/,
      /关于/,
      /作者/,
      /个人资料/,
      /关注/,
      /订阅/,
      /搜索/,
      /分页/,
      /面包屑/,
      /目录/,
      /\btoc\b/,
      /\bbreadcrumb\b/,
      /\bpagination\b/,
      /目录/,
      /面包屑/,
      /分页/
    ];

    for (const pattern of noisePatterns) {
      if (pattern.test(className) || pattern.test(id)) {
        return true;
      }
    }

    if (tagName === 'aside' || tagName === 'nav') {
      return true;
    }

    return false;
  }

  isVideoElement(className, id) {
    const videoPatterns = [
      /\bvideo\b/,
      /\bplayer\b/,
      /播放器/,
      /视频播放/,
      /\byoutube\b/,
      /\bvimeo\b/,
      /\bembed\b/,
      /\biframe\b/,
      /\bmp4\b/,
      /\bavi\b/,
      /\bwmv\b/,
      /\bflv\b/,
      /\bmov\b/,
      /视频/,
      /播放/,
      /时长/,
      /watch/,
      /播放量/,
      /观看次数/,
      /订阅/,
      /粉丝/,
      /点赞/,
      /投币/,
      /收藏/
    ];
    
    for (const pattern of videoPatterns) {
      if (pattern.test(className) || pattern.test(id)) {
        return true;
      }
    }

    return false;
  }

  isNavigationElement(className, id) {
    const navPatterns = [
      /\bnav\b/,
      /\bnavigation\b/,
      /\bmenu\b/,
      /\bsidebar\b/,
      /\bfooter-nav\b/,
      /\bheader-nav\b/
    ];
    
    for (const pattern of navPatterns) {
      if (pattern.test(className) || pattern.test(id)) {
        return true;
      }
    }

    return false;
  }

  isCatalogElement(className, id, tagName) {
    const catalogPatterns = [
      /\bcatalog\b/,
      /\btoc\b/,
      /\btable-of-contents\b/,
      /\bindex\b/,
      /\blist\b/,
      /\bsummary\b/,
      /目录/,
      /索引/,
      /列表/,
      /摘要/
    ];

    for (const pattern of catalogPatterns) {
      if (pattern.test(className) || pattern.test(id)) {
        return true;
      }
    }

    if (className.includes('para') && className.includes('catalog')) {
      return true;
    }

    return false;
  }

  isUsefulContent(text) {
    if (text.length < this.config.minContentLength) {
      return false;
    }

    if (/^[\d\s\.\,\-\+\*\/\=\(\)\[\]\{\}]+$/.test(text)) {
      return false;
    }

    if (/^[\u4e00-\u9fa5]{1,2}$/.test(text)) {
      return false;
    }

    if (text.length < 20 && /^\d{1,2}:\d{2}$/.test(text.trim())) {
      return false;
    }

    return true;
  }

  getElementType(element) {
    const tagName = element.tagName ? element.tagName.toLowerCase() : '';

    if (/^h[1-6]$/.test(tagName)) {
      return 'heading';
    }

    if (tagName === 'code' || tagName === 'pre') {
      return 'code';
    }

    if (tagName === 'blockquote') {
      return 'quote';
    }

    if (tagName === 'ul' || tagName === 'ol') {
      return 'list';
    }

    if (tagName === 'p') {
      return 'paragraph';
    }

    return 'text';
  }

  getElementPosition(element) {
    const rect = element.getBoundingClientRect();
    return {
      top: rect.top + window.pageYOffset,
      left: rect.left + window.pageXOffset,
      width: rect.width,
      height: rect.height
    };
  }

  getStatistics() {
    return { ...this.statistics };
  }

  resetStatistics() {
    this.statistics = {
      totalElements: 0,
      validElements: 0,
      filteredElements: 0,
      adElements: 0,
      noiseElements: 0,
      shortElements: 0
    };
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig() {
    return { ...this.config };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SmartContentExtractor;
}
