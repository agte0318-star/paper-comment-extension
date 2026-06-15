const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
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
const allowedScreenshotSizes = new Set(["1280x800", "640x400"]);

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

function exists(filePath) {
  return fs.existsSync(filePath);
}

function getPngSize(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (buffer.length < 24 || buffer.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
    return null;
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

function countMatches(source, pattern) {
  return (source.match(pattern) || []).length;
}

function countResultRows(source) {
  return {
    pending: countMatches(source, /\|\s*Pending\s*\|/gi),
    failed: countMatches(source, /\|\s*Fail\s*\|/gi),
    passed: countMatches(source, /\|\s*Pass\s*\|/gi)
  };
}

function getSectionBlocks(source) {
  const sections = [];
  const headingPattern = /^##\s+(.+)$/gm;
  const headings = [];
  let match;

  while ((match = headingPattern.exec(source))) {
    headings.push({
      title: match[1].trim(),
      start: match.index,
      contentStart: headingPattern.lastIndex
    });
  }

  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index];
    const end = headings[index + 1]?.start ?? source.length;
    sections.push({
      title: heading.title,
      body: source.slice(heading.contentStart, end)
    });
  }

  return sections;
}

function getManualSectionSummaries(source) {
  return getSectionBlocks(source)
    .map((section) => ({
      title: section.title,
      pendingItems: getResultItems(section.body, "Pending"),
      failedItems: getResultItems(section.body, "Fail"),
      ...countResultRows(section.body)
    }))
    .filter((section) => section.pending || section.failed || section.passed);
}

function getResultItems(source, result) {
  const items = [];
  const pattern = new RegExp(`^\\|\\s*([^|]+?)\\s*\\|\\s*${result}\\s*\\|`, "gim");
  let match;
  while ((match = pattern.exec(source))) {
    const item = match[1].trim();
    if (item && item !== "Item") items.push(item);
  }
  return items;
}

function getManualSummary() {
  if (!exists(manualResultsPath)) {
    return {
      exists: false,
      pending: 0,
      failed: 0,
      passed: 0,
      ready: false,
      submittedVersion: "",
      sections: []
    };
  }

  const source = fs.readFileSync(manualResultsPath, "utf8");
  const submittedMatch = source.match(/Submitted version:\s*(.+)/i);
  const counts = countResultRows(source);
  const metadata = {
    version: getMetadataValue(source, "Version"),
    date: getMetadataValue(source, "Date"),
    tester: getMetadataValue(source, "Tester"),
    browser: getMetadataValue(source, "Browser"),
    releaseZip: getMetadataValue(source, "Release zip"),
    manualFolder: getMetadataValue(source, "Packaged extension folder")
  };
  return {
    exists: true,
    pending: counts.pending,
    failed: counts.failed,
    passed: counts.passed,
    ready: /Ready to upload:\s*Yes\b/i.test(source),
    submittedVersion: submittedMatch ? submittedMatch[1].trim() : "",
    sections: getManualSectionSummaries(source),
    metadata
  };
}

function getMetadataValue(source, label) {
  const pattern = new RegExp(`^- ${label}:\\s*(.+)$`, "im");
  const match = source.match(pattern);
  return match ? match[1].trim() : "";
}

function getScreenshotSummary() {
  const missing = [];
  const invalid = [];
  const present = [];

  for (const fileName of requiredScreenshots) {
    const filePath = path.join(screenshotsDir, fileName);
    if (!exists(filePath)) {
      missing.push(fileName);
      continue;
    }

    const stats = fs.statSync(filePath);
    const size = getPngSize(filePath);
    const sizeKey = size ? `${size.width}x${size.height}` : "not-png";
    if (stats.size < 1024 || !allowedScreenshotSizes.has(sizeKey)) {
      invalid.push(`${fileName} (${sizeKey})`);
      continue;
    }

    present.push(`${fileName} (${sizeKey})`);
  }

  return { present, missing, invalid };
}

