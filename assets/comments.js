
/* ============ 配置区 ============ */
/* 在部署时把下面两个值替换为你的 Supabase 项目 URL 与 anon 公钥 */
const SUPABASE_URL = 'https://cqmusijxssqzcqiztier.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbXVzaWp4c3NxemNxaXp0aWVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzNzA1NjUsImV4cCI6MjA3Njk0NjU2NX0.JIXOR1i5q8llCyMncegMfO3jw5-1a4npB5ZOAD4jVSw';
// comments.js
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 渲染评论区
async function loadComments() {
  const path = window.location.pathname; // 每页独立评论区
  const { data, error } = await supabase
    .from("comments")
    .select("*")
    .eq("page", path)
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    document.getElementById("comments").innerHTML =
      "<p class='text-gray-400'>加载评论失败，请稍后再试。</p>";
    return;
  }

  const commentsHTML = data
    .map(
      (c) => `
      <div class="border-b border-gray-200 py-2">
        <p class="text-sm text-gray-800">${c.content}</p>
        <p class="text-xs text-gray-400">— ${c.author || "匿名"} • ${new Date(
        c.created_at
      ).toLocaleString()}</p>
      </div>
    `
    )
    .join("");

  document.getElementById("comments").innerHTML = `
    <div class="mb-4">
      <textarea id="new-comment" placeholder="写下你的评论..." class="w-full border rounded p-2 text-sm"></textarea>
      <button id="send-comment" class="mt-2 bg-indigo-500 text-white px-3 py-1 rounded">发送</button>
    </div>
    ${commentsHTML}
  `;

  document
    .getElementById("send-comment")
    .addEventListener("click", async () => {
      const content = document.getElementById("new-comment").value.trim();
      if (!content) return alert("请输入内容！");
      const { error } = await supabase.from("comments").insert([
        {
          page: path,
          content,
          author: "访客",
        },
      ]);
      if (!error) loadComments();
    });
}

// 页面加载后执行
document.addEventListener("DOMContentLoaded", loadComments);
