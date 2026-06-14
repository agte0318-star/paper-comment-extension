const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const version = manifest.version;
const manualExtensionDir = path.join(root, "release", "manual-test", `paper-comment-extension-${version}`);
const demoExtensionDir = path.join(root, "release", "auth-gate-demo-extension", `paper-comment-extension-${version}`);
const profileDir = path.join(root, "release", "browser-auth-gate-profile");
const remoteDebuggingPort = Number(process.env.PCE_AUTH_GATE_PORT || 9338);
const paperUrl = process.env.PCE_SCREENSHOT_PAPER_URL || "https://arxiv.org/abs/1706.03762";
const edgeCandidates = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
];
const edgePath = edgeCandidates.find((candidate) => fs.existsSync(candidate));

let browserProcess = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensurePreconditions() {
  if (!edgePath) {
    throw new Error("Microsoft Edge was not found. Install Edge or run extension auth-gate checks manually.");
  }
  if (!fs.existsSync(path.join(manualExtensionDir, "manifest.json"))) {
    throw new Error(`Packaged manual-test extension is missing. Run npm.cmd run prepare:manual-test first: ${manualExtensionDir}`);
  }
  fs.rmSync(demoExtensionDir, { recursive: true, force: true });
  fs.cpSync(manualExtensionDir, demoExtensionDir, { recursive: true });
  writeSignedOutDemoCloudClient();
  fs.mkdirSync(profileDir, { recursive: true });
}

function writeSignedOutDemoCloudClient() {
  const targetPath = path.join(demoExtensionDir, "src", "cloud", "supabaseClient.js");
  const now = new Date().toISOString();
  const source = `(() => {
  const namespace = (window.PaperComment = window.PaperComment || {});
  const comments = [
    {
      id: "auth-demo-comment-popular",
      paperKey: "arxiv:1706.03762",
      userId: "demo-author-a",
      content: "This discussion sample exists only to test signed-out Like, Reply, Share, and Report auth gates.",
      likeCount: 25,
      likedBy: [],
      ratingScore: 9,
      replyCount: 1,
      createdAt: ${JSON.stringify(now)},
      replies: [
        {
          id: "auth-demo-reply",
          commentId: "auth-demo-comment-popular",
          userId: "demo-author-b",
          author: "Researcher",
          content: "Reply sample for auth-gate verification.",
          createdAt: ${JSON.stringify(now)}
        }
      ]
    },
    {
      id: "auth-demo-comment-new",
      paperKey: "arxiv:1706.03762",
      userId: "demo-author-c",
      content: "A newer lower-like comment lets the sort control prove newest versus popularity.",
      likeCount: 1,
      likedBy: [],
      ratingScore: 7,
      replyCount: 0,
      createdAt: ${JSON.stringify(new Date(Date.now() + 60000).toISOString())},
      replies: []
    }
  ];

  namespace.cloudStore = {
    isConfigured: () => true,
    getCurrentUser: async () => null,
    getCurrentProfile: async () => null,
    getLocalUserId: async () => null,
    signUp: async () => { throw new Error("Demo sign-up is disabled."); },
    signIn: async () => { throw new Error("Demo sign-in is disabled."); },
    signInWithGoogle: async () => { throw new Error("Demo Google sign-in is disabled."); },
    sendPasswordReset: async () => ({}),
    signOut: async () => {},
    listComments: async () => comments,
    hasCommentedToday: async () => false,
    getPaperRating: async () => null,
    getPaperRatingSummary: async () => ({ count: 2, average: 8 }),
    canUpdateRatingToday: async () => true,
    savePaperRating: async () => { throw new Error("Sign in to rate this paper."); },
    addComment: async () => { throw new Error("Sign in to post a comment."); },
    addReply: async () => { throw new Error("Sign in to reply."); },
    toggleCommentLike: async () => { throw new Error("Sign in to like comments."); },
    reportComment: async () => { throw new Error("Sign in to report comments."); },
    reportReply: async () => { throw new Error("Sign in to report replies."); }
  };
})();`;
  fs.writeFileSync(targetPath, source);
}

