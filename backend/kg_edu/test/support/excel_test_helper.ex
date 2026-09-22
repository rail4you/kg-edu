defmodule KgEdu.Test.ExcelTestHelper do
  @moduledoc """
  Helper module for creating real Excel (.xlsx) files for testing (via Elixlsx).
  """

  @doc """
  Build a real .xlsx binary from rows (list of lists).
  """
  def create_test_excel_binary(rows) do
    sheet = %Elixlsx.Sheet{name: "Sheet1", rows: rows}
    wb = %Elixlsx.Workbook{sheets: [sheet]}

    case Elixlsx.write_to_memory(wb, "test_excel") do
      {:ok, {_filename, binary}} -> binary
      {:error, reason} -> raise "failed to build test xlsx: #{inspect(reason)}"
    end
  end

  @doc """
  Create test Excel file and return base64 encoded content.
  """
  def create_test_excel_base64(rows \\ nil) do
    rows =
      rows ||
        [
          ["Comment row - this should be ignored"],
          ["name", "age"],
          ["Alice", 25],
          ["Bob", 30],
          ["Charlie", 35],
          ["Diana", 28]
        ]

    rows |> create_test_excel_binary() |> Base.encode64()
  end
end
