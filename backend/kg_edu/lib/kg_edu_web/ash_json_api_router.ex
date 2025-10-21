defmodule KgEduWeb.AshJsonApiRouter do
  use AshJsonApi.Router,
    domains: [KgEdu.Accounts, KgEdu.Courses, KgEdu.Knowledge, KgEdu.Utils],
    open_api: "/open_api"
end
