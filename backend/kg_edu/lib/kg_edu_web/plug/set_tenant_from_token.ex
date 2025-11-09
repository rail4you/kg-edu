defmodule KgEduWeb.Plug.SetTenantFromToken do
  @moduledoc """
  Plug to extract tenant and user information from JWT token and set it in the connection and Ash context.
  """
  import Plug.Conn

  def init(opts), do: opts

  def call(conn, _opts) do
    case get_auth_token(conn) do
      {:ok, token} ->
        # Try to decode JWT manually to avoid Ash's validation issues
        case decode_jwt_manually(token) do
          {:ok, %{"tenant" => tenant, "sub" => subject}} when not is_nil(tenant) and not is_nil(subject) ->
            # Extract user ID from subject (format: "user?id=<uuid>")
            user_id = extract_user_id_from_subject(subject)

            # Load user with tenant context
            case load_user_with_tenant(user_id, tenant) do
              {:ok, user} ->
                # Set tenant and user info in connection
                conn
                |> put_private(:ash_tenant, tenant)
                |> assign(:ash_tenant, tenant)
                |> assign(:current_user, user)  # Set user for set_actor plug
                |> put_private(:ash_context, %{tenant: tenant, actor: user})
                |> put_private(:ash_actor, user)
              {:error, reason} ->
                # User loading failed, log and set tenant only
                require Logger
                Logger.error("Failed to load user #{user_id} in tenant #{tenant}: #{inspect(reason)}")
                conn
                |> put_private(:ash_tenant, tenant)
                |> assign(:ash_tenant, tenant)
                |> put_private(:ash_context, %{tenant: tenant})
            end
          {:ok, %{"tenant" => tenant}} when not is_nil(tenant) ->
            # Token has tenant but no subject - just set tenant
            conn
            |> put_private(:ash_tenant, tenant)
            |> assign(:ash_tenant, tenant)
            |> put_private(:ash_context, %{tenant: tenant})
          {:ok, _token_data} ->
            # Token valid but no tenant or subject - continue without tenant
            conn
          {:error, reason} ->
            # Manual decode failed, try Ash's peek as fallback
            require Logger
            Logger.warn("Manual JWT decode failed: #{inspect(reason)}, trying Ash peek")
            case AshAuthentication.Jwt.peek(token) do
              {:ok, %{"tenant" => tenant}} when not is_nil(tenant) ->
                conn
                |> put_private(:ash_tenant, tenant)
                |> assign(:ash_tenant, tenant)
                |> put_private(:ash_context, %{tenant: tenant})
              {:ok, _} ->
                conn
              {:error, _reason} ->
                Logger.warn("Ash JWT peek failed: #{inspect(_reason)}")
                conn
            end
        end
      _ ->
        conn
    end
  end

  defp extract_user_id_from_subject("user?id=" <> user_id), do: user_id
  defp extract_user_id_from_subject(_), do: nil

  # Manual JWT decode to avoid Ash's validation issues
  defp decode_jwt_manually(token) do
    try do
      # Split token into parts
      [header_b64, payload_b64, _signature] = String.split(token, ".")

      # Decode payload (add padding if needed)
      payload_b64 = case rem(String.length(payload_b64), 4) do
        0 -> payload_b64
        2 -> payload_b64 <> "=="
        3 -> payload_b64 <> "="
        _ -> payload_b64
      end

      case Base.url_decode64(payload_b64, padding: false) do
        {:ok, payload_json} ->
          case Jason.decode(payload_json) do
            {:ok, claims} -> {:ok, claims}
            {:error, reason} -> {:error, "JSON decode error: #{reason}"}
          end
        {:error, reason} ->
          {:error, "Base64 decode error: #{reason}"}
      end
    rescue
      e ->
        {:error, "JWT decode error: #{inspect(e)}"}
    end
  end

  defp load_user_with_tenant(user_id, tenant) do
    case KgEdu.Accounts.User
         |> Ash.read(tenant: tenant) do
      {:ok, users} ->
        case Enum.find(users, &(&1.id == user_id)) do
          nil -> {:error, :not_found}
          user -> {:ok, user}
        end
      {:error, reason} -> {:error, reason}
    end
  end

  defp get_auth_token(conn) do
    case get_req_header(conn, "authorization") do
      ["Bearer " <> token] -> {:ok, token}
      [token] -> {:ok, token}
      _ -> :error
    end
  end
end