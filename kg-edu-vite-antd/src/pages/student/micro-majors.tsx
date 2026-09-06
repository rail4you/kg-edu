import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button, Card, Col, Empty, Modal, Progress, Row, Spin, Space, Tag, Typography } from "antd";
import {
  ApartmentOutlined,
  ClockCircleOutlined,
  RightOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  ClockCircleFilled,
  HistoryOutlined,
  PlusOutlined,
  TrophyOutlined,
  FilePdfOutlined,
  DownloadOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { myMicroMajorEnrollments, myApplications, myCertificates, getTemplateByMicroMajor } from "@/lib/ash_rpc";
import { extractArrayData } from "@/utils/api-helpers";

const { Title, Text, Paragraph } = Typography;

interface Major {
  id: string;
  name: string;
  intro?: string | null;
  projectBackground?: string | null;
  knowledgeObjective?: string | null;
  abilityObjective?: string | null;
  qualityObjective?: string | null;
  projectFeatures?: string | null;
  learningCycle?: string | null;
  assessmentMethod?: string | null;
  tuitionFee?: string | null;
  coverUrl?: string | null;
  status?: string;
}

interface MajorEnrollment {
  id: string;
  microMajorId: string;
  status: string;
  progress?: number;
  assignedAt?: string;
  rejectedReason?: string | null;
  microMajor?: Major;
}

interface StudentCertificate {
  id: string;
  microMajorId: string;
  certificateType: string;
  fileUrl: string | null;
  fileName: string | null;
  certNo: string | null;
  status: string;
  microMajor?: { id: string; name?: string | null };
  template?: {
    id: string;
    style: string;
    issuerName: string | null;
    extraText: string | null;
    logoUrl: string | null;
    sealUrl: string | null;
    signatureUrl: string | null;
    titleColor: string | null;
    titleFont: string | null;
    borderColor: string | null;
  } | null;
}

export default function StudentMicroMajors() {
  const navigate = useNavigate();
  const { user, tenant } = useAuth();
  const headers = getAuthHeaders(user) as Record<string, string>;

  // 已分配/已批准的微专业
  const { data: enrollments = [], isLoading: enrollmentsLoading } = useQuery({
    queryKey: ["my-micro-major-enrollments", tenant, user?.id],
    queryFn: async () => {
      const result = await myMicroMajorEnrollments({
        tenant: tenant!,
        fields: [
          "id",
          "microMajorId",
          "status",
          "progress",
          "assignedAt",
          "rejectedReason",
          {
            microMajor: [
              "id",
              "name",
              "intro",
              "projectBackground",
              "knowledgeObjective",
              "abilityObjective",
              "qualityObjective",
              "projectFeatures",
              "learningCycle",
              "assessmentMethod",
              "tuitionFee",
              "coverUrl",
              "status",
            ],
          },
        ],
        headers,
      });
      return extractArrayData(result) as MajorEnrollment[];
    },
    enabled: !!tenant && !!user,
  });

  // 学生证书
  const { data: myCertList = [] } = useQuery({
    queryKey: ["my-certificates", tenant, user?.id],
    queryFn: async () => {
      if (!user || !tenant) return [];
      const result = await myCertificates({
        tenant: tenant!,
        fields: ["id", "microMajorId", "certificateType", "fileUrl", "fileName", "certNo", "status",
          { microMajor: ["id", "name"] },
          { template: ["id", "style", "issuerName", "extraText", "logoUrl", "sealUrl", "signatureUrl", "titleColor", "titleFont", "borderColor"] },
        ],
        headers,
      });
      return extractArrayData(result) as StudentCertificate[];
    },
    enabled: !!tenant && !!user,
  });

  // 按 microMajorId 索引证书
  const certByMajor = useMemo(() => {
    const map = new Map<string, StudentCertificate>();
    myCertList.forEach((c) => {
      if (c.status === "active" && !map.has(c.microMajorId)) {
        map.set(c.microMajorId, c);
      }
    });
    return map;
  }, [myCertList]);

  // 渲染证书模板（用于 generated_pdf 类型的无文件证书）
  const renderCertTemplate = (cert: StudentCertificate) => {
    const tpl = cert.template;
    const mmName = cert.microMajor?.name || "微专业";
    const styleMap: Record<string, { outer: string; inner: string; title: string }> = {
      simple: { outer: "#8a8a86", inner: "#8a8a86", title: "#2b2b28" },
      classic: { outer: "#8c6a2f", inner: "#c9a765", title: "#1f2a44" },
      modern: { outer: "#0f6e56", inner: "#5dcaa5", title: "#04342c" },
    };
    const colors = styleMap[tpl?.style || "simple"] || styleMap.simple;
    const titleColor = tpl?.titleColor || colors.title;
    const titleFont = tpl?.titleFont || "ui-sans-serif, system-ui, sans-serif";
    const borderColor = tpl?.borderColor || colors.outer;

    if (!tpl) {
      return <Empty description="证书模板不可用" />;
    }

    return (
      <div style={{ padding: 8, border: `2px solid ${borderColor}`, borderRadius: 2, background: "#FBF9F3", maxWidth: 500, margin: "0 auto" }}>
        <div style={{ padding: "24px 28px", border: `1px solid ${colors.inner}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ width: 50, height: 50 }}>
              {tpl.logoUrl ? (
                <img src={tpl.logoUrl} alt="logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              ) : (
                <div style={{ width: 50, height: 50, border: "1px dashed #b3b1a8", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 10, color: "#8a8a86" }}>logo</Text>
                </div>
              )}
            </div>
            <div style={{ textAlign: "right", fontSize: 10, color: "#7a7a74" }}>
              {cert.certNo && <div>编号: {cert.certNo}</div>}
            </div>
          </div>
          <div style={{ textAlign: "center", marginTop: 16 }}>
            <div style={{ fontFamily: titleFont, fontSize: 26, letterSpacing: "4px", fontWeight: 500, color: titleColor }}>
              结业证书
            </div>
            <div style={{ fontSize: 10, marginTop: 4, letterSpacing: 3, color: "#8a8a86" }}>
              结业证书
            </div>
          </div>
          <div style={{ textAlign: "center", marginTop: 24, fontSize: 13, lineHeight: "2em", color: "#3a3a36" }}>
            兹证明 <span style={{ fontWeight: 500 }}>[学生姓名]</span> 同学在本机构学习期间，
            通过《{mmName}》微专业全部课程考核，
            达到毕业要求，特发此证，以资证明。
          </div>
          {tpl.extraText && (
            <div style={{ textAlign: "center", marginTop: 8, fontSize: 11, color: "#8a8a86" }}>
              {tpl.extraText}
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 28 }}>
            <div style={{ textAlign: "left" }}>
              <div style={{ height: 28, display: "flex", alignItems: "flex-end", fontSize: 10, color: "#b3b1a8" }}>
                {tpl.signatureUrl ? (
                  <img src={tpl.signatureUrl} alt="签名" style={{ height: 28, objectFit: "contain" }} />
                ) : "签名区"}
              </div>
              <div style={{ borderTop: "1px solid #8a8a86", fontSize: 11, color: "#3a3a36", paddingTop: 2 }}>
                签发人: {tpl.issuerName || "-"}
              </div>
            </div>
            <div style={{ width: 64, height: 64, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", transform: "rotate(-6deg)", overflow: "hidden", border: tpl.sealUrl ? "none" : "1px dashed #c99a9a" }}>
              {tpl.sealUrl ? (
                <img src={tpl.sealUrl} alt="印章" style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: "50%" }} />
              ) : "印章"}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 学生自主报名的记录（包含 pending / rejected / active 等状态）
  const { data: applications = [], isLoading: appsLoading } = useQuery({
    queryKey: ["my-mm-applications", tenant, user?.id],
    queryFn: async () => {
      const result = await myApplications({
        tenant: tenant!,
        fields: [
          "id",
          "microMajorId",
          "status",
          "assignedAt",
          "rejectedReason",
          {
            microMajor: [
              "id",
              "name",
              "intro",
              "projectBackground",
              "knowledgeObjective",
              "abilityObjective",
              "qualityObjective",
              "projectFeatures",
              "learningCycle",
              "assessmentMethod",
              "tuitionFee",
              "coverUrl",
              "status",
            ],
          },
        ],
        headers,
      });
      return extractArrayData(result) as MajorEnrollment[];
    },
    enabled: !!tenant && !!user,
  });

  // 合并两个数据源，按 assignedAt 降序排列，去重
  const mergedEnrollments = useMemo(() => {
    const seen = new Set<string>();
    return [...enrollments, ...applications]
      .filter((e) => {
        if (seen.has(e.id)) return false;
        seen.add(e.id);
        return true;
      })
      .sort((a, b) => new Date(b.assignedAt || "").getTime() - new Date(a.assignedAt || "").getTime());
  }, [enrollments, applications]);

  const isLoading = enrollmentsLoading || appsLoading;

  const STATUS_TAG: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
    pending: { color: "warning", icon: <ClockCircleFilled />, label: "审核中" },
    active: { color: "success", icon: <CheckCircleFilled />, label: "学习中" },
    rejected: { color: "error", icon: <CloseCircleFilled />, label: "已拒绝" },
    completed: { color: "blue", icon: <CheckCircleFilled />, label: "已完成" },
  };

  if (isLoading) {
    return (
      <div style={{ padding: 48, textAlign: "center" }}>
        <Spin size="large" />
      </div>
    );
  }

  if (mergedEnrollments.length === 0) {
    return (
      <div style={{ padding: "48px 24px", textAlign: "center" }}>
        <Card>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <div>
                <Text strong style={{ fontSize: 16 }}>暂无关联微专业</Text>
                <br />
                <Text type="secondary">请联系教师添加您到微专业，或自助报名</Text>
                <br />
                <br />
                <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/micro-majors")}>
                  浏览可报名微专业
                </Button>
              </div>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 0" }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <Title level={3} style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <ApartmentOutlined style={{ color: "#722ed1" }} />
            我的微专业
          </Title>
          <Text type="secondary">共 {mergedEnrollments.length} 个微专业</Text>
        </div>
        <Space>
          <Button icon={<PlusOutlined />} onClick={() => navigate("/micro-majors")}>
            报名微专业
          </Button>
          <Button icon={<HistoryOutlined />} onClick={() => navigate("/student/mm-timeline")}>
            学习动态
          </Button>
        </Space>
      </div>

      {/* Card Grid */}
      <Row gutter={[24, 24]}>
        {mergedEnrollments.map((enr) => {
          const mm = enr.microMajor;
          const progress = enr.progress ?? 0;
          const statusConf = STATUS_TAG[enr.status] || { color: "default", icon: null, label: enr.status };
          return (
            <Col xs={24} sm={12} lg={8} xl={6} key={enr.id}>
              <Card
                hoverable
                onClick={() => {
                  if (enr.status === "pending") return; // 审核中不可点击
                  navigate(`/micro-majors/${tenant}/${mm?.id || enr.microMajorId}`);
                }}
                style={{
                  borderRadius: 12,
                  overflow: "hidden",
                  height: "100%",
                  border: "1px solid #f0f0f0",
                  opacity: enr.status === "rejected" ? 0.75 : 1,
                }}
                style={{
                  borderRadius: 12,
                  overflow: "hidden",
                  height: "100%",
                  border: "1px solid #f0f0f0",
                }}
                cover={
                  <div
                    style={{
                      height: 140,
                      background: mm?.coverUrl
                        ? `url(${mm.coverUrl}) center/cover no-repeat`
                        : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                      display: "flex",
                      alignItems: "flex-end",
                      padding: 16,
                    }}
                  >
                    <div>
                      <Tag color={statusConf.color} style={{ marginBottom: 4 }} icon={statusConf.icon}>
                        {statusConf.label}
                      </Tag>
                      <Title
                        level={5}
                        style={{
                          margin: 0,
                          color: "#fff",
                          textShadow: "0 1px 4px rgba(0,0,0,0.3)",
                        }}
                        ellipsis
                      >
                        {mm?.name || "未命名微专业"}
                      </Title>
                    </div>
                  </div>
                }
              >
                {/* 结业证书区块 - 醒目展示 */}
                {enr.status === "completed" && (
                  <div
                    style={{
                      margin: "-16px -16px 12px -16px",
                      padding: 16,
                      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                      borderRadius: "12px 12px 0 0",
                      textAlign: "center",
                    }}
                  >
                    {(() => {
                      const cert = certByMajor.get(enr.microMajorId);
                      const hasFile = cert?.fileUrl;
                      const hasTemplate = cert?.template && (cert.template.logoUrl || cert.template.sealUrl || cert.template.signatureUrl);
                      const canView = hasFile || hasTemplate;
                      return (
                        <>
                          <div style={{ fontSize: 28, marginBottom: 4 }}>🎓</div>
                          <div style={{ color: "#fff", fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
                            已结业
                          </div>
                          <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, marginBottom: 12 }}>
                            {cert?.certNo ? `编号: ${cert.certNo}` : "恭喜完成微专业学习"}
                          </div>
                          {canView ? (
                            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                              <Button
                                size="small"
                                type="primary"
                                ghost
                                icon={<EyeOutlined />}
                                style={{ color: "#fff", borderColor: "rgba(255,255,255,0.6)" }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreviewCert(cert!);
                                  setCertPreviewOpen(true);
                                }}
                              >
                                查看证书
                              </Button>
                              {hasFile && (
                                <Button
                                  size="small"
                                  ghost
                                  icon={<DownloadOutlined />}
                                  style={{ color: "#fff", borderColor: "rgba(255,255,255,0.6)" }}
                                  href={cert!.fileUrl!}
                                  target="_blank"
                                  download={cert!.fileName || "certificate"}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  下载
                                </Button>
                              )}
                            </div>
                          ) : (
                            <Tag icon={<FilePdfOutlined />} color="default" style={{ fontSize: 12 }}>证书待颁发</Tag>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* 非结业状态：显示学习周期 */}
                {mm?.learningCycle && enr.status !== "completed" && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 10,
                      color: "#666",
                      fontSize: 13,
                    }}
                  >
                    <ClockCircleOutlined />
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      {mm.learningCycle}
                    </Text>
                  </div>
                )}

                {/* Description */}
                <Paragraph
                  ellipsis={{ rows: 2 }}
                  type="secondary"
                  style={{ marginBottom: 12, fontSize: 13, lineHeight: 1.5 }}
                >
                  {mm?.intro || mm?.projectBackground || "暂无描述"}
                </Paragraph>

                {/* Progress */}
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 4,
                    }}
                  >
                    <Text style={{ fontSize: 12, color: "#888" }}>学习进度</Text>
                    <Text style={{ fontSize: 12, fontWeight: 600, color: progress >= 100 ? "#52c41a" : "#722ed1" }}>
                      {progress >= 100 ? (
                        <span>
                          <CheckCircleFilled style={{ marginRight: 4 }} />
                          已完成
                        </span>
                      ) : (
                        `${progress}%`
                      )}
                    </Text>
                  </div>
                  <Progress
                    percent={progress}
                    size="small"
                    strokeColor={progress >= 100 ? "#52c41a" : "#722ed1"}
                    showInfo={false}
                  />
                </div>

                {/* Rejected reason & re-apply */}
                {enr.status === "rejected" && enr.rejectedReason && (
                  <div style={{ marginTop: 8, padding: "6px 10px", background: "#fff2f0", borderRadius: 6, fontSize: 12, color: "#cf1322" }}>
                    <Text style={{ fontSize: 12, color: "#cf1322" }}>拒绝原因：{enr.rejectedReason}</Text>
                  </div>
                )}

                {/* Action area */}
                <div
                  style={{
                    textAlign: enr.status === "pending" ? "center" : "right",
                    marginTop: 12,
                    color: enr.status === "pending" ? "#faad14" : "#d9d9d9",
                    fontSize: enr.status === "pending" ? 12 : 16,
                  }}
                >
                  {enr.status === "pending" && "等待审核中..."}
                  {enr.status === "completed" && <TrophyOutlined style={{ color: "#52c41a" }} />}
                  {enr.status !== "pending" && enr.status !== "rejected" && enr.status !== "completed" && <RightOutlined />}
                </div>
              </Card>
            </Col>
          );
        })}
      </Row>

      {/* 证书预览弹窗 */}
      <Modal
        title="结业证书"
        open={certPreviewOpen}
        onCancel={() => { setCertPreviewOpen(false); setPreviewCert(null); }}
        footer={null}
        width={700}
        destroyOnClose
      >
        {previewCert && (
          <div style={{ textAlign: "center" }}>
            <div style={{ marginBottom: 12 }}>
              <Tag color="blue" style={{ fontSize: 13, padding: "4px 12px" }}>
                {previewCert.certNo || "无编号"}
              </Tag>
            </div>
            {previewCert.fileUrl ? (
              previewCert.certificateType.includes("image") ? (
                <img src={previewCert.fileUrl} alt="证书" style={{ width: "100%", height: "auto", border: "1px solid #eee", borderRadius: 4 }} />
              ) : (
                <iframe src={previewCert.fileUrl} style={{ width: "100%", height: 500, border: "1px solid #eee", borderRadius: 4 }} title="证书预览" />
              )
            ) : previewCert.template ? (
              renderCertTemplate(previewCert)
            ) : (
              <Empty description="证书文件暂不可用" />
            )}
            {previewCert.fileUrl && (
              <div style={{ marginTop: 16 }}>
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  href={previewCert.fileUrl}
                  target="_blank"
                  download={previewCert.fileName || "certificate"}
                >
                  下载证书
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
