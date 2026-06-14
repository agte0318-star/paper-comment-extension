const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const version = manifest.version;
const edgeCandidates = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
];
const edgePath = edgeCandidates.find((candidate) => fs.existsSync(candidate));
const manualExtensionDir = path.join(root, "release", "manual-test", `paper-comment-extension-${version}`);
const demoExtensionDir = path.join(root, "release", "screenshot-demo-extension", `paper-comment-extension-${version}`);
const screenshotDir = path.join(root, "release", "store-assets", version, "screenshots");
const profileDir = path.join(root, "release", "browser-demo-screenshot-profile");
const remoteDebuggingPort = Number(process.env.PCE_DEMO_SCREENSHOT_PORT || 9336);
const paperUrl = process.env.PCE_SCREENSHOT_PAPER_URL || "https://arxiv.org/abs/1706.03762";

const screenshotTargets = {
  rating: path.join(screenshotDir, "04-rating-panel.png"),
  comment: path.join(screenshotDir, "05-comment-rated.png"),
  replies: path.join(screenshotDir, "06-comment-replies-actions.png"),
  report: path.join(screenshotDir, "07-report-form.png")
};

let browserProcess = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensurePreconditions() {
  if (!edgePath) {
    throw new Error("Microsoft Edge was not found. Capture demo interaction screenshots manually or install Edge.");
  }
  if (!fs.existsSync(path.join(manualExtensionDir, "manifest.json"))) {
    throw new Error(`Packaged manual-test extension is missing. Run npm.cmd run prepare:manual-test first: ${manualExtensionDir}`);
  }
  fs.mkdirSync(screenshotDir, { recursive: true });
  fs.rmSync(demoExtensionDir, { recursive: true, force: true });
  fs.cpSync(manualExtensionDir, demoExtensionDir, { recursive: true });
  writeDemoCloudClient();
  fs.mkdirSync(profileDir, { recursive: true });
}

