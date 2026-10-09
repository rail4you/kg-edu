import React, { useState, useEffect, useMemo } from "react";
import { Typography, Spin, Alert, Button, Tooltip, message, Grid,
} from "antd";
import {
  UserOutlined,
  BookOutlined,
  StarOutlined,
  TeamOutlined,
  MailOutlined,
  EnvironmentOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/auth/auth-context";
import { getCurrentTenant } from "@/lib/tenant";
import { listCourseAssignments, listCourses, getUser } from "@/lib/ash_rpc";
import { getHeaders, extractArrayData } from "@/utils/api-helpers";
import { themeColors as colors } from "@/styles/theme";
import { PageHead, ProtoTag } from "@/components/proto";

const { Title, Text, Paragraph } = Typography;

interface TeacherWithRole {
  id: string;
  name: string | null;
  jobTitle: string | null;
  avatarUrl: string | null;
  bio: string | null;
  major: string | null;
  colledge: string | null;
  email: string | null;
  role: "course_creator" | "primary_teacher" | "assistant_teacher" | "guest_teacher";
  assignedAt: string | null;
}

const ROLE_CONFIG: Record<
  string,
  {
    label: string;
    color: string;
    bgColor: string;
    borderColor: string;
    badgeBg: string;
    icon: React.ReactNode;
  }
> = {
  course_creator: {
    label: "课程创建者",
    color: colors.primary,
    bgColor: `${colors.primary}08`,
    borderColor: `${colors.primary}20`,
    badgeBg: colors.primary,
    icon: <StarOutlined />,
  },
  primary_teacher: {
    label: "主讲教师",
    color: "#0d9488",
    bgColor: "rgba(13, 148, 136, 0.06)",
    borderColor: "rgba(13, 148, 136, 0.15)",
    badgeBg: "#0d9488",
    icon: <StarOutlined />,
  },
  assistant_teacher: {
    label: "助教",
    color: "#d97706",
    bgColor: "rgba(217, 119, 6, 0.06)",
    borderColor: "rgba(217, 119, 6, 0.15)",
    badgeBg: "#d97706",
    icon: <BookOutlined />,
  },
  guest_teacher: {
    label: "客座教师",
    color: "#7c3aed",
    bgColor: "rgba(124, 58, 237, 0.06)",
    borderColor: "rgba(124, 58, 237, 0.15)",
    badgeBg: "#7c3aed",
    icon: <UserOutlined />,
  },
};

const CopyText: React.FC<{ text: string; icon?: React.ReactNode }> = ({
  text,
  icon,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      message.success("已复制");
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <Tooltip title={copied ? "已复制 ✓" : text}>
      <span
        onClick={handleCopy}
        style={{
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          padding: "2px 4px",
          borderRadius: 4,
          transition: "background 0.15s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "#edf0f5";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
      >
        {icon}
      </span>
    </Tooltip>
  );
};

const TeacherCard: React.FC<{ teacher: TeacherWithRole }> = ({ teacher }) => {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const roleConfig = ROLE_CONFIG[teacher.role];
  const initial = (teacher.name || "师").trim().charAt(0);

  return (
    <div
      className="pu-card"
      style={{
        padding: isMobile ? 16 : 20,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        height: "100%",
        transition: "border-color 0.2s ease, transform 0.2s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "#c6d3f7";
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--pu-line)";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      {/* 头像 + 姓名 + 角色 */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            overflow: "hidden",
            background: "var(--pu-blue-soft, #edf2ff)",
            color: "var(--pu-blue, #2859df)",
            display: "grid",
            placeItems: "center",
            fontSize: 22,
            fontWeight: 650,
            flexShrink: 0,
          }}
        >
          {teacher.avatarUrl ? (
            <img
              src={teacher.avatarUrl}
              alt={teacher.name || "Teacher"}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            initial
          )}
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 17,
              fontWeight: 650,
              color: "var(--pu-ink)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {teacher.name || "未知教师"}
          </div>
          <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {roleConfig && <ProtoTag tone="blue">{roleConfig.label}</ProtoTag>}
            {teacher.jobTitle && (
              <span style={{ fontSize: 12, color: "var(--pu-muted)" }}>{teacher.jobTitle}</span>
            )}
          </div>
        </div>
      </div>

      {/* 院校 / 专业 */}
      {(teacher.colledge || teacher.major) && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--pu-muted)" }}>
          <EnvironmentOutlined />
          <span>{[teacher.colledge, teacher.major].filter(Boolean).join(" · ")}</span>
        </div>
      )}

      {/* 简介 */}
      <div style={{ flex: 1, minHeight: 20 }}>
        {teacher.bio ? (
          <Paragraph
            ellipsis={{ rows: 2, expandable: true, symbol: "展开" }}
            style={{ lineHeight: 1.7, fontSize: 13, color: "var(--pu-muted)", marginBottom: 0 }}
          >
            {teacher.bio}
          </Paragraph>
        ) : (
          <Text style={{ fontSize: 13, color: "var(--pu-muted)" }}>暂无简介</Text>
        )}
      </div>

      {/* 邮箱 */}
      {teacher.email && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            color: "var(--pu-muted)",
          }}
        >
          <MailOutlined />
          <CopyText
            text={teacher.email}
            icon={
              <Text style={{ fontSize: 12, color: "var(--pu-muted)" }} ellipsis>
                {teacher.email}
              </Text>
            }
          />
        </div>
      )}
    </div>
  );
};

