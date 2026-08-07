api_key = System.fetch_env!("DASHSCOPE_API_KEY")

image_path = "/Users/bai/Desktop/p1001125.jpeg"
audio_path = "/var/folders/8l/8bx87ktx4455g6mz1n1wn98w0000gn/T/opencode/input_audio_5s.mp3"

base = "https://dashscope.aliyuncs.com"
auth = [{"authorization", "Bearer #{api_key}"}]

upload_policy = fn model ->
  Req.get!("#{base}/api/v1/uploads",
    headers: auth,
    params: [action: "getPolicy", model: model]
  ).body["data"]
end

upload_file = fn file_path, model ->
  policy = upload_policy.(model)
  file_name = Path.basename(file_path)
  key = "#{policy["upload_dir"]}/#{file_name}"

  form =
    [
      {"OSSAccessKeyId", policy["oss_access_key_id"]},
      {"Signature", policy["signature"]},
      {"policy", policy["policy"]},
      {"x-oss-object-acl", policy["x_oss_object_acl"]},
      {"x-oss-forbid-overwrite", policy["x_oss_forbid_overwrite"]},
      {"key", key},
      {"success_action_status", "200"},
      {"file", {File.stream!(file_path, [], 1_048_576), [filename: file_name, content_type: MIME.from_path(file_path)]}}
    ]

  resp = Req.post!(policy["upload_host"], form_multipart: form)

  if resp.status != 200 do
    raise "upload failed: #{resp.status} #{inspect(resp.body)}"
  end

  "oss://#{key}"
end

IO.puts("== Uploading image for detect ==")
image_detect_url = upload_file.(image_path, "wan2.2-s2v-detect")
IO.puts("image detect url: #{image_detect_url}")

IO.puts("== Uploading image for video ==")
image_video_url = upload_file.(image_path, "wan2.2-s2v")
IO.puts("image video url: #{image_video_url}")

IO.puts("== Uploading audio ==")
audio_url = upload_file.(audio_path, "wan2.2-s2v")
IO.puts("audio url: #{audio_url}")

oss_header = [{"x-dashscope-ossresourceresolve", "enable"}]

IO.puts("== Running face-detect ==")
detect_resp =
  Req.post!("#{base}/api/v1/services/aigc/image2video/face-detect",
    headers: auth ++ oss_header,
    json: %{model: "wan2.2-s2v-detect", input: %{image_url: image_detect_url}}
  )

IO.puts("detect resp: #{inspect(detect_resp.body)}")

%{"output" => %{"check_pass" => check_pass}} = detect_resp.body

unless check_pass do
  raise "image check failed"
end

IO.puts("== Submitting video task ==")
submit_resp =
  Req.post!("#{base}/api/v1/services/aigc/image2video/video-synthesis/",
    headers: auth ++ oss_header ++ [{"x-dashscope-async", "enable"}],
    json: %{
      model: "wan2.2-s2v",
      input: %{image_url: image_video_url, audio_url: audio_url},
      parameters: %{resolution: "480P"}
    }
  )

IO.puts("submit resp: #{inspect(submit_resp.body)}")
task_id = submit_resp.body["output"]["task_id"]

IO.puts("task_id: #{task_id}")

poll_task = fn ->
  Req.get!("#{base}/api/v1/tasks/#{task_id}", headers: auth).body
end

result =
  Stream.repeatedly(poll_task)
  |> Enum.reduce_while(nil, fn body, _acc ->
    status = body["output"]["task_status"]
    IO.puts("#{Time.utc_now()} status=#{status}")

    case status do
      "SUCCEEDED" -> {:halt, body}
      "FAILED" -> raise "task failed: #{inspect(body)}"
      _ -> Process.sleep(15_000); {:cont, nil}
    end
  end)

IO.puts("result: #{inspect(result)}")

video_url = result["output"]["results"]["video_url"]

IO.puts("== Downloading video ==")
out_path = "/var/folders/8l/8bx87ktx4455g6mz1n1wn98w0000gn/T/opencode/digital_human.mp4"
video_resp = Req.get!(video_url, follow_redirects: true)
File.write!(out_path, video_resp.body)
IO.puts("saved to #{out_path}")
