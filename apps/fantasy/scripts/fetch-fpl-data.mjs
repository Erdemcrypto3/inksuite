// Runs during build to fetch FPL data and save as static JSON
// Avoids CORS issues since this runs server-side in Node.js

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT = join(__dirname, '..', 'app', 'data', 'fpl.json');
const API_URL = 'https://fantasy.premierleague.com/api/bootstrap-static/';

async function main() {
  console.log('Fetching FPL data...');
  const res = await fetch(API_URL);
  if (!res.ok) throw new Error(`FPL API returned ${res.status}`);
  const data = await res.json();

  // Extract only what we need to keep bundle small
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
    fetched_at: new Date().toISOString(),
  };

  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, JSON.stringify(slim));
  console.log(`Saved ${slim.elements.length} players, ${slim.teams.length} teams to ${OUTPUT}`);
}

main().catch((e) => {
  console.error('Failed to fetch FPL data:', e.message);
  process.exit(1);
});
