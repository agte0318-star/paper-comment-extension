const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const baseUrl = process.env.PCE_PUBLIC_BASE_URL || "https://agte0318-star.github.io/paper-comment-extension/";
const remoteDebuggingPort = Number(process.env.PCE_WEB_AUTH_ADMIN_PORT || 9339);
const profileDir = path.join(root, "release", "browser-web-auth-admin-profile");
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
    throw new Error("Microsoft Edge was not found. Install Edge or run this web auth/admin state check manually.");
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
    "--window-size=1280,900",
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
    height: 900,
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

async function installMockSupabase(client) {
  await client.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `
      (() => {
        const SUPABASE_URL = "https://cckjactvkvgttknhxnot.supabase.co";
        const ADMIN_SESSION_KEY = "paper-comments:admin-session";
        const PROFILE_SESSION_KEY = "paper-comments:profile-session";
        const now = new Date("2026-06-15T08:00:00.000Z").toISOString();
        const expiresAt = Math.floor(Date.now() / 1000) + 3600;
        const readerUser = {
          id: "reader-user",
          email: "reader@example.test",
          aud: "authenticated",
          role: "authenticated",
          app_metadata: {},
          user_metadata: { name: "Mock Reader" }
        };
        const adminUser = {
          id: "admin-user",
          email: "admin@example.test",
          aud: "authenticated",
          role: "authenticated",
          app_metadata: {},
          user_metadata: { name: "Mock Admin" }
        };
        const profiles = {
          "reader-user": {
            id: "reader-user",
            display_name: "Mock Reader",
            institution: "Example University",
            orcid: "0000-0000-0000-0000",
            research_field: "Materials science",
            role: "user",
            status: "active",
            created_at: now
          },
          "admin-user": {
            id: "admin-user",
            display_name: "Mock Admin",
            institution: "Example Lab",
            orcid: null,
            research_field: "Research integrity",
            role: "admin",
            status: "active",
            created_at: now
          },
          "suspended-user": {
            id: "suspended-user",
            display_name: "Suspended Reader",
            role: "user",
            status: "suspended",
            created_at: now
          }
        };
        const makeSession = (token) => JSON.stringify({
          access_token: token,
          refresh_token: token + "-refresh",
          expires_at: expiresAt,
          token_type: "bearer",
          user: token === "mock-admin-token" ? adminUser : readerUser
        });

        function seedSession() {
          const url = new URL(window.location.href);
          if (url.pathname.endsWith("/profile.html")) {
            window.localStorage.setItem(PROFILE_SESSION_KEY, makeSession("mock-reader-token"));
          }
          if (url.pathname.endsWith("/admin.html")) {
            const mode = url.searchParams.get("pce_admin_mode");
            const token = mode === "active-admin" ? "mock-admin-token" : "mock-reader-token";
            window.localStorage.setItem(ADMIN_SESSION_KEY, makeSession(token));
          }
        }

        function getHeader(headers, name) {
          if (!headers) return "";
          if (typeof headers.get === "function") return headers.get(name) || "";
          return headers[name] || headers[name.toLowerCase()] || "";
        }

        function getToken(init) {
          const auth = getHeader(init?.headers, "Authorization");
          return String(auth).includes("mock-admin-token") ? "admin" : "reader";
        }

        function json(data, status = 200) {
          return Promise.resolve(new Response(JSON.stringify(data), {
            status,
            headers: { "Content-Type": "application/json" }
          }));
        }

        function profileRows(url) {
          const search = url.search;
          if (search.includes("id=eq.reader-user")) return [profiles["reader-user"]];
          if (search.includes("id=eq.admin-user")) return [profiles["admin-user"]];
          return [profiles["reader-user"], profiles["admin-user"], profiles["suspended-user"]];
        }

        function profileComments(url) {
          if (!url.search.includes("user_id=eq.reader-user")) return [];
          return [{
            id: "profile-comment-1",
            paper_id: "paper-profile-1",
            paper_key: "doi:10.1000/profile-test",
            paper_title: "Mock Profile Paper",
            paper_url: "https://example.test/paper",
            content: "Mock profile comment from the signed-in reader.",
            like_count: 7,
            reply_count: 2,
            created_at: now,
            status: "visible"
          }];
        }

        function profileReplies(url) {
          if (!url.search.includes("parent_user_id=eq.reader-user")) return [];
          return [{
            id: "reply-to-reader-1",
            comment_id: "profile-comment-1",
            paper_id: "paper-profile-1",
            paper_key: "doi:10.1000/profile-test",
            paper_title: "Mock Profile Paper",
            display_name: "Another Reader",
            content: "A mock reply to the signed-in reader.",
            parent_content: "Mock profile comment from the signed-in reader.",
            created_at: now,
            status: "visible"
          }];
        }

        function profileRatings(url) {
          if (!url.search.includes("user_id=eq.reader-user")) return [];
          return [{
            id: "rating-1",
            paper_id: "paper-profile-1",
            overall_score: 8,
            created_at: now,
            updated_at: now,
            papers: {
              id: "paper-profile-1",
              paper_key: "doi:10.1000/profile-test",
              title: "Mock Profile Paper",
              url: "https://example.test/paper",
              journal: "Mock Journal",
              publisher: "Mock Publisher"
            }
          }];
        }

        function adminComments() {
          return [{
            id: "admin-comment-1",
            paper_id: "paper-admin-1",
            user_id: "reader-user",
            content: "Mock moderation comment awaiting review.",
            like_count: 4,
            status: "visible",
            created_at: now,
            papers: { paper_key: "doi:10.1000/admin-test", title: "Mock Admin Paper" },
            profiles: { display_name: "Mock Reader", status: "active" },
            reports: [{ id: "report-1", status: "open" }]
          }];
        }

        function adminReplies() {
          return [{
            id: "admin-reply-1",
            comment_id: "admin-comment-1",
            paper_id: "paper-admin-1",
            user_id: "reader-user",
            content: "Mock reply for moderation.",
            status: "visible",
            created_at: now,
            papers: { paper_key: "doi:10.1000/admin-test", title: "Mock Admin Paper" },
            profiles: { display_name: "Mock Reader", status: "active" }
          }];
        }

        function adminReports() {
          return [{
            id: "report-1",
            comment_id: "admin-comment-1",
            user_id: "reader-user",
            reason: "policy",
            details: "Mock report details",
            status: "open",
            created_at: now,
            resolved_at: null,
            comments: {
              id: "admin-comment-1",
              paper_id: "paper-admin-1",
              user_id: "reader-user",
              content: "Mock moderation comment awaiting review.",
              status: "visible",
              papers: { paper_key: "doi:10.1000/admin-test", title: "Mock Admin Paper" },
              profiles: { display_name: "Mock Reader", status: "active" }
            },
            profiles: { display_name: "Mock Reporter", status: "active" }
          }];
        }

        function adminReplyReports() {
          return [{
            id: "reply-report-1",
            reply_id: "admin-reply-1",
            user_id: "reader-user",
            reason: "spam",
            details: "Mock reply report details",
            status: "reviewing",
            created_at: now,
            resolved_at: null,
            comment_replies: {
              id: "admin-reply-1",
              comment_id: "admin-comment-1",
              paper_id: "paper-admin-1",
              user_id: "reader-user",
              content: "Mock reply for moderation.",
              status: "visible",
              papers: { paper_key: "doi:10.1000/admin-test", title: "Mock Admin Paper" },
              profiles: { display_name: "Mock Reader", status: "active" }
            },
            profiles: { display_name: "Mock Reporter", status: "active" }
          }];
        }

        function adminActions() {
          return [{
            id: "action-1",
            actor_id: "admin-user",
            action_type: "update_content_status",
            target_type: "comment",
            target_id: "admin-comment-1",
            previous_status: "visible",
            new_status: "hidden",
            created_at: now,
            profiles: { display_name: "Mock Admin" }
          }];
        }

        seedSession();
        window.__pceMockFetchLog = [];
        const originalFetch = window.fetch.bind(window);
        window.fetch = (input, init = {}) => {
          const rawUrl = typeof input === "string" ? input : input?.url;
          if (!rawUrl || !String(rawUrl).startsWith(SUPABASE_URL)) return originalFetch(input, init);
          const url = new URL(rawUrl);
          const tokenKind = getToken(init);
          window.__pceMockFetchLog.push({
            path: url.pathname + url.search,
            method: init.method || "GET",
            tokenKind
          });

          if (url.pathname === "/auth/v1/user") {
            return json(tokenKind === "admin" ? adminUser : readerUser);
          }
          if (url.pathname === "/rest/v1/profiles") return json(profileRows(url));
          if (url.pathname === "/rest/v1/user_comment_activity") return json(profileComments(url));
          if (url.pathname === "/rest/v1/user_received_replies") return json(profileReplies(url));
          if (url.pathname === "/rest/v1/ratings") return json(profileRatings(url));
          if (url.pathname === "/rest/v1/comments") return json(adminComments());
          if (url.pathname === "/rest/v1/comment_replies") return json(adminReplies());
          if (url.pathname === "/rest/v1/reports") return json(adminReports());
          if (url.pathname === "/rest/v1/reply_reports") return json(adminReplyReports());
          if (url.pathname === "/rest/v1/moderation_actions") return json(adminActions());
          return json([]);
        };
      })();
    `
  });
}

