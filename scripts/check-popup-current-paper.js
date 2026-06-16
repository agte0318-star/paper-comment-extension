const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const popupSource = fs.readFileSync(path.join(root, "src", "popup", "popup.js"), "utf8");

function createElement() {
  return {
    textContent: "",
    hidden: false,
    disabled: false,
    listeners: {},
    classList: {
      toggle() {}
    },
    addEventListener(type, listener) {
      this.listeners[type] = listener;
    }
  };
}

function createPopupHarness(tab) {
  const elements = new Map();
  const selectorList = [
    "[data-status-dot]",
    "[data-status-title]",
    "[data-status-detail]",
    "[data-account-meta]",
    "[data-account-email]",
    "[data-account-provider]",
    "[data-version]",
    "[data-message]",
    "[data-sign-out]",
    "[data-open-current-paper]",
    "[data-open-profile]",
    "[data-open-trending]",
    "[data-open-privacy]",
    "[data-reset-position]"
  ];

  for (const selector of selectorList) {
    elements.set(selector, createElement());
  }

  const createdUrls = [];
  const chrome = {
    runtime: {
      lastError: null,
      getManifest: () => ({ version: "0.5.6" })
    },
    storage: {
      local: {
        get(keys, callback) {
          callback({});
        },
        remove(keys, callback) {
          callback?.();
        }
      }
    },
    tabs: {
      query(query, callback) {
        callback([tab]);
      },
      sendMessage(tabId, message, callback) {
        chrome.runtime.lastError = { message: "No content script on this tab." };
        callback(null);
        chrome.runtime.lastError = null;
      },
      create({ url }) {
        createdUrls.push(url);
      }
    }
  };

  const context = {
    chrome,
    document: {
      querySelector(selector) {
        if (!elements.has(selector)) {
          elements.set(selector, createElement());
        }
        return elements.get(selector);
      }
    },
    URL,
    URLSearchParams,
    setTimeout,
    window: {
      setTimeout
    }
  };
  vm.createContext(context);
  vm.runInContext(popupSource, context, { filename: "popup.js" });

  return {
    currentPaperButton: elements.get("[data-open-current-paper]"),
    createdUrls
  };
}

function getOpenedDiscussionUrl(tab) {
  const harness = createPopupHarness(tab);
  const click = harness.currentPaperButton.listeners.click;
  if (!click) throw new Error("Current paper button listener was not registered.");
  return Promise.resolve(click()).then(() => harness.createdUrls[0] || "");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function runCase(name, tab, expectations) {
  const openedUrl = await getOpenedDiscussionUrl(tab);
  assert(openedUrl, `${name}: popup did not open a discussion URL.`);
  const parsed = new URL(openedUrl);
  const params = parsed.searchParams;
  assert(openedUrl.startsWith("https://agte0318-star.github.io/paper-comment-extension/web/paper.html?"), `${name}: opened the wrong page: ${openedUrl}`);
  for (const [key, value] of Object.entries(expectations)) {
    if (key === "urlIncludes") {
      assert(params.get("url")?.includes(value), `${name}: expected original URL to include ${value}, got ${params.get("url")}`);
      continue;
    }
    assert(params.get(key) === value, `${name}: expected ${key}=${value}, got ${params.get(key)} in ${openedUrl}`);
  }
  console.log(`OK popup current-paper fallback: ${name}`);
}

async function main() {
  await runCase("arXiv PDF", {
    id: 1,
    url: "https://arxiv.org/pdf/1706.03762.pdf",
    title: "Attention Is All You Need"
  }, {
    id: "arxiv:1706.03762",
    source: "arxiv",
    urlIncludes: "arxiv.org/pdf/1706.03762.pdf"
  });

  await runCase("Wiley PDFDirect DOI", {
    id: 2,
    url: "chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai/index.html?src=https%3A%2F%2Fonlinelibrary.wiley.com%2Fdoi%2Fpdfdirect%2F10.1002%2Fadma.202407889%3Fdownload%3Dtrue",
    title: "Advanced Materials PDF"
  }, {
    id: "doi:10.1002/adma.202407889",
    source: "onlinelibrary.wiley.com",
    urlIncludes: "onlinelibrary.wiley.com/doi/pdfdirect/10.1002/adma.202407889"
  });

  await runCase("ScienceDirect PII", {
    id: 3,
    url: "https://www.sciencedirect.com/science/article/pii/S2590238524000010/pdfft?isDTMRedir=true",
    title: "ScienceDirect PDF"
  }, {
    id: "pii:s2590238524000010",
    source: "elsevier",
    urlIncludes: "sciencedirect.com/science/article/pii/S2590238524000010"
  });

  await runCase("generic journal PDF fallback", {
    id: 4,
    url: "https://journal.example.org/content/files/example-paper.pdf?download=pdf&utm_source=newsletter",
    title: "Example paper PDF"
  }, {
    id: "pdf:https://journal.example.org/content/files/example-paper.pdf",
    source: "journal.example.org",
    urlIncludes: "journal.example.org/content/files/example-paper.pdf"
  });

  console.log("Popup current-paper fallback check passed.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
