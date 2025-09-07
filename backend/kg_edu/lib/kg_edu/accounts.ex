defmodule KgEdu.Accounts do
  use Ash.Domain, otp_app: :kg_edu, extensions: [AshAdmin.Domain, AshJsonApi.Domain, AshPhoenix]

  admin do
    show? true
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
    resource KgEdu.Accounts.User
  end
end
