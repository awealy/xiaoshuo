// ======== Supabase 初始化 ========
const SUPABASE_URL = "https://cqmusijxssqzcqiztier.supabase.co"; // ← 改这里
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbXVzaWp4c3NxemNxaXp0aWVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzNzA1NjUsImV4cCI6MjA3Njk0NjU2NX0.JIXOR1i5q8llCyMncegMfO3jw5-1a4npB5ZOAD4jVSw";                        // ← 改这里
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ======== DOM 元素 ========
const form = document.getElementById("comment-form");
const commentsDiv = document.getElementById("comments");

// ======== 发表评论 ========
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const author = document.getElementById("author").value.trim();
  const chapter_path = document.getElementById("chapter_path").value.trim();
  const content = document.getElementById("content").value.trim();

  if (!author || !chapter_path || !content) {
    alert("请填写完整信息！");
    return;
  }

  const { error } = await supabase.from("comments").insert([
    {
      book_slug: "zhoushao",
      chapter_path,
      author,
      content,
      parent_id: null,
    },
  ]);

  if (error) {
    console.error("提交失败：", error);
    alert("评论提交失败，请检查配置或权限。");
  } else {
    alert("评论成功！");
    form.reset();
    loadComments(); // 刷新评论
  }
});

// ======== 加载评论 ========
async function loadComments() {
  const { data, error } = await supabase
    .from("comments")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    console.error("加载失败：", error);
    commentsDiv.innerHTML = `<p class="text-gray-400">无法加载评论。</p>`;
    return;
  }

  commentsDiv.innerHTML = data
    .map(
      (c) => `
      <div class="border-b py-3">
        <p class="text-sm text-gray-500 mb-1">${c.author} | ${new Date(
        c.created_at
      ).toLocaleString()}</p>
        <p class="mb-1 text-gray-800">${c.content}</p>
        <p class="text-xs text-gray-400">章节: ${c.chapter_path}</p>
      </div>`
    )
    .join("");
}

// 页面加载时自动调用
loadComments();
