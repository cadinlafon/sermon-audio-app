////////////////////////////////////////////////////////////////
// RELATED CONTENT — compares AI summaries against each other.
//
// Pure functions (no Firebase / React) so they can be unit-tested and
// reused. Ranks recordings by TF-IDF cosine similarity of
// "title + summary" text: words that are rare across the library
// (a book of the Bible, "Sabbath", "prodigal") weigh heavily, words
// that appear in every summary ("sermon", "explores", "main topic")
// weigh almost nothing.
//
// This is the always-available engine: it needs no network or sign-in.
// The AI call in RelatedAudio.jsx, when it works, re-ranks the best
// of these for thematic matches word overlap can't see.
////////////////////////////////////////////////////////////////

// Absolute floor: below this cosine score two summaries share almost
// nothing beyond boilerplate. Scores are small in absolute terms (long
// summaries, small library) — in the real library, same-passage and
// same-topic pairs land around 0.07–0.19, unrelated ones under ~0.05.
export const MIN_RELATED_SCORE = 0.06;

// ...and anything weaker than this fraction of the BEST match is a
// long-tail afterthought, not "related" — so a strong match isn't
// padded with weak ones.
const RELATIVE_CUTOFF = 0.35;

export const MAX_RELATED_RESULTS = 5;

const STOPWORDS = new Set(
  (
    "a about above after again against all also am an and any are as at be because been before being below " +
    "between both but by can could did do does doing down during each few for from further had has have having " +
    "he her here hers him his how i if in into is it its itself just let may me more most my no nor not now of " +
    "off on once only or other our out over own same she should so some such than that the their them then " +
    "there these they this those through to too under until up us very was we were what when where which while " +
    "who whom why will with would you your yours through toward towards upon within without among across " +
    "one two three four five first second third new many much every without whether yet still even ever " +
    "sermon message talk main topic key points point theme themes scripture scriptures passage application " +
    "applications summary explores explore explains explain shows show highlights highlight emphasizes " +
    "emphasize discusses discuss teaches teach speaker listeners listener congregation"
  ).split(" ")
);

// Cheap suffix stripping so "parenting"/"parents"/"parent" and
// "created"/"creation" land near each other without a real stemmer.
function stem(word) {
  let w = word;
  if (w.length > 5) w = w.replace(/(ations|ation|ings|ing|ness|ments|ment|ies|ied)$/, "");
  if (w.length > 4) w = w.replace(/(ed|es|ly|s)$/, "");
  return w;
}

// Same as tokenize(), but keeps the original word next to each stem so
// a matched stem can be shown to people as a real word ("parent", not
// "paren").
function tokenizeDetailed(text) {
  if (typeof text !== "string") return [];
  // \p{L} keeps letters from any script; this also cleanly splits on
  // markdown (**), narrow no-break spaces and non-breaking hyphens that
  // appear in the generated summaries. Numbers are dropped on purpose:
  // verse numbers ("27", "32") are noise — the book name is the signal.
  const words = text.toLowerCase().match(/\p{L}+/gu) || [];
  const out = [];
  for (const raw of words) {
    if (raw.length < 3 || STOPWORDS.has(raw)) continue;
    const s = stem(raw);
    if (s.length >= 3 && !STOPWORDS.has(s)) out.push({ stem: s, word: raw });
  }
  return out;
}

export function tokenize(text) {
  return tokenizeDetailed(text).map((t) => t.stem);
}

// stem -> the surface form used most often in `text`, capitalized.
function displayWords(detailed) {
  const counts = new Map();
  for (const { stem: s, word } of detailed) {
    const forms = counts.get(s) || new Map();
    forms.set(word, (forms.get(word) || 0) + 1);
    counts.set(s, forms);
  }
  const out = new Map();
  for (const [s, forms] of counts) {
    const best = [...forms.entries()].sort((a, b) => b[1] - a[1])[0][0];
    out.set(s, best.charAt(0).toUpperCase() + best.slice(1));
  }
  return out;
}

// How many shared terms to surface per match.
const MAX_SHARED_TERMS = 6;

