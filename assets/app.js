// assets/app.js
document.addEventListener('DOMContentLoaded', () => {
  // 简单安全绑定：仅在元素存在时绑定
  const search = document.getElementById('search');
  if (search) {
    search.addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      const books = document.getElementById('books');
      if (!books) return;
      Array.from(books.children).forEach(item => {
        const t = item.textContent.toLowerCase();
        item.style.display = t.includes(q) ? '' : 'none';
      });
    });
  }

  // prev/next handlers placeholders (用户可自行扩展)
  const prev = document.getElementById('prev-ch');
  const next = document.getElementById('next-ch');
  if (prev) prev.addEventListener('click', ()=>alert('上一章功能未实现（请按需实现章节跳转）'));
  if (next) next.addEventListener('click', ()=>alert('下一章功能未实现（请按需实现章节跳转）'));
});
