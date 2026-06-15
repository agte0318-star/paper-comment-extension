const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const version = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version;
const sourcePath = path.join(root, "release", "store-assets", version, "manual-test-results.md");
const tempDir = path.join(root, "release", "account-qa-finalizer-test");
const tempPath = path.join(tempDir, "manual-test-results.md");

const accountItems = [
  "Email/password account creation works",
  "Email confirmation flow is understandable",
  "Email/password sign-in works",
  "Password reset email can be requested",
  "Google sign-in works if configured"
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function countMatches(source, pattern) {
  return [...source.matchAll(pattern)].length;
}

function main() {
  assert(fs.existsSync(sourcePath), `Missing source QA file: ${sourcePath}`);
  fs.mkdirSync(tempDir, { recursive: true });
  fs.copyFileSync(sourcePath, tempPath);

  const answers = [
    "yes", // fresh signup
    "yes", // email confirmation
    "yes", // email/password sign-in
    "yes", // password reset
    "yes", // Google OAuth configured
    "yes", // Google sign-in worked
    "yes" // Ready to upload
  ].join("\n") + "\n";

  const result = childProcess.spawnSync(process.execPath, [path.join(root, "scripts", "finalize-account-qa.js")], {
    cwd: root,
    env: {
      ...process.env,
      PCE_MANUAL_RESULTS_PATH: tempPath
    },
    input: answers,
    encoding: "utf8"
  });

  if (result.status !== 0) {
    process.stdout.write(result.stdout || "");
    process.stderr.write(result.stderr || "");
    throw new Error(`finalize-account-qa exited with status ${result.status}`);
  }

  const updated = fs.readFileSync(tempPath, "utf8");
  for (const item of accountItems) {
    if (!updated.includes(`| ${item} | Pass |`)) {
      process.stdout.write(result.stdout || "");
      process.stderr.write(result.stderr || "");
      throw new Error(`${item} was not marked Pass.`);
    }
  }
  assert(!/\| [^|]+ \| Pending \|/.test(updated), "Pending table rows remain after all-yes finalizer run.");
  assert(updated.includes("- Ready to upload: Yes"), "Ready to upload was not set to Yes.");
  assert(updated.includes("- Chrome Web Store status: Ready to submit"), "Chrome Web Store status was not set to Ready to submit.");
  assert(countMatches(updated, /\| Google sign-in works if configured \| Pass \|/g) === 1, "Google QA row was duplicated or missing.");

  console.log("Account QA finalizer check passed.");
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
