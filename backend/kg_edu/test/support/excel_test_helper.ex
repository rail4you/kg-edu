defmodule KgEdu.Test.ExcelTestHelper do
  @moduledoc """
  Helper module for creating Excel files for testing.
  """
  
  @doc """
  Create a test Excel file with sample data.
  Returns the file path.
  """
  def create_test_excel_file(data \\ nil) do
    # Default test data
    test_data = data || [
      ["Comment row - this should be ignored"],
      ["name", "age"],
      ["Alice", "25"],
      ["Bob", "30"],
      ["Charlie", "35"],
      ["Diana", "28"]
    ]
    
    # Create CSV file for testing (simpler than creating actual Excel)
    csv_content = test_data
                  |> Enum.map_join("\n", &Enum.join(&1, ","))
    
    temp_path = System.tmp_dir!() |> Path.join("test_excel_#{System.system_time()}.csv")
    File.write!(temp_path, csv_content)
    
    temp_path
  end
  
  @doc """
  Create test Excel file and return base64 encoded content.
  """
  def create_test_excel_base64(data \\ nil) do
    temp_path = create_test_excel_file(data)
    
    base64_content = File.read!(temp_path) |> Base.encode64()
    File.rm(temp_path)
    
    base64_content
  end
  
  @doc """
  Clean up test files.
  """
  def cleanup_test_file(file_path) do
    if File.exists?(file_path) do
      File.rm(file_path)
    end
  end
end