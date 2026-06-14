const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const baseUrl = process.env.PCE_PUBLIC_BASE_URL || "https://agte0318-star.github.io/paper-comment-extension/";
const remoteDebuggingPort = Number(process.env.PCE_PUBLIC_RENDER_PORT || 9337);
const profileDir = path.join(root, "release", "browser-public-render-profile");
const edgeCandidates = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
];
const edgePath = edgeCandidates.find((candidate) => fs.existsSync(candidate));

let browserProcess = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolvePublicUrl(relativePath) {
  return new URL(relativePath, baseUrl).toString();
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`CDP request failed ${response.status}: ${url}`);
  return response.json();
}

async function waitForJson(url, timeoutMs = 15000) {
  const startedAt = Date.now();
  let lastError = null;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      return await fetchJson(url);
    } catch (error) {
      lastError = error;
      await sleep(250);
    }
  }
  throw lastError || new Error(`Timed out waiting for ${url}`);
}

class CdpClient {
  constructor(webSocketUrl) {
    this.webSocketUrl = webSocketUrl;
    this.nextId = 1;
    this.pending = new Map();
  }

  async connect() {
    this.socket = new WebSocket(this.webSocketUrl);
    this.socket.addEventListener("message", (event) => this.handleMessage(event));
    await new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
  }

  handleMessage(event) {
    const message = JSON.parse(event.data);
    if (!message.id || !this.pending.has(message.id)) return;
    const { resolve, reject } = this.pending.get(message.id);
    this.pending.delete(message.id);
    if (message.error) {
      reject(new Error(message.error.message || JSON.stringify(message.error)));
      return;
    }
    resolve(message.result || {});
  }

  send(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;
    const payload = JSON.stringify({ id, method, params });
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(payload);
    });
  }

  close() {
    try {
      this.socket?.close();
    } catch (error) {
      // Cleanup only.
    }
  }
}

function ensurePreconditions() {
  if (!edgePath) {
    throw new Error("Microsoft Edge was not found. Install Edge or run this public render check manually.");
  }
  fs.mkdirSync(profileDir, { recursive: true });
}

function launchEdge() {
  const args = [
    `--remote-debugging-port=${remoteDebuggingPort}`,
    `--user-data-dir=${profileDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-default-apps",
    "--disable-popup-blocking",
    "--window-size=1280,800",
    "about:blank"
  ];
  browserProcess = childProcess.spawn(edgePath, args, {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  browserProcess.stdout.on("data", (chunk) => process.stdout.write(chunk));
  browserProcess.stderr.on("data", (chunk) => process.stderr.write(chunk));
}

async function getClient() {
  const targets = await waitForJson(`http://127.0.0.1:${remoteDebuggingPort}/json/list`);
  const target = targets.find((item) => item.type === "page");
  if (!target?.webSocketDebuggerUrl) throw new Error("Could not find an Edge page target.");
  const client = new CdpClient(target.webSocketDebuggerUrl);
  await client.connect();
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false
  });
  return client;
}

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "Browser evaluation failed.");
  }
  return result.result?.value;
}

async function navigate(client, url) {
  await client.send("Page.navigate", { url });
  const ready = await waitForExpression(client, "document.readyState === 'complete'", 30000);
  if (!ready) throw new Error(`Page did not finish loading: ${url}`);
}

