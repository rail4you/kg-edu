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
      # 说明行
      comment_row = [
        "使用说明：\n1.A到C列按标题进行正确填写\n2.分数填写标准：0-100"
      ]

      # 表头行
      headers = [
        "作业内容",
        "成绩",
        "答案"
      ]

      example_rows = [
        ["什么是色彩的明度对比？请列举2种明度对比的应用场景。", "10", "色彩的明度对比，指不同色彩之间或同一色彩不同深浅之间的明暗差异。"]
      ]

      # Convert to XLSX format using Elixlsx
      sheet = %Elixlsx.Sheet{
        name: "Sheet1",
        rows: [comment_row, headers | example_rows]
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
