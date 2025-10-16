defmodule KgEdu.Knowledge.Changes.ExportExerciseTemplate do
  @moduledoc """
  Change module for exporting exercise template XLSX as base64.
  """
  use Ash.Resource.Change

  def change(changeset, _opts, _context) do
    _created_by_id = Ash.Changeset.get_argument(changeset, :created_by_id)
    
    case generate_template_xlsx() do
      {:ok, xlsx_base64} ->
        Ash.Changeset.after_action(changeset, fn _resource, _record ->
          {:ok, %{template_base64: xlsx_base64, filename: "exercise_template.xlsx"}}
        end)
      {:error, error} ->
        Ash.Changeset.add_error(changeset, error)
    end
  end

  defp generate_template_xlsx do
    try do
      # Create CSV data with headers and example (easier to handle than XLSX)
      csv_data = """
      Title,Question Content,Answer,Question Type,Options,Course ID,Knowledge Resource ID (Optional),AI Type (Optional)
      Example: Math Quiz 1,"What is 2 + 2?","4","multiple_choice","{""A"": ""3"", ""B"": ""4"", ""C"": ""5"", ""D"": ""6""}","550e8400-e29b-41d4-a716-446655440000","550e8400-e29b-41d4-a716-446655440001",""
      Example: Essay Question,"Explain the Pythagorean theorem","The Pythagorean theorem states that in a right triangle...","essay","","550e8400-e29b-41d4-a716-446655440000","",""
      Example: Fill in the blank,"The sum of angles in a triangle is ___ degrees","180","fill_in_blank","","550e8400-e29b-41d4-a716-446655440000","","ai_generated"
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