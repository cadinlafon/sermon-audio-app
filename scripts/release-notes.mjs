// Runs automatically before every `firebase deploy` of the website
// (firebase.json → hosting.predeploy). Collects "what changed in this
// release" and writes it into dist/version.json, which the running app reads
// to fill the "Details" dropdown on the "New version available" bar.
//
// Where the notes come from, first match wins:
//   1. PF_RELEASE_NOTES env var       (lines separated by newlines or " | ")
//   2. release-notes.txt              (one change per line; "- " bullets fine)
//   3. you, typing them here, if this is an interactive terminal
// In an interactive terminal it ALWAYS asks (showing any notes it already
// found, so you can keep, replace or skip). With no terminal (scripts, CI,
// Claude) it just uses 1 or 2, or deploys with no notes.
//
// The notes are PUBLIC (version.json is served to everyone), so don't put
// secrets in them. Admin-only or behind-the-scenes changes are fine to list.
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const root = process.cwd();
const versionFile = path.join(root, "dist", "version.json");
const notesFile = path.join(root, "release-notes.txt");

const clean = (line) => line.replace(/^\s*(?:[-*•]\s+)?/, "").trim();
const parse = (text) => text.split(/\r?\n|\s\|\s/).map(clean).filter(Boolean);

function existingNotes() {
  if (process.env.PF_RELEASE_NOTES) return parse(process.env.PF_RELEASE_NOTES);
  if (fs.existsSync(notesFile)) return parse(fs.readFileSync(notesFile, "utf8"));
  return [];
}

async function ask(existing) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const lines = [];
  const question = (q) => new Promise((resolve) => rl.question(q, resolve));

  console.log("\n──────────── Release notes ────────────");
  console.log('Shown to everyone under "Details" on the "New version available" bar.');
  console.log("You can list things that don't affect users too (admin dashboard changes, etc.).");
  if (existing.length) {
    console.log("\nAlready written for this release:");
    existing.forEach((n) => console.log(`  • ${n}`));
    console.log("\nPress Enter to keep these, or type new notes to replace them.");
  } else {
    console.log("\nType one change per line. Press Enter on an empty line when you're done");
    console.log("(or press Enter right away to deploy without notes).");
  }

  let first = true;
  for (;;) {
    const line = await question(first ? "› " : "  › ");
    if (first && !line.trim() && existing.length) {
      rl.close();
      return existing;
    }
    first = false;
    if (!line.trim()) break;
    lines.push(clean(line));
  }
  rl.close();
  return lines;
}

async function main() {
  if (!fs.existsSync(versionFile)) {
    console.log("release-notes: dist/version.json not found (did you run `npm run build` first?) — skipping.");
    return;
  }

  const existing = existingNotes();
  const interactive = process.stdin.isTTY && process.stdout.isTTY && !process.env.CI;
  const notes = interactive ? await ask(existing) : existing;

  const info = JSON.parse(fs.readFileSync(versionFile, "utf8"));
  info.notes = notes.slice(0, 60).map((n) => n.slice(0, 300));
  info.releasedAt = new Date().toISOString();
  fs.writeFileSync(versionFile, JSON.stringify(info));

  // Remember them for the post-deploy step (archive + clear).
  fs.writeFileSync(notesFile, notes.join("\n") + (notes.length ? "\n" : ""));
  console.log(notes.length ? `release-notes: ${notes.length} note${notes.length === 1 ? "" : "s"} added to this release.` : "release-notes: deploying with no notes.");
}

main().catch((err) => {
  // Never block a deploy over notes.
  console.error("release-notes: couldn't add notes —", err.message);
});
