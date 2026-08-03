defmodule KgEdu.Repo.TenantMigrations.AddUniqueIndexMicroMajorCertTemplates do
  @moduledoc """
  为 micro_major_certificate_templates.micro_major_id 添加唯一索引。

  每个微专业最多只有一个证书模板，防止重复创建导致 by_micro_major 查询失败。
  """

  use Ecto.Migration

  def up do
    # 使用 create_if_not_exists 保证幂等：部分租户（如通过手工 SQL / 旧迁移链）
    # 可能已存在该索引但 schema_migrations 未记录版本号，直接 create 会报
    # duplicate_table 导致整个租户迁移链中断。
    create_if_not_exists unique_index(:micro_major_certificate_templates, [:micro_major_id],
           name: :idx_mm_cert_templates_unique_mm,
           prefix: prefix()
         )
  end

  def down do
    drop_if_exists unique_index(:micro_major_certificate_templates, [:micro_major_id],
           name: :idx_mm_cert_templates_unique_mm,
           prefix: prefix()
         )
  end
end
