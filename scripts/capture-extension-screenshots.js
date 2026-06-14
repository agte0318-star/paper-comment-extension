const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const supabaseConfigSource = fs.readFileSync(path.join(root, "src", "config", "supabase.js"), "utf8");
const supabaseUrl = supabaseConfigSource.match(/url:\s*"([^"]+)"/)?.[1] || "";
const supabaseAnonKey = supabaseConfigSource.match(/anonKey:\s*"([^"]+)"/)?.[1] || "";
const version = manifest.version;
const edgeCandidates = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
];
const edgePath = edgeCandidates.find((candidate) => fs.existsSync(candidate));
const manualExtensionDir = path.join(root, "release", "manual-test", `paper-comment-extension-${version}`);
const screenshotDir = path.join(root, "release", "store-assets", version, "screenshots");
const profileDir = path.join(root, "release", "browser-extension-screenshot-profile");
const remoteDebuggingPort = Number(process.env.PCE_SCREENSHOT_PORT || 9335);
const paperUrl = process.env.PCE_SCREENSHOT_PAPER_URL || "https://arxiv.org/abs/1706.03762";

const screenshotTargets = {
  closed: path.join(screenshotDir, "01-sidebar-closed.png"),
  open: path.join(screenshotDir, "02-sidebar-open-paper-id.png"),
  auth: path.join(screenshotDir, "03-sign-in-dialog.png"),
  popup: path.join(screenshotDir, "08-popup-actions.png"),
  rating: path.join(screenshotDir, "04-rating-panel.png"),
  comment: path.join(screenshotDir, "05-comment-rated.png"),
  replies: path.join(screenshotDir, "06-comment-replies-actions.png"),
  report: path.join(screenshotDir, "07-report-form.png")
};
const paper = {
  key: "arxiv:1706.03762",
  arxivId: "1706.03762",
  url: "https://arxiv.org/abs/1706.03762",
  title: "Attention Is All You Need",
  source: "arXiv"
};

let browserProcess = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getSignedInAccountEnv() {
  return {
    email: process.env.PCE_TEST_EMAIL || process.env.PCE_TEST_READER_EMAIL || "",
    password: process.env.PCE_TEST_PASSWORD || process.env.PCE_TEST_READER_PASSWORD || ""
  };
}

function getSeedAccountEnv() {
  return {
    author: {
      email: process.env.PCE_TEST_AUTHOR_EMAIL || "",
      password: process.env.PCE_TEST_AUTHOR_PASSWORD || ""
    },
    reader: getSignedInAccountEnv()
  };
}

function hasSeedAccounts() {
  const accounts = getSeedAccountEnv();
  return Boolean(accounts.author.email && accounts.author.password && accounts.reader.email && accounts.reader.password);
}

function ensurePreconditions() {
  if (!edgePath) {
    throw new Error("Microsoft Edge was not found. Capture extension screenshots manually or install Edge.");
  }
  if (!fs.existsSync(path.join(manualExtensionDir, "manifest.json"))) {
    throw new Error(`Packaged manual-test extension is missing. Run npm.cmd run prepare:manual-test first: ${manualExtensionDir}`);
  }
  fs.mkdirSync(screenshotDir, { recursive: true });
  fs.mkdirSync(profileDir, { recursive: true });
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`CDP request failed ${response.status}: ${url}`);
  return response.json();
}

function getSupabaseHeaders(session = null, extra = {}) {
  const token = session?.access_token || supabaseAnonKey;
  return {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...extra
  };
}

async function supabaseRequest(apiPath, options = {}, session = null) {
  const response = await fetch(`${supabaseUrl}${apiPath}`, {
    method: options.method || "GET",
    headers: getSupabaseHeaders(session, options.headers),
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = payload?.message || payload?.msg || payload?.error_description || text || "Supabase request failed.";
    throw new Error(message);
  }
  return payload;
}

async function signInForSeed(email, password) {
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: getSupabaseHeaders(),
    body: JSON.stringify({ email, password })
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = payload?.msg || payload?.message || payload?.error_description || "Authentication failed.";
    throw new Error(`Could not sign in test account ${email}: ${message}`);
  }
  return payload;
}

