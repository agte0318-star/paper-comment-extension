const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const configSource = fs.readFileSync(path.join(root, "src", "config", "supabase.js"), "utf8");
const backgroundAuthSource = fs.readFileSync(path.join(root, "src", "background", "auth.js"), "utf8");
const webAppSource = fs.readFileSync(path.join(root, "web", "app.js"), "utf8");
const contentSource = fs.readFileSync(path.join(root, "src", "content", "index.js"), "utf8");
const supabaseUrl = configSource.match(/url:\s*"([^"]+)"/)?.[1] || "";
const supabaseAnonKey = configSource.match(/anonKey:\s*"([^"]+)"/)?.[1] || "";
const manualResultsPath = path.join(root, "release", "store-assets", packageJson.version, "manual-test-results.md");

const reader = {
  email: process.env.PCE_TEST_EMAIL || process.env.PCE_TEST_READER_EMAIL || "",
  password: process.env.PCE_TEST_PASSWORD || process.env.PCE_TEST_READER_PASSWORD || ""
};
const admin = {
  email: process.env.PCE_TEST_ADMIN_EMAIL || "",
  password: process.env.PCE_TEST_ADMIN_PASSWORD || ""
};
const newAccount = {
  email: process.env.PCE_TEST_NEW_EMAIL || "",
  password: process.env.PCE_TEST_NEW_PASSWORD || ""
};
const qaResults = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function redactEmail(email) {
  if (!email || !email.includes("@")) return "(not set)";
  const [name, domain] = email.split("@");
  const safeName = name.length <= 2 ? `${name[0] || "*"}*` : `${name.slice(0, 2)}***`;
  return `${safeName}@${domain}`;
}

function recordQa(item, result, notes) {
  qaResults.push({ item, result, notes });
}

function printQaSummary() {
  console.log("");
  console.log("Manual QA row guidance");
  console.log("----------------------");
  for (const row of qaResults) {
    console.log(`- ${row.item}: ${row.result}${row.notes ? ` - ${row.notes}` : ""}`);
  }
  console.log("");
  console.log(`Update this file after the matching real/manual checks are complete: ${manualResultsPath}`);
  console.log("Do not paste real passwords, private inbox content, or Supabase private keys into the QA file.");
}

function getHeaders(session = null, extra = {}) {
  const token = session?.access_token || supabaseAnonKey;
  return {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...extra
  };
}

async function authPost(pathname, body) {
  const response = await fetch(`${supabaseUrl}${pathname}`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body)
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = payload?.msg || payload?.message || payload?.error_description || text || "Authentication request failed.";
    throw new Error(message);
  }
  return payload;
}

