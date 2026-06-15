const fs = require("fs");
const path = require("path");
const readline = require("readline");

const root = path.resolve(__dirname, "..");
const version = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version;
const resultsPath = path.join(root, "release", "store-assets", version, "manual-test-results.md");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise((resolve) => {
    rl.question(`${question} [y/N] `, (answer) => {
      resolve(/^y(?:es)?$/i.test(answer.trim()));
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

  if (await ask("Is Google OAuth configured for this release?")) {
    if (await ask("Did Google sign-in work in the packaged extension and on the GitHub Pages profile page?")) {
      updates.push({
        item: "Google sign-in works if configured",
        result: "Pass",
        notes: "Verified in a real browser after `npm.cmd run check:google-oauth-setup`; Google sign-in returned to the extension and GitHub Pages profile page signed in."
      });
    }
  } else if (await ask("Record Google OAuth as not configured for this release?")) {
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
    content = content
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
  rl.close();
});
