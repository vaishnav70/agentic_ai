/**
 * Interactive Fragrance Matching CLI for StyleScent.
 *
 * What: Command-line interface to execute the deterministic fragrance matcher against the real dataset.
 * Why: Enables rapid debugging, interactive verification of scoring weights and filters,
 * and immediate testing of golden request queries without starting the HTTP server or chat UI.
 */

import { loadData } from '../src/data/load.js';
import { matchPerfumes } from '../src/tools/perfume.js';

function printUsage() {
  console.log(`
Usage: npm run match -- [options]

Required:
  --occasion <occasion>         One of: college_fest, office, date_night, wedding,
                                casual, interview, party, festival_traditional

Options:
  --season <season>             spring, summer, autumn, winter
  --time <timeOfDay>            day, evening, night
  --vibe <vibe1,vibe2>          Comma-separated: confident, fresh, elegant, playful, bold, calm, romantic
  --projection <level>          soft, moderate, strong
  --minLongevity <hours>        Minimum longevity hours (number)
  --budget <band>               budget, mid, premium
  --marketedFor <target>        men, unisex, women
  --avoid <note1,note2>         Comma-separated note substrings to exclude
  --require <note1,note2>       Comma-separated note substrings to require
  --k <number>                  Number of recommendations to return (default: 3)
  --threshold <score>           Minimum score threshold (default: 40)
  --help, -h                    Show this help message
`);
}

function parseArgs(args) {
  const query = {};
  const options = {};
  const allowedFlags = new Set([
    '--occasion',
    '--season',
    '--time',
    '--timeofday',
    '--vibe',
    '--projection',
    '--minlongevity',
    '--minlongevityhours',
    '--budget',
    '--marketedfor',
    '--avoid',
    '--avoidnotes',
    '--require',
    '--requirenotes',
    '--k',
    '--threshold',
    '--help',
    '-h',
  ]);

  for (let i = 0; i < args.length; i++) {
    const rawFlag = args[i];
    const flag = rawFlag.toLowerCase();

    if (flag === '--help' || flag === '-h') {
      printUsage();
      process.exit(0);
    }

    if (!allowedFlags.has(flag)) {
      console.error(`Unknown flag: ${rawFlag}`);
      printUsage();
      process.exit(1);
    }

    const value = args[i + 1];
    if (value === undefined || value.startsWith('--')) {
      console.error(`Missing value for flag: ${rawFlag}`);
      printUsage();
      process.exit(1);
    }
    i++;

    switch (flag) {
      case '--occasion':
        query.occasion = value.trim();
        break;
      case '--season':
        query.season = value.trim();
        break;
      case '--time':
      case '--timeofday':
        query.timeOfDay = value.trim();
        break;
      case '--vibe':
        query.vibe = value
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean);
        break;
      case '--projection':
        query.projection = value.trim();
        break;
      case '--minlongevity':
      case '--minlongevityhours':
        query.minLongevityHours = parseFloat(value);
        break;
      case '--budget':
        query.budget = value.trim();
        break;
      case '--marketedfor':
        query.marketedFor = value.trim();
        break;
      case '--avoid':
      case '--avoidnotes':
        query.avoidNotes = value
          .split(',')
          .map((n) => n.trim().toLowerCase())
          .filter(Boolean);
        break;
      case '--require':
      case '--requirenotes':
        query.requireNotes = value
          .split(',')
          .map((n) => n.trim().toLowerCase())
          .filter(Boolean);
        break;
      case '--k':
        options.k = parseInt(value, 10);
        break;
      case '--threshold':
        options.threshold = parseInt(value, 10);
        break;
    }
  }

  return { query, options };
}

function main() {
  const rawArgs = process.argv.slice(2);
  const { query, options } = parseArgs(rawArgs);

  if (!query.occasion) {
    console.error('Error: --occasion is required.\n');
    printUsage();
    process.exit(1);
  }

  const { perfumes } = loadData();
  const result = matchPerfumes(query, perfumes, options);

  console.log('\n========================================================================================');
  console.log(' StyleScent Fragrance Match Results');
  console.log('========================================================================================');
  console.log('Query:', JSON.stringify(query));
  console.log(`Candidates Considered: ${result.considered} | Best Score: ${result.best_score ?? 'N/A'}`);
  console.log('Filtered Out:', JSON.stringify(result.filtered_out));
  console.log('----------------------------------------------------------------------------------------');

  if (result.results.length === 0) {
    console.log(`\nNo matching fragrances found. Reason: ${result.reason}\n`);
    return;
  }

  console.log('\n| Rank | ID    | Name                          | Brand               | Score | Reasons / Caveats');
  console.log('|------|-------|-------------------------------|---------------------|-------|----------------------------------------------------');

  for (const p of result.results) {
    const rankStr = p.rank !== null ? `#${p.rank}`.padEnd(4) : 'N/A '.padEnd(4);
    const idStr = p.id.padEnd(5);
    const nameStr = (p.name.length > 29 ? p.name.slice(0, 26) + '...' : p.name).padEnd(29);
    const brandStr = (p.brand.length > 19 ? p.brand.slice(0, 16) + '...' : p.brand).padEnd(19);
    const scoreStr = `${p.score}/100`.padStart(5);

    const reasonsSummary = p.reasons.join('; ');
    const caveatsSummary = p.caveats.length > 0 ? ` [⚠️ ${p.caveats.join(', ')}]` : '';

    console.log(`| ${rankStr} | ${idStr} | ${nameStr} | ${brandStr} | ${scoreStr} | ${reasonsSummary}${caveatsSummary}`);
  }

  console.log('========================================================================================\n');
}

main();
