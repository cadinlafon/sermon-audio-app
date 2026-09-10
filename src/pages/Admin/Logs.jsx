import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, getDocs } from "firebase/firestore";
import { db } from "../../firebase";

// Event type → badge color
const EVENT_COLORS = {
  session_start: {
    bg: "#dcfce7",
    color: "#166534",
  },

  session_end: {
    bg: "#f1f5f9",
    color: "#475569",
  },

  app_opened: {
    bg: "#e8f0fe",
    color: "#2a5ab5",
  },

  pwa_installed: {
    bg: "#fef3c7",
    color: "#92400e",
  },

  pwa_installed_ios: {
    bg: "#fef3c7",
    color: "#92400e",
  },

  route_change: {
    bg: "#f3e8ff",
    color: "#6d28d9",
  },

  audio_play: {
    bg: "#f6e4b0",
    color: "#7a5a10",
  },
};

const eventStyle = (event) =>
  EVENT_COLORS[event] || {
    bg: "#f0e4d0",
    color: "#5c3a1e",
  };

const defaultFilters = {
  date: "today",
  days: 7,
  customDate: "",

  userType: "all",
  userId: "all",

  event: "all",
  source: "all",

  page: "all",

  search: "",

  excludeGuests: false,
  excludeUsers: false,
  excludeUserId: "none",
  excludeEvent: "none",
  excludeSource: "none",
};

