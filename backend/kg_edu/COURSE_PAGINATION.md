# Course Pagination Implementation

## ✅ Correct Implementation (Using Ash's Built-in Pagination)

The Course resource now uses Ash Framework's built-in pagination configuration, which is the recommended approach.

## Configuration

The pagination is configured in `lib/kg_edu/courses/course.ex`:

```elixir
read :read do
  primary? true

  pagination do
    required?(false)  # Pagination is optional
    offset?(true)     # Enable offset pagination (limit/offset)
    keyset?(true)     # Enable keyset pagination (after/before)
    countable(true)   # Allow counting total records
  end

  prepare fn query, context ->
    # ... role-based filtering logic ...
  end
end
```

## Usage Examples

### 1. Offset Pagination (limit/offset)

```elixir
# Get first 10 courses
page = KgEdu.Courses.Course.list_courses!(
  actor: current_user,
  page: [limit: 10, offset: 0]
)

# Returns: %Ash.Page.Offset{results: [...], limit: 10, offset: 0, more?: true, count: nil}
```

### 2. Keyset Pagination (default)

```elixir
# Get first page (uses keyset by default if supported)
page = KgEdu.Courses.Course.list_courses!(
  actor: current_user,
  page: [limit: 10]
)

# Returns: %Ash.Page.Keyset{results: [...], limit: 10, more?: true, after: "...", count: nil}
```

### 3. Pagination with Count

```elixir
# Get page with total count
page = KgEdu.Courses.Course.list_courses!(
  actor: current_user,
  page: [limit: 10, count: true]
)

# Access the count
total_count = page.count  # Total number of courses
current_results = page.results  # Current page results
```

### 4. Page Navigation

```elixir
# Get first page
first_page = KgEdu.Courses.Course.list_courses!(
  actor: current_user,
  page: [limit: 10]
)

# Navigate to next page
next_page = Ash.page!(first_page, :next)

# Navigate to previous page
prev_page = Ash.page!(next_page, :prev)

# Check if more pages available
if first_page.more? do
  # There are more pages
end
```

### 5. Keyset Navigation

```elixir
# Get first page
page = KgEdu.Courses.Course.list_courses!(
  actor: current_user,
  page: [limit: 10]
)

# Get the last result's keyset
last_result = List.last(page.results)
keyset = last_result.__metadata__.keyset

# Get next page using keyset
next_page = KgEdu.Courses.Course.list_courses!(
  actor: current_user,
  page: [limit: 10, after: keyset]
)
```

## Return Types

### Without Pagination
```elixir
courses = KgEdu.Courses.Course.list_courses!(actor: current_user)
# Returns: [%Course{}, %Course{}, ...] - a list of records
```

### With Offset Pagination
```elixir
page = KgEdu.Courses.Course.list_courses!(actor: current_user, page: [limit: 10])
# Returns: %Ash.Page.Offset{
#   results: [%Course{}, ...],
#   limit: 10,
#   offset: 0,
#   more?: true,
#   count: nil
# }
```

### With Keyset Pagination
```elixir
page = KgEdu.Courses.Course.list_courses!(actor: current_user, page: [limit: 10])
# Returns: %Ash.Page.Keyset{
#   results: [%Course{}, ...],
#   limit: 10,
#   more?: true,
#   after: "g2wAAAACbQAAAA...",
#   before: nil,
#   count: nil
# }
```

## API Integration

### JSON:API Example

When using JSON:API endpoints, pagination parameters are passed as query parameters:

```bash
# Offset pagination
GET /api/courses?page[limit]=10&page[offset]=0

# Keyset pagination
GET /api/courses?page[limit]=10&page[after]=g2wAAAACbQAAAA...

# With count
GET /api/courses?page[limit]=10&page[count]=true
```

### Phoenix LiveView Example

```elixir
def handle_event("paginate", %{"page" => page_num}, socket) do
  page = KgEdu.Courses.Course.list_courses!(
    actor: socket.assigns.current_user,
    page: [limit: 10, offset: (String.to_integer(page_num) - 1) * 10]
  )

  {:noreply, assign(socket, :courses, page.results)}
end
```

## Benefits of Ash Pagination

1. **Built-in Support**: No need to manually implement pagination logic
2. **Type Safety**: Returns structured page objects with metadata
3. **Flexibility**: Supports both offset and keyset pagination
4. **Performance**: Keyset pagination performs better on large datasets
5. **Consistency**: Same API across all Ash resources
6. **Counting**: Optional total count for pagination UI
7. **Navigation**: Built-in `Ash.page!/2` for easy page navigation

## Testing

Run the pagination test:

```bash
mix run test_ash_pagination.exs
```

This will demonstrate:
- Offset pagination
- Keyset pagination
- Pagination with count
- Page navigation

## Migration from Custom Implementation

If you were using custom pagination before:

**Before (incorrect)**:
```elixir
argument :page, :integer
argument :page_size, :integer
# Manual pagination in prepare function
query |> Ash.Query.limit(page_size) |> Ash.Query.offset((page - 1) * page_size)
```

**After (correct)**:
```elixir
pagination do
  required?(false)
  offset?(true)
  keyset?(true)
  countable(true)
end
# Ash handles pagination automatically when you pass page: [...] options
```

## Important Notes

1. **No Manual Arguments**: Don't add `:page`, `:page_size`, `:limit`, or `:offset` arguments manually
2. **Use `page` Option**: Pass pagination options as a keyword list to the `:page` option
3. **Return Type Change**: With pagination, actions return `Ash.Page.Offset` or `Ash.Page.Keyset`, not a list
4. **Access Results**: Results are in the `results` field of the page struct
5. **Role-Based Filtering**: Pagination works correctly with role-based filtering in the prepare function

## Further Reading

- [Ash Pagination Documentation](https://hexdocs.pm/ash/pagination.html)
- [Ash.Page.Offset](https://hexdocs.pm/ash/Ash.Page.Offset.html)
- [Ash.Page.Keyset](https://hexdocs.pm/ash/Ash.Page.Keyset.html)
