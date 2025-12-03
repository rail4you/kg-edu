defmodule KgEdu.TenantManager do
  @moduledoc """
  Utilities for managing tenant context, especially for super admins.
  """

  alias KgEdu.Accounts.Organization
  alias KgEdu.Accounts.User

  @doc """
  Switch tenant context for operations
  """
  def switch_tenant(tenant_id) do
    case Organization |> Ash.get(tenant_id) do
      {:ok, organization} ->
        {:ok, organization.schema_name}
      {:error, _} ->
        {:error, :tenant_not_found}
    end
  end

  @doc """
  Get all available tenants
  """
  def list_tenants do
    Organization
    |> Ash.read!()
    |> Enum.map(&%{id: &1.id, name: &1.name, schema_name: &1.schema_name})
  end

  @doc """
  Create a user in a specific tenant
  """
  def create_user_in_tenant(user_attrs, tenant_id, current_user) do
    # Verify current user is super admin
    if current_user.role == :super_admin do
      KgEdu.Accounts.User.create_user_in_tenant(Map.put(user_attrs, :tenant_id, tenant_id))
    else
      {:error, :unauthorized}
    end
  end

  @doc """
  Get users from a specific tenant
  """
  def list_users_from_tenant(tenant_id, current_user) do
    # Verify current user is super admin
    if current_user.role == :super_admin do
      KgEdu.Accounts.User.get_users_from_tenant(%{tenant_id: tenant_id})
    else
      {:error, :unauthorized}
    end
  end

  @doc """
  Check if user can access tenant
  """
  def can_access_tenant?(%KgEdu.Accounts.User{role: :super_admin}, _tenant_id), do: true
  def can_access_tenant?(%KgEdu.Accounts.User{}, _tenant_id), do: false

  @doc """
  Get tenant schema name for Ash operations
  """
  def get_tenant_schema(tenant_id) when is_binary(tenant_id) do
    case Organization |> Ash.get(tenant_id) do
      {:ok, organization} ->
        {:ok, organization.schema_name}
      {:error, _} ->
        {:error, :tenant_not_found}
    end
  end

  def get_tenant_schema(nil), do: {:ok, nil}
end