importScripts("../config/supabase.js");

const SESSION_KEY = "paper-comments:supabase-session";
const config = self.PCE_SUPABASE_CONFIG;

function normalizeSession(session) {
  if (!session) return null;
  if (!session.expires_at && session.expires_in) {
    return {
      ...session,
      expires_at: Math.floor(Date.now() / 1000) + Number(session.expires_in)
    };
  }
  return session;
}

function storageSet(value) {
  return new Promise((resolve) => chrome.storage.local.set(value, resolve));
}

function parseAuthRedirect(redirectUrl) {
  const url = new URL(redirectUrl);
  const params = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.search.slice(1));
  const error = params.get("error_description") || params.get("error");
  if (error) throw new Error(error);

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) {
    throw new Error("Google sign-in did not return a Supabase session.");
  }

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: Number(params.get("expires_in") || 3600),
    token_type: params.get("token_type") || "bearer",
    provider_token: params.get("provider_token") || undefined
  };
}

async function getUser(accessToken) {
  const response = await fetch(`${config.url}/auth/v1/user`, {
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${accessToken}`
    }
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(payload?.message || "Could not read Google account.");
  return payload;
}

async function signInWithGoogle() {
  if (!config?.url || !config?.anonKey || config.url.includes("YOUR_PROJECT_ID")) {
    throw new Error("Supabase is not configured.");
  }

  const redirectTo = chrome.identity.getRedirectURL("supabase");
  const authUrl = new URL(`${config.url}/auth/v1/authorize`);
  authUrl.searchParams.set("provider", "google");
  authUrl.searchParams.set("redirect_to", redirectTo);
  authUrl.searchParams.set("scopes", "email profile");
  authUrl.searchParams.set("response_type", "token");

  const redirectUrl = await chrome.identity.launchWebAuthFlow({
    url: authUrl.toString(),
    interactive: true
  });
  if (!redirectUrl) throw new Error("Google sign-in was cancelled.");

  const session = normalizeSession(parseAuthRedirect(redirectUrl));
  session.user = await getUser(session.access_token);
  await storageSet({ [SESSION_KEY]: session });
  return session;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "PCE_SIGN_IN_WITH_GOOGLE") return false;

  signInWithGoogle()
    .then((session) => sendResponse({ ok: true, session }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});
