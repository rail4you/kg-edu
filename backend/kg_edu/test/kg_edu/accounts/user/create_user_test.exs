defmodule KgEdu.Accounts.User.CreateUserTest do
  use ExUnit.Case, async: true

  alias KgEdu.Accounts

  @moduletag :capture_log

  describe "create_user/1" do
    test "creates user with valid parameters" do
      params = %{
        member_id: "test_user_001",
        name: "Test User",
        email: "test111@example.com",
        password: "password1233dfdsafd",
        role: :user
      }

      {:ok, user} = Accounts.create_user(params)

      assert user.member_id == "test_user_001"
      assert user.name == "Test User"
      assert user.email == "test@example.com"
      assert user.role == :user
      assert user.hashed_password != nil
      assert user.hashed_password != "password123"  # Should be hashed
    end

    test "creates user with minimal parameters" do
      params = %{
        member_id: "minimal_user",
        password: "password123"
      }

      {:ok, user} = Accounts.create_user(params)

      assert user.member_id == "minimal_user"
      assert user.name == nil
      assert user.email == nil
      assert user.role == :user  # Default role
      assert user.hashed_password != nil
    end

    test "creates user with admin role" do
      params = %{
        member_id: "admin_user",
        name: "Admin User",
        password: "admin123",
        role: :admin
      }

      {:ok, user} = Accounts.create_user(params)

      assert user.role == :admin
    end

    test "creates user with teacher role" do
      params = %{
        member_id: "teacher_user",
        name: "Teacher User",
        password: "teacher123",
        role: :teacher
      }

      {:ok, user} = Accounts.create_user(params)

      assert user.role == :teacher
    end

    test "returns error for missing member_id" do
      params = %{
        name: "Test User",
        password: "password123"
      }

      assert {:error, _reason} = Accounts.create_user(params)
    end

    test "returns error for missing password" do
      params = %{
        member_id: "test_user",
        name: "Test User"
      }

      assert {:error, _reason} = Accounts.create_user(params)
    end

    test "returns error for short password" do
      params = %{
        member_id: "test_user",
        password: "123"  # Too short
      }

      assert {:error, _reason} = Accounts.create_user(params)
    end

    test "returns error for invalid email format" do
      params = %{
        member_id: "test_user",
        email: "invalid_email",
        password: "password123"
      }

      assert {:error, _reason} = Accounts.create_user(params)
    end

    test "returns error for duplicate member_id" do
      # Create first user
      params1 = %{
        member_id: "duplicate_user",
        password: "password123"
      }

      {:ok, _user1} = Accounts.create_user(params1)

      # Try to create second user with same member_id
      params2 = %{
        member_id: "duplicate_user",
        password: "password456"
      }

      assert {:error, _reason} = Accounts.create_user(params2)
    end

    test "returns error for invalid role" do
      params = %{
        member_id: "test_user",
        password: "password123",
        role: :invalid_role
      }

      assert {:error, _reason} = Accounts.create_user(params)
    end
  end
end
