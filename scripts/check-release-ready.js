const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const version = manifest.version;
const releaseDir = path.join(root, "release");
const zipPath = path.join(releaseDir, `paper-comment-extension-${version}.zip`);
const manualTestDir = path.join(releaseDir, "manual-test", `paper-comment-extension-${version}`);
const assetDir = path.join(releaseDir, "store-assets", version);
const screenshotsDir = path.join(assetDir, "screenshots");
const manualResultsPath = path.join(assetDir, "manual-test-results.md");
const reviewerNotesPath = path.join(assetDir, "reviewer-notes.md");
const manualLinksPath = path.join(assetDir, "manual-test-links.html");
const screenshotGuidePath = path.join(assetDir, "screenshot-capture-guide.md");

const requiredScreenshots = [
  "01-sidebar-closed.png",
  "02-sidebar-open-paper-id.png",
  "03-sign-in-dialog.png",
  "04-rating-panel.png",
  "05-comment-rated.png",
  "06-comment-replies-actions.png",
  "07-report-form.png",
  "08-popup-actions.png",
  "09-trending-page.png",
  "10-paper-discussion-page.png",
  "11-profile-page.png"
];
const allowedScreenshotSizes = new Set(["1280x800", "640x400"]);

let hasError = false;

function fail(message) {
  console.error(message);
  hasError = true;
}

function assertExists(filePath, label) {
  if (!fs.existsSync(filePath)) {
    fail(`${label} is missing: ${filePath}`);
  }
}

