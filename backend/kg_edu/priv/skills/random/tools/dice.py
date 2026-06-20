#!/usr/bin/env python3
"""
dice.py — Roll N dice with M sides each.

Input (JSON via argv[1]):
  {"count": 2, "sides": 6}

Output (JSON to stdout):
  {"rolls": [3, 5], "total": 8, "count": 2, "sides": 6}
"""
import json, sys, random

try:
    data = json.loads(sys.argv[1])
    count = int(data["count"])
    sides = int(data["sides"])

    if count < 1 or sides < 2:
        raise ValueError("count must be >= 1, sides must be >= 2")

    rolls = [random.randint(1, sides) for _ in range(count)]
    print(json.dumps({
        "rolls": rolls,
        "total": sum(rolls),
        "count": count,
        "sides": sides
    }))
except Exception as e:
    print(json.dumps({"error": str(e)}), file=sys.stderr)
    sys.exit(1)
