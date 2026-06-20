#!/usr/bin/env node
/**
 * date_format.js — Convert a date between human-readable formats.
 *
 * Input (JSON via argv):
 *   {"date": "YYYY-MM-DD", "format": "cn|iso|us|eu|week"}
 *
 * Output (JSON to stdout):
 *   {"result": "...", "original": "...", "format": "..."}
 *
 * Supported formats:
 *   cn   → 2025年6月15日
 *   iso  → 2025-06-15
 *   us   → 06/15/2025
 *   eu   → 15/06/2025
 *   week → 2025年6月15日 周日
 */
const input = JSON.parse(process.argv[2] || "{}");
const { date, format } = input;

if (!date || !format) {
  console.error(JSON.stringify({ error: "date_format requires date and format" }));
  process.exit(1);
}

const d = new Date(date);
if (isNaN(d.getTime())) {
  console.error(JSON.stringify({ error: `Invalid date: "${date}". Use YYYY-MM-DD.` }));
  process.exit(1);
}

const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const y = d.getFullYear();
const m = d.getMonth() + 1;
const day = d.getDate();
const wd = weekdays[d.getDay()];
const mm = String(m).padStart(2, "0");
const dd = String(day).padStart(2, "0");

let result;
switch (format.toLowerCase()) {
  case "cn":
    result = `${y}年${m}月${day}日`;
    break;
  case "iso":
    result = `${y}-${mm}-${dd}`;
    break;
  case "us":
    result = `${mm}/${dd}/${y}`;
    break;
  case "eu":
    result = `${dd}/${mm}/${y}`;
    break;
  case "week":
    result = `${y}年${m}月${day}日 ${wd}`;
    break;
  default:
    console.error(JSON.stringify({ error: `Unknown format: "${format}". Supported: cn, iso, us, eu, week` }));
    process.exit(1);
}

process.stdout.write(JSON.stringify({ result, original: date, format }));
