---
name: date
description: Date calculation and formatting utilities backed by Node.js tools. Use this skill when the user asks about date arithmetic, date differences, or date formatting.
license: MIT
allowed-tools:
  - date_diff
  - date_add
  - date_format
tags:
  - date
  - calendar
  - time
  - nodejs
---

# Date Skill

This skill exposes three date utilities whose implementations live in
`tools/date_diff.js`, `tools/date_add.js`, and `tools/date_format.js` (Node.js).
They are dynamically loaded by `NodeToolFactory` — no Elixir wrapper files needed.

## When to use

- User asks "how many days between date A and date B?"
- User asks "what date is N days after/before YYYY-MM-DD?"
- User needs to convert a date between formats (e.g., "2025-06-15" → "2025年6月15日")

## Workflow

1. Identify the operation: diff, add/subtract, or format.
2. Call the matching tool with the appropriate parameters.
3. Present the result in the user's language.

## Tools

- `date_diff(date1, date2)` — returns `{ "days": N, "date1": "...", "date2": "..." }`
- `date_add(date, days)` — returns `{ "result": "YYYY-MM-DD", "original": "...", "daysAdded": N }`
- `date_format(date, format)` — returns `{ "result": "...", "original": "...", "format": "..." }`
