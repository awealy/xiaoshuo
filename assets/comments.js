// ======== Supabase 初始化 ========
// const SUPABASE_URL = "https://cqmusijxssqzcqiztier.supabase.co"; // ← 改这里
// const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbXVzaWp4c3NxemNxaXp0aWVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzNzA1NjUsImV4cCI6MjA3Njk0NjU2NX0.JIXOR1i5q8llCyMncegMfO3jw5-1a4npB5ZOAD4jVSw";                        // ← 改这里

// const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
// // -------------------------------------------------------------------

// DOM
const authorInput = document.getElementById("author");
const chapterInput = document.getElementById("chapter-input");
const contentInput = document.getElementById("content");
const sendBtn = document.getElementById("send-btn");
const clearDraftBtn = document.getElementById("clear-draft");
const statusEl = document.getElementById("post-status");
const commentsRoot = document.getElementById("comments-root");

// 状态
let bookSlug = window.BOOK_SLUG || null;
let chapterPath = window.CHAPTER_PATH || null;
let replyTo = null; // parent_id when replying

// 自动识别章节：优先使用 window vars，否则使用 pathname
function detectChapter() {
  if (!chapterPath) {
    chapterPath = window.CHAPTER_PATH || window.location.pathname || "";
  }
  if (!bookSlug) {
    bookSlug = window.BOOK_SLUG || (chapterPath.split('/')[2] || 'unknown');
  }
  chapterInput.value = chapterPath || "";
}
detectChapter();

// 本地草稿支持
const DRAFT_KEY = `draft_${bookSlug || 'global'}`;
function saveDraft() {
  const d = { author: authorInput.value, chapter: chapterInput.value, content: contentInput.value };
  localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  statusEl.textContent = "已保存草稿";
}
function loadDraft() {
  const raw = localStorage.getItem(DRAFT_KEY);
  if (!raw) return;
  try {
    const d = JSON.parse(raw);
    authorInput.value = d.author || "";
    chapterInput.value = d.chapter || chapterInput.value;
    contentInput.value = d.content || "";
    statusEl.textContent = "已恢复草稿";
  } catch(e){}
}
loadDraft();
setInterval(saveDraft, 10000); // 每10秒自动保存

clearDraftBtn.addEventListener("click", () => {
  localStorage.removeItem(DRAFT_KEY);
  authorInput.value = "";
  contentInput.value = "";
  statusEl.textContent = "草稿已清空";
});

// 渲染单条评论（包含回复容器）
function renderCommentNode(c) {
  const time = new Date(c.created_at).toLocaleString();
  return `
  <div class="p-3 border rounded" data-cid="${c.id}">
    <div class="flex justify-between items-start gap-2">
      <div>
        <div class="font-medium">${escapeHtml(c.author_name)}</div>
        <div class="text-xs text-gray-500">${time}</div>
      </div>
      <div class="flex items-center gap-2 text-sm">
        <button class="btn-like px-2 py-1 border rounded" data-id="${c.id}">❤ ${c.likes || 0}</button>
        <button class="btn-reply px-2 py-1 border rounded" data-id="${c.id}">回复</button>
      </div>
    </div>
    <div class="mt-2 text-gray-800">${escapeHtml(c.content)}</div>
    <div class="mt-3" id="replies-${c.id}"></div>
  </div>`;
}

// 递归构造嵌套树（把平坦数组变成树）
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
  // sort by created_at ascending
  const sortFn = (a,b) => new Date(a.created_at) - new Date(b.created_at);
  const walkSort = (arr) => {
    arr.sort(sortFn);
    arr.forEach(n => walkSort(n.children));
  };
  walkSort(roots);
  return roots;
}

// 渲染树到 DOM（支持多层嵌套）
function renderTree(tree) {
  if (!tree || tree.length===0) {
    commentsRoot.innerHTML = `<p class="text-gray-400">还没有评论，成为第一个吧！</p>`;
    return;
  }
  commentsRoot.innerHTML = tree.map(node => renderNodeWithChildren(node)).join('');
  attachHandlers();
}
function renderNodeWithChildren(node, level=0) {
  const indentClass = level ? 'reply-box' : '';
  let html = `<div class="${indentClass} mb-2">${renderCommentNode(node)}`;
  if (node.children && node.children.length) {
    html += `<div class="mt-2 space-y-2">` + node.children.map(child => renderNodeWithChildren(child, level+1)).join('') + `</div>`;
  }
  html += `</div>`;
  return html;
}