async function waitForExpression(client, expression, timeoutMs = 20000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await evaluate(client, expression)) return true;
    await sleep(500);
  }
  return false;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function checkTrending(client) {
  const url = resolvePublicUrl("web/trending.html");
  await navigate(client, url);
  const rendered = await waitForExpression(client, `
    Boolean(document.querySelector('[data-metrics] .metric')) &&
    Boolean(document.querySelector('[data-most-discussed] .paper-item, [data-most-discussed] .empty-state')) &&
    Boolean(document.querySelector('[data-hot-comments] .comment-item, [data-hot-comments] .empty-state'))
  `, 30000);
  assert(rendered, "Trending page did not render metrics, paper list, and hot comments/empty state.");

  const searchWorks = await evaluate(client, `
    (() => {
      const search = document.querySelector('[data-trending-search]');
      const list = document.querySelector('[data-most-discussed]');
      if (!search || !list) return false;
      search.value = 'Nano Research';
      search.dispatchEvent(new Event('input', { bubbles: true }));
      return list.textContent.includes('Nano Research') || document.querySelector('[data-most-discussed-status]')?.textContent.includes('matching');
    })()
  `);
  assert(searchWorks, "Trending search did not filter or update the result status.");

  const sortWorks = await evaluate(client, `
    (() => {
      const sort = document.querySelector('[data-trending-sort]');
      if (!sort) return false;
      document.querySelector('[data-trending-search]').value = '';
      document.querySelector('[data-trending-search]').dispatchEvent(new Event('input', { bubbles: true }));
      sort.value = 'rating';
      sort.dispatchEvent(new Event('change', { bubbles: true }));
      return document.querySelector('[data-most-discussed-status]')?.textContent.includes('Sorted by average rating');
    })()
  `);
  assert(sortWorks, "Trending sort did not update to rating mode.");
  console.log(`OK rendered trending page: ${url}`);
}

async function checkPaper(client) {
  const url = resolvePublicUrl("web/paper.html?id=paper-1");
  await navigate(client, url);
  const rendered = await waitForExpression(client, `
    Boolean(document.querySelector('[data-paper-detail] .paper-hero, [data-paper-detail] .empty-state')) &&
    Boolean(document.querySelector('[data-paper-share-url]')) &&
    Boolean(document.querySelector('[data-paper-comments] .comment-item, [data-paper-comments] .empty-state'))
  `, 30000);
  assert(rendered, "Paper discussion page did not render detail, comments/empty state, and share controls.");

  const shareUrlOk = await evaluate(client, `
    document.querySelector('[data-paper-share-url]')?.value.includes('paper.html?id=paper-1')
  `);
  assert(shareUrlOk, "Paper discussion page did not populate the share URL.");

  const copyWorks = await evaluate(client, `
    (async () => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async (text) => { window.__pceCopiedText = text; } }
      });
      document.querySelector('[data-copy-paper-link]').click();
      await new Promise((resolve) => setTimeout(resolve, 250));
      return window.__pceCopiedText?.includes('paper.html?id=paper-1') &&
        document.querySelector('[data-copy-status]')?.textContent.includes('Link copied');
    })()
  `);
  assert(copyWorks, "Paper discussion copy action did not copy the share URL.");

  const shareWorks = await evaluate(client, `
    (async () => {
      delete window.__pceCopiedText;
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: undefined
      });
      document.querySelector('[data-share-paper-link]').click();
      await new Promise((resolve) => setTimeout(resolve, 250));
      const status = document.querySelector('[data-copy-status]')?.textContent || '';
      return status.includes('Sharing is not available') || status.includes('Link copied') || status.includes('Share sheet opened');
    })()
  `);
  assert(shareWorks, "Paper discussion share action did not produce a user-visible result.");
  console.log(`OK rendered paper discussion page and share actions: ${url}`);
}

async function checkProfileSignedOut(client) {
  const url = resolvePublicUrl("web/profile.html");
  await navigate(client, url);
  const rendered = await waitForExpression(client, `
    Boolean(document.querySelector('[data-profile-auth] form')) &&
    document.querySelector('[data-profile-auth]')?.textContent.includes('Sign in to your profile') &&
    document.querySelector('[data-profile-protected]')?.hidden === true
  `, 30000);
  assert(rendered, "Profile page did not render the signed-out auth panel with protected activity hidden.");
  console.log(`OK rendered signed-out profile page: ${url}`);
}

async function main() {
  ensurePreconditions();
  launchEdge();
  let client = null;
  try {
    client = await getClient();
    await checkTrending(client);
    await checkPaper(client);
    await checkProfileSignedOut(client);
    console.log("Public web render check passed.");
  } finally {
    client?.close();
    if (browserProcess && !browserProcess.killed) {
      browserProcess.kill();
    }
  }
}

main().catch((error) => {
  if (browserProcess && !browserProcess.killed) {
    browserProcess.kill();
  }
  console.error(error.message);
  process.exit(1);
});
