import React, { useState } from "react";
import {
  Card,
  Typography,
  Row,
  Col,
  Avatar,
  Spin,
  Empty,
  Tooltip,
  message,
} from "antd";
import {
  UserOutlined,
  BookOutlined,
  StarOutlined,
  MailOutlined,
  PhoneOutlined,
  BankOutlined,
  DownOutlined,
  RightOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { useTranslate } from "@/locales/use-locales";
import {
  listUsers,
  listCourses,
  listAssignmentsForTeacher,
  listCourseAssignments,
} from "@/lib/ash_rpc";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";

const { Title, Text } = Typography;

const DEFAULT_AVATAR =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23f5f5f5'/%3E%3Ccircle cx='50' cy='35' r='20' fill='%23ccc'/%3E%3Cellipse cx='50' cy='80' rx='30' ry='20' fill='%23ccc'/%3E%3C/svg%3E";

const extractArrayData = (result: any): any[] => {
  if (result?.success && result.data) {
    if (Array.isArray(result.data)) return result.data;
    if ("results" in result.data && Array.isArray(result.data.results))
      return result.data.results;
    if ("data" in result.data && Array.isArray(result.data.data))
      return result.data.data;
  }
  return [];
};

const getHeaders = (user: any): Record<string, string> =>
  getAuthHeaders(user) as Record<string, string>;

const ROLE_ORDER = ["primary_teacher", "assistant_teacher", "guest_teacher"];

const getRoleLabel = (role: string, t: any) => {
  switch (role) {
    case "primary_teacher":
      return t("pages.virtualResearchRoom.role.primary");
    case "assistant_teacher":
      return t("pages.virtualResearchRoom.role.assistant");
    case "guest_teacher":
      return t("pages.virtualResearchRoom.role.guest");
    default:
      return role;
  }
};

const getRoleColor = (role: string): string => {
  switch (role) {
    case "primary_teacher":
      return "#0056D2";
    case "assistant_teacher":
      return "#1A6B50";
    case "guest_teacher":
      return "#6B3FA0";
    default:
      return "#595959";
  }
};

const getRoleBgColor = (role: string): string => {
  switch (role) {
    case "primary_teacher":
      return "#E8F0FE";
    case "assistant_teacher":
      return "#E6F4EA";
    case "guest_teacher":
      return "#F3E8FD";
    default:
      return "#F5F5F5";
  }
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
          e.currentTarget.style.background = "#f0f0f0";
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

interface CourseWithTeachers {
  courseId: string;
  courseTitle: string;
  imageUrl: string;
  creatorId: string;
  creator: any;
  teachers: {
    teacherId: string;
    teacher: any;
    role: string;
  }[];
}

const buildCourseWithTeachers = (
  courses: any[],
  assignments: any[],
  teacherMap: Map<string, any>,
): CourseWithTeachers[] => {
  return courses.map((course: any) => {
    const courseAssignments = assignments.filter(
      (a: any) => a.courseId === course.id,
    );
    const teachersInCourse: CourseWithTeachers["teachers"] = [];
    courseAssignments.forEach((a: any) => {
      const teacher = teacherMap.get(a.teacherId);
      if (teacher) {
        teachersInCourse.push({ teacherId: a.teacherId, teacher, role: a.role });
      }
    });
    const creator = teacherMap.get(course.teacherId);
    if (creator && !teachersInCourse.find((t) => t.teacherId === course.teacherId)) {
      teachersInCourse.unshift({
        teacherId: course.teacherId,
        teacher: creator,
        role: "primary_teacher",
      });
    }
    teachersInCourse.sort(
      (a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role),
    );
    return {
      courseId: course.id,
      courseTitle: course.title,
      imageUrl: course.imageUrl || "",
      creatorId: course.teacherId,
      creator,
      teachers: teachersInCourse,
    };
  });
};

const fetchCoursesGroupedData = async (user: any): Promise<CourseWithTeachers[]> => {
  const currentTenant = getCurrentTenant();
  const tenant = currentTenant?.schemaName || "";
  const courseFields = ["id", "title", "teacherId", "imageUrl"];

  if (user?.role !== "teacher") {
    const coursesResult = await listCourses({
      tenant,
      fields: courseFields,
      page: { limit: 1000, offset: 0 },
      headers: getHeaders(user),
    });
    const courses = extractArrayData(coursesResult);
    if (courses.length === 0) return [];

    const courseIds = courses.map((c: any) => c.id);
    const teacherIds = new Set<string>();
    courses.forEach((c: any) => {
      if (c.teacherId) teacherIds.add(c.teacherId);
    });

    const assignmentsResult = await listCourseAssignments({
      tenant,
      fields: ["id", "courseId", "teacherId", "role"],
      filter: { courseId: { in: courseIds } },
      page: { limit: 1000, offset: 0 },
      headers: getHeaders(user),
    });
    const assignments = extractArrayData(assignmentsResult);
    assignments.forEach((a: any) => {
      if (a.teacherId) teacherIds.add(a.teacherId);
    });

    const teachersResult = await listUsers({
      tenant,
      fields: [
        "id", "name", "email", "phone", "role", "avatarUrl",
        "jobTitle", "bio", "major", "colledge",
      ],
      filter: { role: { eq: "teacher" }, id: { in: Array.from(teacherIds) } },
      headers: getHeaders(user),
    });
    const teachers = extractArrayData(teachersResult);
    const teacherMap = new Map<string, any>();
    teachers.forEach((t: any) => teacherMap.set(t.id, t));

    return buildCourseWithTeachers(courses, assignments, teacherMap);
  }

  const currentTeacherId = user.id;

  const createdCoursesResult = await listCourses({
    tenant,
    fields: courseFields,
    filter: { teacherId: { eq: currentTeacherId } },
    page: { limit: 1000, offset: 0 },
    headers: getHeaders(user),
  });
  const createdCourses = extractArrayData(createdCoursesResult);

  const assignedResult = await listAssignmentsForTeacher({
    tenant,
    input: { teacherId: currentTeacherId },
    fields: ["id", "courseId"],
    headers: getHeaders(user),
  });
  const assignedCourses = extractArrayData(assignedResult);

  const allCourseIds = [
    ...new Set([
      ...createdCourses.map((c: any) => c.id),
      ...assignedCourses.map((a: any) => a.courseId).filter(Boolean),
    ]),
  ];

  if (allCourseIds.length === 0) return [];

  const allCoursesResult = await listCourses({
    tenant,
    fields: courseFields,
    filter: { id: { in: allCourseIds } },
    page: { limit: 1000, offset: 0 },
    headers: getHeaders(user),
  });
  const allCourses = extractArrayData(allCoursesResult);

  const allAssignmentsResult = await listCourseAssignments({
    tenant,
    fields: ["id", "courseId", "teacherId", "role"],
    filter: { courseId: { in: allCourseIds } },
    page: { limit: 1000, offset: 0 },
    headers: getHeaders(user),
  });
  const allAssignments = extractArrayData(allAssignmentsResult);

  const teacherIds = new Set<string>();
  allCourses.forEach((c: any) => {
    if (c.teacherId) teacherIds.add(c.teacherId);
  });
  allAssignments.forEach((a: any) => {
    if (a.teacherId) teacherIds.add(a.teacherId);
  });

  const allTeachersResult = await listUsers({
    tenant,
    fields: [
      "id", "name", "email", "phone", "role", "avatarUrl",
      "jobTitle", "bio", "major", "colledge",
    ],
    filter: { role: { eq: "teacher" }, id: { in: Array.from(teacherIds) } },
    headers: getHeaders(user),
  });
  const allTeachers = extractArrayData(allTeachersResult);
  const teacherMap = new Map<string, any>();
  allTeachers.forEach((t: any) => teacherMap.set(t.id, t));

  return buildCourseWithTeachers(allCourses, allAssignments, teacherMap);
};

const ROLE_ICON: Record<string, React.ReactNode> = {
  primary_teacher: <StarOutlined />,
  assistant_teacher: <BookOutlined />,
  guest_teacher: <UserOutlined />,
};

const TeacherRow: React.FC<{
  teacher: any;
  role: string;
  t: any;
}> = ({ teacher, role, t }) => {
  const roleColor = getRoleColor(role);
  const roleBgColor = getRoleBgColor(role);
  const roleIcon = ROLE_ICON[role];
  const roleLabel = getRoleLabel(role, t);

  return (
    <Card
      style={{
        borderRadius: 12,
        overflow: "hidden",
        border: "1px solid #e8e8e8",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        transition: "all 0.2s ease-in-out",
        height: "100%",
      }}
      styles={{ body: { padding: 0 } }}
      hoverable
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.12)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)";
      }}
    >
      <div style={{ display: "flex", minHeight: 160 }}>
        {/* 左侧：头像、姓名、职称、角色 */}
        <div
          style={{
            width: 140,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "14px 12px",
            backgroundColor: "#fafafa",
            borderRight: "1px solid #f0f0f0",
            gap: 6,
          }}
        >
          <Avatar
            size={52}
            src={teacher.avatarUrl || DEFAULT_AVATAR}
            alt={teacher.name}
            style={{
              border: "2px solid #fff",
              boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
            }}
          />

          <Text strong ellipsis style={{ fontSize: 14, textAlign: "center", width: "100%" }}>
            {teacher.name || t("pages.virtualResearchRoom.unknownTeacher")}
          </Text>

          {teacher.jobTitle && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {teacher.jobTitle}
            </Text>
          )}

          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 11,
              color: roleColor,
              background: roleBgColor,
              borderRadius: 4,
              padding: "2px 8px",
              fontWeight: 500,
            }}
          >
            {roleIcon && React.cloneElement(roleIcon as React.ReactElement, { style: { fontSize: 11 } })}
            {roleLabel}
          </span>
        </div>

        {/* 右侧：简介和联系方式 */}
        <div
          style={{
            flex: 1,
            padding: "12px 16px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* 个人简介 */}
          <div style={{ flex: 1 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 4,
              }}
            >
              <UserOutlined style={{ fontSize: 13, color: "#8c8c8c" }} />
              <Text strong style={{ fontSize: 13, color: "#404040" }}>
                个人简介
              </Text>
            </div>

            {teacher.bio ? (
              <Typography.Paragraph
                type="secondary"
                ellipsis={{ rows: 3, expandable: true, symbol: "展开" }}
                style={{ lineHeight: 1.5, marginBottom: 0, fontSize: 13 }}
              >
                {teacher.bio}
              </Typography.Paragraph>
            ) : (
              <Text
                type="secondary"
                italic
                style={{ fontSize: 13 }}
              >
                暂无个人简介信息
              </Text>
            )}
          </div>

          {/* 底部联系信息 */}
          {(teacher.email || teacher.phone || teacher.colledge) && (
            <div
              style={{
                marginTop: 8,
                paddingTop: 8,
                borderTop: "1px solid #f0f0f0",
                display: "flex",
                alignItems: "center",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              {teacher.email && (
                <CopyText
                  text={teacher.email}
                  icon={
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 12,
                        color: "#8c8c8c",
                      }}
                    >
                      <MailOutlined style={{ fontSize: 12 }} />
                      {teacher.email}
                    </span>
                  }
                />
              )}
              {teacher.phone && (
                <CopyText
                  text={teacher.phone}
                  icon={
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 12,
                        color: "#8c8c8c",
                      }}
                    >
                      <PhoneOutlined style={{ fontSize: 12 }} />
                      {teacher.phone}
                    </span>
                  }
                />
              )}
              {teacher.colledge && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 12,
                    color: "#8c8c8c",
                  }}
                >
                  <BankOutlined style={{ fontSize: 12 }} />
                  {teacher.colledge}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

const CourseGroupCard: React.FC<{
  course: CourseWithTeachers;
  t: any;
  isLast?: boolean;
}> = ({ course, t, isLast }) => {
  const courseId = `course-${course.courseId}`;
  const [expanded, setExpanded] = useState(true);

  return (
    <div style={{ marginBottom: isLast ? 0 : 16 }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "12px 0",
          cursor: "pointer",
        }}
      >
        {expanded ? (
          <DownOutlined style={{ color: "#1890ff", fontSize: 14 }} />
        ) : (
          <RightOutlined style={{ color: "#1890ff", fontSize: 14 }} />
        )}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <BookOutlined style={{ fontSize: 16, color: "#1890ff" }} />
          <Title
            level={5}
            style={{
              margin: 0,
              color: "#262626",
              fontWeight: 600,
            }}
          >
            {course.courseTitle || t("pages.virtualResearchRoom.unknownCourse")}
          </Title>
        </div>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {course.teachers.length} 位教师
        </Text>
      </div>
      {expanded && (
        <div style={{ paddingBottom: 8 }}>
          <Row gutter={[16, 16]}>
            {course.teachers.map((item) => (
              <Col xs={24} md={12} key={item.teacherId}>
                <TeacherRow teacher={item.teacher} role={item.role} t={t} />
              </Col>
            ))}
          </Row>
        </div>
      )}
      {!isLast && (
        <div
          style={{
            borderTop: "1px dashed #d9d9d9",
            marginTop: 8,
          }}
        />
      )}
    </div>
  );
};

