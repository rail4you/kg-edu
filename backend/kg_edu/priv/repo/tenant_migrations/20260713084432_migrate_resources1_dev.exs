defmodule KgEdu.Repo.TenantMigrations.MigrateResources1 do
  @moduledoc """
  Adds background_image_url and name_field positioning columns.
  """

  use Ecto.Migration

  def up do
    alter table(:micro_major_certificate_templates, prefix: prefix()) do
      add :background_image_url, :text
      add :name_field_x, :decimal, default: "0.2"
      add :name_field_y, :decimal, default: "0.45"
      add :name_field_width, :decimal, default: "0.6"
      add :name_field_height, :decimal, default: "0.08"
      add :name_font_family, :text, default: "serif"
      add :name_font_size, :bigint, default: 36
      add :name_font_weight, :text, default: "normal"
      add :name_color, :text, default: "#000000"
      add :name_letter_spacing, :bigint, default: 4
      add :name_text_align, :text, default: "center"
    end
  end

  def down do
    alter table(:micro_major_certificate_templates, prefix: prefix()) do
      remove :name_text_align
      remove :name_letter_spacing
      remove :name_color
      remove :name_font_weight
      remove :name_font_size
      remove :name_font_family
      remove :name_field_height
      remove :name_field_width
      remove :name_field_y
      remove :name_field_x
      remove :background_image_url
    end
  end
end
