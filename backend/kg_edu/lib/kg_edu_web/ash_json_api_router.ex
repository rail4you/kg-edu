defmodule KgEduWeb.AshJsonApiRouter do
  use AshJsonApi.Router,
    domains: [KgEdu.Accounts, KgEdu.Courses, KgEdu.Knowledge, KgEdu.Utils, KgEdu.GroupTask, KgEdu.MajorAnalysis],
    open_api: "/open_api"
end
