defmodule KgEdu.Repo.TenantMigrations.AddUniqueIndexMicroMajorCertTemplates do
  @moduledoc """
  为 micro_major_certificate_templates.micro_major_id 添加唯一索引。

  每个微专业最多只有一个证书模板，防止重复创建导致 by_micro_major 查询失败。
  """

  use Ecto.Migration

  def up do
    create unique_index(:micro_major_certificate_templates, [:micro_major_id],
           name: :idx_mm_cert_templates_unique_mm,
           prefix: prefix()
         )
  end

  def down do
    drop unique_index(:micro_major_certificate_templates, [:micro_major_id],
           name: :idx_mm_cert_templates_unique_mm,
           prefix: prefix()
         )
  end
end
