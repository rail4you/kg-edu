defmodule KgEduWeb.TtsControllerTest do
  @moduledoc """
  P0: TTS 接口测试（只覆盖不触网路径：音色表、租户缺失、参数校验）。
  真实合成需有效 Qwen Key + 网络，不在自动化测试中覆盖。
  """
  use KgEduWeb.ConnCase, async: true

  describe "GET /api/tts/voices" do
    test "返回音色列表", %{conn: conn} do
      conn = get(conn, "/api/tts/voices")

      assert %{"success" => true, "data" => voices} = json_response(conn, 200)
      assert length(voices) == 5
      assert Enum.any?(voices, &(&1["voice"] == "longxiaochun"))
      assert Enum.all?(voices, &Map.has_key?(&1, "label"))
    end
  end

  describe "POST /api/tts/synthesize" do
    test "缺租户上下文返回错误", %{conn: conn} do
      conn = post(conn, "/api/tts/synthesize", %{text: "你好"})

      assert %{"success" => false, "error" => "未设置租户上下文"} =
               json_response(conn, 200)
    end

    test "空文本返回参数错误（不触网）", %{conn: conn} do
      conn =
        conn
        |> put_req_header("x-org-schema", "test-tenant")
        |> post("/api/tts/synthesize", %{text: ""})

      assert %{"success" => false, "error" => "合成文本不能为空"} =
               json_response(conn, 200)
    end

    test "超长文本返回参数错误（不触网）", %{conn: conn} do
      conn =
        conn
        |> put_req_header("x-org-schema", "test-tenant")
        |> post("/api/tts/synthesize", %{text: String.duplicate("啊", 2001)})

      assert %{"success" => false, "error" => error} = json_response(conn, 200)
      assert error =~ "过长"
    end
  end
end
