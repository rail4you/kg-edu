#!/usr/bin/env node
/**
 * date_add.js — Add (or subtract) N days to a date.
 *
 * Input (JSON via argv):
 *   {"date": "YYYY-MM-DD", "days": N}
 *
 * Output (JSON to stdout):
 *   {"result": "YYYY-MM-DD", "original": "...", "daysAdded": N}
 */
const input = JSON.parse(process.argv[2] || "{}");
const { date, days } = input;

if (!date || typeof days !== "number") {
  console.error(JSON.stringify({ error: "date_add requires date (YYYY-MM-DD) and days (integer)" }));
  process.exit(1);
}

const d = new Date(date);
if (isNaN(d.getTime())) {
  console.error(JSON.stringify({ error: `Invalid date: "${date}". Use YYYY-MM-DD.` }));
  process.exit(1);
}

d.setDate(d.getDate() + days);

const yyyy = d.getFullYear();
const mm = String(d.getMonth() + 1).padStart(2, "0");
const dd = String(d.getDate()).padStart(2, "0");
const result = `${yyyy}-${mm}-${dd}`;

process.stdout.write(JSON.stringify({ result, original: date, daysAdded: days }));
