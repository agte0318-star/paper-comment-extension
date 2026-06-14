(function () {
  const SESSION_KEY = "paper-comments:supabase-session";
  const TOGGLE_POSITION_KEY = "paper-comments:toggle-position";
  const TRENDING_URL = "https://agte0318-star.github.io/paper-comment-extension/web/trending.html";
  const PROFILE_URL = "https://agte0318-star.github.io/paper-comment-extension/web/profile.html";
  const PRIVACY_URL = "https://agte0318-star.github.io/paper-comment-extension/privacy-policy.html";
  const PAPER_URL = "https://agte0318-star.github.io/paper-comment-extension/web/paper.html";

  const statusDot = document.querySelector("[data-status-dot]");
  const statusTitle = document.querySelector("[data-status-title]");
  const statusDetail = document.querySelector("[data-status-detail]");
  const accountMeta = document.querySelector("[data-account-meta]");
  const accountEmail = document.querySelector("[data-account-email]");
  const accountProvider = document.querySelector("[data-account-provider]");
  const version = document.querySelector("[data-version]");
  const message = document.querySelector("[data-message]");
  const signOut = document.querySelector("[data-sign-out]");
  const currentPaperButton = document.querySelector("[data-open-current-paper]");

  function getStorage(keys) {
    return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
  }

  function removeStorage(keys) {
    return new Promise((resolve) => chrome.storage.local.remove(keys, resolve));
  }

  function openUrl(url) {
    chrome.tabs.create({ url });
  }

  function getActiveTab() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        resolve(tabs?.[0] || null);
      });
    });
  }

  function askContentScriptForPaper(tabId) {
    return new Promise((resolve) => {
      if (!tabId) {
        resolve(null);
        return;
      }

      chrome.tabs.sendMessage(tabId, { type: "PCE_GET_DETECTED_PAPER" }, (response) => {
        if (chrome.runtime.lastError) {
          resolve(null);
          return;
        }
        resolve(response?.paper || null);
      });
    });
  }

  function normalizeDoi(rawDoi) {
    if (!rawDoi) return null;
    const cleaned = safeDecode(rawDoi)
      .replace(/^doi:\s*/i, "")
      .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
      .trim()
      .replace(/[.,;)\]}>"']+$/g, "");
    const match = cleaned.match(/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i);
    if (!match) return null;
    return match[0]
      .replace(/(?:\.full|\.pdf|\.epdf|\.abstract|\.html)$/i, "")
      .toLowerCase();
  }

  function normalizePii(rawPii) {
    if (!rawPii) return null;
    const match = safeDecode(rawPii).match(/\bS\d{15,18}\b/i);
    return match ? match[0].toLowerCase() : null;
  }

  function normalizeArxivId(rawId) {
    if (!rawId) return null;
    const cleaned = String(rawId)
      .replace(/^arxiv:\s*/i, "")
      .replace(/\.pdf$/i, "")
      .trim();
    const match = cleaned.match(/\d{4}\.\d{4,5}(?:v\d+)?|[a-z-]+(?:\.[A-Z]{2})?\/\d{7}(?:v\d+)?/i);
    return match ? match[0] : null;
  }

  function getSourceUrl(tabUrl) {
    try {
      const url = new URL(tabUrl);
      const source = url.searchParams.get("src") || url.searchParams.get("file");
      return source ? safeDecode(source) : tabUrl;
    } catch (error) {
      return tabUrl || "";
    }
  }

  function safeDecode(value) {
    let decoded = String(value || "");
    for (let index = 0; index < 2; index += 1) {
      try {
        const next = decodeURIComponent(decoded);
        if (next === decoded) break;
        decoded = next;
      } catch (error) {
        break;
      }
    }
    return decoded;
  }

  function isPdfLikeUrl(url) {
    const lowerUrl = safeDecode(url.href || String(url || "")).toLowerCase();
    const lowerPath = safeDecode(url.pathname || "").toLowerCase();
    return /\.pdf(?:$|[?#])/i.test(lowerUrl) ||
      lowerPath.endsWith(".pdf") ||
      /\/(?:doi\/)?(?:pdf|epdf|pdfdirect|pdfdownload|article-pdf)(?:\/|$)/i.test(lowerPath) ||
      /\/content\/pdf\//i.test(lowerPath) ||
      /\/pdfft(?:\/|$)/i.test(lowerPath) ||
      url.searchParams?.get("format")?.toLowerCase() === "pdf" ||
      url.searchParams?.get("download")?.toLowerCase() === "pdf";
  }

  function getStablePdfUrl(url) {
    return String(url || "")
      .split("#")[0]
      .replace(/[?&](download|forcedownload|utm_[^=]+)=[^&#]*/gi, "");
  }

  function inferPaperFromTab(tab) {
    const sourceUrl = getSourceUrl(tab?.url || "");
    if (!sourceUrl) return null;

    let url;
    try {
      url = new URL(sourceUrl);
    } catch (error) {
      return null;
    }

    const title = String(tab?.title || "").replace(/\s+-\s+Google Chrome$/i, "").trim();
    const arxivMatch = sourceUrl.match(/arxiv\.org\/(?:abs|pdf)\/([^?#/]+)(?:\.pdf)?/i);
    const arxivId = normalizeArxivId(arxivMatch ? arxivMatch[1] : null);
    if (arxivId) {
      return {
        key: `arxiv:${arxivId}`,
        source: "arxiv",
        title: title || `arXiv:${arxivId}`,
        url: sourceUrl
      };
    }

    const doi = normalizeDoi(sourceUrl);
    if (doi) {
      return {
        key: `doi:${doi}`,
        source: url.hostname.replace(/^www\./, "") || "doi",
        title: title || `DOI:${doi}`,
        url: sourceUrl
      };
    }

    const pii = normalizePii(url.pathname);
    if (pii) {
      return {
        key: `pii:${pii}`,
        source: "elsevier",
        title: title || `PII:${pii.toUpperCase()}`,
        url: sourceUrl
      };
    }

    const looksLikePdf = isPdfLikeUrl(url);
    if (looksLikePdf) {
      const stableUrl = getStablePdfUrl(sourceUrl);
      return {
        key: `pdf:${stableUrl.toLowerCase()}`,
        source: url.hostname.replace(/^www\./, "") || "pdf",
        title: title || "PDF paper",
        url: sourceUrl
      };
    }

    return null;
  }

  function getPaperDiscussionUrl(paper) {
    const params = new URLSearchParams();
    params.set("id", paper.key);
    if (paper.title) params.set("title", paper.title);
    if (paper.url) params.set("url", paper.url);
    if (paper.source) params.set("source", paper.source);
    return `${PAPER_URL}?${params.toString()}`;
  }

  function setMessage(text) {
    message.textContent = text;
    if (!text) return;
    window.setTimeout(() => {
      if (message.textContent === text) message.textContent = "";
    }, 2200);
  }

  function getUserDisplayName(user) {
    const metadata = user?.user_metadata || {};
    return metadata.display_name
      || metadata.full_name
      || metadata.name
      || (user?.email ? user.email.split("@")[0] : "");
  }

  function getProviderLabel(user) {
    const provider = user?.app_metadata?.provider || user?.identities?.[0]?.provider || "";
    if (provider === "google") return "Google";
    if (provider === "email") return "Email";
    return provider ? provider.charAt(0).toUpperCase() + provider.slice(1) : "Email";
  }

  async function renderStatus() {
    const manifest = chrome.runtime.getManifest();
    version.textContent = `Version ${manifest.version}`;

    const result = await getStorage([SESSION_KEY]);
    const session = result[SESSION_KEY];
    const user = session?.user;
    const email = user?.email;
    const displayName = getUserDisplayName(user);

    statusDot.classList.toggle("is-signed-in", Boolean(email));
    statusDot.classList.toggle("is-signed-out", !email);
    statusTitle.textContent = email ? displayName || "Signed in" : "Not signed in";
    statusDetail.textContent = email
      ? "Your comments, replies, ratings, and profile are synced."
      : "Sign in from the paper sidebar when you rate or comment.";
    accountMeta.hidden = !email;
    accountEmail.textContent = email || "";
    accountProvider.textContent = email ? getProviderLabel(user) : "";
    signOut.hidden = !email;
  }

  document.querySelector("[data-open-profile]").addEventListener("click", () => {
    openUrl(PROFILE_URL);
  });

  currentPaperButton.addEventListener("click", async () => {
    currentPaperButton.disabled = true;
    setMessage("Detecting current paper...");

    try {
      const tab = await getActiveTab();
      const detectedPaper = await askContentScriptForPaper(tab?.id);
      const paper = detectedPaper?.key ? detectedPaper : inferPaperFromTab(tab);

      if (!paper?.key) {
        setMessage("Could not identify this paper yet.");
        return;
      }

      openUrl(getPaperDiscussionUrl(paper));
    } finally {
      currentPaperButton.disabled = false;
    }
  });

  document.querySelector("[data-open-trending]").addEventListener("click", () => {
    openUrl(TRENDING_URL);
  });

  document.querySelector("[data-open-privacy]").addEventListener("click", () => {
    openUrl(PRIVACY_URL);
  });

  document.querySelector("[data-reset-position]").addEventListener("click", async () => {
    await removeStorage([TOGGLE_POSITION_KEY]);
    setMessage("Position reset. Refresh the paper page.");
  });

  signOut.addEventListener("click", async () => {
    await removeStorage([SESSION_KEY]);
    setMessage("Signed out on this browser.");
    await renderStatus();
  });

  renderStatus();
})();
