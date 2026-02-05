# Simple test to check the structure
json = File.read!("content.json")
root_topic = json
|> Jason.decode!()
|> Enum.find(fn item -> Map.get(item, "class") == "sheet" end)
|> Map.get("rootTopic")

IO.puts("Root topic: #{Map.get(root_topic, "title")}")
children = Map.get(root_topic, "children") |> Map.get("attached", [])
IO.puts("Children count: #{length(children)}")

Enum.each(children, fn child ->
  IO.puts("  - #{Map.get(child, "title")}")
  grandchildren = Map.get(child, "children") |> Map.get("attached", [])
  IO.puts("    Has #{length(grandchildren)} children")
end)
