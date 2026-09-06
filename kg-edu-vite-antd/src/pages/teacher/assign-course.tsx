import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  Typography,
  Button,
  Modal,
  Select,
  Tag,
  Tooltip,
  message,
  Popconfirm,
  Empty,
  Spin,
  Table,
} from "antd";
import {
  UserAddOutlined,
  DeleteOutlined,
  TeamOutlined,
  ArrowLeftOutlined
} from "@ant-design/icons";
import {
  listUsers,
  listCourses,
  listAssignmentsByTeacher,
  assignCourseToTeacher,
  removeCourseFromTeacher,
} from "@/lib/ash_rpc";
import { useAuth } from "@/auth/auth-context";
import { getCurrentTenant } from "@/lib/tenant";
import { extractArrayData, getHeaders } from "@/utils/api-helpers";
import { useEditPermission } from "@/hooks/use-edit-permission";
import { ReadonlyActionButton } from "@/components/readonly-action-button";
import { useTranslate } from "@/locales/use-locales";
import type { ColumnsType } from "antd/es/table";

const { Title, Text } = Typography;

interface User {
  id: string;
  name?: string;
  email?: string;
  role?: string;
}

interface Assignment {
  id: string;
  courseId: string;
  teacherId: string;
  role: string;
  course?: { id: string; title: string };
  teacher?: { id: string; name?: string; email?: string };
}

type TeacherAssignmentRole = "primary_teacher" | "assistant_teacher" | "guest_teacher";

