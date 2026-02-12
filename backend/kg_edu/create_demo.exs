#!/usr/bin/env elixir

# Create demo.xlsx file with sample data
Mix.install([{:xlsxir, "~> 1.6"}])

# Since xlsxir doesn't have Excel writing capabilities, 
# let's create a simple CSV file that can be saved as Excel manually
# Or we'll create the Excel file structure using a different approach

# For now, let's create a simple text file with the data structure
# that represents what would be in the Excel file

demo_data = [
  # First row (comment)
  ["Comment row - this should be ignored"],
  # Header row
  ["name", "age"],
  # Data row 1
  ["Alice", "25"],
  # Data row 2
  ["Bob", "30"],
  # Data row 3
  ["Charlie", "35"],
  # Data row 4
  ["Diana", "28"]
]

# Create a CSV format file that can be opened in Excel
File.write!("demo.csv", demo_data |> Enum.map_join("\n", &Enum.join(&1, ",")))

IO.puts("demo.csv created successfully! You can save this as demo.xlsx in Excel.")
