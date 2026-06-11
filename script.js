const app = {
  quotes: [],
  authors: AUTHORS_DATA,
  categories: CATEGORIES,
  favorites: new Set(),
  history: [],
  currentQuoteIndex: 0,
  currentAuthorIndex: 0,
  currentQuoteId: 0,
  leaderboard: {},
  onlineUsers: new Map(),
  username: 'Anonymous',
  debounceTimer: null,
  chatMessages: [],
  broadcastChannel: null,

  init() {
    this.loadData();
    this.setupTheme();
    this.setupEventListeners();
    this.populateCategories();
    this.generateQuotes();
    this.randomQuote();
    this.renderStats();
    this.loadLeaderboard();
    this.setupBroadcast();
    this.loadUsername();
    this.simulateOnlineUsers();
  },

  setupBroadcast() {
    try {
      this.broadcastChannel = new BroadcastChannel('inspireflow_chat');
      this.broadcastChannel.onmessage = (e) => {
        const { type, data } = e.data;
        if (type === 'user_online') {
          this.onlineUsers.set(data.username, data);
          this.renderOnlineUsers();
        } else if (type === 'chat_message') {
          this.chatMessages.push(data);
          this.renderChatMessages();
        } else if (type === 'user_offline') {
          this.onlineUsers.delete(data.username);
          this.renderOnlineUsers();
        }
      };
      this.broadcastOnline();
      window.addEventListener('beforeunload', () => this.broadcastOffline());
    } catch (e) {
      console.log('BroadcastChannel not supported, using localStorage fallback');
      setInterval(() => this.syncWithLocalStorage(), 1000);
    }
  },

  syncWithLocalStorage() {
    const stored = localStorage.getItem('online_chat');
    const data = stored ? JSON.parse(stored) : { users: {}, messages: [] };
    data.users[this.username] = { username: this.username, time: new Date().toLocaleTimeString() };
    localStorage.setItem('online_chat', JSON.stringify(data));
  },

  broadcastOnline() {
    const msg = {
      type: 'user_online',
      data: { username: this.username, time: new Date().toLocaleTimeString(), id: Math.random() }
    };
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage(msg);
    }
    this.onlineUsers.set(this.username, msg.data);
    this.renderOnlineUsers();
  },

  broadcastOffline() {
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({
        type: 'user_offline',
        data: { username: this.username }
      });
    }
    this.onlineUsers.delete(this.username);
  },

  loadData() {
    const saved = localStorage.getItem('favorites');
    if (saved) this.favorites = new Set(JSON.parse(saved));
    
    const hist = localStorage.getItem('history');
    if (hist) this.history = JSON.parse(hist).slice(-50);
    
    const lb = localStorage.getItem('leaderboard');
    if (lb) this.leaderboard = JSON.parse(lb);
    
    const user = localStorage.getItem('username');
    if (user) this.username = user;
    
    const msgs = localStorage.getItem('chat_messages');
    if (msgs) this.chatMessages = JSON.parse(msgs).slice(-100);
  },

  generateQuotes() {
    let id = 0;
    CATEGORIES.forEach(cat => {
      QUOTES_DATA[cat].forEach(text => {
        this.quotes.push({ text, category: cat, id });
        id++;
      });
    });
  },

  setupTheme() {
    const toggle = document.getElementById('themeToggle');
    toggle.addEventListener('click', () => this.toggleTheme());
    
    const saved = localStorage.getItem('theme');
    if (saved) document.documentElement.setAttribute('data-theme', saved);
  },

  setupEventListeners() {
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') this.closeModals();
      if (e.key === 'Enter' && document.getElementById('messageInput') === document.activeElement) {
        this.sendMessage();
      }
    });
  },

  populateCategories() {
    const select = document.getElementById('quoteCategoryFilter');
    CATEGORIES.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat;
      option.textContent = cat;
      select.appendChild(option);
    });
  },

  randomQuote() {
    const q = this.quotes[Math.floor(Math.random() * this.quotes.length)];
    const author = this.authors[Math.floor(Math.random() * this.authors.length)];
    this.displayQuote(q, author);
  },

  nextQuote() {
    this.currentQuoteIndex = (this.currentQuoteIndex + 1) % this.quotes.length;
    this.displayQuote(this.quotes[this.currentQuoteIndex], this.authors[Math.floor(Math.random() * this.authors.length)]);
  },

  prevQuote() {
    this.currentQuoteIndex = (this.currentQuoteIndex - 1 + this.quotes.length) % this.quotes.length;
    this.displayQuote(this.quotes[this.currentQuoteIndex], this.authors[Math.floor(Math.random() * this.authors.length)]);
  },

  displayQuote(q, author) {
    document.getElementById('quoteText').textContent = q.text;
    document.getElementById('authorName').textContent = author.name;
    document.getElementById('authorProfession').textContent = author.profession;
    document.getElementById('categoryBadge').textContent = q.category;
    document.getElementById('aboutAuthor').textContent = `${author.name} (${author.birth}–${author.death}) from ${author.country}`;
    document.getElementById('authorPhoto').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(author.name)}&size=130&background=246b6b&color=fff&bold=true`;
    document.getElementById('authorPhoto').alt = author.name;
    this.currentQuoteId = q.id;
    this.updateFavBtn();
  },

  updateFavBtn() {
    const btn = document.getElementById('favBtn');
    btn.innerHTML = this.favorites.has(this.currentQuoteId) ? '♥ Fav' : '♡ Fav';
  },

  toggleFavorite() {
    const btn = document.getElementById('favBtn');
    if (this.favorites.has(this.currentQuoteId)) {
      this.favorites.delete(this.currentQuoteId);
      btn.innerHTML = '♡ Fav';
    } else {
      this.favorites.add(this.currentQuoteId);
      btn.innerHTML = '♥ Fav';
    }
    localStorage.setItem('favorites', JSON.stringify(Array.from(this.favorites)));
    btn.classList.add('heart-beat');
    setTimeout(() => btn.classList.remove('heart-beat'), 400);
  },

  copyQuote() {
    const text = document.getElementById('quoteText').textContent;
    const author = document.getElementById('authorName').textContent;
    navigator.clipboard.writeText(`"${text}" — ${author}`).then(() => this.showToast('✓ Copied!'));
  },

  shareQuote() {
    const text = document.getElementById('quoteText').textContent;
    const author = document.getElementById('authorName').textContent;
    if (navigator.share) {
      navigator.share({ title: 'InspireFlow', text: `"${text}" — ${author}` }).catch(() => {});
    } else {
      this.copyQuote();
    }
  },

  downloadImage() {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#246b6b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px Arial';
    const text = document.getElementById('quoteText').textContent;
    const lines = text.match(/.{1,50}/g) || [text];
    let y = 100;
    lines.slice(0, 6).forEach(line => {
      ctx.fillText(line, 50, y);
      y += 40;
    });
    ctx.font = 'italic 20px Arial';
    ctx.fillText(`— ${document.getElementById('authorName').textContent}`, 50, y + 40);
    const link = document.createElement('a');
    link.href = canvas.toDataURL();
    link.download = 'quote.png';
    link.click();
  },

  showHistory() {
    const modal = document.getElementById('historyModal');
    const content = document.getElementById('historyModalContent');
    let html = '<button class="modal-close" onclick="app.closeModals()">×</button><h2>⏱️ History</h2>';
    if (this.history.length === 0) {
      html += '<p class="empty-state">No history yet</p>';
    } else {
      this.history.slice().reverse().forEach(q => {
        html += `<div class='glass-card quote-list-card'><p>${q.text}</p><small>${q.category}</small></div>`;
      });
    }
    content.innerHTML = html;
    modal.classList.add('visible');
  },

  debounceSearch() {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.performQuoteSearch(), 300);
  },

  performQuoteSearch() {
    const search = document.getElementById('quoteSearch').value.toLowerCase();
    const cat = document.getElementById('quoteCategoryFilter').value;
    const res = document.getElementById('quoteSearchResults');
    if (!search && !cat) {
      res.innerHTML = '';
      return;
    }
    let filtered = this.quotes.filter(q => {
      if (cat && q.category !== cat) return false;
      if (search && !q.text.toLowerCase().includes(search)) return false;
      return true;
    }).slice(0, 50);
    res.innerHTML = filtered.map(q => `<div class="glass-card quote-list-card"><p>${q.text}</p><small>${q.category}</small></div>`).join('');
  },

  renderAuthors() {
    const search = document.getElementById('authorSearch').value.toLowerCase();
    const country = document.getElementById('authorCountryFilter').value;
    let filtered = this.authors.filter(a => {
      if (search && !a.name.toLowerCase().includes(search)) return false;
      if (country && a.country !== country) return false;
      return true;
    });
    const countries = new Set(this.authors.map(a => a.country));
    document.getElementById('authorCountryFilter').innerHTML = '<option value="">All Countries</option>' + Array.from(countries).sort().map(c => `<option value="${c}">${c}</option>`).join('');
    document.getElementById('authorsCountLabel').textContent = `${filtered.length} authors`;
    document.getElementById('authorsGrid').innerHTML = filtered.map(a => `
      <div class="glass-card author-card" onclick="app.showAuthorModal('${a.name.replace(/'/g, "\\'")}')"><img class="author-photo-lg" src="https://ui-avatars.com/api/?name=${encodeURIComponent(a.name)}&size=130&background=246b6b&color=fff&bold=true" alt="${a.name}" loading="lazy"><h3>${a.name}</h3><div class="meta">${a.profession}</div><div class="meta">${a.country}</div></div>
    `).join('');
  },

  showAuthorModal(name) {
    const author = this.authors.find(a => a.name === name);
    if (!author) return;
    const modal = document.getElementById('authorModal');
    const content = document.getElementById('authorModalContent');
    let html = `<button class="modal-close" onclick="app.closeModals()">×</button><img class="author-photo-lg" src="https://ui-avatars.com/api/?name=${encodeURIComponent(author.name)}&size=200&background=246b6b&color=fff&bold=true" alt="${author.name}"><h2>${author.name}</h2><p class="about-author"><strong>${author.profession}</strong> from ${author.country}</p><p class="about-author">Years: ${author.birth}–${author.death}</p>`;
    const relatedQuotes = this.quotes.filter(q => {
      const authorQuotes = this.quotes.filter(qq => qq.category === CATEGORIES.find(cat => QUOTES_DATA[cat].includes(q.text)));
      return authorQuotes.length > 0;
    }).slice(0, 10);
    if (relatedQuotes.length > 0) {
      html += `<div style='margin-top:1rem'><h3>Related Quotes</h3><div class='quote-list'>${relatedQuotes.map(q => `<div class='glass-card quote-list-card'><p>${q.text}</p></div>`).join('')}</div></div>`;
    }
    content.innerHTML = html;
    modal.classList.add('visible');
  },

  renderCategories() {
    const search = document.getElementById('categorySearch').value.toLowerCase();
    let filtered = CATEGORIES.filter(c => c.toLowerCase().includes(search));
    document.getElementById('categoriesCountLabel').textContent = `${filtered.length}`;
    document.getElementById('categoriesGrid').innerHTML = filtered.map(c => `
      <div class="glass-card author-card" onclick="app.showCategoryQuotes('${c}')"><div style='font-size:2.5rem;margin-bottom:0.5rem'>📚</div><h3>${c}</h3></div>
    `).join('');
  },

  showCategoryQuotes(cat) {
    const modal = document.getElementById('historyModal');
    const content = document.getElementById('historyModalContent');
    const qts = this.quotes.filter(q => q.category === cat);
    let html = `<button class="modal-close" onclick="app.closeModals()">×</button><h2>${cat}</h2><div class='quote-list'>`;
    html += qts.slice(0, 50).map(q => `<div class='glass-card quote-list-card'><p>${q.text}</p><small>${q.category}</small></div>`).join('');
    html += '</div>';
    content.innerHTML = html;
    modal.classList.add('visible');
  },

  renderFavorites() {
    const container = document.getElementById('favoritesContainer');
    const fav = this.quotes.filter(q => this.favorites.has(q.id));
    document.getElementById('favoritesCountLabel').textContent = `${fav.length} saved`;
    container.innerHTML = fav.length ? fav.map(q => `<div class='glass-card quote-list-card'><p>${q.text}</p><small>${q.category}</small></div>`).join('') : '<p class="empty-state">No favorites yet</p>';
  },

  renderStats() {
    const container = document.getElementById('statsContainer');
    const totalQ = this.quotes.length;
    const totalA = this.authors.length;
    const totalC = this.categories.length;
    container.innerHTML = `
      <div class="glass-card stat-panel"><h3>📊 Total Quotes</h3><p style="font-size:1.8rem;font-weight:800;color:var(--accent)">${totalQ}</p></div>
      <div class="glass-card stat-panel"><h3>👥 Authors</h3><p style="font-size:1.8rem;font-weight:800;color:var(--accent2)">${totalA}</p></div>
      <div class="glass-card stat-panel"><h3>📚 Categories</h3><p style="font-size:1.8rem;font-weight:800;color:var(--accent3)">${totalC}</p></div>
      <div class="glass-card stat-panel"><h3>❤️ Favorites</h3><p style="font-size:1.8rem;font-weight:800;color:#2e7d56">${this.favorites.size}</p></div>
    `;
    document.getElementById('quoteCounter').textContent = totalQ;
    document.getElementById('authorCounter').textContent = totalA;
    document.getElementById('categoryCounter').textContent = totalC;
  },

  loadLeaderboard() {
    const topUsers = document.getElementById('topUsers');
    const userRank = document.getElementById('userRank');
    const sorted = Object.entries(this.leaderboard).sort((a, b) => b[1] - a[1]).slice(0, 10);
    topUsers.innerHTML = sorted.map((entry, i) => `<p>${i + 1}. <strong>${entry[0]}</strong> - ${entry[1]} quotes</p>`).join('') || '<p class="empty-state">No data yet</p>';
    userRank.innerHTML = `<strong>${this.username}</strong><br>${this.leaderboard[this.username] || 0} quotes viewed`;
  },

  simulateOnlineUsers() {
    this.renderOnlineUsers();
  },

  renderOnlineUsers() {
    const container = document.getElementById('onlineUsersList');
    if (this.onlineUsers.size === 0) {
      container.innerHTML = '<p class="empty-state">No users online</p>';
      return;
    }
    container.innerHTML = Array.from(this.onlineUsers.values()).map(u => `<div class='quote-list-card'><strong>🟢 ${u.username}</strong><small>${u.time}</small></div>`).join('');
  },

  renderChatMessages() {
    const container = document.getElementById('chatMessages');
    container.innerHTML = this.chatMessages.map((msg, i) => `
      <div class='quote-list-card' style='${msg.username === this.username ? 'background: rgba(36, 107, 107, 0.2); border-left: 3px solid var(--accent);' : ''}'>  
        <strong>${msg.username}:</strong> ${msg.text}
        <small>${msg.time}</small>
      </div>
    `).join('');
    container.scrollTop = container.scrollHeight;
  },

  setUsername() {
    const input = document.getElementById('usernameInput');
    const username = input.value.trim();
    if (username && username.length > 0 && username.length < 30) {
      this.username = username;
      localStorage.setItem('username', username);
      document.getElementById('currentUsername').textContent = username;
      input.value = '';
      this.showToast(`✓ Username set to ${username}`);
      this.broadcastOnline();
      this.loadLeaderboard();
    } else {
      this.showToast('Username must be 1-30 characters');
    }
  },

  sendMessage() {
    const input = document.getElementById('messageInput');
    const msg = input.value.trim();
    if (msg && msg.length > 0 && msg.length < 500) {
      const messageObj = {
        username: this.username,
        text: msg,
        time: new Date().toLocaleTimeString(),
        id: Date.now()
      };
      this.chatMessages.push(messageObj);
      this.chatMessages = this.chatMessages.slice(-100);
      localStorage.setItem('chat_messages', JSON.stringify(this.chatMessages));
      
      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage({
          type: 'chat_message',
          data: messageObj
        });
      }
      
      this.renderChatMessages();
      input.value = '';
      
      if (!this.leaderboard[this.username]) this.leaderboard[this.username] = 0;
      this.leaderboard[this.username]++;
      localStorage.setItem('leaderboard', JSON.stringify(this.leaderboard));
      this.loadLeaderboard();
    }
  },

  navigateTo(section) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-links button').forEach(b => b.classList.remove('active'));
    document.getElementById(`section-${section}`).classList.add('active');
    document.querySelector(`[data-nav="${section}"]`).classList.add('active');
    if (section === 'favorites') this.renderFavorites();
    if (section === 'authors') this.renderAuthors();
    if (section === 'categories') this.renderCategories();
    if (section === 'leaderboard') this.loadLeaderboard();
    if (section === 'online') {
      this.simulateOnlineUsers();
      this.renderChatMessages();
    }
    if (section === 'stats') this.renderStats();
  },

  toggleTheme() {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme') || 'light';
    const theme = current === 'light' ? 'dark' : 'light';
    html.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  },

  showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.style.opacity = '1';
    setTimeout(() => toast.style.opacity = '0', 2500);
  },

  closeModals() {
    document.getElementById('authorModal').classList.remove('visible');
    document.getElementById('historyModal').classList.remove('visible');
  },

  loadUsername() {
    document.getElementById('currentUsername').textContent = this.username;
  }
};

document.addEventListener('DOMContentLoaded', () => app.init());