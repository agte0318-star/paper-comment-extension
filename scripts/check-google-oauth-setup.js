const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const backgroundAuth = fs.readFileSync(path.join(root, "src", "background", "auth.js"), "utf8");
const webApp = fs.readFileSync(path.join(root, "web", "app.js"), "utf8");
const configSource = fs.readFileSync(path.join(root, "src", "config", "supabase.js"), "utf8");

const homepageUrl = manifest.homepage_url || "https://agte0318-star.github.io/paper-comment-extension/";
const webProfileUrl = new URL("web/profile.html", homepageUrl).toString();
const extensionId = process.env.PCE_EXTENSION_ID || "";
const supabaseUrl = configSource.match(/url:\s*"([^"]+)"/)?.[1] || "";
const supabaseAnonKey = configSource.match(/anonKey:\s*"([^"]+)"/)?.[1] || "";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isChromeExtensionId(value) {
  return /^[a-p]{32}$/.test(value);
}

function requireSource(source, needle, message) {
  assert(source.includes(needle), message);
}

function main() {
  assert(packageJson.version === manifest.version, "package.json and manifest.json versions must match.");
  assert(manifest.permissions?.includes("identity"), "manifest.json must include the identity permission for Google OAuth.");
  assert(manifest.background?.service_worker === "src/background/auth.js", "manifest background service worker must be src/background/auth.js.");
  assert(supabaseUrl && !supabaseUrl.includes("YOUR_PROJECT_ID"), "Supabase URL is not configured.");
  assert(supabaseAnonKey && !supabaseAnonKey.includes("YOUR_PUBLIC_ANON_KEY"), "Supabase publishable/anon key is not configured.");

  requireSource(backgroundAuth, 'chrome.identity.getRedirectURL("supabase")', "Extension Google OAuth must use chrome.identity.getRedirectURL(\"supabase\").");
  requireSource(backgroundAuth, "chrome.identity.launchWebAuthFlow", "Extension Google OAuth must use chrome.identity.launchWebAuthFlow.");
  requireSource(backgroundAuth, 'authUrl.searchParams.set("provider", "google")', "Extension Google OAuth must request the google provider.");
  requireSource(backgroundAuth, 'authUrl.searchParams.set("redirect_to", redirectTo)', "Extension Google OAuth must pass the chrome.identity redirect URL to Supabase.");
  requireSource(backgroundAuth, 'authUrl.searchParams.set("response_type", "token")', "Extension Google OAuth must request an implicit session token.");
  requireSource(backgroundAuth, "parseAuthRedirect", "Extension Google OAuth must parse the returned Supabase session.");

  requireSource(webApp, 'authUrl.searchParams.set("provider", "google")', "Web profile Google OAuth must request the google provider.");
  requireSource(webApp, 'authUrl.searchParams.set("redirect_to", window.location.href.split("#")[0])', "Web profile Google OAuth must redirect back to the current profile page.");
  requireSource(webApp, 'authUrl.searchParams.set("response_type", "token")', "Web profile Google OAuth must request an implicit session token.");
  requireSource(webApp, "Continue with Google", "Web profile must show the Continue with Google button.");

  console.log("Google OAuth code wiring check passed.");
  console.log("");
  console.log("Supabase Auth redirect URLs to allow:");
  console.log(`- Web profile: ${webProfileUrl}`);
  if (extensionId) {
    assert(isChromeExtensionId(extensionId), "PCE_EXTENSION_ID must be the 32-character Chrome extension id using letters a-p.");
    console.log(`- Chrome extension: https://${extensionId}.chromiumapp.org/supabase`);
  } else {
    console.log("- Chrome extension: https://<your-chrome-extension-id>.chromiumapp.org/supabase");
    console.log("  Set PCE_EXTENSION_ID to print the exact extension redirect URL.");
  }
  console.log("");
  console.log("Manual verification still required:");
  console.log("- Add the URLs above in Supabase Authentication > URL Configuration > Redirect URLs.");
  console.log("- Configure the Google provider in Supabase Authentication > Providers.");
  console.log("- Load the packaged extension, click Continue with Google, and confirm it returns to the extension signed in.");
  console.log("- Open the GitHub Pages profile page, click Continue with Google, and confirm it returns to the signed-in profile page.");
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
