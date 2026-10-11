# 虚拟教研室演示数据种子
#
# 用法: mix run priv/repo/seed_research_room.exs

require Logger

alias KgEdu.Repo

{:ok, %{rows: rows}} =
  Repo.query("SELECT schema_name FROM organizations")

now = DateTime.utc_now()

msgs = [
  %{
    title: "第二章学习与作业提醒",
    content: "请在本周完成形态与构成章节学习，作业提交前检查设计说明是否完整。",
    author_label: "课程教学团队",
    read_status: "unread",
    posted_at: now
  },
  %{
    title: "关于视觉秩序的讨论",
    content: "同一个画面中，对比和统一可以如何同时存在？欢迎结合实际案例分享。",
    author_label: "课程讨论",
    read_status: "read",
    posted_at: DateTime.add(now, -1, :day)
  }
]

for [schema] <- rows do
  {:ok, %{rows: [[count]]}} =
    Repo.query("SELECT count(*) FROM #{schema}.research_room_messages")

  if count == 0 do
    for m <- msgs do
      Repo.query!(
        """
        INSERT INTO #{schema}.research_room_messages
          (title, content, author_label, read_status, participated, posted_at)
        VALUES ($1, $2, $3, $4, false, $5)
        """,
        [m.title, m.content, m.author_label, m.read_status, m.posted_at]
      )
    end

    Logger.info("Seeded 虚拟教研室 messages into #{schema}")
  else
    Logger.info("Skip #{schema} (#{count} messages already)")
  end
end

IO.puts("✅ 虚拟教研室演示数据种子完成")
