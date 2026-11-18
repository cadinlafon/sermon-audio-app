package com.palousefellowship.audio.util

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withLink
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.sp
import com.palousefellowship.audio.data.model.parseHex

/**
 * Port of src/lib/richText.js: **bold**, *italic*, __underline__, ~~strike~~, ==highlight==, `code`,
 * {color:#hex}text{/color}, [label](target), bare links, # headings, - / 1. lists, > quotes, --- lines.
 * Link targets: https:// opens the browser, /path opens that page in the app, mailto: / tel: work,
 * and popup:ID (popups built on the web) shows as plain bold text — popups aren't available natively.
 */
private data class Pat(val re: Regex, val kind: String, val inner: Int, val lead: Boolean = false)

private val PATS = listOf(
    Pat(Regex("`([^`\\n]+)`"), "code", 1),
    Pat(Regex("\\[([^\\]\\n]+)\\]\\(([^)\\s]+)\\)"), "link", 1),
    Pat(Regex("\\{color:(#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6})\\}([\\s\\S]+?)\\{/color\\}"), "color", 2),
    Pat(Regex("\\*\\*(?=\\S)([\\s\\S]+?)(?<=\\S)\\*\\*"), "strong", 1),
    Pat(Regex("__(?=\\S)([\\s\\S]+?)(?<=\\S)__"), "u", 1),
    Pat(Regex("~~(?=\\S)([\\s\\S]+?)(?<=\\S)~~"), "s", 1),
    Pat(Regex("==(?=\\S)([\\s\\S]+?)(?<=\\S)=="), "mark", 1),
    Pat(Regex("(^|[^*\\w])\\*(?![*\\s])([^*\\n]+?)(?<![*\\s])\\*(?![*\\w])"), "em", 2, lead = true),
    Pat(Regex("(^|[^_\\w])_(?![_\\s])([^_\\n]+?)(?<![_\\s])_(?![_\\w])"), "em", 2, lead = true),
    Pat(Regex("(https?://[^\\s<>()\\[\\]]+[^\\s<>()\\[\\].,;:!?'\")\\]])"), "auto", 1),
)

private fun linkKind(href: String): String = when {
    Regex("^https?://\\S+$", RegexOption.IGNORE_CASE).matches(href) -> "url"
    Regex("^popup:[A-Za-z0-9_-]{1,80}$").matches(href) -> "popup"
    Regex("^mailto:[^\\s@]+@[^\\s@]+$", RegexOption.IGNORE_CASE).matches(href) -> "url"
    Regex("^tel:[+0-9().\\-\\s]{3,30}$", RegexOption.IGNORE_CASE).matches(href) -> "url"
    Regex("^(page:)?/(?!/)\\S*$").matches(href) -> "page"
    else -> "invalid"
}

