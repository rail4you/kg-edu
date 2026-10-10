import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import {
  Avatar,
  Button,
  Card,
  Col,
  Empty,
  Layout,
  Row,
  Skeleton,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  Modal,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  ArrowLeftOutlined,
  BookOutlined,
  ClockCircleOutlined,
  ScheduleOutlined,
  StarOutlined,
  TeamOutlined,
  TrophyOutlined,
  UserOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  ClockCircleFilled,
  FilePdfOutlined, DownloadOutlined, EyeOutlined,
} from "@ant-design/icons";
import GlobalFooter from "@/components/layout/global-footer";
import PortalHeader from "@/components/layout/portal-header";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { listMicroMajorEnrollments, myCertificates } from "@/lib/ash_rpc";
import { extractArrayData } from "@/utils/api-helpers";
import { usePageTitle } from "@/hooks/use-page-title";
import {
  useMicroMajorDetail,
  type MicroMajorCourse,
  type MicroMajorTeacher,
} from "@/hooks/use-micro-major-catalog";
import "@/styles/home-portal-theme.css";
import "@/styles/portal-editorial.css";
import "./micro-major-detail.css";

const { Content } = Layout;
const { Title, Text, Paragraph } = Typography;

function SectionBlock({ title, icon, children }: { title: string; icon?: React.ReactNode; children?: string | null }) {
  if (!children) return null;
  return (
    <section className="mm-detail-section">
      <div className="mm-detail-section__title">
        {icon && <span className="mm-detail-section__title-icon">{icon}</span>}
        {title}
      </div>
      <Paragraph className="mm-detail-section__content">{children}</Paragraph>
    </section>
  );
}

function TeacherCard({ teacher, role }: { teacher?: MicroMajorTeacher | null; role: string }) {
  return (
    <div className="mm-teacher-card">
      <div className="mm-teacher-card__avatar">
        <Avatar size={88} src={teacher?.avatarUrl} icon={<UserOutlined />} />
        <span className="mm-teacher-card__role-badge">{role}</span>
      </div>
      <div className="mm-teacher-card__content">
        <div className="mm-teacher-card__name">{teacher?.name || "待配置"}</div>
        <div className="mm-teacher-card__title">{teacher?.jobTitle || "暂无职称"}</div>
        <Text type="secondary" className="mm-teacher-card__meta">
          {[teacher?.colledge, teacher?.major].filter(Boolean).join(" / ") || "暂无院系信息"}
        </Text>
        <Paragraph className="mm-teacher-card__bio">
          {teacher?.bio || "暂无教师简介"}
        </Paragraph>
      </div>
    </div>
  );
}

