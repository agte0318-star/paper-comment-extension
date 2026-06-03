const SUPABASE_URL = "https://cckjactvkvgttknhxnot.supabase.co";
const SUPABASE_KEY = "sb_publishable_RD5ZwdePAnqLRCwzfe9fUQ_CLQIaOzr";

let pageData = null;
let pageSource = "sample";

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

async function supabaseGet(path) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`
    }
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(payload?.message || payload?.hint || "Supabase request failed.");
  }
  return payload || [];
}

function getPaper(data, paperId) {
  return data.papers.find((paper) => paper.id === paperId);
}

function byNewest(a, b) {
  return new Date(b.lastActiveAt || b.createdAt || 0) - new Date(a.lastActiveAt || a.createdAt || 0);
}

function byComments(a, b) {
  return b.commentCount - a.commentCount || byNewest(a, b);
}

function byRating(a, b) {
  return b.ratingAverage - a.ratingAverage || b.ratingCount - a.ratingCount || byNewest(a, b);
}

function byLikes(a, b) {
  return b.likeCount - a.likeCount || new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
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

function createEmptyState(message) {
  return `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function setStatus(selector, message) {
  const element = document.querySelector(selector);
  if (element) element.textContent = message;
}

function normalizePaper(row) {
  return {
    id: row.id,
    paperKey: row.paper_key || row.paperKey || row.id,
    title: row.title || "Untitled paper",
    journal: row.journal || row.source || "Unknown journal",
    publisher: row.publisher || "Unknown publisher",
    year: row.year || "",
    url: row.url || "#",
    commentCount: Number(row.comment_count ?? row.commentCount ?? 0),
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

function normalizeAdminComment(row) {
  const paper = row.papers || {};
  const profile = row.profiles || {};
  return {
    id: row.id,
    paperId: row.paper_id,
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
    const [comments, profiles] = await Promise.all([
      supabaseGet("/rest/v1/comments?select=id,paper_id,content,like_count,status,created_at,papers(paper_key,title),profiles(display_name,status)&order=created_at.desc&limit=100"),
      supabaseGet("/rest/v1/profiles?select=id,status&limit=1000")
    ]);

    pageSource = comments.length || profiles.length ? "live" : "empty";
    return {
      generatedAt: new Date().toISOString(),
      papers: [],
      comments: comments.map(normalizeAdminComment),
      reports: [],
      users: profiles.map((profile) => ({
        id: profile.id,
        name: profile.id,
        role: "user",
        status: profile.status || "active",
        commentCount: 0
      }))
    };
  } catch (error) {
    pageSource = "sample";
    console.warn("Using sample data because Supabase could not be loaded:", error);
    return getFallbackData();
  }
}

function renderPaperItem(paper) {
  const rating = paper.ratingCount ? `${paper.ratingAverage.toFixed(1)}/10` : "No rating";
  return `
    <article class="paper-item">
      <div>
        <h3 class="paper-title"><a href="${escapeHtml(paper.url)}" target="_blank" rel="noreferrer">${escapeHtml(paper.title)}</a></h3>
        <div class="paper-meta">
          <span>${escapeHtml(paper.journal)}</span>
          <span>${escapeHtml(paper.publisher)}</span>
          ${paper.year ? `<span>${escapeHtml(paper.year)}</span>` : ""}
          <span>${escapeHtml(paper.paperKey)}</span>
        </div>
      </div>
      <div class="paper-stats" aria-label="Paper stats">
        <span class="stat-pill">${formatNumber(paper.commentCount)} comments</span>
        <span class="stat-pill">${escapeHtml(rating)}</span>
        <span class="stat-pill">${formatNumber(paper.likeCount)} likes</span>
      </div>
    </article>
  `;
}

function renderCommentItem(comment, data) {
  const paper = getPaper(data, comment.paperId);
  const paperTitle = paper?.title || comment.paperTitle || comment.paperKey || comment.paperId;
  const journal = paper?.journal || comment.journal || "Unknown journal";
  const ratingBadge = comment.ratingScore ? `<span class="badge">Rated ${escapeHtml(comment.ratingScore)}/10</span>` : "";

  return `
    <article class="comment-item">
      <div class="comment-meta">
        <span class="badge">${formatNumber(comment.likeCount)} likes</span>
        ${ratingBadge}
        <span>${escapeHtml(comment.author)}</span>
        <span>${escapeHtml(formatDate(comment.createdAt))}</span>
      </div>
      <p class="comment-body">${escapeHtml(comment.content)}</p>
      <div class="paper-meta">
        <span>${escapeHtml(journal)}</span>
        <span>${escapeHtml(paperTitle)}</span>
      </div>
    </article>
  `;
}

function renderTrendingPage() {
  const data = pageData;
  const totalComments = data.papers.reduce((sum, paper) => sum + paper.commentCount, 0);
  const totalRatings = data.papers.reduce((sum, paper) => sum + paper.ratingCount, 0);
  const totalLikes = data.papers.reduce((sum, paper) => sum + paper.likeCount, 0);
  const topPaper = [...data.papers].filter((paper) => paper.ratingCount > 0).sort(byRating)[0];
  const sourceNote = pageSource === "live" ? "Live Supabase data" : pageSource === "empty" ? "Waiting for first comments" : "Sample data";

  document.querySelector("[data-metrics]").innerHTML = [
    createMetric("Comments", formatNumber(totalComments), sourceNote),
    createMetric("Ratings", formatNumber(totalRatings), "Article-level scores"),
    createMetric("Likes", formatNumber(totalLikes), "Comment reactions"),
    createMetric("Top score", topPaper ? `${topPaper.ratingAverage.toFixed(1)}/10` : "--", topPaper?.journal || "No rated papers yet")
  ].join("");

  document.querySelector("[data-most-discussed]").innerHTML = data.papers.length
    ? [...data.papers].sort(byComments).map(renderPaperItem).join("")
    : createEmptyState("No public paper activity yet. Comments and ratings will appear here after users start using the extension.");

  document.querySelector("[data-top-rated]").innerHTML = data.papers.some((paper) => paper.ratingCount)
    ? [...data.papers].filter((paper) => paper.ratingCount).sort(byRating).slice(0, 6).map(renderPaperItem).join("")
    : createEmptyState("No rated papers yet.");

  document.querySelector("[data-hot-comments]").innerHTML = data.comments.length
    ? [...data.comments].sort(byLikes).slice(0, 8).map((comment) => renderCommentItem(comment, data)).join("")
    : createEmptyState("No public comments yet.");
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
        <div class="button-row">
          <button class="btn" data-admin-action="review">Review</button>
          <button class="btn warn" data-admin-action="hide">Hide</button>
          <button class="btn danger" data-admin-action="delete">Delete</button>
        </div>
      </td>
    </tr>
  `).join("");

  document.querySelector("[data-admin-comments]").innerHTML = rows || `
    <tr><td colspan="6">${escapeHtml(pageSource === "empty" ? "No visible comments yet." : "No comments match the current filters.")}</td></tr>
  `;
}

function renderAdminReports() {
  const data = pageData;
  const reports = data.reports || [];
  document.querySelector("[data-admin-reports]").innerHTML = reports.length ? reports.map((report) => {
    const comment = data.comments.find((item) => item.id === report.commentId);
    return `
      <tr>
        <td>${escapeHtml(report.reason)}</td>
        <td>${escapeHtml(comment ? comment.author : report.commentId)}</td>
        <td>${escapeHtml(report.details)}</td>
        <td><span class="badge">${escapeHtml(report.status)}</span></td>
        <td>
          <div class="button-row">
            <button class="btn primary" data-admin-action="resolve">Resolve</button>
            <button class="btn" data-admin-action="dismiss">Dismiss</button>
          </div>
        </td>
      </tr>
    `;
  }).join("") : `
    <tr><td colspan="5">Reports require an authenticated admin connection. Public pages only show visible comments.</td></tr>
  `;
}

function renderAdminPage() {
  const data = pageData;
  const openReports = data.reports.filter((report) => report.status !== "resolved").length;
  const hiddenComments = data.comments.filter((comment) => comment.status !== "visible").length;
  const totalComments = data.comments.length;
  const activeUsers = data.users.filter((user) => user.status === "active").length;
  const sourceNote = pageSource === "live" ? "Live visible comments" : pageSource === "empty" ? "No live comments yet" : "Sample data";

  document.querySelector("[data-admin-metrics]").innerHTML = [
    createMetric("Comments", totalComments, sourceNote),
    createMetric("Open reports", openReports, "Admin auth required"),
    createMetric("Hidden comments", hiddenComments, "Admin auth required"),
    createMetric("Active users", activeUsers, "Public profile count")
  ].join("");

  renderAdminComments();
  renderAdminReports();
  setStatus("[data-admin-output]", pageSource === "sample"
    ? "Sample mode. Supabase data could not be loaded."
    : "Read-only preview. Moderation actions will require admin sign-in.");

  document.querySelectorAll("[data-admin-search], [data-admin-status]").forEach((control) => {
    control.addEventListener("input", renderAdminComments);
    control.addEventListener("change", renderAdminComments);
  });

  document.addEventListener("click", (event) => {
    const action = event.target.closest("[data-admin-action]");
    if (!action) return;
    const output = document.querySelector("[data-admin-output]");
    output.textContent = `Action preview: ${action.dataset.adminAction}. Persistent moderation will be added behind admin sign-in.`;
  });
}

async function initializePage() {
  if (document.body.dataset.page === "trending") {
    pageData = await loadTrendingData();
    renderTrendingPage();
  }
  if (document.body.dataset.page === "admin") {
    pageData = await loadAdminData();
    renderAdminPage();
  }
}

document.addEventListener("DOMContentLoaded", initializePage);
