defmodule KgEdu.Accounts.User.RefreshSessionTest do
  use ExUnit.Case, async: true

  alias KgEdu.Accounts.User

  describe "refresh_session/1 - action definition" do
    test "action exists and accepts token argument" do
      # 验证 action 定义正确
      action = Ash.Resource.Info.action(User, :refresh_session)
      assert action != nil
      assert action.type == :action
      assert action.returns == Ash.Type.Map

      token_arg = Enum.find(action.arguments, &(&1.name == :token))
      assert token_arg != nil
      assert token_arg.allow_nil? == false
    end
  end

  describe "refresh_session/1 - invalid tokens" do
    test "returns error for malformed token" do
      result =
        User
        |> Ash.ActionInput.for_action(:refresh_session, %{token: "invalid_token_123"})
        |> Ash.run_action()

      assert {:error, _reason} = result
    end

    test "returns error for empty token string" do
      result =
        User
        |> Ash.ActionInput.for_action(:refresh_session, %{token: ""})
        |> Ash.run_action()

      assert {:error, _reason} = result
    end
  end
end