export default function MicroMajorDetailPage() {
  const { tenant, id } = useParams<{ tenant: string; id: string }>();
  const navigate = useNavigate();
  const { user, tenant: currentTenant } = useAuth();
  const studentHeaders = getAuthHeaders(user) as Record<string, string>;

  usePageTitle();
  const effectiveTenant = tenant || currentTenant || "";

  const { major, courses, isLoading: majorLoading } = useMicroMajorDetail(effectiveTenant, id || "");

  // Check enrollment / application status for current user
  const { data: userEnrollments = [] } = useQuery({
    queryKey: ["detail-check-enrolled", effectiveTenant, user?.id, id],
    queryFn: async () => {
      if (!user || !effectiveTenant || !id) return [];
      const result = await listMicroMajorEnrollments({
        tenant: effectiveTenant,
        fields: ["id", "microMajorId", "status", "rejectedReason"],
        filter: {
          microMajorId: { eq: id },
          studentId: { eq: user.id },
        },
        headers: studentHeaders,
      });
      return extractArrayData(result) as Array<{ id: string; microMajorId: string; status: string; rejectedReason?: string | null }>;
    },
    enabled: !!user && !!effectiveTenant && !!id,
  });

  const myEnrollment = userEnrollments.length > 0 ? userEnrollments[0] : null;
  const isEnrolled = myEnrollment?.status === "active";
  const isPending = myEnrollment?.status === "pending";
  const isRejected = myEnrollment?.status === "rejected";
  const isCompleted = myEnrollment?.status === "completed";

  // 证书预览
  const [certPreviewOpen, setCertPreviewOpen] = useState(false);
  const [previewCertUrl, setPreviewCertUrl] = useState("");
  const [previewCertType, setPreviewCertType] = useState("image");

  // 查询结业证书
  const { data: myCertData } = useQuery({
    queryKey: ["mm-detail-cert", effectiveTenant, user?.id, id],
    queryFn: async () => {
      if (!user || !effectiveTenant) return null;
      const result = await myCertificates({
        tenant: effectiveTenant,
        fields: ["id", "microMajorId", "certificateType", "fileUrl", "fileName", "certNo", "status"],
        headers: studentHeaders,
      });
      const certs = extractArrayData(result) as Array<any>;
      return certs.find((c: any) => c.microMajorId === id && c.status === "active") || null;
    },
    enabled: isCompleted && !!user && !!effectiveTenant,
    refetchOnMount: true,
    staleTime: 0,
  });

  const totals = useMemo(() => {
    return courses.reduce(
      (acc, course) => ({
        credit: acc.credit + Number(course.credits || 0),
        period: acc.period + Number(course.semesterHours || 0),
      }),
      { credit: 0, period: 0 }
    );
  }, [courses]);

  // 报名由教师端分配，学生端不提供报名入口

  // Navigate to micro major course learning page (for enrolled students)
  const handleMMCourseClick = (course: MicroMajorCourse) => {
    navigate(`/student/mm-course?mmCourseId=${course.id}&mmId=${major?.id}&tenant=${effectiveTenant}`);
  };

  const courseColumns: ColumnsType<MicroMajorCourse> = [
    {
      title: "课程名称",
      dataIndex: "title",
      render: (_, record) => (
        <div className="mm-course-info">
          <div className="mm-course-cover">
            {record.imageUrl ? (
              <img src={record.imageUrl} alt="" />
            ) : (
              <BookOutlined />
            )}
          </div>
          <div className="mm-course-detail">
            <span
              className="mm-course-title"
              style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 240 }}
            >
              {record.title || "课程"}
            </span>
            <Tooltip
              title={record.description || "暂无课程说明"}
              placement="topLeft"
              overlayClassName="mm-course-desc-tooltip"
            >
              <Paragraph ellipsis={{ rows: 2 }} className="mm-course-desc">
                {record.description || "暂无课程说明"}
              </Paragraph>
            </Tooltip>
          </div>
        </div>
      ),
    },

    {
      title: "学期",
      dataIndex: "semester",
      width: 100,
      render: (value) => <Text type="secondary">{value || "-"}</Text>,
    },
    {
      title: "学分",
      dataIndex: "credits",
      width: 80,
      align: "center",
      render: (value) => <Text strong>{value ?? "-"}</Text>,
    },
    {
      title: "学时",
      dataIndex: "semesterHours",
      width: 80,
      align: "center",
      render: (value) => <Text strong>{value ?? "-"}</Text>,
    },
    {
      title: "操作",
      width: 160,
      render: (_, record) => (
        <Space>
          {isEnrolled ? (
            <Button type="primary" size="small" icon={<BookOutlined />} onClick={() => handleMMCourseClick(record)}>
              开始学习
            </Button>
          ) : isCompleted ? (
            <Tag icon={<TrophyOutlined />} color="blue">已结业</Tag>
          ) : isPending ? (
            <Tag color="warning">审核中</Tag>
          ) : isRejected ? (
            <Tag color="error">已拒绝</Tag>
          ) : (
            <Text type="secondary">—</Text>
          )}
        </Space>
      ),
    },
  ];

  if (majorLoading) {
    return (
      <Layout className="home-page cl-page" style={{ overflowX: "hidden" }}>
        <PortalHeader activeKey="/micro-majors" sectionTitle="导航" />
        <Content>
          <section className="cl-list-section">
            <div className="cl-list-section__inner">
              <Card><Skeleton active paragraph={{ rows: 8 }} /></Card>
            </div>
          </section>
        </Content>
        <GlobalFooter />
      </Layout>
    );
  }

  if (!major) {
    return (
      <Layout className="home-page cl-page" style={{ overflowX: "hidden" }}>
        <PortalHeader activeKey="/micro-majors" sectionTitle="导航" />
        <Content>
          <section className="cl-list-section">
            <div className="cl-list-section__inner">
              <Empty description="微专业不存在或已下架" />
            </div>
          </section>
        </Content>
        <GlobalFooter />
      </Layout>
    );
  }

  return (
    <Layout className="home-page cl-page" style={{ overflowX: "hidden" }}>
      <PortalHeader activeKey="/micro-majors" sectionTitle="导航" />

      <Content>
        <div className="ed-container mm-detail-top">
        <button type="button" className="mm-back" onClick={() => navigate("/micro-majors")}>
          <ArrowLeftOutlined /> 返回微专业
        </button>
        {/* 首页编辑风 Hero（去掉右侧报名卡） */}
        <section className="mm-hero theme-blue">
          <div className="mm-hero__code">{major.learningCycle || "MICRO MAJOR"}</div>
          <h1>{major.name}<span>微专业</span></h1>
          <p>{major.intro || major.projectBackground || "围绕产业需求与岗位能力构建课程组合，帮助学习者系统完成专业能力提升。"}</p>
          <div className="mm-hero__tags"><span>{major.learningCycle || "-"}</span><span>{courses.length} 门课程</span><span>{totals.credit || "-"} 学分</span></div>
        </section>

        {/* 关键信息 + 报名/状态 */}
        <section className="mm-facts">
          <div className="mm-fact">
            <span className="mm-fact__label">学习周期</span>
            <span className="mm-fact__value">{major.learningCycle || "-"}</span>
          </div>
          <div className="mm-fact">
            <span className="mm-fact__label">考核方式</span>
            <span className="mm-fact__value">{major.assessmentMethod || "-"}</span>
          </div>
          <div className="mm-fact">
            <span className="mm-fact__label">学费标准</span>
            <span className="mm-fact__value">{major.tuitionFee || "-"}</span>
          </div>
          <div className="mm-fact mm-fact--action">
            <span className="mm-fact__label">报名状态</span>
            {isEnrolled ? (
              <Tag icon={<CheckCircleFilled />} color="success" className="mm-status-tag">学习中</Tag>
            ) : isCompleted ? (
              <Tag icon={<TrophyOutlined />} color="blue" className="mm-status-tag">已结业</Tag>
            ) : isPending ? (
              <Tag icon={<ClockCircleFilled />} color="warning" className="mm-status-tag">审核中</Tag>
            ) : isRejected ? (
              <Tag icon={<CloseCircleFilled />} color="error" className="mm-status-tag">
                已拒绝{myEnrollment?.rejectedReason ? `：${myEnrollment.rejectedReason}` : ""}
              </Tag>
            ) : (
              <span className="mm-fact__value mm-fact__value--muted">由教师分配</span>
            )}
          </div>
        </section>

        {/* Body Section */}
        <section className="mm-detail-body">
          <div className="mm-detail-body__inner">
            <nav className="mm-detail-anchor">
              <a href="#overview">项目介绍</a>
              <a href="#objectives">培养目标</a>
              <a href="#courses">课程设置</a>
              <a href="#teachers">教师团队</a>
            </nav>

            {/* 结业证书区块 - 已结业学生醒目展示 */}
            {isCompleted && (
              <Card
                className="mm-detail-card"
                style={{
                  borderRadius: 16, overflow: "hidden", border: "none",
                  background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
                }}
              >
                <div style={{ textAlign: "center", padding: "32px 24px" }}>
                  <div style={{ fontSize: 56, marginBottom: 12, lineHeight: 1 }}>🎓</div>
                  <Title level={2} style={{ margin: "0 0 4px 0", color: "#fff", fontWeight: 700 }}>
                    恭喜结业
                  </Title>
                  <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 15, marginBottom: 8 }}>
                    完成《{major.name}》微专业全部课程
                  </div>
                  {myCertData?.certNo && (
                    <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginBottom: 20 }}>
                      证书编号: {myCertData.certNo}
                    </div>
                  )}

                  {myCertData?.fileUrl ? (
                    <div style={{ maxWidth: 480, margin: "0 auto" }}>
                      <div
                        style={{
                          borderRadius: 12, overflow: "hidden",
                          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
                          cursor: "pointer", lineHeight: 0,
                          border: "3px solid rgba(255,255,255,0.15)",
                        }}
                        onClick={() => {
                          setPreviewCertUrl(myCertData.fileUrl);
                          setPreviewCertType(myCertData.certificateType);
                          setCertPreviewOpen(true);
                        }}
                      >
                        <img src={myCertData.fileUrl} alt="结业证书" style={{ width: "100%", height: "auto" }} />
                      </div>
                      <div style={{ marginTop: 20 }}>
                        <Button
                          type="primary"
                          icon={<DownloadOutlined />}
                          size="large"
                          style={{ height: 44, borderRadius: 22, padding: "0 32px", fontSize: 15 }}
                          href={myCertData.fileUrl}
                          target="_blank"
                          download={myCertData.fileName || "certificate"}
                        >
                          下载证书
                        </Button>
                        <Button
                          ghost
                          icon={<EyeOutlined />}
                          size="large"
                          style={{ height: 44, borderRadius: 22, padding: "0 24px", marginLeft: 12, borderColor: "rgba(255,255,255,0.3)", color: "#fff" }}
                          onClick={() => {
                            setPreviewCertUrl(myCertData.fileUrl);
                            setPreviewCertType(myCertData.certificateType);
                            setCertPreviewOpen(true);
                          }}
                        >
                          预览
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        maxWidth: 400, margin: "0 auto", padding: 28,
                        border: "2px dashed rgba(255,255,255,0.2)", borderRadius: 12,
                        background: "rgba(255,255,255,0.05)",
                      }}
                    >
                      <FilePdfOutlined style={{ fontSize: 40, color: "rgba(255,255,255,0.4)", marginBottom: 8 }} />
                      <div style={{ fontSize: 15, fontWeight: 500, color: "#fff", marginBottom: 4 }}>
                        电子证书已生成
                      </div>
                      <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
                        请联系教师获取证书文件
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            )}

            <Card id="overview" className="mm-detail-card mm-detail-card--feature">
              <Title level={3} className="mm-detail-card__heading">项目介绍</Title>
              <SectionBlock title="项目背景" icon={<BookOutlined />}>{major.projectBackground}</SectionBlock>
              <SectionBlock title="项目特色" icon={<ClockCircleOutlined />}>{major.projectFeatures}</SectionBlock>
            </Card>

            <Card id="objectives" className="mm-detail-card mm-detail-card--feature">
              <Title level={3} className="mm-detail-card__heading">培养目标</Title>
              <Row gutter={[20, 20]}>
                <Col xs={24} md={8}>
                  <SectionBlock title="知识目标" icon={<StarOutlined />}>{major.knowledgeObjective}</SectionBlock>
                </Col>
                <Col xs={24} md={8}>
                  <SectionBlock title="能力目标" icon={<TrophyOutlined />}>{major.abilityObjective}</SectionBlock>
                </Col>
                <Col xs={24} md={8}>
                  <SectionBlock title="素养目标" icon={<ScheduleOutlined />}>{major.qualityObjective}</SectionBlock>
                </Col>
              </Row>
            </Card>

            <Card id="courses" className="mm-detail-card" title={<><BookOutlined /> 课程设置</>}>
              <div className="mm-course-table">
                <Table
                  rowKey="id"
                  columns={courseColumns}
                  dataSource={courses}
                  pagination={false}
                  locale={{ emptyText: "暂无课程" }}
                  scroll={{ x: 800 }}
                />
              </div>
            </Card>

            <Card id="teachers" className="mm-detail-card" title={<><TeamOutlined /> 教师团队</>}>
              <div className="mm-teacher-list">
                <TeacherCard teacher={major.responsibleTeacher} role="负责人" />
                <TeacherCard teacher={major.consultantTeacher} role="顾问教师" />
              </div>
            </Card>
          </div>
        </section>
        </div>
      </Content>
    

      {/* 证书预览弹窗 */}
      <Modal
        title="结业证书"
        open={certPreviewOpen}
        onCancel={() => { setCertPreviewOpen(false); setPreviewCertUrl(""); }}
        footer={null}
        width={700}
        destroyOnClose
      >
        <div style={{ textAlign: "center" }}>
          {previewCertUrl ? (
            previewCertType.includes("image") || previewCertType.includes("png") || previewCertType.includes("jpg") || previewCertType.includes("jpeg") ? (
              <img src={previewCertUrl} alt="证书" style={{ width: "100%", height: "auto", border: "1px solid #eee", borderRadius: 4 }} />
            ) : (
              <iframe src={previewCertUrl} style={{ width: "100%", height: 500, border: "1px solid #eee", borderRadius: 4 }} title="证书预览" />
            )
          ) : (
            <Empty description="证书文件暂不可用" />
          )}
          {previewCertUrl && (
            <div style={{ marginTop: 16 }}>
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                href={previewCertUrl}
                target="_blank"
                download="certificate"
              >
                下载证书
              </Button>
            </div>
          )}
        </div>
      </Modal>

      <GlobalFooter />
    </Layout>
  );
}
