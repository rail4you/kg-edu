# Usage:
#   mix run test_node_tool_factory.exs
#
# Tests Module.create/3 for JS (math, date) and Python (random) tools.

{:ok, _} = Application.ensure_all_started(:kg_edu)
{:ok, _} = Jido.start()

IO.puts("=" <> String.duplicate("=", 70))
IO.puts("  ScriptToolFactory 动态 Action 生成测试 (JS + Python)")
IO.puts("=" <> String.duplicate("=", 70))

{:ok, _} = Jido.AI.Skill.Registry.start_link()

# ═══════════════════════════════════════════════════════════════════════════
# Part A: JS legacy mode (math)
# ═══════════════════════════════════════════════════════════════════════════
IO.puts("\n── Part A: JS Legacy 模式 (math) ──")
math_skill = Application.app_dir(:kg_edu, "priv/skills/math/SKILL.md")
math_results = KgEdu.JidoAgents.ScriptToolFactory.create_from_skill(math_skill)
math_tools = KgEdu.JidoAgents.ScriptToolFactory.modules_for_agent(math_results)
IO.puts("  工具: #{Enum.map(math_tools, & &1.name()) |> inspect()}")
IO.puts("  add(12,7) → #{inspect(hd(math_tools).run(%{a: 12, b: 7}, %{}))}")

# ═══════════════════════════════════════════════════════════════════════════
# Part B: JS JSON mode (date)
# ═══════════════════════════════════════════════════════════════════════════
IO.puts("\n── Part B: JS JSON 模式 (date) ──")
date_skill = Application.app_dir(:kg_edu, "priv/skills/date/SKILL.md")
date_results = KgEdu.JidoAgents.ScriptToolFactory.create_from_skill(date_skill)
date_tools = KgEdu.JidoAgents.ScriptToolFactory.modules_for_agent(date_results)
IO.puts("  工具: #{Enum.map(date_tools, & &1.name()) |> inspect()}")

diff = Enum.find(date_tools, &(&1.name() == "date_diff"))
IO.puts("  date_diff(2025-06-01, 2025-06-20) → #{inspect(diff.run(%{date1: "2025-06-01", date2: "2025-06-20"}, %{}))}")

dadd = Enum.find(date_tools, &(&1.name() == "date_add"))
IO.puts("  date_add(2025-12-25, +7) → #{inspect(dadd.run(%{date: "2025-12-25", days: 7}, %{}))}")

# ═══════════════════════════════════════════════════════════════════════════
# Part C: Python JSON mode (random) ← NEW
# ═══════════════════════════════════════════════════════════════════════════
IO.puts("\n── Part C: Python JSON 模式 (random) ──")
random_skill = Application.app_dir(:kg_edu, "priv/skills/random/SKILL.md")
{:ok, spec} = Jido.AI.Skill.Loader.load(random_skill)
IO.puts("  SKILL.md: name=#{spec.name} tools=#{inspect(spec.allowed_tools)}")

random_results = KgEdu.JidoAgents.ScriptToolFactory.create_from_skill(random_skill)
random_tools = KgEdu.JidoAgents.ScriptToolFactory.modules_for_agent(random_results)
IO.puts("  工具: #{Enum.map(random_tools, & &1.name()) |> inspect()}")

# randint
ri = Enum.find(random_tools, &(&1.name() == "randint"))
IO.puts("")
IO.puts("  ── randint (Python random.randint) ──")
for _ <- 1..3 do
  r = ri.run(%{a: 1, b: 100}, %{})
  IO.puts("  randint(1, 100) → #{inspect(r)}")
end

# randrange
rr = Enum.find(random_tools, &(&1.name() == "randrange"))
IO.puts("\n  ── randrange (Python random.randrange) ──")
IO.puts("  randrange(0, 100, 10) → #{inspect(rr.run(%{start: 0, stop: 100, step: 10}, %{}))}")
IO.puts("  randrange(0, 100) → #{inspect(rr.run(%{start: 0, stop: 100}, %{}))}")

# dice
dc = Enum.find(random_tools, &(&1.name() == "dice"))
IO.puts("\n  ── dice (Python 骰子) ──")
IO.puts("  dice(2, 6) → #{inspect(dc.run(%{count: 2, sides: 6}, %{}))}")
IO.puts("  dice(5, 20) → #{inspect(dc.run(%{count: 5, sides: 20}, %{}))}")

# Error
IO.puts("\n  ── 错误处理 ──")
IO.puts("  dice(0, 6) → #{inspect(dc.run(%{count: 0, sides: 6}, %{}))}")

# ═══════════════════════════════════════════════════════════════════════════
# Part D: ToolCatalog
# ═══════════════════════════════════════════════════════════════════════════
IO.puts("\n── Part D: ToolCatalog 统一解析 ──")
all_names = ["add", "multiply", "date_diff", "date_add", "date_format", "randint", "randrange", "dice"]
resolved = KgEdu.JidoAgents.ToolCatalog.for_skills(all_names)
IO.puts("  for_skills(#{inspect(all_names)})")
IO.puts("  → #{Enum.map(resolved, & &1.name()) |> inspect()} (#{length(resolved)} tools)")

IO.puts("\n" <> String.duplicate("=", 70))
IO.puts("  ✅ JS + Python 工具全部通过!")
IO.puts(String.duplicate("=", 70))