export default function VirtualResearchRoom() {
  const { user } = useAuth();
  const { t } = useTranslate("teacher");

  const {
    data: coursesData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["courses-grouped-teachers"],
    queryFn: () => fetchCoursesGroupedData(user),
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: 300,
        }}
      >
        <Spin size="large" tip={t("pages.virtualResearchRoom.loading")}>
          <div style={{ padding: 50 }} />
        </Spin>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <Text type="danger">{t("pages.virtualResearchRoom.loadError")}</Text>
      </div>
    );
  }

  const courses = coursesData || [];

  return (
    <div style={{ padding: 24, minHeight: "calc(100vh - 56px)" }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={4} style={{ marginBottom: 4, fontWeight: 700 }}>
          {t("pages.virtualResearchRoom.title")}
        </Title>
        <Text type="secondary" style={{ fontSize: 14 }}>
          {t("pages.virtualResearchRoom.subtitle")}
        </Text>
      </div>

      {courses.length === 0 ? (
        <Card style={{ borderRadius: 12 }}>
          <Empty
            description={t("pages.virtualResearchRoom.noTeachers")}
            style={{ padding: "40px 0" }}
          />
        </Card>
      ) : (
        <div>
          {courses.map((course, index) => (
            <CourseGroupCard
              key={course.courseId}
              course={course}
              t={t}
              isLast={index === courses.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