async function checkProfileSignedIn(client) {
  const url = resolvePublicUrl("web/profile.html?pce_auth_mock=reader");
  await navigate(client, url);
  const rendered = await waitForExpression(client, `
    document.querySelector('[data-profile-auth]')?.textContent.includes('Mock Reader') &&
    document.querySelector('[data-profile-protected]')?.hidden === false &&
    document.querySelector('[data-my-comments]')?.textContent.includes('Mock profile comment') &&
    document.querySelector('[data-replies-to-me]')?.textContent.includes('mock reply') &&
    document.querySelector('[data-my-ratings]')?.textContent.includes('8.0/10')
  `, 30000);
  assert(rendered, "Profile page did not render signed-in private activity from the mocked reader session.");

  const privateQueriesUseSignedInUser = await evaluate(client, `
    (() => {
      const paths = window.__pceMockFetchLog.map((item) => item.path);
      return paths.some((path) => path.includes('/user_comment_activity?user_id=eq.reader-user')) &&
        paths.some((path) => path.includes('/user_received_replies?parent_user_id=eq.reader-user')) &&
        paths.some((path) => path.includes('/ratings?user_id=eq.reader-user')) &&
        !paths.some((path) => path.includes('admin-user') && !path.includes('/profiles?id=eq.admin-user'));
    })()
  `);
  assert(privateQueriesUseSignedInUser, "Profile page did not scope private activity queries to the signed-in user.");
  console.log(`OK rendered signed-in profile private activity: ${url}`);
}

