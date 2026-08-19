const targets = [
  "/friend-suggestions", "/friends/mutual", "/followers", "/following", "/friend-requests", "/friendship/manage", "/blocked", "/blocked/unblock",
  "/help", "/help/faq", "/help/report", "/help/report/status", "/help/contact",
  "/account/info", "/account/edit", "/account/contact/email", "/account/contact/phone", "/account/recovery", "/account/disable", "/account/delete",
  "/photos", "/videos", "/saved", "/albums", "/activity",
  "/admin", "/admin/analytics", "/admin/reports", "/admin/users", "/admin/content", "/admin/logs", "/admin/ai-analytics",
];

const tabs = await (await fetch("http://127.0.0.1:9222/json")).json();
const page = tabs.find((tab) => tab.type === "page");
if (!page?.webSocketDebuggerUrl) throw new Error("لم يتم العثور على جلسة متصفح للتدقيق");

const socket = new WebSocket(page.webSocketDebuggerUrl);
let nextId = 1;
const pending = new Map();
socket.addEventListener("message", ({ data }) => {
  const message = JSON.parse(data);
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message);
    pending.delete(message.id);
  }
});
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});
const command = (method, params = {}) => new Promise((resolve) => {
  const id = nextId++;
  pending.set(id, resolve);
  socket.send(JSON.stringify({ id, method, params }));
});

await command("Page.enable");
await command("Emulation.setDeviceMetricsOverride", { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
const results = [];
for (const target of targets) {
  await command("Page.navigate", { url: `http://127.0.0.1:3000${target}` });
  await new Promise((resolve) => setTimeout(resolve, 350));
  const expression = `JSON.stringify({
    path: location.pathname,
    h1: [...document.querySelectorAll('h1')].map((node) => node.textContent.trim()).filter(Boolean),
    notFound: document.body.innerText.includes('الصفحة غير موجودة'),
    direction: getComputedStyle(document.body).direction,
    scrollWidth: document.documentElement.scrollWidth,
    viewport: innerWidth
  })`;
  const evaluation = await command("Runtime.evaluate", { expression, returnByValue: true });
  results.push(JSON.parse(evaluation.result.result.value));
}
console.log(JSON.stringify(results, null, 2));
socket.close();
