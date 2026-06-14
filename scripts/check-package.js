const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const zipPath = path.resolve(process.argv[2] || path.join(root, "release", `paper-comment-extension-${manifest.version}.zip`));

const expectedEntries = [
  "manifest.json",
  "public/icons/icon-128.png",
  "public/icons/icon-16.png",
  "public/icons/icon-48.png",
  "src/background/auth.js",
  "src/cloud/supabaseClient.js",
  "src/config/supabase.example.js",
  "src/config/supabase.js",
  "src/content/detectPaper.js",
  "src/content/index.js",
  "src/content/sidebar.css",
  "src/moderation/blocklist.js",
  "src/popup/popup.css",
  "src/popup/popup.html",
  "src/popup/popup.js",
  "src/storage/localComments.js"
];

const blockedPrefixes = [
  "docs/",
  "release/",
  "scripts/",
  "supabase/",
  "web/"
];

const blockedEntries = new Set([
  "AGENTS.md",
  "README.md",
  "index.html",
  "privacy-policy.html",
  "support.html",
  "public/icons/icon-source.png"
]);

const secretPatterns = [
  { name: "Supabase service role key", pattern: /service[_-]?role/i },
  { name: "Supabase secret key", pattern: /\bsb_secret_[A-Za-z0-9_-]+/ },
  { name: "private key block", pattern: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/ },
  { name: "hard-coded password assignment", pattern: /\b(password|passwd|pwd)\s*[:=]\s*["'][^"']{8,}["']/i },
  { name: "generic secret assignment", pattern: /\b(secret|serviceRoleKey|service_role_key)\s*[:=]\s*["'][^"']{8,}["']/i }
];

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function normalizeEntry(entry) {
  return entry.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/$/, "");
}

function getJwtPayload(token) {
  const parts = String(token || "").split(".");
  if (parts.length < 2) return null;
  try {
    const payload = Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    return JSON.parse(payload);
  } catch (error) {
    return null;
  }
}

function isAllowedSupabaseBrowserKey(key) {
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return true;
  if (/^sb_anon_[A-Za-z0-9_-]+$/.test(key)) return true;

  const payload = getJwtPayload(key);
  return payload?.role === "anon";
}

function checkForSecrets(filePath, entry) {
  if (!/\.(?:js|json|html|css)$/i.test(entry)) return;

  const source = fs.readFileSync(filePath, "utf8");
  for (const secretPattern of secretPatterns) {
    if (secretPattern.pattern.test(source)) {
      fail(`Packaged file appears to contain a forbidden secret (${secretPattern.name}): ${entry}`);
    }
  }
}

if (!fs.existsSync(zipPath)) {
  fail(`Release package does not exist: ${zipPath}`);
} else {
  const expectedName = `paper-comment-extension-${manifest.version}.zip`;
  if (path.basename(zipPath) !== expectedName) {
    fail(`Release package name must match manifest version: expected ${expectedName}, got ${path.basename(zipPath)}`);
  }

  const output = childProcess.execFileSync("tar", ["-tf", zipPath], { encoding: "utf8" });
  const entries = output
    .split(/\r?\n/)
    .map((line) => normalizeEntry(line.trim()))
    .filter(Boolean)
    .sort();
  const entrySet = new Set(entries);
  const expectedSet = new Set(expectedEntries);

  for (const entry of expectedEntries) {
    if (!entrySet.has(entry)) {
      fail(`Release package is missing required file: ${entry}`);
    }
  }

  for (const entry of entries) {
    if (!expectedSet.has(entry)) {
      fail(`Release package contains unexpected file: ${entry}`);
    }
    if (blockedEntries.has(entry) || blockedPrefixes.some((prefix) => entry.startsWith(prefix))) {
      fail(`Release package contains non-extension file: ${entry}`);
    }
  }

  const tempRoot = path.join(root, "release", `.tmp-package-check-${process.pid}-${Date.now()}`);
  fs.mkdirSync(tempRoot, { recursive: true });
  const tempDir = fs.mkdtempSync(path.join(tempRoot, "pce-package-"));
  try {
    childProcess.execFileSync("tar", ["-xf", zipPath, "-C", tempDir]);
    const packagedManifestPath = path.join(tempDir, "manifest.json");
    const packagedManifest = JSON.parse(fs.readFileSync(packagedManifestPath, "utf8"));
    if (packagedManifest.manifest_version !== 3) {
      fail("Packaged manifest must use Manifest V3.");
    }
    if (packagedManifest.version !== manifest.version) {
      fail(`Packaged manifest version mismatch: expected ${manifest.version}, got ${packagedManifest.version}`);
    }
    if (!packagedManifest.action?.default_popup) {
      fail("Packaged manifest must include the popup entry point.");
    }
    if (!packagedManifest.background?.service_worker) {
      fail("Packaged manifest must include the auth service worker.");
    }
    if (!Array.isArray(packagedManifest.content_scripts) || !packagedManifest.content_scripts.length) {
      fail("Packaged manifest must include content scripts.");
    }

    for (const entry of entries) {
      checkForSecrets(path.join(tempDir, entry), entry);
    }

    const supabaseConfigPath = path.join(tempDir, "src/config/supabase.js");
    const supabaseConfigSource = fs.readFileSync(supabaseConfigPath, "utf8");
    const anonKeyMatch = supabaseConfigSource.match(/anonKey:\s*["']([^"']+)["']/);
    if (!anonKeyMatch) {
      fail("Packaged Supabase config must define anonKey.");
    } else if (!isAllowedSupabaseBrowserKey(anonKeyMatch[1])) {
      fail("Packaged Supabase config must use a browser-safe publishable or anon key.");
    }
  } finally {
    try {
      fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    } catch (error) {
      console.warn(`Warning: could not remove temporary package-check folder: ${tempRoot}`);
    }
  }
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log(`Release package check passed: ${zipPath}`);
