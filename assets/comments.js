// assets/comments.js (revamped)
// 使用方法：确保在 HTML 中先加载 supabase SDK 并初始化 window.SUPABASE_CLIENT
// 然后再加载此脚本。

(function () {
  // 等待 DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    // 检查全局 supabase 客户端
    if (!window.SUPABASE_CLIENT) {
      console.error('[comments.js] SUPABASE_CLIENT 未找到。请在 HTML 中先初始化 Supabase（见 README）。');
      // 在页面显示友好提示
      const cs = document.getElementById('comments') || document.body;
      if (cs) {
        cs.innerHTML = `<div class="p-4 bg-yellow-50 text-yellow-700 rounded">评论功能未初始化，请联系管理员 (SUPABASE_CLIENT 未找到)。</div>`;
      }
      return;
    }

    const supabase = window.SUPABASE_CLIENT;

    // DOM 元素（若页面没有这些元素，脚本会优雅降级）
    const commentsRoot = document.querySelector('#comments-root') || document.getElementById('comments');
    const authorInput = document.getElementById('author') || null;
    const chapterInput = document.getElementById('chapter-input') || null;
    const contentInput = document.getElementById('content') || null;
    const sendBtn = document.getElementById('send-btn') || null;
    const clearDraftBtn = document.getElementById('clear-draft') || null;
    const statusEl = document.getElementById('post-status') || null;

    // fallback create simple UI if not present
    function ensureComposer() {
      if (sendBtn && contentInput && authorInput) return;
      // create a minimal composer under commentsRoot
      if (!commentsRoot) return;
      commentsRoot.innerHTML = `
        <div id="composer" class="bg-white p-4 rounded shadow-sm mb-4">
          <input id="author" placeholder="昵称（必填）" class="w-full border rounded px-2 py-1 mb-2" />
          <input id="chapter-input" placeholder="章节（可选）" class="w-full border rounded px-2 py-1 mb-2" />
          <textarea id="content" rows="3" placeholder="写下你的评论..." class="w-full border rounded px-2 py-1 mb-2"></textarea>
          <div class="flex gap-2">
            <button id="send-btn" class="px-3 py-1 bg-indigo-600 text-white rounded">发布</button>
            <button id="clear-draft" class="px-3 py-1 border rounded">清空</button>
            <span id="post-status" class="text-sm text-gray-500 self-center ml-2"></span>
          </div>
        </div>
        <div id="comments-list" class="space-y-3"></div>
      `;
      // rebind
      bindAfterCreate();
    }

    function bindAfterCreate() {
      // update pointers to newly created elements
      window._authorInput = document.getElementById('author');
      window._chapterInput = document.getElementById('chapter-input');
      window._contentInput = document.getElementById('content');
      window._sendBtn = document.getElementById('send-btn');
      window._clearDraftBtn = document.getElementById('clear-draft');
      window._statusEl = document.getElementById('post-status');
      // assign to local variables
      authorInput = window._authorInput;
      chapterInput = window._chapterInput;
      contentInput = window._contentInput;
      sendBtn = window._sendBtn;
      clearDraftBtn = window._clearDraftBtn;
      statusEl = window._statusEl;
      commentsRoot = document.getElementById('comments-list') || commentsRoot;
    }

    // If composer missing create it
    ensureComposer();

    // Now assign again (in case created)
    const _author = document.getElementById('author');
    const _chapter = document.getElementById('chapter-input');
    const _content = document.getElementById('content');
    const _send = document.getElementById('send-btn');
    const _clear = document.getElementById('clear-draft');
    const _status = document.getElementById('post-status');

    // local references
    const authorEl = _author || authorInput;
    const chapterEl = _chapter || chapterInput;
    const contentEl = _content || contentInput;
    const sendButton = _send || sendBtn;
    const clearButton = _clear || clearDraftBtn;
    const statusElLocal = _status || statusEl;

    // state
    let bookSlug = window.BOOK_SLUG || null;
    let chapterPath = window.CHAPTER_PATH || null;
    let replyTo = null;

    // detect chapter if empty
    function detectChapter() {
      if (!chapterPath) chapterPath = window.CHAPTER_PATH || location.pathname || '';
      if (!bookSlug) bookSlug = window.BOOK_SLUG || (chapterPath.split('/')[2] || 'unknown');
      if (chapterEl) chapterEl.value = chapterPath || '';
    }
    detectChapter();

    // helper: escape
    function escapeHtml(str){ if(!str) return ''; return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

    // render single comment node
    function renderComment(c) {
      const time = new Date(c.created_at).toLocaleString();
      return `
        <div class="p-3 border rounded" data-id="${c.id}">
          <div class="flex justify-between items-start">
            <div>
              <div class="font-medium">${escapeHtml(c.author_name)}</div>
              <div class="text-xs text-gray-500">${time}</div>
            </div>
            <div class="flex gap-2">
              <button class="btn-like px-2 py-1 border rounded" data-id="${c.id}">❤ ${c.likes||0}</button>
              <button class="btn-reply px-2 py-1 border rounded" data-id="${c.id}">回复</button>
            </div>
          </div>
          <div class="mt-2 text-gray-800">${escapeHtml(c.content)}</div>
          <div id="replies-${c.id}" class="mt-2 ml-4"></div>
        </div>
      `;
    }

    // build tree
    function buildTree(rows) {
      const map = new Map(); rows.forEach(r => map.set(r.id, {...r, children: []}));
      const roots = [];
      map.forEach(node => {
        if (node.parent_id && map.has(node.parent_id)) map.get(node.parent_id).children.push(node);
        else roots.push(node);
      });
      const sortFn = (a,b)=> new Date(a.created_at)-new Date(b.created_at);
      function sortRec(a){ a.sort(sortFn); a.forEach(n=>sortRec(n.children)); }
      sortRec(roots);
      return roots;
    }

    // render tree into commentsRoot (which should point to list container)
    async function renderTreeToDom(rows) {
      const rootEl = document.getElementById('comments-list') || commentsRoot;
      if (!rootEl) return;
      if (!rows || rows.length===0) {
        rootEl.innerHTML = `<p class="text-gray-400">还没有评论，成为第一个吧！</p>`;
        return;
      }
      const html = rows.map(node => renderNodeRec(node)).join('');
      rootEl.innerHTML = html;
      attachHandlers(); // bind reply/like
    }

    function renderNodeRec(node, level=0) {
      const indentClass = level? 'pl-4 border-l ml-2':'';
      let h = `<div class="${indentClass} mb-3">${renderComment(node)}`;
      if (node.children && node.children.length) {
        h += node.children.map(child => renderNodeRec(child, level+1)).join('');
      }
      h += `</div>`;
      return h;
    }

    // load comments for current chapter/book
    async function loadComments() {
      chapterPath = (chapterEl && chapterEl.value.trim()) || chapterPath;
      bookSlug = bookSlug || (chapterPath.split('/')[2] || 'unknown');
      if (!chapterPath) {
        const rootEl = document.getElementById('comments-list') || commentsRoot;
        if (rootEl) rootEl.innerHTML = `<p class="text-gray-400">请填写章节路径以查看评论（或在章节页面打开社区）。</p>`;
        return;
      }
      const { data, error } = await supabase.from('comments')
        .select('*')
        .eq('book_slug', bookSlug)
        .eq('chapter_path', chapterPath)
        .eq('approved', true)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('加载评论失败', error);
        const rootEl = document.getElementById('comments-list') || commentsRoot;
        if (rootEl) rootEl.innerHTML = `<p class="text-red-500">评论加载失败（检查 Supabase 配置与 RLS 策略）。</p>`;
        return;
      }
      const tree = buildTree(data);
      renderTreeToDom(tree);
    }

    // post comment
    async function postComment(parentId=null, textOverride=null) {
      const author = (authorEl && authorEl.value.trim()) || '匿名';
      const content = textOverride || (contentEl && contentEl.value.trim());
      chapterPath = (chapterEl && chapterEl.value.trim()) || chapterPath;
      if (!content || !chapterPath) { alert('请填写章节与内容'); return; }

      const payload = {
        book_slug: bookSlug || (chapterPath.split('/')[2] || 'unknown'),
        chapter_path: chapterPath,
        parent_id: parentId || null,
        author_name: author,
        content,
        approved: true
      };

      // Insert
      const { data, error } = await supabase.from('comments').insert([payload]);
      if (error) {
        console.error('提交评论失败', error);
        alert('提交失败：' + (error.message || JSON.stringify(error)));
        return;
      }
      // Success: clear content & reload (if realtime active it will come)
      if (contentEl) contentEl.value = '';
      if (statusElLocal) statusElLocal.textContent = '提交成功';
      // call load
      await loadComments();
    }

    // attach handlers to like/reply buttons
    function attachHandlers() {
      document.querySelectorAll('.btn-reply').forEach(btn => {
        btn.onclick = () => {
          const cid = parseInt(btn.dataset.id);
          const parentEl = btn.closest('[data-id]');
          if (!parentEl) return;
          if (parentEl.querySelector('.reply-area')) return;
          const box = document.createElement('div');
          box.className = 'reply-area mt-2';
          box.innerHTML = `
            <textarea class="w-full border p-2 rounded mb-2 reply-text" rows="2" placeholder="回复..."></textarea>
            <div class="flex gap-2">
              <button class="px-3 py-1 bg-indigo-600 text-white rounded send-reply">发送</button>
              <button class="px-3 py-1 border rounded cancel-reply">取消</button>
            </div>
          `;
          parentEl.appendChild(box);
          box.querySelector('.cancel-reply').onclick = ()=>box.remove();
          box.querySelector('.send-reply').onclick = async () => {
            const txt = box.querySelector('.reply-text').value.trim();
            if (!txt) return alert('请输入回复内容');
            await postComment(cid, txt);
            box.remove();
          };
        };
      });

      document.querySelectorAll('.btn-like').forEach(btn => {
        btn.onclick = async () => {
          const id = parseInt(btn.dataset.id);
          try {
            await supabase.rpc('increment_comment_likes', { cid: id });
          } catch (err) {
            // fallback update
            try {
              await supabase.from('comments').update({ likes: (parseInt(btn.textContent.replace(/[^\d]/g,''))||0)+1 }).eq('id', id);
            } catch(e){ console.error(e); }
          }
        };
      });
    }

    // bind composer buttons
    if (sendButton) sendButton.addEventListener('click', () => postComment(null));
    if (clearButton) clearButton.addEventListener('click', () => {
      if (contentEl) contentEl.value = '';
      if (authorEl) authorEl.value = '';
      if (statusElLocal) statusElLocal.textContent = '草稿已清空';
    });

    // Realtime subscription (safe: only reload when relevant)
    try {
      const channel = supabase.channel('comments_channel')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments' }, payload => {
          const row = payload.new;
          if (!row) return;
          // if matches current chapter
          const matchBook = (row.book_slug === (bookSlug || row.book_slug));
          const matchChap = (row.chapter_path === (chapterPath || row.chapter_path));
          if (matchBook && matchChap && row.approved) loadComments();
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'comments' }, payload => {
          loadComments();
        })
        .subscribe();
    } catch (e) {
      console.warn('实时订阅失败（可能 Supabase 项目未启用 publications）', e);
    }

    // load initially
    loadComments();

    // auto-save draft (optional)
    const DRAFT_KEY = `draft_${bookSlug || 'global'}`;
    function saveDraft(){ 
      const d={author: (authorEl&&authorEl.value)||'', chapter: (chapterEl&&chapterEl.value)||'', content: (contentEl&&contentEl.value)||''};
      try{ localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); }catch(e){}
    }
    function loadDraft(){ try{ const r=localStorage.getItem(DRAFT_KEY); if(r){ const o=JSON.parse(r); if(authorEl) authorEl.value=o.author||''; if(chapterEl) chapterEl.value=o.chapter||''; if(contentEl) contentEl.value=o.content||''; if(statusElLocal) statusElLocal.textContent='已恢复草稿'; } }catch(e){} }
    loadDraft();
    setInterval(saveDraft, 10000);
  });
})();
