defmodule KgEdu.Repo.Migrations.MakeHomeworkContentOptional do
  use Ecto.Migration

  def up do
    # 首先将现有的空值更新为空字符串
    execute "UPDATE homeworks SET content = '' WHERE content IS NULL"

    # 然后设置默认值并允许 NULL
    alter table(:homeworks) do
      modify :content, :text, default: "", null: true
    end
  end

  def down do
    alter table(:homeworks) do
      modify :content, :text, default: nil, null: false
    end
  end
end
