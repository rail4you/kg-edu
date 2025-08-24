defmodule KgEduWeb.AshJsonApiRouter do
  use AshJsonApi.Router,
    domains: [KgEdu.Accounts, KgEdu.Courses, KgEdu.Knowledge],
    open_api: "/open_api"
end
