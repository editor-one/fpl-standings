// ==============================================
// Live FPL League Tracker - Your League (599995)
// Shows live points, captain, vice, and active chip
// ==============================================

const LEAGUE_ID = 599995;
const CORS_PROXY = "https://corsproxy.io/?";
const FPL_BASE = CORS_PROXY + "https://fantasy.premierleague.com/api/";


const statusEl = document.getElementById("status");
const tableBody = document.getElementById("tableBody");

let currentEvent = null;

// Fetch current gameweek ID
async function getCurrentEvent() {
  const res = await fetch(`${FPL_BASE}bootstrap-static/`);
  const data = await res.json();
  const event = data.events.find((e) => e.is_current);
  return event.id;
}

// Fetch league standings
async function fetchLeagueStandings() {
  const res = await fetch(`${FPL_BASE}leagues-classic/${LEAGUE_ID}/standings/`);
  if (!res.ok) throw new Error("League not found");
  const data = await res.json();
  return data.standings.results;
}

// Fetch live player data
async function fetchLivePlayerData(eventId) {
  const res = await fetch(`${FPL_BASE}event/${eventId}/live/`);
  if (!res.ok) throw new Error("Failed to fetch live player data");
  const data = await res.json();
  const players = {};
  data.elements.forEach((p) => (players[p.id] = p.stats.total_points));
  return players;
}

// Fetch a team's picks and chip usage
async function fetchTeamPicks(entryId, eventId) {
  const res = await fetch(`${FPL_BASE}entry/${entryId}/event/${eventId}/picks/`);
  if (!res.ok) throw new Error("Failed to fetch team picks");
  const data = await res.json();
  return {
    picks: data.picks,
    active_chip: data.active_chip,
  };
}

// Fetch player names for captain display
async function getPlayerNames() {
  const res = await fetch(`${FPL_BASE}bootstrap-static/`);
  const data = await res.json();
  const players = {};
  data.elements.forEach((p) => {
    players[p.id] = `${p.web_name}`;
  });
  return players;
}

// Calculate live points
function calculateLivePoints(picks, livePlayers) {
  let total = 0;
  picks.forEach((pick) => {
    const playerPoints = livePlayers[pick.element] || 0;
    total += playerPoints * pick.multiplier;
  });
  return total;
}

// Fetch all data and render the league
async function updateLeagueLive() {
  try {
    statusEl.textContent = "Fetching live data...";
    tableBody.innerHTML = "";

    if (!currentEvent) currentEvent = await getCurrentEvent();

    const [entries, livePlayers, playerNames] = await Promise.all([
      fetchLeagueStandings(),
      fetchLivePlayerData(currentEvent),
      getPlayerNames(),
    ]);

    const teamsWithLive = await Promise.all(
      entries.map(async (entry) => {
        try {
          const { picks, active_chip } = await fetchTeamPicks(entry.entry, currentEvent);
          const livePoints = calculateLivePoints(picks, livePlayers);

          const captain = picks.find((p) => p.is_captain);
          const vice = picks.find((p) => p.is_vice_captain);

          return {
            ...entry,
            livePoints,
            combined: entry.total + livePoints,
            active_chip: active_chip || "-",
            captain: captain ? playerNames[captain.element] : "N/A",
            vice: vice ? playerNames[vice.element] : "N/A",
          };
        } catch {
          return { ...entry, livePoints: 0, combined: entry.total, active_chip: "-", captain: "-", vice: "-" };
        }
      })
    );

    // Sort by live combined total
    teamsWithLive.sort((a, b) => b.combined - a.combined);

    // Render table
    tableBody.innerHTML = "";
    teamsWithLive.forEach((team, index) => {
      const tr = document.createElement("tr");
      if (index === 0) tr.classList.add("highlight");
      tr.innerHTML = `
        <td>${index + 1}</td>
        <td>${team.entry_name}</td>
        <td>${team.player_name}</td>
        <td>${team.captain} <span class="vice">(VC: ${team.vice})</span></td>
        <td>${team.active_chip}</td>
        <td>${team.total}</td>
        <td>${team.livePoints}</td>
        <td>${team.combined}</td>
      `;
      tableBody.appendChild(tr);
    });

    statusEl.textContent =
      "Live updated: " + new Date().toLocaleTimeString() + " (auto-refresh every 60s)";
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Error: " + err.message;
  }
}

// First load
updateLeagueLive();

// Auto-refresh every 60s
setInterval(updateLeagueLive, 60000);
