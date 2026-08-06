defmodule KgEdu.Accounts.EditPermissionTest do
  use ExUnit.Case, async: true

  alias KgEdu.Accounts.EditPermission

  @today ~D[2026-08-05]

  defp teacher(overrides \\ %{}) do
    Map.merge(
      %{
        role: :teacher,
        edit_enabled: true,
        edit_period_start: nil,
        edit_period_end: nil
      },
      overrides
    )
  end

  describe "status/2" do
    test "nil actor is not applicable" do
      assert EditPermission.status(nil, @today) == :not_applicable
    end

    test "super_admin and student roles are not applicable" do
      assert EditPermission.status(teacher(%{role: :super_admin}), @today) == :not_applicable
      assert EditPermission.status(teacher(%{role: :user}), @today) == :not_applicable
    end

    test "teacher without period is editable" do
      assert EditPermission.status(teacher(), @today) == :ok
    end

    test "admin without period is editable" do
      assert EditPermission.status(teacher(%{role: :admin}), @today) == :ok
    end

    test "teacher with edit_enabled false is locked as disabled" do
      assert EditPermission.status(teacher(%{edit_enabled: false}), @today) ==
               {:locked, :disabled}
    end

    test "admin with edit_enabled false is locked as disabled" do
      assert EditPermission.status(teacher(%{role: :admin, edit_enabled: false}), @today) ==
               {:locked, :disabled}
    end

    test "teacher before period start is locked as not_started" do
      actor = teacher(%{edit_period_start: ~D[2026-09-01]})
      assert EditPermission.status(actor, @today) == {:locked, :not_started}
    end

    test "admin before period start is locked as not_started" do
      actor = teacher(%{role: :admin, edit_period_start: ~D[2026-09-01]})
      assert EditPermission.status(actor, @today) == {:locked, :not_started}
    end

    test "teacher after period end is locked as expired" do
      actor = teacher(%{edit_period_end: ~D[2026-01-01]})
      assert EditPermission.status(actor, @today) == {:locked, :expired}
    end

    test "admin after period end is locked as expired" do
      actor = teacher(%{role: :admin, edit_period_end: ~D[2026-01-01]})
      assert EditPermission.status(actor, @today) == {:locked, :expired}
    end

    test "teacher inside the window is editable" do
      actor =
        teacher(%{
          edit_period_start: ~D[2026-01-01],
          edit_period_end: ~D[2026-12-31]
        })

      assert EditPermission.status(actor, @today) == :ok
    end

    test "admin inside the window is editable" do
      actor =
        teacher(%{
          role: :admin,
          edit_period_start: ~D[2026-01-01],
          edit_period_end: ~D[2026-12-31]
        })

      assert EditPermission.status(actor, @today) == :ok
    end

    test "boundary dates: start today and end today are both editable" do
      actor = teacher(%{edit_period_start: @today, edit_period_end: @today})
      assert EditPermission.status(actor, @today) == :ok
    end
  end

  describe "readonly?/2 and ensure_editable!/2" do
    test "readonly? reflects locked status" do
      assert EditPermission.readonly?(teacher(%{edit_enabled: false}), @today)
      refute EditPermission.readonly?(teacher(), @today)
      refute EditPermission.readonly?(teacher(%{role: :user}), @today)
    end

    test "ensure_editable! returns :ok for editable actors" do
      assert EditPermission.ensure_editable!(teacher(), @today) == :ok
      assert EditPermission.ensure_editable!(nil, @today) == :ok
      assert EditPermission.ensure_editable!(teacher(%{role: :admin}), @today) == :ok
    end

    test "ensure_editable! returns error message for locked teacher" do
      assert {:error, message} =
               EditPermission.ensure_editable!(teacher(%{edit_enabled: false}), @today)

      assert message =~ "编辑权限"
    end
  end

  describe "message/1" do
    test "provides a message for each lock reason" do
      assert EditPermission.message(:disabled) =~ "关闭"
      assert EditPermission.message(:not_started) =~ "未到"
      assert EditPermission.message(:expired) =~ "到期"
    end
  end
end