function getPackageSummary() {
  if (!exists(zipPath)) {
    return { exists: false, valid: false, message: "release zip is missing", modifiedAt: "", packagedVersion: "" };
  }

  const result = childProcess.spawnSync(process.execPath, [path.join(root, "scripts", "check-package.js"), zipPath], {
    encoding: "utf8"
  });
  const modifiedAt = fs.statSync(zipPath).mtime.toISOString();
  const listResult = childProcess.spawnSync("tar", ["-xOf", zipPath, "manifest.json"], {
    encoding: "utf8"
  });
  let packagedVersion = "";
  if (listResult.status === 0) {
    try {
      packagedVersion = JSON.parse(listResult.stdout).version || "";
    } catch (error) {
      packagedVersion = "invalid manifest";
    }
  }
  return {
    exists: true,
    valid: result.status === 0,
    message: result.status === 0 ? "package content is valid" : (result.stderr || result.stdout || "package check failed").trim(),
    modifiedAt,
    packagedVersion
  };
}

function getManualTestSummary() {
  const manifestPath = path.join(manualTestDir, "manifest.json");
  if (!exists(manualTestDir)) {
    return { exists: false, version: "", modifiedAt: "" };
  }

  let manualVersion = "";
  if (exists(manifestPath)) {
    try {
      manualVersion = JSON.parse(fs.readFileSync(manifestPath, "utf8")).version || "";
    } catch (error) {
      manualVersion = "invalid manifest";
    }
  }

  return {
    exists: true,
    version: manualVersion,
    modifiedAt: fs.statSync(manualTestDir).mtime.toISOString()
  };
}

function printList(title, items) {
  console.log(title);
  if (!items.length) {
    console.log("  none");
    return;
  }
  for (const item of items) {
    console.log(`  - ${item}`);
  }
}

function printManualSections(sections) {
  console.log("Manual QA by section");
  if (!sections.length) {
    console.log("  no manual result sections found");
    return;
  }
  for (const section of sections) {
    const status = section.failed
      ? "needs fixes"
      : section.pending
        ? "pending"
        : "complete";
    console.log(`  - ${section.title}: ${section.passed} pass, ${section.pending} pending, ${section.failed} fail (${status})`);
    for (const item of section.pendingItems || []) {
      console.log(`      pending: ${item}`);
    }
    for (const item of section.failedItems || []) {
      console.log(`      fail: ${item}`);
    }
  }
}

const manual = getManualSummary();
const screenshots = getScreenshotSummary();
const packageSummary = getPackageSummary();
const manualTestSummary = getManualTestSummary();
const ready = packageSummary.valid &&
  exists(manualTestDir) &&
  packageJson.version === version &&
  packageSummary.packagedVersion === version &&
  manualTestSummary.version === version &&
  manual.exists &&
  manual.pending === 0 &&
  manual.failed === 0 &&
  manual.ready &&
  screenshots.missing.length === 0 &&
  screenshots.invalid.length === 0;

