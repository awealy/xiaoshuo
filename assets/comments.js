// assets/comments.js
(function(){
  document.addEventListener('DOMContentLoaded', () => {
    if (!window.SUPABASE_CLIENT) {
      console.error('[comments.js] SUPABASE_CLIENT 未找到，请确保 index.html 里已初始化 Supabase（window.SUPABASE_CLIENT）。');
      const c = document.getElementById('comments');
      if (c) c.innerHTML = `<div class="p-4 bg-yellow-50 text-yellow-700 rounded">评论功能未初始化，请联系管理员。</div>`;
      return;
    }
    const supabase = window.SUPABASE_CLIENT;

    // DOM references (如果页面没提供则自动创建一个最小 composer + 列表)
    let composerRoot = document.getElementById('comments');
    if (!composerRoot) return;

    // 如果 composer area 未存在，就创建
    function ensureComposer() {
      // 如果已经创建过（判断 send-btn），直接返回
      if (document.getElementById('send-btn')) return;
      composerRoot.innerHTML = `
        <div id="composer" class="bg-white p-3 rounded shadow mb-4">
          <input id="author" placeholder="昵称（必填）" class="w-full border rounded px-2 py-1 mb-2" />
          <input id="chapter-input" placeholder="章节路径（可选）" class="w-full border rounded px-2 py-1 mb-2" />
          <textarea id="content" rows="3" placeholder="写下你的评论..." class="w-full border rounded px-2 py-1 mb-2"></textarea>
          <div class="flex gap-2">
            <button id="send-btn" class="px-3 py-1 bg-indigo-600 text-white rounded">发布</button>
            <button id="clear-draft" class="px-3 py-1 border rounded">清空草稿</button>
            <span id="post-status" class="text-sm text-gray-500 self-center ml-2"></span>
          </div>
        </div>
        <div id="comments-list" class="space-y-3"></div>
      `;
    }
    ensureComposer();

    // elements
    const authorInput = document.getElementById('author');
    const chapterInput = document.getElementById('chapter-input');
    const contentInput = document.getElementById('content');
    const sendBtn = document.getElementById('send-btn');
    const clearDraftBtn = document.getElementById('clear-draft');
    const statusEl = document.getElementById('post-status');
    const commentsList = document.getElementById('comments-list');

    // state
    let bookSlug = window.BOOK_SLUG || null;
    let chapterPath = window.CHAPTER_PATH || null;

    // detect chapter from window vars or chapter input or pathname
    function detectChapter() {
      chapterPath = (chapterInput && chapterInput.value.trim()) || chapterPath || window.CHAPTER_PATH || location.pathname || '';
      bookSlug = bookSlug || window.BOOK_SLUG || (chapterPath.split('/')[2] || 'unknown');
      if (chapterInput) chapterInput.value = chapterPath;
    }
    detectChapter();

    // escape html
    function escapeHtml(s){ if(!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

    // render single comment node
    function renderCommentNode(c){
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

    // tree builder
    function buildTree(rows) {
      const map = new Map();
      rows.forEach(r => map.set(r.id, {...r, children: []}));
      const roots = [];
      map.forEach(node => {
        if (node.parent_id && map.has(node.parent_id)) {
          map.get(node.parent_id).children.push(node);
        } else {
          roots.push(node);
        }
      });
      const sortFn = (a,b)=> new Date(a.created_at)-new Date(b.created_at);
      function sortRec(arr){ arr.sort(sortFn); arr.forEach(n=>sortRec(n.children)); }
      sortRec(roots);
      return roots;
    }

    function renderTree(tree) {
      if (!commentsList) return;
      if (!tree || tree.length===0) {
        commentsList.innerHTML = `<p class="text-gray-400">还没有评论，成为第一个吧！</p>`;
        return;
      }
      commentsList.innerHTML = tree.map(node => renderRec(node)).join('');
      attachHandlers();
    }
    function renderRec(node, level=0){
      const indent = level ? 'pl-4 border-l ml-2' : '';
      let html = `<div class="${indent} mb-3">${renderCommentNode(node)}`;
      if (node.children && node.children.length) {
        html += node.children.map(child => renderRec(child, level+1)).join('');
      }
      html += `</div>`;
      return html;
    }

    // load comments
    async function loadComments() {
      detectChapter();
      if (!chapterPath) {
        commentsList.innerHTML = `<p class="text-gray-400">请先打开章节以加载评论。</p>`;
        return;
      }
      const { data, error } = await supabase
        .from('comments')
        .select('*')
        .eq('book_slug', bookSlug)
        .eq('chapter_path', chapterPath)
        .eq('approved', true)
        .order('created_at', { ascending: true });
      if (error) {
        console.error('加载评论失败', error);
        commentsList.innerHTML = `<p class="text-red-500">评论加载失败，请检查 Supabase 配置。</p>`;
        return;
      }
      const tree = buildTree(data || []);
      renderTree(tree);
    }

    // post comment
    async function postComment(parent_id=null, textOverride=null) {
      const author = (authorInput && authorInput.value.trim()) || '匿名';
      const content = textOverride || (contentInput && contentInput.value.trim());
      detectChapter();
      if (!content || !chapterPath) { alert('请填写章节与内容'); return; }
      const payload = {
        book_slug: bookSlug || (chapterPath.split('/')[2] || 'unknown'),
        chapter_path: chapterPath,
        parent_id: parent_id || null,
        author_name: author,
        content: content,
        approved: true
      };
      const { data, error } = await supabase.from('comments').insert([payload]);
      if (error) {
        console.error('提交失败', error);
        alert('提交失败：' + (error.message||JSON.stringify(error)));
        return;
      }
      if (contentInput) contentInput.value = '';
      if (statusEl) statusEl.textContent = '提交成功';
      await loadComments();
    }

    // handlers binding
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
            // optimistic reload
            await loadComments();
          } catch (err) {
            try {
              // fallback update (non-atomic)
              const cur = parseInt(btn.textContent.replace(/[^\d]/g,'')) || 0;
              await supabase.from('comments').update({ likes: cur + 1 }).eq('id', id);
              await loadComments();
            } catch(e) { console.error(e); }
          }
        };
      });
    }

    // composer bindings
    if (sendBtn) sendBtn.addEventListener('click', ()=>postComment(null));
    if (clearDraftBtn) clearDraftBtn.addEventListener('click', ()=> {
      if (authorInput) authorInput.value = '';
      if (contentInput) contentInput.value = '';
      if (statusEl) statusEl.textContent = '草稿已清空';
    });

    // realtime subscribe (if backend allows)
    try {
      supabase.channel('comments_channel')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments' }, payload => {
          const row = payload.new;
          if (!row) return;
          // if relevant chapter & approved
          if (row.approved && row.book_slug === (bookSlug || row.book_slug) && row.chapter_path === (chapterPath || row.chapter_path)) {
            loadComments();
          }
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'comments' }, payload => loadComments())
        .subscribe();
    } catch (e) {
      console.warn('实时订阅失败（可能 Supabase Realtime 未启用）', e);
    }

    // auto draft
    const DRAFT_KEY = `draft_${bookSlug||'global'}`;
    function saveDraft(){ try { localStorage.setItem(DRAFT_KEY, JSON.stringify({author: authorInput?.value||'', chapter: chapterInput?.value||'', content: contentInput?.value||''})); } catch(e){} }
    function loadDraft(){ try { const r=localStorage.getItem(DRAFT_KEY); if(r){ const o=JSON.parse(r); if(authorInput) authorInput.value = o.author||''; if(chapterInput) chapterInput.value = o.chapter||''; if(contentInput) contentInput.value = o.content||''; if(statusEl) statusEl.textContent='已恢复草稿'; } } catch(e){} }
    loadDraft(); setInterval(saveDraft, 10000);

    // initial load
    loadComments();
  });
})();
