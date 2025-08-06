defmodule KgEduWeb.AshJsonApiRouter do
  use AshJsonApi.Router,
    domains: [KgEdu.Accounts, KgEdu.Courses],
    open_api: "/open_api"
end