async function ensurePaper(session) {
  const existing = await supabaseRequest(`/rest/v1/papers?paper_key=eq.${encodeURIComponent(paper.key)}&select=*`, {}, session);
  if (existing[0]) return existing[0];

  const rows = await supabaseRequest("/rest/v1/papers?on_conflict=paper_key&select=*", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,select=representation" },
    body: {
      paper_key: paper.key,
      arxiv_id: paper.arxivId,
      url: paper.url,
      title: paper.title,
      source: paper.source
    }
  }, session);
  return rows[0];
}

async function ensureRating(session, paperRow, score) {
  const existing = await supabaseRequest(`/rest/v1/ratings?paper_id=eq.${paperRow.id}&user_id=eq.${session.user.id}&select=id`, {}, session);
  if (existing[0]) return existing[0];

  const rows = await supabaseRequest("/rest/v1/ratings?select=*", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: {
      paper_id: paperRow.id,
      user_id: session.user.id,
      overall_score: score
    }
  }, session);
  return rows[0];
}

async function ensureComment(session, paperRow) {
  const existing = await supabaseRequest(`/rest/v1/comments?paper_id=eq.${paperRow.id}&user_id=eq.${session.user.id}&status=eq.visible&select=*&order=created_at.desc&limit=1`, {}, session);
  if (existing[0]) return existing[0];

  const rows = await supabaseRequest("/rest/v1/comments?select=*", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: {
      paper_id: paperRow.id,
      user_id: session.user.id,
      content: "Helpful discussion point for testing the public comment flow."
    }
  }, session);
  return rows[0];
}

async function ensureReply(session, paperRow, comment) {
  const existing = await supabaseRequest(`/rest/v1/comment_replies?comment_id=eq.${comment.id}&user_id=eq.${session.user.id}&status=eq.visible&select=*&order=created_at.desc&limit=1`, {}, session);
  if (existing[0]) return existing[0];

  const rows = await supabaseRequest("/rest/v1/comment_replies?select=*", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: {
      comment_id: comment.id,
      paper_id: paperRow.id,
      user_id: session.user.id,
      content: "A concise reply for testing threaded discussion screenshots."
    }
  }, session);
  return rows[0];
}

async function ensureLike(session, comment) {
  const existing = await supabaseRequest(`/rest/v1/comment_likes?comment_id=eq.${comment.id}&user_id=eq.${session.user.id}&select=id`, {}, session);
  if (existing[0]) return existing[0];

  const rows = await supabaseRequest("/rest/v1/comment_likes?select=*", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: {
      comment_id: comment.id,
      user_id: session.user.id
    }
  }, session);
  return rows[0];
}

async function prepareSignedInScreenshotData() {
  if (!hasSeedAccounts()) {
    console.log("Skipped signed-in data seeding. Set PCE_TEST_AUTHOR_EMAIL/PCE_TEST_AUTHOR_PASSWORD and PCE_TEST_EMAIL/PCE_TEST_PASSWORD to capture 04-07.");
    return false;
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase config could not be read from src/config/supabase.js.");
  }

  const accounts = getSeedAccountEnv();
  const authorSession = await signInForSeed(accounts.author.email, accounts.author.password);
  const readerSession = await signInForSeed(accounts.reader.email, accounts.reader.password);
  const paperRow = await ensurePaper(authorSession);
  await ensureRating(authorSession, paperRow, 9);
  const comment = await ensureComment(authorSession, paperRow);
  await ensureReply(readerSession, paperRow, comment);
  await ensureLike(readerSession, comment).catch((error) => {
    console.log(`Like seed skipped: ${error.message}`);
  });
  console.log("Prepared signed-in screenshot data with the supplied test accounts.");
  return true;
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
      // Nothing useful to do during cleanup.
    }
  }
}

