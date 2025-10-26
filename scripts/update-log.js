/**
 * 自动生成 gx/index.html 更新日志页面
 * 从 Git 提交记录中提取信息并高亮分类
 * 
 * 使用：
 *   node scripts/update-log.js
 */

import { execSync } from "child_process";
import { writeFileSync, mkdirSync, existsSync } from "fs";

// 获取 git 提交记录
const log = execSync(`git log --pretty=format:"%h|%ad|%s" --date=short`, {
  encoding: "utf-8",
});

// 解析 git log
const commits = log
  .trim()
  .split("\n")
  .map(line => {
    const [hash, date, ...msg] = line.split("|");
    const message = msg.join("|").trim();
    return {
      hash,
      date,
      message,
      type: detectType(message),
    };
  });

// 检测提交类型
function detectType(message) {
  const lower = message.toLowerCase();
  if (lower.startsWith("feat")) return "feat";
  if (lower.startsWith("fix")) return "fix";
  if (lower.startsWith("docs")) return "docs";
  if (lower.startsWith("style")) return "style";
  if (lower.startsWith("refactor")) return "refactor";
  if (lower.startsWith("test")) return "test";
  if (lower.startsWith("chore")) return "chore";
  return "other";
}

// 分类分组
const grouped = {
  feat: [],
  fix: [],
  docs: [],
  style: [],
  refactor: [],
  test: [],
  chore: [],
  other: [],
};

commits.forEach(c => grouped[c.type].push(c));

// Tailwind + Emoji 样式映射
const typeStyle = {
  feat: "text-green-600 font-semibold",
  fix: "text-red-600 font-semibold",
  docs: "text-blue-600",
  style: "text-amber-600",
  refactor: "text-purple-600",
  test: "text-gray-600",
  chore: "text-gray-400",
  other: "text-slate-700",
};

const typeEmoji = {
  feat: "🚀 新功能",
  fix: "🐞 修复",
  docs: "📝 文档",
  style: "🎨 样式",
  refactor: "🔧 重构",
  test: "✅ 测试",
  chore: "📦 构建",
  other: "🌀 其他",
};

// HTML 模板
const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>更新日志 - 同人文平台</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50 text-gray-900">
  <header class="bg-white shadow sticky top-0 z-30">
    <div class="max-w-5xl mx-auto p-4 flex justify-between items-center">
      <h1 class="text-xl font-bold">更新日志 (Changelog)</h1>
      <a href="../index.html" class="px-3 py-1 border rounded hover:bg-gray-100">返回首页</a>
    </div>
  </header>

  <main class="max-w-5xl mx-auto p-6 space-y-8">
    <section class="bg-white p-6 rounded shadow-sm">
      <h2 class="text-2xl font-semibold mb-3 text-indigo-600">📘 项目信息</h2>
      <p><strong>仓库：</strong> <a href="https://github.com/awealy/xiaoshuo" class="text-indigo-500 hover:underline">awealy/xiaoshuo</a></p>
      <p><strong>生成时间：</strong> ${new Date().toLocaleString("zh-CN")}</p>
      <p><strong>提交总数：</strong> ${commits.length}</p>
    </section>

    ${Object.entries(grouped)
      .filter(([_, list]) => list.length > 0)
      .map(
        ([type, list]) => `
        <section class="bg-white p-6 rounded shadow-sm">
          <h2 class="text-xl mb-3 ${typeStyle[type]}">${typeEmoji[type]}</h2>
          <ul class="divide-y divide-gray-200">
            ${list
              .map(
                c => `
              <li class="py-2 hover:bg-gray-50 px-2 rounded">
                <div class="flex justify-between items-center">
                  <span class="font-mono text-sm text-gray-400">${c.hash}</span>
                  <span class="text-sm text-gray-400">${c.date}</span>
                </div>
                <p class="mt-1 ${typeStyle[type]}">${c.message}</p>
              </li>`
              )
              .join("")}
          </ul>
        </section>`
      )
      .join("")}
  </main>

  <footer class="text-center text-sm text-gray-500 p-4 border-t">
    © ${new Date().getFullYear()} awealy | 自动生成日志 (gx/index.html)
  </footer>
</body>
</html>`;

// 创建 gx 目录并写入文件
if (!existsSync("gx")) mkdirSync("gx");
writeFileSync("gx/index.html", html, "utf-8");

console.log("✅ 已生成 gx/index.html — 含高亮分类与分组日志。");
