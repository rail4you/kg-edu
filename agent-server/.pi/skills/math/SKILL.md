---
name: math
description: Arithmetic helpers with add and multiply tools. Use this skill whenever the user asks for arithmetic.
license: MIT
allowed-tools:
  - add
  - multiply
tags:
  - math
  - arithmetic
---

# Math Skill

This skill exposes two arithmetic tools implemented as native Node.js/TypeScript
tools — no Elixir wrapping needed.

## When to use

- The user asks for a calculation involving `+`, `-`, `*`, or `/`.
- A multi-step expression like `(12 + 7) * 3` needs to be evaluated.
- You need to confirm an arithmetic fact before answering.

## Workflow

1. Break the expression into the smallest atomic operations.
2. Call the matching tool (e.g. `add`, `multiply`) for each step.
3. Compose the tool results into the final answer.
4. Reply in the user's language with one short sentence of context.

## Tools

- `add(a, b)` — returns `{ "sum": a + b }`
- `multiply(a, b)` — returns `{ "product": a * b }`