// A plain-language read on a score, so the "why" is honest about weak
// matches (whose shared words tend to be generic). Cut-points taken
// from the real library: same-passage / same-topic pairs score ~0.10+,
// a few shared general themes ~0.06–0.08.
export function matchStrength(score) {
  if (score >= 0.12) return "strong";
  if (score >= 0.08) return "moderate";
  return "loose";
}

function termFrequencies(tokens) {
  const tf = new Map();
  for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
  return tf;
}

/**
 * Apply the floor + relative cutoff to a ranked list.
 * @returns {Array<{item: object, score: number, terms: string[]}>}
 *          the matches worth showing, best first.
 */
export function pickRelated(ranked, limit = MAX_RELATED_RESULTS) {
  const best = ranked[0]?.score || 0;
  if (best < MIN_RELATED_SCORE) return [];
  const cutoff = Math.max(MIN_RELATED_SCORE, best * RELATIVE_CUTOFF);
  return ranked.filter((r) => r.score >= cutoff).slice(0, limit);
}

/**
 * Rank candidates by how similar their summary is to `current`'s.
 *
 * `terms` is WHY a candidate scored as it did: the words the two
 * summaries share, biggest contributors to the similarity first.
 *
 * @param {{title?: string, summary?: string}} current
 * @param {Array<{id: string, title?: string, aiSummary?: string}>} candidates
 * @returns {Array<{item: object, score: number, terms: string[]}>}
 *          sorted best-first, INCLUDING zero scores — callers apply
 *          MIN_RELATED_SCORE (see pickRelated).
 */
export function rankBySimilarity(current, candidates) {
  const currentDetailed = tokenizeDetailed(`${current?.title || ""} ${current?.summary || ""}`);
  const currentTokens = currentDetailed.map((t) => t.stem);
  if (currentTokens.length === 0 || !Array.isArray(candidates) || candidates.length === 0) return [];

  const display = displayWords(currentDetailed);
  const candidateTokens = candidates.map((c) => tokenize(`${c.title || ""} ${c.aiSummary || ""}`));

  // Document frequency across the whole pool (current included).
  const docs = [currentTokens, ...candidateTokens];
  const df = new Map();
  for (const tokens of docs) for (const t of new Set(tokens)) df.set(t, (df.get(t) || 0) + 1);

  const n = docs.length;
  const idf = (t) => Math.log((n + 1) / ((df.get(t) || 0) + 0.5));

  const vectorize = (tokens) => {
    const tf = termFrequencies(tokens);
    const vec = new Map();
    let norm = 0;
    for (const [t, count] of tf) {
      const weight = (1 + Math.log(count)) * idf(t);
      vec.set(t, weight);
      norm += weight * weight;
    }
    return { vec, norm: Math.sqrt(norm) };
  };

  const cur = vectorize(currentTokens);
  if (cur.norm === 0) return [];

  return candidates
    .map((item, i) => {
      const cand = vectorize(candidateTokens[i]);
      if (cand.norm === 0) return { item, score: 0, terms: [], strength: "loose" };
      let dot = 0;
      const shared = [];
      for (const [t, w] of cur.vec) {
        const cw = cand.vec.get(t);
        if (cw) {
          const contribution = w * cw;
          dot += contribution;
          shared.push([t, contribution]);
        }
      }
      // Biggest contributors first, skipping near-duplicate forms the
      // light stemmer doesn't unify ("Curse"/"Curses", "Child"/"Children").
      const terms = [];
      const seenPrefixes = new Set();
      for (const [t] of shared.sort((a, b) => b[1] - a[1])) {
        const word = display.get(t) || t;
        const prefix = word.toLowerCase().slice(0, 5);
        if (seenPrefixes.has(prefix)) continue;
        seenPrefixes.add(prefix);
        terms.push(word);
        if (terms.length >= MAX_SHARED_TERMS) break;
      }
      const score = dot / (cur.norm * cand.norm);
      return { item, score, terms, strength: matchStrength(score) };
    })
    .sort((a, b) => b.score - a.score);
}