const RoleGroupSection: React.FC<{
  role: string;
  roleTeachers: TeacherWithRole[];
}> = ({ role, roleTeachers }) => {
  const config = ROLE_CONFIG[role];
  if (!config) return null;

  return (
    <div style={{ marginBottom: 28 }}>
      {/* 角色分组标题 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 14,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: config.bgColor,
            border: `1px solid ${config.borderColor}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {config.icon && React.cloneElement(config.icon as React.ReactElement, {
            style: { color: config.color, fontSize: 13 },
          })}
        </div>
        <Text strong style={{ fontSize: 14, color: colors.textPrimary }}>
          {config.label}
        </Text>
        {roleTeachers.length > 1 && (
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>
            {roleTeachers.length} 位
          </Text>
        )}
      </div>

      {/* 3列网格 */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 16,
      }}>
        {roleTeachers.map((teacher) => (
          <TeacherCard key={teacher.id} teacher={teacher} />
        ))}
      </div>
    </div>
  );
};

export default function CourseTeachersPage() {
  const { useBreakpoint } = Grid;
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const { user, loading: authLoading } = useAuth();
  const currentTenant = getCurrentTenant();
  const navigate = useNavigate();
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // 优先级：URL 路径参数 > 查询参数（来自 front 页面链接） > localStorage
    const urlCourseId = searchParams.get("courseId");
    const storedCourseId = localStorage.getItem("selectedCourse");
    const next = urlCourseId || storedCourseId;
    setSelectedCourse(next);
    if (next) {
      localStorage.setItem("selectedCourse", next);
    }
  }, [searchParams]);

  const tenant = currentTenant?.schemaName || "";

  const { data: courseData } = useQuery({
    queryKey: ["course", selectedCourse, tenant],
    queryFn: async () => {
      const result = await listCourses({
        tenant,
        fields: ["id", "title", "description", "teacherId"],
        filter: { id: { eq: selectedCourse! } },
        page: { limit: 1, offset: 0 },
        headers: getHeaders(user),
      });
      return result;
    },
    enabled: !!selectedCourse && !!tenant,
  });

  const course = useMemo(() => {
    const data = extractArrayData(courseData);
    return data[0] || null;
  }, [courseData]);

  const { data: creatorData } = useQuery({
    queryKey: ["user", course?.teacherId, tenant],
    queryFn: async () => {
      const result = await getUser({
        tenant,
        fields: [
          "id",
          "name",
          "jobTitle",
          "avatarUrl",
          "bio",
          "major",
          "colledge",
          "email",
        ],
        input: { id: course!.teacherId },
        headers: getHeaders(user),
      });
      return result;
    },
    enabled: !!course?.teacherId && !!tenant,
  });

  const courseCreator = creatorData?.success ? creatorData.data : null;

  const { data: assignmentsData, isLoading, error } = useQuery({
    queryKey: ["course-assignments", selectedCourse, currentTenant?.id],
    queryFn: async () => {
      const result = await listCourseAssignments({
        tenant,
        fields: [
          "id",
          "role",
          "assignedAt",
          {
            teacher: [
              "id",
              "name",
              "jobTitle",
              "avatarUrl",
              "bio",
              "major",
              "colledge",
              "email",
            ],
          },
        ],
        filter: { courseId: { eq: selectedCourse! } },
        sort: "role",
        page: { limit: 100, offset: 0 },
        headers: getHeaders(user),
      });
      return result;
    },
    enabled: !!selectedCourse && !!tenant,
  });

  const teachers: TeacherWithRole[] = useMemo(() => {
    const teacherList: TeacherWithRole[] = [];

    if (courseCreator) {
      teacherList.push({
        id: courseCreator.id,
        name: courseCreator.name || null,
        jobTitle: courseCreator.jobTitle || null,
        avatarUrl: courseCreator.avatarUrl || null,
        bio: courseCreator.bio || null,
        major: courseCreator.major || null,
        colledge: courseCreator.colledge || null,
        email: courseCreator.email || null,
        role: "course_creator",
        assignedAt: null,
      });
    }

    if (assignmentsData?.success) {
      const assignments = extractArrayData(assignmentsData);

      const assignmentTeachers = assignments.map((assignment: any) => ({
        id: assignment.teacher?.id || assignment.id,
        name: assignment.teacher?.name || null,
        jobTitle: assignment.teacher?.jobTitle || null,
        avatarUrl: assignment.teacher?.avatarUrl || null,
        bio: assignment.teacher?.bio || null,
        major: assignment.teacher?.major || null,
        colledge: assignment.teacher?.colledge || null,
        email: assignment.teacher?.email || null,
        role: assignment.role,
        assignedAt: assignment.assignedAt,
      }));

      const existingIds = new Set(teacherList.map((t) => t.id));
      assignmentTeachers.forEach((teacher) => {
        if (!existingIds.has(teacher.id)) {
          teacherList.push(teacher);
          existingIds.add(teacher.id);
        }
      });
    }

    return teacherList;
  }, [assignmentsData, courseCreator]);

  const groupedTeachers = useMemo(() => {
    const groups: Record<string, TeacherWithRole[]> = {
      course_creator: [],
      primary_teacher: [],
      assistant_teacher: [],
      guest_teacher: [],
    };

    teachers.forEach((teacher) => {
      if (groups[teacher.role]) {
        groups[teacher.role].push(teacher);
      }
    });

    return groups;
  }, [teachers]);

  if (authLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div style={{ textAlign: "center", padding: 60 }}>
        <Alert
          message="未选择组织"
          description="请选择一个组织以查看教师信息。"
          type="warning"
          showIcon
        />
      </div>
    );
  }

  if (!selectedCourse) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: isMobile ? 200 : "calc(100vh - 200px)" }}>
        <div style={{
          background: "#fff", borderRadius: 16, padding: isMobile ? 24 : 48,
          textAlign: "center", boxShadow: "0 2px 12px rgba(0, 88, 190, 0.04)", maxWidth: 400,
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: `${colors.primary}08`, display: "flex",
            alignItems: "center", justifyContent: "center", margin: "0 auto 20px",
          }}>
            <BookOutlined style={{ fontSize: 28, color: colors.primary }} />
          </div>
          <Title level={4} style={{ color: colors.textPrimary, marginBottom: 8 }}>
            未选择课程
          </Title>
          <Text type="secondary" style={{ display: "block", marginBottom: 20, fontSize: 14 }}>
            请先选择一门课程以查看该课程的教师团队
          </Text>
          <Button type="primary" onClick={() => navigate("/dashboard")} style={{ borderRadius: 8 }}>
            返回学习中心
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          message="加载教师信息失败"
          description={(error as Error).message}
          type="error"
          showIcon
        />
      </div>
    );
  }

  if (!teachers.length) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: isMobile ? 200 : "calc(100vh - 200px)" }}>
        <div style={{
          background: "#fff", borderRadius: 16, padding: isMobile ? 24 : 48,
          textAlign: "center", boxShadow: "0 2px 12px rgba(0, 88, 190, 0.04)", maxWidth: 400,
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: `${colors.primary}08`, display: "flex",
            alignItems: "center", justifyContent: "center", margin: "0 auto 20px",
          }}>
            <TeamOutlined style={{ fontSize: 28, color: colors.primary }} />
          </div>
          <Title level={4} style={{ color: colors.textPrimary, marginBottom: 8 }}>
            该课程暂无教师信息
          </Title>
          <Text type="secondary" style={{ fontSize: 14 }}>
            {course?.title || "课程"} 尚未分配教师
          </Text>
        </div>
      </div>
    );
  }

  return (
    <div className="pu-page">
      <PageHead
        title="教师团队"
        description="与课程教师保持连接，获得学习支持。"
        actions={
          <div className="pu-tags">
            <ProtoTag tone="blue">共 {teachers.length} 位教师</ProtoTag>
          </div>
        }
      />
      {/* 教师卡片网格 */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
        gap: isMobile ? 12 : 20,
        marginBottom: isMobile ? 16 : 24,
      }}>
        {teachers.map((teacher) => (
          <TeacherCard key={teacher.id} teacher={teacher} />
        ))}
      </div>
    </div>
  );
}
