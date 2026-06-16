(function () {
  const namespace = (window.PaperComment = window.PaperComment || {});
  const config = window.PCE_SUPABASE_CONFIG;
  const SESSION_KEY = "paper-comments:supabase-session";

  function isConfigured() {
    return Boolean(config?.url && config?.anonKey && !config.url.includes("YOUR_PROJECT_ID"));
  }

  function getLocalDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function storageGet(keys) {
    return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
  }

  function storageSet(value) {
    return new Promise((resolve) => chrome.storage.local.set(value, resolve));
  }

  function storageRemove(keys) {
    return new Promise((resolve) => chrome.storage.local.remove(keys, resolve));
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

  function shouldRefreshSession(session) {
    return Boolean(session?.refresh_token && session?.expires_at && Date.now() / 1000 > session.expires_at - 60);
  }

  async function getSession() {
    const result = await storageGet([SESSION_KEY]);
    const session = result[SESSION_KEY] || null;
    if (!shouldRefreshSession(session)) return session;

    try {
      return await refreshSession(session);
    } catch (error) {
      await storageRemove([SESSION_KEY]);
      return null;
    }
  }

  async function setSession(session) {
    await storageSet({ [SESSION_KEY]: normalizeSession(session) });
  }

  async function getCurrentUser() {
    const session = await getSession();
    return session?.user || null;
  }

  async function getCurrentProfile() {
    const user = await getCurrentUser();
    if (!user) return null;

    const rows = await request(`/rest/v1/profiles?id=eq.${encodeFilter(user.id)}&select=id,display_name,role,status`);
    return rows[0] || null;
  }

  function getHeaders(session, extra = {}) {
    const token = session?.access_token || config.anonKey;
    return {
      apikey: config.anonKey,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...extra
    };
  }

  async function request(path, options = {}) {
    if (!isConfigured()) throw new Error("Supabase is not configured.");

    const session = await getSession();
    const response = await fetch(`${config.url}${path}`, {
      method: options.method || "GET",
      headers: getHeaders(session, options.headers),
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;

    if (!response.ok) {
      throw new Error(payload?.message || payload?.error_description || payload?.hint || "Supabase request failed.");
    }

    return payload;
  }

  async function authRequest(path, body) {
    const response = await fetch(`${config.url}${path}`, {
      method: "POST",
      headers: getHeaders(null),
      body: JSON.stringify(body)
    });
    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;
    if (!response.ok) {
      const rawMessage = payload?.msg || payload?.message || payload?.error_description || "Authentication failed.";
      const error = new Error(getAuthErrorMessage(payload, rawMessage));
      error.code = payload?.error_code || payload?.code || "";
      throw error;
    }
    return payload;
  }

  function getAuthErrorMessage(payload, rawMessage) {
    const code = payload?.error_code || payload?.code || "";
    const message = String(rawMessage || "").toLowerCase();

    if (code === "email_address_invalid" || message.includes("email address") && message.includes("invalid")) {
      return "Use a real email address. Temporary or example emails may be blocked by Supabase.";
    }
    if (code === "weak_password" || message.includes("password")) {
      return rawMessage || "Use a stronger password.";
    }
    if (code === "signup_disabled") {
      return "Sign ups are disabled in Supabase. Enable new user signups in Authentication settings.";
    }
    if (code === "email_provider_disabled") {
      return "Email/password sign-in is disabled in Supabase. Enable the Email provider in Authentication.";
    }
    if (code === "over_email_send_rate_limit") {
      return "Too many confirmation emails were requested. Wait a while and try again.";
    }
    if (code === "email_not_confirmed") {
      return "Confirm your email first, then sign in.";
    }
    if (code === "user_not_found" || message.includes("invalid login credentials")) {
      return "Email or password is incorrect.";
    }
    if (code === "user_already_exists" || message.includes("already registered")) {
      return "This email is already registered. Try Sign in instead.";
    }

    return rawMessage || "Authentication failed.";
  }

  async function refreshSession(session) {
    const payload = await authRequest("/auth/v1/token?grant_type=refresh_token", {
      refresh_token: session.refresh_token
    });
    const nextSession = normalizeSession(payload);
    await setSession(nextSession);
    return nextSession;
  }

  async function signUp(email, password) {
    const payload = await authRequest("/auth/v1/signup", { email, password });
    if (payload.access_token) await setSession(payload);
    return payload;
  }

  async function signIn(email, password) {
    const payload = await authRequest("/auth/v1/token?grant_type=password", { email, password });
    await setSession(payload);
    return payload;
  }

  async function sendPasswordReset(email) {
    return authRequest("/auth/v1/recover", { email });
  }

  async function resendConfirmationEmail(email) {
    return authRequest("/auth/v1/resend", { type: "signup", email });
  }

  async function signInWithGoogle() {
    const response = await chrome.runtime.sendMessage({ type: "PCE_SIGN_IN_WITH_GOOGLE" });
    if (!response?.ok) {
      throw new Error(response?.error || "Google sign-in failed.");
    }
    return response.session;
  }

  async function signOut() {
    await storageRemove([SESSION_KEY]);
  }

  function encodeFilter(value) {
    return encodeURIComponent(value);
  }

  async function getPaperByKey(paperKey) {
    const rows = await request(`/rest/v1/papers?paper_key=eq.${encodeFilter(paperKey)}&select=*`);
    return rows[0] || null;
  }

  function getPaperPayload(paper) {
    return {
      paper_key: paper.key,
      doi: paper.doi || null,
      arxiv_id: paper.arxivId || null,
      pubmed_id: paper.pubmedId || null,
      pmc_id: paper.pmcId || null,
      url: paper.url,
      title: paper.title || paper.key,
      source: paper.source || null
    };
  }

  async function ensurePaper(paper) {
    const existing = await getPaperByKey(paper.key);
    if (existing) return existing;

    const rows = await request("/rest/v1/papers?on_conflict=paper_key&select=*", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,select=representation" },
      body: getPaperPayload(paper)
    });
    return rows[0];
  }

  async function getPaperId(paperKey) {
    const paper = await getPaperByKey(paperKey);
    return paper?.id || null;
  }

  async function listComments(paperKey) {
    const paperId = await getPaperId(paperKey);
    if (!paperId) return [];

    const comments = await request(`/rest/v1/comments?paper_id=eq.${paperId}&status=eq.visible&select=*&order=created_at.desc`);
    const commentIds = comments.map((comment) => comment.id);
    const userIds = [...new Set(comments.map((comment) => comment.user_id))];

    const [ratings, likes, replies] = await Promise.all([
      userIds.length
        ? request(`/rest/v1/ratings?paper_id=eq.${paperId}&user_id=in.(${userIds.join(",")})&select=user_id,overall_score`)
        : [],
      commentIds.length
        ? request(`/rest/v1/comment_likes?comment_id=in.(${commentIds.join(",")})&select=comment_id,user_id`)
        : [],
      commentIds.length
        ? request(`/rest/v1/comment_replies?comment_id=in.(${commentIds.join(",")})&status=eq.visible&select=id,comment_id,user_id,content,created_at,profiles(display_name)&order=created_at.asc`).catch(() => [])
        : []
    ]);

    const ratingByUser = new Map(ratings.map((rating) => [rating.user_id, rating.overall_score]));
    const likesByComment = new Map();
    for (const like of likes) {
      const list = likesByComment.get(like.comment_id) || [];
      list.push(like.user_id);
      likesByComment.set(like.comment_id, list);
    }
    const repliesByComment = new Map();
    for (const reply of replies) {
      const list = repliesByComment.get(reply.comment_id) || [];
      list.push({
        id: reply.id,
        commentId: reply.comment_id,
        userId: reply.user_id,
        author: reply.profiles?.display_name || "Reader",
        content: reply.content,
        createdAt: reply.created_at
      });
      repliesByComment.set(reply.comment_id, list);
    }

    return comments.map((comment) => ({
      id: comment.id,
      paperKey,
      userId: comment.user_id,
      content: comment.content,
      likeCount: comment.like_count || 0,
      likedBy: likesByComment.get(comment.id) || [],
      replies: repliesByComment.get(comment.id) || [],
      replyCount: (repliesByComment.get(comment.id) || []).length,
      ratingScore: ratingByUser.get(comment.user_id) || null,
      createdAt: comment.created_at
    }));
  }

  async function hasCommentedToday(paperKey) {
    const user = await getCurrentUser();
    const paperId = await getPaperId(paperKey);
    if (!user || !paperId) return false;

    const today = getLocalDateKey();
    const rows = await request(`/rest/v1/comments?paper_id=eq.${paperId}&user_id=eq.${user.id}&local_date=eq.${today}&select=id`);
    return rows.length > 0;
  }

  async function addComment(paperKey, input, paper) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Sign in to post a comment.");

    const paperRow = await ensurePaper(paper);
    await request("/rest/v1/comments", {
      method: "POST",
      body: {
        paper_id: paperRow.id,
        user_id: user.id,
        content: input.content.trim(),
        local_date: getLocalDateKey()
      }
    });
  }

  async function addReply(paperKey, commentId, input, paper) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Sign in to reply.");

    const paperRow = await ensurePaper(paper);
    await request("/rest/v1/comment_replies", {
      method: "POST",
      body: {
        comment_id: commentId,
        paper_id: paperRow.id,
        user_id: user.id,
        content: input.content.trim()
      }
    });
  }

  async function getPaperRating(paperKey) {
    const user = await getCurrentUser();
    const paperId = await getPaperId(paperKey);
    if (!user || !paperId) return null;

    const rows = await request(`/rest/v1/ratings?paper_id=eq.${paperId}&user_id=eq.${user.id}&select=*`);
    const rating = rows[0];
    return rating ? {
      id: rating.id,
      paperKey,
      userId: rating.user_id,
      scores: { overall: rating.overall_score },
      lastUpdatedDate: rating.last_updated_date,
      createdAt: rating.created_at,
      updatedAt: rating.updated_at
    } : null;
  }

  async function getPaperRatingSummary(paperKey) {
    const paperId = await getPaperId(paperKey);
    if (!paperId) return { count: 0, average: null };

    const rows = await request(`/rest/v1/ratings?paper_id=eq.${paperId}&select=overall_score`);
    if (!rows.length) return { count: 0, average: null };

    return {
      count: rows.length,
      average: rows.reduce((sum, row) => sum + row.overall_score, 0) / rows.length
    };
  }

  async function canUpdateRatingToday(paperKey) {
    const rating = await getPaperRating(paperKey);
    if (!rating) return true;
    return rating.lastUpdatedDate !== getLocalDateKey();
  }

  async function savePaperRating(paperKey, scores, paper) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Sign in to rate this paper.");

    const paperRow = await ensurePaper(paper);
    await request("/rest/v1/ratings?on_conflict=paper_id,user_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: {
        paper_id: paperRow.id,
        user_id: user.id,
        overall_score: scores.overall,
        last_updated_date: getLocalDateKey()
      }
    });
  }

  async function toggleCommentLike(paperKey, commentId) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Sign in to like comments.");

    const rows = await request(`/rest/v1/comment_likes?comment_id=eq.${commentId}&user_id=eq.${user.id}&select=id`);
    if (rows[0]) {
      await request(`/rest/v1/comment_likes?id=eq.${rows[0].id}`, { method: "DELETE" });
      return;
    }

    await request("/rest/v1/comment_likes", {
      method: "POST",
      body: {
        comment_id: commentId,
        user_id: user.id
      }
    });
  }

  async function reportComment(paperKey, commentId, input) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Sign in to report comments.");

    await request("/rest/v1/reports", {
      method: "POST",
      body: {
        comment_id: commentId,
        user_id: user.id,
        reason: input.reason,
        details: input.details?.trim() || null
      }
    });
  }

  async function reportReply(paperKey, replyId, input) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Sign in to report replies.");

    await request("/rest/v1/reply_reports", {
      method: "POST",
      body: {
        reply_id: replyId,
        user_id: user.id,
        reason: input.reason,
        details: input.details?.trim() || null
      }
    });
  }

  namespace.cloudStore = {
    isConfigured,
    getCurrentUser,
    getCurrentProfile,
    signUp,
    signIn,
    signInWithGoogle,
    sendPasswordReset,
    resendConfirmationEmail,
    signOut,
    listComments,
    addComment,
    addReply,
    toggleCommentLike,
    reportComment,
    reportReply,
    hasCommentedToday,
    getLocalUserId: async () => (await getCurrentUser())?.id || null,
    getPaperRating,
    getPaperRatingSummary,
    canUpdateRatingToday,
    savePaperRating
  };
})();