function writeDemoCloudClient() {
  const targetPath = path.join(demoExtensionDir, "src", "cloud", "supabaseClient.js");
  const source = `(() => {
  const namespace = (window.PaperComment = window.PaperComment || {});
  const reader = {
    id: "demo-reader",
    email: "reader@example.invalid",
    app_metadata: {},
    user_metadata: {}
  };
  const profile = {
    id: "demo-reader",
    display_name: "Reader",
    role: "user",
    status: "active"
  };
  const authorId = "demo-author";
  const now = new Date().toISOString();
  const commentsByPaper = new Map();

  function buildDemoComments(paperKey) {
    return [
      {
        id: "demo-comment-1",
        paperKey,
        userId: authorId,
        content: "This paper gives a clean baseline for attention-only sequence modeling. I would like to see more discussion on evaluation transfer and failure cases.",
        likeCount: 12,
        likedBy: ["demo-reader"],
        ratingScore: 9,
        replyCount: 2,
        createdAt: now,
        replies: [
          {
            id: "demo-reply-1",
            commentId: "demo-comment-1",
            userId: "demo-colleague",
            author: "Researcher",
            content: "The ablations are especially useful for comparing attention heads and model depth.",
            createdAt: now
          },
          {
            id: "demo-reply-2",
            commentId: "demo-comment-1",
            userId: "demo-reader",
            author: "Reader",
            content: "Agreed. A shared discussion space makes those caveats easier to track.",
            createdAt: now
          }
        ]
      }
    ];
  }

  function getComments(paperKey) {
    if (!commentsByPaper.has(paperKey)) commentsByPaper.set(paperKey, buildDemoComments(paperKey));
    return commentsByPaper.get(paperKey);
  }

  namespace.cloudStore = {
    isConfigured: () => true,
    getCurrentUser: async () => reader,
    getCurrentProfile: async () => profile,
    getLocalUserId: async () => reader.id,
    signUp: async () => ({ access_token: "demo" }),
    signIn: async () => ({ access_token: "demo", user: reader }),
    signInWithGoogle: async () => ({ access_token: "demo", user: reader }),
    sendPasswordReset: async () => ({}),
    signOut: async () => {},
    listComments: async (paperKey) => getComments(paperKey),
    hasCommentedToday: async () => false,
    getPaperRating: async () => null,
    getPaperRatingSummary: async () => ({ count: 128, average: 8.7 }),
    canUpdateRatingToday: async () => true,
    savePaperRating: async () => {},
    addComment: async (paperKey, input) => {
      const comments = getComments(paperKey);
      comments.unshift({
        id: "demo-comment-new",
        paperKey,
        userId: reader.id,
        content: input.content,
        likeCount: 0,
        likedBy: [],
        ratingScore: null,
        replyCount: 0,
        createdAt: new Date().toISOString(),
        replies: []
      });
    },
    addReply: async (paperKey, commentId, input) => {
      const comment = getComments(paperKey).find((item) => item.id === commentId);
      if (!comment) return;
      comment.replies.push({
        id: "demo-reply-new",
        commentId,
        userId: reader.id,
        author: "Reader",
        content: input.content,
        createdAt: new Date().toISOString()
      });
      comment.replyCount = comment.replies.length;
    },
    toggleCommentLike: async () => {},
    reportComment: async () => {},
    reportReply: async () => {}
  };
})();`;
  fs.writeFileSync(targetPath, source);
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

function launchEdge() {
  const args = [
    `--remote-debugging-port=${remoteDebuggingPort}`,
    `--user-data-dir=${profileDir}`,
    `--disable-extensions-except=${demoExtensionDir}`,
    `--load-extension=${demoExtensionDir}`,
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
  if (!hasToggle) throw new Error("Extension sidebar toggle did not appear on the paper page.");
  await evaluate(client, "window.scrollTo(0, 0)");
  await evaluate(client, "document.querySelector('#paper-comment-extension-root .pce-toggle')?.click()");
  const hasPanel = await waitForExpression(client, "Boolean(document.querySelector('#paper-comment-extension-root .pce-panel'))", 10000);
  if (!hasPanel) throw new Error("Extension panel did not open.");
  const signedIn = await waitForExpression(client, "Boolean(document.querySelector('#paper-comment-extension-root .pce-auth-chip.is-user'))", 10000);
  if (!signedIn) throw new Error("Demo extension did not render signed-in state.");
  await sleep(1000);
}

async function captureDemoInteractionScreenshots(client) {
  await evaluate(client, "document.querySelector('#paper-comment-extension-root .pce-rating-toggle')?.click()");
  const hasRating = await waitForExpression(client, "Boolean(document.querySelector('#paper-comment-extension-root .pce-rating-form'))", 10000);
  if (!hasRating) throw new Error("Rating form did not open.");
  await sleep(700);
  await screenshot(client, screenshotTargets.rating);

  await evaluate(client, "document.querySelector('#paper-comment-extension-root .pce-rating-toggle')?.click()");
  const hasComment = await waitForExpression(client, "Boolean(document.querySelector('#paper-comment-extension-root .pce-comment .pce-score-badge'))", 10000);
  if (!hasComment) throw new Error("Demo comment with rating badge did not render.");
  await evaluate(client, `
    (() => {
      const panel = document.querySelector('#paper-comment-extension-root .pce-panel');
      const comment = document.querySelector('#paper-comment-extension-root .pce-comment');
      if (panel && comment) panel.scrollTop = Math.max(0, comment.offsetTop - 120);
      return true;
    })()
  `);
  await sleep(700);
  await screenshot(client, screenshotTargets.comment);

  const hasReplies = await waitForExpression(client, "Boolean(document.querySelector('#paper-comment-extension-root .pce-reply'))", 10000);
  if (!hasReplies) throw new Error("Demo replies did not render.");
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
  if (!hasReportForm) throw new Error("Report form did not open.");
  await evaluate(client, `
    (() => {
      const panel = document.querySelector('#paper-comment-extension-root .pce-panel');
      const reportForm = document.querySelector('#paper-comment-extension-root .pce-report-form');
      if (panel && reportForm) {
        reportForm.scrollIntoView({ block: 'center', inline: 'nearest' });
        const panelRect = panel.getBoundingClientRect();
        const formRect = reportForm.getBoundingClientRect();
        panel.scrollTop += formRect.top - panelRect.top - 260;
      }
      return Boolean(reportForm);
    })()
  `);
  await sleep(700);
  await screenshot(client, screenshotTargets.report);
}

async function main() {
  ensurePreconditions();
  launchEdge();
  try {
    const target = await findPageTarget();
    if (!target?.webSocketDebuggerUrl) throw new Error("Could not find an Edge page target.");
    const client = new CdpClient(target.webSocketDebuggerUrl);
    await client.connect();
    try {
      await preparePage(client);
      await captureDemoInteractionScreenshots(client);
    } finally {
      client.close();
    }
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
