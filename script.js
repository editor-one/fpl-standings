// =======================================
// Live FPL League + Live, Upcoming & Finished Matches (Optimized + Fixed Live)
// =======================================

const LEAGUE_ID = 599995;
const CORS_PROXY = "https://corsproxy.io/?";
const FPL_BASE = CORS_PROXY + "https://fantasy.premierleague.com/api/";

const statusEl = document.getElementById("status");
const tableBody = document.getElementById("tableBody");
const matchesContainer = document.getElementById("matchesContainer");

let currentEvent = null;

// ------------------ FPL Functions ------------------

async function getCurrentEvent() {
  const res = await fetch(`${FPL_BASE}bootstrap-static/`);
  const data = await res.json();
  const event = data.events.find(e => e.is_current);
  return event.id;
}

async function fetchLeagueStandings() {
  const res = await fetch(`${FPL_BASE}leagues-classic/${LEAGUE_ID}/standings/`);
  const data = await res.json();
  return data.standings.results;
}

async function fetchLivePlayerData(eventId) {
  const res = await fetch(`${FPL_BASE}event/${eventId}/live/`);
  const data = await res.json();
  const players = {};
  data.elements.forEach(p => players[p.id] = p.stats.total_points);
  return players;
}

async function fetchTeamPicks(entryId, eventId) {
  const res = await fetch(`${FPL_BASE}entry/${entryId}/event/${eventId}/picks/`);
  const data = await res.json();
  return {
    picks: data.picks,
    active_chip: data.active_chip
  };
}

async function getPlayerNames() {
  const res = await fetch(`${FPL_BASE}bootstrap-static/`);
  const data = await res.json();
  const players = {};
  data.elements.forEach(p => players[p.id] = p.web_name);
  return players;
}

function calculateLivePoints(picks, livePlayers) {
  return picks.reduce((total, pick) => total + (livePlayers[pick.element] || 0) * pick.multiplier, 0);
}

// ------------------ League Table Update ------------------

async function updateLeagueLive() {
  try {
    statusEl.textContent = "Fetching live league data...";
    tableBody.innerHTML = "";

    if (!currentEvent) currentEvent = await getCurrentEvent();

    const [entries, livePlayers, playerNames] = await Promise.all([
      fetchLeagueStandings(),
      fetchLivePlayerData(currentEvent),
      getPlayerNames()
    ]);

    const teamsWithLive = await Promise.all(
      entries.map(async entry => {
        try {
          const { picks, active_chip } = await fetchTeamPicks(entry.entry, currentEvent);
          const livePoints = calculateLivePoints(picks, livePlayers);
          const captain = picks.find(p => p.is_captain);
          const vice = picks.find(p => p.is_vice_captain);
          return {
            ...entry,
            livePoints,
            combined: entry.total + livePoints,
            active_chip: active_chip || "-",
            captain: captain ? playerNames[captain.element] : "N/A",
            vice: vice ? playerNames[vice.element] : "N/A",
            picks
          };
        } catch {
          return { ...entry, livePoints: 0, combined: entry.total, active_chip: "-", captain: "-", vice: "-", picks: [] };
        }
      })
    );

    teamsWithLive.sort((a, b) => b.combined - a.combined);

    // Use DocumentFragment for smoother DOM updates
    const fragment = document.createDocumentFragment();
    teamsWithLive.forEach((team, index) => {
      const tr = document.createElement("tr");
      if (index === 0) tr.classList.add("highlight");

      tr.innerHTML = `
        <td>${index + 1}</td>
        <td class="team-info">
          <span class="team-name">${team.entry_name}</span>
          <span class="captain">Captain: ${team.captain} (VC: ${team.vice})</span>
          <span class="chip">Chip: ${team.active_chip}</span>
        </td>
        <td>${team.player_name}</td>
        <td>${team.total}</td>
        <td>${team.livePoints}</td>
        <td>${team.combined}</td>
      `;
      fragment.appendChild(tr);
    });
    tableBody.appendChild(fragment);

    statusEl.textContent = "Live updated: " + new Date().toLocaleTimeString();

    // Update sidebar matches
    fetchAllMatchesFixed();

  } catch(err) {
    console.error(err);
    statusEl.textContent = "Error loading FPL data";
  }
}

