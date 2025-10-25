/* assets/comments.js
   请在 index.html 中在 </body> 前添加：
   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/supabase.min.js"></script>
   <script src="assets/comments.js"></script>
*/

/* ============ 配置区 ============ */
/* 在部署时把下面两个值替换为你的 Supabase 项目 URL 与 anon 公钥 */
const SUPABASE_URL = 'https://YOUR-PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR-ANON-KEY';
/* 这里的 context 标识当前页面的书籍/章节，必须与你 books.json / 文章标识一致 */
const PAGE_BOOK_SLUG = window.PAGE_BOOK_SLUG || 'example-novel';
const PAGE_CHAPTER_PATH = window.PAGE_CHAPTER_PATH || 'books/example-novel/01-起始.md';
/* 每页加载数量 */
const PAGE_SIZE = 10;

/* ============ 初始化 ============ */
const supabase = supabaseJs.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const els = {
  name: document.getElementById('cc-name'),
  email: document.getElementById('cc-email'),
  content: document.getElementById('cc-content'),
  submit: document.getElementById('cc-submit'),
  saveDraft: document.getElementById('cc-save-draft'),
  status: document.getElementById('cc-status'),
  list: document.getElementById('comments-list'),
  loadMore: document.getElementById('load-more'),
  count: document.getElementById('comments-count')
};

let cursor = null;
let commentsCache = [];

/* ============ helper ============ */
function renderCommentRow(c) {
  const ownLikeKey = `liked_${c.id}`;
  const liked = localStorage.getItem(ownLikeKey) === '1';
  const approvedBadge = c.approved ? '' : '<span class="text-xs text-yellow-600 ml-2">(未审核)</span>';

  const parentInfo = c.parent_id ? `<div class="text-xs text-gray-500">回复于 #${c.parent_id}</div>` : '';
  return `
    <div class="p-3 border rounded">
      <div class="flex items-start justify-between">
        <div>
          <div class="font-medium">${escapeHtml(c.author_name || '匿名')}</div>
          <div class="text-xs text-gray-500">${new Date(c.created_at).toLocaleString()} ${approvedBadge}</div>
        </div>
        <div class="flex items-center gap-2">
          <button data-id="${c.id}" class="btn-like text-sm px-2 py-1 border rounded">${liked ? '♥' : '♡'} ${c.likes || 0}</button>
          <button data-id="${c.id}" class="btn-reply text-sm px-2 py-1 border rounded">回复</button>
          <button data-id="${c.id}" class="btn-flag text-sm px-2 py-1 border rounded">举报</button>
        </div>
      </div>
      ${parentInfo}
      <div class="mt-2">${nl2br(escapeHtml(c.content))}</div>
      <div id="replies-${c.id}" class="mt-3 space-y-2"></div>
    </div>
  `;
}

function escapeHtml(s) {
  if (!s) return '';
  return s.replace(/[&<>"'`=\/]/g, function (c) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
      '/': '&#x2F;',
      '`': '&#x60;',
      '=': '&#x3D;'
    }[c];
  });
}
function nl2br(s){ return s.replace(/\n/g, '<br/>'); }

/* ============ CRUD 操作 ============ */
async function loadComments(reset = false) {
  if (reset) {
    cursor = null;
    commentsCache = [];
    els.list.innerHTML = '';
  }
  els.status.textContent = '加载中...';
  // 查询：只显示 approved = true 的顶层评论（parent_id is null），然后客户端再拉取 replies
  let query = supabase
    .from('comments')
    .select('*')
    .eq('book_slug', PAGE_BOOK_SLUG)
    .eq('chapter_path', PAGE_CHAPTER_PATH)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE);

  if (cursor) {
    // cursor 是上一次最旧的 created_at，用于分页（这里用 offset/limit 也可）
    query = query.gt('created_at', '1970-01-01'); // placeholder - we'll use range offset
  }

  const { data, error } = await query;
  if (error) {
    els.status.textContent = '加载评论失败';
    console.error(error);
    return;
  }
  const comments = (data || []).filter(c => c.approved); // double-check approval
  commentsCache = commentsCache.concat(comments);
  renderComments(comments);
  els.count.textContent = `已显示 ${commentsCache.length} 条`;
  els.status.textContent = '';
}

