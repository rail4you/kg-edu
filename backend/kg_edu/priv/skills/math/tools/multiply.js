#!/usr/bin/env node
// multiply.js — Node.js implementation of the `multiply` tool.
// Reads two integers from argv, prints their product as a single integer.
const [aRaw, bRaw] = process.argv.slice(2);
const a = Number(aRaw);
const b = Number(bRaw);

if (!Number.isInteger(a) || !Number.isInteger(b)) {
  console.error(`multiply: expected two integers, got "${aRaw}" and "${bRaw}"`);
  process.exit(1);
}

process.stdout.write(String(a * b));
