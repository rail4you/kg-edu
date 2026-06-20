#!/usr/bin/env python3
"""
randint.py — Generate a random integer in [a, b] inclusive.

Input (JSON via argv[1]):
  {"a": 1, "b": 100}

Output (JSON to stdout):
  {"result": 42}
"""
import json, sys, random

try:
    data = json.loads(sys.argv[1])
    a = int(data["a"])
    b = int(data["b"])
    result = random.randint(a, b)
    print(json.dumps({"result": result}))
except Exception as e:
    print(json.dumps({"error": str(e)}), file=sys.stderr)
    sys.exit(1)
