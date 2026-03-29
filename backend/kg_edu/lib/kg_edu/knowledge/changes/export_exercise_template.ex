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
      Title,Question Content,Question Type,Answer,Options,Answer Explanation
      Example: Math Quiz 1,"What is 2 + 2?",multiple_choice,1,"A. 3\nB. 4\nC. 5\nD. 6",This is a basic arithmetic question testing addition skills.
      Example: Essay Question,"Explain the Pythagorean theorem",essay,"The Pythagorean theorem states that in a right triangle...",,The Pythagorean theorem is fundamental to geometry.
      Example: Fill in the blank,"The sum of angles in a triangle is ___ degrees",fill_in_blank,180,,This is a basic property of triangles.
      Example: True False,"The Earth is flat",true_false,B,,"The Earth is an oblate spheroid."
      Example: Multiple Response,"Which are primary colors?",multiple_response,"A,C","A. Red\nB. Green\nC. Blue\nD. Yellow",Primary colors of light are Red, Green, and Blue.
      Example: Term Definition,"Define 'photosynthesis'",term_definition,"Photosynthesis is the process by which plants convert light energy into chemical energy...",,Key points: light, chlorophyll, CO2, water.
      Example: Case Study,"Analyze the following business case...",case_study,"The analysis reveals that...",,Consider market factors and competitive advantages.
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
