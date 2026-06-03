const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const requiredFiles = [
  "manifest.json",
  "src/content/detectPaper.js",
  "src/config/supabase.example.js",
  "src/moderation/blocklist.js",
  "src/storage/localComments.js",
  "src/content/index.js",
  "src/content/sidebar.css",
  "public/icons/icon-16.png",
  "public/icons/icon-48.png",
  "public/icons/icon-128.png",
  "README.md",
  "docs/privacy-policy.md",
  "docs/store-listing.md",
  "docs/supabase-setup.md",
  "docs/web-prototype.md",
  "docs/product-spec.md",
  "docs/roadmap.md",
  "docs/copyright-policy.md",
  "docs/database-plan.md",
  "web/trending.html",
  "web/admin.html",
  "web/styles.css",
  "web/mock-data.js",
  "web/app.js",
  "supabase/migrations/001_initial_schema.sql",
  "supabase/migrations/002_summary_views.sql"
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
} catch (error) {
  console.error(`Invalid manifest.json: ${error.message}`);
  hasError = true;
}

if (hasError) {
  process.exit(1);
}

console.log("Project check passed.");
