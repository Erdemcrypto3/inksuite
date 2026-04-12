// Runs during build to fetch FPL data and save as static JSON
// Avoids CORS issues since this runs server-side in Node.js

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'app', 'data');
const OUTPUT = join(DATA_DIR, 'fpl.json');
const BASE_URL = 'https://fantasy.premierleague.com/api';

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function main() {
  mkdirSync(DATA_DIR, { recursive: true });

  // 1. Fetch bootstrap (players + teams + events/gameweeks)
  console.log('Fetching FPL bootstrap...');
  const data = await fetchJSON(`${BASE_URL}/bootstrap-static/`);

  // Find current and recent completed gameweeks
  const events = data.events || [];
  const completedGWs = events.filter((e) => e.finished).map((e) => e.id);
  const currentGW = events.find((e) => e.is_current)?.id || completedGWs[completedGWs.length - 1] || 1;
  // Fetch last 5 completed gameweeks for points history
  const recentGWs = completedGWs.slice(-5);

  console.log(`Current GW: ${currentGW}, fetching live data for GWs: ${recentGWs.join(', ')}`);

  // 2. Fetch live points for recent gameweeks
  const liveData = {};
  for (const gw of recentGWs) {
    try {
      console.log(`  Fetching GW${gw} live data...`);
      const live = await fetchJSON(`${BASE_URL}/event/${gw}/live/`);
      // Slim down: only keep id + key stats + total_points
      liveData[gw] = {};
      for (const el of live.elements) {
        liveData[gw][el.id] = {
          minutes: el.stats.minutes,
          goals_scored: el.stats.goals_scored,
          assists: el.stats.assists,
          clean_sheets: el.stats.clean_sheets,
          goals_conceded: el.stats.goals_conceded,
          yellow_cards: el.stats.yellow_cards,
          red_cards: el.stats.red_cards,
          saves: el.stats.saves,
          bonus: el.stats.bonus,
          total_points: el.stats.total_points,
          in_dreamteam: el.stats.in_dreamteam,
        };
      }
    } catch (e) {
      console.warn(`  Failed to fetch GW${gw}: ${e.message}`);
    }
  }

  // 3. Fetch fixtures
  console.log('Fetching fixtures...');
  let fixtures = [];
  try {
    const fixturesRaw = await fetchJSON(`${BASE_URL}/fixtures/`);
    fixtures = fixturesRaw.map((f) => ({
      id: f.id,
      event: f.event,
      home: f.team_h,
      away: f.team_a,
      home_score: f.team_h_score,
      away_score: f.team_a_score,
      finished: f.finished,
      kickoff: f.kickoff_time,
    }));
  } catch (e) {
    console.warn(`  Failed to fetch fixtures: ${e.message}`);
  }

  // 4. Build slim output
  const slim = {
    teams: data.teams.map((t) => ({
      id: t.id,
      name: t.name,
      short_name: t.short_name,
    })),
    elements: data.elements.map((p) => ({
      id: p.id,
      web_name: p.web_name,
      first_name: p.first_name,
      second_name: p.second_name,
      team: p.team,
      element_type: p.element_type,
      now_cost: p.now_cost,
      total_points: p.total_points,
      goals_scored: p.goals_scored,
      assists: p.assists,
      clean_sheets: p.clean_sheets,
      minutes: p.minutes,
      yellow_cards: p.yellow_cards,
      red_cards: p.red_cards,
      saves: p.saves,
      bonus: p.bonus,
      form: p.form,
      selected_by_percent: p.selected_by_percent,
      status: p.status,
      news: p.news,
    })),
    current_gw: currentGW,
    completed_gws: completedGWs,
    recent_gws: recentGWs,
    live: liveData,
    fixtures,
    fetched_at: new Date().toISOString(),
  };

  writeFileSync(OUTPUT, JSON.stringify(slim));
  const liveGWCount = Object.keys(liveData).length;
  console.log(`Saved ${slim.elements.length} players, ${slim.teams.length} teams, ${liveGWCount} GW live data, ${fixtures.length} fixtures`);
}

main().catch((e) => {
  console.error('Failed to fetch FPL data:', e.message);
  process.exit(1);
});
