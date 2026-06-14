(function () {
  const namespace = (window.PaperComment = window.PaperComment || {});
  const STORAGE_PREFIX = "paper-comments:";
  const RATING_PREFIX = "paper-rating:";
  const USER_ID_KEY = "paper-comments:local-user-id";

  function getStorageKey(paperKey) {
    return `${STORAGE_PREFIX}${paperKey}`;
  }

  function getRatingStorageKey(paperKey, userId) {
    return `${RATING_PREFIX}${paperKey}:${userId}`;
  }

  function getRatingStoragePrefix(paperKey) {
    return `${RATING_PREFIX}${paperKey}:`;
  }

  function read(paperKey) {
    const storageKey = getStorageKey(paperKey);
    return new Promise((resolve) => {
      chrome.storage.local.get([storageKey], (result) => {
        resolve(Array.isArray(result[storageKey]) ? result[storageKey] : []);
      });
    });
  }

  function readKeys(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, resolve);
    });
  }

  function write(paperKey, comments) {
    const storageKey = getStorageKey(paperKey);
    return new Promise((resolve) => {
      chrome.storage.local.set({ [storageKey]: comments }, resolve);
    });
  }

  function writeKey(key, value) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, resolve);
    });
  }

  async function listComments(paperKey) {
    const comments = await read(paperKey);
    return comments
      .map((comment) => ({
        ...comment,
        likedBy: Array.isArray(comment.likedBy) ? comment.likedBy : [],
        likeCount: Number.isFinite(comment.likeCount) ? comment.likeCount : 0,
        replies: Array.isArray(comment.replies) ? comment.replies : [],
        replyCount: Array.isArray(comment.replies) ? comment.replies.length : 0
      }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  async function getLocalUserId() {
    const result = await readKeys([USER_ID_KEY]);
    if (result[USER_ID_KEY]) return result[USER_ID_KEY];

    const userId = crypto.randomUUID ? crypto.randomUUID() : `local-${Date.now()}`;
    await new Promise((resolve) => {
      chrome.storage.local.set({ [USER_ID_KEY]: userId }, resolve);
    });
    return userId;
  }

  async function getCurrentProfile() {
    return {
      id: await getLocalUserId(),
      display_name: "Local reader",
      role: "user",
      status: "active"
    };
  }

  function getLocalDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  async function hasCommentedToday(paperKey) {
    const userId = await getLocalUserId();
    const today = getLocalDateKey();
    const comments = await read(paperKey);
    return comments.some((comment) => {
      return comment.userId === userId && comment.localDate === today;
    });
  }

  async function addComment(paperKey, input) {
    if (await hasCommentedToday(paperKey)) {
      throw new Error("You can post one comment per paper each day.");
    }

    const comments = await read(paperKey);
    const userId = await getLocalUserId();
    const comment = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      paperKey,
      userId,
      content: input.content.trim(),
      likedBy: [],
      likeCount: 0,
      replies: [],
      replyCount: 0,
      localDate: getLocalDateKey(),
      createdAt: new Date().toISOString()
    };

    await write(paperKey, [comment, ...comments]);
    return comment;
  }

  async function addReply(paperKey, commentId, input) {
    const comments = await read(paperKey);
    const userId = await getLocalUserId();
    const index = comments.findIndex((comment) => comment.id === commentId);

    if (index === -1) {
      throw new Error("Comment not found.");
    }

    const reply = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      commentId,
      userId,
      author: "Local reader",
      content: input.content.trim(),
      createdAt: new Date().toISOString()
    };
    const replies = Array.isArray(comments[index].replies) ? comments[index].replies : [];
    comments[index] = {
      ...comments[index],
      replies: [...replies, reply],
      replyCount: replies.length + 1,
      updatedAt: new Date().toISOString()
    };

    await write(paperKey, comments);
    return reply;
  }

  async function toggleCommentLike(paperKey, commentId) {
    const comments = await read(paperKey);
    const userId = await getLocalUserId();
    const index = comments.findIndex((comment) => comment.id === commentId);

    if (index === -1) {
      throw new Error("Comment not found.");
    }

    const comment = comments[index];
    if (!comment.userId || comment.userId === userId) {
      throw new Error("You can only like comments from other users.");
    }

    const likedBy = Array.isArray(comment.likedBy) ? [...comment.likedBy] : [];
    const existingIndex = likedBy.indexOf(userId);
    const nextLikedBy = existingIndex >= 0
      ? likedBy.filter((id) => id !== userId)
      : [...likedBy, userId];

    comments[index] = {
      ...comment,
      likedBy: nextLikedBy,
      likeCount: nextLikedBy.length,
      updatedAt: new Date().toISOString()
    };

    await write(paperKey, comments);
    return comments[index];
  }

  async function reportComment() {
    return { localOnly: true };
  }

  async function reportReply() {
    return { localOnly: true };
  }

  async function getPaperRating(paperKey) {
    const userId = await getLocalUserId();
    const storageKey = getRatingStorageKey(paperKey, userId);
    const result = await readKeys([storageKey]);
    return result[storageKey] || null;
  }

  function getRatingScore(rating) {
    if (!rating?.scores) return null;
    if (Number.isFinite(Number(rating.scores.overall))) {
      return Number(rating.scores.overall);
    }

    const legacyValues = Object.values(rating.scores)
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));
    if (!legacyValues.length) return null;
    return legacyValues.reduce((total, value) => total + value, 0) / legacyValues.length;
  }

  async function getPaperRatingSummary(paperKey) {
    const prefix = getRatingStoragePrefix(paperKey);
    const allItems = await readKeys(null);
    const scores = Object.entries(allItems)
      .filter(([key]) => key.startsWith(prefix))
      .map(([, rating]) => getRatingScore(rating))
      .filter((score) => Number.isFinite(score));

    if (!scores.length) {
      return {
        count: 0,
        average: null
      };
    }

    return {
      count: scores.length,
      average: scores.reduce((total, score) => total + score, 0) / scores.length
    };
  }

  async function canUpdateRatingToday(paperKey) {
    const rating = await getPaperRating(paperKey);
    if (!rating) return true;
    return rating.lastUpdatedDate !== getLocalDateKey();
  }

  async function savePaperRating(paperKey, scores) {
    const userId = await getLocalUserId();
    const storageKey = getRatingStorageKey(paperKey, userId);
    const existing = await getPaperRating(paperKey);
    const today = getLocalDateKey();

    if (existing && existing.lastUpdatedDate === today) {
      throw new Error("You can update your rating for this paper once per day.");
    }

    const rating = {
      id: existing?.id || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
      paperKey,
      userId,
      scores,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastUpdatedDate: today
    };

    await writeKey(storageKey, rating);
    return rating;
  }

  namespace.localComments = {
    listComments,
    getCurrentProfile,
    addComment,
    addReply,
    toggleCommentLike,
    reportComment,
    reportReply,
    hasCommentedToday,
    getLocalUserId,
    getPaperRating,
    getPaperRatingSummary,
    canUpdateRatingToday,
    savePaperRating
  };
})();