export default function Logs() {
  const [logs, setLogs] = useState([]);
  const [userMap, setUserMap] = useState({});

  const [filters, setFilters] =
    useState(defaultFilters);

  const [sortBy, setSortBy] =
    useState("newest");

  const [showAdvanced, setShowAdvanced] =
    useState(false);

  //////////////////////////////////////////////////
  // LOAD USERS
  //////////////////////////////////////////////////

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const snap = await getDocs(
          collection(db, "users")
        );

        const map = {};

        snap.docs.forEach((doc) => {
          const data = doc.data();

          map[doc.id] =
            data.name ||
            data.fullName ||
            data.email ||
            doc.id;
        });

        setUserMap(map);
      } catch (error) {
        console.error(
          "Could not load users:",
          error
        );
      }
    };

    fetchUsers();
  }, []);

  //////////////////////////////////////////////////
  // LOAD LOGS
  //////////////////////////////////////////////////

  useEffect(() => {
    return onSnapshot(
      collection(db, "logs"),
      (snapshot) => {
        const data = snapshot.docs.map(
          (doc) => ({
            id: doc.id,
            ...doc.data(),
          })
        );

        setLogs(data);
      }
    );
  }, []);

  //////////////////////////////////////////////////
  // HELPERS
  //////////////////////////////////////////////////

  const formatTime = (ts) => {
    if (!ts?.seconds) return "—";

    return new Date(
      ts.seconds * 1000
    ).toLocaleString();
  };

  const getUserName = (log) => {
    if (log.fullName) {
      return log.fullName;
    }

    if (
      log.userId &&
      userMap[log.userId]
    ) {
      return userMap[log.userId];
    }

    if (log.email) {
      return log.email;
    }

    return "Guest";
  };

  const isGuest = (log) => {
    return !log.userId && !log.email;
  };

  const getDate = (log) => {
    if (!log.createdAt?.seconds) {
      return null;
    }

    return new Date(
      log.createdAt.seconds * 1000
    );
  };

  //////////////////////////////////////////////////
  // AVAILABLE FILTER OPTIONS
  //////////////////////////////////////////////////

  const eventOptions = useMemo(() => {
    return [
      ...new Set(
        logs
          .map((log) => log.event)
          .filter(Boolean)
      ),
    ].sort();
  }, [logs]);

  const sourceOptions = useMemo(() => {
    return [
      ...new Set(
        logs
          .map(
            (log) =>
              log.latestTrafficSource ||
              log.firstTrafficSource
          )
          .filter(Boolean)
      ),
    ].sort();
  }, [logs]);

  const pageOptions = useMemo(() => {
    return [
      ...new Set(
        logs
          .map((log) => log.page)
          .filter(Boolean)
      ),
    ].sort();
  }, [logs]);

  const userOptions = useMemo(() => {
    const ids = [
      ...new Set(
        logs
          .map((log) => log.userId)
          .filter(Boolean)
      ),
    ];

    return ids
      .map((id) => ({
        id,
        name:
          userMap[id] ||
          id,
      }))
      .sort((a, b) =>
        a.name.localeCompare(b.name)
      );
  }, [logs, userMap]);

  //////////////////////////////////////////////////
  // FILTERING
  //////////////////////////////////////////////////

  const filteredLogs = useMemo(() => {
    const now = new Date();

    const result = logs.filter((log) => {
      const date = getDate(log);

      //////////////////////////////////////////////////
      // DATE
      //////////////////////////////////////////////////

      if (filters.date !== "all") {
        if (!date) return false;

        if (filters.date === "today") {
          if (
            date.toDateString() !==
            now.toDateString()
          ) {
            return false;
          }
        }

        if (filters.date === "yesterday") {
          const yesterday = new Date();

          yesterday.setDate(
            yesterday.getDate() - 1
          );

          if (
            date.toDateString() !==
            yesterday.toDateString()
          ) {
            return false;
          }
        }

        if (filters.date === "lastX") {
          const past = new Date();

          past.setDate(
            past.getDate() -
              Number(filters.days || 7)
          );

          if (date < past) {
            return false;
          }
        }

        if (
          filters.date === "custom" &&
          filters.customDate
        ) {
          const selected =
            new Date(filters.customDate);

          if (
            date.toDateString() !==
            selected.toDateString()
          ) {
            return false;
          }
        }
      }

      //////////////////////////////////////////////////
      // USER TYPE
      //////////////////////////////////////////////////

      if (
        filters.userType ===
        "registered" &&
        isGuest(log)
      ) {
        return false;
      }

      if (
        filters.userType === "guest" &&
        !isGuest(log)
      ) {
        return false;
      }

      //////////////////////////////////////////////////
      // EXCLUDE GUESTS
      //////////////////////////////////////////////////

      if (
        filters.excludeGuests &&
        isGuest(log)
      ) {
        return false;
      }

      //////////////////////////////////////////////////
      // EXCLUDE REGISTERED USERS
      //////////////////////////////////////////////////

      if (
        filters.excludeUsers &&
        !isGuest(log)
      ) {
        return false;
      }

      //////////////////////////////////////////////////
      // USER
      //////////////////////////////////////////////////

      if (
        filters.userId !== "all" &&
        log.userId !== filters.userId
      ) {
        return false;
      }

      //////////////////////////////////////////////////
      // EXCLUDE SPECIFIC USER
      //////////////////////////////////////////////////

      if (
        filters.excludeUserId !==
          "none" &&
        log.userId ===
          filters.excludeUserId
      ) {
        return false;
      }

      //////////////////////////////////////////////////
      // EVENT
      //////////////////////////////////////////////////

      if (
        filters.event !== "all" &&
        log.event !== filters.event
      ) {
        return false;
      }

      //////////////////////////////////////////////////
      // EXCLUDE EVENT
      //////////////////////////////////////////////////

      if (
        filters.excludeEvent !==
          "none" &&
        log.event ===
          filters.excludeEvent
      ) {
        return false;
      }

      //////////////////////////////////////////////////
      // TRAFFIC SOURCE
      //////////////////////////////////////////////////

      const source =
        log.latestTrafficSource ||
        log.firstTrafficSource ||
        null;

      if (
        filters.source !== "all" &&
        source !== filters.source
      ) {
        return false;
      }

      //////////////////////////////////////////////////
      // EXCLUDE SOURCE
      //////////////////////////////////////////////////

      if (
        filters.excludeSource !==
          "none" &&
        source === filters.excludeSource
      ) {
        return false;
      }

      //////////////////////////////////////////////////
      // PAGE
      //////////////////////////////////////////////////

      if (
        filters.page !== "all" &&
        log.page !== filters.page
      ) {
        return false;
      }

      //////////////////////////////////////////////////
      // SEARCH
      //////////////////////////////////////////////////

      if (filters.search.trim()) {
        const search =
          filters.search
            .trim()
            .toLowerCase();

        const searchable = [
          log.event,
          log.userId,
          log.fullName,
          log.email,
          log.page,
          log.sessionId,
          log.visitorId,
          source,
          log.latestTrafficMedium,
          log.latestTrafficCampaign,
          log.firstTrafficSource,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (
          !searchable.includes(search)
        ) {
          return false;
        }
      }

      return true;
    });

    //////////////////////////////////////////////////
    // SORT
    //////////////////////////////////////////////////

    result.sort((a, b) => {
      const aDate =
        a.createdAt?.seconds || 0;

      const bDate =
        b.createdAt?.seconds || 0;

      const aUser =
        getUserName(a).toLowerCase();

      const bUser =
        getUserName(b).toLowerCase();

      switch (sortBy) {
        case "oldest":
          return aDate - bDate;

        case "userAsc":
          return aUser.localeCompare(
            bUser
          );

        case "userDesc":
          return bUser.localeCompare(
            aUser
          );

        case "eventAsc":
          return (
            (a.event || "").localeCompare(
              b.event || ""
            )
          );

        case "eventDesc":
          return (
            (b.event || "").localeCompare(
              a.event || ""
            )
          );

        case "newest":
        default:
          return bDate - aDate;
      }
    });

    return result;
  }, [
    logs,
    filters,
    sortBy,
    userMap,
  ]);

  //////////////////////////////////////////////////
  // UPDATE FILTER
  //////////////////////////////////////////////////

  const updateFilter = (
    key,
    value
  ) => {
    setFilters((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  //////////////////////////////////////////////////
  // RESET
  //////////////////////////////////////////////////

  const resetFilters = () => {
    setFilters(defaultFilters);
    setSortBy("newest");
  };

  //////////////////////////////////////////////////
  // RENDER
  //////////////////////////////////////////////////

  return (
    <div style={page}>
      {/* HEADER */}

      <div style={pageHeader}>
        <div>
          <h1 style={pageTitle}>
            Activity Logs
          </h1>

          <p style={pageSubtitle}>
            Showing{" "}
            <strong>
              {filteredLogs.length}
            </strong>{" "}
            of {logs.length} events
          </p>
        </div>

        <button
          onClick={() =>
            setShowAdvanced(
              !showAdvanced
            )
          }
          style={
            showAdvanced
              ? {
                  ...advancedButton,
                  ...advancedButtonActive,
                }
              : advancedButton
          }
        >
          ⚙ Filters
        </button>
      </div>

      {/* SEARCH */}

      <div style={searchBox}>
        <span style={searchIcon}>
          🔎
        </span>

        <input
          value={filters.search}
          onChange={(e) =>
            updateFilter(
              "search",
              e.target.value
            )
          }
          placeholder="Search logs, users, email, event, page, session ID..."
          style={searchInput}
        />

        {filters.search && (
          <button
            onClick={() =>
              updateFilter(
                "search",
                ""
              )
            }
            style={clearSearch}
          >
            ×
          </button>
        )}
      </div>

      {/* BASIC FILTERS */}

      <div style={filterBar}>
        <div style={filterGroup}>
          <FilterLabel>
            Date
          </FilterLabel>

          <select
            value={filters.date}
            onChange={(e) =>
              updateFilter(
                "date",
                e.target.value
              )
            }
            style={select}
          >
            <option value="today">
              Today
            </option>

            <option value="yesterday">
              Yesterday
            </option>

            <option value="lastX">
              Last X days
            </option>

            <option value="custom">
              Specific date
            </option>

            <option value="all">
              All time
            </option>
          </select>

          {filters.date ===
            "lastX" && (
            <input
              type="number"
              min="1"
              value={filters.days}
              onChange={(e) =>
                updateFilter(
                  "days",
                  e.target.value
                )
              }
              style={smallInput}
              title="Number of days"
            />
          )}

          {filters.date ===
            "custom" && (
            <input
              type="date"
              value={
                filters.customDate
              }
              onChange={(e) =>
                updateFilter(
                  "customDate",
                  e.target.value
                )
              }
              style={select}
            />
          )}
        </div>

        <div style={filterGroup}>
          <FilterLabel>
            User
          </FilterLabel>

          <select
            value={filters.userId}
            onChange={(e) =>
              updateFilter(
                "userId",
                e.target.value
              )
            }
            style={select}
          >
            <option value="all">
              All users
            </option>

            <option value="guest">
              Guests
            </option>

            {userOptions.map(
              (user) => (
                <option
                  key={user.id}
                  value={user.id}
                >
                  {user.name}
                </option>
              )
            )}
          </select>
        </div>

        <div style={filterGroup}>
          <FilterLabel>
            Event
          </FilterLabel>

          <select
            value={filters.event}
            onChange={(e) =>
              updateFilter(
                "event",
                e.target.value
              )
            }
            style={select}
          >
            <option value="all">
              All events
            </option>

            {eventOptions.map(
              (event) => (
                <option
                  key={event}
                  value={event}
                >
                  {event}
                </option>
              )
            )}
          </select>
        </div>

        <div style={filterGroup}>
          <FilterLabel>
            Source
          </FilterLabel>

          <select
            value={filters.source}
            onChange={(e) =>
              updateFilter(
                "source",
                e.target.value
              )
            }
            style={select}
          >
            <option value="all">
              All sources
            </option>

            <option value="__direct__">
              Direct
            </option>

            {sourceOptions.map(
              (source) => (
                <option
                  key={source}
                  value={source}
                >
                  {source}
                </option>
              )
            )}
          </select>
        </div>

        <div style={filterGroup}>
          <FilterLabel>
            Page
          </FilterLabel>

          <select
            value={filters.page}
            onChange={(e) =>
              updateFilter(
                "page",
                e.target.value
              )
            }
            style={select}
          >
            <option value="all">
              All pages
            </option>

            {pageOptions.map(
              (page) => (
                <option
                  key={page}
                  value={page}
                >
                  {page}
                </option>
              )
            )}
          </select>
        </div>

        <div style={filterGroup}>
          <FilterLabel>
            Sort
          </FilterLabel>

          <select
            value={sortBy}
            onChange={(e) =>
              setSortBy(
                e.target.value
              )
            }
            style={select}
          >
            <option value="newest">
              Newest first
            </option>

            <option value="oldest">
              Oldest first
            </option>

            <option value="userAsc">
              User A–Z
            </option>

            <option value="userDesc">
              User Z–A
            </option>

            <option value="eventAsc">
              Event A–Z
            </option>

            <option value="eventDesc">
              Event Z–A
            </option>
          </select>
        </div>

        <button
          onClick={resetFilters}
          style={resetButton}
        >
          Reset
        </button>
      </div>

      {/* ADVANCED FILTERS */}

      {showAdvanced && (
        <div style={advancedPanel}>
          <div style={advancedHeader}>
            <div>
              <h2 style={advancedTitle}>
                Advanced Filters
              </h2>

              <p style={advancedSubtitle}>
                Combine these filters to
                narrow down exactly what
                you're looking for.
              </p>
            </div>
          </div>

          <div style={advancedGrid}>
            {/* USER TYPE */}

            <div style={advancedField}>
              <FilterLabel>
                User Type
              </FilterLabel>

              <select
                value={
                  filters.userType
                }
                onChange={(e) =>
                  updateFilter(
                    "userType",
                    e.target.value
                  )
                }
                style={select}
              >
                <option value="all">
                  Everyone
                </option>

                <option value="registered">
                  Registered users
                </option>

                <option value="guest">
                  Guests only
                </option>
              </select>
            </div>

            {/* EXCLUDE GUESTS */}

            <label style={checkboxLabel}>
              <input
                type="checkbox"
                checked={
                  filters.excludeGuests
                }
                onChange={(e) =>
                  updateFilter(
                    "excludeGuests",
                    e.target.checked
                  )
                }
              />

              <span>
                Exclude guests
              </span>
            </label>

            {/* EXCLUDE USERS */}

            <label style={checkboxLabel}>
              <input
                type="checkbox"
                checked={
                  filters.excludeUsers
                }
                onChange={(e) =>
                  updateFilter(
                    "excludeUsers",
                    e.target.checked
                  )
                }
              />

              <span>
                Exclude registered users
              </span>
            </label>

            {/* EXCLUDE SPECIFIC USER */}

            <div style={advancedField}>
              <FilterLabel>
                Exclude User
              </FilterLabel>

              <select
                value={
                  filters.excludeUserId
                }
                onChange={(e) =>
                  updateFilter(
                    "excludeUserId",
                    e.target.value
                  )
                }
                style={select}
              >
                <option value="none">
                  Don't exclude a user
                </option>

                {userOptions.map(
                  (user) => (
                    <option
                      key={user.id}
                      value={user.id}
                    >
                      {user.name}
                    </option>
                  )
                )}
              </select>
            </div>

            {/* EXCLUDE EVENT */}

            <div style={advancedField}>
              <FilterLabel>
                Exclude Event
              </FilterLabel>

              <select
                value={
                  filters.excludeEvent
                }
                onChange={(e) =>
                  updateFilter(
                    "excludeEvent",
                    e.target.value
                  )
                }
                style={select}
              >
                <option value="none">
                  Don't exclude an event
                </option>

                {eventOptions.map(
                  (event) => (
                    <option
                      key={event}
                      value={event}
                    >
                      {event}
                    </option>
                  )
                )}
              </select>
            </div>

            {/* EXCLUDE SOURCE */}

            <div style={advancedField}>
              <FilterLabel>
                Exclude Source
              </FilterLabel>

              <select
                value={
                  filters.excludeSource
                }
                onChange={(e) =>
                  updateFilter(
                    "excludeSource",
                    e.target.value
                  )
                }
                style={select}
              >
                <option value="none">
                  Don't exclude a source
                </option>

                {sourceOptions.map(
                  (source) => (
                    <option
                      key={source}
                      value={source}
                    >
                      {source}
                    </option>
                  )
                )}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ACTIVE FILTER SUMMARY */}

      <div style={summaryBar}>
        <span>
          Showing{" "}
          <strong>
            {filteredLogs.length}
          </strong>{" "}
          events
        </span>

        {filters.userId !==
          "all" && (
          <FilterChip
            label={`User: ${
              filters.userId ===
              "guest"
                ? "Guests"
                : userMap[
                    filters.userId
                  ] ||
                  filters.userId
            }`}
            onRemove={() =>
              updateFilter(
                "userId",
                "all"
              )
            }
          />
        )}

        {filters.event !==
          "all" && (
          <FilterChip
            label={`Event: ${filters.event}`}
            onRemove={() =>
              updateFilter(
                "event",
                "all"
              )
            }
          />
        )}

        {filters.source !==
          "all" && (
          <FilterChip
            label={`Source: ${filters.source}`}
            onRemove={() =>
              updateFilter(
                "source",
                "all"
              )
            }
          />
        )}

        {filters.page !==
          "all" && (
          <FilterChip
            label={`Page: ${filters.page}`}
            onRemove={() =>
              updateFilter(
                "page",
                "all"
              )
            }
          />
        )}

        {filters.excludeGuests && (
          <FilterChip
            label="Excluding guests"
            onRemove={() =>
              updateFilter(
                "excludeGuests",
                false
              )
            }
          />
        )}

        {filters.excludeUsers && (
          <FilterChip
            label="Excluding users"
            onRemove={() =>
              updateFilter(
                "excludeUsers",
                false
              )
            }
          />
        )}
      </div>

      {/* LOG LIST */}

      <div style={list}>
        {filteredLogs.map(
          (log) => {
            const {
              bg,
              color,
            } = eventStyle(
              log.event
            );

            const detail =
              log.page ||
              log.mode ||
              log.message ||
              null;

            const source =
              log.latestTrafficSource ||
              log.firstTrafficSource;

            return (
              <div
                key={log.id}
                style={row}
              >
                <div
                  style={rowLeft}
                >
                  <div
                    style={eventLine}
                  >
                    <span
                      style={{
                        ...eventBadge,
                        background:
                          bg,
                        color,
                      }}
                    >
                      {log.event}
                    </span>

                    {source && (
                      <span
                        style={
                          sourceBadge
                        }
                      >
                        {source}
                      </span>
                    )}

                    {isGuest(log) && (
                      <span
                        style={
                          guestBadge
                        }
                      >
                        Guest
                      </span>
                    )}
                  </div>

                  <div
                    style={metaRow}
                  >
                    <span
                      style={
                        metaUser
                      }
                    >
                      👤{" "}
                      {getUserName(
                        log
                      )}
                    </span>

                    <span
                      style={
                        metaDot
                      }
                    >
                      ·
                    </span>

                    <span
                      style={
                        metaTime
                      }
                    >
                      {formatTime(
                        log.createdAt
                      )}
                    </span>
                  </div>
                </div>

                <div
                  style={
                    rowRight
                  }
                >
                  {detail && (
                    <div>
                      {detail}
                    </div>
                  )}

                  {log.sessionId && (
                    <div
                      style={
                        sessionText
                      }
                    >
                      Session:{" "}
                      {log.sessionId.slice(
                        0,
                        12
                      )}
                      ...
                    </div>
                  )}
                </div>
              </div>
            );
          }
        )}

        {filteredLogs.length ===
          0 && (
          <div
            style={
              emptyState
            }
          >
            <span
              style={
                emptyIcon
              }
            >
              🔍
            </span>

            <p
              style={
                emptyText
              }
            >
              No logs match
              your current
              filters.
            </p>

            <button
              onClick={
                resetFilters
              }
              style={
                resetButton
              }
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function FilterLabel({
  children,
}) {
  return (
    <label style={filterLabel}>
      {children}
    </label>
  );
}

function FilterChip({
  label,
  onRemove,
}) {
  return (
    <div style={filterChip}>
      <span>{label}</span>

      <button
        onClick={onRemove}
        style={chipButton}
      >
        ×
      </button>
    </div>
  );
}

/* ───────────────────────────── */
/* STYLES */
/* ───────────────────────────── */

const page = {
  maxWidth: "1100px",
};

const pageHeader = {
  display: "flex",
  justifyContent:
    "space-between",
  alignItems: "center",
  gap: "20px",
  marginBottom: "20px",
  flexWrap: "wrap",
};

const pageTitle = {
  fontSize: "26px",
  fontWeight: "normal",
  color: "#3d2200",
  margin: "0 0 4px",
  fontFamily:
    "'Georgia', serif",
};

const pageSubtitle = {
  fontSize: "14px",
  color: "#9b7040",
  fontFamily:
    "sans-serif",
  margin: 0,
};

const searchBox = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  background: "#fffdf9",
  border:
    "1px solid #eddfc8",
  borderRadius: "12px",
  padding: "10px 14px",
  marginBottom: "12px",
};

const searchIcon = {
  fontSize: "15px",
};

const searchInput = {
  flex: 1,
  border: "none",
  outline: "none",
  background:
    "transparent",
  color: "#3d2200",
  fontFamily:
    "sans-serif",
  fontSize: "14px",
};

const clearSearch = {
  border: "none",
  background:
    "transparent",
  color: "#9b7040",
  fontSize: "20px",
  cursor: "pointer",
};

const filterBar = {
  display: "flex",
  gap: "12px",
  alignItems:
    "flex-end",
  marginBottom: "12px",
  flexWrap: "wrap",
  background: "#fffdf9",
  border:
    "1px solid #eddfc8",
  borderRadius: "14px",
  padding: "14px 16px",
};

const filterGroup = {
  display: "flex",
  flexDirection:
    "column",
  gap: "5px",
};

const filterLabel = {
  fontSize: "11px",
  color: "#9b7040",
  fontFamily:
    "sans-serif",
  textTransform:
    "uppercase",
  letterSpacing:
    "0.04em",
};

const select = {
  padding: "8px 10px",
  borderRadius: "8px",
  border:
    "1px solid #eddfc8",
  background: "#fdf8f3",
  fontSize: "13px",
  fontFamily:
    "sans-serif",
  color: "#3d2200",
  outline: "none",
  minWidth: "130px",
};

const smallInput = {
  ...select,
  minWidth: "70px",
  width: "70px",
};

const advancedButton = {
  padding: "9px 15px",
  borderRadius: "9px",
  border:
    "1px solid #eddfc8",
  background: "#fffdf9",
  color: "#7a4f10",
  cursor: "pointer",
  fontFamily:
    "sans-serif",
};

const advancedButtonActive = {
  background:
    "linear-gradient(135deg, #c97c2e, #a85e18)",
  color: "#fff8ee",
  borderColor:
    "transparent",
};

const advancedPanel = {
  background: "#fffdf9",
  border:
    "1px solid #eddfc8",
  borderRadius: "14px",
  padding: "18px",
  marginBottom: "12px",
};

const advancedHeader = {
  marginBottom: "15px",
};

const advancedTitle = {
  margin: 0,
  color: "#3d2200",
  fontFamily:
    "'Georgia', serif",
  fontSize: "19px",
};

const advancedSubtitle = {
  margin: "4px 0 0",
  color: "#9b7040",
  fontSize: "12px",
  fontFamily:
    "sans-serif",
};

const advancedGrid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(200px, 1fr))",
  gap: "15px",
  alignItems: "end",
};

const advancedField = {
  display: "flex",
  flexDirection:
    "column",
  gap: "5px",
};

const checkboxLabel = {
  display: "flex",
  alignItems:
    "center",
  gap: "8px",
  minHeight: "36px",
  fontSize: "13px",
  color: "#5c3a1e",
  fontFamily:
    "sans-serif",
  cursor: "pointer",
};

const resetButton = {
  padding: "8px 13px",
  borderRadius: "8px",
  border:
    "1px solid #eddfc8",
  background: "#f8eee3",
  color: "#7a4f10",
  cursor: "pointer",
  fontFamily:
    "sans-serif",
};

const summaryBar = {
  display: "flex",
  alignItems:
    "center",
  gap: "7px",
  flexWrap: "wrap",
  marginBottom: "12px",
  fontSize: "12px",
  color: "#9b7040",
  fontFamily:
    "sans-serif",
};

const filterChip = {
  display: "flex",
  alignItems:
    "center",
  gap: "5px",
  background: "#f4e7d4",
  color: "#7a4f10",
  borderRadius:
    "999px",
  padding: "4px 8px 4px 10px",
};

const chipButton = {
  border: "none",
  background:
    "transparent",
  color: "#7a4f10",
  cursor: "pointer",
  fontSize: "15px",
  padding: 0,
  lineHeight: 1,
};

const list = {
  display: "flex",
  flexDirection:
    "column",
  gap: "8px",
};

const row = {
  display: "flex",
  justifyContent:
    "space-between",
  alignItems:
    "center",
  background: "#fffdf9",
  border:
    "1px solid #eddfc8",
  borderRadius: "12px",
  padding: "12px 16px",
  gap: "12px",
  flexWrap: "wrap",
};

const rowLeft = {
  display: "flex",
  flexDirection:
    "column",
  gap: "6px",
};

const rowRight = {
  fontSize: "12px",
  fontFamily:
    "sans-serif",
  color: "#9b7040",
  textAlign: "right",
  maxWidth: "280px",
  wordBreak:
    "break-word",
};

const eventLine = {
  display: "flex",
  alignItems:
    "center",
  gap: "6px",
  flexWrap: "wrap",
};

const eventBadge = {
  display: "inline-block",
  fontSize: "11px",
  padding:
    "3px 10px",
  borderRadius:
    "999px",
  fontFamily:
    "sans-serif",
  letterSpacing:
    "0.03em",
  fontWeight: "500",
};

const sourceBadge = {
  display: "inline-block",
  fontSize: "10px",
  padding:
    "3px 8px",
  borderRadius:
    "999px",
  background: "#e8f0e4",
  color: "#49653c",
  fontFamily:
    "sans-serif",
};

const guestBadge = {
  display: "inline-block",
  fontSize: "10px",
  padding:
    "3px 8px",
  borderRadius:
    "999px",
  background: "#f1e7dc",
  color: "#87684b",
  fontFamily:
    "sans-serif",
};

const metaRow = {
  display: "flex",
  alignItems:
    "center",
  gap: "6px",
};

const metaUser = {
  fontSize: "12px",
  fontFamily:
    "sans-serif",
  color: "#5c3a1e",
};

const metaDot = {
  fontSize: "12px",
  color: "#c8a87a",
};

const metaTime = {
  fontSize: "12px",
  fontFamily:
    "sans-serif",
  color: "#9b7040",
};

const sessionText = {
  marginTop: "4px",
  fontSize: "10px",
  fontFamily:
    "monospace",
  color: "#b9966a",
};

const emptyState = {
  textAlign: "center",
  padding: "50px 20px",
};

const emptyIcon = {
  fontSize: "36px",
  display: "block",
  marginBottom: "10px",
};

const emptyText = {
  color: "#b08050",
  fontFamily:
    "sans-serif",
  fontStyle:
    "italic",
  margin: 0,
};