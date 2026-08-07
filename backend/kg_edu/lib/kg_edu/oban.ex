defmodule KgEdu.Oban do
  @moduledoc """
  Oban facade for the kg_edu application.

  Reads the `config :kg_edu, Oban, ...` block in config/config.exs
  (repo, queues, plugins, etc.).
  """
  use Oban, otp_app: :kg_edu
end
