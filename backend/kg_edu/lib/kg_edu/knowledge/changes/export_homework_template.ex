defmodule KgEdu.Knowledge.Changes.ExportHomeworkTemplate do
  @moduledoc """
  Change module for exporting homework template XLSX as base64.
  """
  use Ash.Resource.Change

  def change(changeset, _opts, _context) do
    _created_by_id = Ash.Changeset.get_argument(changeset, :created_by_id)
    
    case generate_template_xlsx() do
      {:ok, xlsx_base64} ->
        Ash.Changeset.after_action(changeset, fn _resource, _record ->
          {:ok, %{template_base64: xlsx_base64, filename: "homework_template.xlsx"}}
        end)
      {:error, error} ->
        Ash.Changeset.add_error(changeset, error)
    end
  end

  defp generate_template_xlsx do
    try do
      # Create template data
      headers = [
        "标题", "内容", "分数", "课程名称"
      ]
      
      example_rows = [
        ["第一章练习题", "完成教材第25页的练习1-10", "100", "数学基础"],
        ["期中复习", "复习第1-5章的所有知识点", "150", "数学基础"],
        ["实验作业三", "完成实验手册中的编程项目", "80", "数据结构"]
      ]

      # Convert to XLSX format using Elixlsx
      sheet = %Elixlsx.Sheet{
        name: "Homework",
        rows: [headers | example_rows]
      }

      case Elixlsx.write_to_memory(%Elixlsx.Workbook{sheets: [sheet]}, "homework_template") do
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