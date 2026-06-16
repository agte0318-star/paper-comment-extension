const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const popupSource = fs.readFileSync(path.join(root, "src", "popup", "popup.js"), "utf8");
const SESSION_KEY = "paper-comments:supabase-session";

function createElement() {
  return {
    textContent: "",
    hidden: false,
    disabled: false,
    listeners: {},
    classList: {
      values: new Set(),
      toggle(name, enabled) {
        if (enabled) this.values.add(name);
        else this.values.delete(name);
      },
      contains(name) {
        return this.values.has(name);
      }
    },
    addEventListener(type, listener) {
      this.listeners[type] = listener;
    }
  };
}

function createHarness(initialStorage = {}) {
  const elements = new Map();
  const selectors = [
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

  for (const selector of selectors) elements.set(selector, createElement());

  const storage = { ...initialStorage };
  const createdUrls = [];
  const chrome = {
    runtime: {
      lastError: null,
      getManifest: () => ({ version: "0.5.6" })
    },
    storage: {
      local: {
        get(keys, callback) {
          const result = {};
          for (const key of Array.isArray(keys) ? keys : [keys]) {
            if (Object.prototype.hasOwnProperty.call(storage, key)) result[key] = storage[key];
          }
          callback(result);
        },
        remove(keys, callback) {
          for (const key of Array.isArray(keys) ? keys : [keys]) delete storage[key];
          callback?.();
        }
      }
    },
    tabs: {
      query(query, callback) {
        callback([]);
      },
      sendMessage(tabId, message, callback) {
        callback(null);
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
        if (!elements.has(selector)) elements.set(selector, createElement());
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
  return { elements, storage, createdUrls };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function main() {
  const harness = createHarness({
    [SESSION_KEY]: {
      access_token: "demo-access-token",
      refresh_token: "demo-refresh-token",
      user: {
        email: "reader@example.invalid",
        app_metadata: { provider: "email" },
        user_metadata: { display_name: "Launch Reader" }
      }
    }
  });

  await flush();

  const get = (selector) => harness.elements.get(selector);
  assert(get("[data-version]").textContent === "Version 0.5.6", "Popup did not render manifest version.");
  assert(get("[data-status-title]").textContent === "Launch Reader", "Popup did not show signed-in display name.");
  assert(get("[data-status-detail]").textContent.includes("synced"), "Popup did not show signed-in sync detail.");
  assert(get("[data-account-meta]").hidden === false, "Popup did not reveal account metadata.");
  assert(get("[data-account-email]").textContent === "reader@example.invalid", "Popup did not show signed-in email.");
  assert(get("[data-account-provider]").textContent === "Email", "Popup did not show account provider.");
  assert(get("[data-sign-out]").hidden === false, "Popup did not show sign-out button.");
  assert(get("[data-status-dot]").classList.contains("is-signed-in"), "Popup did not mark signed-in status.");
  console.log("OK popup shows signed-in account state.");

  const signOut = get("[data-sign-out]");
  assert(signOut.listeners.click, "Popup sign-out listener was not registered.");
  await Promise.resolve(signOut.listeners.click());
  await flush();

  assert(!Object.prototype.hasOwnProperty.call(harness.storage, SESSION_KEY), "Popup did not remove local session on sign-out.");
  assert(get("[data-status-title]").textContent === "Not signed in", "Popup did not return to signed-out title after sign-out.");
  assert(get("[data-account-meta]").hidden === true, "Popup did not hide account metadata after sign-out.");
  assert(get("[data-sign-out]").hidden === true, "Popup did not hide sign-out button after sign-out.");
  assert(get("[data-message]").textContent === "Signed out on this browser.", "Popup did not show sign-out confirmation.");
  assert(get("[data-status-dot]").classList.contains("is-signed-out"), "Popup did not mark signed-out status.");
  console.log("OK popup sign-out clears local session and updates UI.");
  console.log("Popup account state check passed.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
