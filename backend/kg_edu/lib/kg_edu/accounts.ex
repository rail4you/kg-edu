defmodule KgEdu.Accounts do
  use Ash.Domain, otp_app: :kg_edu, extensions: [
    AshAdmin.Domain, AshJsonApi.Domain, AshPhoenix,
  AshTypescript.Rpc]

  admin do
    show? true
  end

  typescript_rpc do
    resource KgEdu.Accounts.User do
      rpc_action :sign_in, :sign_in_with_password
      rpc_action :register, :register_with_password
      rpc_action :create_user, :create_user
      rpc_action :reset_password, :reset_password_with_token
      rpc_action :change_password, :change_password
      rpc_action :get_current_user, :get_current_user
      rpc_action :update_user, :update
      rpc_action :delete_user, :destroy
      rpc_action :get_user, :by_id
      rpc_action :list_users, :get_users
      rpc_action :sign_out, :sign_out
      rpc_action :import_excel, :import_users_from_excel
    end
  end

  json_api do
    routes do
      # User authentication endpoints
      base_route "/users", KgEdu.Accounts.User do
        post :register_with_password do
          route "/register"

          metadata fn _subject, user, _request ->
            %{token: user.__metadata__.token}
          end
        end

        post :create_user do
          route "/create"
        end

        post :sign_in_with_password do
          route "/sign-in"

          metadata fn _subject, user, _request ->
            %{token: user.__metadata__.token}
          end
        end

        patch :reset_password_with_token, route: "/reset-password"
        get :get_current_user, route: "/me"
        patch :change_password, route: "/change-password"
        get :by_id, route: "/:id"
        patch :update, route: "/:id"
        delete :destroy, route: "/:id"
        index :get_users, route: "/"
      end
    end
  end

  resources do
    resource KgEdu.Accounts.Token
    resource KgEdu.Accounts.User do
      define :create_user , action: :create_user
    end
  end
end
