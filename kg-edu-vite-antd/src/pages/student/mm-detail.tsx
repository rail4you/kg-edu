import { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button, Empty, Spin } from "antd";
import {
  BookOutlined,
  ClockCircleOutlined,
  StarOutlined,
  TrophyOutlined,
  ScheduleOutlined,
  TeamOutlined,
  RightOutlined,
  CheckCircleFilled,
} from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { getCurrentTenant } from "@/lib/tenant";
import { getAuthHeaders } from "@/lib/auth";
import { useMicroMajorDetail } from "@/hooks/use-micro-major-catalog";
import { myMicroMajorEnrollments } from "@/lib/ash_rpc";
import { extractArrayData } from "@/utils/api-helpers";
import { PageHead, ProtoCard, ProtoTag } from "@/components/proto";

export default function StudentMicroMajorDetail() {
  const { tenant: routeTenant, id } = useParams<{ tenant: string; id: string }>();
  const currentTenant = getCurrentTenant();
  const tenant = routeTenant || currentTenant?.schemaName || "";
  const { user } = useAuth();
  const navigate = useNavigate();

  const { major, courses, isLoading } = useMicroMajorDetail(tenant, id || "");
  const headers = useMemo(() => getAuthHeaders(user) as Record<string, string>, [user]);

  const { data: enrollments = [] } = useQuery({
    queryKey: ["student-mm-detail-enrollments", tenant, user?.id, id],
    queryFn: async () => {
      if (!user || !tenant) return [];
      const result = await myMicroMajorEnrollments({
        tenant,
        fields: ["id", "microMajorId", "status", "progress"],
        headers,
      });
      return extractArrayData(result) as Array<{ id: string; microMajorId: string; status: string; progress?: number }>;
    },
    enabled: !!user && !!tenant,
  });

  const enrollment = enrollments.find((e) => e.microMajorId === id);
  const isEnrolled = enrollment?.status === "active";
  const isCompleted = enrollment?.status === "completed";

  const handleCourseClick = (courseId: string) => {
    navigate(`/dashboard/mm-course?mmCourseId=${courseId}&mmId=${major?.id || id}&tenant=${tenant}`);
  };

  if (isLoading) {
    return (
      <div className="pu-page" style={{ display: "flex", justifyContent: "center", padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!major) {
    return (
      <div className="pu-page">
        <Empty description="微专业不存在或已下架" />
      </div>
    );
  }

  const infoRows = [
    { label: "学习周期", value: major.learningCycle || "—" },
    { label: "考核方式", value: major.assessmentMethod || "—" },
    { label: "学费标准", value: major.tuitionFee || "—" },
    { label: "课程数量", value: `${courses.length} 门` },
  ];

  return (
    <div className="pu-page">
      <PageHead
        title={major.name}
        description={major.intro || major.projectBackground || "围绕产业需求与岗位能力构建课程组合。"}
      />

      <div className="pu-stack">
        {/* 左：介绍 + 目标 + 课程 */}
        <div className="pu-stack">
          <ProtoCard title="项目介绍">
            <div className="pu-section-title" style={{ fontSize: 15 }}>项目背景</div>
            <p style={{ color: "var(--pu-muted)", lineHeight: 1.9, fontSize: 14, marginBottom: 18 }}>
              {major.projectBackground || "暂无项目背景"}
            </p>
            <div className="pu-section-title" style={{ fontSize: 15 }}>项目特色</div>
            <p style={{ color: "var(--pu-muted)", lineHeight: 1.9, fontSize: 14, margin: 0 }}>
              {major.projectFeatures || "暂无项目特色"}
            </p>
          </ProtoCard>

          <ProtoCard title="培养目标">
            <div className="pu-metrics">
              <div>
                <small>知识目标</small>
                <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--pu-ink)", lineHeight: 1.7 }}>
                  {major.knowledgeObjective || "—"}
                </p>
              </div>
              <div>
                <small>能力目标</small>
                <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--pu-ink)", lineHeight: 1.7 }}>
                  {major.abilityObjective || "—"}
                </p>
              </div>
              <div>
                <small>素养目标</small>
                <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--pu-ink)", lineHeight: 1.7 }}>
                  {major.qualityObjective || "—"}
                </p>
              </div>
            </div>
          </ProtoCard>

          <ProtoCard title={`课程设置 · ${courses.length} 门`}>
            {courses.length === 0 ? (
              <Empty description="暂无课程" />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {courses.map((course) => (
                  <div
                    key={course.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      padding: 14,
                      border: "1px solid var(--pu-line)",
                      borderRadius: 12,
                    }}
                  >
                    <span
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        background: "var(--pu-blue-soft, #edf2ff)",
                        color: "var(--pu-blue)",
                        display: "grid",
                        placeItems: "center",
                        flexShrink: 0,
                      }}
                    >
                      <BookOutlined />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--pu-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {course.title}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--pu-muted)", marginTop: 2 }}>
                        {[course.credits ? `${course.credits} 学分` : null, course.semesterHours ? `${course.semesterHours} 学时` : null]
                          .filter(Boolean)
                          .join(" · ") || "微专业课程"}
                      </div>
                    </div>
                    <Button
                      type="primary"
                      icon={<RightOutlined />}
                      iconPosition="end"
                      onClick={() => handleCourseClick(course.id)}
                    >
                      进入学习
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ProtoCard>
        </div>

        {/* 右：信息 + 教师 */}
        <div className="pu-stack">
          <ProtoCard title="专业信息">
            <div className="pu-info">
              {infoRows.map((row) => (
                <div className="pu-info__row" key={row.label}>
                  <span className="pu-info__label">{row.label}</span>
                  <span className="pu-info__value">{row.value}</span>
                </div>
              ))}
            </div>
          </ProtoCard>

          <ProtoCard title="教师团队">
            {(() => {
              const teachers = [
                { person: major.responsibleTeacher, role: "负责人" },
                { person: major.consultantTeacher, role: "顾问教师" },
              ].filter((t) => t.person);
              if (teachers.length === 0) {
                return <Empty description="暂无教师信息" />;
              }
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {teachers.map((t, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: "50%",
                          overflow: "hidden",
                          background: "var(--pu-blue-soft, #edf2ff)",
                          color: "var(--pu-blue)",
                          display: "grid",
                          placeItems: "center",
                          fontSize: 18,
                          fontWeight: 650,
                          flexShrink: 0,
                        }}
                      >
                        {t.person?.avatarUrl ? (
                          <img src={t.person.avatarUrl} alt={t.person.name || ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          (t.person?.name || "师").trim().charAt(0)
                        )}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--pu-ink)" }}>
                          {t.person?.name || "待配置"}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--pu-muted)", marginTop: 2 }}>
                          {t.role}
                          {t.person?.jobTitle ? ` · ${t.person.jobTitle}` : ""}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </ProtoCard>

          {isCompleted && (
            <ProtoCard>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--pu-blue)" }}>
                <CheckCircleFilled />
                <span style={{ fontWeight: 650, color: "var(--pu-ink)" }}>已结业</span>
              </div>
              <p style={{ color: "var(--pu-muted)", fontSize: 13, marginTop: 8, marginBottom: 0 }}>
                恭喜完成本微专业全部课程，可在「我的微专业」查看结业证书。
              </p>
            </ProtoCard>
          )}
        </div>
      </div>
    </div>
  );
}