function getPngSize(filePath) {
  const buffer = fs.readFileSync(filePath);
  const pngSignature = "89504e470d0a1a0a";
  if (buffer.length < 24 || buffer.subarray(0, 8).toString("hex") !== pngSignature) {
    return null;
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

function getMetadataValue(source, label) {
  const pattern = new RegExp(`^- ${label}:\\s*(.+)$`, "im");
  const match = source.match(pattern);
  return match ? match[1].trim() : "";
}

assertExists(zipPath, "Release package");
assertExists(manualTestDir, "Packaged manual-test folder");
assertExists(assetDir, "Store asset folder");
assertExists(screenshotsDir, "Screenshot folder");
assertExists(manualResultsPath, "Manual test results file");
assertExists(reviewerNotesPath, "Reviewer notes file");
assertExists(manualLinksPath, "Manual test links file");
assertExists(screenshotGuidePath, "Screenshot capture guide file");

if (fs.existsSync(zipPath)) {
  const result = childProcess.spawnSync(process.execPath, [path.join(root, "scripts", "check-package.js"), zipPath], {
    encoding: "utf8"
  });
  if (result.status !== 0) {
    fail(`Release package check failed:\n${result.stderr || result.stdout}`);
  }
}

if (fs.existsSync(path.join(manualTestDir, "manifest.json"))) {
  const packagedManifest = JSON.parse(fs.readFileSync(path.join(manualTestDir, "manifest.json"), "utf8"));
  if (packagedManifest.version !== version) {
    fail(`Manual-test manifest version mismatch: expected ${version}, got ${packagedManifest.version}`);
  }
} else if (fs.existsSync(manualTestDir)) {
  fail(`Manual-test folder does not contain manifest.json: ${manualTestDir}`);
}

if (fs.existsSync(manualResultsPath)) {
  const manualResults = fs.readFileSync(manualResultsPath, "utf8");
  const metadataVersion = getMetadataValue(manualResults, "Version");
  const metadataReleaseZip = getMetadataValue(manualResults, "Release zip");
  const metadataManualFolder = getMetadataValue(manualResults, "Packaged extension folder");
  const submittedVersionMatch = manualResults.match(/Submitted version:\s*(.+)/i);
  const submittedVersion = submittedVersionMatch ? submittedVersionMatch[1].trim() : "";

  if (metadataVersion !== version) {
    fail(`Manual test results Version must be ${version}, got ${metadataVersion || "missing"}.`);
  }
  if (!metadataReleaseZip.includes(`paper-comment-extension-${version}.zip`)) {
    fail(`Manual test results Release zip must reference paper-comment-extension-${version}.zip.`);
  }
  if (!metadataManualFolder.includes(`paper-comment-extension-${version}`)) {
    fail(`Manual test results packaged extension folder must reference paper-comment-extension-${version}.`);
  }
  if (!submittedVersion.includes(version)) {
    fail(`Manual test results Submitted version must include ${version}.`);
  }
  if (/\|\s*Pending\s*\|/i.test(manualResults)) {
    fail("Manual test results still contain Pending table items.");
  }
  if (/\|\s*Fail\s*\|/i.test(manualResults)) {
    fail("Manual test results contain failing items.");
  }
  if (/Ready to upload:\s*(?!Yes\b)/i.test(manualResults)) {
    fail("Manual test results must say `Ready to upload: Yes`.");
  }
  if (!/Submitted version:\s*\S+/i.test(manualResults)) {
    fail("Manual test results must include a submitted version or planned submission version.");
  }
}

if (fs.existsSync(reviewerNotesPath)) {
  const reviewerNotes = fs.readFileSync(reviewerNotesPath, "utf8");
  const requiredReviewerNoteSnippets = [
    "Single purpose",
    "Permission explanations",
    "Data use",
    "The extension does not collect, transmit, sell, or share browser history",
    "Moderation actions are enforced by Supabase RLS and audited RPC functions",
    "npm.cmd run check:release-ready"
  ];
  for (const snippet of requiredReviewerNoteSnippets) {
    if (!reviewerNotes.includes(snippet)) {
      fail(`Reviewer notes are missing required text: ${snippet}`);
    }
  }
}

if (fs.existsSync(manualLinksPath)) {
  const manualLinks = fs.readFileSync(manualLinksPath, "utf8");
  const requiredManualLinkSnippets = [
    "chrome://extensions",
    "https://arxiv.org/abs/1706.03762",
    "https://arxiv.org/pdf/1706.03762.pdf",
    "https://agte0318-star.github.io/paper-comment-extension/web/trending.html",
    "manual-test-results.md",
    "reviewer-notes.md"
  ];
  for (const snippet of requiredManualLinkSnippets) {
    if (!manualLinks.includes(snippet)) {
      fail(`Manual test links are missing required text: ${snippet}`);
    }
  }
}

if (fs.existsSync(screenshotGuidePath)) {
  const screenshotGuide = fs.readFileSync(screenshotGuidePath, "utf8");
  const requiredScreenshotGuideSnippets = [
    "Screenshot Capture Guide",
    "01-sidebar-closed.png",
    "04-rating-panel.png",
    "08-popup-actions.png",
    "11-profile-page.png",
    "Privacy Review Before Upload",
    "npm.cmd run release:status"
  ];
  for (const snippet of requiredScreenshotGuideSnippets) {
    if (!screenshotGuide.includes(snippet)) {
      fail(`Screenshot capture guide is missing required text: ${snippet}`);
    }
  }
}

if (fs.existsSync(screenshotsDir)) {
  for (const fileName of requiredScreenshots) {
    const filePath = path.join(screenshotsDir, fileName);
    if (!fs.existsSync(filePath)) {
      fail(`Required screenshot is missing: ${filePath}`);
      continue;
    }
    const stats = fs.statSync(filePath);
    if (stats.size < 1024) {
      fail(`Screenshot looks too small to be valid: ${filePath}`);
      continue;
    }
    const size = getPngSize(filePath);
    if (!size) {
      fail(`Screenshot must be a valid PNG file: ${filePath}`);
      continue;
    }
    const sizeKey = `${size.width}x${size.height}`;
    if (!allowedScreenshotSizes.has(sizeKey)) {
      fail(`Screenshot must be 1280x800 or 640x400, got ${sizeKey}: ${filePath}`);
    }
  }
}

if (hasError) {
  console.error("Release readiness check failed. Complete the manual QA checklist before uploading.");
  process.exit(1);
}

console.log(`Release readiness check passed for version ${version}.`);
