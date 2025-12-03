defmodule ReqLLM.Providers.GLM do
  @moduledoc """
  MyOpenAI – fully OpenAI-compatible Chat Completions API.
  """

  @behaviour ReqLLM.Provider

  use ReqLLM.Provider.DSL,
    id: :glm,
    base_url: "https://open.bigmodel.cn/api/paas/v4",
    metadata: "priv/models_dev/glm.json",
    default_env_key: "GLM_API_KEY",
    # built-in OpenAI-style encoding/decoding is used automatically
    provider_schema: [
      # Only list options that **do not** exist in the OpenAI spec
      organisation_id: [type: :string, doc: "Optional tenant id"]
    ]

  import ReqLLM.Provider.Utils,
    only: [maybe_put: 3, maybe_put_skip: 4, ensure_parsed_body: 1]

  # ---------------------------------------------------------------------------
  # 1️⃣  prepare_request/4 – operation dispatcher
  # ---------------------------------------------------------------------------

  @impl ReqLLM.Provider
  def prepare_request(:chat, model_input, %ReqLLM.Context{} = ctx, opts) do
    with {:ok, model} <- ReqLLM.Model.from(model_input) do
      req =
        Req.new(url: "/chat/completions", method: :post, receive_timeout: 30_000)
        |> attach(model, Keyword.put(opts, :context, ctx))

      {:ok, req}
    end
  end

  # Example of a second, non-Chat operation (optional)
  def prepare_request(:embeddings, model_input, _ctx, opts) do
    with {:ok, model} <- ReqLLM.Model.from(model_input) do
      Req.new(url: "/embeddings", method: :post, receive_timeout: 30_000)
      |> attach(model, opts)
      |> then(&{:ok, &1})
    end
  end

  def prepare_request(op, _, _, _),
    do:
      {:error,
       ReqLLM.Error.Invalid.Parameter.exception(
         parameter: "operation #{inspect(op)} not supported"
       )}

  # ---------------------------------------------------------------------------
  # 2️⃣  attach/3 – validation, option handling, Req pipeline
  # ---------------------------------------------------------------------------

  @impl ReqLLM.Provider
  def attach(%Req.Request{} = request, model_input, user_opts \\ []) do
    %ReqLLM.Model{} = model = ReqLLM.Model.from!(model_input)
    if model.provider != provider_id(), do: raise ReqLLM.Error.Invalid.Provider, provider: model.provider

    {:ok, api_key} = ReqLLM.Keys.get(model.provider, user_opts)

    {tools, other_opts} = Keyword.pop(user_opts, :tools, [])
    {provider_opts, core_opts} = Keyword.pop(other_opts, :provider_options, [])

    opts =
      model
      # |> prepare_options!(__MODULE__, core_opts)
      |> Keyword.put(:tools, tools)
      |> Keyword.merge(provider_opts)

    base_url = Keyword.get(user_opts, :base_url, default_base_url())
    req_keys = __MODULE__.supported_provider_options() ++ [:context]

    request
    |> Req.Request.register_options(req_keys ++ [:model])
    |> Req.Request.merge_options(
      Keyword.take(opts, req_keys) ++
        [model: model.model, base_url: base_url, auth: {:bearer, api_key}]
    )
    |> ReqLLM.Step.Error.attach()
    |> Req.Request.append_request_steps(llm_encode_body: &__MODULE__.encode_body/1)
    # Streaming is now handled via ReqLLM.Streaming module
    |> Req.Request.append_response_steps(llm_decode_response: &__MODULE__.decode_response/1)
    |> ReqLLM.Step.Usage.attach(model)
  end

  # ---------------------------------------------------------------------------
  # 3️⃣  encode_body – still needed (adds provider-specific extras)
  # ---------------------------------------------------------------------------

  # encode_body/1 and decode_response/1 are provided automatically
  # by the DSL using built-in OpenAI-style defaults.
  # Only implement these if you need provider-specific customizations.

  # decode_response/1 is also provided automatically by the DSL

  # Usage extraction is identical to Groq / OpenAI
  @impl ReqLLM.Provider
  def extract_usage(%{"usage" => u}, _), do: {:ok, u}
  def extract_usage(_, _), do: {:error, :no_usage}
end
