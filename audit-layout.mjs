const target = process.argv[2] || "/help/faq";
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
await command("Emulation.setDeviceMetricsOverride", {
  width: 375,
  height: 812,
  deviceScaleFactor: 1,
  mobile: true,
});
await command("Page.navigate", { url: `http://127.0.0.1:3000${target}` });
await new Promise((resolve) => setTimeout(resolve, 800));
const expression = `JSON.stringify({
  url: location.pathname,
  viewport: innerWidth,
  scrollWidth: document.documentElement.scrollWidth,
  bodyWidth: document.body.scrollWidth,
  bodyDirection: getComputedStyle(document.body).direction,
  shell: document.querySelector('.app-shell')?.getBoundingClientRect().toJSON(),
  stage: document.querySelector('.page-stage')?.getBoundingClientRect().toJSON(),
  completion: document.querySelector('.completion-page')?.getBoundingClientRect().toJSON(),
  content: [...document.querySelectorAll('.detail-narrow,.collection-page,.media-grid,.completion-page,.social-narrow,.admin-page')].map(el => ({cls: el.className, rect: el.getBoundingClientRect().toJSON()})),
  overwide: [...document.querySelectorAll('*')].filter(el => el.getBoundingClientRect().width > innerWidth + 1).slice(0,12).map(el => ({tag: el.tagName, cls: el.className, width: Math.round(el.getBoundingClientRect().width), left: Math.round(el.getBoundingClientRect().left)}))
})`;
const result = await command("Runtime.evaluate", { expression, returnByValue: true });
console.log(result.result.result.value);
socket.close();
