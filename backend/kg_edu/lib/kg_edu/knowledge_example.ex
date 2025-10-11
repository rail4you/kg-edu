defmodule KgEdu.KnowledgeExample do

  # ============================================
  # EXAMPLE 1: Creating a Three-Tier Knowledge Hierarchy
  # ============================================

  # Assume we have a course_id
  @course_id "62e390af-491b-4fe9-9a4e-35eeae2194b8"
  def setup_example_data do
    {:ok, math_subject} =
      KgEdu.Knowledge.Resource.create_knowledge_resource(%{
        name: "Mathematics",
        description: "Core mathematics concepts and skills",
        subject: "Mathematics",
        knowledge_type: :subject,
        course_id: @course_id,
        importance_level: :important
      })

    {:ok, physics_subject} =
      KgEdu.Knowledge.Resource.create_knowledge_resource(%{
        name: "Physics",
        description: "Fundamental physics principles",
        subject: "Physics",
        knowledge_type: :subject,
        course_id: @course_id,
        importance_level: :important
      })

    # ---------- Step 2: Create Knowledge Units (Middle Level) ----------

    # Math Units
    {:ok, algebra_unit} =
      KgEdu.Knowledge.Resource.create_knowledge_resource(%{
        name: "Algebra",
        description: "Algebraic expressions and equations",
        subject: "Mathematics",
        unit: "Algebra",
        knowledge_type: :knowledge_unit,
        parent_subject_id: math_subject.id,
        course_id: @course_id,
        importance_level: :important
      })

    {:ok, geometry_unit} =
      KgEdu.Knowledge.Resource.create_knowledge_resource(%{
        name: "Geometry",
        description: "Shapes, angles, and spatial reasoning",
        subject: "Mathematics",
        unit: "Geometry",
        knowledge_type: :knowledge_unit,
        parent_subject_id: math_subject.id,
        course_id: @course_id,
        importance_level: :normal
      })

    {:ok, mechanics_unit} =
      KgEdu.Knowledge.Resource.create_knowledge_resource(%{
        name: "Mechanics",
        description: "Motion, forces, and energy",
        subject: "Physics",
        unit: "Mechanics",
        knowledge_type: :knowledge_unit,
        parent_subject_id: physics_subject.id,
        course_id: @course_id,
        importance_level: :hard
      })

    # ---------- Step 3: Create Knowledge Cells (Leaf Level) ----------

    # Algebra Cells (under Algebra Unit)
    {:ok, linear_eq} =
      KgEdu.Knowledge.Resource.create_knowledge_resource(%{
        name: "Linear Equations",
        description: "Solving equations of the form ax + b = c",
        subject: "Mathematics",
        unit: "Algebra",
        knowledge_type: :knowledge_cell,
        parent_subject_id: math_subject.id,
        parent_unit_id: algebra_unit.id,
        course_id: @course_id,
        importance_level: :important
      })

    {:ok, quadratic_eq} =
      KgEdu.Knowledge.Resource.create_knowledge_resource(%{
        name: "Quadratic Equations",
        description: "Solving equations",
        subject: "Mathematics",
        unit: "Algebra",
        knowledge_type: :knowledge_cell,
        parent_subject_id: math_subject.id,
        parent_unit_id: algebra_unit.id,
        course_id: @course_id,
        importance_level: :hard
      })

    {:ok, factoring} =
      KgEdu.Knowledge.Resource.create_knowledge_resource(%{
        name: "Factoring Polynomials",
        description: "Breaking down polynomials into products of factors",
        subject: "Mathematics",
        unit: "Algebra",
        knowledge_type: :knowledge_cell,
        parent_subject_id: math_subject.id,
        parent_unit_id: algebra_unit.id,
        course_id: @course_id,
        importance_level: :normal
      })

    # Geometry Cells (under Geometry Unit)
    {:ok, pythagorean} =
      KgEdu.Knowledge.Resource.create_knowledge_resource(%{
        name: "Pythagorean Theorem",
        description: "In right triangles: a² + b² = c²",
        subject: "Mathematics",
        unit: "Geometry",
        knowledge_type: :knowledge_cell,
        parent_subject_id: math_subject.id,
        parent_unit_id: geometry_unit.id,
        course_id: @course_id,
        importance_level: :important
      })
    {:ok, angles} =
      KgEdu.Knowledge.Resource.create_knowledge_resource(%{
        name: "Angles and Triangles",
        description: "Properties of angles in triangles",
        subject: "Mathematics",
        unit: "Geometry",
        knowledge_type: :knowledge_cell,
        parent_subject_id: math_subject.id,
        parent_unit_id: geometry_unit.id,
        course_id: @course_id,
        importance_level: :normal
      })

    # Mechanics Cells (under Mechanics Unit)
    {:ok, newtons_laws} =
      KgEdu.Knowledge.Resource.create_knowledge_resource(%{
        name: "Newton's Laws of Motion",
        description: "Three fundamental laws governing motion",
        subject: "Physics",
        unit: "Mechanics",
        knowledge_type: :knowledge_cell,
        parent_subject_id: physics_subject.id,
        parent_unit_id: mechanics_unit.id,
        course_id: @course_id,
        importance_level: :hard
      })

    {:ok, kinetic_energy} =
      KgEdu.Knowledge.Resource.create_knowledge_resource(%{
        name: "Kinetic Energy",
        description: "Energy of motion: KE = ½mv²",
        subject: "Physics",
        unit: "Mechanics",
        knowledge_type: :knowledge_cell,
        parent_subject_id: physics_subject.id,
        parent_unit_id: mechanics_unit.id,
        course_id: @course_id,
        importance_level: :important
      })

    # Direct Cell (under Subject, no Unit)
    {:ok, problem_solving} =
      KgEdu.Knowledge.Resource.create_knowledge_resource(%{
        name: "Mathematical Problem Solving",
        description: "General strategies for solving math problems",
        subject: "Mathematics",
        knowledge_type: :knowledge_cell,
        parent_subject_id: math_subject.id,
        # No parent_unit_id - directly under subject
        course_id: @course_id,
        importance_level: :important
      })
  end

  # ============================================
  # EXAMPLE 2: Using Code Interfaces to Query
  # ============================================

  # ---------- Query 1: List All Subjects ----------
  def list_all_subjects() do
    subjects = KgEdu.Knowledge.Resource.list_subjects!(%{course_id: @course_id})
    # Returns: [math_subject, physics_subject]

    IO.inspect(subjects, label: "All Subjects")
  end

  # ---------- Query 2: Get Subject with Nested Units and Cells ----------
  def get_subject_hierarchy(subject_id) do
    # Assuming subject_id corresponds to "Mathematics"
    math_hierarchy = KgEdu.Knowledge.Resource.get_subject_with_units!(%{subject_id: subject_id})

    # Returns nested structure:
    # %Resource{
    #   name: "Mathematics",
    #   knowledge_type: :subject,
    #   child_units: [
    #     %Resource{
    #       name: "Algebra",
    #       knowledge_type: :knowledge_unit,
    #       child_cells: [
    #         %Resource{name: "Linear Equations", knowledge_type: :knowledge_cell},
    #         %Resource{name: "Quadratic Equations", knowledge_type: :knowledge_cell},
    #         %Resource{name: "Factoring Polynomials", knowledge_type: :knowledge_cell}
    #       ]
    #     },
    #     %Resource{
    #       name: "Geometry",
    #       knowledge_type: :knowledge_unit,
    #       child_cells: [
    #         %Resource{name: "Pythagorean Theorem", knowledge_type: :knowledge_cell},
    #         %Resource{name: "Angles and Triangles", knowledge_type: :knowledge_cell}
    #       ]
    #     }
    #   ],
    #   direct_cells: [
    #     %Resource{name: "Mathematical Problem Solving", knowledge_type: :knowledge_cell}
    #   ]
    # }

    IO.inspect(math_hierarchy, label: "Mathematics Hierarchy")
  end

  # ---------- Query 3: List Units for a Subject ----------
  def list_units_for_subject(subject_id) do
    # Assuming subject_id corresponds to "Mathematics"
    math_units = KgEdu.Knowledge.Resource.list_units_by_subject!(subject_id: subject_id)

    # Returns: [algebra_unit, geometry_unit]

    IO.inspect(math_units, label: "Math Units")
  end

  # ---------- Query 4: List Cells for a Unit ----------
  def list_cells_for_unit(unit_id) do
    # Assuming unit_id corresponds to "Algebra"
    algebra_cells = KgEdu.Knowledge.Resource.list_cells_by_unit!(unit_id: unit_id)

    # Returns: [linear_eq, quadratic_eq, factoring]

    IO.inspect(algebra_cells, label: "Algebra Cells")
  end

  # ---------- Query 5: Get Unit with Parent and Children ----------
  def list_unit_with_relations(unit_id) do
    # Assuming unit_id corresponds to "Algebra"
    algebra_with_relations =
      KgEdu.Knowledge.Resource.get_unit_with_cells!(unit_id: unit_id)

    # Returns:
    # %Resource{
    #   name: "Algebra",
    #   knowledge_type: :knowledge_unit,
    #   parent_subject: %Resource{name: "Mathematics"},
    #   child_cells: [
    #     %Resource{name: "Linear Equations"},
    #     %Resource{name: "Quadratic Equations"},
    #     %Resource{name: "Factoring Polynomials"}
    #   ]
    # }

    IO.inspect(algebra_with_relations, label: "Algebra with Relations")
  end

  # ---------- Query 6: Get Full Hierarchy for Course ----------
  def list_full_course_hierarchy() do
    # Assuming course_id corresponds to the course we set up
    full_hierarchy = KgEdu.Knowledge.Resource.get_full_hierarchy!(%{course_id: @course_id})
    IO.inspect(full_hierarchy, label: "Full Course Hierarchy")
  end

  # Returns complete nested structure:
  # [
  #   %Resource{
  #     name: "Mathematics",
  #     child_units: [
  #       %Resource{name: "Algebra", child_cells: [...]},
  #       %Resource{name: "Geometry", child_cells: [...]}
  #     ],
  #     direct_cells: [%Resource{name: "Mathematical Problem Solving"}]
  #   },
  #   %Resource{
  #     name: "Physics",
  #     child_units: [
  #       %Resource{name: "Mechanics", child_cells: [...]}
  #     ],
  #     direct_cells: []
  #   }
  # ]

  # ---------- Query 7: Navigate Hierarchy ----------
  # Get children of a subject
  # def list_subject_children(subject_id) do
  #   # Assuming subject_id corresponds to "Mathematics"
  #   subject_children =
  #     KgEdu.Knowledge.Resource.get_children!(
  #       id: math_subject.id,
  #       type: :subject
  #     )

  #   # Returns: [algebra_unit, geometry_unit, problem_solving]

  #   IO.inspect(subject_children, label: "Math Subject Children")

  #   # Get children of a unit
  #   unit_children =
  #     KgEdu.Knowledge.Resource.get_children!(
  #       id: algebra_unit.id,
  #       type: :knowledge_unit
  #     )

  #   # Returns: [linear_eq, quadratic_eq, factoring]

  #   IO.inspect(unit_children, label: "Algebra Unit Children")
  # end

  # ---------- Query 8: Get Direct Cells (no unit) ----------
  def list_direct_cells(subject_id) do
    # Assuming subject_id corresponds to "Mathematics"
    direct_cells = KgEdu.Knowledge.Resource.list_cells_by_subject!(subject_id: subject_id)

    # Returns: [problem_solving]

    IO.inspect(direct_cells, label: "Direct Math Cells")
  end

  # ============================================
  # EXAMPLE 3: Building a Nested JSON Response
  # ============================================

  # defmodule KnowledgeHierarchyBuilder do
  #   @doc """
  #   Builds a complete nested hierarchy structure for display
  #   """
  #   def build_hierarchy(course_id) do
  #     course_id
  #     |> KgEdu.Knowledge.Resource.get_full_hierarchy!()
  #     |> Enum.map(&format_subject/1)
  #   end

  #   defp format_subject(subject) do
  #     %{
  #       id: subject.id,
  #       name: subject.name,
  #       description: subject.description,
  #       type: "subject",
  #       importance_level: subject.importance_level,
  #       units: Enum.map(subject.child_units, &format_unit/1),
  #       direct_cells: Enum.map(subject.direct_cells, &format_cell/1)
  #     }
  #   end

  #   defp format_unit(unit) do
  #     %{
  #       id: unit.id,
  #       name: unit.name,
  #       description: unit.description,
  #       type: "knowledge_unit",
  #       importance_level: unit.importance_level,
  #       cells: Enum.map(unit.child_cells, &format_cell/1)
  #     }
  #   end

  #   defp format_cell(cell) do
  #     %{
  #       id: cell.id,
  #       name: cell.name,
  #       description: cell.description,
  #       type: "knowledge_cell",
  #       importance_level: cell.importance_level
  #     }
  #   end
  # end

  # # Usage:
  # course_id = "62e390af-491b-4fe9-9a4e-35eeae2194b8"
  # hierarchy_json = KnowledgeHierarchyBuilder.build_hierarchy(course_id)

  # # Output JSON structure:
  # # [
  # #   {
  # #     "id": "...",
  # #     "name": "Mathematics",
  # #     "type": "subject",
  # #     "units": [
  # #       {
  # #         "id": "...",
  # #         "name": "Algebra",
  # #         "type": "knowledge_unit",
  # #         "cells": [
  # #           {"id": "...", "name": "Linear Equations", "type": "knowledge_cell"},
  # #           {"id": "...", "name": "Quadratic Equations", "type": "knowledge_cell"},
  # #           {"id": "...", "name": "Factoring Polynomials", "type": "knowledge_cell"}
  # #         ]
  # #       },
  # #       {
  # #         "id": "...",
  # #         "name": "Geometry",
  # #         "type": "knowledge_unit",
  # #         "cells": [
  # #           {"id": "...", "name": "Pythagorean Theorem", "type": "knowledge_cell"},
  # #           {"id": "...", "name": "Angles and Triangles", "type": "knowledge_cell"}
  # #         ]
  # #       }
  # #     ],
  # #     "direct_cells": [
  # #       {"id": "...", "name": "Mathematical Problem Solving", "type": "knowledge_cell"}
  # #     ]
  # #   },
  # #   {
  # #     "id": "...",
  # #     "name": "Physics",
  # #     "type": "subject",
  # #     "units": [
  # #       {
  # #         "id": "...",
  # #         "name": "Mechanics",
  # #         "type": "knowledge_unit",
  # #         "cells": [
  # #           {"id": "...", "name": "Newton's Laws of Motion", "type": "knowledge_cell"},
  # #           {"id": "...", "name": "Kinetic Energy", "type": "knowledge_cell"}
  # #         ]
  # #       }
  # #     ],
  # #     "direct_cells": []
  # #   }
  # # ]

  # IO.puts(Jason.encode!(hierarchy_json, pretty: true))

  # ============================================
  # EXAMPLE 4: Phoenix Controller Usage
  # ============================================

  # defmodule KgEduWeb.KnowledgeController do
  #   use KgEduWeb, :controller

  #   # Get full hierarchy for a course
  #   def index(conn, %{"course_id" => course_id}) do
  #     hierarchy = KgEdu.Knowledge.Resource.get_full_hierarchy!(course_id: course_id)

  #     json(conn, %{
  #       data:
  #         Enum.map(hierarchy, fn subject ->
  #           %{
  #             id: subject.id,
  #             name: subject.name,
  #             type: "subject",
  #             units:
  #               Enum.map(subject.child_units, fn unit ->
  #                 %{
  #                   id: unit.id,
  #                   name: unit.name,
  #                   type: "knowledge_unit",
  #                   cells:
  #                     Enum.map(unit.child_cells, fn cell ->
  #                       %{
  #                         id: cell.id,
  #                         name: cell.name,
  #                         type: "knowledge_cell",
  #                         importance_level: cell.importance_level
  #                       }
  #                     end)
  #                 }
  #               end),
  #             direct_cells:
  #               Enum.map(subject.direct_cells, fn cell ->
  #                 %{
  #                   id: cell.id,
  #                   name: cell.name,
  #                   type: "knowledge_cell"
  #                 }
  #               end)
  #           }
  #         end)
  #     })
  #   end

  #   # Get specific subject with its hierarchy
  #   def show_subject(conn, %{"id" => subject_id}) do
  #     subject = KgEdu.Knowledge.Resource.get_subject_with_units!(subject_id: subject_id)

  #     json(conn, %{data: format_subject_response(subject)})
  #   end

  #   # Get specific unit with its cells
  #   def show_unit(conn, %{"id" => unit_id}) do
  #     unit = KgEdu.Knowledge.Resource.get_unit_with_cells!(unit_id: unit_id)

  #     json(conn, %{data: format_unit_response(unit)})
  #   end

  #   # List all subjects
  #   def list_subjects(conn, %{"course_id" => course_id}) do
  #     subjects = KgEdu.Knowledge.Resource.list_subjects!(course_id: course_id)

  #     json(conn, %{
  #       data:
  #         Enum.map(subjects, fn s ->
  #           %{id: s.id, name: s.name, type: "subject"}
  #         end)
  #     })
  #   end

  #   defp format_subject_response(subject) do
  #     %{
  #       id: subject.id,
  #       name: subject.name,
  #       description: subject.description,
  #       type: "subject",
  #       units: Enum.map(subject.child_units, &format_unit_response/1),
  #       direct_cells: Enum.map(subject.direct_cells, &format_cell_response/1)
  #     }
  #   end

  #   defp format_unit_response(unit) do
  #     %{
  #       id: unit.id,
  #       name: unit.name,
  #       description: unit.description,
  #       type: "knowledge_unit",
  #       cells: Enum.map(unit.child_cells || [], &format_cell_response/1),
  #       parent_subject:
  #         unit.parent_subject &&
  #           %{
  #             id: unit.parent_subject.id,
  #             name: unit.parent_subject.name
  #           }
  #     }
  #   end

  #   defp format_cell_response(cell) do
  #     %{
  #       id: cell.id,
  #       name: cell.name,
  #       description: cell.description,
  #       type: "knowledge_cell",
  #       importance_level: cell.importance_level
  #     }
  #   end
  # end
end