function renderComments(list) {
  for (const c of list) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = renderCommentRow(c);
    const node = wrapper.firstElementChild;
    els.list.appendChild(node);
    // load replies
    loadReplies(c.id);
  }
  attachHandlers(); // attach handlers for new nodes
}

async function loadReplies(parentId) {
  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .eq('parent_id', parentId)
    .eq('book_slug', PAGE_BOOK_SLUG)
    .eq('chapter_path', PAGE_CHAPTER_PATH)
    .order('created_at', { ascending: true });

  if (error) { console.error('loadReplies', error); return; }
  const container = document.getElementById(`replies-${parentId}`);
  if (!container) return;
  container.innerHTML = '';
  for (const r of (data || []).filter(x => x.approved)) {
    const replyEl = document.createElement('div');
    replyEl.className = 'p-2 border rounded bg-gray-50';
    replyEl.innerHTML = `<div class="text-xs text-gray-600">${escapeHtml(r.author_name)} · ${new Date(r.created_at).toLocaleString()}</div>
                         <div class="mt-1 text-sm">${nl2br(escapeHtml(r.content))}</div>`;
    container.appendChild(replyEl);
  }
}

/* ============ 发表评论 ============ */
els.submit.addEventListener('click', async () => {
  const name = els.name.value.trim();
  const email = els.email.value.trim();
  const content = els.content.value.trim();
  if (!name || !content) { alert('请填写昵称与内容'); return; }

  const payload = {
    book_slug: PAGE_BOOK_SLUG,
    chapter_path: PAGE_CHAPTER_PATH,
    parent_id: null,
    author_name: name,
    author_email: email || null,
    content,
    approved: false  // 默认需要审核；如需直接公开改为 true
  };

  els.submit.disabled = true;
  els.status.textContent = '提交中...';

  const { data, error } = await supabase.from('comments').insert([payload]);
  if (error) {
    els.status.textContent = '提交失败';
    console.error(error);
    els.submit.disabled = false;
    return;
  }

  // 成功：在前端显示“已提交，等待审核”
  els.status.textContent = '评论已提交，等待管理员审核';
  els.submit.disabled = false;
  // 清空编辑框 & 保存草稿移除
  els.content.value = '';
  localStorage.removeItem('cc_draft_' + PAGE_BOOK_SLUG + '_' + PAGE_CHAPTER_PATH);
  // 可选：如果你希望自动显示未审核评论给作者自己，可 append 小提示
});

/* ============ 草稿保存 ============ */
els.saveDraft.addEventListener('click', () => {
  const d = {
    name: els.name.value,
    email: els.email.value,
    content: els.content.value
  };
  localStorage.setItem('cc_draft_' + PAGE_BOOK_SLUG + '_' + PAGE_CHAPTER_PATH, JSON.stringify(d));
  els.status.textContent = '草稿已保存';
});

/* 恢复草稿 */
function restoreDraft() {
  const raw = localStorage.getItem('cc_draft_' + PAGE_BOOK_SLUG + '_' + PAGE_CHAPTER_PATH);
  if (!raw) return;
  try {
    const d = JSON.parse(raw);
    els.name.value = d.name || '';
    els.email.value = d.email || '';
    els.content.value = d.content || '';
    els.status.textContent = '已恢复草稿';
  } catch (e) { console.warn(e); }
}

/* ============ 点赞（客户端防刷） ============ */
async function handleLike(id, buttonEl) {
  const likedKey = `liked_${id}`;
  if (localStorage.getItem(likedKey) === '1') {
    alert('你已点过赞');
    return;
  }
  // 安全提示：直接在客户端 update likes 可能产生竞态；更稳妥的方式是调用 RPC（后端）用 service_role 完成原子更新
  const { data, error } = await supabase
    .from('comments')
    .update({ likes: supabase.raw('likes + 1') })
    .eq('id', id);

  if (error) {
    console.error('like error', error);
    return;
  }
  localStorage.setItem(likedKey, '1');
  // 更新显示
  buttonEl.textContent = `♥ ${(parseInt(buttonEl.textContent.replace(/[^\d]/g,'')) || 0) + 1}`;
}