private fun AnnotatedString.Builder.inline(text: String, linkColor: Color, onPage: (String) -> Unit) {
    var rest = text
    while (rest.isNotEmpty()) {
        var best: Triple<Pat, MatchResult, Int>? = null
        for (p in PATS) {
            val m = p.re.find(rest) ?: continue
            val idx = m.range.first + if (p.lead) m.groupValues[1].length else 0
            if (best == null || idx < best.third) best = Triple(p, m, idx)
        }
        if (best == null) { append(rest); break }
        val (p, m, idx) = best
        if (idx > 0) append(rest.substring(0, idx))
        val len = m.value.length - if (p.lead) m.groupValues[1].length else 0
        when (p.kind) {
            "code" -> withStyle(SpanStyle(fontFamily = FontFamily.Monospace, background = Color(0x22888888))) { append(m.groupValues[1]) }
            "auto" -> withLink(LinkAnnotation.Url(m.groupValues[1], TextLinkStyles(SpanStyle(color = linkColor, textDecoration = TextDecoration.Underline, fontWeight = FontWeight.SemiBold)))) { append(m.groupValues[1]) }
            "link" -> {
                val href = m.groupValues[2]
                val style = SpanStyle(color = linkColor, textDecoration = TextDecoration.Underline, fontWeight = FontWeight.SemiBold)
                when (linkKind(href)) {
                    "url" -> withLink(LinkAnnotation.Url(href, TextLinkStyles(style))) { inline(m.groupValues[1], linkColor, onPage) }
                    "page" -> withLink(LinkAnnotation.Clickable("page", TextLinkStyles(style)) { onPage(href.removePrefix("page:")) }) { inline(m.groupValues[1], linkColor, onPage) }
                    "popup" -> withStyle(SpanStyle(fontWeight = FontWeight.SemiBold)) { inline(m.groupValues[1], linkColor, onPage) }
                    else -> append(m.value)
                }
            }
            "color" -> withStyle(SpanStyle(color = parseHex(m.groupValues[1]) ?: Color.Unspecified)) { inline(m.groupValues[2], linkColor, onPage) }
            "strong" -> withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { inline(m.groupValues[1], linkColor, onPage) }
            "em" -> withStyle(SpanStyle(fontStyle = FontStyle.Italic)) { inline(m.groupValues[p.inner], linkColor, onPage) }
            "u" -> withStyle(SpanStyle(textDecoration = TextDecoration.Underline)) { inline(m.groupValues[1], linkColor, onPage) }
            "s" -> withStyle(SpanStyle(textDecoration = TextDecoration.LineThrough)) { inline(m.groupValues[1], linkColor, onPage) }
            "mark" -> withStyle(SpanStyle(background = Color(0x55F6C453))) { inline(m.groupValues[1], linkColor, onPage) }
        }
        rest = rest.substring(idx + len)
    }
}

fun richAnnotated(text: String, linkColor: Color, onPage: (String) -> Unit = {}): AnnotatedString = buildAnnotatedString {
    val lines = text.replace("\r\n", "\n").split("\n")
    var number = 0
    lines.forEachIndexed { i, raw ->
        val line = raw.trimEnd()
        val heading = Regex("^(#{1,3})\\s+(.*)$").find(line)
        val bullet = Regex("^\\s*[-*•]\\s+(.*)$").find(line)
        val numbered = Regex("^\\s*\\d+[.)]\\s+(.*)$").find(line)
        val quote = Regex("^>\\s?(.*)$").find(line)
        if (numbered == null) number = 0
        when {
            heading != null -> withStyle(SpanStyle(fontWeight = FontWeight.Bold, fontSize = if (heading.groupValues[1].length == 1) 19.sp else 16.sp, fontFamily = FontFamily.Serif)) { inline(heading.groupValues[2], linkColor, onPage) }
            Regex("^\\s*(---+|\\*\\*\\*+)\\s*$").matches(line) -> append("────────")
            bullet != null -> { append("•  "); inline(bullet.groupValues[1], linkColor, onPage) }
            numbered != null -> { number++; append("$number. "); inline(numbered.groupValues[1], linkColor, onPage) }
            quote != null -> withStyle(SpanStyle(fontStyle = FontStyle.Italic)) { append("❝ "); inline(quote.groupValues[1], linkColor, onPage) }
            else -> inline(line, linkColor, onPage)
        }
        if (i < lines.lastIndex) append("\n")
    }
}

/** Formatting removed — for list previews and places that can't style text. */
fun stripRichText(text: String): String = richAnnotated(text, Color.Unspecified).text

/** What a rich-text link to an in-app page ("/sermons") does — provided once by the nav host. */
val LocalPageLinkHandler = androidx.compose.runtime.staticCompositionLocalOf<(String) -> Unit> { {} }

@Composable
fun RichText(
    text: String,
    modifier: Modifier = Modifier,
    style: TextStyle = MaterialTheme.typography.bodyMedium,
    color: Color = Color.Unspecified,
    linkColor: Color = MaterialTheme.colorScheme.primary,
    onPage: (String) -> Unit = LocalPageLinkHandler.current,
) {
    Text(richAnnotated(text.trim(), linkColor, onPage), modifier = modifier, style = style, color = color)
}
