const SUPABASE_URL = "https://cckjactvkvgttknhxnot.supabase.co";
const SUPABASE_KEY = "sb_publishable_RD5ZwdePAnqLRCwzfe9fUQ_CLQIaOzr";
const ADMIN_SESSION_KEY = "paper-comments:admin-session";
const PROFILE_SESSION_KEY = "paper-comments:profile-session";

let pageData = null;
let pageSource = "sample";
let adminSession = null;
let adminProfile = null;
let adminEventsBound = false;
let selectedAdminUserId = null;
let profileSession = null;
let profileUser = null;
let profileRow = null;
let profileAuthMode = "signin";
let profileAuthEmail = "";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(Number(value) || 0);
}

function formatDate(value) {
  if (!value) return "Unknown time";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

async function supabaseGet(path, session = null) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${session?.access_token || SUPABASE_KEY}`
    }
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(payload?.message || payload?.hint || "Supabase request failed.");
  }
  return payload || [];
}

async function supabasePatch(path, body, session = null) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${session?.access_token || SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify(body)
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(payload?.message || payload?.hint || "Supabase request failed.");
  }
  return payload || [];
}

async function supabaseRpc(name, body, session = null) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${session?.access_token || SUPABASE_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(payload?.message || payload?.hint || "Supabase RPC failed.");
  }
  return payload;
}

async function authPost(path, body) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const rawMessage = payload?.msg || payload?.message || payload?.error_description || "Authentication failed.";
    throw new Error(getWebAuthErrorMessage(payload, rawMessage));
  }
  return payload;
}

function getWebAuthErrorMessage(payload, rawMessage) {
  const code = payload?.error_code || payload?.code || "";
  const message = String(rawMessage || "").toLowerCase();
  if (code === "email_not_confirmed" || message.includes("email not confirmed")) {
    return "Confirm your email first, then sign in. Check your inbox and spam folder for the confirmation email.";
  }
  if (code === "over_email_send_rate_limit") {
    return "Too many email requests were sent. Wait a while, then try again.";
  }
  if (code === "user_already_exists" || message.includes("already registered")) {
    return "This email is already registered. Switch to Sign in.";
  }
  if (code === "weak_password") {
    return rawMessage || "Use a stronger password.";
  }
  if (message.includes("invalid login credentials")) {
    return "Email or password is incorrect.";
  }
  return rawMessage || "Authentication failed.";
}

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

function parseOAuthSessionFromUrl() {
  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  const error = params.get("error_description") || params.get("error");
  if (error) throw new Error(error);
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) return null;
  return normalizeSession({
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: Number(params.get("expires_in") || 3600),
    token_type: params.get("token_type") || "bearer",
    provider_token: params.get("provider_token") || undefined
  });
}

function clearUrlHash() {
  if (!window.location.hash) return;
  window.history.replaceState(null, document.title, `${window.location.pathname}${window.location.search}`);
}

function saveAdminSession(session) {
  adminSession = normalizeSession(session);
  window.localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(adminSession));
}

function clearAdminSession() {
  adminSession = null;
  adminProfile = null;
  window.localStorage.removeItem(ADMIN_SESSION_KEY);
}

function readStoredAdminSession() {
  try {
    return normalizeSession(JSON.parse(window.localStorage.getItem(ADMIN_SESSION_KEY)));
  } catch (error) {
    return null;
  }
}

function saveProfileSession(session) {
  profileSession = normalizeSession(session);
  window.localStorage.setItem(PROFILE_SESSION_KEY, JSON.stringify(profileSession));
}

function clearProfileSession() {
  profileSession = null;
  profileUser = null;
  profileRow = null;
  window.localStorage.removeItem(PROFILE_SESSION_KEY);
}

function readStoredProfileSession() {
  try {
    return normalizeSession(JSON.parse(window.localStorage.getItem(PROFILE_SESSION_KEY)));
  } catch (error) {
    return null;
  }
}

async function refreshAdminSession(session) {
  if (!session?.refresh_token) return null;
  const refreshed = await authPost("/auth/v1/token?grant_type=refresh_token", {
    refresh_token: session.refresh_token
  });
  saveAdminSession(refreshed);
  return adminSession;
}

async function refreshProfileSession(session) {
  if (!session?.refresh_token) return null;
  const refreshed = await authPost("/auth/v1/token?grant_type=refresh_token", {
    refresh_token: session.refresh_token
  });
  saveProfileSession(refreshed);
  return profileSession;
}

async function getAdminSession() {
  const session = adminSession || readStoredAdminSession();
  if (!session) return null;
  if (session.expires_at && Date.now() / 1000 > session.expires_at - 60) {
    return refreshAdminSession(session);
  }
  adminSession = session;
  return session;
}

async function getProfileSession() {
  const session = profileSession || readStoredProfileSession();
  if (!session) return null;
  if (session.expires_at && Date.now() / 1000 > session.expires_at - 60) {
    return refreshProfileSession(session);
  }
  profileSession = session;
  return session;
}

async function getSessionUser(session) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${session.access_token}`
    }
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(payload?.message || "Could not read signed-in user.");
  return payload;
}

async function getAdminProfile(userId, session) {
  const rows = await supabaseGet(`/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=id,display_name,role,status`, session);
  return rows[0] || null;
}

async function getUserProfile(userId, session) {
  const encodedId = encodeURIComponent(userId);
  try {
    const rows = await supabaseGet(`/rest/v1/profiles?id=eq.${encodedId}&select=id,display_name,institution,orcid,research_field,role,status`, session);
    return rows[0] || null;
  } catch (error) {
    const rows = await supabaseGet(`/rest/v1/profiles?id=eq.${encodedId}&select=id,display_name,institution,orcid,role,status`, session);
    return rows[0] ? { ...rows[0], research_field: "" } : null;
  }
}

async function updateUserProfile(profile) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(profileUser.id)}`, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${profileSession.access_token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify(profile)
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(payload?.message || payload?.hint || "Could not update profile.");
  }
  return payload?.[0] || null;
}

function hasAdminAccess(profile) {
  return profile?.role === "admin" && profile?.status === "active";
}

async function signInAdmin(email, password) {
  const session = await authPost("/auth/v1/token?grant_type=password", { email, password });
  saveAdminSession(session);
  return adminSession;
}

async function signInProfile(email, password) {
  const session = await authPost("/auth/v1/token?grant_type=password", { email, password });
  saveProfileSession(session);
  return profileSession;
}

async function signUpProfile(email, password) {
  const payload = await authPost("/auth/v1/signup", { email, password });
  if (payload.access_token) saveProfileSession(payload);
  return payload;
}

async function sendPasswordResetEmail(email) {
  return authPost("/auth/v1/recover", { email });
}

async function resendProfileConfirmationEmail(email) {
  return authPost("/auth/v1/resend", { type: "signup", email });
}

function startProfileGoogleSignIn() {
  const authUrl = new URL(`${SUPABASE_URL}/auth/v1/authorize`);
  authUrl.searchParams.set("provider", "google");
  authUrl.searchParams.set("redirect_to", window.location.href.split("#")[0]);
  authUrl.searchParams.set("scopes", "email profile");
  authUrl.searchParams.set("response_type", "token");
  window.location.href = authUrl.toString();
}

function getPaper(data, paperId) {
  return data.papers.find((paper) => paper.id === paperId);
}

function byNewest(a, b) {
  return new Date(b.lastActiveAt || b.createdAt || 0) - new Date(a.lastActiveAt || a.createdAt || 0);
}

function byComments(a, b) {
  return getDiscussionCount(b) - getDiscussionCount(a) || byNewest(a, b);
}

function byRating(a, b) {
  return b.ratingAverage - a.ratingAverage || b.ratingCount - a.ratingCount || byNewest(a, b);
}

function byLikes(a, b) {
  return b.likeCount - a.likeCount || new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
}

function byTrendingSort(a, b, sortMode) {
  if (sortMode === "rating") return byRating(a, b);
  if (sortMode === "newest") return byNewest(a, b);
  return byComments(a, b);
}

function createMetric(label, value, note) {
  return `
    <div class="metric">
      <div class="metric-label">${escapeHtml(label)}</div>
      <div class="metric-value">${escapeHtml(value)}</div>
      <div class="metric-note">${escapeHtml(note)}</div>
    </div>
  `;
}

function getDiscussionCount(paper) {
  return Number(paper?.commentCount || 0) + Number(paper?.replyCount || 0);
}

function createEmptyState(message) {
  return `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function createLoadingState(message = "Loading public activity...") {
  return `<div class="loading-state" aria-live="polite"><span class="loading-dot"></span>${escapeHtml(message)}</div>`;
}

function getPublicSourceNotice() {
  if (pageSource === "live") {
    return {
      tone: "success",
      message: "Showing live public activity from Supabase. Reading this page does not require sign-in."
    };
  }
  if (pageSource === "empty") {
    return {
      tone: "neutral",
      message: "No public activity has been posted yet. The page remains readable without signing in."
    };
  }
  if (pageSource === "link") {
    return {
      tone: "neutral",
      message: "Opened from a shared paper link. Public comments will appear here after readers use the extension."
    };
  }
  return {
    tone: "warning",
    message: "Live data could not be loaded, so this page is showing sample content as a fallback."
  };
}

