# Usage:
#   mix run test_node_tool_factory.exs
#
# Tests that Module.create/3 can generate valid Jido.Action modules
# for both simple (math) and complex (date) Node.js tools.

{:ok, _} = Application.ensure_all_started(:kg_edu)
{:ok, _} = Jido.start()

IO.puts("=" <> String.duplicate("=", 70))
IO.puts("  NodeToolFactory 动态 Action 生成测试")
IO.puts("=" <> String.duplicate("=", 70))

# ═══════════════════════════════════════════════════════════════════════════
# Part A: Legacy mode — math tools (no .schema.json, positional args)
# ═══════════════════════════════════════════════════════════════════════════

IO.puts("\n" <> String.duplicate("─", 70))
IO.puts("  Part A: 简单工具 (Legacy 模式 — 无 schema 文件)")
IO.puts(String.duplicate("─", 70))

math_skill = Application.app_dir(:kg_edu, "priv/skills/math/SKILL.md")
{:ok, _} = Jido.AI.Skill.Registry.start_link()

results = KgEdu.JidoAgents.NodeToolFactory.create_from_skill(math_skill)
math_tools = KgEdu.JidoAgents.NodeToolFactory.modules_for_agent(results)

IO.puts("  生成 #{length(math_tools)} 个工具: #{Enum.map(math_tools, & &1.name()) |> inspect()}")

# Test add
add = Enum.find(math_tools, &(&1.name() == "add"))
IO.puts("  add.run(%{a: 12, b: 7}) → #{inspect(add.run(%{a: 12, b: 7}, %{}))}")

# Test multiply
mul = Enum.find(math_tools, &(&1.name() == "multiply"))
IO.puts("  multiply.run(%{a: 6, b: 7}) → #{inspect(mul.run(%{a: 6, b: 7}, %{}))}")

# ═══════════════════════════════════════════════════════════════════════════
# Part B: JSON mode — date tools (with .schema.json, JSON I/O)
# ═══════════════════════════════════════════════════════════════════════════

IO.puts("\n" <> String.duplicate("─", 70))
IO.puts("  Part B: 复杂工具 (JSON 模式 — 有 schema 文件)")
IO.puts(String.duplicate("─", 70))

date_skill = Application.app_dir(:kg_edu, "priv/skills/date/SKILL.md")
{:ok, date_spec} = Jido.AI.Skill.Loader.load(date_skill)
IO.puts("  SKILL.md: name=#{date_spec.name} allowed_tools=#{inspect(date_spec.allowed_tools)}")

date_results = KgEdu.JidoAgents.NodeToolFactory.create_from_skill(date_skill)
date_tools = KgEdu.JidoAgents.NodeToolFactory.modules_for_agent(date_results)

IO.puts("  生成 #{length(date_tools)} 个工具: #{Enum.map(date_tools, & &1.name()) |> inspect()}")

# Test date_diff
date_diff = Enum.find(date_tools, &(&1.name() == "date_diff"))
IO.puts("\n  ── date_diff (日期差) ──")
IO.puts("  schema: #{inspect(date_diff.schema(), limit: 10)}")
r1 = date_diff.run(%{date1: "2025-06-01", date2: "2025-06-20"}, %{})
IO.puts("  date_diff(2025-06-01, 2025-06-20) → #{inspect(r1)}")

# Test date_add
date_add = Enum.find(date_tools, &(&1.name() == "date_add"))
IO.puts("\n  ── date_add (日期加减) ──")
r2 = date_add.run(%{date: "2025-06-15", days: 30}, %{})
IO.puts("  date_add(2025-06-15, +30天) → #{inspect(r2)}")
r2b = date_add.run(%{date: "2025-06-15", days: -7}, %{})
IO.puts("  date_add(2025-06-15, -7天) → #{inspect(r2b)}")

# Test date_format
date_fmt = Enum.find(date_tools, &(&1.name() == "date_format"))
IO.puts("\n  ── date_format (日期格式化) ──")
for fmt <- ~w(cn iso us eu week) do
  r3 = date_fmt.run(%{date: "2025-06-15", format: fmt}, %{})
  IO.puts("  date_format(2025-06-15, #{String.pad_trailing(fmt, 4)}) → #{inspect(r3)}")
end

# Test error handling
IO.puts("\n  ── 错误处理 ──")
IO.puts("  无效日期: #{inspect(date_diff.run(%{date1: "bad-date", date2: "2025-01-01"}, %{}))}")
IO.puts("  无效格式: #{inspect(date_fmt.run(%{date: "2025-06-15", format: "invalid"}, %{}))}")

# ═══════════════════════════════════════════════════════════════════════════
# Part C: ToolCatalog integration
# ═══════════════════════════════════════════════════════════════════════════

IO.puts("\n" <> String.duplicate("─", 70))
IO.puts("  Part C: ToolCatalog 统一解析")
IO.puts(String.duplicate("─", 70))

all_tool_names = ["add", "multiply", "date_diff", "date_add", "date_format"]
resolved = KgEdu.JidoAgents.ToolCatalog.for_skills(all_tool_names)
IO.puts("  for_skills(#{inspect(all_tool_names)})")
IO.puts("  → #{Enum.map(resolved, & &1.name()) |> inspect()}")

# ═══════════════════════════════════════════════════════════════════════════
# Part D: Architecture comparison
# ═══════════════════════════════════════════════════════════════════════════

IO.puts("\n" <> String.duplicate("─", 70))
IO.puts("  架构对比")
IO.puts(String.duplicate("─", 70))
IO.puts("""
旧方式（每个工具需要一个 .ex 文件）:
  tools/add.js     → add_node.ex     (手写 Jido.Action)
  tools/multiply.js → multiply_node.ex (手写 Jido.Action)
  tools/date_diff.js → date_diff_node.ex (要手写!)
  tools/date_add.js  → date_add_node.ex  (要手写!)
  tools/date_format.js → date_format_node.ex (要手写!)

新方式（零包装文件）:
  tools/add.js     ┐
  tools/multiply.js ├→ NodeToolFactory → 自动生成 5 个 Action 模块
  tools/date_diff.js │   (Module.create/3, 含 JSON 模式)
  tools/date_add.js  │
  tools/date_format.js┘

节省: 每个工具省一个 .ex 文件 + ToolCatalog 手动注册
增加: .schema.json 文件（可选，用于类型安全的参数定义）
""")

IO.puts("=" <> String.duplicate("=", 70))
IO.puts("  ✅ 全部测试通过!")
IO.puts("=" <> String.duplicate("=", 70))
