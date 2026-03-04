class ContentDeduplication {
  constructor(config = {}) {
    this.config = {
      similarityThreshold: config.similarityThreshold || 0.85,
      enableFuzzyMatching: config.enableFuzzyMatching !== false,
      enableCache: config.enableCache !== false,
      cacheSize: config.cacheSize || 10000,
      fingerprintAlgorithm: config.fingerprintAlgorithm || 'simhash',
      ...config
    };

    this.contentCache = new Map();
    this.fingerprintCache = new Map();
    this.processedContent = new Set();
    this.statistics = {
      totalProcessed: 0,
      duplicatesFound: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
  }

  generateFingerprint(content) {
    if (!content || typeof content !== 'string') {
      return null;
    }

    const normalized = this.normalizeContent(content);
    
    switch (this.config.fingerprintAlgorithm) {
      case 'simhash':
        return this.simhash(normalized);
      case 'minhash':
        return this.minhash(normalized);
      case 'md5':
        return this.md5Hash(normalized);
      default:
        return this.simhash(normalized);
    }
  }

  normalizeContent(content) {
    return content
      .replace(/\s+/g, ' ')
      .replace(/[\r\n\t]/g, ' ')
      .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '')
      .toLowerCase()
      .trim();
  }

  simhash(content) {
    const hashBits = 64;
    const shingles = this.generateShingles(content, 3);
    const hashValues = shingles.map(shingle => this.hashString(shingle));
    
    const fingerprint = new Array(hashBits).fill(0);
    
    hashValues.forEach(hash => {
      for (let i = 0; i < hashBits; i++) {
        if ((hash >> i) & 1) {
          fingerprint[i]++;
        } else {
          fingerprint[i]--;
        }
      }
    });
    
    return fingerprint.map(bit => bit > 0 ? 1 : 0).join('');
  }

  minhash(content) {
    const numHashes = 128;
    const shingles = this.generateShingles(content, 3);
    
    const minHashValues = new Array(numHashes).fill(Infinity);
    
    shingles.forEach(shingle => {
      for (let i = 0; i < numHashes; i++) {
        const hash = this.hashString(shingle + i);
        if (hash < minHashValues[i]) {
          minHashValues[i] = hash;
        }
      }
    });
    
    return minHashValues.join(',');
  }

  generateShingles(content, k) {
    const shingles = [];
    for (let i = 0; i <= content.length - k; i++) {
      shingles.push(content.substring(i, i + k));
    }
    return shingles;
  }

  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  md5Hash(content) {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `md5_${Math.abs(hash).toString(16)}`;
  }

  calculateSimilarity(fingerprint1, fingerprint2) {
    if (this.config.fingerprintAlgorithm === 'simhash') {
      return this.hammingDistance(fingerprint1, fingerprint2);
    } else if (this.config.fingerprintAlgorithm === 'minhash') {
      return this.jaccardSimilarity(fingerprint1, fingerprint2);
    } else {
      return fingerprint1 === fingerprint2 ? 1 : 0;
    }
  }

  hammingDistance(str1, str2) {
    if (str1.length !== str2.length) {
      return 0;
    }
    
    let distance = 0;
    for (let i = 0; i < str1.length; i++) {
      if (str1[i] !== str2[i]) {
        distance++;
      }
    }
    
    return 1 - (distance / str1.length);
  }

  jaccardSimilarity(str1, str2) {
    const set1 = new Set(str1.split(','));
    const set2 = new Set(str2.split(','));
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  isDuplicate(content, existingFingerprints = []) {
    if (!content || content.trim().length === 0) {
      return { isDuplicate: false, similarity: 0 };
    }

    const fingerprint = this.generateFingerprint(content);
    
    if (!fingerprint) {
      return { isDuplicate: false, similarity: 0 };
    }

    if (this.config.enableCache) {
      const cachedResult = this.checkCache(fingerprint);
      if (cachedResult !== null) {
        this.statistics.cacheHits++;
        return cachedResult;
      }
      this.statistics.cacheMisses++;
    }

    for (const existingFingerprint of existingFingerprints) {
      const similarity = this.calculateSimilarity(fingerprint, existingFingerprint);
      
      if (similarity >= this.config.similarityThreshold) {
        const result = { isDuplicate: true, similarity };
        
        if (this.config.enableCache) {
          this.addToCache(fingerprint, result);
        }
        
        return result;
      }
    }

    const result = { isDuplicate: false, similarity: 0 };
    
    if (this.config.enableCache) {
      this.addToCache(fingerprint, result);
    }
    
    return result;
  }

  checkCache(fingerprint) {
    if (this.fingerprintCache.has(fingerprint)) {
      return this.fingerprintCache.get(fingerprint);
    }
    return null;
  }

  addToCache(fingerprint, result) {
    if (this.fingerprintCache.size >= this.config.cacheSize) {
      const firstKey = this.fingerprintCache.keys().next().value;
      this.fingerprintCache.delete(firstKey);
    }
    
    this.fingerprintCache.set(fingerprint, result);
  }

  processContent(content, existingFingerprints = []) {
    this.statistics.totalProcessed++;
    
    const result = this.isDuplicate(content, existingFingerprints);
    
    if (result.isDuplicate) {
      this.statistics.duplicatesFound++;
      return { isDuplicate: true, ...result };
    }
    
    const fingerprint = this.generateFingerprint(content);
    this.processedContent.add(fingerprint);
    
    return { isDuplicate: false, fingerprint, ...result };
  }

  batchProcess(contents, existingFingerprints = []) {
    const results = [];
    
    contents.forEach(content => {
      const result = this.processContent(content, existingFingerprints);
      results.push(result);
      
      if (!result.isDuplicate && result.fingerprint) {
        existingFingerprints.push(result.fingerprint);
      }
    });
    
    return results;
  }

  getStatistics() {
    return { ...this.statistics };
  }

  resetStatistics() {
    this.statistics = {
      totalProcessed: 0,
      duplicatesFound: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
  }

  clearCache() {
    this.contentCache.clear();
    this.fingerprintCache.clear();
    this.processedContent.clear();
  }

  exportCache() {
    return {
      fingerprints: Array.from(this.fingerprintCache.entries()),
      statistics: this.statistics
    };
  }

  importCache(cacheData) {
    if (cacheData.fingerprints) {
      this.fingerprintCache = new Map(cacheData.fingerprints);
    }
    
    if (cacheData.statistics) {
      this.statistics = cacheData.statistics;
    }
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig() {
    return { ...this.config };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ContentDeduplication;
}