async function fetchJson(url) {
  const response = await fetch(url);
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

async function getClient() {
  const targets = await waitForJson(`http://127.0.0.1:${remoteDebuggingPort}/json/list`);
  const target = targets.find((item) => item.type === "page" && item.url.includes("arxiv.org"))
    || targets.find((item) => item.type === "page");
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

async function preparePage(client) {
  await waitForExpression(client, "document.readyState === 'complete'", 30000);
  const hasToggle = await waitForExpression(client, "Boolean(document.querySelector('#paper-comment-extension-root .pce-toggle'))", 30000);
  assert(hasToggle, "Extension toggle did not appear.");
  await evaluate(client, "document.querySelector('#paper-comment-extension-root .pce-toggle').click()");
  const hasPanel = await waitForExpression(client, "Boolean(document.querySelector('#paper-comment-extension-root .pce-panel'))", 10000);
  assert(hasPanel, "Extension panel did not open.");
  const signedOut = await waitForExpression(client, "document.querySelector('#paper-comment-extension-root .pce-auth-chip')?.textContent.includes('Sign in')", 10000);
  assert(signedOut, "Demo extension did not render signed-out state.");
  const hasDemoComment = await waitForExpression(client, "Boolean(document.querySelector('#paper-comment-extension-root .pce-comment'))", 10000);
  assert(hasDemoComment, "Demo comments did not render.");
}

async function closeAuthModal(client) {
  await evaluate(client, `
    (() => {
      const close = document.querySelector('#paper-comment-extension-root .pce-auth-icon-button');
      if (close) close.click();
      return true;
    })()
  `);
  await sleep(250);
}

async function assertAuthMessageAfter(client, label, clickExpression, expectedMessage) {
  await closeAuthModal(client);
  const clicked = await evaluate(client, clickExpression);
  assert(clicked, `${label} target was not found.`);
  const hasMessage = await waitForExpression(client, `
    (() => {
      const dialog = document.querySelector('#paper-comment-extension-root .pce-auth-dialog');
      const message = document.querySelector('#paper-comment-extension-root .pce-auth-message.is-visible');
      return Boolean(dialog && message && message.textContent.includes(${JSON.stringify(expectedMessage)}));
    })()
  `, 10000);
  assert(hasMessage, `${label} did not open the expected sign-in modal message.`);
  console.log(`OK signed-out ${label} opens sign-in modal.`);
}

async function checkAuthGates(client) {
  await assertAuthMessageAfter(
    client,
    "Rate",
    `
      (() => {
        const button = document.querySelector('#paper-comment-extension-root .pce-rating-toggle');
        if (!button) return false;
        button.click();
        return true;
      })()
    `,
    "Sign in to rate this paper."
  );

  await assertAuthMessageAfter(
    client,
    "comment button",
    `
      (() => {
        const button = document.querySelector('#paper-comment-extension-root .pce-form .pce-submit');
        if (!button) return false;
        button.click();
        return true;
      })()
    `,
    "Sign in to join the discussion."
  );

  await assertAuthMessageAfter(
    client,
    "Like",
    `
      (() => {
        const button = [...document.querySelectorAll('#paper-comment-extension-root .pce-comment-actions .pce-action-button')]
          .find((item) => item.textContent.trim().startsWith('Like'));
        if (!button) return false;
        button.click();
        return true;
      })()
    `,
    "Sign in to like comments."
  );

  await assertAuthMessageAfter(
    client,
    "Reply",
    `
      (() => {
        const button = [...document.querySelectorAll('#paper-comment-extension-root .pce-comment-actions .pce-action-button')]
          .find((item) => item.textContent.trim().startsWith('Reply'));
        if (!button) return false;
        button.click();
        return true;
      })()
    `,
    "Sign in to reply."
  );

  await assertAuthMessageAfter(
    client,
    "Report",
    `
      (() => {
        const button = [...document.querySelectorAll('#paper-comment-extension-root .pce-comment-actions .pce-action-button')]
          .find((item) => item.textContent.trim() === 'Report');
        if (!button) return false;
        button.click();
        return true;
      })()
    `,
    "Sign in to report comments."
  );
}

async function checkSorting(client) {
  await closeAuthModal(client);
  const ok = await evaluate(client, `
    (() => {
      const firstText = () => document.querySelector('#paper-comment-extension-root .pce-comment .pce-comment-body')?.textContent || '';
      const newest = [...document.querySelectorAll('#paper-comment-extension-root .pce-sort-button')]
        .find((button) => button.textContent.trim() === 'Newest');
      const popular = [...document.querySelectorAll('#paper-comment-extension-root .pce-sort-button')]
        .find((button) => button.textContent.trim() === 'Popular');
      if (!newest || !popular) return false;
      newest.click();
      const newestFirst = firstText();
      popular.click();
      const popularFirst = firstText();
      return newestFirst.includes('newer lower-like') && popularFirst.includes('signed-out Like');
    })()
  `);
  assert(ok, "Comment sorting did not switch between newest and popular ordering.");
  console.log("OK comment sorting switches between newest and popular.");
}

async function main() {
  ensurePreconditions();
  launchEdge();
  let client = null;
  try {
    client = await getClient();
    await preparePage(client);
    await checkAuthGates(client);
    await checkSorting(client);
    console.log("Extension auth-gate check passed.");
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