function renderPageNotice() {
  const target = document.querySelector("[data-page-notice]");
  if (!target) return;
  const notice = getPublicSourceNotice();
  target.hidden = false;
  target.className = `page-notice is-${notice.tone}`;
  target.textContent = notice.message;
}

function setStatus(selector, message) {
  const element = document.querySelector(selector);
  if (element) element.textContent = message;
}

function getPaperDetailUrl(paper) {
  const value = paper.id || paper.paperKey;
  return `./paper.html?id=${encodeURIComponent(value)}`;
}

function getAbsoluteUrl(pathOrUrl) {
  return new URL(pathOrUrl, window.location.href).toString();
}

function getPaperParam() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id") || params.get("key") || "";
}

function getPaperFromUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const id = getPaperParam();
  if (!id) return null;

  const title = params.get("title") || "";
  const url = params.get("url") || "";
  const source = params.get("source") || "";
  if (!title && !url && !source) return null;

  return {
    id,
    paperKey: id,
    title: title || id,
    source: source || "shared-link",
    journal: source || "Current paper",
    publisher: source || "Unknown source",
    year: "",
    url: url || "#",
    commentCount: 0,
    replyCount: 0,
    ratingAverage: 0,
    ratingCount: 0,
    likeCount: 0,
    lastActiveAt: new Date().toISOString(),
    status: "active"
  };
}

function normalizePaper(row) {
  return {
    id: row.id,
    paperKey: row.paper_key || row.paperKey || row.id,
    title: row.title || "Untitled paper",
    source: row.source || row.publisher || "paper",
    journal: row.journal || row.source || "Unknown journal",
    publisher: row.publisher || "Unknown publisher",
    year: row.year || "",
    url: row.url || "#",
    commentCount: Number(row.comment_count ?? row.commentCount ?? 0),
    replyCount: Number(row.reply_count ?? row.replyCount ?? 0),
    ratingAverage: Number(row.rating_average ?? row.ratingAverage ?? 0),
    ratingCount: Number(row.rating_count ?? row.ratingCount ?? 0),
    likeCount: Number(row.total_comment_likes ?? row.likeCount ?? 0),
    lastActiveAt: row.last_active_at || row.lastActiveAt || row.created_at,
    status: row.status || "active"
  };
}

function normalizeHotComment(row) {
  return {
    id: row.id,
    paperId: row.paper_id,
    paperKey: row.paper_key,
    paperTitle: row.paper_title,
    journal: row.journal || "Unknown journal",
    author: row.display_name || "Reader",
    content: row.content || "",
    likeCount: Number(row.like_count || 0),
    ratingScore: Number(row.author_rating || 0),
    status: row.status || "visible",
    reportCount: Number(row.report_count || 0),
    createdAt: row.created_at
  };
}

function normalizePaperComment(row, ratingByUser = new Map()) {
  const profile = row.profiles || {};
  const ratingScore = ratingByUser.get(row.user_id) || 0;
  return {
    id: row.id,
    paperId: row.paper_id,
    author: profile.display_name || "Reader",
    content: row.content || "",
    likeCount: Number(row.like_count || 0),
    ratingScore: Number(ratingScore || 0),
    status: row.status || "visible",
    reportCount: 0,
    replies: [],
    createdAt: row.created_at
  };
}

function normalizePaperReply(row) {
  const profile = row.profiles || {};
  return {
    id: row.id,
    commentId: row.comment_id,
    paperId: row.paper_id,
    author: profile.display_name || "Reader",
    content: row.content || "",
    status: row.status || "visible",
    createdAt: row.created_at
  };
}

function normalizeAdminComment(row) {
  const paper = row.papers || {};
  const profile = row.profiles || {};
  return {
    id: row.id,
    paperId: row.paper_id,
    userId: row.user_id,
    paperKey: paper.paper_key || row.paper_key || row.paper_id,
    paperTitle: paper.title || "Unknown paper",
    author: profile.display_name || "Reader",
    content: row.content || "",
    likeCount: Number(row.like_count || 0),
    status: row.status || "visible",
    reportCount: Array.isArray(row.reports) ? row.reports.length : 0,
    createdAt: row.created_at
  };
}

function normalizeAdminReply(row) {
  const paper = row.papers || {};
  const profile = row.profiles || {};
  return {
    id: row.id,
    commentId: row.comment_id,
    paperId: row.paper_id,
    userId: row.user_id,
    paperKey: paper.paper_key || row.paper_id,
    paperTitle: paper.title || "Unknown paper",
    author: profile.display_name || "Reader",
    content: row.content || "",
    status: row.status || "visible",
    createdAt: row.created_at
  };
}

function normalizeAdminReport(row) {
  const comment = row.comments || {};
  const paper = comment.papers || {};
  const commentProfile = comment.profiles || {};
  const reporterProfile = row.profiles || {};
  return {
    id: row.id,
    reportType: "comment",
    targetType: "comment",
    targetId: row.comment_id,
    commentId: row.comment_id,
    reporterId: row.user_id,
    reporter: reporterProfile.display_name || "Reader",
    reason: row.reason || "other",
    details: row.details || "",
    status: row.status || "open",
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
    commentAuthor: commentProfile.display_name || "Reader",
    commentContent: comment.content || "",
    commentStatus: comment.status || "visible",
    paperId: comment.paper_id,
    paperKey: paper.paper_key || comment.paper_id || "",
    paperTitle: paper.title || "Unknown paper"
  };
}

function normalizeAdminReplyReport(row) {
  const reply = row.comment_replies || {};
  const paper = reply.papers || {};
  const replyProfile = reply.profiles || {};
  const reporterProfile = row.profiles || {};
  return {
    id: row.id,
    reportType: "reply",
    targetType: "reply",
    targetId: row.reply_id,
    replyId: row.reply_id,
    reporterId: row.user_id,
    reporter: reporterProfile.display_name || "Reader",
    reason: row.reason || "other",
    details: row.details || "",
    status: row.status || "open",
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
    commentAuthor: replyProfile.display_name || "Reader",
    commentContent: reply.content || "",
    commentStatus: reply.status || "visible",
    paperId: reply.paper_id,
    paperKey: paper.paper_key || reply.paper_id || "",
    paperTitle: paper.title || "Unknown paper"
  };
}

function normalizeModerationAction(row) {
  const profile = row.profiles || {};
  return {
    id: row.id,
    actorId: row.actor_id,
    actor: profile.display_name || row.actor_id || "Admin",
    actionType: row.action_type || "",
    targetType: row.target_type || "",
    targetId: row.target_id || "",
    previousStatus: row.previous_status || "",
    newStatus: row.new_status || "",
    createdAt: row.created_at
  };
}

function getFallbackData() {
  return window.PCE_DATA;
}

async function loadTrendingData() {
  try {
    const [papers, comments] = await Promise.all([
      supabaseGet("/rest/v1/paper_summary?select=*&order=comment_count.desc,last_active_at.desc&limit=24"),
      supabaseGet("/rest/v1/hot_comments?select=*&order=like_count.desc,created_at.desc&limit=12")
    ]);

    if (!papers.length && !comments.length) {
      pageSource = "empty";
      return { ...getFallbackData(), papers: [], comments: [], reports: [], users: [] };
    }

    pageSource = "live";
    return {
      generatedAt: new Date().toISOString(),
      papers: papers.map(normalizePaper),
      comments: comments.map(normalizeHotComment),
      reports: [],
      users: []
    };
  } catch (error) {
    pageSource = "sample";
    console.warn("Using sample data because Supabase could not be loaded:", error);
    return getFallbackData();
  }
}

