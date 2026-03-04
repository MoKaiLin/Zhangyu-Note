class LinkContentManager {
  constructor(config = {}) {
    this.config = {
      maxDepth: config.maxDepth || 1,
      crawlStrategy: config.crawlStrategy || 'breadth',
      timeout: config.timeout || 5000,
      maxRetries: config.maxRetries || 3,
      enableAsync: config.enableAsync !== false,
      batchSize: config.batchSize || 5,
      ...config
    };

    this.processedLinks = new Set();
    this.linkQueue = [];
    this.activeRequests = new Map();
    this.statistics = {
      totalLinks: 0,
      processedLinks: 0,
      skippedLinks: 0,
      failedLinks: 0,
      successLinks: 0
    };
  }

  shouldSkipLink(link) {
    if (!link || !link.href) {
      return true;
    }

    const href = link.href.toLowerCase();
    const text = (link.textContent || '').toLowerCase();

    const skipPatterns = [
      /^javascript:/i,
      /^mailto:/i,
      /^tel:/i,
      /^#/,
      /\.pdf$/i,
      /\.doc$/i,
      /\.xls$/i,
      /\.ppt$/i,
      /\.zip$/i,
      /\.rar$/i,
      /\.exe$/i,
      /\.dmg$/i
    ];

    for (const pattern of skipPatterns) {
      if (pattern.test(href)) {
        return true;
      }
    }

    const navigationKeywords = [
      '首页', 'home', 'index', 'main',
      '上一页', '下一页', 'prev', 'next', 'previous',
      '返回', 'back', '返回上一页',
      '更多', 'more', '查看更多',
      '相关', 'related', '相关推荐',
      '推荐', 'recommend', '推荐阅读',
      '热门', 'hot', 'popular',
      '最新', 'latest', 'new',
      '点击', 'click', '查看', 'view',
      '详情', 'detail', 'details',
      '阅读全文', 'read more', '继续阅读',
      '跳转', 'jump', 'go to',
      '链接', 'link', 'url',
      '百度百科', '贴吧', '知道', '网盘', '图片', '视频', '地图', '文库', '资讯', '采购',
      '编辑', '讨论', '收藏', '赞', '播报',
      '秒懂', '特色百科', '动态百科', '数字博物馆', '非遗百科', '艺术百科', '科学百科',
      '知识专题', '史记', '热词团', '繁星团', '蝌蚪团', '权威合作', '合作模式',
      '常见问题', '联系方式', '个人中心', '查看全部', '奇闻异事'
    ];

    for (const keyword of navigationKeywords) {
      if (text.includes(keyword) || href.includes(keyword)) {
        return true;
      }
    }

    return false;
  }

  extractLinks(element) {
    const links = element.querySelectorAll('a');
    const validLinks = [];

    links.forEach(link => {
      if (this.shouldSkipLink(link)) {
        this.statistics.skippedLinks++;
        return;
      }

      const linkData = {
        href: link.href,
        text: link.textContent.trim(),
        title: link.getAttribute('title') || '',
        rel: link.getAttribute('rel') || '',
        target: link.getAttribute('target') || ''
      };

      const linkId = this.generateLinkId(linkData);
      
      if (!this.processedLinks.has(linkId)) {
        validLinks.push(linkData);
        this.processedLinks.add(linkId);
      }
    });

    return validLinks;
  }

  generateLinkId(linkData) {
    return `${linkData.href}|${linkData.text}`;
  }

  async processLinks(links, depth = 0) {
    if (depth >= this.config.maxDepth) {
      return [];
    }

    const results = [];

    if (this.config.crawlStrategy === 'breadth') {
      const batches = this.createBatches(links, this.config.batchSize);
      
      for (const batch of batches) {
        const batchResults = await this.processBatch(batch, depth);
        results.push(...batchResults);
      }
    } else {
      for (const link of links) {
        const result = await this.processLink(link, depth);
        results.push(result);
      }
    }

    return results;
  }

  createBatches(items, batchSize) {
    const batches = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  async processBatch(batch, depth) {
    if (!this.config.enableAsync) {
      const results = [];
      for (const link of batch) {
        const result = await this.processLink(link, depth);
        results.push(result);
      }
      return results;
    }

    const promises = batch.map(link => this.processLink(link, depth));
    return Promise.all(promises);
  }

  async processLink(link, depth) {
    const linkId = this.generateLinkId(link);
    
    if (this.activeRequests.has(linkId)) {
      return { success: false, reason: 'already_processing', link };
    }

    this.statistics.totalLinks++;

    try {
      this.activeRequests.set(linkId, true);
      
      const result = await this.fetchLinkContent(link, depth);
      
      if (result.success) {
        this.statistics.successLinks++;
      } else {
        this.statistics.failedLinks++;
      }
      
      this.statistics.processedLinks++;
      
      return result;
    } catch (error) {
      this.statistics.failedLinks++;
      return { success: false, error: error.message, link };
    } finally {
      this.activeRequests.delete(linkId);
    }
  }

  async fetchLinkContent(link, depth) {
    let retries = 0;
    let lastError = null;

    while (retries < this.config.maxRetries) {
      try {
        const result = await this.fetchWithTimeout(link.href, this.config.timeout);
        
        if (result.success) {
          const content = this.extractMainContent(result.content);
          const subLinks = depth < this.config.maxDepth - 1 ? 
            this.extractLinks(this.parseHTML(result.content)) : [];
          
          return {
            success: true,
            link: link,
            content: content,
            subLinks: subLinks,
            depth: depth + 1
          };
        }
      } catch (error) {
        lastError = error;
        retries++;
        
        if (retries < this.config.maxRetries) {
          await this.delay(1000 * retries);
        }
      }
    }

    return {
      success: false,
      error: lastError?.message || 'Unknown error',
      link: link
    };
  }

  async fetchWithTimeout(url, timeout) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Request timeout after ${timeout}ms`));
      }, timeout);

      fetch(url)
        .then(response => {
          clearTimeout(timeoutId);
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          return response.text();
        })
        .then(content => {
          resolve({ success: true, content });
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  parseHTML(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    return doc.body;
  }

  extractMainContent(element) {
    const mainSelectors = [
      '.mainContent',
      '.main-content',
      '.article-content',
      '.post-content',
      '.entry-content',
      '.content-body',
      'article',
      'main',
      '[role="main"]',
      '#content',
      '#main',
      '#article',
      '.content'
    ];

    let mainElement = null;
    
    for (const selector of mainSelectors) {
      mainElement = element.querySelector(selector);
      if (mainElement) {
        break;
      }
    }

    if (!mainElement) {
      mainElement = element;
    }

    return this.extractTextContent(mainElement);
  }

  extractTextContent(element) {
    const textElements = element.querySelectorAll('p, h1, h2, h3, h4, h5, h6, article, section, div');
    const texts = [];

    textElements.forEach(el => {
      const text = el.textContent.trim();
      if (text.length > 10) {
        texts.push(text);
      }
    });

    return texts.join('\n\n');
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getStatistics() {
    return { ...this.statistics };
  }

  resetStatistics() {
    this.statistics = {
      totalLinks: 0,
      processedLinks: 0,
      skippedLinks: 0,
      failedLinks: 0,
      successLinks: 0
    };
  }

  clearProcessedLinks() {
    this.processedLinks.clear();
    this.linkQueue = [];
    this.activeRequests.clear();
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig() {
    return { ...this.config };
  }

  cancelAllRequests() {
    this.activeRequests.forEach((_, linkId) => {
      this.activeRequests.delete(linkId);
    });
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = LinkContentManager;
}
