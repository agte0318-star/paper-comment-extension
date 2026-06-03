(function () {
  const namespace = (window.PaperComment = window.PaperComment || {});

  // Starter list only. Large platforms usually keep exact moderation lists private,
  // so this local list focuses on common abuse, spam, and academic fraud patterns.
  const BLOCKED_TERMS = [
    "fuck",
    "shit",
    "bitch",
    "asshole",
    "bastard",
    "cunt",
    "nigger",
    "chink",
    "retard",
    "kill yourself",
    "go die",
    "paper writing service",
    "essay writing service",
    "guaranteed publication",
    "citation boosting",
    "fake data",
    "buy citations",
    "contact me on whatsapp",
    "contact me on telegram",
    "free money",
    "claim your prize"
  ];

  const BLOCKED_PATTERNS = [
    /(paper|essay|article)\s+(writing|publication)\s+service/i,
    /(guaranteed|fast)\s+(acceptance|publication)/i,
    /(buy|boost|increase)\s+(citations|references)/i,
    /(contact|message)\s+me\s+on\s+(whatsapp|telegram)/i,
    /(click|tap)\s+(here|now)/i,
    /(?:https?:\/\/|www\.)\S+\.(?:top|xyz|click|work)\b/i
  ];

  function normalize(text) {
    return String(text || "")
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[4@]/g, "a")
      .replace(/[1!|]/g, "i")
      .replace(/[0]/g, "o")
      .replace(/[3]/g, "e")
      .replace(/\s+/g, " ")
      .trim();
  }

  function checkContent(text) {
    const normalized = normalize(text);
    const compact = normalized.replace(/[\s._\-*]+/g, "");

    for (const term of BLOCKED_TERMS) {
      const normalizedTerm = normalize(term);
      const compactTerm = normalizedTerm.replace(/[\s._\-*]+/g, "");
      if (normalized.includes(normalizedTerm) || compact.includes(compactTerm)) {
        return {
          ok: false,
          reason: "Your comment contains blocked language or spam-like content."
        };
      }
    }

    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(normalized)) {
        return {
          ok: false,
          reason: "Your comment looks like spam or promotional content."
        };
      }
    }

    return { ok: true };
  }

  namespace.moderation = {
    checkContent
  };
})();
