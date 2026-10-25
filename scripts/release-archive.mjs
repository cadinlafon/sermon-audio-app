// Runs after a successful `firebase deploy` of the website (firebase.json →
// hosting.postdeploy): files this release's notes into release-history.jsonl
// (one JSON line per release) and clears release-notes.txt for the next one.
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const versionFile = path.join(root, "dist", "version.json");
const notesFile = path.join(root, "release-notes.txt");
const historyFile = path.join(root, "release-history.jsonl");

try {
  const info = JSON.parse(fs.readFileSync(versionFile, "utf8"));
  const entry = { version: info.version, releasedAt: info.releasedAt || new Date().toISOString(), mode: info.mode, notes: info.notes || [] };
  fs.appendFileSync(historyFile, JSON.stringify(entry) + "\n");
  if (fs.existsSync(notesFile)) fs.writeFileSync(notesFile, "");
  console.log(`release-archive: saved release ${entry.version} (${entry.notes.length} note${entry.notes.length === 1 ? "" : "s"}) to release-history.jsonl`);
} catch (err) {
  console.error("release-archive: couldn't record this release —", err.message);
}