function launchEdge() {
  const args = [
    `--remote-debugging-port=${remoteDebuggingPort}`,
    `--user-data-dir=${profileDir}`,
    `--disable-extensions-except=${manualExtensionDir}`,
    `--load-extension=${manualExtensionDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-default-apps",
    "--disable-popup-blocking",
    "--window-size=1280,800",
    paperUrl
  ];
  browserProcess = childProcess.spawn(edgePath, args, {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  browserProcess.stdout.on("data", (chunk) => process.stdout.write(chunk));
  browserProcess.stderr.on("data", (chunk) => process.stderr.write(chunk));
}

async function findPageTarget() {
  const targets = await waitForJson(`http://127.0.0.1:${remoteDebuggingPort}/json/list`);
  return targets.find((target) => target.type === "page" && target.url.includes("arxiv.org"))
    || targets.find((target) => target.type === "page");
}

async function waitForExpression(client, expression, timeoutMs = 20000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const result = await client.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (result.result?.value) return true;
    await sleep(500);
  }
  return false;
}

async function evaluate(client, expression) {
  return client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
}

async function screenshot(client, filePath) {
  const result = await client.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false
  });
  fs.writeFileSync(filePath, Buffer.from(result.data, "base64"));
  console.log(`Captured ${path.basename(filePath)}: ${filePath}`);
}

async function preparePage(client) {
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false
  });
  await client.send("Page.navigate", { url: paperUrl });
  await waitForExpression(client, "document.readyState === 'complete'", 30000);
  const hasToggle = await waitForExpression(client, "Boolean(document.querySelector('#paper-comment-extension-root .pce-toggle'))", 30000);
  if (!hasToggle) {
    throw new Error("Extension sidebar toggle did not appear on the paper page.");
  }
  await evaluate(client, "window.scrollTo(0, 0)");
  await sleep(1000);
}

