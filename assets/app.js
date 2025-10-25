// 简易现代化客户端阅读器（依赖 marked & highlight.js）
(() => {
  const booksContainer = document.getElementById('books');
  const bookTitleEl = document.getElementById('book-title');
  const chapterTitleEl = document.getElementById('chapter-title');
  const contentEl = document.getElementById('content');
  const progressEl = document.getElementById('progress');
  const searchInput = document.getElementById('search');

  let state = {
    books: [],
    currentBook: null,
    currentChapterIndex: 0,
    fontSize: 16
  };

  // 初始化 marked 与 highlight
  marked.setOptions({
    breaks: true,
    highlight: function(code, lang) {
      try { return hljs.highlightAuto(code, lang ? [lang] : undefined).value; }
      catch (e) { return code; }
    }
  });

  // 从 books.json 加载书目（请把 books.json 放到仓库根）
  async function loadBooks() {
    try {
      const res = await fetch('books.json');
      if (!res.ok) throw new Error('books.json not found');
      const json = await res.json();
      state.books = json.books || [];
      renderBooks(state.books);
    } catch (e) {
      booksContainer.innerHTML = `<div class="text-sm text-red-500">加载书目失败：${e.message}</div>`;
      console.error(e);
    }
  }

  function renderBooks(list) {
    if (!list.length) {
      booksContainer.innerHTML = `<div class="text-sm text-gray-500">未找到书籍。</div>`;
      return;
    }
    booksContainer.innerHTML = '';
    list.forEach((book, bi) => {
      const card = document.createElement('div');
      card.className = 'p-2 border rounded';
      card.innerHTML = `
        <div class="flex items-start gap-3">
          <img src="${book.cover || 'https://via.placeholder.com/80x110?text=封面'}" alt="" class="w-16 h-20 object-cover rounded">
          <div class="flex-1">
            <div class="font-medium">${book.title}</div>
            <div class="text-xs text-gray-500">${book.author || ''}</div>
            <div class="mt-2 text-sm space-y-1" id="chap-list-${bi}"></div>
          </div>
        </div>`;
      booksContainer.appendChild(card);

      const chapListEl = card.querySelector(`#chap-list-${bi}`);
      book.chapters.forEach((chap, ci) => {
        const a = document.createElement('a');
        a.href = '#';
        a.className = 'block text-sm hover:underline';
        a.textContent = `${String(ci+1).padStart(2,'0')} ${chap.title}`;
        a.onclick = (ev) => { ev.preventDefault(); openChapter(bi, ci); };
        chapListEl.appendChild(a);
      });
    });
  }

  async function openChapter(bookIndex, chapIndex) {
    const book = state.books[bookIndex];
    if (!book) return;
    state.currentBook = book;
    state.currentChapterIndex = chapIndex;
    bookTitleEl.textContent = book.title;
    chapterTitleEl.textContent = book.chapters[chapIndex].title;

    // fetch markdown
    const mdPath = book.chapters[chapIndex].path;
    try {
      contentEl.innerHTML = `<p class="text-sm text-gray-400">加载中……</p>`;
      const res = await fetch(mdPath);
      if (!res.ok) throw new Error('章节加载失败');
      const md = await res.text();
      const html = marked.parse(md);
      contentEl.innerHTML = html;
      // highlight code blocks
      document.querySelectorAll('pre code').forEach((el) => hljs.highlightElement(el));
      // reset scroll
      window.scrollTo({ top: 0, behavior: 'auto' });
      updateProgress();
      // save last read
      saveProgress();
    } catch (e) {
      contentEl.innerHTML = `<div class="text-sm text-red-500">加载失败：${e.message}</div>`;
    }
  }

  // 上一章 / 下一章
  document.getElementById('prev-ch').addEventListener('click', ()=> {
    if (!state.currentBook) return;
    const idx = state.currentChapterIndex - 1;
    if (idx >= 0) openChapter(state.books.indexOf(state.currentBook), idx);
  });
  document.getElementById('next-ch').addEventListener('click', ()=> {
    if (!state.currentBook) return;
    const idx = state.currentChapterIndex + 1;
    if (idx < state.currentBook.chapters.length) openChapter(state.books.indexOf(state.currentBook), idx);
  });

  // 字号
  document.getElementById('inc-font').addEventListener('click', ()=> {
    state.fontSize = Math.min(22, state.fontSize + 1);
    contentEl.style.fontSize = state.fontSize + 'px';
    saveProgress();
  });
  document.getElementById('dec-font').addEventListener('click', ()=> {
    state.fontSize = Math.max(12, state.fontSize - 1);
    contentEl.style.fontSize = state.fontSize + 'px';
    saveProgress();
  });

  // 阅读模式
  document.getElementById('toggle-wide').addEventListener('click', ()=> {
    document.body.classList.toggle('read-mode');
  });

  // 书签（保存当前书-章）
  document.getElementById('bookmark').addEventListener('click', ()=> {
    if (!state.currentBook) return alert('请先打开章节');
    const key = 'xiaoshuo_bookmark';
    const payload = {
      book: state.currentBook.slug || state.currentBook.title,
      chapter: state.currentChapterIndex
    };
    localStorage.setItem(key, JSON.stringify(payload));
    alert('已保存书签');
  });

  // 简易主题切换（夜间）
  document.getElementById('toggle-theme').addEventListener('click', ()=> {
    document.body.classList.toggle('dark');
  });

  // 页面滚动 -> 更新进度条
  window.addEventListener('scroll', updateProgress);
  function updateProgress() {
    const h = document.documentElement;
    const st = window.scrollY || h.scrollTop;
    const sh = (h.scrollHeight - h.clientHeight) || 1;
    const pct = Math.round((st / sh) * 100);
    progressEl.style.width = pct + '%';
  }

  // 存/取阅读进度（localStorage）
  function saveProgress() {
    if (!state.currentBook) return;
    const key = 'xiaoshuo_progress';
    const data = {
      book: state.currentBook.slug || state.currentBook.title,
      chapter: state.currentChapterIndex,
      fontSize: state.fontSize
    };
    localStorage.setItem(key, JSON.stringify(data));
  }
  function loadProgress() {
    const raw = localStorage.getItem('xiaoshuo_progress');
    if (!raw) return null;
    try { return JSON.parse(raw); } catch(e){ return null; }
  }

  // 搜索（简单：按书名或章节标题过滤）
  searchInput.addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    const filtered = state.books.filter(b => {
      if (b.title.toLowerCase().includes(q)) return true;
      return b.chapters.some(c => c.title.toLowerCase().includes(q));
    });
    renderBooks(filtered);
  });

  // 启动
  (async function init() {
    await loadBooks();
    // 恢复进度
    const saved = loadProgress();
    if (saved) {
      const bookIdx = state.books.findIndex(b => (b.slug||b.title) === saved.book);
      if (bookIdx >= 0) {
        state.fontSize = saved.fontSize || 16;
        contentEl.style.fontSize = state.fontSize + 'px';
        openChapter(bookIdx, saved.chapter || 0);
      }
    }
    // 自动装载 utterances（如果你想用）
    // loadUtterances(); // uncomment and configure if using utterances
  })();

  // Utterances 评论集成示例（使用前请在 GitHub 创建 issues 并配置）
  function loadUtterances() {
    const repo = 'awealy/xiaoshuo'; // 更改为你的评论仓库
    const script = document.createElement('script');
    script.src = 'https://utteranc.es/client.js';
    script.setAttribute('repo', repo);
    script.setAttribute('issue-term', 'pathname');
    script.setAttribute('theme', 'github-light');
    script.crossOrigin = 'anonymous';
    script.async = true;
    document.getElementById('comments').appendChild(script);
  }

})();
