# Script for populating the database. You can run it as:
#
#     mix run priv/repo/seeds.exs
#
# 文件模板种子脚本
#
# 将所有已知的模板 URL 整理到 file_templates 表中。
# 如果某个 section 在数据库中不存在，则用默认模板填充。

alias KgEdu.Utils.FileTemplate

IO.puts("=" |> String.duplicate(70))
IO.puts("  文件模板种子脚本")
IO.puts("=" |> String.duplicate(70))
IO.puts("")

# ── 所有已知模板定义 ──────────────────────────────────────────────────────────
# 每个 section 可以有多个模板 URL。
# NOTE: URL 必须与数据库中存储的完全一致。

default_template_url =
  "https://kg-edu.oss-cn-beijing.aliyuncs.com/uploads/2026-03-25/template.xlsx"

known_sections = %{
  manual: %{
    label: "操作手册",
    urls: [
      "http://kg-edu.oss-cn-beijing.aliyuncs.com/%E8%AF%BE%E5%A0%82%E6%98%9F%E6%99%BA%E6%85%A7%E6%95%99%E5%AD%A6%E5%B9%B3%E5%8F%B0%E6%93%8D%E4%BD%9C%E6%89%8B%E5%86%8C%EF%BC%88%E7%AC%AC%E4%BA%8C%E6%9C%9F%EF%BC%89.docx",
      "http://kg-edu.oss-cn-beijing.aliyuncs.com/%E8%AE%BE%E7%BD%AE%E8%AF%BE%E7%A8%8B.docx"
    ]
  },
  xmind: %{
    label: "XMind 脑图",
    urls: ["http://kg-edu.oss-cn-beijing.aliyuncs.com/xmind.xmind"]
  },
  llm: %{
    label: "LLM 导入",
    urls: ["http://kg-edu.oss-cn-beijing.aliyuncs.com/llm.txt"]
  },
  knowledge: %{
    label: "知识点导入",
    urls: ["https://kg-edu.oss-cn-beijing.aliyuncs.com/uploads/2026-03-30/知识点导入模版.xlsx"]
  },
  homework: %{
    label: "作业导入",
    urls: ["https://kg-edu.oss-cn-beijing.aliyuncs.com/uploads/2026-03-30/作业导入模版.xlsx"]
  },
  teacher_manual: %{
    label: "教师端使用手册",
    urls: ["https://kg-edu.oss-cn-beijing.aliyuncs.com/uploads/2026-03-25/教师端使用手册.docx"]
  },
  student_manual: %{
    label: "学生端使用手册",
    urls: ["https://kg-edu.oss-cn-beijing.aliyuncs.com/uploads/2026-03-25/学生端使用手册.docx"]
  },
  relation: %{
    label: "知识点关系导入",
    urls: ["https://kg-edu.oss-cn-beijing.aliyuncs.com/uploads/2026-03-25/template.xlsx"]
  },
  user: %{
    label: "用户导入",
    urls: ["https://kg-edu.oss-cn-beijing.aliyuncs.com/uploads/2026-03-30/用户.xlsx"]
  },
  chapter: %{
    label: "章节导入",
    urls: ["https://kg-edu.oss-cn-beijing.aliyuncs.com/uploads/2026-03-30/章节导入模版.xlsx"]
  },
  knowledge_question: %{
    label: "问题图谱导入",
    urls: ["https://kg-edu.oss-cn-beijing.aliyuncs.com/uploads/2026-03-30/问题图谱导入模版.xlsx"]
  },
  exercise: %{
    label: "习题导入",
    urls: ["https://kg-edu.oss-cn-beijing.aliyuncs.com/uploads/2026-03-30/习题导入模版.xlsx"]
  }
}

# ── 辅助函数 ──────────────────────────────────────────────────────────────────

defmodule SeedHelper do
  @doc "从 URL 提取文件名"
  def extract_filename(url) do
    url |> String.split("/") |> List.last() |> URI.decode()
  end

  @doc "获取 section 的所有现有模板 URL"
  def get_existing_urls(section_str) do
    case FileTemplate.get_file_template_by_section(section_str) do
      {:ok, nil} -> []
      {:ok, template} -> [template.file_path]
      _ -> []
    end
  end

  @doc "创建模板记录"
  def create_template(section_str, file_path) do
    case FileTemplate.create_file_template(%{section: section_str, file_path: file_path}) do
      {:ok, _template} ->
        IO.puts("      ✅ 已创建: #{extract_filename(file_path)}")
        :ok

      {:error, changeset} ->
        errors =
          changeset.errors
          |> Enum.map(fn {field, {msg, _}} -> "#{field}: #{msg}" end)
          |> Enum.join("; ")

        IO.puts("      ❌ 创建失败: #{errors}")
        :error
    end
  end
end

# ── 主逻辑 ────────────────────────────────────────────────────────────────────

stats = %{matched: 0, partial: 0, missing: 0}

for {section_key, info} <- known_sections do
  section_str = Atom.to_string(section_key)
  existing_urls = SeedHelper.get_existing_urls(section_str)
  expected_urls = info.urls
  label = info.label

  matched = Enum.filter(expected_urls, &(&1 in existing_urls))
  unmatched = Enum.reject(expected_urls, &(&1 in existing_urls))

  cond do
    length(matched) == length(expected_urls) ->
      stats = %{stats | matched: stats.matched + 1}
      IO.puts("   ✅ [#{section_str}] (#{label}) — #{length(expected_urls)} 个模板全部存在")

    length(existing_urls) > 0 ->
      stats = %{stats | partial: stats.partial + 1}
      IO.puts("   ⚠️  [#{section_str}] (#{label}) — 已存在 #{length(matched)}/#{length(expected_urls)} 个")

      for url <- unmatched do
        SeedHelper.create_template(section_str, url)
      end

    true ->
      stats = %{stats | missing: stats.missing + 1}
      IO.puts("   ❌ [#{section_str}] (#{label}) — 无任何模板")

      for url <- expected_urls do
        SeedHelper.create_template(section_str, url)
      end
  end

  IO.puts("")
end

# ── 检查数据库中是否有未知 section ───────────────────────────────────────────

# 获取所有 section 列表（用于检查未知 section）
all_existing =
  case FileTemplate.list_file_templates() do
    {:ok, templates} -> templates
    _ -> []
  end

known_keys = known_sections |> Map.keys() |> Enum.map(&Atom.to_string/1)
unknown = all_existing |> Enum.map(& &1.section) |> Enum.uniq() |> Enum.reject(&(&1 in known_keys))

if unknown != [] do
  IO.puts("⚠️  数据库中存在但未在 known_sections 中定义的 section:")
  for s <- unknown do
    entries = Enum.filter(all_existing, &(&1.section == s))
    for e <- entries do
      IO.puts("   [#{s}] #{e.file_path}")
    end
  end
  IO.puts("")
end

# ── 汇总 ──────────────────────────────────────────────────────────────────────

IO.puts("=" |> String.duplicate(70))
IO.puts("  汇总")
IO.puts("=" |> String.duplicate(70))
IO.puts("  完整匹配的 section:   #{stats.matched}")
IO.puts("  部分补充的 section:   #{stats.partial}")
IO.puts("  新创建的 section:     #{stats.missing}")
IO.puts("")
IO.puts("🟢 种子脚本执行完毕")
IO.puts("")