async function capturePaperPageScreenshots(client) {
  await screenshot(client, screenshotTargets.closed);

  await evaluate(client, "document.querySelector('#paper-comment-extension-root .pce-toggle')?.click()");
  const hasPanel = await waitForExpression(client, "Boolean(document.querySelector('#paper-comment-extension-root .pce-panel'))", 10000);
  if (!hasPanel) throw new Error("Extension panel did not open.");
  await sleep(1000);
  await screenshot(client, screenshotTargets.open);

  await evaluate(client, "document.querySelector('#paper-comment-extension-root .pce-auth-chip')?.click()");
  const hasAuth = await waitForExpression(client, "Boolean(document.querySelector('#paper-comment-extension-root .pce-auth-dialog'))", 10000);
  if (!hasAuth) throw new Error("Sign-in dialog did not open.");
  await sleep(700);
  await screenshot(client, screenshotTargets.auth);

  const { email, password } = getSignedInAccountEnv();
  if (!email || !password) {
    console.log("Skipped signed-in rating screenshot. Set PCE_TEST_EMAIL and PCE_TEST_PASSWORD to capture 04-rating-panel.png.");
    return;
  }

  await evaluate(client, `
    (() => {
      const root = document.querySelector('#paper-comment-extension-root');
      root.querySelector('.pce-auth-input[type="email"]').value = ${JSON.stringify(email)};
      root.querySelector('.pce-auth-input[type="password"]').value = ${JSON.stringify(password)};
      root.querySelector('.pce-auth-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      return true;
    })()
  `);
  const signedIn = await waitForExpression(client, "Boolean(document.querySelector('#paper-comment-extension-root .pce-auth-chip.is-user'))", 20000);
  if (!signedIn) {
    console.log("Could not sign in automatically; leaving 04-rating-panel.png for manual capture.");
    return;
  }
  await evaluate(client, "document.querySelector('#paper-comment-extension-root .pce-rating-toggle')?.click()");
  const hasRating = await waitForExpression(client, "Boolean(document.querySelector('#paper-comment-extension-root .pce-rating-form'))", 10000);
  if (!hasRating) {
    console.log("Rating form did not open after sign-in; leaving 04-rating-panel.png for manual capture.");
    return;
  }
  await sleep(700);
  await screenshot(client, screenshotTargets.rating);

  await evaluate(client, "document.querySelector('#paper-comment-extension-root .pce-rating-toggle')?.click()");
  const hasComment = await waitForExpression(client, "Boolean(document.querySelector('#paper-comment-extension-root .pce-comment .pce-score-badge'))", 10000);
  if (!hasComment) {
    console.log("Seeded rated comment did not appear; leaving 05-07 for manual capture.");
    return;
  }
  await sleep(700);
  await screenshot(client, screenshotTargets.comment);

  await evaluate(client, `
    (() => {
      const panel = document.querySelector('#paper-comment-extension-root .pce-panel');
      const comment = document.querySelector('#paper-comment-extension-root .pce-comment');
      if (panel && comment) panel.scrollTop = Math.max(0, comment.offsetTop - 120);
      return Boolean(comment);
    })()
  `);
  await sleep(700);
  await screenshot(client, screenshotTargets.replies);

  await evaluate(client, `
    (() => {
      const buttons = [...document.querySelectorAll('#paper-comment-extension-root .pce-comment-actions .pce-action-button')];
      const report = buttons.find((button) => button.textContent.trim() === 'Report' && !button.disabled);
      if (!report) return false;
      report.click();
      return true;
    })()
  `);
  const hasReportForm = await waitForExpression(client, "Boolean(document.querySelector('#paper-comment-extension-root .pce-report-form'))", 10000);
  if (!hasReportForm) {
    console.log("Report form did not open; leaving 07-report-form.png for manual capture.");
    return;
  }
  await sleep(700);
  await screenshot(client, screenshotTargets.report);
}

async function capturePopupScreenshot() {
  const targets = await fetchJson(`http://127.0.0.1:${remoteDebuggingPort}/json/list`);
  const extensionTarget = targets.find((target) => target.url.startsWith("chrome-extension://") && target.url.includes("/src/background/auth.js"));
  if (!extensionTarget) {
    console.log("Extension background target not found; leaving 08-popup-actions.png for manual capture.");
    return;
  }
  const extensionId = new URL(extensionTarget.url).host;
  const popupUrl = `chrome-extension://${extensionId}/src/popup/popup.html`;
  const popupTarget = await fetchJson(`http://127.0.0.1:${remoteDebuggingPort}/json/new?${encodeURIComponent(popupUrl)}`, { method: "PUT" });
  const popupClient = new CdpClient(popupTarget.webSocketDebuggerUrl);
  await popupClient.connect();
  try {
    await popupClient.send("Page.enable");
    await popupClient.send("Runtime.enable");
    await popupClient.send("Emulation.setDeviceMetricsOverride", {
      width: 640,
      height: 400,
      deviceScaleFactor: 1,
      mobile: false
    });
    await waitForExpression(popupClient, "document.readyState === 'complete'", 10000);
    await sleep(1000);
    await screenshot(popupClient, screenshotTargets.popup);
  } finally {
    popupClient.close();
  }
}

async function main() {
  ensurePreconditions();
  await prepareSignedInScreenshotData();
  launchEdge();
  try {
    const target = await findPageTarget();
    if (!target?.webSocketDebuggerUrl) throw new Error("Could not find an Edge page target.");
    const client = new CdpClient(target.webSocketDebuggerUrl);
    await client.connect();
    try {
      await preparePage(client);
      await capturePaperPageScreenshots(client);
    } finally {
      client.close();
    }
    await capturePopupScreenshot();
  } finally {
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