export default function TeacherAssignCoursePage() {
  const navigate = useNavigate();
  const { t } = useTranslate("teacher");
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const currentTenant = getCurrentTenant();
  const { canEdit } = useEditPermission();

  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<string>("");
  const [selectedTeacher, setSelectedTeacher] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<TeacherAssignmentRole>("assistant_teacher");

  const tenant = currentTenant?.schemaName || "";

  const { data: coursesResponse, isLoading: coursesLoading } = useQuery({
    queryKey: ["my-courses", user?.id, tenant],
    queryFn: async () => {
      if (!user?.id) return { success: true, data: [] };
      const result = await listCourses({
        tenant,
        fields: ["id", "title"],
        filter: { teacherId: { eq: user.id } },
        headers: getHeaders(user),
      });
      return result;
    },
    enabled: !!tenant && !!user,
  });

  const courses = useMemo(() => extractArrayData(coursesResponse) || [], [coursesResponse]);

  const { data: usersResponse, isLoading: usersLoading } = useQuery({
    queryKey: ["users", tenant],
    queryFn: () =>
      listUsers({
        tenant,
        fields: ["id", "name", "email", "role"],
        headers: getHeaders(user),
      }),
    enabled: !!tenant && !!user,
  });

  const users: User[] = extractArrayData(usersResponse);

  const teachers = users?.filter(
    (u) => u.role === "teacher",
  );

  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: ["course-assignments", user?.id, tenant],
    queryFn: async () => {
      if (!user?.id) return [];
      const result = await listAssignmentsByTeacher({
        tenant,
        filter: { assignedBy: { id: { eq: user.id } } },
        fields: [
          "id",
          "courseId",
          "teacherId",
          "role",
          { course: ["id", "title"] },
          { teacher: ["id", "name", "email"] },
        ],
        headers: getHeaders(user),
      });
      return extractArrayData(result);
    },
    enabled: !!tenant && !!user,
  });

  const assignMutation = useMutation({
    mutationFn: (data: { courseId: string; teacherId: string; role: TeacherAssignmentRole }) =>
      assignCourseToTeacher({
        tenant,
        input: {
          courseId: data.courseId,
          teacherId: data.teacherId,
          role: data.role,
          assignedBy: user?.id,
        },
        fields: [
          "id",
          "courseId",
          "teacherId",
          "role",
          { course: ["id", "title"] },
          { teacher: ["id", "name", "email"] },
        ],
        headers: getHeaders(user),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["teachers-data"] });
      message.success(t("common.updateSuccess"));
      setAssignDialogOpen(false);
      setSelectedCourse("");
      setSelectedTeacher("");
      setSelectedRole("assistant_teacher");
    },
    onError: (error: unknown) => {
      message.error(error instanceof Error ? error.message : t("common.updateFailed"));
    },
  });

  const removeMutation = useMutation({
    mutationFn: (data: { courseId: string; teacherId: string }) =>
      removeCourseFromTeacher({
        tenant,
        input: {
          courseId: data.courseId,
          teacherId: data.teacherId,
        },
        headers: getHeaders(user),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-assignments"] });
      message.success(t("common.deleteSuccess"));
    },
    onError: (error: unknown) => {
      message.error(error instanceof Error ? error.message : t("common.deleteFailed"));
    },
  });

  const handleAssignCourse = () => {
    if (!selectedCourse || !selectedTeacher) return;
    assignMutation.mutate({
      courseId: selectedCourse,
      teacherId: selectedTeacher,
      role: selectedRole,
    });
  };

  const handleRemoveAssignment = (courseId: string, teacherId: string) => {
    removeMutation.mutate({ courseId, teacherId });
  };

  const getCourseTitle = (courseId: string) => {
    const course = courses?.find((c) => c.id === courseId);
    return course?.title || courseId;
  };

  const getTeacherName = (teacherId: string) => {
    const teacher = teachers?.find((t) => t.id === teacherId);
    return teacher?.name || teacher?.email || teacherId;
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "primary_teacher":
        return "主讲教师";
      case "assistant_teacher":
        return "助理教师";
      case "guest_teacher":
        return "客座教师";
      default:
        return role;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "primary_teacher":
        return "blue";
      case "assistant_teacher":
        return "green";
      default:
        return "default";
    }
  };

  if (!user || coursesLoading || usersLoading || assignmentsLoading) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <Spin />
      </div>
    );
  }

  const columns: ColumnsType<Assignment> = [
    {
      title: "课程",
      key: "course",
      width: "40%",
      render: (_, record) => (
        <Tooltip title={getCourseTitle(record.courseId)} mouseEnterDelay={0.3}>
          <Text strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{getCourseTitle(record.courseId)}</Text>
        </Tooltip>
      ),
    },
    {
      title: "授课教师",
      key: "teacher",
      width: "30%",
      render: (_, record) => getTeacherName(record.teacherId),
    },
    {
      title: "角色",
      key: "role",
      className: "asgn-mobile-hide",
      width: "15%",
      render: (_, record) => <Tag color={getRoleColor(record.role)}>{getRoleLabel(record.role)}</Tag>,
    },
    {
      title: "操作",
      key: "actions",
      width: 60,
      align: "center",
      render: (_, record) => (
        <Popconfirm title="确定删除？" onConfirm={() => handleRemoveAssignment(record.courseId, record.teacherId)}>
          <ReadonlyActionButton type="link" danger size="small" icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div className="asgn-page-wrap" style={{ padding: 24 }}>
      <style>{`@media(max-width:768px){.asgn-mobile-hide{display:none!important}.asgn-page-wrap{padding:12px!important}}`}</style>
      {/* 标题区域 */}
      <div style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <TeamOutlined style={{ fontSize: 24, color: "#1890ff" }} />
          <Button
                      className="teacher-page-back-btn"
                      type="text"
                      icon={<ArrowLeftOutlined />}
                      onClick={() => navigate("/teacher/dashboard")}
                      style={{ color: "#1890ff", padding: "4px 8px", fontSize: 16 }}
                    />
                                  <Title level={4} style={{ margin: 0 }}>课程分配管理</Title>
          </div>
          <Text type="secondary">管理教师与课程的分配关系</Text>
        </div>
        <Button type="primary" icon={<UserAddOutlined />} onClick={() => setAssignDialogOpen(true)} style={canEdit ? undefined : { display: "none" }}>
          分配课程
        </Button>
      </div>

      {/* 表格 */}
      <Card style={{ borderRadius: 8 }}>
        {assignments?.length === 0 ? (
          <Empty description="暂无课程分配" />
        ) : (
          <Table
            columns={columns}
            dataSource={assignments}
            rowKey={(record) => `${record.courseId}-${record.teacherId}`}
            pagination={false}
            size="small"
          />
        )}
      </Card>

      {/* 分配弹窗 */}
      <Modal
        title="分配课程给教师"
        open={assignDialogOpen}
        onCancel={() => setAssignDialogOpen(false)}
        onOk={handleAssignCourse}
        confirmLoading={assignMutation.isPending}
        okButtonProps={{ disabled: !selectedCourse || !selectedTeacher }}
      >
        <div style={{ paddingTop: 16 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", marginBottom: 8 }}>选择课程</label>
            <Select
              value={selectedCourse}
              onChange={setSelectedCourse}
              placeholder="请选择课程"
              style={{ width: "100%" }}
              options={courses?.map((course) => ({
                value: course.id,
                label: course.title,
              }))}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", marginBottom: 8 }}>选择教师</label>
            <Select
              value={selectedTeacher}
              onChange={setSelectedTeacher}
              placeholder="请选择教师"
              style={{ width: "100%" }}
              options={teachers?.map((teacher) => ({
                value: teacher.id,
                label: teacher?.name || teacher?.email || teacher.id,
              }))}
            />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: 8 }}>教师角色</label>
            <Select
              value={selectedRole}
              onChange={setSelectedRole}
              style={{ width: "100%" }}
              options={[
                { value: "primary_teacher", label: "主讲教师" },
                { value: "assistant_teacher", label: "助理教师" },
                { value: "guest_teacher", label: "客座教师" },
              ]}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
