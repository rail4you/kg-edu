#!/usr/bin/env python3
"""
randrange.py — Pick a random element from range(start, stop, step).

Input (JSON via argv[1]):
  {"start": 1, "stop": 100, "step": 2}

Output (JSON to stdout):
  {"result": 47, "start": 1, "stop": 100, "step": 2}
"""
import json, sys, random

try:
    data = json.loads(sys.argv[1])
    start = int(data["start"])
    stop = int(data["stop"])
    step = int(data.get("step", 1))
    result = random.randrange(start, stop, step)
    print(json.dumps({"result": result, "start": start, "stop": stop, "step": step}))
except Exception as e:
    print(json.dumps({"error": str(e)}), file=sys.stderr)
    sys.exit(1)