async function loadAdminData() {
  try {
    const [comments, replies, reports, replyReports, profiles, actions] = await Promise.all([
      supabaseGet("/rest/v1/comments?select=id,paper_id,user_id,content,like_count,status,created_at,papers(paper_key,title),profiles(display_name,status),reports(id,status)&order=created_at.desc&limit=100", adminSession),
      supabaseGet("/rest/v1/comment_replies?select=id,comment_id,paper_id,user_id,content,status,created_at,papers(paper_key,title),profiles(display_name,status)&order=created_at.desc&limit=100", adminSession),
      supabaseGet("/rest/v1/reports?select=id,comment_id,user_id,reason,details,status,created_at,resolved_at,comments(id,paper_id,user_id,content,status,papers(paper_key,title),profiles(display_name,status)),profiles!reports_user_id_fkey(display_name,status)&order=created_at.desc&limit=100", adminSession),
      supabaseGet("/rest/v1/reply_reports?select=id,reply_id,user_id,reason,details,status,created_at,resolved_at,comment_replies(id,comment_id,paper_id,user_id,content,status,papers(paper_key,title),profiles(display_name,status)),profiles!reply_reports_user_id_fkey(display_name,status)&order=created_at.desc&limit=100", adminSession),
      supabaseGet("/rest/v1/profiles?select=id,display_name,role,status,created_at&limit=1000", adminSession),
      supabaseGet("/rest/v1/moderation_actions?select=id,actor_id,action_type,target_type,target_id,previous_status,new_status,created_at,profiles(display_name)&order=created_at.desc&limit=80", adminSession)
    ]);
    const normalizedComments = comments.map(normalizeAdminComment);
    const normalizedReplies = replies.map(normalizeAdminReply);
    const normalizedReports = [
      ...reports.map(normalizeAdminReport),
      ...replyReports.map(normalizeAdminReplyReport)
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    pageSource = comments.length || replies.length || reports.length || replyReports.length || profiles.length ? "live" : "empty";
    return {
      generatedAt: new Date().toISOString(),
      papers: [],
      comments: normalizedComments,
      replies: normalizedReplies,
      reports: normalizedReports,
      actions: actions.map(normalizeModerationAction),
      users: profiles.map((profile) => ({
        id: profile.id,
        name: profile.display_name || profile.id,
        role: profile.role || "user",
        status: profile.status || "active",
        commentCount: normalizedComments.filter((comment) => comment.userId === profile.id).length,
        reportCount: normalizedReports.filter((report) => report.reporterId === profile.id).length,
        createdAt: profile.created_at
      }))
    };
  } catch (error) {
    pageSource = "sample";
    console.warn("Using sample data because Supabase could not be loaded:", error);
    return getFallbackData();
  }
}

function getFallbackPaperData() {
  const data = getFallbackData();
  const id = getPaperParam();
  const paper = data.papers.find((item) => item.id === id || item.paperKey === id) || data.papers[0];
  return {
    generatedAt: data.generatedAt,
    paper,
    comments: data.comments.filter((comment) => comment.paperId === paper.id)
  };
}

async function loadPaperData() {
  const paperParam = getPaperParam();
  if (!paperParam) {
    pageSource = "empty";
    return { paper: null, comments: [] };
  }

  try {
    const paperFilter = paperParam.startsWith("doi:") || paperParam.startsWith("arxiv:") || paperParam.startsWith("pubmed:") || paperParam.startsWith("pmc:") || paperParam.startsWith("pdf:")
      ? `paper_key=eq.${encodeURIComponent(paperParam)}`
      : `id=eq.${encodeURIComponent(paperParam)}`;
    const paperRows = await supabaseGet(`/rest/v1/paper_summary?select=*&${paperFilter}&limit=1`);
    const paper = paperRows[0] ? normalizePaper(paperRows[0]) : null;

    if (!paper) {
      const urlFallback = getPaperFromUrlParams();
      if (urlFallback) {
        pageSource = "link";
        return { paper: urlFallback, comments: [] };
      }

      const fallback = getFallbackPaperData();
      if (fallback.paper && (fallback.paper.id === paperParam || fallback.paper.paperKey === paperParam)) {
        pageSource = "sample";
        return fallback;
      }
      pageSource = "empty";
      return { paper: null, comments: [] };
    }

    const [commentRows, ratingRows, replyRows] = await Promise.all([
      supabaseGet(`/rest/v1/comments?paper_id=eq.${encodeURIComponent(paper.id)}&status=eq.visible&select=id,paper_id,user_id,content,like_count,status,created_at,profiles(display_name)&order=like_count.desc,created_at.desc&limit=50`),
      supabaseGet(`/rest/v1/ratings?paper_id=eq.${encodeURIComponent(paper.id)}&select=user_id,overall_score`),
      supabaseGet(`/rest/v1/comment_replies?paper_id=eq.${encodeURIComponent(paper.id)}&status=eq.visible&select=id,comment_id,paper_id,user_id,content,status,created_at,profiles(display_name)&order=created_at.asc&limit=150`)
    ]);
    const ratingByUser = new Map(ratingRows.map((row) => [row.user_id, row.overall_score]));
    const repliesByComment = new Map();
    replyRows.map(normalizePaperReply).forEach((reply) => {
      const current = repliesByComment.get(reply.commentId) || [];
      current.push(reply);
      repliesByComment.set(reply.commentId, current);
    });
    pageSource = "live";
    return {
      paper,
      comments: commentRows.map((comment) => {
        const normalized = normalizePaperComment(comment, ratingByUser);
        normalized.replies = repliesByComment.get(normalized.id) || [];
        return normalized;
      })
    };
  } catch (error) {
    const urlFallback = getPaperFromUrlParams();
    if (urlFallback) {
      pageSource = "link";
      return { paper: urlFallback, comments: [] };
    }

    pageSource = "sample";
    console.warn("Using sample paper data because Supabase could not be loaded:", error);
    return getFallbackPaperData();
  }
}

function renderPaperItem(paper) {
  const rating = paper.ratingCount ? `${paper.ratingAverage.toFixed(1)}/10` : "No rating";
  return `
    <article class="paper-item">
      <div>
        <h3 class="paper-title"><a href="${escapeHtml(getPaperDetailUrl(paper))}">${escapeHtml(paper.title)}</a></h3>
        <div class="paper-meta">
          <span>${escapeHtml(paper.journal)}</span>
          <span>${escapeHtml(paper.publisher)}</span>
          ${paper.year ? `<span>${escapeHtml(paper.year)}</span>` : ""}
          <span>${escapeHtml(paper.paperKey)}</span>
          <a class="inline-link" href="${escapeHtml(paper.url)}" target="_blank" rel="noreferrer">Open paper</a>
        </div>
      </div>
      <div class="paper-stats" aria-label="Paper stats">
        <span class="stat-pill">${formatNumber(paper.commentCount)} comments</span>
        <span class="stat-pill">${formatNumber(paper.replyCount)} replies</span>
        <span class="stat-pill">${escapeHtml(rating)}</span>
      </div>
    </article>
  `;
}

function renderCommentItem(comment, data) {
  const paper = getPaper(data, comment.paperId);
  const paperTitle = paper?.title || comment.paperTitle || comment.paperKey || comment.paperId;
  const journal = paper?.journal || comment.journal || "Unknown journal";
  const ratingBadge = comment.ratingScore ? `<span class="badge">Rated ${escapeHtml(comment.ratingScore)}/10</span>` : "";
  const replies = Array.isArray(comment.replies) ? comment.replies : [];

  return `
    <article class="comment-item">
      <div class="comment-meta">
        <span class="badge">${formatNumber(comment.likeCount)} likes</span>
        ${replies.length ? `<span class="badge">${formatNumber(replies.length)} replies</span>` : ""}
        ${ratingBadge}
        <span>${escapeHtml(comment.author)}</span>
        <span>${escapeHtml(formatDate(comment.createdAt))}</span>
      </div>
      <p class="comment-body">${escapeHtml(comment.content)}</p>
      ${renderCommentReplies(replies)}
      <div class="paper-meta">
        <span>${escapeHtml(journal)}</span>
        ${comment.paperId ? `<a class="inline-link" href="./paper.html?id=${encodeURIComponent(comment.paperId)}">${escapeHtml(paperTitle)}</a>` : `<span>${escapeHtml(paperTitle)}</span>`}
      </div>
    </article>
  `;
}

function renderCommentReplies(replies = []) {
  if (!replies.length) return "";
  return `
    <div class="reply-list" aria-label="Comment replies">
      ${replies.slice(0, 6).map((reply) => `
        <article class="reply-item">
          <div class="reply-meta">
            <strong>${escapeHtml(reply.author)}</strong>
            <span>${escapeHtml(formatDate(reply.createdAt))}</span>
          </div>
          <p>${escapeHtml(reply.content)}</p>
        </article>
      `).join("")}
      ${replies.length > 6 ? `<div class="reply-overflow">${formatNumber(replies.length - 6)} more replies are available in the extension.</div>` : ""}
    </div>
  `;
}

function renderPaperHero(paper) {
  if (!paper) {
    return createEmptyState("This paper discussion page could not be found yet.");
  }
  const rating = paper.ratingCount ? paper.ratingAverage.toFixed(1) : "--";
  return `
    <div class="paper-hero">
      <div>
        <p class="eyebrow">Paper discussion</p>
        <h1>${escapeHtml(paper.title)}</h1>
        <div class="paper-meta">
          <span>${escapeHtml(paper.journal)}</span>
          <span>${escapeHtml(paper.publisher)}</span>
          ${paper.year ? `<span>${escapeHtml(paper.year)}</span>` : ""}
          <span>${escapeHtml(paper.paperKey)}</span>
        </div>
      </div>
      <div class="paper-score-card" aria-label="Paper rating">
        <div class="paper-score">${escapeHtml(rating)}</div>
        <div class="paper-score-scale">/10</div>
        <div class="status">${formatNumber(paper.ratingCount)} ratings</div>
      </div>
    </div>
    <div class="paper-detail-actions">
      <a class="btn primary" href="${escapeHtml(paper.url)}" target="_blank" rel="noreferrer">Open paper</a>
      <a class="btn" href="./trending.html">Back to trending</a>
    </div>
  `;
}

function renderPaperPage() {
  const data = pageData;
  const replyCount = data.comments.reduce((sum, comment) => sum + (Array.isArray(comment.replies) ? comment.replies.length : 0), 0);
  const rating = data.paper?.ratingCount ? `${data.paper.ratingAverage.toFixed(1)}/10` : "--";
  renderPageNotice();
  if (data.paper?.title) {
    document.title = `${data.paper.title} | Paper Comment Extension`;
  }
  document.querySelector("[data-paper-detail]").innerHTML = renderPaperHero(data.paper);
  document.querySelector("[data-paper-metrics]").innerHTML = data.paper
    ? [
      createMetric("Comments", formatNumber(data.comments.length), "Visible public comments"),
      createMetric("Replies", formatNumber(replyCount), "Visible public replies"),
      createMetric("Rating", rating, `${formatNumber(data.paper.ratingCount)} ratings`),
      createMetric("Source", data.paper.source || data.paper.publisher || "Paper", data.paper.paperKey)
    ].join("")
    : [
      createMetric("Comments", "--", "Discussion not found"),
      createMetric("Replies", "--", "Discussion not found"),
      createMetric("Rating", "--", "Discussion not found"),
      createMetric("Source", "--", "Open from the extension")
    ].join("");
  document.querySelector("[data-paper-comment-status]").textContent = data.comments.length
    ? `${formatNumber(data.comments.length)} public comments - ${formatNumber(replyCount)} replies`
    : "No comments yet";
  document.querySelector("[data-paper-comments]").innerHTML = data.comments.length
    ? [...data.comments].sort(byLikes).map((comment) => renderCommentItem(comment, { papers: data.paper ? [data.paper] : [] })).join("")
    : createEmptyState("No public comments yet. Open this paper with the extension to start the discussion.");

  document.querySelector("[data-copy-paper-link]")?.addEventListener("click", async () => {
    await copyPaperDiscussionLink();
  });

  document.querySelector("[data-share-paper-link]")?.addEventListener("click", async () => {
    await sharePaperDiscussion(data.paper);
  });

  const shareInput = document.querySelector("[data-paper-share-url]");
  if (shareInput) {
    shareInput.value = getAbsoluteUrl(window.location.href);
    shareInput.addEventListener("focus", () => shareInput.select());
  }
}

function getPaperDiscussionSharePayload(paper) {
  return {
    title: paper?.title ? `${paper.title} | Paper Comment Extension` : "Paper discussion",
    text: paper?.title ? `Join the discussion on ${paper.title}.` : "Join this paper discussion.",
    url: window.location.href
  };
}

function setPaperShareStatus(text) {
  const status = document.querySelector("[data-copy-status]");
  if (status) status.textContent = text;
}

async function copyPaperDiscussionLink() {
  try {
    await navigator.clipboard.writeText(window.location.href);
    setPaperShareStatus("Link copied.");
  } catch (error) {
    setPaperShareStatus(window.location.href);
  }
}

async function sharePaperDiscussion(paper) {
  const payload = getPaperDiscussionSharePayload(paper);
  if (navigator.share) {
    try {
      await navigator.share(payload);
      setPaperShareStatus("Share sheet opened.");
      return;
    } catch (error) {
      if (error.name === "AbortError") {
        setPaperShareStatus("Share canceled.");
        return;
      }
    }
  }

  await copyPaperDiscussionLink();
  setPaperShareStatus("Sharing is not available here. Link copied.");
}

function setProfileProtectedVisible(visible) {
  document.querySelectorAll("[data-profile-protected]").forEach((element) => {
    element.hidden = !visible;
  });
}

function renderProfileAuth(message = "") {
  setProfileProtectedVisible(false);
  const auth = document.querySelector("[data-profile-auth]");
  if (!auth) return;
  const isSignUpMode = profileAuthMode === "signup";

  auth.hidden = false;
  auth.innerHTML = `
    <div class="auth-card-inner">
      <div>
        <h2>${isSignUpMode ? "Create your profile" : "Sign in to your profile"}</h2>
        <p class="subtle">${isSignUpMode ? "Use a real email. If confirmation is required, Supabase will send you a link." : "Use the same account you use in the extension."}</p>
      </div>
      <button class="btn google-web-button" type="button" data-profile-google>Continue with Google</button>
      <div class="auth-divider">or use email</div>
      <form class="auth-form" data-profile-login-form>
        <input class="search" type="email" name="email" placeholder="Email" autocomplete="email" value="${escapeHtml(profileAuthEmail)}" required>
        <input class="search" type="password" name="password" placeholder="Password" autocomplete="${isSignUpMode ? "new-password" : "current-password"}" required>
        <button class="btn primary" type="submit">${isSignUpMode ? "Create account" : "Sign in"}</button>
      </form>
      <div class="auth-link-row">
        <button class="link-button" type="button" data-profile-auth-toggle>${isSignUpMode ? "Back to sign in" : "Create account"}</button>
        <button class="link-button" type="button" data-profile-password-reset>Forgot password?</button>
        <button class="link-button" type="button" data-profile-resend-confirmation>Resend confirmation email</button>
      </div>
      ${message ? `<div class="auth-message">${escapeHtml(message)}</div>` : ""}
    </div>
  `;

  const loginForm = auth.querySelector("[data-profile-login-form]");
  auth.querySelector("[data-profile-google]").addEventListener("click", startProfileGoogleSignIn);
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;
    profileAuthEmail = email;
    if (isSignUpMode && password.length < 8) {
      renderProfileAuth("Use at least 8 characters for your password.");
      return;
    }
    renderProfileAuth(isSignUpMode ? "Creating account..." : "Signing in...");
    try {
      if (isSignUpMode) {
        const payload = await signUpProfile(email, password);
        if (!payload?.access_token) {
          profileAuthMode = "signin";
          renderProfileAuth("Account created. Check your inbox and spam folder, confirm your email, then sign in.");
          return;
        }
      } else {
        await signInProfile(email, password);
      }
      profileAuthEmail = "";
      profileUser = await getSessionUser(profileSession);
      profileRow = await getUserProfile(profileUser.id, profileSession);
      await initializeProfileDashboard();
    } catch (error) {
      clearProfileSession();
      renderProfileAuth(error.message);
    }
  });

  auth.querySelector("[data-profile-auth-toggle]").addEventListener("click", () => {
    profileAuthMode = isSignUpMode ? "signin" : "signup";
    profileAuthEmail = loginForm.elements.email.value.trim();
    renderProfileAuth();
  });

  auth.querySelector("[data-profile-password-reset]").addEventListener("click", async () => {
    const email = loginForm.elements.email.value.trim();
    if (!email) {
      renderProfileAuth("Enter your email first.");
      return;
    }
    profileAuthEmail = email;
    renderProfileAuth("Sending password reset email...");
    try {
      await sendPasswordResetEmail(email);
      renderProfileAuth("Password reset email sent. Check your inbox and spam folder.");
    } catch (error) {
      renderProfileAuth(error.message);
    }
  });

  auth.querySelector("[data-profile-resend-confirmation]").addEventListener("click", async () => {
    const email = loginForm.elements.email.value.trim();
    if (!email) {
      renderProfileAuth("Enter your email first.");
      return;
    }
    profileAuthEmail = email;
    renderProfileAuth("Sending confirmation email...");
    try {
      await resendProfileConfirmationEmail(email);
      renderProfileAuth("Confirmation email sent. Check your inbox and spam folder.");
    } catch (error) {
      renderProfileAuth(error.message);
    }
  });
}

