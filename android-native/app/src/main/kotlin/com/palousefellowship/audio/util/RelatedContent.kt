package com.palousefellowship.audio.util

import com.palousefellowship.audio.data.model.Audio
import kotlin.math.ln
import kotlin.math.sqrt

/** Port of src/utils/relatedContent.js: ranks recordings by TF-IDF cosine similarity of
 * "title + AI summary", and reports the words two summaries share (the "why"). */
const val MIN_RELATED_SCORE = 0.06
private const val RELATIVE_CUTOFF = 0.35
const val MAX_RELATED_RESULTS = 5
private const val MAX_SHARED_TERMS = 6

private val STOPWORDS = (
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
    ).split(" ").toSet()

private fun stem(word: String): String {
    var w = word
    if (w.length > 5) w = w.replace(Regex("(ations|ation|ings|ing|ness|ments|ment|ies|ied)$"), "")
    if (w.length > 4) w = w.replace(Regex("(ed|es|ly|s)$"), "")
    return w
}

private data class Tok(val stem: String, val word: String)

private fun tokenizeDetailed(text: String): List<Tok> =
    Regex("\\p{L}+").findAll(text.lowercase()).map { it.value }.mapNotNull { raw ->
        if (raw.length < 3 || raw in STOPWORDS) return@mapNotNull null
        val s = stem(raw)
        if (s.length >= 3 && s !in STOPWORDS) Tok(s, raw) else null
    }.toList()

data class RelatedMatch(val item: Audio, val score: Double, val terms: List<String>) {
    val strength: String get() = if (score >= 0.12) "strong" else if (score >= 0.08) "moderate" else "loose"
}

fun rankBySimilarity(title: String, summary: String, candidates: List<Audio>): List<RelatedMatch> {
    val curDetailed = tokenizeDetailed("$title $summary")
    val curTokens = curDetailed.map { it.stem }
    if (curTokens.isEmpty() || candidates.isEmpty()) return emptyList()

    val display = curDetailed.groupBy { it.stem }.mapValues { (_, toks) ->
        val best = toks.groupingBy { it.word }.eachCount().maxByOrNull { it.value }!!.key
        best.replaceFirstChar { it.uppercase() }
    }
    val candTokens = candidates.map { tokenizeDetailed("${it.title} ${it.aiSummary.orEmpty()}").map { t -> t.stem } }
    val docs = listOf(curTokens) + candTokens
    val df = HashMap<String, Int>()
    docs.forEach { d -> d.toSet().forEach { df[it] = (df[it] ?: 0) + 1 } }
    val n = docs.size
    fun idf(t: String) = ln((n + 1.0) / ((df[t] ?: 0) + 0.5))
    fun vectorize(tokens: List<String>): Pair<Map<String, Double>, Double> {
        val vec = tokens.groupingBy { it }.eachCount().mapValues { (t, c) -> (1 + ln(c.toDouble())) * idf(t) }
        return vec to sqrt(vec.values.sumOf { it * it })
    }
    val (curVec, curNorm) = vectorize(curTokens)
    if (curNorm == 0.0) return emptyList()

    return candidates.mapIndexed { i, item ->
        val (cv, cn) = vectorize(candTokens[i])
        if (cn == 0.0) return@mapIndexed RelatedMatch(item, 0.0, emptyList())
        var dot = 0.0
        val shared = mutableListOf<Pair<String, Double>>()
        curVec.forEach { (t, w) -> cv[t]?.let { c -> dot += w * c; shared += t to w * c } }
        val terms = mutableListOf<String>()
        val seen = HashSet<String>()
        for ((t, _) in shared.sortedByDescending { it.second }) {
            val word = display[t] ?: t
            if (!seen.add(word.lowercase().take(5))) continue
            terms += word
            if (terms.size >= MAX_SHARED_TERMS) break
        }
        RelatedMatch(item, dot / (curNorm * cn), terms)
    }.sortedByDescending { it.score }
}

fun pickRelated(ranked: List<RelatedMatch>, limit: Int = MAX_RELATED_RESULTS): List<RelatedMatch> {
    val best = ranked.firstOrNull()?.score ?: 0.0
    if (best < MIN_RELATED_SCORE) return emptyList()
    val cutoff = maxOf(MIN_RELATED_SCORE, best * RELATIVE_CUTOFF)
    return ranked.filter { it.score >= cutoff }.take(limit)
}
