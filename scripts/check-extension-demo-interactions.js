const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const version = manifest.version;
const manualExtensionDir = path.join(root, "release", "manual-test", `paper-comment-extension-${version}`);
const demoExtensionDir = path.join(root, "release", "interaction-demo-extension", `paper-comment-extension-${version}`);
const profileDir = path.join(root, "release", "browser-interaction-demo-profile");
const remoteDebuggingPort = Number(process.env.PCE_INTERACTION_DEMO_PORT || 9339);
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
    throw new Error("Microsoft Edge was not found. Install Edge or run extension interaction checks manually.");
  }
  if (!fs.existsSync(path.join(manualExtensionDir, "manifest.json"))) {
    throw new Error(`Packaged manual-test extension is missing. Run npm.cmd run prepare:manual-test first: ${manualExtensionDir}`);
  }
  fs.rmSync(demoExtensionDir, { recursive: true, force: true });
  fs.cpSync(manualExtensionDir, demoExtensionDir, { recursive: true });
  writeSignedInDemoCloudClient();
  fs.mkdirSync(profileDir, { recursive: true });
}

function writeSignedInDemoCloudClient() {
  const targetPath = path.join(demoExtensionDir, "src", "cloud", "supabaseClient.js");
  const source = `(() => {
  const namespace = (window.PaperComment = window.PaperComment || {});
  const reader = { id: "demo-reader", email: "reader@example.invalid" };
  const profile = { id: "demo-reader", display_name: "Reader", role: "user", status: "active" };
  const otherUser = "demo-author";
  const paperRatings = new Map();
  let hasCommented = false;
  let summary = { count: 1, average: 8 };
  const comments = [
    {
      id: "demo-main-comment",
      paperKey: "arxiv:1706.03762",
      userId: otherUser,
      content: "Core interaction demo comment for like, reply, report, and share testing.",
      likeCount: 1,
      likedBy: [],
      ratingScore: 8,
      replyCount: 1,
      createdAt: new Date(Date.now() - 60000).toISOString(),
      replies: [
        {
          id: "demo-main-reply",
          commentId: "demo-main-comment",
          userId: "demo-reply-author",
          author: "Researcher",
          content: "Reply target for report testing.",
          createdAt: new Date(Date.now() - 30000).toISOString()
        }
      ]
    }
  ];

  function getRating() {
    const score = paperRatings.get(reader.id);
    return score ? {
      id: "demo-rating",
      paperKey: "arxiv:1706.03762",
      userId: reader.id,
      scores: { overall: score },
      lastUpdatedDate: "2026-06-14",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } : null;
  }

  namespace.cloudStore = {
    isConfigured: () => true,
    getCurrentUser: async () => reader,
    getCurrentProfile: async () => profile,
    getLocalUserId: async () => reader.id,
    signUp: async () => ({ access_token: "demo", user: reader }),
    signIn: async () => ({ access_token: "demo", user: reader }),
    signInWithGoogle: async () => ({ access_token: "demo", user: reader }),
    sendPasswordReset: async () => ({}),
    signOut: async () => {},
    listComments: async () => comments,
    hasCommentedToday: async () => hasCommented,
    getPaperRating: async () => getRating(),
    getPaperRatingSummary: async () => summary,
    canUpdateRatingToday: async () => true,
    savePaperRating: async (paperKey, scores) => {
      paperRatings.set(reader.id, Number(scores.overall));
      summary = { count: 2, average: (8 + Number(scores.overall)) / 2 };
    },
    addComment: async (paperKey, input) => {
      if (hasCommented) throw new Error("One comment per paper per day.");
      hasCommented = true;
      comments.unshift({
        id: "demo-own-comment",
        paperKey,
        userId: reader.id,
        content: input.content,
        likeCount: 0,
        likedBy: [],
        ratingScore: paperRatings.get(reader.id) || null,
        replyCount: 0,
        createdAt: new Date().toISOString(),
        replies: []
      });
    },
    addReply: async (paperKey, commentId, input) => {
      const comment = comments.find((item) => item.id === commentId);
      if (!comment) return;
      comment.replies.push({
        id: "demo-added-reply",
        commentId,
        userId: reader.id,
        author: "Reader",
        content: input.content,
        createdAt: new Date().toISOString()
      });
      comment.replyCount = comment.replies.length;
    },
    toggleCommentLike: async (paperKey, commentId) => {
      const comment = comments.find((item) => item.id === commentId);
      if (!comment) return;
      if (comment.likedBy.includes(reader.id)) {
        comment.likedBy = comment.likedBy.filter((id) => id !== reader.id);
        comment.likeCount -= 1;
      } else {
        comment.likedBy.push(reader.id);
        comment.likeCount += 1;
      }
    },
    reportComment: async () => {},
    reportReply: async () => {}
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
    if (message.error) reject(new Error(message.error.message || JSON.stringify(message.error)));
    else resolve(message.result || {});
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
  browserProcess = childProcess.spawn(edgePath, [
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
  ], {
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
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "Browser evaluation failed.");
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
  assert(await waitForExpression(client, "Boolean(document.querySelector('#paper-comment-extension-root .pce-toggle'))", 30000), "Extension toggle did not appear.");
  await evaluate(client, "document.querySelector('#paper-comment-extension-root .pce-toggle').click()");
  assert(await waitForExpression(client, "Boolean(document.querySelector('#paper-comment-extension-root .pce-panel'))", 10000), "Extension panel did not open.");
  assert(await waitForExpression(client, "Boolean(document.querySelector('#paper-comment-extension-root .pce-auth-chip.is-user'))", 10000), "Signed-in demo state did not render.");
}

async function checkRating(client) {
  const ok = await evaluate(client, `
    (async () => {
      document.querySelector('#paper-comment-extension-root .pce-rating-toggle').click();
      await new Promise((resolve) => setTimeout(resolve, 150));
      const input = document.querySelector('#paper-comment-extension-root .pce-rating-input');
      input.value = '9';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('#paper-comment-extension-root .pce-rating-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 500));
      const root = document.querySelector('#paper-comment-extension-root');
      return root.querySelector('.pce-rating-score')?.textContent.trim() === '8.5' &&
        root.textContent.includes('Your score 9.0/10');
    })()
  `);
  assert(ok, "Rating submission did not update user score and community average.");
  console.log("OK rating can be submitted and community average updates.");
}

async function checkCommentLimit(client) {
  const ok = await evaluate(client, `
    (async () => {
      const root = document.querySelector('#paper-comment-extension-root');
      const input = root.querySelector('.pce-input');
      input.value = 'Automated demo comment for interaction QA.';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      root.querySelector('.pce-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 500));
      return root.textContent.includes('Automated demo comment for interaction QA.') &&
        root.textContent.includes('One comment per paper per day.') &&
        root.querySelector('.pce-form .pce-submit')?.disabled === true;
    })()
  `);
  assert(ok, "Comment posting or one-comment-per-day lock did not work.");
  console.log("OK comment can be posted and second same-day comment is blocked.");
}

async function checkLikeReplyReportShare(client) {
  const ok = await evaluate(client, `
    (async () => {
      const root = document.querySelector('#paper-comment-extension-root');
      const findDemoComment = () => [...root.querySelectorAll('.pce-comment')]
        .find((item) => item.textContent.includes('Core interaction demo comment'));
      const comment = findDemoComment();
      if (!comment) return 'missing comment';

      const action = (label) => [...comment.querySelectorAll('.pce-comment-actions .pce-action-button')]
        .find((button) => button.textContent.trim().startsWith(label));

      action('Like').click();
      await new Promise((resolve) => setTimeout(resolve, 500));
      const likedComment = findDemoComment();
      if (!likedComment?.textContent.includes('Liked 2')) return 'like failed';

      [...likedComment.querySelectorAll('.pce-comment-actions .pce-action-button')]
        .find((button) => button.textContent.trim().startsWith('Reply')).click();
      await new Promise((resolve) => setTimeout(resolve, 150));
      const replyInput = root.querySelector('.pce-reply-input');
      replyInput.value = 'Automated reply from the demo reader.';
      replyInput.dispatchEvent(new Event('input', { bubbles: true }));
      root.querySelector('.pce-reply-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 500));
      const repliedComment = findDemoComment();
      if (!repliedComment?.textContent.includes('Automated reply from the demo reader.')) return 'reply failed';

      [...repliedComment.querySelectorAll('.pce-comment-actions .pce-action-button')]
        .find((button) => button.textContent.trim() === 'Report').click();
      await new Promise((resolve) => setTimeout(resolve, 150));
      root.querySelector('.pce-report-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (!root.textContent.includes('Report submitted.')) return 'comment report failed';

      const replyReport = [...root.querySelectorAll('.pce-reply-action')]
        .find((button) => button.textContent.trim() === 'Report' && !button.disabled);
      if (!replyReport) return 'missing reply report';
      replyReport.click();
      await new Promise((resolve) => setTimeout(resolve, 150));
      root.querySelector('.pce-report-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (!root.textContent.includes('Report submitted.')) return 'reply report failed';

      const shareButton = [...findDemoComment().querySelectorAll('.pce-comment-actions .pce-action-button')]
        .find((button) => button.textContent.trim() === 'Share');
      shareButton.click();
      for (let index = 0; index < 20; index += 1) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        if (root.textContent.includes('Share image generated.')) break;
      }
      if (!root.textContent.includes('Share image generated.')) {
        return root.textContent.includes('Could not generate share image.') ? 'share generation errored' : 'share status missing';
      }

      return 'ok';
    })()
  `);
  assert(ok === "ok", `Like/reply/report/share interaction failed: ${ok}`);
  console.log("OK like, reply, report comment/reply, and share image generation work.");
}

async function main() {
  ensurePreconditions();
  launchEdge();
  let client = null;
  try {
    client = await getClient();
    await preparePage(client);
    await checkRating(client);
    await checkCommentLimit(client);
    await checkLikeReplyReportShare(client);
    console.log("Extension signed-in demo interaction check passed.");
  } finally {
    client?.close();
    if (browserProcess && !browserProcess.killed) browserProcess.kill();
  }
}

main().catch((error) => {
  if (browserProcess && !browserProcess.killed) browserProcess.kill();
  console.error(error.message);
  process.exit(1);
});
