// =======================================
// Live FPL League + Live, Upcoming & Finished Matches
// =======================================

const LEAGUE_ID = 599995;
const CORS_PROXY = "https://corsproxy.io/?";  // optional for browser
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
  let total = 0;
  picks.forEach(pick => {
    total += (livePlayers[pick.element] || 0) * pick.multiplier;
  });
  return total;
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

    // Populate table with new Team Info column
    teamsWithLive.forEach((team, index) => {
      const tr = document.createElement("tr");
      if (index === 0) tr.classList.add("highlight");

      tr.innerHTML = `
        <td>${index + 1}</td>
        <td>
          <strong>${team.entry_name}</strong><br>
          <span class="captain">Captain: ${team.captain} (VC: ${team.vice})</span><br>
          <span class="chip">Chip: ${team.active_chip}</span>
        </td>
        <td>${team.player_name}</td>
        <td>${team.total}</td>
        <td>${team.livePoints}</td>
        <td>${team.combined}</td>
      `;
      tableBody.appendChild(tr);
    });

    statusEl.textContent = "Live updated: " + new Date().toLocaleTimeString();

    // Update sidebar with live, upcoming & finished matches
    fetchAllMatches();

  } catch (err) {
    console.error(err);
    statusEl.textContent = "Error loading FPL data";
  }
}

// ------------------ Football-Data.org Matches ------------------

const FOOTBALL_DATA_KEY = "6f318b8cabd54623a94b54c4f6eea73a";
const FOOTBALL_DATA_BASE = "https://api.football-data.org/v4";

async function fetchAllMatches() {
  try {
    matchesContainer.innerHTML = "";

    // 1️⃣ Live matches
    const liveRes = await fetch(`https://corsproxy.io/?${FOOTBALL_DATA_BASE}/matches?competitions=PL&status=LIVE`, {
      headers: { "X-Auth-Token": FOOTBALL_DATA_KEY }
    });
    const liveData = await liveRes.json();
    const liveMatches = liveData.matches || [];

    if (liveMatches.length > 0) {
      const liveHeading = document.createElement("h3");
      liveHeading.textContent = "Ongoing Matches";
      matchesContainer.appendChild(liveHeading);

      liveMatches.forEach(m => {
        const div = document.createElement("div");
        div.className = "match";
        const homeScore = m.score?.fullTime?.home ?? 0;
        const awayScore = m.score?.fullTime?.away ?? 0;

        div.innerHTML = `
          <div class="teams">${m.homeTeam.name} ${homeScore} - ${awayScore} ${m.awayTeam.name}</div>
          <div class="scoreline">Kick-off: ${new Date(m.utcDate).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
        `;
        matchesContainer.appendChild(div);
      });
    }

    // 2️⃣ Upcoming matches
    const upcomingRes = await fetch(`https://corsproxy.io/?${FOOTBALL_DATA_BASE}/matches?competitions=PL&status=SCHEDULED`, {
      headers: { "X-Auth-Token": FOOTBALL_DATA_KEY }
    });
    const upcomingData = await upcomingRes.json();
    const upcomingMatches = upcomingData.matches || [];

    if (upcomingMatches.length > 0) {
      const heading = document.createElement("h3");
      heading.textContent = "Upcoming Matches";
      matchesContainer.appendChild(heading);

      upcomingMatches.forEach(m => {
        const div = document.createElement("div");
        div.className = "match";
        const utcDate = new Date(m.utcDate);
        div.innerHTML = `
          <div class="teams">${m.homeTeam.name} vs ${m.awayTeam.name}</div>
          <div class="scoreline">Kick-off: ${utcDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
        `;
        matchesContainer.appendChild(div);
      });
    }

    // 3️⃣ Finished matches with scorers
    const finishedRes = await fetch(`https://corsproxy.io/?${FOOTBALL_DATA_BASE}/matches?competitions=PL&status=FINISHED`, {
      headers: { "X-Auth-Token": FOOTBALL_DATA_KEY }
    });
    const finishedData = await finishedRes.json();
    const finishedMatches = finishedData.matches || [];

    if (finishedMatches.length > 0) {
      const heading = document.createElement("h3");
      heading.textContent = "Finished Matches (Goal Scorers)";
      matchesContainer.appendChild(heading);

      finishedMatches.forEach(m => {
        const div = document.createElement("div");
        div.className = "match";

        const homeGoals = (m.goals || []).filter(g => g.team.id === m.homeTeam.id);
        const awayGoals = (m.goals || []).filter(g => g.team.id === m.awayTeam.id);

        div.innerHTML = `
          <div class="teams">${m.homeTeam.name} ${m.score.fullTime.home} - ${m.score.fullTime.away} ${m.awayTeam.name}</div>
          <div class="scorers">
            Home scorers: ${homeGoals.length ? homeGoals.map(g => g.scorer.name).join(", ") : "-"}<br>
            Away scorers: ${awayGoals.length ? awayGoals.map(g => g.scorer.name).join(", ") : "-"}
          </div>
        `;
        matchesContainer.appendChild(div);
      });
    }

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
