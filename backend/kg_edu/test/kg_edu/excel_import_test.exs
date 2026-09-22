defmodule KgEdu.ExcelImportTest do
  @moduledoc """
  Excel 导入测试 — 用 Elixlsx 生成真 .xlsx（实现只接受真 xlsx，不再兼容 CSV）。
  """
  use ExUnit.Case, async: true

  alias KgEdu.ExcelImport
  alias KgEdu.Test.ExcelTestHelper

  @moduletag :capture_log

  describe "import_from_excel/2" do
    test "imports real xlsx with header mapping" do
      b64 =
        ExcelTestHelper.create_test_excel_base64([
          ["Comment row - this should be ignored"],
          ["name", "age"],
          ["Alice", 25],
          ["Bob", 30],
          ["Charlie", 35],
          ["Diana", 28]
        ])

      assert {:ok, result} = ExcelImport.import_from_excel(b64, ["name", "age"])
      assert length(result) == 4
      assert Enum.at(result, 0) == %{"name" => "Alice", "age" => 25}
      assert Enum.at(result, 3) == %{"name" => "Diana", "age" => 28}
    end

    test "handles empty excel file" do
      base64_content = Base.encode64("")

      assert {:error, _reason} = ExcelImport.import_from_excel(base64_content, ["name", "age"])
    end

    test "handles invalid base64 data" do
      invalid_base64 = "invalid_base64_string!!!"

      assert {:error, _reason} = ExcelImport.import_from_excel(invalid_base64, ["name", "age"])
    end

    test "extra columns beyond requested attributes are ignored" do
      b64 =
        ExcelTestHelper.create_test_excel_base64([
          ["Comment row"],
          ["name", "age", "city", "country"],
          ["Alice", 25, "NYC", "USA"],
          ["Bob", 30, "LA", "USA"]
        ])

      assert {:ok, result} = ExcelImport.import_from_excel(b64, ["name", "age"])
      assert length(result) == 2
      assert Enum.at(result, 0) == %{"name" => "Alice", "age" => 25}
    end

    test "handles empty string values as nil" do
      b64 =
        ExcelTestHelper.create_test_excel_base64([
          ["Comment row"],
          ["name", "age"],
          ["Alice", nil],
          [nil, 30],
          ["Charlie", 35]
        ])

      assert {:ok, result} = ExcelImport.import_from_excel(b64, ["name", "age"])
      assert Enum.at(result, 0) == %{"name" => "Alice", "age" => nil}
      assert Enum.at(result, 1) == %{"name" => nil, "age" => 30}
      assert Enum.at(result, 2) == %{"name" => "Charlie", "age" => 35}
    end
  end

  describe "parse_excel_file/2" do
    test "returns error for nonexistent file" do
      assert {:error, _reason} = ExcelImport.parse_excel_file("nonexistent.xlsx", ["name", "age"])
    end
  end

  describe "value types" do
    test "keeps integers as integers" do
      b64 =
        ExcelTestHelper.create_test_excel_base64([
          ["Comment row"],
          ["name", "age", "score"],
          ["Alice", 25, 100],
          ["Bob", 30, 95]
        ])

      assert {:ok, result} = ExcelImport.import_from_excel(b64, ["name", "age", "score"])
      assert Enum.at(result, 0) == %{"name" => "Alice", "age" => 25, "score" => 100}
      assert is_integer(Enum.at(result, 0)["age"])
      assert is_integer(Enum.at(result, 0)["score"])
    end

    test "keeps floats as floats" do
      b64 =
        ExcelTestHelper.create_test_excel_base64([
          ["Comment row"],
          ["name", "height", "weight"],
          ["Alice", 5.5, 120.5],
          ["Bob", 6.0, 180.0]
        ])

      assert {:ok, result} = ExcelImport.import_from_excel(b64, ["name", "height", "weight"])
      assert Enum.at(result, 0) == %{"name" => "Alice", "height" => 5.5, "weight" => 120.5}
      assert is_float(Enum.at(result, 0)["height"])
      assert is_float(Enum.at(result, 0)["weight"])
    end
  end
end
