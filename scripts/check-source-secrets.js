const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const ignoredDirs = new Set([".git", "release", "node_modules", "mobile"]);
const checkedExtensions = new Set([".css", ".html", ".js", ".json", ".md", ".ps1", ".sql", ".ts", ".tsx"]);
const patterns = [
  { name: "Supabase service role assignment", pattern: /\b(serviceRoleKey|service_role_key)\s*[:=]\s*["'][^"']+["']/i },
  { name: "Supabase secret key", pattern: /\bsb_secret_[A-Za-z0-9_-]+/ },
  { name: "private key block", pattern: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/ },
  { name: "hard-coded password assignment", pattern: /\b(password|passwd|pwd)\s*[:=]\s*["'](?!your-)[^"']{8,}["']/i }
];

const findings = [];

function walk(directory) {
  for (const name of fs.readdirSync(directory)) {
    if (ignoredDirs.has(name)) continue;
    const filePath = path.join(directory, name);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      walk(filePath);
      continue;
    }
    if (!checkedExtensions.has(path.extname(name))) continue;
    const source = fs.readFileSync(filePath, "utf8");
    for (const pattern of patterns) {
      if (pattern.pattern.test(source)) {
        findings.push(`${path.relative(root, filePath)}: ${pattern.name}`);
      }
    }
  }
}

walk(root);

if (findings.length) {
  console.error("Source secret check failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log("Source secret check passed.");
