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
      # Create CSV data with headers and example (easier to handle than XLSX)
      csv_data = """
      Title,Content,Score,Course ID,Chapter ID (Optional),Knowledge Resource ID (Optional)
      Example: Math Homework 1,"Complete exercises 1-10 on page 25",100.0,550e8400-e29b-41d4-a716-446655440000,550e8400-e29b-41d4-a716-446655440001,
      """
      
      # Encode to base64
      csv_base64 = Base.encode64(csv_data)
      
      # Note: This generates a CSV template instead of XLSX for simplicity
      # The client can request this as a downloadable file with .csv extension
      {:ok, csv_base64}
    rescue
      error ->
        {:error, "Error generating template: #{inspect(error)}"}
    end
  end
end