// ------------------ Football-Data.org Matches (Optimized + Fixed) ------------------

const FOOTBALL_DATA_KEY = "6f318b8cabd54623a94b54c4f6eea73a";
const FOOTBALL_DATA_BASE = "https://api.football-data.org/v4";

async function fetchAllMatchesFixed() {
  try {
    matchesContainer.innerHTML = "";

    const statuses = ["LIVE", "SCHEDULED", "FINISHED"];
    const allMatches = {};

    // Fetch each status in parallel
    await Promise.all(statuses.map(async status => {
      const res = await fetch(`https://corsproxy.io/?${FOOTBALL_DATA_BASE}/matches?competitions=PL&status=${status}`, {
        headers: { "X-Auth-Token": FOOTBALL_DATA_KEY }
      });
      const data = await res.json();
      allMatches[status] = data.matches || [];
    }));

    const fragment = document.createDocumentFragment();

    // --- Ongoing Matches ---
    if (allMatches["LIVE"].length > 0) {
      const liveHeading = document.createElement("h3");
      liveHeading.textContent = "Ongoing Matches";
      fragment.appendChild(liveHeading);

      allMatches["LIVE"].forEach(m => {
        const div = document.createElement("div");
        div.className = "match";
        const homeScore = m.score?.fullTime?.home ?? 0;
        const awayScore = m.score?.fullTime?.away ?? 0;

        div.innerHTML = `
          <div class="teams">${m.homeTeam.name} ${homeScore} - ${awayScore} ${m.awayTeam.name}</div>
          <div class="scoreline">Kick-off: ${new Date(m.utcDate).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
        `;
        fragment.appendChild(div);
      });
    }

    // --- Upcoming Matches ---
    if (allMatches["SCHEDULED"].length > 0) {
      const heading = document.createElement("h3");
      heading.textContent = "Upcoming Matches";
      fragment.appendChild(heading);

      allMatches["SCHEDULED"].forEach(m => {
        const div = document.createElement("div");
        div.className = "match";
        const utcDate = new Date(m.utcDate);
        div.innerHTML = `
          <div class="teams">${m.homeTeam.name} vs ${m.awayTeam.name}</div>
          <div class="scoreline">Kick-off: ${utcDate.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
        `;
        fragment.appendChild(div);
      });
    }

    // --- Finished Matches with Scorers ---
    if (allMatches["FINISHED"].length > 0) {
      const heading = document.createElement("h3");
      heading.textContent = "Finished Matches (Goal Scorers)";
      fragment.appendChild(heading);

      allMatches["FINISHED"].forEach(m => {
        const div = document.createElement("div");
        div.className = "match";
        const homeScore = m.score.fullTime.home ?? 0;
        const awayScore = m.score.fullTime.away ?? 0;

        const homeScorers = m.homeTeam.scorers?.join(", ") || "-";
        const awayScorers = m.awayTeam.scorers?.join(", ") || "-";

        div.innerHTML = `
          <div class="teams">${m.homeTeam.name} ${homeScore} - ${awayScore} ${m.awayTeam.name}</div>
          <div class="scorers">
            Home scorers: ${homeScorers}<br>
            Away scorers: ${awayScorers}
          </div>
        `;
        fragment.appendChild(div);
      });
    }

    matchesContainer.appendChild(fragment);

  } catch(err) {
    console.error(err);
    matchesContainer.innerHTML = `<p>Error loading matches: ${err.message}</p>`;
  }
}

// ------------------ Initial Load ------------------

(async () => {
  currentEvent = await getCurrentEvent();
  updateLeagueLive();
  setInterval(updateLeagueLive, 60000);
})();
