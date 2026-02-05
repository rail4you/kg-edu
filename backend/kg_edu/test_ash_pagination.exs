#!/usr/bin/env elixir

# Test script for Course pagination using Ash's built-in pagination
# This demonstrates the correct way to use Ash pagination

defmodule CoursePaginationTest do
  @moduledoc """
  Test Ash pagination for Course resource.

  According to Ash documentation, pagination is configured in the resource
  using the `pagination` DSL block. When you call the read action with the
  `:page` option, it returns an `Ash.Page.Offset` or `Ash.Page.Keyset` struct.

  Usage examples:
    # Offset pagination (limit/offset)
    page = Course.list_courses!(page: [limit: 10, offset: 0])

    # Keyset pagination (after/before)
    page = Course.list_courses!(page: [limit: 10])

    # With count
    page = Course.list_courses!(page: [limit: 10, count: true])

    # Navigate pages
    next_page = Ash.page!(page, :next)
  """

  def test_pagination do
    IO.puts("\n=== Testing Ash Pagination for Courses ===\n")

    # Test 1: Offset pagination with limit and offset
    test_offset_pagination()

    # Test 2: Keyset pagination
    test_keyset_pagination()

    # Test 3: Pagination with count
    test_pagination_with_count()

    # Test 4: Page navigation
    test_page_navigation()

    IO.puts("\n=== All pagination tests completed ===\n")
  end

  defp test_offset_pagination do
    IO.puts("Test 1: Offset Pagination (limit/offset)")
    IO.puts("------------------------------------------")

    # Get first page with limit 5
    case KgEdu.Courses.Course.list_courses!(actor: nil, page: [limit: 5, offset: 0]) do
      %Ash.Page.Offset{} = page ->
        IO.puts("✓ Got offset page with #{length(page.results)} results")
        IO.puts("  Limit: #{page.limit}")
        IO.puts("  Offset: #{page.offset}")
        IO.puts("  More?: #{page.more?}")

        if length(page.results) > 0 do
          first_course = List.first(page.results)
          IO.puts("  First course: #{first_course.name}")
        end

      other ->
        IO.puts("✗ Unexpected result type: #{inspect(other)}")
    end
  end

  defp test_keyset_pagination do
    IO.puts("\nTest 2: Keyset Pagination")
    IO.puts("---------------------------")

    # Get first page with limit 5 (uses default keyset)
    case KgEdu.Courses.Course.list_courses!(actor: nil, page: [limit: 5]) do
      %Ash.Page.Keyset{} = page ->
        IO.puts("✓ Got keyset page with #{length(page.results)} results")
        IO.puts("  Limit: #{page.limit}")
        IO.puts("  More?: #{page.more?}")

        if length(page.results) > 0 do
          last_result = List.last(page.results)
          keyset = last_result.__metadata__.keyset
          IO.puts("  Last result keyset: #{String.slice(keyset, 0..20)}...")

          # Get next page using the keyset
          case KgEdu.Courses.Course.list_courses!(actor: nil, page: [limit: 5, after: keyset]) do
            %Ash.Page.Keyset{} = next_page ->
              IO.puts("✓ Next page has #{length(next_page.results)} results")
            _ ->
              IO.puts("✗ Failed to get next page")
          end
        end

      %Ash.Page.Offset{} = page ->
        IO.puts("ℹ Got offset page instead (system may be configured to use offset by default)")
        IO.puts("  Results: #{length(page.results)}")

      other ->
        IO.puts("✗ Unexpected result type: #{inspect(other)}")
    end
  end

  defp test_pagination_with_count do
    IO.puts("\nTest 3: Pagination with Count")
    IO.puts("--------------------------------")

    case KgEdu.Courses.Course.list_courses!(actor: nil, page: [limit: 5, count: true]) do
      %Ash.Page.Offset{count: count} = page when not is_nil(count) ->
        IO.puts("✓ Total count: #{count}")
        IO.puts("  Current page: #{length(page.results)} results")
        IO.puts("  More pages?: #{page.more?}")

      %Ash.Page.Keyset{count: count} = page when not is_nil(count) ->
        IO.puts("✓ Total count: #{count}")
        IO.puts("  Current page: #{length(page.results)} results")
        IO.puts("  More pages?: #{page.more?}")

      _ ->
        IO.puts("✗ Count not available")
    end
  end

  defp test_page_navigation do
    IO.puts("\nTest 4: Page Navigation using Ash.page!/2")
    IO.puts("--------------------------------------------")

    # Get first page
    case KgEdu.Courses.Course.list_courses!(actor: nil, page: [limit: 3]) do
      page when is_struct(page, Ash.Page.Offset) or is_struct(page, Ash.Page.Keyset) ->
        IO.puts("✓ First page has #{length(page.results)} results")
        IO.puts("  More?: #{page.more?}")

        # Try to navigate to next page
        if page.more? do
          case Ash.page!(page, :next) do
            next_page when is_struct(next_page, Ash.Page.Offset) or is_struct(next_page, Ash.Page.Keyset) ->
              IO.puts("✓ Next page has #{length(next_page.results)} results")

              if length(next_page.results) > 0 do
                first_result = List.first(next_page.results)
                IO.puts("  First result: #{first_result.name}")
              end

            error ->
              IO.puts("✗ Failed to navigate to next page: #{inspect(error)}")
          end
        else
          IO.puts("ℹ No more pages available")
        end

      error ->
        IO.puts("✗ Failed to get first page: #{inspect(error)}")
    end
  end
end

# Run the tests
CoursePaginationTest.test_pagination()
