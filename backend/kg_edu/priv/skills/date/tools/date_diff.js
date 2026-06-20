#!/usr/bin/env node
/**
 * date_diff.js — Calculate absolute days between two dates.
 *
 * Input (JSON via argv):
 *   {"date1": "YYYY-MM-DD", "date2": "YYYY-MM-DD"}
 *
 * Output (JSON to stdout):
 *   {"days": N, "date1": "...", "date2": "..."}
 */
const input = JSON.parse(process.argv[2] || "{}");
const { date1, date2 } = input;

if (!date1 || !date2) {
  console.error(JSON.stringify({ error: "date_diff requires date1 and date2 in YYYY-MM-DD format" }));
  process.exit(1);
}

const d1 = new Date(date1);
const d2 = new Date(date2);

if (isNaN(d1.getTime()) || isNaN(d2.getTime())) {
  console.error(JSON.stringify({ error: `Invalid date(s): "${date1}", "${date2}". Use YYYY-MM-DD.` }));
  process.exit(1);
}

const msPerDay = 1000 * 60 * 60 * 24;
const days = Math.abs(Math.round((d2 - d1) / msPerDay));

process.stdout.write(JSON.stringify({ days, date1, date2 }));
