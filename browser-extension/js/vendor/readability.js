class Readability {
  constructor(document) {
    this.document = document;
    this.options = {
      charThreshold: 100,
      classesToPreserve: []
    };
  }

  parse() {
    const article = this.getArticle();
    return {
      title: this.getTitle(),
      content: article ? article.innerHTML : '',
      textContent: article ? article.textContent : ''
    };
  }

  getTitle() {
    let title = '';
    const titleElement = this.document.querySelector('title');
    if (titleElement) {
      title = titleElement.textContent;
    }
    return title;
  }

  getArticle() {
    const candidates = this.getCandidateElements();
    let bestCandidate = null;
    let maxScore = 0;

    candidates.forEach(candidate => {
      const score = this.scoreElement(candidate);
      if (score > maxScore) {
        maxScore = score;
        bestCandidate = candidate;
      }
    });

    return bestCandidate;
  }

  getCandidateElements() {
    const candidates = [];
    const elements = this.document.querySelectorAll('article, div, section');

    elements.forEach(element => {
      if (element.textContent.length > this.options.charThreshold) {
        candidates.push(element);
      }
    });

    return candidates;
  }

  scoreElement(element) {
    let score = 0;

    if (element.tagName.toLowerCase() === 'article') {
      score += 30;
    }

    if (element.className && (element.className.includes('article') || element.className.includes('content'))) {
      score += 20;
    }

    if (element.id && (element.id.includes('article') || element.id.includes('content'))) {
      score += 20;
    }

    score += element.textContent.length / 100;

    return score;
  }
}

if (typeof window !== 'undefined') {
  window.Readability = Readability;
}