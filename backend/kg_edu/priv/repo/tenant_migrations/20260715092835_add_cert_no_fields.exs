defmodule KgEdu.Repo.TenantMigrations.AddCertNoFields do
  @moduledoc """
  Adds cert_no positioning fields to micro_major_certificate_templates.
  """

  use Ecto.Migration

  def up do
    alter table(:micro_major_certificate_templates, prefix: prefix()) do
      add :cert_no_field_x, :decimal, default: "0.2"
      add :cert_no_field_y, :decimal, default: "0.55"
      add :cert_no_field_width, :decimal, default: "0.6"
      add :cert_no_field_height, :decimal, default: "0.06"
      add :cert_no_font_family, :text, default: "serif"
      add :cert_no_font_size, :bigint, default: 24
      add :cert_no_font_weight, :text, default: "normal"
      add :cert_no_color, :text, default: "#000000"
      add :cert_no_letter_spacing, :bigint, default: 2
      add :cert_no_text_align, :text, default: "center"
    end
  end

  def down do
    alter table(:micro_major_certificate_templates, prefix: prefix()) do
      remove :cert_no_text_align
      remove :cert_no_letter_spacing
      remove :cert_no_color
      remove :cert_no_font_weight
      remove :cert_no_font_size
      remove :cert_no_font_family
      remove :cert_no_field_height
      remove :cert_no_field_width
      remove :cert_no_field_y
      remove :cert_no_field_x
    end
  end
end