// 加载评论（仅加载对应书籍/章节，显示 approved = true）
async function loadComments() {
  chapterPath = chapterInput.value.trim() || chapterPath;
  bookSlug = bookSlug || (chapterPath.split('/')[2] || 'unknown');
  if (!chapterPath) {
    commentsRoot.innerHTML = `<p class="text-gray-400">请先输入或打开章节页面以查看该章节评论。</p>`;
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
    console.error('加载评论失败：', error);
    commentsRoot.innerHTML = `<p class="text-red-500">评论加载失败，请检查 Supabase 配置。</p>`;
    return;
  }

  const tree = buildTree(data);
  renderTree(tree);
}

// 发送评论或回复
sendBtn.addEventListener('click', async () => {
  const author = authorInput.value.trim();
  const content = contentInput.value.trim();
  chapterPath = chapterInput.value.trim() || chapterPath;
  if (!author || !content || !chapterPath) { alert('请填写昵称、章节与内容'); return; }

  sendBtn.disabled = true;
  statusEl.textContent = '提交中...';

  const payload = {
    book_slug: bookSlug || (chapterPath.split('/')[2] || 'unknown'),
    chapter_path: chapterPath,
    parent_id: replyTo || null,
    author_name: author,
    content: content,
    approved: true  // 若需要审核可改为 false
  };

  const { data, error } = await supabase.from('comments').insert([payload]);

  if (error) {
    console.error('提交失败', error);
    alert('提交失败：'+ (error.message || JSON.stringify(error)));
    statusEl.textContent = '提交失败';
  } else {
    contentInput.value = '';
    replyTo = null;
    statusEl.textContent = '提交成功';
    // 如果实时订阅生效，则会自动出现；若不依赖实时，可手动 reload
    // loadComments();
  }
  sendBtn.disabled = false;
});

// 绑定回复/like 按钮事件
function attachHandlers() {
  // reply
  document.querySelectorAll('.btn-reply').forEach(btn => {
    btn.onclick = (e) => {
      const cid = parseInt(btn.dataset.id);
      // 在该评论下插入一个临时回复输入框（单次）
      const parentEl = btn.closest('[data-cid]');
      if (!parentEl) return;
      // 防止重复
      if (parentEl.querySelector('.reply-input')) return;
      const box = document.createElement('div');
      box.className = 'reply-input mt-2';
      box.innerHTML = `
        <textarea class="w-full border p-2 rounded mb-2 reply-text" rows="2" placeholder="回复..."></textarea>
        <div class="flex gap-2">
          <button class="px-3 py-1 bg-indigo-600 text-white rounded send-reply">发送</button>
          <button class="px-3 py-1 border rounded cancel-reply">取消</button>
        </div>`;
      parentEl.appendChild(box);
      box.querySelector('.cancel-reply').onclick = () => box.remove();
      box.querySelector('.send-reply').onclick = async () => {
        const txt = box.querySelector('.reply-text').value.trim();
        if (!txt) return alert('请输入回复内容');
        // 插入 reply
        const author = authorInput.value.trim() || '匿名';
        const payload = {
          book_slug: bookSlug || (chapterPath.split('/')[2] || 'unknown'),
          chapter_path: chapterPath,
          parent_id: cid,
          author_name: author,
          content: txt,
          approved: true
        };
        const { error } = await supabase.from('comments').insert([payload]);
        if (error) {
          alert('回复失败：' + (error.message || JSON.stringify(error)));
        } else {
          box.remove();
          statusEl.textContent = '回复已提交';
          // loadComments(); // 如果你没有订阅实时，可手动刷新
        }
      };
    };
  });

  // like
  document.querySelectorAll('.btn-like').forEach(btn => {
    btn.onclick = async () => {
      const id = parseInt(btn.dataset.id);
      // 尝试调用 RPC（如果已部署），若不支持则用 update（非原子，生产建议用 RPC）
      try {
        await supabase.rpc('increment_comment_likes', { cid: id });
      } catch(err) {
        // 回退到简单 update（注意并发）
        await supabase.from('comments').update({ likes: (parseInt(btn.textContent.replace(/[^\d]/g,'')) || 0) + 1 }).eq('id', id);
      }
    };
  });
}

// 转义输出
function escapeHtml(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ------------------ 实时订阅：监听 comments 的 INSERT 和 UPDATE ------------------
const channel = supabase.channel('public:comments')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments' }, payload => {
    // 只处理与当前章节相关且 approved = true 的评论
    const row = payload.new;
    if (row.approved && row.book_slug === (bookSlug || (row.book_slug)) && row.chapter_path === (chapterPath || row.chapter_path)) {
      // 简单：重新加载整棵树（也可做增量插入）
      loadComments();
    }
  })
  .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'comments' }, payload => {
    // 更新（例如管理员批准 or 点赞数变化）
    loadComments();
  })
  .subscribe();

// 启动时加载
loadComments();
