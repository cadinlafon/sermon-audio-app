package com.palousefellowship.audio.data.model

/** Ported verbatim from src/data/doctrineSchedule.js — the full-year
 * Doctrine Campaign curriculum schedule. Static content on the web too
 * (not admin-editable via Firestore, unlike the rest of Doctrine's
 * content) — update this list directly if the schedule changes. */
data class DoctrineScheduleRow(
    val week: Int? = null,
    val isBreak: Boolean = false,
    val date: String,
    val topic: String,
    val memoryText: String = "",
)

val DOCTRINE_SCHEDULE = listOf(
    DoctrineScheduleRow(week = 1, date = "Sept. 6-12", topic = "What Is Theology?", memoryText = "2 Tim. 3:16-17"),
    DoctrineScheduleRow(week = 2, date = "Sept. 13-19", topic = "General and Special Revelation", memoryText = "Rom. 1:19-20"),
    DoctrineScheduleRow(week = 3, date = "Sept. 20-26", topic = "Inspiration, Authority, and Infallibility of Scripture", memoryText = "2 Pet. 1:20-1"),
    DoctrineScheduleRow(week = 4, date = "Sept. 27-Oct. 3", topic = "Canon and Text of Scripture", memoryText = "Deut. 4:2"),
    DoctrineScheduleRow(week = 5, date = "Oct. 4-10", topic = "Knowledge and Unity of God", memoryText = "Deut. 6:4-5"),
    DoctrineScheduleRow(week = 6, date = "Oct. 11-17", topic = "The Trinity"),
    DoctrineScheduleRow(week = 7, date = "Oct. 18-24", topic = "Attributes of God"),
    DoctrineScheduleRow(week = 8, date = "Oct. 25-31", topic = "Divine Providence"),
    DoctrineScheduleRow(week = 9, date = "Nov. 1-7", topic = "Doctrine of Creation"),
    DoctrineScheduleRow(week = 10, date = "Nov. 8-14", topic = "Angels and Demons (Angelology)"),
    DoctrineScheduleRow(week = 11, date = "Nov. 15-21", topic = "Doctrine of Man (Anthropology)"),
    DoctrineScheduleRow(isBreak = true, date = "Nov. 22-28", topic = "Thanksgiving Break"),
    DoctrineScheduleRow(week = 12, date = "Nov. 29-Dec. 5", topic = "Sin and its Transmission"),
    DoctrineScheduleRow(week = 13, date = "Dec. 6-12", topic = "Doctrine of the Covenant"),
    DoctrineScheduleRow(week = 14, date = "Dec. 13-19", topic = "The Christ of the Bible"),
    DoctrineScheduleRow(isBreak = true, date = "Dec. 20-26", topic = "Christmas Break"),
    DoctrineScheduleRow(isBreak = true, date = "Dec. 27-Jan. 2", topic = "Christmas Break"),
    DoctrineScheduleRow(week = 15, date = "Jan. 3-9", topic = "One Person, Two Natures"),
    DoctrineScheduleRow(week = 16, date = "Jan. 10-16", topic = "The Names, States, and Offices of Christ"),
    DoctrineScheduleRow(week = 17, date = "Jan. 17-23", topic = "Atonement I"),
    DoctrineScheduleRow(week = 18, date = "Jan. 24-30", topic = "Atonement II"),
    DoctrineScheduleRow(week = 19, date = "Jan. 31-Feb. 6", topic = "The Holy Spirit in the Bible (Pneumatology)"),
    DoctrineScheduleRow(week = 20, date = "Feb. 7-13", topic = "The Baptism of the Holy Spirit"),
    DoctrineScheduleRow(week = 21, date = "Feb. 14-20", topic = "The Gifts and Fruit of the Spirit"),
    DoctrineScheduleRow(week = 22, date = "Feb. 21-27", topic = "Common and Special Grace"),
    DoctrineScheduleRow(week = 23, date = "Feb. 28-Mar. 6", topic = "Election and Reprobation"),
    DoctrineScheduleRow(week = 24, date = "Mar. 7-13", topic = "Effectual Calling"),
    DoctrineScheduleRow(week = 25, date = "Mar. 14-20", topic = "Justification by Faith Alone"),
    DoctrineScheduleRow(week = 26, date = "Mar. 21-27", topic = "Adoption and Union with Christ"),
    DoctrineScheduleRow(week = 27, date = "Mar. 28-Apr. 3", topic = "Sanctification and Perseverance of the Saints"),
    DoctrineScheduleRow(isBreak = true, date = "Apr. 4-10", topic = "Easter Break"),
    DoctrineScheduleRow(week = 28, date = "Apr. 11-17", topic = "The Church: One, Holy, Catholic, and Apostolic (Ecclesiology)"),
    DoctrineScheduleRow(week = 29, date = "Apr. 18-24", topic = "Worship in the Church"),
    DoctrineScheduleRow(week = 30, date = "Apr. 25-May 1", topic = "The Sacraments of the Church: Baptism (Sacramentology)"),
    DoctrineScheduleRow(week = 31, date = "May 2-8", topic = "The Sacraments of the Church: The Lord's Supper"),
    DoctrineScheduleRow(week = 32, date = "May 9-15", topic = "Death and the Intermediate State (Eschatology)"),
    DoctrineScheduleRow(week = 33, date = "May 16-22", topic = "The Resurrection"),
    DoctrineScheduleRow(week = 34, date = "May 23-29", topic = "The Kingdom of God"),
    DoctrineScheduleRow(week = 35, date = "May 30-June 5", topic = "The Millennium and the Return of Christ"),
    DoctrineScheduleRow(week = 36, date = "June 6-12", topic = "The Final Judgment and Eternal Punishment"),
    DoctrineScheduleRow(week = 37, date = "June 13-19", topic = "Heaven and Earth Made New"),
)
