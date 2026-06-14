const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const requiredFiles = [
  "manifest.json",
  "src/content/detectPaper.js",
  "src/background/auth.js",
  "src/config/supabase.example.js",
  "src/cloud/supabaseClient.js",
  "src/moderation/blocklist.js",
  "src/storage/localComments.js",
  "src/content/index.js",
  "src/content/sidebar.css",
  "src/popup/popup.html",
  "src/popup/popup.css",
  "src/popup/popup.js",
  "public/icons/icon-16.png",
  "public/icons/icon-48.png",
  "public/icons/icon-128.png",
  "AGENTS.md",
  "README.md",
  "index.html",
  "privacy-policy.html",
  "support.html",
  "scripts/check-package.js",
  "scripts/check-public-urls.js",
  "scripts/check-public-web-render.js",
  "scripts/check-release-ready.js",
  "scripts/check-source-secrets.js",
  "scripts/capture-demo-interaction-screenshots.js",
  "scripts/capture-extension-screenshots.js",
  "scripts/capture-web-screenshots.ps1",
  "scripts/prepare-manual-test.ps1",
  "scripts/prepare-release.ps1",
  "scripts/prepare-store-assets.ps1",
  "scripts/release-status.js",
  "docs/full-version-todo.md",
  "docs/launch-readiness.md",
  "docs/privacy-policy.md",
  "docs/release-qa-checklist.md",
  "docs/manual-test-guide-zh.md",
  "docs/manual-test-results-template.md",
  "docs/store-listing.md",
  "docs/supabase-setup.md",
  "docs/web-prototype.md",
  "docs/product-spec.md",
  "docs/roadmap.md",
  "docs/copyright-policy.md",
  "docs/database-plan.md",
  "docs/chrome-web-store-submission.md",
  "web/trending.html",
  "web/profile.html",
  "web/admin.html",
  "web/styles.css",
  "web/mock-data.js",
  "web/app.js",
  "supabase/migrations/001_initial_schema.sql",
  "supabase/migrations/002_summary_views.sql",
  "supabase/migrations/003_replies_and_user_activity.sql",
  "supabase/migrations/004_profile_fields.sql",
  "supabase/migrations/005_account_status_enforcement.sql",
  "supabase/migrations/006_report_deduplication.sql",
  "supabase/migrations/007_reply_reports.sql",
  "supabase/migrations/008_profile_status_admin_controls.sql",
  "supabase/migrations/009_moderation_audit_log.sql",
  "supabase/migrations/010_spam_and_rate_limits.sql",
  "supabase/migrations/011_summary_reply_counts.sql"
];

let hasError = false;

for (const relativePath of requiredFiles) {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) {
    console.error(`Missing required file: ${relativePath}`);
    hasError = true;
  }
}

const manifestPath = path.join(root, "manifest.json");
try {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const allowedPermissions = new Set(["storage", "identity", "activeTab"]);
  const bannedPermissions = new Set([
    "bookmarks",
    "browsingData",
    "cookies",
    "debugger",
    "declarativeNetRequest",
    "downloads",
    "history",
    "management",
    "nativeMessaging",
    "proxy",
    "scripting",
    "tabs",
    "webNavigation",
    "webRequest",
    "webRequestBlocking"
  ]);
  const broadHostPatterns = new Set(["<all_urls>", "*://*/*", "http://*/*", "https://*/*", "file:///*"]);
  if (manifest.manifest_version !== 3) {
    console.error("manifest.json must use Manifest V3.");
    hasError = true;
  }
  if (!Array.isArray(manifest.content_scripts) || manifest.content_scripts.length === 0) {
    console.error("manifest.json must define at least one content script.");
    hasError = true;
  }
  if (!manifest.icons || !manifest.icons["128"]) {
    console.error("manifest.json must define extension icons.");
    hasError = true;
  }
  if (manifest.homepage_url !== "https://agte0318-star.github.io/paper-comment-extension/") {
    console.error("manifest.json must define the public website homepage_url.");
    hasError = true;
  }
  for (const permission of manifest.permissions || []) {
    if (!allowedPermissions.has(permission)) {
      console.error(`Unexpected extension permission: ${permission}`);
      hasError = true;
    }
    if (bannedPermissions.has(permission)) {
      console.error(`High-risk extension permission is not allowed for this product: ${permission}`);
      hasError = true;
    }
  }
  for (const hostPermission of manifest.host_permissions || []) {
    if (broadHostPatterns.has(hostPermission)) {
      console.error(`Broad host permission is not allowed: ${hostPermission}`);
      hasError = true;
    }
    if (!hostPermission.startsWith("https://cckjactvkvgttknhxnot.supabase.co/")) {
      console.error(`host_permissions should only include the Supabase API origin: ${hostPermission}`);
      hasError = true;
    }
  }
  for (const contentScriptEntry of manifest.content_scripts || []) {
    for (const matchPattern of contentScriptEntry.matches || []) {
      if (broadHostPatterns.has(matchPattern)) {
        console.error(`Broad content script match is not allowed: ${matchPattern}`);
        hasError = true;
      }
      if (!matchPattern.startsWith("https://")) {
        console.error(`Content script matches must stay on HTTPS scholarly pages: ${matchPattern}`);
        hasError = true;
      }
    }
  }
} catch (error) {
  console.error(`Invalid manifest.json: ${error.message}`);
  hasError = true;
}