function renderProfileSignedInHeader() {
  const auth = document.querySelector("[data-profile-auth]");
  if (!auth) return;
  const status = profileRow?.status || "unknown";
  const statusText = status === "active"
    ? "Signed in to your activity page"
    : `Account ${status}: you can view activity, but posting from the extension is disabled.`;
  auth.hidden = false;
  auth.innerHTML = `
    <div class="auth-card-inner auth-card-compact">
      <div>
        <strong>${escapeHtml(profileRow?.display_name || "Reader")}</strong>
        <div class="status">${escapeHtml(statusText)}</div>
      </div>
      <span class="badge">${escapeHtml(status)}</span>
      <button class="btn" type="button" data-profile-sign-out>Sign out</button>
    </div>
  `;
  auth.querySelector("[data-profile-sign-out]").addEventListener("click", () => {
    clearProfileSession();
    renderProfileAuth("Signed out.");
  });
}

function renderProfileDetails(message = "") {
  const target = document.querySelector("[data-profile-details]");
  if (!target) return;
  const profile = profileRow || {};
  const email = profileUser?.email || "";
  const status = profile.status || "unknown";
  const statusMessage = status === "active"
    ? ""
    : `<div class="auth-message">Your account status is ${escapeHtml(status)}. You can still review your activity, but comments, replies, likes, ratings, and reports require an active account.</div>`;
  document.querySelector("[data-profile-details-status]").textContent = message;
  target.innerHTML = `
    ${statusMessage}
    <form class="profile-form" data-profile-form>
      <label>
        <span>Display name</span>
        <input class="search" name="display_name" maxlength="80" value="${escapeHtml(profile.display_name || "")}" placeholder="Reader name" required>
      </label>
      <label>
        <span>Institution</span>
        <input class="search" name="institution" maxlength="120" value="${escapeHtml(profile.institution || "")}" placeholder="University or lab">
      </label>
      <label>
        <span>ORCID</span>
        <input class="search" name="orcid" maxlength="32" value="${escapeHtml(profile.orcid || "")}" placeholder="0000-0000-0000-0000">
      </label>
      <label>
        <span>Research field</span>
        <input class="search" name="research_field" maxlength="120" value="${escapeHtml(profile.research_field || "")}" placeholder="Materials science, neuroscience...">
      </label>
      <div class="profile-form-footer">
        <span>${escapeHtml(email ? `Signed in as ${email}` : "Your email is not shown publicly.")}</span>
        <button class="btn primary" type="submit">Save profile</button>
      </div>
    </form>
  `;

  target.querySelector("[data-profile-form]").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const displayName = form.elements.display_name.value.trim();
    if (!displayName) {
      renderProfileDetails("Display name is required.");
      return;
    }

    const payload = {
      display_name: displayName,
      institution: form.elements.institution.value.trim() || null,
      orcid: form.elements.orcid.value.trim() || null,
      research_field: form.elements.research_field.value.trim() || null
    };

    document.querySelector("[data-profile-details-status]").textContent = "Saving...";
    try {
      profileRow = await updateUserProfile(payload) || { ...profileRow, ...payload };
      renderProfileSignedInHeader();
      renderProfileDetails("Profile saved.");
    } catch (error) {
      renderProfileDetails(`${error.message} If this mentions research_field, run migration 004.`);
    }
  });
}

