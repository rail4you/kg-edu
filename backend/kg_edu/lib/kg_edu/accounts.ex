defmodule KgEdu.Accounts do
  use Ash.Domain, otp_app: :kg_edu, extensions: [AshAdmin.Domain, AshJsonApi.Domain]

  admin do
    show? true
  end

  json_api do
    routes do
      # User authentication endpoints
      base_route "/users", KgEdu.Accounts.User do
        post :register_with_password
        post :sign_in_with_password
        patch :reset_password_with_token
        get :get_current_user
        patch :change_password
      end
    end
  end

  resources do
    resource KgEdu.Accounts.Token
    resource KgEdu.Accounts.User
  end
end
