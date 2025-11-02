defmodule KgEdu.Accounts do
  use Ash.Domain, otp_app: :kg_edu, extensions: [
    AshAdmin.Domain, AshJsonApi.Domain, AshPhoenix,
  AshTypescript.Rpc]

  admin do
    show? true
  end

  typescript_rpc do
    resource KgEdu.Accounts.User do
      rpc_action :sign_in, :sign_in_with_password, show_metadata: [:token]
      rpc_action :super_admin_sign_in, :super_admin_sign_in, show_metadata: [:token]
      rpc_action :register, :register_with_password, show_metadata: [:token]
      rpc_action :register_in_tenant, :register_user_in_tenant, show_metadata: [:token]
      rpc_action :register_super_admin, :register_super_admin, show_metadata: [:token]
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
      rpc_action :create_student, :create_student
      rpc_action :list_student, :list_student
      rpc_action :update_student, :update_student
      # Super admin tenant management
      rpc_action :get_users_from_tenant, :get_users_from_tenant
    end

    resource KgEdu.Accounts.Organization do
      rpc_action :create_organization, :create
      rpc_action :create_organization_with_migrations, :create_with_migrations
      rpc_action :create_verified_organization, :create_verified_organization
      rpc_action :backup_organization, :backup_organization
      rpc_action :restore_organization, :restore_organization
      rpc_action :list_organization_backups, :list_organization_backups
      rpc_action :delete_backup, :delete_backup
      rpc_action :get_organization, :by_id
      rpc_action :list_organizations, :read
      rpc_action :update_organization, :update
      rpc_action :delete_organization, :destroy
      rpc_action :run_tenant_migrations, :run_tenant_migrations
      rpc_action :run_all_tenant_migrations, :run_all_tenant_migrations
      rpc_action :check_tenant_health, :check_tenant_health
      rpc_action :get_migration_status, :get_migration_status
      rpc_action :get_backup_statistics, :get_backup_statistics
      rpc_action :create_scheduled_backups, :create_scheduled_backups
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
    resource KgEdu.Accounts.Organization
    resource KgEdu.Accounts.User do
      define :create_user , action: :create_user
    end
  end
end