function normalizeProfileComment(row) {
  return {
    id: row.id,
    paperId: row.paper_id,
    paperKey: row.paper_key,
    paperTitle: row.paper_title || "Unknown paper",
    paperUrl: row.paper_url || "#",
    content: row.content || "",
    likeCount: Number(row.like_count || 0),
    replyCount: Number(row.reply_count || 0),
    createdAt: row.created_at,
    status: row.status || "visible"
  };
}

function normalizeProfileReply(row) {
  return {
    id: row.id,
    commentId: row.comment_id,
    paperId: row.paper_id,
    paperKey: row.paper_key,
    paperTitle: row.paper_title || "Unknown paper",
    author: row.display_name || "Reader",
    content: row.content || "",
    parentContent: row.parent_content || "",
    createdAt: row.created_at,
    status: row.status || "visible"
  };
}

function normalizeProfileRating(row) {
  const paper = row.papers || {};
  return {
    id: row.id,
    paperId: row.paper_id,
    paperKey: paper.paper_key || row.paper_id,
    paperTitle: paper.title || "Unknown paper",
    paperUrl: paper.url || "#",
    journal: paper.journal || paper.publisher || "Unknown journal",
    score: Number(row.overall_score || 0),
    updatedAt: row.updated_at || row.created_at
  };
}

async function loadProfileData() {
  const userId = profileUser.id;
  const encodedId = encodeURIComponent(userId);
  const [comments, replies, ratings] = await Promise.all([
    supabaseGet(`/rest/v1/user_comment_activity?user_id=eq.${encodedId}&status=eq.visible&select=*&order=created_at.desc&limit=100`, profileSession),
    supabaseGet(`/rest/v1/user_received_replies?parent_user_id=eq.${encodedId}&select=*&order=created_at.desc&limit=100`, profileSession),
    supabaseGet(`/rest/v1/ratings?user_id=eq.${encodedId}&select=id,paper_id,overall_score,created_at,updated_at,papers(id,paper_key,title,url,journal,publisher)&order=updated_at.desc&limit=100`, profileSession)
  ]);

  return {
    comments: comments.map(normalizeProfileComment),
    replies: replies.map(normalizeProfileReply),
    ratings: ratings.map(normalizeProfileRating)
  };
}

function renderProfileComment(comment) {
  return `
    <article class="comment-item">
      <div class="comment-meta">
        <span class="badge">${formatNumber(comment.likeCount)} likes</span>
        <span class="badge">${formatNumber(comment.replyCount)} replies</span>
        <span>${escapeHtml(formatDate(comment.createdAt))}</span>
      </div>
      <p class="comment-body">${escapeHtml(comment.content)}</p>
      <div class="paper-meta">
        <a class="inline-link" href="./paper.html?id=${encodeURIComponent(comment.paperId)}">${escapeHtml(comment.paperTitle)}</a>
        <span>${escapeHtml(comment.paperKey)}</span>
      </div>
    </article>
  `;
}

function renderProfileReply(reply) {
  return `
    <article class="comment-item">
      <div class="comment-meta">
        <span class="badge">Reply</span>
        <span>${escapeHtml(reply.author)}</span>
        <span>${escapeHtml(formatDate(reply.createdAt))}</span>
      </div>
      <p class="comment-body">${escapeHtml(reply.content)}</p>
      <div class="quoted-comment">${escapeHtml(reply.parentContent)}</div>
      <div class="paper-meta">
        <a class="inline-link" href="./paper.html?id=${encodeURIComponent(reply.paperId)}">${escapeHtml(reply.paperTitle)}</a>
        <span>${escapeHtml(reply.paperKey)}</span>
      </div>
    </article>
  `;
}

function renderProfileRating(rating) {
  return `
    <article class="paper-item">
      <div>
        <h3 class="paper-title"><a href="./paper.html?id=${encodeURIComponent(rating.paperId)}">${escapeHtml(rating.paperTitle)}</a></h3>
        <div class="paper-meta">
          <span>${escapeHtml(rating.journal)}</span>
          <span>${escapeHtml(rating.paperKey)}</span>
          <span>${escapeHtml(formatDate(rating.updatedAt))}</span>
        </div>
      </div>
      <div class="paper-stats">
        <span class="stat-pill">${escapeHtml(rating.score.toFixed(1))}/10</span>
      </div>
    </article>
  `;
}

function renderProfilePage() {
  const data = pageData;
  const totalLikes = data.comments.reduce((sum, comment) => sum + comment.likeCount, 0);
  const totalReplies = data.comments.reduce((sum, comment) => sum + comment.replyCount, 0);
  renderProfileDetails();

  document.querySelector("[data-profile-metrics]").innerHTML = [
    createMetric("Comments", formatNumber(data.comments.length), "Your public paper comments"),
    createMetric("Likes", formatNumber(totalLikes), "Likes received on your comments"),
    createMetric("Replies", formatNumber(totalReplies), "Replies received on your comments"),
    createMetric("Ratings", formatNumber(data.ratings.length), "Papers you have scored")
  ].join("");

  document.querySelector("[data-my-comments-status]").textContent = data.comments.length
    ? `${formatNumber(data.comments.length)} comments`
    : "No comments yet";
  document.querySelector("[data-my-comments]").innerHTML = data.comments.length
    ? data.comments.map(renderProfileComment).join("")
    : createEmptyState("Your comments will appear here after you post on a paper.");

  document.querySelector("[data-replies-status]").textContent = data.replies.length
    ? `${formatNumber(data.replies.length)} replies`
    : "No replies yet";
  document.querySelector("[data-replies-to-me]").innerHTML = data.replies.length
    ? data.replies.map(renderProfileReply).join("")
    : createEmptyState("Replies from other readers will appear here.");

  document.querySelector("[data-my-ratings-status]").textContent = data.ratings.length
    ? `${formatNumber(data.ratings.length)} ratings`
    : "No ratings yet";
  document.querySelector("[data-my-ratings]").innerHTML = data.ratings.length
    ? data.ratings.map(renderProfileRating).join("")
    : createEmptyState("Papers you rate in the extension will appear here.");
}

async function initializeProfileDashboard() {
  renderProfileSignedInHeader();
  setProfileProtectedVisible(true);
  try {
    pageData = await loadProfileData();
    renderProfilePage();
  } catch (error) {
    document.querySelector("[data-profile-metrics]").innerHTML = [
      createMetric("Profile", "--", "Database migration may be pending"),
      createMetric("Comments", "--", "Could not load activity"),
      createMetric("Replies", "--", "Could not load activity"),
      createMetric("Ratings", "--", "Could not load activity")
    ].join("");
    document.querySelector("[data-my-comments]").innerHTML = createEmptyState(error.message);
    document.querySelector("[data-replies-to-me]").innerHTML = createEmptyState("Run the latest Supabase migration, then refresh this page.");
    document.querySelector("[data-my-ratings]").innerHTML = createEmptyState("Ratings will appear after profile data loads.");
  }
}

async function initializeProfilePage() {
  renderProfileAuth("Checking saved session...");
  try {
    const oauthSession = parseOAuthSessionFromUrl();
    if (oauthSession) {
      oauthSession.user = await getSessionUser(oauthSession);
      saveProfileSession(oauthSession);
      clearUrlHash();
    }
    const session = await getProfileSession();
    if (!session) {
      renderProfileAuth();
      return;
    }
    profileUser = await getSessionUser(session);
    profileRow = await getUserProfile(profileUser.id, session);
    await initializeProfileDashboard();
  } catch (error) {
    clearProfileSession();
    renderProfileAuth("Please sign in again.");
  }
}