/* ============ 举报 ============ */
async function handleFlag(id, button) {
  if (!confirm('确定要举报这条评论吗？管理员会审核。')) return;
  const { data, error } = await supabase.from('comments').update({ is_flagged: true }).eq('id', id);
  if (error) { console.error(error); alert('举报失败'); return; }
  alert('已举报，管理员会处理。');
}

/* ============ 事件绑定 ============ */
function attachHandlers() {
  // like
  document.querySelectorAll('.btn-like').forEach(btn => {
    if (!btn.dataset.bound) {
      btn.dataset.bound = '1';
      btn.addEventListener('click', async (e) => {
        const id = parseInt(btn.dataset.id);
        await handleLike(id, btn);
      });
    }
  });
  // reply
  document.querySelectorAll('.btn-reply').forEach(btn => {
    if (!btn.dataset.bound) {
      btn.dataset.bound = '1';
      btn.addEventListener('click', (e) => {
        const id = parseInt(btn.dataset.id);
        // 弹出小回复输入框（简易实现）
        const parent = btn.closest('.p-3');
        if (!parent.querySelector(`#reply-box-${id}`)) {
          const box = document.createElement('div');
          box.id = `reply-box-${id}`;
          box.className = 'mt-2';
          box.innerHTML = `<textarea id="reply-txt-${id}" class="w-full px-2 py-1 border rounded" rows="2"></textarea>
            <div class="mt-1">
              <button data-id="${id}" class="btn-send-reply px-3 py-1 border rounded">发送回复</button>
              <button data-id="${id}" class="btn-cancel-reply px-3 py-1 border rounded">取消</button>
            </div>`;
          parent.appendChild(box);
          // bind send
          box.querySelector('.btn-send-reply').addEventListener('click', async (ev) => {
            const rid = ev.target.dataset.id;
            const txt = document.getElementById(`reply-txt-${rid}`).value.trim();
            if (!txt) return alert('请输入回复内容');
            const payload = {
              book_slug: PAGE_BOOK_SLUG,
              chapter_path: PAGE_CHAPTER_PATH,
              parent_id: parseInt(rid),
              author_name: els.name.value.trim() || '匿名',
              author_email: els.email.value.trim() || null,
              content: txt,
              approved: false
            };
            const { data, error } = await supabase.from('comments').insert([payload]);
            if (error) { alert('回复失败'); console.error(error); return; }
            alert('回复已提交，等待管理员审核');
            box.remove();
          });
          box.querySelector('.btn-cancel-reply').addEventListener('click', ()=> box.remove());
        }
      });
    }
  });

  // flag
  document.querySelectorAll('.btn-flag').forEach(btn => {
    if (!btn.dataset.bound) {
      btn.dataset.bound = '1';
      btn.addEventListener('click', async () => {
        const id = parseInt(btn.dataset.id);
        await handleFlag(id, btn);
      });
    }
  });
}

/* ============ 初始化加载 ============ */
document.addEventListener('DOMContentLoaded', async () => {
  restoreDraft();
  // 首次加载（只展示已批准评论）
  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .eq('book_slug', PAGE_BOOK_SLUG)
    .eq('chapter_path', PAGE_CHAPTER_PATH)
    .eq('approved', true)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE);

  if (error) { console.error('initial load', error); }
  const comments = data || [];
  renderComments(comments);
  els.count.textContent = `显示 ${comments.length} 条`;
  // load more handler (示例：简单再拉一次 newer/older)
  els.loadMore.addEventListener('click', async () => {
    // 这里可实现更完善的分页/offset/last_id 逻辑
    await loadComments(false);
  });
});
