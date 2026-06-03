function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function getPaper(data, paperId) {
  return data.papers.find((paper) => paper.id === paperId);
}

function byNewest(a, b) {
  return new Date(b.lastActiveAt || b.createdAt) - new Date(a.lastActiveAt || a.createdAt);
}

function byComments(a, b) {
  return b.commentCount - a.commentCount || byNewest(a, b);
}

function byRating(a, b) {
  return b.ratingAverage - a.ratingAverage || b.ratingCount - a.ratingCount;
}

function byLikes(a, b) {
  return b.likeCount - a.likeCount || new Date(b.createdAt) - new Date(a.createdAt);
}

function createMetric(label, value, note) {
  return `
    <div class="metric">
      <div class="metric-label">${label}</div>
      <div class="metric-value">${value}</div>
      <div class="metric-note">${note}</div>
    </div>
  `;
}

function renderPaperItem(paper) {
  return `
    <article class="paper-item">
      <div>
        <h3 class="paper-title"><a href="${paper.url}" target="_blank" rel="noreferrer">${paper.title}</a></h3>
        <div class="paper-meta">
          <span>${paper.journal}</span>
          <span>${paper.publisher}</span>
          <span>${paper.year}</span>
          <span>${paper.paperKey}</span>
        </div>
      </div>
      <div class="paper-stats" aria-label="Paper stats">
        <span class="stat-pill">${paper.commentCount} comments</span>
        <span class="stat-pill">${paper.ratingAverage.toFixed(1)}/10</span>
        <span class="stat-pill">${paper.likeCount} likes</span>
      </div>
    </article>
  `;
}

function renderCommentItem(comment, data) {
  const paper = getPaper(data, comment.paperId);
  return `
    <article class="comment-item">
      <div class="comment-meta">
        <span class="badge">${comment.likeCount} likes</span>
        <span class="badge">Rated ${comment.ratingScore}/10</span>
        <span>${comment.author}</span>
        <span>${formatDate(comment.createdAt)}</span>
      </div>
      <p class="comment-body">${comment.content}</p>
      <div class="paper-meta">
        <span>${paper ? paper.journal : "Unknown journal"}</span>
        <span>${paper ? paper.title : comment.paperId}</span>
      </div>
    </article>
  `;
}

function renderTrendingPage() {
  const data = window.PCE_DATA;
  const totalComments = data.papers.reduce((sum, paper) => sum + paper.commentCount, 0);
  const totalRatings = data.papers.reduce((sum, paper) => sum + paper.ratingCount, 0);
  const totalLikes = data.papers.reduce((sum, paper) => sum + paper.likeCount, 0);
  const topPaper = [...data.papers].sort(byRating)[0];

  document.querySelector("[data-metrics]").innerHTML = [
    createMetric("Comments", formatNumber(totalComments), "Mock community activity"),
    createMetric("Ratings", formatNumber(totalRatings), "Article-level scores"),
    createMetric("Likes", formatNumber(totalLikes), "Comment reactions"),
    createMetric("Top score", `${topPaper.ratingAverage.toFixed(1)}/10`, topPaper.journal)
  ].join("");

  document.querySelector("[data-most-discussed]").innerHTML = [...data.papers]
    .sort(byComments)
    .map(renderPaperItem)
    .join("");

  document.querySelector("[data-top-rated]").innerHTML = [...data.papers]
    .sort(byRating)
    .slice(0, 4)
    .map(renderPaperItem)
    .join("");

  document.querySelector("[data-hot-comments]").innerHTML = [...data.comments]
    .sort(byLikes)
    .slice(0, 5)
    .map((comment) => renderCommentItem(comment, data))
    .join("");
}

function getFilteredAdminComments(data) {
  const query = document.querySelector("[data-admin-search]")?.value.toLowerCase().trim() || "";
  const status = document.querySelector("[data-admin-status]")?.value || "all";
  return data.comments.filter((comment) => {
    const paper = getPaper(data, comment.paperId);
    const haystack = `${comment.author} ${comment.content} ${paper?.title || ""} ${paper?.paperKey || ""}`.toLowerCase();
    return (!query || haystack.includes(query)) && (status === "all" || comment.status === status);
  });
}

function renderAdminComments() {
  const data = window.PCE_DATA;
  const rows = getFilteredAdminComments(data).map((comment) => {
    const paper = getPaper(data, comment.paperId);
    return `
      <tr>
        <td>
          <strong>${comment.author}</strong>
          <div class="status">${formatDate(comment.createdAt)}</div>
        </td>
        <td>
          ${comment.content}
          <div class="status">${paper ? paper.paperKey : comment.paperId}</div>
        </td>
        <td>${comment.likeCount}</td>
        <td>${comment.reportCount}</td>
        <td><span class="badge">${comment.status}</span></td>
        <td>
          <div class="button-row">
            <button class="btn" data-mock-action="review">Review</button>
            <button class="btn warn" data-mock-action="hide">Hide</button>
            <button class="btn danger" data-mock-action="delete">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  document.querySelector("[data-admin-comments]").innerHTML = rows;
}

function renderAdminReports() {
  const data = window.PCE_DATA;
  document.querySelector("[data-admin-reports]").innerHTML = data.reports.map((report) => {
    const comment = data.comments.find((item) => item.id === report.commentId);
    return `
      <tr>
        <td>${report.reason}</td>
        <td>${comment ? comment.author : report.commentId}</td>
        <td>${report.details}</td>
        <td><span class="badge">${report.status}</span></td>
        <td>
          <div class="button-row">
            <button class="btn primary" data-mock-action="resolve">Resolve</button>
            <button class="btn" data-mock-action="dismiss">Dismiss</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function renderAdminPage() {
  const data = window.PCE_DATA;
  const openReports = data.reports.filter((report) => report.status !== "resolved").length;
  const hiddenComments = data.comments.filter((comment) => comment.status !== "visible").length;
  const totalComments = data.comments.length;
  const activeUsers = data.users.filter((user) => user.status === "active").length;

  document.querySelector("[data-admin-metrics]").innerHTML = [
    createMetric("Comments", totalComments, "Visible and moderated"),
    createMetric("Open reports", openReports, "Need review"),
    createMetric("Hidden comments", hiddenComments, "Currently suppressed"),
    createMetric("Active users", activeUsers, "Mock profiles")
  ].join("");

  renderAdminComments();
  renderAdminReports();

  document.querySelectorAll("[data-admin-search], [data-admin-status]").forEach((control) => {
    control.addEventListener("input", renderAdminComments);
    control.addEventListener("change", renderAdminComments);
  });

  document.addEventListener("click", (event) => {
    const action = event.target.closest("[data-mock-action]");
    if (!action) return;
    const output = document.querySelector("[data-admin-output]");
    output.textContent = `Mock action queued: ${action.dataset.mockAction}. Supabase integration will make this persistent.`;
  });
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.body.dataset.page === "trending") renderTrendingPage();
  if (document.body.dataset.page === "admin") renderAdminPage();
});