const styles = fs.readFileSync(path.join(root, "web/styles.css"), "utf8");
const sidebarStyles = fs.readFileSync(path.join(root, "src/content/sidebar.css"), "utf8");
const contentScript = fs.readFileSync(path.join(root, "src/content/index.js"), "utf8");
const cloudClient = fs.readFileSync(path.join(root, "src/cloud/supabaseClient.js"), "utf8");
const backgroundAuth = fs.readFileSync(path.join(root, "src/background/auth.js"), "utf8");
const popupScript = fs.readFileSync(path.join(root, "src/popup/popup.js"), "utf8");
const runtimeSources = [
  { name: "content script", source: contentScript },
  { name: "cloud client", source: cloudClient },
  { name: "local storage", source: fs.readFileSync(path.join(root, "src/storage/localComments.js"), "utf8") },
  { name: "popup script", source: popupScript },
  { name: "web app", source: fs.readFileSync(path.join(root, "web/app.js"), "utf8") }
];
const bannedRuntimePatterns = [
  { name: "Supabase Storage upload", pattern: /\bstorage\.from\s*\(/ },
  { name: "raw FileReader ingestion", pattern: /\bnew\s+FileReader\s*\(/ },
  { name: "raw PDF data field", pattern: /\b(pdf_blob|pdf_data|pdf_file|article_pdf)\b/i },
  { name: "article full-text field", pattern: /\b(full_text|article_text|paper_text|body_text)\b/i },
  { name: "figure or table capture field", pattern: /\b(figure_image|table_image|figure_data|table_data)\b/i },
  { name: "stored screenshot field", pattern: /\b(screenshot_url|screenshot_data|page_capture)\b/i }
];

for (const { name, source } of runtimeSources) {
  for (const pattern of bannedRuntimePatterns) {
    if (pattern.pattern.test(source)) {
      console.error(`Runtime privacy guardrail failed in ${name}: ${pattern.name}`);
      hasError = true;
    }
  }
}

const requiredPaperPayloadFields = [
  "paper_key: paper.key",
  "doi: paper.doi || null",
  "arxiv_id: paper.arxivId || null",
  "pubmed_id: paper.pubmedId || null",
  "pmc_id: paper.pmcId || null",
  "url: paper.url",
  "title: paper.title || paper.key",
  "source: paper.source || null"
];

for (const field of requiredPaperPayloadFields) {
  if (!cloudClient.includes(field)) {
    console.error(`Paper payload should stay metadata-only; missing expected field: ${field}`);
    hasError = true;
  }
}

const requiredCssSnippets = [
  { name: "mobile narrow breakpoint", value: "@media (max-width: 560px)" },
  { name: "mobile navigation wrapping", value: "flex-wrap: wrap;" },
  { name: "mobile section title grid", value: ".section-title {\n    display: grid;" },
  { name: "mobile full-width share buttons", value: ".share-actions .btn" },
  { name: "mobile compact page width", value: "width: min(100% - 24px, 1220px);" }
];

for (const snippet of requiredCssSnippets) {
  if (!styles.includes(snippet.value)) {
    console.error(`Missing CSS mobile layout rule: ${snippet.name}`);
    hasError = true;
  }
}

const requiredRatingNudgeSnippets = [
  { name: "rating prompt state helper", source: contentScript, value: "function getRatingPromptText()" },
  { name: "rating add score action", source: contentScript, value: "Add score" },
  { name: "rating lightweight hint", source: contentScript, value: "One overall score helps other readers calibrate the paper." },
  { name: "rating prompt style", source: sidebarStyles, value: ".pce-rating-prompt" },
  { name: "rating hint style", source: sidebarStyles, value: ".pce-rating-hint" }
];

for (const snippet of requiredRatingNudgeSnippets) {
  if (!snippet.source.includes(snippet.value)) {
    console.error(`Missing lightweight rating UI feature: ${snippet.name}`);
    hasError = true;
  }
}

const trendingHtml = fs.readFileSync(path.join(root, "web/trending.html"), "utf8");
const paperHtml = fs.readFileSync(path.join(root, "web/paper.html"), "utf8");
const profileHtml = fs.readFileSync(path.join(root, "web/profile.html"), "utf8");
const webApp = fs.readFileSync(path.join(root, "web/app.js"), "utf8");
const moderationMigration = fs.readFileSync(path.join(root, "supabase/migrations/009_moderation_audit_log.sql"), "utf8");
const homeHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
const supportHtml = fs.readFileSync(path.join(root, "support.html"), "utf8");
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
const storeListing = fs.readFileSync(path.join(root, "docs/store-listing.md"), "utf8");
const requiredWebExperienceSnippets = [
  { name: "trending search input", source: trendingHtml, value: "data-trending-search" },
  { name: "trending sort select", source: trendingHtml, value: "data-trending-sort" },
  { name: "trending search binding", source: webApp, value: "function bindTrendingControls()" },
  { name: "trending filtered papers", source: webApp, value: "function getFilteredTrendingPapers" },
  { name: "paper metrics block", source: paperHtml, value: "data-paper-metrics" },
  { name: "paper share URL input", source: paperHtml, value: "data-paper-share-url" },
  { name: "paper dynamic title", source: webApp, value: "document.title = `${data.paper.title} | Paper Comment Extension`;" }
];

for (const snippet of requiredWebExperienceSnippets) {
  if (!snippet.source.includes(snippet.value)) {
    console.error(`Missing public web experience feature: ${snippet.name}`);
    hasError = true;
  }
}

const requiredSupportSnippets = [
  { name: "homepage support link", source: homeHtml, value: "./support.html" },
  { name: "support page issue tracker", source: supportHtml, value: "https://github.com/agte0318-star/paper-comment-extension/issues" },
  { name: "support page privacy link", source: supportHtml, value: "https://agte0318-star.github.io/paper-comment-extension/privacy-policy.html" },
  { name: "README website URL", source: readme, value: "https://agte0318-star.github.io/paper-comment-extension/" },
  { name: "README support URL", source: readme, value: "https://agte0318-star.github.io/paper-comment-extension/support.html" },
  { name: "store listing website URL", source: storeListing, value: "Website URL: `https://agte0318-star.github.io/paper-comment-extension/`" },
  { name: "store listing support URL", source: storeListing, value: "Support URL: `https://agte0318-star.github.io/paper-comment-extension/support.html`" }
];

for (const snippet of requiredSupportSnippets) {
  if (!snippet.source.includes(snippet.value)) {
    console.error(`Missing support or website link: ${snippet.name}`);
    hasError = true;
  }
}

const requiredAuthFlowSnippets = [
  { name: "cloud email sign-up endpoint", source: cloudClient, value: 'authRequest("/auth/v1/signup"' },
  { name: "cloud email sign-in endpoint", source: cloudClient, value: 'authRequest("/auth/v1/token?grant_type=password"' },
  { name: "cloud session refresh endpoint", source: cloudClient, value: 'authRequest("/auth/v1/token?grant_type=refresh_token"' },
  { name: "cloud password reset endpoint", source: cloudClient, value: 'authRequest("/auth/v1/recover"' },
  { name: "cloud sign-out clears session", source: cloudClient, value: "storageRemove([SESSION_KEY])" },
  { name: "cloud profile status lookup", source: cloudClient, value: "select=id,display_name,role,status" },
  { name: "cloud auth API export", source: cloudClient, value: "signInWithGoogle" },
  { name: "background Google OAuth flow", source: backgroundAuth, value: "chrome.identity.launchWebAuthFlow" },
  { name: "background OAuth redirect parsing", source: backgroundAuth, value: "parseAuthRedirect" },
  { name: "content auth modal mode switch", source: contentScript, value: 'state.authMode = isSignUpMode ? "signin" : "signup";' },
  { name: "content password length guard", source: contentScript, value: "Use at least 8 characters for your password." },
  { name: "content forgot-password action", source: contentScript, value: "runPasswordReset" },
  { name: "content contextual auth intent", source: contentScript, value: "openAuthModal(\"comment\")" },
  { name: "content returns to rating after sign-in", source: contentScript, value: 'if (intent === "rate") state.ratingOpen = true;' },
  { name: "popup account session display", source: popupScript, value: "Your comments, replies, ratings, and profile are synced." },
  { name: "popup sign-out clears session", source: popupScript, value: "removeStorage([SESSION_KEY])" },
  { name: "profile protected section", source: profileHtml, value: "data-profile-protected" },
  { name: "profile email sign-in", source: webApp, value: "async function signInProfile" },
  { name: "profile email sign-up", source: webApp, value: "async function signUpProfile" },
  { name: "profile session refresh", source: webApp, value: "async function refreshProfileSession" },
  { name: "profile Google sign-in", source: webApp, value: "function startProfileGoogleSignIn" },
  { name: "profile password reset", source: webApp, value: "sendPasswordResetEmail" }
];

for (const snippet of requiredAuthFlowSnippets) {
  if (!snippet.source.includes(snippet.value)) {
    console.error(`Missing auth flow guardrail: ${snippet.name}`);
    hasError = true;
  }
}

const accountStatusMigration = fs.readFileSync(path.join(root, "supabase/migrations/005_account_status_enforcement.sql"), "utf8");
const replyReportsMigration = fs.readFileSync(path.join(root, "supabase/migrations/007_reply_reports.sql"), "utf8");
const requiredSignedInInteractionSnippets = [
  { name: "comment API requires sign-in", source: cloudClient, value: 'if (!user) throw new Error("Sign in to post a comment.");' },
  { name: "reply API requires sign-in", source: cloudClient, value: 'if (!user) throw new Error("Sign in to reply.");' },
  { name: "rating API requires sign-in", source: cloudClient, value: 'if (!user) throw new Error("Sign in to rate this paper.");' },
  { name: "like API requires sign-in", source: cloudClient, value: 'if (!user) throw new Error("Sign in to like comments.");' },
  { name: "comment report API requires sign-in", source: cloudClient, value: 'if (!user) throw new Error("Sign in to report comments.");' },
  { name: "reply report API requires sign-in", source: cloudClient, value: 'if (!user) throw new Error("Sign in to report replies.");' },
  { name: "signed-out rating opens auth", source: contentScript, value: 'openAuthModal("rate")' },
  { name: "signed-out comment opens auth", source: contentScript, value: 'openAuthModal("comment")' },
  { name: "signed-out like opens auth", source: contentScript, value: 'openAuthModal("like")' },
  { name: "signed-out reply opens auth", source: contentScript, value: 'openAuthModal("reply")' },
  { name: "signed-out report opens auth", source: contentScript, value: 'openAuthModal("report")' },
  { name: "comment RLS requires active signed-in user", source: accountStatusMigration, value: "on public.comments for insert\nwith check (\n  auth.uid() = user_id\n  and public.is_active_user()" },
  { name: "rating insert RLS requires active signed-in user", source: accountStatusMigration, value: "on public.ratings for insert\nwith check (\n  auth.uid() = user_id\n  and public.is_active_user()" },
  { name: "rating update RLS requires active signed-in user", source: accountStatusMigration, value: "on public.ratings for update\nusing (auth.uid() = user_id and public.is_active_user())" },
  { name: "like RLS requires active signed-in user", source: accountStatusMigration, value: "on public.comment_likes for insert\nwith check (\n  auth.uid() = user_id\n  and public.is_active_user()" },
  { name: "comment report RLS requires active signed-in user", source: accountStatusMigration, value: "on public.reports for insert\nwith check (\n  auth.uid() = user_id\n  and public.is_active_user()" },
  { name: "reply RLS requires active signed-in user", source: accountStatusMigration, value: "on public.comment_replies for insert\nwith check (\n  auth.uid() = user_id\n  and public.is_active_user()" },
  { name: "reply report RLS requires active signed-in user", source: replyReportsMigration, value: "on public.reply_reports for insert\nwith check (\n  auth.uid() = user_id\n  and public.is_active_user()" }
];

for (const snippet of requiredSignedInInteractionSnippets) {
  if (!snippet.source.includes(snippet.value)) {
    console.error(`Missing signed-in interaction guardrail: ${snippet.name}`);
    hasError = true;
  }
}

const requiredAdminSafetySnippets = [
  { name: "admin page active-admin gate", source: webApp, value: 'return profile?.role === "admin" && profile?.status === "active";' },
  { name: "admin report mutation uses RPC", source: webApp, value: 'supabaseRpc("admin_update_report_status"' },
  { name: "admin content mutation uses RPC", source: webApp, value: 'supabaseRpc("admin_update_content_status"' },
  { name: "admin user mutation uses RPC", source: webApp, value: 'supabaseRpc("admin_update_user_status"' },
  { name: "admin self-suspension guard", source: webApp, value: "You cannot change your own admin account status here." },
  { name: "moderation audit table", source: moderationMigration, value: "create table if not exists public.moderation_actions" },
  { name: "admin report RPC function", source: moderationMigration, value: "create or replace function public.admin_update_report_status" },
  { name: "admin content RPC function", source: moderationMigration, value: "create or replace function public.admin_update_content_status" },
  { name: "admin user RPC function", source: moderationMigration, value: "create or replace function public.admin_update_user_status" },
  { name: "admin RPC security definer", source: moderationMigration, value: "security definer" },
  { name: "admin RPC active-admin check", source: moderationMigration, value: "if not public.is_admin() then" },
  { name: "admin RPC audit insert", source: moderationMigration, value: "insert into public.moderation_actions" },
  { name: "admin RPC public execute revoked", source: moderationMigration, value: "revoke execute on function public.admin_update_user_status(uuid, text) from public;" },
  { name: "admin RPC authenticated execute grant", source: moderationMigration, value: "grant execute on function public.admin_update_user_status(uuid, text) to authenticated;" }
];

for (const snippet of requiredAdminSafetySnippets) {
  if (!snippet.source.includes(snippet.value)) {
    console.error(`Missing admin safety guardrail: ${snippet.name}`);
    hasError = true;
  }
}

const bannedAdminDirectMutations = [
  { name: "direct comment moderation PATCH", pattern: /supabasePatch\(`\/rest\/v1\/comments/i },
  { name: "direct reply moderation PATCH", pattern: /supabasePatch\(`\/rest\/v1\/comment_replies/i },
  { name: "direct report status PATCH", pattern: /supabasePatch\(`\/rest\/v1\/reports/i },
  { name: "direct reply report status PATCH", pattern: /supabasePatch\(`\/rest\/v1\/reply_reports/i },
  { name: "direct user status PATCH", pattern: /supabasePatch\(`\/rest\/v1\/profiles/i }
];

for (const mutation of bannedAdminDirectMutations) {
  if (mutation.pattern.test(webApp)) {
    console.error(`Admin mutations must use audited RPCs, not direct table updates: ${mutation.name}`);
    hasError = true;
  }
}

function createDetectionDocument(options = {}) {
  const meta = options.meta || {};
  const links = options.links || [];
  const jsonLd = options.jsonLd || [];
  return {
    contentType: options.contentType || "text/html",
    title: options.title || "",
    body: { innerText: options.bodyText || "" },
    querySelector(selector) {
      if (selector === "h1" || selector === "h1.title") {
        return options.h1 ? { textContent: options.h1 } : null;
      }
      if (selector === 'link[rel="canonical"]') {
        return options.canonical ? { href: options.canonical } : null;
      }
      if (selector === 'embed[type="application/pdf"], iframe[src$=".pdf"]') {
        return options.pdfEmbed ? {} : null;
      }
      const metaNameMatch = selector.match(/meta\[(?:name|property|itemprop)="([^"]+)"\]/);
      if (metaNameMatch && meta[metaNameMatch[1]]) {
        return { getAttribute: () => meta[metaNameMatch[1]] };
      }
      return null;
    },
    querySelectorAll(selector) {
      if (selector === 'script[type="application/ld+json"]') {
        return jsonLd.map((item) => ({ textContent: JSON.stringify(item) }));
      }
      if (selector === 'a[href*="doi.org/"], link[href*="doi.org/"]') {
        return links.map((href) => ({ href, getAttribute: () => href }));
      }
      return [];
    }
  };
}

function detectPaperForUrl(url, options = {}) {
  const location = new URL(url);
  const sandbox = {
    window: {},
    document: createDetectionDocument(options),
    location
  };
  sandbox.window.PaperComment = {};
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, "src/content/detectPaper.js"), "utf8"), sandbox);
  return sandbox.window.PaperComment.detectPaper();
}

const detectionCases = [
  {
    name: "arXiv PDF URL",
    url: "https://arxiv.org/pdf/1706.03762.pdf",
    expectedKey: "arxiv:1706.03762"
  },
  {
    name: "Wiley PDF DOI URL",
    url: "https://onlinelibrary.wiley.com/doi/pdfdirect/10.1002/adma.202407889?download=true",
    expectedKey: "doi:10.1002/adma.202407889"
  },
  {
    name: "Springer content PDF DOI URL",
    url: "https://link.springer.com/content/pdf/10.1007/s10853-024-12345-6.pdf",
    expectedKey: "doi:10.1007/s10853-024-12345-6"
  },
  {
    name: "Chrome PDF viewer ACS source URL",
    url: "https://viewer.invalid/index.html?src=https%3A%2F%2Fpubs.acs.org%2Fdoi%2Fpdf%2F10.1021%2Facsnano.4c01234",
    expectedKey: "doi:10.1021/acsnano.4c01234"
  },
  {
    name: "ScienceDirect PII PDF URL",
    url: "https://www.sciencedirect.com/science/article/pii/S2590238524000010/pdfft?isDTMRedir=true",
    expectedKey: "pii:s2590238524000010"
  },
  {
    name: "PubMed article URL",
    url: "https://pubmed.ncbi.nlm.nih.gov/12345678/",
    expectedKey: "pubmed:12345678"
  },
  {
    name: "PMC article URL",
    url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC1234567/",
    expectedKey: "pmc:PMC1234567"
  },
  {
    name: "bioRxiv DOI URL",
    url: "https://www.biorxiv.org/content/10.1101/2024.01.02.123456v1",
    expectedKey: "doi:10.1101/2024.01.02.123456v1"
  },
  {
    name: "Nature citation DOI metadata",
    url: "https://www.nature.com/articles/s41586-024-12345-6",
    expectedKey: "doi:10.1038/s41586-024-12345-6",
    meta: {
      citation_doi: "10.1038/s41586-024-12345-6",
      citation_title: "Example Nature Article"
    }
  },
  {
    name: "Generic publisher citation DOI metadata",
    url: "https://example-journal.org/articles/current/example-paper",
    expectedKey: "doi:10.5555/example.2024.001",
    meta: {
      citation_doi: "https://doi.org/10.5555/example.2024.001",
      citation_title: "Example Publisher Article"
    }
  },
  {
    name: "JSON-LD DOI metadata",
    url: "https://journal.example.org/article/42",
    expectedKey: "doi:10.7777/jsonld.2024.42",
    jsonLd: [
      {
        "@type": "ScholarlyArticle",
        headline: "Example JSON-LD Article",
        doi: "10.7777/jsonld.2024.42"
      }
    ]
  },
  {
    name: "DOI link fallback",
    url: "https://publisher.example.org/papers/example",
    expectedKey: "doi:10.8888/link.2024.5",
    links: ["https://doi.org/10.8888/link.2024.5"]
  },
  {
    name: "Plain journal PDF fallback",
    url: "https://journal.example.org/content/files/example-paper.pdf?download=pdf&utm_source=newsletter",
    expectedKey: "pdf:https://journal.example.org/content/files/example-paper.pdf"
  }
];

for (const detectionCase of detectionCases) {
  try {
    const paper = detectPaperForUrl(detectionCase.url, {
      title: detectionCase.name,
      meta: detectionCase.meta,
      links: detectionCase.links,
      jsonLd: detectionCase.jsonLd
    });
    if (paper?.key !== detectionCase.expectedKey) {
      console.error(`Paper detection failed for ${detectionCase.name}: expected ${detectionCase.expectedKey}, got ${paper?.key || "none"}`);
      hasError = true;
    }
  } catch (error) {
    console.error(`Paper detection threw for ${detectionCase.name}: ${error.message}`);
    hasError = true;
  }
}

if (hasError) {
  process.exit(1);
}

console.log("Project check passed.");
