
/* ============ 配置区 ============ */
/* 在部署时把下面两个值替换为你的 Supabase 项目 URL 与 anon 公钥 */
const SUPABASE_URL = 'https://cqmusijxssqzcqiztier.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbXVzaWp4c3NxemNxaXp0aWVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzNzA1NjUsImV4cCI6MjA3Njk0NjU2NX0.JIXOR1i5q8llCyMncegMfO3jw5-1a4npB5ZOAD4jVSw';
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const userName = localStorage.getItem("user_name") || prompt("请输入昵称：") || "匿名";
localStorage.setItem("user_name", userName);

async function loadComments(bookSlug, chapterTitle) {
  const { data } = await supabase.from("comments")
    .select("*")
    .eq("book_slug", bookSlug)
    .eq("chapter_title", chapterTitle)
    .order("created_at", { ascending: true });
  const el = document.getElementById("comments");
  el.innerHTML = `<h3 class="font-bold mb-2">评论区</h3>` +
    data.map(c => `<p><b>${c.user_name}</b>：${c.content}</p>`).join("") +
    `<div class="mt-3 flex"><input id="comment-input" class="border flex-1 px-2 py-1 rounded" placeholder="发表评论"><button id="send-comment" class="ml-2 px-3 py-1 bg-indigo-600 text-white rounded">发送</button></div>`;
  document.getElementById("send-comment").onclick = async () => {
    const val = document.getElementById("comment-input").value.trim();
    if (!val) return;
    await supabase.from("comments").insert([{ book_slug: bookSlug, chapter_title: chapterTitle, user_name: userName, content: val }]);
    loadComments(bookSlug, chapterTitle);
  };
}