function renderTrendingPage() {
  const data = pageData;
  const totalComments = data.papers.reduce((sum, paper) => sum + Number(paper.commentCount || 0), 0);
  const totalReplies = data.papers.reduce((sum, paper) => sum + Number(paper.replyCount || 0), 0);
  const totalRatings = data.papers.reduce((sum, paper) => sum + Number(paper.ratingCount || 0), 0);
  const topPaper = [...data.papers].filter((paper) => paper.ratingCount > 0).sort(byRating)[0];
  const sourceNote = pageSource === "live" ? "Live Supabase data" : pageSource === "empty" ? "Waiting for first comments" : "Sample data";
  const query = getTrendingQuery();
  const sortMode = getTrendingSortMode();
  const filteredPapers = getFilteredTrendingPapers(data, query);
  const filteredComments = getFilteredTrendingComments(data, query);
  const rankedPapers = [...filteredPapers].sort((a, b) => byTrendingSort(a, b, sortMode));
  const topRatedPapers = [...filteredPapers].filter((paper) => paper.ratingCount).sort(byRating).slice(0, 6);
  renderPageNotice();
  bindTrendingControls();

  document.querySelector("[data-metrics]").innerHTML = [
    createMetric("Comments", formatNumber(totalComments), sourceNote),
    createMetric("Replies", formatNumber(totalReplies), "Discussion threads"),
    createMetric("Ratings", formatNumber(totalRatings), "Article-level scores"),
    createMetric("Top score", topPaper ? `${topPaper.ratingAverage.toFixed(1)}/10` : "--", topPaper?.journal || "No rated papers yet")
  ].join("");

  document.querySelector("[data-most-discussed-status]").textContent = query
    ? `${formatNumber(rankedPapers.length)} matching papers`
    : sortMode === "rating" ? "Sorted by average rating" : sortMode === "newest" ? "Sorted by latest activity" : "Ranked by discussion count";
  document.querySelector("[data-most-discussed]").innerHTML = rankedPapers.length
    ? rankedPapers.map(renderPaperItem).join("")
    : createEmptyState(query ? "No papers match this search." : "No public paper activity yet. Comments and ratings will appear here after users start using the extension.");

  document.querySelector("[data-top-rated-status]").textContent = query
    ? `${formatNumber(topRatedPapers.length)} rated matches`
    : "Average article score";
  document.querySelector("[data-top-rated]").innerHTML = topRatedPapers.length
    ? topRatedPapers.map(renderPaperItem).join("")
    : createEmptyState(query ? "No rated papers match this search." : "No rated papers yet.");

  document.querySelector("[data-hot-comments-status]").textContent = query
    ? `${formatNumber(filteredComments.length)} matching comments`
    : "Most liked comments";
  document.querySelector("[data-hot-comments]").innerHTML = filteredComments.length
    ? [...filteredComments].sort(byLikes).slice(0, 8).map((comment) => renderCommentItem(comment, data)).join("")
    : createEmptyState(query ? "No comments match this search." : "No public comments yet.");
}

function getTrendingQuery() {
  return document.querySelector("[data-trending-search]")?.value.toLowerCase().trim() || "";
}

function getTrendingSortMode() {
  return document.querySelector("[data-trending-sort]")?.value || "discussion";
}

function getFilteredTrendingPapers(data, query) {
  if (!query) return data.papers;
  return data.papers.filter((paper) => {
    const haystack = `${paper.title} ${paper.journal} ${paper.publisher} ${paper.paperKey} ${paper.source || ""}`.toLowerCase();
    return haystack.includes(query);
  });
}

function getFilteredTrendingComments(data, query) {
  if (!query) return data.comments;
  return data.comments.filter((comment) => {
    const paper = getPaper(data, comment.paperId);
    const haystack = `${comment.author} ${comment.content} ${comment.paperTitle || ""} ${comment.paperKey || ""} ${paper?.title || ""} ${paper?.journal || ""}`.toLowerCase();
    return haystack.includes(query);
  });
}

function bindTrendingControls() {
  const search = document.querySelector("[data-trending-search]");
  const sort = document.querySelector("[data-trending-sort]");
  if (search) search.oninput = renderTrendingPage;
  if (sort) sort.onchange = renderTrendingPage;
}

function renderTrendingLoading() {
  const notice = document.querySelector("[data-page-notice]");
  if (notice) notice.hidden = true;
  document.querySelector("[data-metrics]").innerHTML = [
    createMetric("Comments", "--", "Loading"),
    createMetric("Replies", "--", "Loading"),
    createMetric("Ratings", "--", "Loading"),
    createMetric("Top score", "--", "Loading")
  ].join("");
  document.querySelector("[data-most-discussed]").innerHTML = createLoadingState("Loading discussed papers...");
  document.querySelector("[data-top-rated]").innerHTML = createLoadingState("Loading top rated papers...");
  document.querySelector("[data-hot-comments]").innerHTML = createLoadingState("Loading hot comments...");
}

function renderPaperLoading() {
  const notice = document.querySelector("[data-page-notice]");
  if (notice) notice.hidden = true;
  document.querySelector("[data-paper-detail]").innerHTML = createLoadingState("Loading paper discussion...");
  document.querySelector("[data-paper-comment-status]").textContent = "Loading comments...";
  document.querySelector("[data-paper-comments]").innerHTML = createLoadingState("Loading public comments...");
}

function getFilteredAdminComments(data) {
  const query = document.querySelector("[data-admin-search]")?.value.toLowerCase().trim() || "";
  const status = document.querySelector("[data-admin-status]")?.value || "all";
  return data.comments.filter((comment) => {
    const paper = getPaper(data, comment.paperId);
    const haystack = `${comment.author} ${comment.content} ${paper?.title || ""} ${comment.paperTitle || ""} ${comment.paperKey || ""}`.toLowerCase();
    return (!query || haystack.includes(query)) && (status === "all" || comment.status === status);
  });
}

function renderAdminComments() {
  const data = pageData;
  const rows = getFilteredAdminComments(data).map((comment) => `
    <tr>
      <td>
        <strong>${escapeHtml(comment.author)}</strong>
        <div class="status">${escapeHtml(formatDate(comment.createdAt))}</div>
      </td>
      <td>
        ${escapeHtml(comment.content)}
        <div class="status">${escapeHtml(comment.paperKey || comment.paperId)}</div>
      </td>
      <td>${formatNumber(comment.likeCount)}</td>
      <td>${formatNumber(comment.reportCount)}</td>
      <td><span class="badge">${escapeHtml(comment.status)}</span></td>
      <td>
        ${renderAdminCommentActions(comment)}
      </td>
    </tr>
  `).join("");

  document.querySelector("[data-admin-comments]").innerHTML = rows || `
    <tr><td colspan="6">${escapeHtml(pageSource === "empty" ? "No comments yet." : "No comments match the current filters.")}</td></tr>
  `;
}

function renderAdminCommentActions(comment) {
  const id = escapeHtml(comment.id);
  if (comment.status === "deleted") {
    return `
      <div class="button-row">
        <button class="btn" data-comment-id="${id}" data-comment-status="visible">Restore</button>
      </div>
    `;
  }
  if (comment.status === "hidden") {
    return `
      <div class="button-row">
        <button class="btn" data-comment-id="${id}" data-comment-status="visible">Restore</button>
        <button class="btn danger" data-comment-id="${id}" data-comment-status="deleted">Delete</button>
      </div>
    `;
  }
  return `
    <div class="button-row">
      <button class="btn warn" data-comment-id="${id}" data-comment-status="hidden">Hide</button>
      <button class="btn danger" data-comment-id="${id}" data-comment-status="deleted">Delete</button>
    </div>
  `;
}

function renderAdminReports() {
  const data = pageData;
  const reports = getFilteredAdminReports(data);
  document.querySelector("[data-admin-reports]").innerHTML = reports.length ? reports.map((report) => `
      <tr>
        <td>
          <strong>${escapeHtml(report.reason)}</strong>
          <div><span class="badge">${escapeHtml(report.targetType)}</span></div>
          <div class="status">By ${escapeHtml(report.reporter)} - ${escapeHtml(formatDate(report.createdAt))}</div>
        </td>
        <td>
          <div class="report-comment">${escapeHtml(report.commentContent || "Comment content unavailable.")}</div>
          <div class="status">${escapeHtml(report.commentAuthor)} - ${escapeHtml(report.paperKey || report.commentId)}</div>
        </td>
        <td>${escapeHtml(report.details || "No details provided.")}</td>
        <td><span class="badge">${escapeHtml(report.status)}</span></td>
        <td>
          <div class="button-row">
            <button class="btn" data-report-type="${escapeHtml(report.reportType)}" data-report-id="${escapeHtml(report.id)}" data-report-status="reviewing">Reviewing</button>
            <button class="btn primary" data-report-type="${escapeHtml(report.reportType)}" data-report-id="${escapeHtml(report.id)}" data-report-status="resolved">Resolve</button>
            <button class="btn" data-report-type="${escapeHtml(report.reportType)}" data-report-id="${escapeHtml(report.id)}" data-report-status="dismissed">Dismiss</button>
          </div>
          ${renderAdminReportTargetActions(report)}
        </td>
      </tr>
    `).join("") : `
    <tr><td colspan="5">${escapeHtml(pageSource === "empty" ? "No reports yet." : "Reports require an authenticated admin connection.")}</td></tr>
  `;
}

function getFilteredAdminReports(data) {
  const query = document.querySelector("[data-admin-report-search]")?.value.toLowerCase().trim() || "";
  const status = document.querySelector("[data-admin-report-status]")?.value || "active";
  const type = document.querySelector("[data-admin-report-type]")?.value || "all";
  return (data.reports || []).filter((report) => {
    const haystack = `${report.reason} ${report.details} ${report.reporter} ${report.commentAuthor} ${report.commentContent} ${report.paperKey} ${report.targetId}`.toLowerCase();
    const statusMatch = status === "all"
      || report.status === status
      || (status === "active" && (report.status === "open" || report.status === "reviewing"));
    const typeMatch = type === "all" || report.targetType === type;
    return (!query || haystack.includes(query)) && statusMatch && typeMatch;
  });
}

