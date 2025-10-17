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
      # Create template data
      headers = [
        "标题", "描述", "级别", "位置", "标签", "课程名称"
      ]
      
      example_rows = [
        ["什么是向量", "向量的基本概念定义", "global", "1", "基础概念,向量", "线性代数"],
        ["向量加法的性质", "向量加法的交换律和结合律", "concept", "2", "运算,性质", "线性代数"],
        ["如何计算向量点积", "向量点积的计算步骤和方法", "method", "3", "计算,点积", "线性代数"]
      ]

      # Convert to XLSX format using Elixlsx
      sheet = %Elixlsx.Sheet{
        name: "Questions",
        rows: [headers | example_rows]
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