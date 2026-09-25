// Bible reference detection ("Romans 8:28", "1 Cor. 13", "Ps 23:1-4").
const BOOKS = [
  ["Genesis", "Gen", "Gn"], ["Exodus", "Exod", "Ex"], ["Leviticus", "Lev", "Lv"], ["Numbers", "Num", "Nm"], ["Deuteronomy", "Deut", "Dt"],
  ["Joshua", "Josh"], ["Judges", "Judg"], ["Ruth"], ["1 Samuel", "1 Sam"], ["2 Samuel", "2 Sam"], ["1 Kings", "1 Kgs"], ["2 Kings", "2 Kgs"],
  ["1 Chronicles", "1 Chron", "1 Chr"], ["2 Chronicles", "2 Chron", "2 Chr"], ["Ezra"], ["Nehemiah", "Neh"], ["Esther", "Esth"], ["Job"],
  ["Psalms", "Psalm", "Ps", "Pss"], ["Proverbs", "Prov", "Pr"], ["Ecclesiastes", "Eccl", "Ecc"], ["Song of Solomon", "Song of Songs", "Song"],
  ["Isaiah", "Isa"], ["Jeremiah", "Jer"], ["Lamentations", "Lam"], ["Ezekiel", "Ezek"], ["Daniel", "Dan"], ["Hosea", "Hos"], ["Joel"], ["Amos"],
  ["Obadiah", "Obad"], ["Jonah"], ["Micah", "Mic"], ["Nahum", "Nah"], ["Habakkuk", "Hab"], ["Zephaniah", "Zeph"], ["Haggai", "Hag"],
  ["Zechariah", "Zech"], ["Malachi", "Mal"], ["Matthew", "Matt", "Mt"], ["Mark", "Mk"], ["Luke", "Lk"], ["John", "Jn"], ["Acts"], ["Romans", "Rom"],
  ["1 Corinthians", "1 Cor"], ["2 Corinthians", "2 Cor"], ["Galatians", "Gal"], ["Ephesians", "Eph"], ["Philippians", "Phil"], ["Colossians", "Col"],
  ["1 Thessalonians", "1 Thess", "1 Thes"], ["2 Thessalonians", "2 Thess", "2 Thes"], ["1 Timothy", "1 Tim"], ["2 Timothy", "2 Tim"], ["Titus"],
  ["Philemon", "Philem"], ["Hebrews", "Heb"], ["James", "Jas"], ["1 Peter", "1 Pet"], ["2 Peter", "2 Pet"], ["1 John", "1 Jn"], ["2 John", "2 Jn"],
  ["3 John", "3 Jn"], ["Jude"], ["Revelation", "Rev"],
];

const lookup = new Map();
for (const names of BOOKS) for (const n of names) lookup.set(n.toLowerCase(), names[0]);

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+");
const alternation = [...lookup.keys()].sort((a, b) => b.length - a.length).map(esc).join("|");
const PATTERN = `\\b(?:(?:[1-3]|I{1,3})\\s*)?(?:${alternation})\\b\\.?\\s*(\\d{1,3})(?::(\\d{1,3})(?:\\s*[-–]\\s*(\\d{1,3}))?)?`;

export function normalizeBook(raw) {
  const cleaned = raw.trim().replace(/\./g, "").replace(/^I{3}\s*/i, "3 ").replace(/^II\s*/i, "2 ").replace(/^I\s+/i, "1 ").replace(/^([1-3])(?=[A-Za-z])/, "$1 ").replace(/\s+/g, " ").toLowerCase();
  return lookup.get(cleaned) || null;
}

// All references found in a block of text.
export function findReferences(text) {
  if (!text) return [];
  const re = new RegExp(PATTERN, "gi");
  const found = [];
  let m;
  while ((m = re.exec(text))) {
    const bookPart = m[0].replace(/\s*\d{1,3}(?::\d{1,3}(?:\s*[-–]\s*\d{1,3})?)?\s*$/, "");
    const book = normalizeBook(bookPart);
    if (!book) continue;
    found.push({ book, chapter: Number(m[1]), verse: m[2] ? Number(m[2]) : null, endVerse: m[3] ? Number(m[3]) : null, raw: m[0].trim(), index: m.index });
  }
  return found;
}

// "romans 8" / "rom 8:28" typed as a whole search.
export function parseReferenceQuery(q) {
  const refs = findReferences(q.trim());
  return refs.length === 1 && refs[0].index === 0 && refs[0].raw.length >= q.trim().length - 1 ? refs[0] : null;
}

export const referenceLabel = (r) => `${r.book} ${r.chapter}${r.verse ? `:${r.verse}${r.endVerse ? `–${r.endVerse}` : ""}` : ""}`;
export const sameChapter = (a, b) => a.book === b.book && a.chapter === b.chapter;
