defmodule KgEdu.Courses.ChapterGraph do
  @moduledoc """
  P2: 章节一键转知识图谱 — 聚合章节树（标题/简介/视频/文档）→ LLM 抽取
  知识点与关系（复用 ImportFromLLM）→ 自动关联章节视频/课程文档到生成的知识点。
  """

  require Logger

  def generate(chapter_id, tenant) do
    opts = [tenant: tenant, authorize?: false]

    with {:ok, chapter} <- fetch_chapter(chapter_id, opts) do
      course_id = chapter.course_id
      tree = [chapter | descendants(chapter.id, opts)]
      videos = Enum.flat_map(tree, &chapter_videos(&1.id, opts))
      files = course_files(course_id, opts)

      text = build_text(tree, videos, files)

      with {:ok, %{resources: resources, relations: relations}} <-
             KgEdu.Knowledge.ImportFromLLM.import_from_text(text, course_id, tenant: tenant) do
        linked_videos = autolink_videos(videos, resources, opts)
        linked_files = autolink_files(files, resources, opts)

        {:ok,
         %{
           chapter_id: chapter_id,
           course_id: course_id,
           resources_created: length(resources),
           relations_created: length(relations),
           resource_ids: Enum.map(resources, & &1.id),
           linked_videos: linked_videos,
           linked_files: linked_files
         }}
      end
    end
  end

  # ── Private ────────────────────────────────────────────────────────────

  defp fetch_chapter(id, opts) do
    case KgEdu.Courses.Chapter.get_chapter(id, opts) do
      {:ok, nil} -> {:error, "章节不存在"}
      {:ok, chapter} -> {:ok, chapter}
      {:error, reason} -> {:error, reason}
    end
  end

  defp descendants(parent_id, opts) do
    case KgEdu.Courses.Chapter.list_subchapters(%{parent_chapter_id: parent_id}, opts) do
      {:ok, children} -> Enum.flat_map(children, &[&1 | descendants(&1.id, opts)])
      _ -> []
    end
  end

  defp chapter_videos(chapter_id, opts) do
    case KgEdu.Courses.Video.get_videos_by_chapter(%{chapter_id: chapter_id}, opts) do
      {:ok, videos} -> videos
      _ -> []
    end
  end

  defp course_files(nil, _opts), do: []

  defp course_files(course_id, opts) do
    case KgEdu.Courses.File.list_files_by_course(%{course_id: course_id}, opts) do
      {:ok, files} -> files
      _ -> []
    end
  end

  defp build_text(tree, videos, files) do
    chapters =
      Enum.map_join(tree, "\n", fn c -> "章节：#{c.title}\n#{c.description || ""}" end)

    video_titles = Enum.map_join(videos, "\n", &"配套视频：#{&1.title}")
    file_names = Enum.map_join(files, "\n", &"配套文档：#{&1.filename || &1.id}")

    [chapters, video_titles, file_names]
    |> Enum.reject(&(&1 == ""))
    |> Enum.join("\n")
  end

  defp autolink_videos(videos, resources, opts) do
    subjects = Enum.filter(resources, &(&1.knowledge_type == :subject))
    fallback = List.first(subjects) || List.first(resources)

    Enum.reduce(videos, 0, fn video, acc ->
      target =
        Enum.find(resources, fn r ->
          r.name && (String.contains?(video.title || "", r.name) or String.contains?(r.name, video.title || ""))
        end) || fallback

      if target do
        case link_video(video, target.id, opts) do
          :ok -> acc + 1
          _ -> acc
        end
      else
        acc
      end
    end)
  end

  defp autolink_files(files, resources, opts) do
    Enum.reduce(files, 0, fn file, acc ->
      name = file.filename || ""

      target =
        Enum.find(resources, fn r ->
          r.name && r.name != "" and
            (String.contains?(name, r.name) or String.contains?(r.name, name))
        end)

      if target do
        case link_file(file, target.id, opts) do
          :ok -> acc + 1
          _ -> acc
        end
      else
        acc
      end
    end)
  end

  defp link_video(video, resource_id, opts) do
    case video
         |> Ash.Changeset.for_update(:link_video_to_knowledge, %{knowledge_resource_id: resource_id})
         |> Ash.update(opts) do
      {:ok, _} -> :ok
      {:error, reason} -> {:error, reason}
    end
  end

  defp link_file(file, resource_id, opts) do
    case file
         |> Ash.Changeset.for_update(:link_file_to_knowledge, %{knowledge_resource_id: resource_id})
         |> Ash.update(opts) do
      {:ok, _} -> :ok
      {:error, reason} -> {:error, reason}
    end
  end
end
