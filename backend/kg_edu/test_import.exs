#!/usr/bin/env elixir
alias KgEdu.OrganizationDataTransfer

export_file = "/tmp/kg_edu_export_fixed.json"
tenant = "org_c1d3065a_5af9_4df6_b790_50dfd40dfc19"

{:ok, body} = File.read(export_file)

try do
  case OrganizationDataTransfer.import(body, tenant) do
    {:ok, result} ->
      IO.puts("✅ IMPORT SUCCESS: #{inspect(result)}")

    {:error, reason} ->
      IO.puts("❌ IMPORT FAILED")
      IO.puts("   #{inspect(reason)}")
  end
rescue
  e ->
    IO.puts("💥 CRASH: #{Exception.message(e)}")
    IO.puts("   #{inspect(__STACKTRACE__)}")
end
