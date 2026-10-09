import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button, Card, Col, Empty, Modal, Progress, Row, Spin, Tag, Typography } from "antd";
import {
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
import { PageHead, ProtoTag } from "@/components/proto";

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

  // 证书预览
  const [certPreviewOpen, setCertPreviewOpen] = useState(false);
  const [previewCert, setPreviewCert] = useState<StudentCertificate | null>(null);

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
    <div className="pu-page">
      {/* Header */}
      <PageHead
        title="我的微专业"
        description="查看已报名的微专业学习进度与结业证书。"
        actions={
          <>
            <Button icon={<HistoryOutlined />} onClick={() => navigate("/student/mm-timeline")}>
              学习动态
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/micro-majors")}>
              报名微专业
            </Button>
          </>
        }
      />

      {/* Card Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 20,
        }}
      >
        {mergedEnrollments.map((enr) => {
          const mm = enr.microMajor;
          const statusConf = STATUS_TAG[enr.status] || { color: "default", icon: null, label: enr.status };
          const statusTone =
            enr.status === "pending"
              ? "amber"
              : enr.status === "rejected"
                ? "red"
                : enr.status === "active"
                  ? "green"
                  : "blue";
          const isPending = enr.status === "pending";
          const canNavigate = enr.status !== "pending";

          return (
            <div
              key={enr.id}
              className="pu-card"
              style={{
                padding: 0,
                overflow: "hidden",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                cursor: canNavigate ? "pointer" : "default",
                opacity: enr.status === "rejected" ? 0.75 : 1,
                transition: "border-color 0.2s ease, transform 0.2s ease",
              }}
              onClick={() => {
                if (!canNavigate) return;
                navigate(`/dashboard/micro-majors/${tenant}/${mm?.id || enr.microMajorId}`);
              }}
              onMouseEnter={(e) => {
                if (!canNavigate) return;
                e.currentTarget.style.borderColor = "#c6d3f7";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--pu-line)";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              {/* 封面 */}
              <div
                style={{
                  height: 128,
                  position: "relative",
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  padding: 12,
                  background: mm?.coverUrl
                    ? `url(${mm.coverUrl}) center/cover no-repeat`
                    : "linear-gradient(135deg, #2859df 0%, #1846bc 100%)",
                }}
              >
                <ProtoTag tone={statusTone}>
                  {statusConf.icon}
                  <span style={{ marginLeft: 4 }}>{statusConf.label}</span>
                </ProtoTag>
                {enr.status === "completed" && <span style={{ fontSize: 22 }}>🎓</span>}
              </div>

              {/* 内容 */}
              <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 650, color: "var(--pu-ink)" }}>
                  {mm?.name || "未命名微专业"}
                </h3>

                {mm?.learningCycle && enr.status !== "completed" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--pu-muted)" }}>
                    <ClockCircleOutlined />
                    <span>{mm.learningCycle}</span>
                  </div>
                )}

                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    lineHeight: 1.7,
                    color: "var(--pu-muted)",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    minHeight: 44,
                  }}
                >
                  {mm?.intro || mm?.projectBackground || "暂无描述"}
                </p>

                {/* 结业证书 */}
                {enr.status === "completed" && (() => {
                  const cert = certByMajor.get(enr.microMajorId);
                  const hasFile = cert?.fileUrl;
                  const hasTemplate = cert?.template && (cert.template.logoUrl || cert.template.sealUrl || cert.template.signatureUrl);
                  const canView = hasFile || hasTemplate;
                  return (
                    <div style={{ background: "var(--pu-blue-soft, #edf2ff)", border: "1px solid #dce5ff", borderRadius: 10, padding: 14, textAlign: "center" }}>
                      <div style={{ fontSize: 13, fontWeight: 650, color: "var(--pu-ink)" }}>已结业</div>
                      <div style={{ fontSize: 12, color: "var(--pu-muted)", margin: "4px 0 10px" }}>
                        {cert?.certNo ? `编号: ${cert.certNo}` : "恭喜完成微专业学习"}
                      </div>
                      {canView ? (
                        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                          <Button
                            size="small"
                            type="primary"
                            icon={<EyeOutlined />}
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
                              icon={<DownloadOutlined />}
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
                        <ProtoTag tone="gray">
                          <FilePdfOutlined style={{ marginRight: 4 }} />
                          证书待颁发
                        </ProtoTag>
                      )}
                    </div>
                  );
                })()}

                {enr.status === "rejected" && enr.rejectedReason && (
                  <div style={{ padding: "8px 12px", background: "#fdeef1", border: "1px solid #f6d0d7", borderRadius: 8, fontSize: 12, color: "var(--pu-red)" }}>
                    拒绝原因：{enr.rejectedReason}
                  </div>
                )}

                {/* 底部 */}
                <div
                  style={{
                    marginTop: "auto",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderTop: "1px solid var(--pu-line-soft)",
                    paddingTop: 12,
                    fontSize: 12,
                    color: "var(--pu-muted)",
                  }}
                >
                  <span>
                    {isPending && "等待审核中…"}
                    {enr.status === "completed" && "已完成学习"}
                    {enr.status === "rejected" && "未通过审核"}
                    {enr.status === "active" && "继续学习"}
                  </span>
                  {enr.status === "active" && <RightOutlined style={{ color: "var(--pu-blue)" }} />}
                  {enr.status === "completed" && <TrophyOutlined style={{ color: "var(--pu-blue)" }} />}
                  {enr.status === "pending" && <ClockCircleFilled style={{ color: "#d97706" }} />}
                </div>
              </div>
            </div>
          );
        })}
      </div>

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
