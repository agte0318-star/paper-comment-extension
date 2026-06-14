const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const configSource = fs.readFileSync(path.join(root, "src", "config", "supabase.js"), "utf8");
const supabaseUrl = configSource.match(/url:\s*"([^"]+)"/)?.[1] || "";
const supabaseAnonKey = configSource.match(/anonKey:\s*"([^"]+)"/)?.[1] || "";

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

function assert(condition, message) {
  if (!condition) throw new Error(message);
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
  console.log(`OK ${label} email/password sign-in.`);
  return session;
}

async function getProfile(session) {
  const rows = await supabaseGet(`/rest/v1/profiles?id=eq.${encodeURIComponent(session.user.id)}&select=id,display_name,role,status`, session);
  return rows[0] || null;
}

async function checkReader() {
  const session = await signIn("reader", reader);
  const profile = await getProfile(session);
  assert(profile, "Reader profile was not found.");
  assert(profile.status === "active", `Reader account is not active: ${profile.status || "missing status"}`);
  assert(profile.role !== "admin", "Reader account unexpectedly has admin role; use a normal user for PCE_TEST_EMAIL.");
  console.log("OK reader profile exists, is active, and is non-admin.");

  await authPost("/auth/v1/recover", { email: reader.email });
  console.log("OK password reset email request accepted for reader account.");
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
  } else {
    console.log("OK new email/password account creation accepted; email confirmation is required before sign-in.");
  }
  return payload;
}

async function main() {
  assert(supabaseUrl && supabaseAnonKey, "Supabase config is missing.");
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
    process.exit(2);
  }

  await checkReader();
  await checkAdminIfProvided();
  await checkNewAccountIfProvided();
  console.log("Live account flow check passed for supplied credentials.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
