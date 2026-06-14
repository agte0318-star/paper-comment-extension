const { URL } = require("url");

const defaultBaseUrl = "https://agte0318-star.github.io/paper-comment-extension/";
const baseUrl = process.env.PCE_PUBLIC_BASE_URL || defaultBaseUrl;
const timeoutMs = Number(process.env.PCE_PUBLIC_URL_TIMEOUT_MS || 20000);

const publicPaths = [
  "",
  "web/trending.html",
  "web/profile.html",
  "web/admin.html",
  "privacy-policy.html",
  "support.html"
];

function buildUrl(pathName) {
  return new URL(pathName, baseUrl).toString();
}

async function checkUrl(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal
    });
    const ok = response.status >= 200 && response.status < 400;
    return {
      ok,
      status: response.status,
      url
    };
  } catch (error) {
    return {
      ok: false,
      status: "ERR",
      url,
      error: error.name === "AbortError" ? `timeout after ${timeoutMs}ms` : error.message
    };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  console.log(`Checking public URLs from ${baseUrl}`);
  const results = [];

  for (const publicPath of publicPaths) {
    results.push(await checkUrl(buildUrl(publicPath)));
  }

  let failed = 0;
  for (const result of results) {
    const suffix = result.error ? ` - ${result.error}` : "";
    console.log(`${result.ok ? "OK" : "FAIL"} ${result.status} ${result.url}${suffix}`);
    if (!result.ok) failed += 1;
  }

  if (failed > 0) {
    console.error(`Public URL check failed: ${failed}/${results.length} URLs were not reachable.`);
    process.exit(1);
  }

  console.log(`Public URL check passed: ${results.length}/${results.length} URLs reachable.`);
}

main();