async function checkAdminDenied(client) {
  const url = resolvePublicUrl("web/admin.html?pce_admin_mode=user");
  await navigate(client, url);
  const denied = await waitForExpression(client, `
    document.querySelector('[data-admin-auth]')?.textContent.includes('not an active admin') &&
    document.querySelector('[data-admin-protected]')?.hidden === true &&
    document.querySelector('[data-admin-toolbar]')?.hidden === true
  `, 30000);
  assert(denied, "Admin page did not deny a signed-in non-admin account.");
  console.log(`OK denied non-admin account on admin page: ${url}`);
}

async function checkAdminAllowed(client) {
  const url = resolvePublicUrl("web/admin.html?pce_admin_mode=active-admin");
  await navigate(client, url);
  const rendered = await waitForExpression(client, `
    document.querySelector('[data-admin-auth]')?.textContent.includes('Signed in as admin') &&
    document.querySelector('[data-admin-protected]')?.hidden === false &&
    document.querySelector('[data-admin-toolbar]')?.hidden === false &&
    document.querySelector('[data-admin-comments]')?.textContent.includes('Mock moderation comment') &&
    document.querySelector('[data-admin-reports]')?.textContent.includes('policy') &&
    document.querySelector('[data-admin-users]')?.textContent.includes('Mock Reader') &&
    document.querySelector('[data-admin-audit]')?.textContent.includes('update_content_status')
  `, 30000);
  assert(rendered, "Admin page did not render the protected dashboard for an active admin account.");

  const adminQueriesUseAdminToken = await evaluate(client, `
    (() => {
      const adminPaths = window.__pceMockFetchLog.filter((item) =>
        item.path.includes('/comments?') ||
        item.path.includes('/comment_replies?') ||
        item.path.includes('/reports?') ||
        item.path.includes('/reply_reports?') ||
        item.path.includes('/moderation_actions?')
      );
      return adminPaths.length >= 5 && adminPaths.every((item) => item.tokenKind === 'admin');
    })()
  `);
  assert(adminQueriesUseAdminToken, "Admin dashboard data was not loaded with the active admin session.");
  console.log(`OK rendered active-admin dashboard: ${url}`);
}

async function main() {
  ensurePreconditions();
  launchEdge();
  let client = null;
  try {
    client = await getClient();
    await installMockSupabase(client);
    await checkProfileSignedIn(client);
    await checkAdminDenied(client);
    await checkAdminAllowed(client);
    console.log("Web auth/admin state check passed.");
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