function renderAdminUsers() {
  const users = getFilteredAdminUsers(pageData);
  const rows = users.map((user) => `
    <tr>
      <td>
        <strong>${escapeHtml(user.name || user.id)}</strong>
        <div class="status">${escapeHtml(user.id)}</div>
      </td>
      <td><span class="badge">${escapeHtml(user.role || "user")}</span></td>
      <td><span class="badge">${escapeHtml(user.status || "active")}</span></td>
      <td>
        <div class="status">${formatNumber(user.commentCount)} comments</div>
        <div class="status">${formatNumber(user.reportCount)} reports filed</div>
      </td>
      <td>${renderAdminUserActions(user)}</td>
    </tr>
  `).join("");

  document.querySelector("[data-admin-users]").innerHTML = rows || `
    <tr><td colspan="5">${escapeHtml(pageSource === "empty" ? "No users yet." : "No users available.")}</td></tr>
  `;
}

function getFilteredAdminUsers(data) {
  const query = document.querySelector("[data-admin-user-search]")?.value.toLowerCase().trim() || "";
  const status = document.querySelector("[data-admin-user-status]")?.value || "all";
  const role = document.querySelector("[data-admin-user-role]")?.value || "all";
  return (data.users || []).filter((user) => {
    const haystack = `${user.name} ${user.id} ${user.role} ${user.status}`.toLowerCase();
    return (!query || haystack.includes(query))
      && (status === "all" || user.status === status)
      && (role === "all" || user.role === role);
  });
}

function renderAdminUserDetail() {
  const section = document.querySelector("[data-admin-user-detail-section]");
  const target = document.querySelector("[data-admin-user-detail]");
  const status = document.querySelector("[data-admin-user-detail-status]");
  if (!section || !target || !status) return;

  if (!selectedAdminUserId) {
    section.hidden = true;
    target.innerHTML = "";
    return;
  }

  const user = (pageData.users || []).find((item) => item.id === selectedAdminUserId);
  if (!user) {
    section.hidden = true;
    selectedAdminUserId = null;
    target.innerHTML = "";
    return;
  }

  const comments = (pageData.comments || []).filter((comment) => comment.userId === user.id);
  const replies = (pageData.replies || []).filter((reply) => reply.userId === user.id);
  const reports = (pageData.reports || []).filter((report) => report.reporterId === user.id);
  const actions = (pageData.actions || []).filter((action) => action.targetType === "user" && action.targetId === user.id);

  section.hidden = false;
  status.textContent = `${user.name || user.id} - ${user.status}`;
  target.innerHTML = `
    <div class="user-detail-grid">
      <article>
        <h3>Recent comments</h3>
        ${renderAdminUserContentList(comments, "No recent comments.")}
      </article>
      <article>
        <h3>Recent replies</h3>
        ${renderAdminUserContentList(replies, "No recent replies.")}
      </article>
      <article>
        <h3>Reports filed</h3>
        ${renderAdminUserReportList(reports)}
      </article>
      <article>
        <h3>Status history</h3>
        ${renderAdminUserActionList(actions)}
      </article>
    </div>
  `;
}

