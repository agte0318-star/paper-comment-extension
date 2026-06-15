const fs = require("fs");
const path = require("path");
const readline = require("readline");

const root = path.resolve(__dirname, "..");
const version = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version;
const resultsPath = process.env.PCE_MANUAL_RESULTS_PATH || path.join(root, "release", "store-assets", version, "manual-test-results.md");
const scriptedAnswers = process.stdin.isTTY ? null : fs.readFileSync(0, "utf8").split(/\r?\n/);

const rl = scriptedAnswers ? null : readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  if (scriptedAnswers) {
    const answer = scriptedAnswers.shift() || "";
    console.log(`${question} [y/N] ${answer}`);
    return Promise.resolve(/^y(?:es)?$/i.test(answer.trim()));
  }
  return new Promise((resolve) => {
    rl.question(`${question} [y/N] `, (answer) => {
      resolve(/^y(?:es)?$/i.test(answer.trim()));
    });
  });
}

function askText(question, defaultValue) {
  const suffix = defaultValue ? ` [${defaultValue}] ` : " ";
  if (scriptedAnswers) {
    const answer = scriptedAnswers.shift() || "";
    console.log(`${question}${suffix}${answer}`);
    return Promise.resolve(answer.trim() || defaultValue || "");
  }
  return new Promise((resolve) => {
    rl.question(`${question}${suffix}`, (answer) => {
      resolve(answer.trim() || defaultValue || "");
    });
  });
}

function replaceRow(content, item, result, notes) {
  const escaped = item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^\\| ${escaped} \\| [^|]+ \\|[^|]*\\|$`, "m");
  if (!pattern.test(content)) throw new Error(`Could not find QA row: ${item}`);
  return content.replace(pattern, `| ${item} | ${result} | ${notes.replaceAll("|", "\\|")} |`);
}

async function main() {
  if (!fs.existsSync(resultsPath)) throw new Error(`Missing manual test results: ${resultsPath}`);

  console.log("Paper Comment Extension account QA finalizer");
  console.log("Run `npm.cmd run qa:account` first. Only answer yes for checks you truly completed.");
  console.log(`File: ${resultsPath}`);
  console.log("");

  const checks = [
    {
      item: "Email/password account creation works",
      question: "Did a fresh email/password signup succeed or get accepted by Supabase?",
      notes: "Verified with `npm.cmd run qa:account` / `npm.cmd run check:live-account-flow` using a fresh test email. No password or inbox content was recorded."
    },
    {
      item: "Email confirmation flow is understandable",
      question: "If confirmation was required, did the inbox receive a clear confirmation email and did the link allow sign-in? If confirmation was not required, answer yes.",
      notes: "Verified with a fresh test account. Confirmation was either not required by Supabase or the confirmation email/link flow was clear and allowed sign-in."
    },
    {
      item: "Email/password sign-in works",
      question: "Did the reader test account sign in successfully with email/password?",
      notes: "Verified with `npm.cmd run qa:account` / `npm.cmd run check:live-account-flow` using the reader test account."
    },
    {
      item: "Password reset email can be requested",
      question: "Did Supabase accept the password-reset request for the reader test account?",
      notes: "Verified with `npm.cmd run qa:account` / `npm.cmd run check:live-account-flow`; no reset email contents were recorded."
    }
  ];

  const updates = [];
  for (const check of checks) {
    if (await ask(check.question)) updates.push({ ...check, result: "Pass" });
  }

  let googleOAuthStatus = "Pending manual test";
  if (await ask("Is Google OAuth configured for this release?")) {
    if (await ask("Did Google sign-in work in the packaged extension and on the GitHub Pages profile page?")) {
      googleOAuthStatus = "Verified in packaged extension and GitHub Pages profile page";
      updates.push({
        item: "Google sign-in works if configured",
        result: "Pass",
        notes: "Verified in a real browser after `npm.cmd run check:google-oauth-setup`; Google sign-in returned to the extension and GitHub Pages profile page signed in."
      });
    }
  } else if (await ask("Record Google OAuth as not configured for this release?")) {
    googleOAuthStatus = "Not configured for this release";
    updates.push({
      item: "Google sign-in works if configured",
      result: "Pass",
      notes: "Google OAuth is not configured for this release; the conditional Google sign-in check is not applicable."
    });
  }

  if (!updates.length) {
    console.log("No QA rows were updated.");
    return;
  }

  let content = fs.readFileSync(resultsPath, "utf8");
  for (const update of updates) {
    content = replaceRow(content, update.item, update.result, update.notes);
  }

  if (!/\| [^|]+ \| Pending \|/.test(content) && await ask("No Pending table rows remain. Set Ready to upload to Yes?")) {
    const today = new Date().toISOString().slice(0, 10);
    const qaDate = await askText("Final QA date", today);
    const tester = await askText("Tester label, without private email", "Manual account QA completed with Codex-guided checks");
    const browser = await askText("Browser label", "Chrome packaged extension manual test");
    const testAccountLabel = await askText("Test account label, without private email", "Reader/fresh test accounts verified; no private email recorded");

    content = content
      .replace(/^- Date: .*$/m, `- Date: ${qaDate}`)
      .replace(/^- Tester: .*$/m, `- Tester: ${tester}`)
      .replace(/^- Browser: .*$/m, `- Browser: ${browser}`)
      .replace(/^- Test account email alias or label: .*$/m, `- Test account email alias or label: ${testAccountLabel}`)
      .replace(/^- Google OAuth tested: .*$/m, `- Google OAuth tested: ${googleOAuthStatus}`)
      .replace(/^- Ready to upload: .*$/m, "- Ready to upload: Yes")
      .replace(/^- If No, blocking issues: .*$/m, "- If No, blocking issues: None.")
      .replace(/^- Chrome Web Store status: .*$/m, "- Chrome Web Store status: Ready to submit");
  }

  fs.writeFileSync(resultsPath, content, "utf8");
  console.log("Updated account QA rows. Next run `npm.cmd run release:status` and `npm.cmd run check:release-ready`.");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(() => {
  rl?.close();
});
