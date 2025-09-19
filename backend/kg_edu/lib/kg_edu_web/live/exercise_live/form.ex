defmodule KgEduWeb.ExerciseLive.Form do
  use KgEduWeb, :live_view
  require Logger
  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash}>
      <.header>
        {@page_title}
        <:subtitle>Use this form to manage exercise records in your database.</:subtitle>
      </.header>

      <.form for={@form} id="exercise-form" phx-change="validate" phx-submit="save">
        <fieldset>
          <legend class="sr-only">Exercise Details</legend>
          <.input
            field={@form[:course_id]}
            type="select"
            label="Course"
            options={@course_list}
            required
          />
          <.input
            field={@form[:title]}
            type="text"
            label="Title"
            placeholder="Enter exercise title"
            required
          />

          <.input
            field={@form[:question_content]}
            type="textarea"
            label="Question Content"
            placeholder="Enter the question content"
            required
          />

          <.input
            field={@form[:answer]}
            type="textarea"
            label="Answer"
            placeholder="Enter the answer"
            required
          />

          <.input
            field={@form[:question_type]}
            type="select"
            label="Question Type"
            options={[
              {:multiple_choice, "multiple_choice"},
              {:fill_in_blank, "fill_in_blank"},
              {:essay, "essay"}
            ]}
            prompt="Select question type"
            required
          />

          <div :if={@form[:question_type].value == :multiple_choice} class="space-y-4">
            <h3 class="text-lg font-medium">Multiple Choice Options</h3>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700">Option A</label>
                <input
                  type="text"
                  name="exercise[options][A]"
                  value={Phoenix.HTML.Form.input_value(@form, :options) && Phoenix.HTML.Form.input_value(@form, :options)["A"]}
                  placeholder="Enter option A"
                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700">Option B</label>
                <input
                  type="text"
                  name="exercise[options][B]"
                  value={Phoenix.HTML.Form.input_value(@form, :options) && Phoenix.HTML.Form.input_value(@form, :options)["B"]}
                  placeholder="Enter option B"
                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700">Option C</label>
                <input
                  type="text"
                  name="exercise[options][C]"
                  value={Phoenix.HTML.Form.input_value(@form, :options) && Phoenix.HTML.Form.input_value(@form, :options)["C"]}
                  placeholder="Enter option C"
                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700">Option D</label>
                <input
                  type="text"
                  name="exercise[options][D]"
                  value={Phoenix.HTML.Form.input_value(@form, :options) && Phoenix.HTML.Form.input_value(@form, :options)["D"]}
                  placeholder="Enter option D"
                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700">Correct Answer(s)</label>
              <select
                name="exercise[options][selected][]"
                multiple={true}
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                <option value="">Select correct answer(s)</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="D">D</option>
              </select>
              <p class="mt-1 text-sm text-gray-500">
                Select one or more correct answers. Hold Ctrl/Cmd to select multiple.
              </p>
            </div>
          </div>

          <.input
            field={@form[:knowledge_resource_id]}
            type="select"
            label="Knowledge Resource ID"
            placeholder="Enter associated knowledge resource ID"
            options={@knowledge_ids}
            required
          />
        </fieldset>
        <.button phx-disable-with="Saving..." variant="primary">Save Exercise</.button>
        <.button navigate={return_path(@return_to, @exercise)}>Cancel</.button>
      </.form>
    </Layouts.app>
    """
  end

  @impl true
  def mount(params, _session, socket) do
    exercise =
      case params["id"] do
        nil -> nil
        id -> Ash.get!(KgEdu.Knowledge.Exercise, id, actor: socket.assigns.current_user)
      end

    action = if is_nil(exercise), do: "New", else: "Edit"
    page_title = action <> " " <> "Exercise"
    knowledge_ids = KgEdu.Knowledge.Resource.list_knowledge_resources!() |> Enum.map(& {&1.name, &1.id})
    course_list = KgEdu.Courses.Course.list_courses!(actor: socket.assigns.current_user) |> Enum.map(&{&1.title, &1.id})
    {:ok,
     socket
     |> assign(:return_to, return_to(params["return_to"]))
     |> assign(exercise: exercise)
     |> assign(:knowledge_ids, knowledge_ids)
     |> assign(:course_list, course_list)
     |> assign(:page_title, page_title)
     |> assign_form()}
  end

  defp return_to("show"), do: "show"
  defp return_to(_), do: "index"

  @impl true
  def handle_event("validate", %{"exercise" => exercise_params}, socket) do
    {:noreply,
     assign(socket, form: AshPhoenix.Form.validate(socket.assigns.form, exercise_params))}
  end

  def handle_event("save", %{"exercise" => exercise_params}, socket) do
    case AshPhoenix.Form.submit(socket.assigns.form, params: exercise_params) do
      {:ok, exercise} ->
        notify_parent({:saved, exercise})

        socket =
          socket
          |> put_flash(:info, "Exercise updated successfully")
          |> push_navigate(to: return_path(socket.assigns.return_to, exercise))

        {:noreply, socket}

      {:error, form} ->
        Logger.error("Form submission error: #{inspect(form.errors)}")
        {:noreply, assign(socket, form: form)}
    end
  end

  defp notify_parent(msg), do: send(self(), {__MODULE__, msg})

  defp assign_form(%{assigns: %{exercise: exercise}} = socket) do
    form =
      if exercise do
        AshPhoenix.Form.for_update(exercise, :update_exercise,
          as: "exercise",
          actor: socket.assigns.current_user
        )
      else
        AshPhoenix.Form.for_create(KgEdu.Knowledge.Exercise, :create,
          as: "exercise",
          actor: socket.assigns.current_user
        )
      end

    assign(socket, form: to_form(form))
  end

  defp return_path("index", _exercise), do: ~p"/exercises"
  defp return_path("show", exercise), do: ~p"/exercises/#{exercise.id}"
end
