---
name: random
description: Random number generation utilities using Python standard library. Use this skill when the user asks for random numbers, dice rolls, lottery picks, or any randomized output.
license: MIT
allowed-tools:
  - randint
  - randrange
  - dice
tags:
  - random
  - python
  - dice
---

# Random Skill

This skill exposes random number generators implemented in Python
using the standard `random` module. Tools are dynamically loaded by
the factory — no Elixir wrapper files needed.

## When to use

- User asks for a random number in a range (e.g., "random number between 1 and 100")
- User wants to roll dice ("roll 2d6")
- User needs random picks or shuffles

## Tools

- `randint(a, b)` — returns `{ "result": N }` where N is a random integer in [a, b] inclusive
- `randrange(start, stop, step)` — returns `{ "result": N }` from range(start, stop, step)
- `dice(count, sides)` — returns `{ "rolls": [N, ...], "total": S, "count": C, "sides": S }`
