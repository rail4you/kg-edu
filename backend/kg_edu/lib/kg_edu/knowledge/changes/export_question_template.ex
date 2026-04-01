defmodule KgEdu.Knowledge.Changes.ExportQuestionTemplate do
  @moduledoc """
  Change module for exporting question template XLSX.
  """
  use Ash.Resource.Change

  def change(changeset, _opts, _context) do
    _created_by_id = Ash.Changeset.get_argument(changeset, :created_by_id)

    case generate_template() do
      {:ok, xlsx_base64} ->
        Ash.Changeset.after_action(changeset, fn _resource, _record ->
          {:ok, %{template_base64: xlsx_base64, filename: "question_template.xlsx"}}
        end)

      {:error, error} ->
        Ash.Changeset.add_error(changeset, error)
    end
  end

  defp generate_template() do
    try do
      # Create template data matching the question import template format
      # Row 1: Instructions
      instructions = [
        "说明：1. 问题标题可以是自由形式的，使用层级命名，如\"全局层问题 - 概念层问题 - 方法层问题/实践场景 - 思考拓展 - 技能要点\"。一门课程只能使用一种层级结构。",
        "2. 标题概括：总结标题的含义。",
        "3. 问题描述：填写问题的内容。",
        "4. 问题位置用于排序；如果位置相同，则不应用特定顺序。"
      ]

      headers = [
        "问题标题",
        "标题概括",
        "问题描述",
        "问题位置"
      ]

      example_rows = [
        ["全局层问题", "与课程对应的问题", "四大核心模块的逻辑关系？", "1"],
        ["概念层问题", "从概念角度分解课程内容", "什么是数据结构？", "2"],
        ["方法层问题", "具体的方法和技巧", "如何实现二叉树的遍历？", "3"]
      ]

      # Convert to XLSX format using Elixlsx
      # Row 1: instructions (comment row), Row 2: headers, Row 3+: data
      instruction_row = [Enum.join(instructions, " ")]
      sheet = %Elixlsx.Sheet{
        name: "Questions",
        rows: [instruction_row, headers | example_rows]
      }

      case Elixlsx.write_to_memory(%Elixlsx.Workbook{sheets: [sheet]}, "question_template") do
        {:ok, {_filename, content}} ->
          xlsx_base64 = Base.encode64(content)
          {:ok, xlsx_base64}

        {:error, reason} ->
          {:error, "Failed to generate XLSX: #{inspect(reason)}"}
      end
    rescue
      e ->
        {:error, "Failed to generate template: #{Exception.message(e)}"}
    end
  end
end
