defmodule KgEduWeb.AshJsonApiRouter do
  use AshJsonApi.Router,
    domains: [KgEdu.Accounts],
    open_api: "/open_api"
end