console.log("Paper Comment Extension release status");
console.log("");
console.log(`Version: ${version}`);
console.log(`package.json version matches manifest: ${packageJson.version === version ? "yes" : "no"}`);
console.log(`Release zip: ${zipPath}`);
console.log(`Release zip status: ${packageSummary.message}`);
console.log(`Release zip manifest version: ${packageSummary.packagedVersion || "missing"}`);
console.log(`Release zip modified: ${packageSummary.modifiedAt || "missing"}`);
console.log(`Manual-test folder: ${manualTestSummary.exists ? manualTestDir : "missing"}`);
console.log(`Manual-test manifest version: ${manualTestSummary.version || "missing"}`);
console.log(`Manual-test folder modified: ${manualTestSummary.modifiedAt || "missing"}`);
console.log(`Store assets folder: ${exists(assetDir) ? assetDir : "missing"}`);
console.log(`Manual test results: ${manual.exists ? manualResultsPath : "missing"}`);
console.log(`Reviewer notes: ${exists(reviewerNotesPath) ? reviewerNotesPath : "missing"}`);
console.log(`Manual test links: ${exists(manualLinksPath) ? manualLinksPath : "missing"}`);
console.log(`Screenshot guide: ${exists(screenshotGuidePath) ? screenshotGuidePath : "missing"}`);
console.log("");
console.log("Manual QA");
if (manual.exists) {
  console.log(`  Results version: ${manual.metadata.version || "missing"}`);
  console.log(`  Results date: ${manual.metadata.date || "missing"}`);
  console.log(`  Tester: ${manual.metadata.tester || "missing"}`);
  console.log(`  Browser: ${manual.metadata.browser || "missing"}`);
  console.log(`  Results release zip: ${manual.metadata.releaseZip || "missing"}`);
  console.log(`  Results manual folder: ${manual.metadata.manualFolder || "missing"}`);
}
console.log(`  Pass: ${manual.passed}`);
console.log(`  Pending: ${manual.pending}`);
console.log(`  Fail: ${manual.failed}`);
console.log(`  Ready to upload: ${manual.ready ? "Yes" : "No"}`);
console.log(`  Submitted version: ${manual.submittedVersion || "missing"}`);
console.log("");
printManualSections(manual.sections);
console.log("");
console.log("Screenshots");
console.log(`  Valid: ${screenshots.present.length}/${requiredScreenshots.length}`);
console.log(`  Missing: ${screenshots.missing.length}`);
console.log(`  Invalid size or file type: ${screenshots.invalid.length}`);
console.log("");
printList("Missing screenshots", screenshots.missing);
console.log("");
printList("Invalid screenshots", screenshots.invalid);
console.log("");
console.log(`Ready for Chrome Web Store upload: ${ready ? "YES" : "NO"}`);

if (!ready) {
  console.log("");
  console.log("Next actions:");
  if (!packageSummary.valid) console.log("  - Run npm.cmd run package.");
  if (packageJson.version !== version) console.log("  - Make package.json and manifest.json versions match.");
  if (packageSummary.packagedVersion && packageSummary.packagedVersion !== version) console.log("  - Run npm.cmd run package to rebuild the zip for the current manifest version.");
  if (!exists(manualTestDir)) console.log("  - Run npm.cmd run prepare:manual-test.");
  if (manualTestSummary.version && manualTestSummary.version !== version) console.log("  - Run npm.cmd run prepare:manual-test to refresh the packaged Chrome test folder.");
  if (!exists(assetDir) || !exists(screenshotsDir) || !manual.exists) console.log("  - Run npm.cmd run prepare:store-assets.");
  if (!exists(reviewerNotesPath)) console.log("  - Run npm.cmd run prepare:store-assets to generate reviewer notes.");
  if (!exists(manualLinksPath)) console.log("  - Run npm.cmd run prepare:store-assets to generate manual test links.");
  if (!exists(screenshotGuidePath)) console.log("  - Run npm.cmd run prepare:store-assets to generate the screenshot capture guide.");
  if (manual.exists && manual.metadata.version !== version) console.log(`  - Update manual-test-results.md Version to ${version}.`);
  if (manual.exists && !manual.submittedVersion.includes(version)) console.log(`  - Update manual-test-results.md Submitted version to include ${version}.`);
  if (manual.pending > 0 || manual.failed > 0 || !manual.ready) {
    console.log("  - Complete release/store-assets/<version>/manual-test-results.md.");
    const accountSection = manual.sections.find((section) => section.title === "Account Flow");
    if (accountSection?.pending) {
      console.log("  - Run npm.cmd run qa:account for the guided real-account check.");
      console.log("  - Run npm.cmd run finalize:account-qa after each account item is truly verified.");
      console.log("  - Re-run npm.cmd run release:status, then npm.cmd run check:release-ready.");
    }
  }
  if (screenshots.missing.length || screenshots.invalid.length) {
    console.log("  - Save all required screenshots as 1280x800 or 640x400 PNG files.");
  }
  console.log("  - Run npm.cmd run check:release-ready before uploading.");
}