function renderAdminUserContentList(items, emptyText) {
  if (!items.length) return `<p class="status">${escapeHtml(emptyText)}</p>`;
  return `
    <div class="detail-list">
      ${items.slice(0, 6).map((item) => `
        <div class="detail-list-item">
          <div>
            <span class="badge">${escapeHtml(item.status)}</span>
            <span class="status">${escapeHtml(formatDate(item.createdAt))}</span>
          </div>
          <p>${escapeHtml(item.content)}</p>
          <div class="status">${escapeHtml(item.paperKey || item.paperId || "")}</div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderAdminUserReportList(reports) {
  if (!reports.length) return `<p class="status">No reports filed.</p>`;
  return `
    <div class="detail-list">
      ${reports.slice(0, 6).map((report) => `
        <div class="detail-list-item">
          <div>
            <span class="badge">${escapeHtml(report.targetType)}</span>
            <span class="badge">${escapeHtml(report.status)}</span>
            <span class="status">${escapeHtml(formatDate(report.createdAt))}</span>
          </div>
          <p>${escapeHtml(report.reason)}: ${escapeHtml(report.details || "No details provided.")}</p>
          <div class="status">${escapeHtml(report.paperKey || report.targetId || "")}</div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderAdminUserActionList(actions) {
  if (!actions.length) return `<p class="status">No status moderation history.</p>`;
  return `
    <div class="detail-list">
      ${actions.slice(0, 6).map((action) => `
        <div class="detail-list-item">
          <div>
            <span class="badge">${escapeHtml(action.previousStatus || "--")} -> ${escapeHtml(action.newStatus || "--")}</span>
            <span class="status">${escapeHtml(formatDate(action.createdAt))}</span>
          </div>
          <p>${escapeHtml(action.actor)} changed this user status.</p>
        </div>
      `).join("")}
    </div>
  `;
}

function renderAdminAuditTrail() {
  const actions = getFilteredAdminAudit(pageData);
  const rows = actions.map((action) => `
    <tr>
      <td>
        <strong>${escapeHtml(action.actor)}</strong>
        <div class="status">${escapeHtml(action.actorId)}</div>
      </td>
      <td>${escapeHtml(action.actionType)}</td>
      <td>
        <span class="badge">${escapeHtml(action.targetType)}</span>
        <div class="status">${escapeHtml(action.targetId)}</div>
      </td>
      <td>${escapeHtml(action.previousStatus || "--")} -> ${escapeHtml(action.newStatus || "--")}</td>
      <td>${escapeHtml(formatDate(action.createdAt))}</td>
    </tr>
  `).join("");

  document.querySelector("[data-admin-audit]").innerHTML = rows || `
    <tr><td colspan="5">${escapeHtml(pageSource === "empty" ? "No audit actions yet." : "Run migration 009 to enable audit logs.")}</td></tr>
  `;
}

function getFilteredAdminAudit(data) {
  const query = document.querySelector("[data-admin-audit-search]")?.value.toLowerCase().trim() || "";
  const type = document.querySelector("[data-admin-audit-type]")?.value || "all";
  return (data.actions || []).filter((action) => {
    const haystack = `${action.actor} ${action.actorId} ${action.actionType} ${action.targetType} ${action.targetId} ${action.previousStatus} ${action.newStatus}`.toLowerCase();
    return (!query || haystack.includes(query)) && (type === "all" || action.actionType === type);
  });
}

function renderAdminUserActions(user) {
  const id = escapeHtml(user.id);
  const isSelf = adminProfile?.id === user.id;
  if (isSelf) {
    return `<span class="status">Current admin</span>`;
  }
  const details = `<button class="btn" data-user-detail-id="${id}">Details</button>`;
  if (user.status === "deleted") {
    return `
      <div class="button-row">
        ${details}
        <button class="btn" data-user-id="${id}" data-user-status="active">Reactivate</button>
      </div>
    `;
  }
  if (user.status === "suspended") {
    return `
      <div class="button-row">
        ${details}
        <button class="btn" data-user-id="${id}" data-user-status="active">Reactivate</button>
        <button class="btn danger" data-user-id="${id}" data-user-status="deleted">Mark deleted</button>
      </div>
    `;
  }
  return `
    <div class="button-row">
      ${details}
      <button class="btn warn" data-user-id="${id}" data-user-status="suspended">Suspend</button>
      <button class="btn danger" data-user-id="${id}" data-user-status="deleted">Mark deleted</button>
    </div>
  `;
}

function renderAdminReportTargetActions(report) {
  const targetId = escapeHtml(report.targetId);
  const targetType = escapeHtml(report.targetType);
  if (report.commentStatus === "deleted") {
    return `
      <div class="button-row">
        <button class="btn" data-target-type="${targetType}" data-target-id="${targetId}" data-target-status="visible">Restore ${targetType}</button>
      </div>
    `;
  }
  if (report.commentStatus === "hidden") {
    return `
      <div class="button-row">
        <button class="btn" data-target-type="${targetType}" data-target-id="${targetId}" data-target-status="visible">Restore ${targetType}</button>
        <button class="btn danger" data-target-type="${targetType}" data-target-id="${targetId}" data-target-status="deleted">Delete ${targetType}</button>
      </div>
    `;
  }
  return `
    <div class="button-row">
      <button class="btn warn" data-target-type="${targetType}" data-target-id="${targetId}" data-target-status="hidden">Hide ${targetType}</button>
      <button class="btn danger" data-target-type="${targetType}" data-target-id="${targetId}" data-target-status="deleted">Delete ${targetType}</button>
    </div>
  `;
}

async function updateReportStatus(reportType, reportId, status) {
  if (!adminSession || !adminProfile) {
    throw new Error("Sign in as an active admin first.");
  }

  await supabaseRpc("admin_update_report_status", {
    p_report_type: reportType,
    p_report_id: reportId,
    p_status: status
  }, adminSession);
}

async function updateCommentStatus(commentId, status) {
  if (!adminSession || !adminProfile) {
    throw new Error("Sign in as an active admin first.");
  }

  await supabaseRpc("admin_update_content_status", {
    p_target_type: "comment",
    p_target_id: commentId,
    p_status: status
  }, adminSession);
}

async function updateReplyStatus(replyId, status) {
  if (!adminSession || !adminProfile) {
    throw new Error("Sign in as an active admin first.");
  }

  await supabaseRpc("admin_update_content_status", {
    p_target_type: "reply",
    p_target_id: replyId,
    p_status: status
  }, adminSession);
}

async function updateUserStatus(userId, status) {
  if (!adminSession || !adminProfile) {
    throw new Error("Sign in as an active admin first.");
  }
  if (userId === adminProfile.id) {
    throw new Error("You cannot change your own admin account status here.");
  }

  await supabaseRpc("admin_update_user_status", {
    p_user_id: userId,
    p_status: status
  }, adminSession);
}

async function updateModerationTargetStatus(targetType, targetId, status) {
  if (targetType === "reply") {
    await updateReplyStatus(targetId, status);
    return;
  }
  await updateCommentStatus(targetId, status);
}

function renderAdminPage() {
  const data = pageData;
  const openReports = data.reports.filter((report) => report.status === "open" || report.status === "reviewing").length;
  const hiddenComments = data.comments.filter((comment) => comment.status !== "visible").length;
  const totalComments = data.comments.length;
  const activeUsers = data.users.filter((user) => user.status === "active").length;
  const sourceNote = pageSource === "live" ? "Live comment queue" : pageSource === "empty" ? "No live comments yet" : "Sample data";

  document.querySelector("[data-admin-metrics]").innerHTML = [
    createMetric("Comments", totalComments, sourceNote),
    createMetric("Open reports", openReports, "Live report queue"),
    createMetric("Hidden comments", hiddenComments, "Moderation status"),
    createMetric("Active users", activeUsers, "Public profile count")
  ].join("");

  renderAdminComments();
  renderAdminReports();
  renderAdminUsers();
  renderAdminUserDetail();
  renderAdminAuditTrail();
  setStatus("[data-admin-output]", pageSource === "sample"
    ? "Sample mode. Supabase data could not be loaded."
    : "Admin data loaded. Moderation updates run through audited Supabase RPC actions.");

  document.querySelectorAll("[data-admin-search], [data-admin-status]").forEach((control) => {
    control.oninput = renderAdminComments;
    control.onchange = renderAdminComments;
  });
  document.querySelectorAll("[data-admin-report-search], [data-admin-report-status], [data-admin-report-type]").forEach((control) => {
    control.oninput = renderAdminReports;
    control.onchange = renderAdminReports;
  });
  document.querySelectorAll("[data-admin-user-search], [data-admin-user-status], [data-admin-user-role]").forEach((control) => {
    control.oninput = () => {
      renderAdminUsers();
      renderAdminUserDetail();
    };
    control.onchange = () => {
      renderAdminUsers();
      renderAdminUserDetail();
    };
  });
  document.querySelectorAll("[data-admin-audit-search], [data-admin-audit-type]").forEach((control) => {
    control.oninput = renderAdminAuditTrail;
    control.onchange = renderAdminAuditTrail;
  });

  if (adminEventsBound) return;
  adminEventsBound = true;
  document.addEventListener("click", async (event) => {
    const reportAction = event.target.closest("[data-report-status]");
    if (reportAction) {
      const output = document.querySelector("[data-admin-output]");
      output.textContent = "Updating report status...";
      try {
        await updateReportStatus(reportAction.dataset.reportType, reportAction.dataset.reportId, reportAction.dataset.reportStatus);
        pageData = await loadAdminData();
        renderAdminPage();
        setStatus("[data-admin-output]", `Report marked ${reportAction.dataset.reportStatus}.`);
      } catch (error) {
        output.textContent = error.message;
      }
      return;
    }

    const targetAction = event.target.closest("[data-target-status]");
    if (targetAction) {
      const output = document.querySelector("[data-admin-output]");
      output.textContent = "Updating reported content status...";
      try {
        await updateModerationTargetStatus(targetAction.dataset.targetType, targetAction.dataset.targetId, targetAction.dataset.targetStatus);
        pageData = await loadAdminData();
        renderAdminPage();
        setStatus("[data-admin-output]", `${targetAction.dataset.targetType} marked ${targetAction.dataset.targetStatus}.`);
      } catch (error) {
        output.textContent = error.message;
      }
      return;
    }

    const userAction = event.target.closest("[data-user-status]");
    if (userAction) {
      const output = document.querySelector("[data-admin-output]");
      output.textContent = "Updating user status...";
      try {
        await updateUserStatus(userAction.dataset.userId, userAction.dataset.userStatus);
        pageData = await loadAdminData();
        renderAdminPage();
        setStatus("[data-admin-output]", `User marked ${userAction.dataset.userStatus}.`);
      } catch (error) {
        output.textContent = error.message;
      }
      return;
    }

    const userDetailAction = event.target.closest("[data-user-detail-id]");
    if (userDetailAction) {
      selectedAdminUserId = userDetailAction.dataset.userDetailId;
      renderAdminUserDetail();
      return;
    }

    const commentAction = event.target.closest("[data-comment-status]");
    if (!commentAction) return;
    const output = document.querySelector("[data-admin-output]");
    output.textContent = "Updating comment status...";
    try {
      await updateCommentStatus(commentAction.dataset.commentId, commentAction.dataset.commentStatus);
      pageData = await loadAdminData();
      renderAdminPage();
      setStatus("[data-admin-output]", `Comment marked ${commentAction.dataset.commentStatus}.`);
    } catch (error) {
      output.textContent = error.message;
    }
  });
}

function setAdminProtectedVisible(visible) {
  document.querySelectorAll("[data-admin-protected], [data-admin-toolbar]").forEach((element) => {
    element.hidden = !visible;
  });
}

function renderAdminAuth(message = "") {
  setAdminProtectedVisible(false);
  const auth = document.querySelector("[data-admin-auth]");
  if (!auth) return;

  auth.hidden = false;
  auth.innerHTML = `
    <div class="auth-card-inner">
      <div>
        <h2>Admin sign-in required</h2>
        <p class="subtle">Only active admin accounts can open moderation tools.</p>
      </div>
      <form class="auth-form" data-admin-login-form>
        <input class="search" type="email" name="email" placeholder="Admin email" autocomplete="email" required>
        <input class="search" type="password" name="password" placeholder="Password" autocomplete="current-password" required>
        <button class="btn primary" type="submit">Sign in</button>
      </form>
      ${message ? `<div class="auth-message">${escapeHtml(message)}</div>` : ""}
    </div>
  `;

  auth.querySelector("[data-admin-login-form]").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;
    renderAdminAuth("Checking admin access...");
    try {
      const session = await signInAdmin(email, password);
      const user = await getSessionUser(session);
      const profile = await getAdminProfile(user.id, session);
      if (!hasAdminAccess(profile)) {
        clearAdminSession();
        renderAdminAuth("This account is not an active admin.");
        return;
      }
      adminProfile = profile;
      await initializeAdminDashboard();
    } catch (error) {
      clearAdminSession();
      renderAdminAuth(error.message);
    }
  });
}

function renderAdminDenied(message) {
  clearAdminSession();
  renderAdminAuth(message || "Admin access denied.");
}

function renderAdminSignedInHeader() {
  const auth = document.querySelector("[data-admin-auth]");
  if (!auth) return;
  auth.hidden = false;
  auth.innerHTML = `
    <div class="auth-card-inner auth-card-compact">
      <div>
        <strong>${escapeHtml(adminProfile?.display_name || "Admin")}</strong>
        <div class="status">Signed in as admin</div>
      </div>
      <button class="btn" type="button" data-admin-sign-out>Sign out</button>
    </div>
  `;
  auth.querySelector("[data-admin-sign-out]").addEventListener("click", () => {
    clearAdminSession();
    renderAdminAuth("Signed out.");
  });
}

async function initializeAdminDashboard() {
  renderAdminSignedInHeader();
  setAdminProtectedVisible(true);
  pageData = await loadAdminData();
  renderAdminPage();
}

async function initializeAdminPage() {
  renderAdminAuth("Checking saved session...");
  try {
    const session = await getAdminSession();
    if (!session) {
      renderAdminAuth();
      return;
    }
    const user = await getSessionUser(session);
    const profile = await getAdminProfile(user.id, session);
    if (!hasAdminAccess(profile)) {
      renderAdminDenied("This account is not an active admin.");
      return;
    }
    adminProfile = profile;
    await initializeAdminDashboard();
  } catch (error) {
    clearAdminSession();
    renderAdminAuth("Please sign in again.");
  }
}

async function initializePage() {
  if (document.body.dataset.page === "trending") {
    renderTrendingLoading();
    pageData = await loadTrendingData();
    renderTrendingPage();
  }
  if (document.body.dataset.page === "admin") {
    await initializeAdminPage();
  }
  if (document.body.dataset.page === "paper") {
    renderPaperLoading();
    pageData = await loadPaperData();
    renderPaperPage();
  }
  if (document.body.dataset.page === "profile") {
    await initializeProfilePage();
  }
}

document.addEventListener("DOMContentLoaded", initializePage);
