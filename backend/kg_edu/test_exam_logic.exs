#!/usr/bin/env elixir

# Test script for new exam logic
# This script tests:
# 1. Students cannot start a new exam if they have incomplete exams
# 2. continue_or_start_exam returns existing in-progress exam
# 3. get_in_progress_exam returns exam with answers

defmodule ExamLogicTest do
  @moduledoc """
  Test script for the new exam logic
  """

  def run do
    IO.puts("\n=== Testing New Exam Logic ===\n")

    # Start the application
    Application.ensure_all_started(:kg_edu)

    # You need to provide a valid tenant and test data
    tenant = "your_tenant_here"
    student_id = "your_student_id_here"
    exam_id = "your_exam_id_here"

    IO.puts("Testing with:")
    IO.puts("  Tenant: #{tenant}")
    IO.puts("  Student ID: #{student_id}")
    IO.puts("  Exam ID: #{exam_id}")
    IO.puts("")

    # Test 1: Try to start an exam
    IO.puts("Test 1: Starting an exam...")
    start_exam_test(student_id, exam_id, tenant)

    # Test 2: Try to start another exam (should fail)
    IO.puts("\nTest 2: Trying to start a second exam (should fail)...")
    start_second_exam_test(student_id, exam_id, tenant)

    # Test 3: Use continue_or_start_exam
    IO.puts("\nTest 3: Using continue_or_start_exam...")
    continue_or_start_exam_test(student_id, exam_id, tenant)

    # Test 4: Get in-progress exam with answers
    IO.puts("\nTest 4: Getting in-progress exam with answers...")
    get_in_progress_exam_test(student_id, tenant)

    IO.puts("\n=== Tests Complete ===\n")
  end

  defp start_exam_test(student_id, exam_id, tenant) do
    case KgEdu.Knowledge.StudentExam.start_exam(
           %{exam_id: exam_id, student_id: student_id},
           tenant: tenant
         ) do
      {:ok, student_exam} ->
        IO.puts("  ✓ Exam started successfully")
        IO.puts("    Student Exam ID: #{student_exam.id}")
        IO.puts("    Status: #{student_exam.status}")

      {:error, reason} ->
        IO.puts("  ✗ Failed to start exam: #{inspect(reason)}")
    end
  end

  defp start_second_exam_test(student_id, exam_id, tenant) do
    # Try to start another exam - should fail if there's an in-progress one
    case KgEdu.Knowledge.StudentExam.start_exam(
           %{exam_id: exam_id, student_id: student_id},
           tenant: tenant
         ) do
      {:ok, _student_exam} ->
        IO.puts("  ✗ Second exam started (should have failed!)")

      {:error, reason} ->
        IO.puts("  ✓ Correctly prevented starting second exam")
        IO.puts("    Reason: #{inspect(reason)}")
    end
  end

  defp continue_or_start_exam_test(student_id, exam_id, tenant) do
    case KgEdu.Knowledge.StudentExam.continue_or_start_exam(
           %{
             exam_id: exam_id,
             student_id: student_id
           },
           tenant: tenant
         ) do
      {:ok, student_exam} ->
        IO.puts("  ✓ continue_or_start_exam succeeded")
        IO.puts("    Student Exam ID: #{student_exam.id}")
        IO.puts("    Status: #{student_exam.status}")
        IO.puts("    Has answers: #{length(student_exam.student_exam_answers) > 0}")

      {:error, reason} ->
        IO.puts("  ✗ Failed: #{inspect(reason)}")
    end
  end

  defp get_in_progress_exam_test(student_id, tenant) do
    case KgEdu.Knowledge.StudentExam.get_in_progress_exam(
           %{
             student_id: student_id
           },
           tenant: tenant
         ) do
      {:ok, student_exam} ->
        IO.puts("  ✓ Retrieved in-progress exam")
        IO.puts("    Exam ID: #{student_exam.exam_id}")
        IO.puts("    Status: #{student_exam.status}")
        IO.puts("    Started at: #{student_exam.started_at}")
        IO.puts("    Number of answers: #{length(student_exam.student_exam_answers)}")

        # Show some answer details
        if length(student_exam.student_exam_answers) > 0 do
          first_answer = List.first(student_exam.student_exam_answers)
          IO.puts("    First answer ID: #{first_answer.id}")
          IO.puts("    First answer value: #{first_answer.answer || "(empty)"}")
        end

      {:error, :not_found} ->
        IO.puts("  ℹ No in-progress exam found")

      {:error, reason} ->
        IO.puts("  ✗ Failed: #{inspect(reason)}")
    end
  end
end

# Run the tests
ExamLogicTest.run()
