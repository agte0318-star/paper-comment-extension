(function () {
  const namespace = window.PaperComment || {};

  const paper = namespace.detectPaper ? namespace.detectPaper() : null;
  if (!paper || document.querySelector("#paper-comment-extension-root")) return;

  const host = document.createElement("div");
  host.id = "paper-comment-extension-root";
  document.documentElement.appendChild(host);

  const root = host;
  const state = {
    open: false,
    ratingOpen: false,
    sortMode: "newest",
    comments: [],
    currentUser: null,
    localUserId: null,
    paperRating: null,
    paperRatingSummary: { count: 0, average: null },
    canUpdateRating: true,
    hasCommentedToday: false,
    formMessage: "",
    ratingMessage: "",
    authModalOpen: false,
    authEmail: "",
    authPassword: "",
    authMessage: "",
    shareMessage: "",
    shareMessageCommentId: null
  };

  function getDataStore() {
    return namespace.cloudStore?.isConfigured() ? namespace.cloudStore : namespace.localComments;
  }

  function isCloudMode() {
    return Boolean(namespace.cloudStore?.isConfigured());
  }

  function canWriteCloudData() {
    return !isCloudMode() || Boolean(state.currentUser);
  }

  function createElement(tag, options = {}) {
    const element = document.createElement(tag);
    if (options.className) element.className = options.className;
    if (options.text) element.textContent = options.text;
    if (options.attrs) {
      for (const [key, value] of Object.entries(options.attrs)) {
        element.setAttribute(key, value);
      }
    }
    return element;
  }

  function formatTime(isoDate) {
    const date = new Date(isoDate);
    const diffMs = Date.now() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    if (diffMinutes < 1) return "just now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  function getRatingAverage(rating = state.paperRating) {
    if (!rating?.scores) return null;
    if (Number.isFinite(Number(rating.scores.overall))) {
      return Number(rating.scores.overall).toFixed(1);
    }
    const values = Object.values(rating.scores)
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));
    if (!values.length) return null;
    return (values.reduce((total, value) => total + value, 0) / values.length).toFixed(1);
  }

  function getCommunityRatingText() {
    const summary = state.paperRatingSummary;
    if (!summary || !summary.count || !Number.isFinite(Number(summary.average))) {
      return "No ratings";
    }

    const label = summary.count === 1 ? "rating" : "ratings";
    return `${summary.count} ${label}`;
  }

  function getCommunityRatingScore() {
    const summary = state.paperRatingSummary;
    if (!summary || !summary.count || !Number.isFinite(Number(summary.average))) {
      return "--";
    }
    return Number(summary.average).toFixed(1);
  }

  function getUserLabel() {
    const email = state.currentUser?.email || "User";
    return email.split("@")[0] || "User";
  }

  function getCommentRatingAverage(comment) {
    if (Number.isFinite(Number(comment.ratingScore))) {
      return Number(comment.ratingScore).toFixed(1);
    }
    const isLocalUserComment = comment.userId === state.localUserId || !comment.userId;
    if (!isLocalUserComment) return null;
    return getRatingAverage(state.paperRating);
  }

  function getSortedComments() {
    return [...state.comments].sort((a, b) => {
      if (state.sortMode === "popular") {
        const likeDiff = (b.likeCount || 0) - (a.likeCount || 0);
        if (likeDiff !== 0) return likeDiff;
      }
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }

  function isOwnComment(comment) {
    return !comment.userId || comment.userId === state.localUserId;
  }

  function hasLikedComment(comment) {
    return Array.isArray(comment.likedBy) && comment.likedBy.includes(state.localUserId);
  }

  function render() {
    root.innerHTML = "";
    root.appendChild(createElement("style", {
      text: `
        #paper-comment-extension-root {
          color-scheme: light;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
      `
    }));

    if (!state.open) {
      const toggle = createElement("button", {
        className: "pce-toggle",
        text: `Comments ${state.comments.length}`
      });
      toggle.addEventListener("click", () => {
        state.open = true;
        render();
      });
      root.appendChild(toggle);
      return;
    }

    const panel = createElement("aside", { className: "pce-panel" });
    panel.appendChild(renderHeader());
    panel.appendChild(renderPaperRating());
    panel.appendChild(renderListToolbar());
    panel.appendChild(renderCommentList());
    panel.appendChild(renderCommentForm());
    root.appendChild(panel);
    if (state.authModalOpen) root.appendChild(renderAuthModal());
  }

  function renderAuthChip() {
    if (!isCloudMode()) return null;

    const chip = createElement("button", {
      className: state.currentUser ? "pce-auth-chip is-user" : "pce-auth-chip",
      text: state.currentUser ? getUserLabel() : "Sign in",
      attrs: {
        type: "button",
        title: state.currentUser?.email || "Sign in"
      }
    });
    chip.addEventListener("click", () => {
      state.authModalOpen = true;
      render();
    });
    return chip;
  }

  function renderAuthModal() {
    const overlay = createElement("div", { className: "pce-auth-overlay" });
    const dialog = createElement("section", {
      className: "pce-auth-dialog",
      attrs: { role: "dialog", "aria-modal": "true", "aria-label": "Sign in" }
    });
    const header = createElement("div", { className: "pce-auth-dialog-header" });
    const title = createElement("div", { className: "pce-auth-dialog-title" });
    title.append(
      createElement("span", { className: "pce-auth-title", text: state.currentUser ? "Account" : "Sign in" }),
      createElement("span", {
        className: "pce-auth-subtitle",
        text: state.currentUser?.email || "Use cloud comments across papers."
      })
    );
    const close = createElement("button", {
      className: "pce-auth-icon-button",
      text: "X",
      attrs: { type: "button", "aria-label": "Close sign in dialog" }
    });
    close.addEventListener("click", () => {
      state.authModalOpen = false;
      state.authMessage = "";
      render();
    });
    header.append(title, close);

    if (state.currentUser) {
      const actions = createElement("div", { className: "pce-auth-actions" });
      const signOut = createElement("button", {
        className: "pce-auth-button",
        text: "Sign out",
        attrs: { type: "button" }
      });
      signOut.addEventListener("click", async () => {
        await getDataStore().signOut();
        state.authMessage = "";
        state.authModalOpen = false;
        await loadData();
      });
      actions.append(signOut);
      dialog.append(header, actions);
      overlay.appendChild(dialog);
      overlay.addEventListener("click", (event) => {
        if (event.target !== overlay) return;
        state.authModalOpen = false;
        state.authMessage = "";
        render();
      });
      return overlay;
    }

    const form = createElement("form", { className: "pce-auth-form" });
    const email = createElement("input", {
      className: "pce-auth-input",
      attrs: {
        type: "email",
        placeholder: "Email",
        autocomplete: "email",
        value: state.authEmail
      }
    });
    const password = createElement("input", {
      className: "pce-auth-input",
      attrs: {
        type: "password",
        placeholder: "Password",
        autocomplete: "current-password",
        value: state.authPassword
      }
    });

    email.addEventListener("input", () => { state.authEmail = email.value; });
    password.addEventListener("input", () => { state.authPassword = password.value; });

    const actions = createElement("div", { className: "pce-auth-actions" });
    const signIn = createElement("button", {
      className: "pce-auth-button is-primary",
      text: "Sign in",
      attrs: { type: "submit" }
    });
    const signUp = createElement("button", {
      className: "pce-auth-button",
      text: "Create account",
      attrs: { type: "button" }
    });
    actions.append(signIn, signUp);

    const message = createElement("div", {
      className: state.authMessage ? "pce-auth-message is-visible" : "pce-auth-message",
      text: state.authMessage
    });

    async function runAuth(mode) {
      const emailValue = email.value.trim();
      const passwordValue = password.value;
      if (!emailValue || !passwordValue) {
        state.authMessage = "Enter your email and password.";
        render();
        return;
      }
      try {
        if (mode === "signup") {
          await getDataStore().signUp(emailValue, passwordValue);
          state.authMessage = "Account created. If email confirmation is enabled, confirm your email before signing in.";
        } else {
          await getDataStore().signIn(emailValue, passwordValue);
          state.authEmail = "";
          state.authPassword = "";
          state.authMessage = "";
          state.authModalOpen = false;
        }
        await loadData();
      } catch (error) {
        state.authMessage = error.message;
        render();
      }
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      runAuth("signin");
    });
    signUp.addEventListener("click", () => runAuth("signup"));

    form.append(email, password, actions, message);
    dialog.append(header, form);
    overlay.appendChild(dialog);
    overlay.addEventListener("click", (event) => {
      if (event.target !== overlay) return;
      state.authModalOpen = false;
      state.authMessage = "";
      render();
    });
    return overlay;
  }

  function renderListToolbar() {
    const toolbar = createElement("div", { className: "pce-list-toolbar" });
    const label = createElement("span", {
      className: "pce-list-toolbar-label",
      text: "Comments"
    });
    const controls = createElement("div", { className: "pce-sort-control" });

    for (const [mode, text] of [["newest", "Newest"], ["popular", "Popular"]]) {
      const button = createElement("button", {
        className: state.sortMode === mode ? "pce-sort-button is-active" : "pce-sort-button",
        text,
        attrs: { type: "button" }
      });
      button.addEventListener("click", () => {
        state.sortMode = mode;
        render();
      });
      controls.appendChild(button);
    }

    toolbar.append(label, controls);
    return toolbar;
  }

  function renderHeader() {
    const header = createElement("header", { className: "pce-header" });
    const close = createElement("button", {
      className: "pce-close",
      text: "Close",
      attrs: { type: "button", "aria-label": "Close comments" }
    });
    close.addEventListener("click", () => {
      state.open = false;
      render();
    });

    const label = createElement("div", { className: "pce-kicker", text: "Paper Comments" });
    const title = createElement("h2", { className: "pce-title", text: paper.title || paper.key });
    const meta = createElement("div", { className: "pce-meta", text: paper.key });
    const authChip = renderAuthChip();
    header.append(close, label, title, meta);
    if (authChip) header.appendChild(authChip);
    return header;
  }

  function renderPaperRating() {
    const section = createElement("section", { className: "pce-paper-rating" });
    const summary = createElement("button", {
      className: "pce-rating-toggle",
      attrs: { type: "button" }
    });
    const left = createElement("div", { className: "pce-rating-toggle-left" });
    const scoreLine = createElement("div", { className: "pce-rating-score-line" });
    scoreLine.append(
      createElement("span", { className: "pce-rating-score", text: getCommunityRatingScore() }),
      createElement("span", { className: "pce-rating-scale", text: "/10" })
    );
    left.append(
      scoreLine,
      createElement("span", { className: "pce-rating-count", text: getCommunityRatingText() })
    );
    const right = createElement("span", {
      className: "pce-rating-chevron",
      text: state.ratingOpen ? "Done" : (state.paperRating ? "Edit" : "Rate")
    });
    summary.append(left, right);
    summary.addEventListener("click", () => {
      state.ratingOpen = !state.ratingOpen;
      render();
    });
    section.appendChild(summary);

    if (state.ratingOpen) {
      section.appendChild(renderRatingForm());
    }

    return section;
  }

  function renderRatingForm() {
    const form = createElement("form", { className: "pce-rating-form" });
    const disabled = !state.canUpdateRating || !canWriteCloudData();
    const currentValue = getRatingAverage() || 5;
    const row = createElement("label", { className: "pce-rating-row pce-rating-row-single" });
    const label = createElement("span", { className: "pce-rating-label", text: "Overall score" });
    const input = createElement("input", {
      className: "pce-rating-input",
      attrs: {
        type: "range",
        name: "overall",
        min: "1",
        max: "10",
        step: "1",
        value: String(Math.round(Number(currentValue))),
        ...(disabled ? { disabled: "disabled" } : {})
      }
    });
    const output = createElement("output", {
      className: "pce-rating-value",
      text: String(Math.round(Number(currentValue)))
    });
    input.addEventListener("input", () => {
      output.textContent = input.value;
    });
    row.append(label, input, output);
    form.appendChild(row);

    const message = createElement("div", {
      className: state.ratingMessage ? "pce-form-message is-visible" : "pce-form-message",
      text: state.ratingMessage || (!canWriteCloudData() ? "Sign in to rate this paper." : (disabled ? "You can update this rating once per day." : ""))
    });
    if (disabled && !state.ratingMessage) message.classList.add("is-visible");

    const footer = createElement("div", { className: "pce-rating-footer" });
    footer.appendChild(createElement("span", {
      text: state.paperRating ? `Your score: ${getRatingAverage()}/10` : "Rate this paper as a whole."
    }));
    const submit = createElement("button", {
      className: "pce-submit",
      text: state.paperRating ? "Update rating" : "Save rating",
      attrs: { type: "submit" }
    });
    submit.disabled = disabled;
    footer.appendChild(submit);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (disabled) return;

      const value = Number(form.elements.overall.value);
      const scores = {
        overall: Math.min(10, Math.max(1, value))
      };

      try {
        await getDataStore().savePaperRating(paper.key, scores, paper);
        state.ratingMessage = "";
        await loadData();
      } catch (error) {
        state.ratingMessage = error.message;
        render();
      }
    });

    form.append(message, footer);
    return form;
  }

  function renderCommentList() {
    const list = createElement("section", { className: "pce-list" });

    if (state.comments.length === 0) {
      list.appendChild(createElement("div", {
        className: "pce-empty",
        text: "No comments yet. Start the discussion."
      }));
      return list;
    }

    for (const comment of getSortedComments()) {
      const item = createElement("article", { className: "pce-comment" });
      const row = createElement("div", { className: "pce-comment-meta" });
      const ratingAverage = getCommentRatingAverage(comment);
      const left = createElement("div", { className: "pce-comment-tags" });
      if (ratingAverage) {
        left.appendChild(createElement("span", {
          className: "pce-score-badge",
          text: `Rated ${ratingAverage}/10`
        }));
      }
      row.append(
        left,
        createElement("span", { text: formatTime(comment.createdAt) })
      );
      const body = createElement("p", { className: "pce-comment-body", text: comment.content });
      item.append(row, body, renderCommentActions(comment));
      list.appendChild(item);
    }

    return list;
  }

  function renderCommentActions(comment) {
    const actions = createElement("div", { className: "pce-comment-actions" });
    const liked = hasLikedComment(comment);
    const likeButton = createElement("button", {
      className: liked ? "pce-action-button is-liked" : "pce-action-button",
      text: liked ? `Liked ${comment.likeCount || 0}` : `Like ${comment.likeCount || 0}`,
      attrs: { type: "button" }
    });

    if (isCloudMode() && !state.currentUser) {
      likeButton.disabled = true;
      likeButton.title = "Sign in to like comments.";
    } else if (isOwnComment(comment)) {
      likeButton.disabled = true;
      likeButton.title = "You can only like comments from other users.";
    }

    likeButton.addEventListener("click", async () => {
      try {
        await getDataStore().toggleCommentLike(paper.key, comment.id);
        await loadData();
      } catch (error) {
        state.formMessage = error.message;
        render();
      }
    });

    const shareButton = createElement("button", {
      className: "pce-action-button",
      text: "Share",
      attrs: { type: "button" }
    });
    shareButton.addEventListener("click", async () => {
      try {
        await shareCommentImage(comment);
        state.shareMessage = "Share image generated.";
        state.shareMessageCommentId = comment.id;
      } catch (error) {
        state.shareMessage = "Could not generate share image.";
        state.shareMessageCommentId = comment.id;
      }
      render();
    });

    actions.append(likeButton, shareButton);
    if (state.shareMessage && state.shareMessageCommentId === comment.id) {
      actions.appendChild(createElement("span", {
        className: "pce-share-message",
        text: state.shareMessage
      }));
    }
    return actions;
  }

  function wrapCanvasText(context, text, maxWidth, maxLines) {
    const words = String(text || "").replace(/\s+/g, " ").trim().split(" ");
    const lines = [];
    let currentLine = "";

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (context.measureText(testLine).width <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
      if (lines.length === maxLines) break;
    }

    if (currentLine && lines.length < maxLines) lines.push(currentLine);
    if (words.join(" ").length > lines.join(" ").length && lines.length) {
      lines[lines.length - 1] = `${lines[lines.length - 1].replace(/\s+\S*$/, "")}...`;
    }

    return lines;
  }

  function getCanvasBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas export failed."));
      }, "image/png");
    });
  }

  async function shareCommentImage(comment) {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 630;
    const context = canvas.getContext("2d");
    const ratingAverage = getCommentRatingAverage(comment);

    context.fillStyle = "#fbfbf8";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#0f766e";
    context.fillRect(0, 0, canvas.width, 14);

    context.fillStyle = "#0f5f59";
    context.font = "700 30px Arial, sans-serif";
    context.fillText("Paper Comment", 72, 78);

    context.fillStyle = "#171717";
    context.font = "700 42px Arial, sans-serif";
    const titleLines = wrapCanvasText(context, paper.title || paper.key, 980, 2);
    titleLines.forEach((line, index) => context.fillText(line, 72, 150 + index * 52));

    context.fillStyle = "#586266";
    context.font = "24px Arial, sans-serif";
    context.fillText(paper.key, 72, 262);

    if (ratingAverage) {
      context.fillStyle = "#e8f1ee";
      context.fillRect(72, 298, 174, 44);
      context.fillStyle = "#0f5f59";
      context.font = "700 24px Arial, sans-serif";
      context.fillText(`Rated ${ratingAverage}/10`, 92, 328);
    }

    context.fillStyle = "#202427";
    context.font = "31px Arial, sans-serif";
    const commentLines = wrapCanvasText(context, comment.content, 1020, 5);
    commentLines.forEach((line, index) => context.fillText(line, 72, 398 + index * 42));

    context.fillStyle = "#697174";
    context.font = "22px Arial, sans-serif";
    context.fillText(`Generated by Paper Comment Extension - ${new Date().toLocaleDateString()}`, 72, 582);

    const blob = await getCanvasBlob(canvas);
    const fileName = `paper-comment-${comment.id}.png`;
    const file = new File([blob], fileName, { type: "image/png" });

    if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
      await navigator.share({
        files: [file],
        title: "Paper Comment",
        text: `Comment on ${paper.title || paper.key}`
      });
      return;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function renderCommentForm() {
    const form = createElement("form", { className: "pce-form" });
    const textarea = createElement("textarea", {
      className: "pce-input",
      attrs: {
        placeholder: "Share your overall comment on this paper..."
      }
    });

    const message = createElement("div", {
      className: state.formMessage ? "pce-form-message is-visible" : "pce-form-message",
      text: state.formMessage
    });

    const footer = createElement("div", { className: "pce-form-footer" });
    footer.appendChild(createElement("span", {
      text: !canWriteCloudData()
        ? "Sign in to post"
        : (state.hasCommentedToday ? "One comment per paper per day." : "Overall paper comment")
    }));
    const submit = createElement("button", {
      className: "pce-submit",
      text: "Post comment",
      attrs: { type: "submit" }
    });
    submit.disabled = state.hasCommentedToday || !canWriteCloudData();
    footer.appendChild(submit);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (state.hasCommentedToday || !canWriteCloudData()) return;

      const content = textarea.value.trim();
      if (!content) {
        state.formMessage = "Please write a comment before posting.";
        render();
        return;
      }

      const moderation = namespace.moderation.checkContent(content);
      if (!moderation.ok) {
        state.formMessage = moderation.reason;
        render();
        return;
      }

      try {
        await getDataStore().addComment(paper.key, { content }, paper);
        textarea.value = "";
        state.formMessage = "";
        await loadData();
      } catch (error) {
        state.formMessage = error.message;
        render();
      }
    });

    if (state.hasCommentedToday || !canWriteCloudData()) {
      textarea.disabled = true;
    }

    form.append(textarea, message, footer);
    return form;
  }

  async function loadData() {
    const store = getDataStore();
    state.currentUser = store.getCurrentUser ? await store.getCurrentUser() : null;
    state.localUserId = await store.getLocalUserId();
    state.comments = await store.listComments(paper.key, paper);
    state.hasCommentedToday = await store.hasCommentedToday(paper.key, paper);
    state.paperRating = await store.getPaperRating(paper.key, paper);
    state.paperRatingSummary = await store.getPaperRatingSummary(paper.key, paper);
    state.canUpdateRating = await store.canUpdateRatingToday(paper.key, paper);
    render();
  }

  loadData();
})();