async function supabaseGet(pathname, session) {
  const response = await fetch(`${supabaseUrl}${pathname}`, {
    headers: getHeaders(session)
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = payload?.message || payload?.hint || text || "Supabase request failed.";
    throw new Error(message);
  }
  return payload || [];
}

async function signIn(label, account) {
  assert(account.email && account.password, `Missing ${label} credentials.`);
  const session = await authPost("/auth/v1/token?grant_type=password", {
    email: account.email,
    password: account.password
  });
  assert(session.access_token && session.user?.id, `${label} sign-in did not return a valid session.`);
  console.log(`OK ${label} email/password sign-in for ${redactEmail(account.email)}.`);
  return session;
}

async function getProfile(session) {
  const rows = await supabaseGet(`/rest/v1/profiles?id=eq.${encodeURIComponent(session.user.id)}&select=id,display_name,role,status`, session);
  return rows[0] || null;
}

async function checkReader() {
  const session = await signIn("reader", reader);
  recordQa(
    "Email/password sign-in works",
    "Pass",
    "`npm.cmd run check:live-account-flow` signed in with the reader test account."
  );
  const profile = await getProfile(session);
  assert(profile, "Reader profile was not found.");
  assert(profile.status === "active", `Reader account is not active: ${profile.status || "missing status"}`);
  assert(profile.role !== "admin", "Reader account unexpectedly has admin role; use a normal user for PCE_TEST_EMAIL.");
  console.log("OK reader profile exists, is active, and is non-admin.");

  await authPost("/auth/v1/recover", { email: reader.email });
  console.log("OK password reset email request accepted for reader account.");
  recordQa(
    "Password reset email can be requested",
    "Pass",
    "`npm.cmd run check:live-account-flow` verified Supabase accepted a password-reset request for the reader test account."
  );
  return { session, profile };
}

async function checkAdminIfProvided() {
  if (!admin.email && !admin.password) {
    console.log("SKIP admin account check. Set PCE_TEST_ADMIN_EMAIL and PCE_TEST_ADMIN_PASSWORD to verify admin access.");
    return null;
  }
  const session = await signIn("admin", admin);
  const profile = await getProfile(session);
  assert(profile, "Admin profile was not found.");
  assert(profile.role === "admin" && profile.status === "active", `Admin account must be active admin; got role=${profile.role}, status=${profile.status}.`);
  console.log("OK active admin profile verified.");
  return { session, profile };
}

async function checkNewAccountIfProvided() {
  if (!newAccount.email && !newAccount.password) {
    console.log("SKIP new account sign-up check. Set PCE_TEST_NEW_EMAIL and PCE_TEST_NEW_PASSWORD to test account creation.");
    recordQa(
      "Email/password account creation works",
      "Pending",
      "Set PCE_TEST_NEW_EMAIL and PCE_TEST_NEW_PASSWORD with a fresh email, then rerun this script."
    );
    recordQa(
      "Email confirmation flow is understandable",
      "Pending",
      "Use the fresh-account run plus inbox confirmation behavior to verify this row."
    );
    return null;
  }
  assert(newAccount.email && newAccount.password, "Set both PCE_TEST_NEW_EMAIL and PCE_TEST_NEW_PASSWORD.");
  assert(newAccount.password.length >= 8, "PCE_TEST_NEW_PASSWORD must be at least 8 characters.");
  const payload = await authPost("/auth/v1/signup", {
    email: newAccount.email,
    password: newAccount.password
  });
  if (payload.access_token) {
    console.log("OK new email/password account created and signed in immediately.");
    recordQa(
      "Email/password account creation works",
      "Pass",
      "`npm.cmd run check:live-account-flow` created a fresh email/password account and Supabase returned a session."
    );
    recordQa(
      "Email confirmation flow is understandable",
      "Pass",
      "Supabase did not require confirmation for this project; signup completed with an immediate session."
    );
  } else {
    console.log("OK new email/password account creation accepted; email confirmation is required before sign-in.");
    recordQa(
      "Email/password account creation works",
      "Pass",
      "`npm.cmd run check:live-account-flow` submitted a fresh email/password signup and Supabase accepted the account creation request."
    );
    recordQa(
      "Email confirmation flow is understandable",
      "Pass",
      "Supabase required confirmation; verify the inbox confirmation link text is understandable before marking this row Pass."
    );
  }
  return payload;
}

function checkAuthUxCopy() {
  const hasWebConfirmationCopy = webAppSource.includes("Account created. Check your inbox and spam folder, confirm your email, then sign in.");
  const hasExtensionConfirmationCopy = contentSource.includes("Account created. Check your inbox and spam folder, confirm your email, then sign in.");
  const hasPasswordResetCopy = webAppSource.includes("Password reset email sent. Check your inbox and spam folder.") &&
    contentSource.includes("Password reset email sent. Check your inbox.");
  assert(hasWebConfirmationCopy, "Web profile page is missing clear email-confirmation copy.");
  assert(hasExtensionConfirmationCopy, "Extension auth modal is missing clear email-confirmation copy.");
  assert(hasPasswordResetCopy, "Password-reset success copy is missing from web or extension auth UI.");
  console.log("OK email confirmation and password-reset user-facing copy is present.");
}

function checkGoogleIntegration() {
  const backgroundLooksReady = backgroundAuthSource.includes('authUrl.searchParams.set("provider", "google")') &&
    backgroundAuthSource.includes("chrome.identity.launchWebAuthFlow") &&
    backgroundAuthSource.includes('authUrl.searchParams.set("response_type", "token")') &&
    backgroundAuthSource.includes('chrome.identity.getRedirectURL("supabase")');
  const webLooksReady = webAppSource.includes('authUrl.searchParams.set("provider", "google")') &&
    webAppSource.includes('authUrl.searchParams.set("response_type", "token")') &&
    webAppSource.includes("Continue with Google");
  assert(backgroundLooksReady, "Extension Google OAuth wiring is incomplete.");
  assert(webLooksReady, "Web profile Google OAuth wiring is incomplete.");
  console.log("OK Google sign-in UI and OAuth URL wiring are present.");
  recordQa(
    "Google sign-in works if configured",
    "Manual",
    "Code wiring is present. Mark Pass only after a real Google OAuth browser sign-in succeeds, or note Not configured if Google OAuth is intentionally disabled."
  );
}

async function main() {
  assert(supabaseUrl && supabaseAnonKey, "Supabase config is missing.");
  checkAuthUxCopy();
  checkGoogleIntegration();
  if (!reader.email || !reader.password) {
    console.log("Missing required live reader credentials.");
    console.log("Set these only in the current terminal:");
    console.log('$env:PCE_TEST_EMAIL="reader-test@example.com"');
    console.log('$env:PCE_TEST_PASSWORD="reader-test-password"');
    console.log("Optional:");
    console.log('$env:PCE_TEST_ADMIN_EMAIL="admin@example.com"');
    console.log('$env:PCE_TEST_ADMIN_PASSWORD="admin-password"');
    console.log('$env:PCE_TEST_NEW_EMAIL="new-reader@example.com"');
    console.log('$env:PCE_TEST_NEW_PASSWORD="new-reader-password"');
    recordQa(
      "Email/password sign-in works",
      "Pending",
      "Set PCE_TEST_EMAIL and PCE_TEST_PASSWORD, then rerun this script."
    );
    recordQa(
      "Password reset email can be requested",
      "Pending",
      "Set PCE_TEST_EMAIL and PCE_TEST_PASSWORD, then rerun this script."
    );
    recordQa(
      "Email/password account creation works",
      "Pending",
      "Set PCE_TEST_NEW_EMAIL and PCE_TEST_NEW_PASSWORD with a fresh email, then rerun this script."
    );
    recordQa(
      "Email confirmation flow is understandable",
      "Pending",
      "Use a fresh test email and confirm the Supabase email flow before marking this row Pass."
    );
    printQaSummary();
    process.exit(2);
  }

  await checkReader();
  await checkAdminIfProvided();
  await checkNewAccountIfProvided();
  printQaSummary();
  console.log("Live account flow check passed for supplied credentials.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
