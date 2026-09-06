import React, { useState, useMemo, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Button, Card, Col, Empty, Grid, message, Popconfirm, Row, Select, Space, Table, Tag, Typography, Modal, Input, Tabs, Badge, Upload, DatePicker,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  DeleteOutlined, TeamOutlined, UserAddOutlined, SearchOutlined,
  UnorderedListOutlined, AppstoreOutlined, CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined,
  TrophyOutlined, FilePdfOutlined, UndoOutlined, DownloadOutlined, UploadOutlined, EyeOutlined, ReloadOutlined,
  ArrowLeftOutlined
} from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { extractArrayData } from "@/utils/api-helpers";
import { getSTSToken, uploadFileToOSS } from "@/lib/oss-upload";
import html2canvas from "html2canvas";
import dayjs from "dayjs";
import {
  getMicroMajor, listUsers, listClasses,
  listEnrollmentsByMicroMajor, removeStudentFromMicroMajor, bulkAssignStudentsToMicroMajor,
  listPendingEnrollments, approveEnrollment, rejectEnrollment,
  completeEnrollment, revokeCompletion,
  listCertificatesByMicroMajor,
  getTemplateByMicroMajor, createCertificate, updateCertificate, deleteCertificate,
} from "@/lib/ash_rpc";
import ContextSelector from "@/components/micro-major/context-selector";
import ScanTemplateEditor from "@/components/certificate/ScanTemplateEditor";
import { DEFAULT_NAME_FIELD, DEFAULT_CERT_NO_FIELD, type NameFieldConfig } from "@/components/certificate/name-field";
import { useEditPermission } from "@/hooks/use-edit-permission";
import { ReadonlyActionButton } from "@/components/readonly-action-button";

// 把证书模板记录转成 NameFieldConfig（处理 Decimal 字符串 → number）
function templateToNameField(t: any): NameFieldConfig {
  const num = (v: any, fb: number) => {
    if (v == null || v === "") return fb;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : fb;
  };
  return {
    x: num(t?.nameFieldX, DEFAULT_NAME_FIELD.x),
    y: num(t?.nameFieldY, DEFAULT_NAME_FIELD.y),
    width: num(t?.nameFieldWidth, DEFAULT_NAME_FIELD.width),
    height: num(t?.nameFieldHeight, DEFAULT_NAME_FIELD.height),
    fontFamily: t?.nameFontFamily || DEFAULT_NAME_FIELD.fontFamily,
    fontSize: num(t?.nameFontSize, DEFAULT_NAME_FIELD.fontSize),
    fontWeight: (t?.nameFontWeight as "normal" | "bold") || DEFAULT_NAME_FIELD.fontWeight,
    color: t?.nameColor || DEFAULT_NAME_FIELD.color,
    letterSpacing: num(t?.nameLetterSpacing, DEFAULT_NAME_FIELD.letterSpacing),
    textAlign: (t?.nameTextAlign as "left" | "center" | "right") || DEFAULT_NAME_FIELD.textAlign,
  };
}

function templateToCertNoField(t: any): NameFieldConfig {
  const num = (v: any, fb: number) => {
    if (v == null || v === "") return fb;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : fb;
  };
  return {
    x: num(t?.certNoFieldX, DEFAULT_CERT_NO_FIELD.x),
    y: num(t?.certNoFieldY, DEFAULT_CERT_NO_FIELD.y),
    width: num(t?.certNoFieldWidth, DEFAULT_CERT_NO_FIELD.width),
    height: num(t?.certNoFieldHeight, DEFAULT_CERT_NO_FIELD.height),
    fontFamily: t?.certNoFontFamily || DEFAULT_CERT_NO_FIELD.fontFamily,
    fontSize: num(t?.certNoFontSize, DEFAULT_CERT_NO_FIELD.fontSize),
    fontWeight: (t?.certNoFontWeight as "normal" | "bold") || DEFAULT_CERT_NO_FIELD.fontWeight,
    color: t?.certNoColor || DEFAULT_CERT_NO_FIELD.color,
    letterSpacing: num(t?.certNoLetterSpacing, DEFAULT_CERT_NO_FIELD.letterSpacing),
    textAlign: (t?.certNoTextAlign as "left" | "center" | "right") || DEFAULT_CERT_NO_FIELD.textAlign,
  };
}

const { Title, Text } = Typography;

interface Student {
  id: string;
  name?: string | null;
  email?: string | null;
  memberId?: string | null;
  major?: string | null;
  classId?: string | null;
}

interface Enrollment {
  id: string;
  studentId: string;
  status: string;
  progress: number;
  assignedAt?: string;
  rejectedReason?: string | null;
  student?: Student;
}

const extractArray = (result: any) => {
  if (!result?.success) return [];
  const data = result.data;
  if (Array.isArray(data)) return data;
  return data?.results || [];
};

const STYLE_COLORS_MM: Record<string, { outer: string; inner: string }> = {
  simple: { outer: "#8a8a86", inner: "#8a8a86" },
  classic: { outer: "#8c6a2f", inner: "#c9a765" },
  modern: { outer: "#0f6e56", inner: "#5dcaa5" },
};
function getBorderColor(style?: string) { return STYLE_COLORS_MM[style || "simple"]?.outer || "#8a8a86"; }
function getInnerBorderColor(style?: string) { return STYLE_COLORS_MM[style || "simple"]?.inner || "#8a8a86"; }

export default function MicroMajorStudentManagement() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const issueCertPreviewRef = useRef<HTMLDivElement>(null);
  const mmId = searchParams.get("mmId") || undefined;
  const { user, tenant } = useAuth();
  const queryClient = useQueryClient();
  const headers = getAuthHeaders(user) as Record<string, string>;
  const { canEdit } = useEditPermission();

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [modalTab, setModalTab] = useState("list");

  // ── 筛选条件 ──
  const [keyword, setKeyword] = useState("");
  const [classFilter, setClassFilter] = useState<string | undefined>();
  const [certFilter, setCertFilter] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

  const resetFilters = () => {
    setKeyword("");
    setClassFilter(undefined);
    setCertFilter(undefined);
    setDateRange(null);
    setStatusFilter("all");
  };

  const hasFilters = !!keyword || !!classFilter || !!certFilter || !!dateRange || statusFilter !== "all";

  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<Enrollment | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // 颁发证书弹窗
  const [issueModalVisible, setIssueModalVisible] = useState(false);
  const [issueTarget, setIssueTarget] = useState<Enrollment | null>(null);
  const [issueMethod, setIssueMethod] = useState<"template" | "upload">("template");
  const [issueCertNo, setIssueCertNo] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");

  // 证书预览弹窗
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [previewCert, setPreviewCert] = useState<any>(null);
  const [changeCertTarget, setChangeCertTarget] = useState<Enrollment | null>(null);

  // 获取微专业详情
  const { data: microMajor } = useQuery({
    queryKey: ["mm-students-major", mmId, tenant],
    queryFn: async () => {
      if (!mmId) return null;
      const result = await getMicroMajor({
        tenant: tenant!,
        input: { id: mmId },
        fields: ["id", "name", "status"],
        headers,
      });
      if (!result.success) return null;
      const data = result.data as any;
      return Array.isArray(data) ? data[0] : data;
    },
    enabled: !!mmId && !!tenant,
  });

  // 所有学生
  const { data: students = [] } = useQuery({
    queryKey: ["all-students-mm-mgmt", tenant],
    queryFn: async () => {
      const result = await listUsers({
        tenant: tenant!,
        fields: ["id", "name", "email", "memberId", "major", "classId"],
        filter: { role: { eq: "user" } },
        sort: "+name",
        page: { limit: 10000 },
        headers,
      });
      return extractArrayData(result) as Student[];
    },
    enabled: !!tenant && !!user,
  });

  // 班级列表
  const { data: classes = [] } = useQuery({
    queryKey: ["classes-mm-mgmt", tenant],
    queryFn: async () => {
      const result = await listClasses({
        tenant: tenant!,
        fields: ["id", "name"],
        page: { limit: 1000 },
        headers,
      });
      return extractArrayData(result);
    },
    enabled: !!tenant,
  });

  // 全部 enrollment
  const { data: allEnrollments = [], isLoading: enrollmentsLoading } = useQuery({
    queryKey: ["mm-enrollments-mgmt", mmId, tenant],
    queryFn: async () => {
      if (!mmId) return [];
      const result = await listEnrollmentsByMicroMajor({
        tenant: tenant!,
        input: { microMajorId: mmId },
        fields: [
          "id", "studentId", "status", "progress", "assignedAt", "rejectedReason",
          { student: ["id", "name", "email", "memberId", "major", "classId"] },
        ],
        headers,
      });
      return extractArray(result) as Enrollment[];
    },
    enabled: !!mmId && !!tenant,
  });

  // 待审批列表
  const { data: pendingEnrollments = [], isLoading: pendingLoading } = useQuery({
    queryKey: ["mm-pending-mgmt", mmId, tenant],
    queryFn: async () => {
      if (!mmId) return [];
      const result = await listPendingEnrollments({
        tenant: tenant!,
        input: { microMajorId: mmId },
        fields: [
          "id", "studentId", "assignedAt",
          { student: ["id", "name", "email", "memberId", "major", "classId"] },
        ],
        headers,
      });
      return extractArray(result) as Enrollment[];
    },
    enabled: !!mmId && !!tenant,
  });

  // 证书查询
  const { data: certificates = [] } = useQuery({
    queryKey: ["mm-certificates-mgmt", mmId, tenant],
    queryFn: async () => {
      if (!mmId) return [];
      const result = await listCertificatesByMicroMajor({
        tenant: tenant!,
        input: { microMajorId: mmId },
        fields: ["id", "studentId", "certificateType", "fileUrl", "status"],
        headers,
      });
      return extractArray(result);
    },
    enabled: !!mmId && !!tenant,
  });

  // 证书模板
  const { data: template } = useQuery({
    queryKey: ["mm-cert-template-mgmt", mmId, tenant],
    queryFn: async () => {
      if (!mmId) return null;
      const result = await getTemplateByMicroMajor({
        tenant: tenant!,
        input: { microMajorId: mmId },
        fields: [
          "id", "style", "issuerName", "logoUrl", "sealUrl", "signatureUrl",
          "backgroundImageUrl", "nameFieldX", "nameFieldY", "nameFieldWidth", "nameFieldHeight",
          "nameFontFamily", "nameFontSize", "nameFontWeight", "nameColor", "nameLetterSpacing", "nameTextAlign",
          "certNoFieldX", "certNoFieldY", "certNoFieldWidth", "certNoFieldHeight",
          "certNoFontFamily", "certNoFontSize", "certNoFontWeight", "certNoColor", "certNoLetterSpacing", "certNoTextAlign",
        ],
        headers,
      });
      if (!result.success || !result.data) return null;
      const data = result.data as any;
      return Array.isArray(data) ? data[0] : data;
    },
    enabled: !!mmId && !!tenant,
  });

  const classNameOf = (e: Enrollment) => {
    const cls = (classes as any[]).find((c: any) => c.id === e.student?.classId);
    return cls?.name || "";
  };

  // 按状态分组
  const activeEnrollments = useMemo(() =>
    allEnrollments.filter((e) => e.status === "active"),
    [allEnrollments],
  );
  const completedEnrollments = useMemo(() =>
    allEnrollments.filter((e) => e.status === "completed"),
    [allEnrollments],
  );
  const rejectedEnrollments = useMemo(() =>
    allEnrollments.filter((e) => e.status === "rejected"),
    [allEnrollments],
  );

  // ── 综合筛选：关键字 / 班级 / 证书 / 报名时间 ──
  const certificateMap = useMemo(() => {
    const map = new Map<string, any>();
    (certificates as any[]).forEach((c: any) => {
      if (c.status === "active") {
        map.set(c.studentId, c);
      }
    });
    return map;
  }, [certificates]);

  // ── 综合筛选：关键字 / 班级 / 证书 / 报名时间 ──
  const filteredEnrollments = useMemo(() => {
    let list = allEnrollments;
    const kw = keyword.trim().toLowerCase();
    if (kw) {
      list = list.filter((e) =>
        (e.student?.name || "").toLowerCase().includes(kw) ||
        (e.student?.memberId || "").toLowerCase().includes(kw) ||
        (e.student?.email || "").toLowerCase().includes(kw) ||
        classNameOf(e).toLowerCase().includes(kw),
      );
    }
    if (classFilter) {
      list = list.filter((e) => e.student?.classId === classFilter);
    }
    if (certFilter === "issued") {
      list = list.filter((e) => certificateMap.has(e.studentId));
    }
    if (certFilter === "not_issued") {
      list = list.filter((e) => !certificateMap.has(e.studentId));
    }
    if (dateRange) {
      const [start, end] = dateRange;
      list = list.filter((e) => {
        if (!e.assignedAt) return false;
        const t = dayjs(e.assignedAt);
        return (!start || !t.isBefore(start, "day")) && (!end || !t.isAfter(end, "day"));
      });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allEnrollments, keyword, classFilter, certFilter, dateRange, certificateMap, classes]);

  const pendingFiltered = useMemo(() => filteredEnrollments.filter((e) => e.status === "pending"), [filteredEnrollments]);
  const activeFiltered = useMemo(() => filteredEnrollments.filter((e) => e.status === "active"), [filteredEnrollments]);
  const completedFiltered = useMemo(() => filteredEnrollments.filter((e) => e.status === "completed"), [filteredEnrollments]);
  const rejectedFiltered = useMemo(() => filteredEnrollments.filter((e) => e.status === "rejected"), [filteredEnrollments]);


  const assignedStudentIds = useMemo(() => new Set(activeEnrollments.map((e) => e.studentId)), [activeEnrollments]);

  const availableStudents = useMemo(() => {
    return students
      .filter((s) => !assignedStudentIds.has(s.id))
      .map((s) => {
        const cls = classes.find((c: any) => c.id === s.classId);
        return { ...s, className: cls?.name || "未分配" };
      });
  }, [students, assignedStudentIds, classes]);

  const filteredStudents = useMemo(() => {
    if (!searchText) return availableStudents;
    const lower = searchText.toLowerCase();
    return availableStudents.filter(
      (s) =>
        (s.name || "").toLowerCase().includes(lower) ||
        (s.email || "").toLowerCase().includes(lower) ||
        (s.memberId || "").toLowerCase().includes(lower) ||
        (s.className || "").toLowerCase().includes(lower),
    );
  }, [availableStudents, searchText]);

  const studentsByClass = useMemo(() => {
    const grouped: Record<string, typeof availableStudents> = {};
    filteredStudents.forEach((s) => {
      const key = s.classId || "unassigned";
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(s);
    });
    return Object.entries(grouped).map(([classId, classStudents]) => ({
      classId,
      className: classStudents[0].className,
      students: classStudents,
      studentCount: classStudents.length,
    }));
  }, [filteredStudents]);

  // 批量分配
  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!mmId || selectedStudentIds.length === 0) return;
      return bulkAssignStudentsToMicroMajor({
        tenant: tenant!,
        input: { microMajorId: mmId, studentIds: selectedStudentIds },
        headers,
      });
    },
    onSuccess: (result) => {
      if (result && !result.success) {
        message.error((result as any).errors?.[0]?.message || "添加失败");
        return;
      }
      message.success(`已添加 ${selectedStudentIds.length} 名学生`);
      setSelectedStudentIds([]);
      setSearchText("");
      setAddModalVisible(false);
      queryClient.invalidateQueries({ queryKey: ["mm-enrollments-mgmt", mmId] });
      queryClient.invalidateQueries({ queryKey: ["mm-pending-mgmt", mmId] });
    },
    onError: (err: any) => message.error(err?.message || "添加失败"),
  });

  // 移除学生
  const removeMutation = useMutation({
    mutationFn: async (enrollmentId: string) =>
      removeStudentFromMicroMajor({ tenant: tenant!, primaryKey: enrollmentId, headers }),
    onSuccess: () => {
      message.success("已移除");
      queryClient.invalidateQueries({ queryKey: ["mm-enrollments-mgmt", mmId] });
    },
  });

  // 审核通过
  const approveMutation = useMutation({
    mutationFn: async (enrollmentId: string) =>
      approveEnrollment({ tenant: tenant!, primaryKey: enrollmentId, input: {}, fields: ["id", "status"], headers }),
    onSuccess: () => {
      message.success("已批准");
      queryClient.invalidateQueries({ queryKey: ["mm-enrollments-mgmt", mmId] });
      queryClient.invalidateQueries({ queryKey: ["mm-pending-mgmt", mmId] });
    },
  });

  // 审核拒绝
  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!rejectTarget || !mmId) return;
      return rejectEnrollment({
        tenant: tenant!,
        primaryKey: rejectTarget.id,
        input: { rejectedReason: rejectReason || undefined },
        fields: ["id", "status"],
        headers,
      });
    },
    onSuccess: () => {
      message.success("已拒绝");
      setRejectModalVisible(false);
      setRejectTarget(null);
      setRejectReason("");
      queryClient.invalidateQueries({ queryKey: ["mm-enrollments-mgmt", mmId] });
      queryClient.invalidateQueries({ queryKey: ["mm-pending-mgmt", mmId] });
    },
  });

  const openRejectModal = (enr: Enrollment) => {
    setRejectTarget(enr);
    setRejectReason("");
    setRejectModalVisible(true);
  };

  // ── 结业 ──
  const completeMutation = useMutation({
    mutationFn: async (enrollment: Enrollment) => {
      const result = await completeEnrollment({
        tenant: tenant!,
        primaryKey: enrollment.id,
        input: {},
        fields: ["id", "status", "completedAt"],
        headers,
      });
      if (!result.success) {
        const errMsg = (result as any).errors?.[0]?.message || "操作失败";
        throw new Error(errMsg);
      }
      return result;
    },
  });

  const handleComplete = async (enrollment: Enrollment) => {
    try {
      await completeMutation.mutateAsync(enrollment);
      message.success("已标记为结业");
      queryClient.invalidateQueries({ queryKey: ["mm-enrollments-mgmt", mmId] });
      queryClient.invalidateQueries({ queryKey: ["mm-certificates-mgmt", mmId] });
    } catch (err: any) {
      message.error(err?.message || "操作失败");
    }
  };

  const revokeMutation = useMutation({
    mutationFn: async (enrollmentId: string) => {
      const result = await revokeCompletion({
        tenant: tenant!,
        primaryKey: enrollmentId,
        input: {},
        fields: ["id", "status"],
        headers,
      });
      if (!result.success) {
        const errMsg = (result as any).errors?.[0]?.message || "操作失败";
        throw new Error(errMsg);
      }
      return result;
    },
  });

  const handleRevoke = async (enrollmentId: string, studentId: string) => {
    try {
      await revokeMutation.mutateAsync(enrollmentId);
      // 同时删除该学生的证书
      const cert = certificateMap.get(studentId);
      if (cert) {
        try {
          await deleteCertificate({ tenant: tenant!, primaryKey: cert.id, headers });
        } catch (e) {
          // 忽略
        }
      }
      message.success("已撤销结业，证书已取消");
      queryClient.invalidateQueries({ queryKey: ["mm-enrollments-mgmt", mmId] });
      queryClient.invalidateQueries({ queryKey: ["mm-certificates-mgmt", mmId] });
    } catch (err: any) {
      message.error(err?.message || "操作失败");
    }
  };

  // ── 证书编号模板展开 ──
  const expandCertNoTemplate = (tmpl: string): string => {
    if (!tmpl) return tmpl;
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const map: Record<string, string> = {
      "{yyyy}": String(now.getFullYear()),
      "{mm}": pad(now.getMonth() + 1),
      "{dd}": pad(now.getDate()),
      "{yyyyMMdd}": `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`,
    };
    let result = tmpl;
    for (const [key, val] of Object.entries(map)) {
      result = result.split(key).join(val);
    }
    return result;
  };

  // ── 颁发证书 ──
  const issueCertMutation = useMutation({
    mutationFn: async () => {
      if (!issueTarget || !mmId) throw new Error("缺少学生或微专业信息");
      const resolvedCertNo = issueCertNo ? expandCertNoTemplate(issueCertNo) : undefined;
      const input: any = {
        microMajorId: mmId,
        studentId: issueTarget.studentId,
        enrollmentId: issueTarget.id,
        certificateType: issueMethod === "template" ? "generated_pdf" : "uploaded_image",
        certNo: resolvedCertNo,
        status: "active",
      };
      if (uploadedUrl) {
        input.fileUrl = uploadedUrl;
        input.fileName = uploadedFileName;
      }
      const result = await createCertificate({
        tenant: tenant!,
        input,
        fields: ["id"],
        headers,
      });
      if (!result.success) {
        throw new Error((result as any).errors?.[0]?.message || "颁发失败");
      }
      return result;
    },
  });

  const handleIssueCert = async () => {
    try {
      // 先删除该学生已有的 active 证书（一学生一证）
      const existingCerts = (certificates as any[]).filter(
        (c: any) => c.studentId === issueTarget?.studentId && c.status === "active"
      );
      for (const cert of existingCerts) {
        try {
          await deleteCertificate({ tenant: tenant!, primaryKey: cert.id, headers });
        } catch (e) {
          // 忽略删除错误
        }
      }

      const result = await issueCertMutation.mutateAsync();

      // 如果是模板生成，截取预览并上传到 OSS
      if (issueMethod === "template" && issueCertPreviewRef.current) {
        try {
          const canvas = await html2canvas(issueCertPreviewRef.current, {
            scale: 2,
            backgroundColor: "#FBF9F3",
            useCORS: true,
            allowTaint: false,
          });
          const blob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve, "image/png", 1.0)
          );
          if (blob) {
            const file = new File([blob], `cert_${issueTarget?.studentId || "unknown"}.png`, { type: "image/png" });
            const sts = await getSTSToken(file.name, file.size, file.type);
            const uploadResult = await uploadFileToOSS(sts, { file, onProgress: () => {} });

            // 更新证书记录，写入文件 URL
            const certId = (result as any).data?.id;
            if (certId && uploadResult.url) {
              await updateCertificate({
                tenant: tenant!,
                primaryKey: certId,
                input: {
                  fileUrl: uploadResult.url,
                  fileName: uploadResult.name,
                  certificateType: "uploaded_image",
                },
                fields: ["id"],
                headers,
              });
            }
          }
        } catch (capErr) {
          console.warn("[MM] 证书截图上传承失败:", capErr);
        }
      }

      // 如果 enrollment 还是 active，自动标记为 completed
      if (issueTarget && issueTarget.status === "active") {
        try {
          await completeEnrollment({
            tenant: tenant!,
            primaryKey: issueTarget.id,
            input: {},
            fields: ["id", "status"],
            headers,
          });
        } catch (_e) {
          // 忽略重复标记结业的错误
        }
      }

      message.success("证书已颁发");
      setIssueModalVisible(false);
      setIssueTarget(null);
      setUploadedUrl("");
      setIssueCertNo("");
      queryClient.invalidateQueries({ queryKey: ["mm-enrollments-mgmt", mmId] });
      queryClient.invalidateQueries({ queryKey: ["mm-certificates-mgmt", mmId] });
    } catch (err: any) {
      message.error(err?.message || "颁发失败");
    }
  };

  const handleUploadCert = async (file: File) => {
    const isImage = file.type.startsWith("image/");
    const isPdf = file.type === "application/pdf";
    if (!isImage && !isPdf) { message.error("仅支持图片或 PDF"); return false; }
    if (file.size > 20 * 1024 * 1024) { message.error("文件不能超过 20MB"); return false; }
    setUploading(true);
    try {
      const sts = await getSTSToken(file.name, file.size, file.type);
      const result = await uploadFileToOSS(sts, { file, onProgress: () => {} });
      setUploadedUrl(result.url);
      setUploadedFileName(result.name);
      message.success("上传成功");
    } catch (err: any) {
      message.error(err?.message || "上传失败");
    } finally {
      setUploading(false);
    }
    return false;
  };

  // ── 表格列 ──
  const commonColumns: TableColumnsType<Enrollment> = [
    {
      title: "学号", key: "memberId", width: 140,
      responsive: ["md"],
      render: (_, r) => r.student?.memberId || "-",
    },
    {
      title: "姓名", key: "name",
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <span style={{ fontWeight: 500, fontSize: 14 }}>{r.student?.name || "未命名"}</span>
          {r.student?.email && <span style={{ fontSize: 11, color: "#888" }}>{r.student.email}</span>}
        </Space>
      ),
    },
    {
      title: "班级", key: "className", width: 120,
      responsive: ["md"],
      render: (_, r) => {
        const cls = classes.find((c: any) => c.id === r.student?.classId);
        return cls?.name || "-";
      },
    },
    {
      title: "报名时间", dataIndex: "assignedAt", key: "assignedAt", width: 170,
      responsive: ["md"],
      render: (v: string) => v ? new Date(v).toLocaleString("zh-CN") : "-",
    },
  ];

  const pendingColumns: TableColumnsType<Enrollment> = [
    ...commonColumns,
    {
      title: "操作", key: "actions", width: 100, align: "center" as const,
      render: (_, r) => (
        <Space size="small">
          <ReadonlyActionButton size="small" type="primary" icon={<CheckCircleOutlined />} loading={approveMutation.isPending}
            onClick={() => approveMutation.mutate(r.id)} />
          <ReadonlyActionButton size="small" danger icon={<CloseCircleOutlined />}
            onClick={() => openRejectModal(r)} />
        </Space>
      ),
    },
  ];

  const activeColumns: TableColumnsType<Enrollment> = [
    ...commonColumns,
    {
      title: "进度", dataIndex: "progress", key: "progress", width: 60,
      responsive: ["md"],
      render: (v: number) => v != null ? `${Math.round(v)}%` : "-",
    },
    {
      title: "操作", key: "actions", width: 80, align: "center" as const,
      render: (_, r) => (
        <Space size="small">
          <ReadonlyActionButton
            size="small"
            type="primary"
            style={{ background: "#52c41a", borderColor: "#52c41a" }}
            icon={<TrophyOutlined />}
            loading={completeMutation.isPending}
            onClick={async () => {
              try {
                const result = await completeEnrollment({
                  tenant: tenant!,
                  primaryKey: r.id,
                  input: {},
                  fields: ["id", "status", "completedAt"],
                  headers,
                });
                if (!result.success) {
                  message.error((result as any).errors?.[0]?.message || "操作失败");
                  return;
                }
                message.success("已标记为结业");
                queryClient.invalidateQueries({ queryKey: ["mm-enrollments-mgmt", mmId] });
                queryClient.invalidateQueries({ queryKey: ["mm-certificates-mgmt", mmId] });
                setTimeout(() => {
                  queryClient.invalidateQueries({ queryKey: ["mm-enrollments-mgmt"] });
                }, 500);
              } catch (err: any) {
                message.error(err?.message || "操作失败");
              }
            }}
          />
          <Popconfirm title="确定移除该学生？" onConfirm={() => removeMutation.mutate(r.id)}>
            <ReadonlyActionButton size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 打开颁发证书 modal 的共用入口（首次颁发 / 重新颁发都用）
  const openIssueModal = (enrollment: Enrollment) => {
    setIssueTarget(enrollment);
    setIssueMethod(template ? "template" : "upload");
    setIssueCertNo("");
    setUploadedUrl("");
    setIssueModalVisible(true);
  };

  // 已结业列
  const completedColumns: TableColumnsType<Enrollment> = [
    { title: "学号", key: "memberId", width: 140, responsive: ["md"], render: (_, r) => r.student?.memberId || "-" },
    { title: "姓名", key: "name", render: (_, r) => <Text strong>{r.student?.name || "未命名"}</Text> },
    { title: "班级", key: "className", width: 120, responsive: ["md"], render: (_, r) => { const cls = classes.find((c: any) => c.id === r.student?.classId); return cls?.name || "-"; } },
    {
      title: "证书", key: "cert", width: 80, responsive: ["md"],
      render: (_, r) => {
        const certExist = certificateMap.has(r.studentId);
        return certExist ? <Tag icon={<FilePdfOutlined />} color="green">已颁发</Tag> : <Tag color="default">未颁发</Tag>;
      },
    },
    {
      title: "操作", key: "actions", width: 120, align: "center" as const,
      render: (_, r) => {
        const certExist = certificateMap.has(r.studentId);
        return (
          <Space size="small">
            {certExist ? (
              <Button
                size="small"
                icon={<FilePdfOutlined />}
                onClick={() => {
                  const c = (certificates as any[]).find((cert: any) => cert.studentId === r.studentId && cert.status === "active");
                  setPreviewCert(c || null);
                  setChangeCertTarget(r);
                  setPreviewModalVisible(true);
                }}
              />
            ) : (
              <ReadonlyActionButton
                size="small"
                type="primary"
                icon={<FilePdfOutlined />}
                onClick={() => openIssueModal(r)}
              />
            )}
            {certExist && (
              <Popconfirm
                title="重新颁发证书"
                description="将用当前模板覆盖该学生的现有证书"
                okText="继续"
                cancelText="取消"
                onConfirm={() => openIssueModal(r)}
              >
                <ReadonlyActionButton size="small" icon={<ReloadOutlined />} />
              </Popconfirm>
            )}
            <Popconfirm title="确定撤销结业？" onConfirm={() => handleRevoke(r.id, r.studentId)}>
              <ReadonlyActionButton size="small" icon={<UndoOutlined />} />
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  const rejectedColumns: TableColumnsType<Enrollment> = [
    ...commonColumns,
    {
      title: "拒绝原因", dataIndex: "rejectedReason", key: "rejectedReason", width: 160,
      responsive: ["md"],
      render: (v: string | null) => v || "-",
    },
    {
      title: "操作", key: "actions", width: 60, align: "center" as const,
      render: (_, r) => (
        <Button size="small" type="primary" ghost icon={<CheckCircleOutlined />}
          onClick={() => approveMutation.mutate(r.id)} />
      ),
    },
  ];

  const studentColumns: TableColumnsType<Student & { className?: string }> = [
    { title: "学号", dataIndex: "memberId", key: "memberId", width: 140 },
    { title: "姓名", dataIndex: "name", key: "name" },
    { title: "邮箱", dataIndex: "email", key: "email" },
    { title: "班级", dataIndex: "className", key: "className" },
  ];

  const classColumns: TableColumnsType<(typeof studentsByClass)[0]> = [
    {
      title: "班级", dataIndex: "className", key: "className",
      render: (text, record) => (
        <Space><span>{text}</span><Tag color="blue">{record.studentCount}</Tag></Space>
      ),
    },
  ];

  // 全部状态合并表格
  const allTableColumns: TableColumnsType<Enrollment> = [
    ...commonColumns,
    {
      title: "状态", dataIndex: "status", key: "status", width: 90,
      render: (s: string) => {
        const map: Record<string, any> = {
          pending: <Tag color="orange">待审核</Tag>,
          active: <Tag color="blue">学习中</Tag>,
          completed: <Tag color="green">已结业</Tag>,
          rejected: <Tag color="red">已拒绝</Tag>,
        };
        return map[s] || s;
      },
    },
    {
      title: "进度", dataIndex: "progress", key: "progress", width: 70,
      responsive: ["md"],
      render: (v: number, r) => r.status === "active" && v != null ? `${Math.round(v)}%` : "-",
    },
    {
      title: "证书", key: "cert", width: 90,
      responsive: ["md"],
      render: (_, r) => {
        const certExist = certificateMap.has(r.studentId);
        return certExist
          ? <Tag icon={<FilePdfOutlined />} color="green">已颁发</Tag>
          : <Tag color="default">未颁发</Tag>;
      },
    },
  ];

  return (
    <div className="mm-student-management-wrap" style={{ padding: 24 }}>
<style>{`@media(max-width:768px){.mm-student-management-wrap{padding:12px!important}.mm-student-management-wrap .ant-table-cell{padding:6px 4px!important}}`}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <TeamOutlined style={{ fontSize: 24, color: "#722ed1" }} />
                  <Button
            className="teacher-page-back-btn"
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/micro-major/dashboard")}
            style={{ color: "#1890ff", padding: "4px 8px", fontSize: 16 }}
          />
<Title level={4} style={{ margin: 0 }}>微专业学生管理</Title>
      </div>

      <ContextSelector />

      {!mmId ? (
        <Card><Empty description="请在上方选择一个微专业" /></Card>
      ) : (
        <Card>
          <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
            <Col>
              <Space>
                <TeamOutlined style={{ fontSize: 20, color: "#1890ff" }} />
                <Title level={4} style={{ margin: 0 }}>
                  {microMajor?.name || "微专业"} - 学生管理
                </Title>
              </Space>
              <div style={{ marginTop: 4 }}>
                <Text type="secondary">
                  学习中 {activeEnrollments.length} 名，
                  <Text style={{ color: "#52c41a" }}>已结业 {completedEnrollments.length} 名</Text>，
                  <Text style={{ color: "#faad14" }}>待审核 {pendingEnrollments.length} 名</Text>，
                  <Text type="secondary">已拒绝 {rejectedEnrollments.length} 名</Text>
                </Text>
              </div>
            </Col>
          </Row>

          {/* 筛选栏 */}
          <div style={{ marginBottom: 16 }}>
            <Space wrap size={[12, 12]}>
              <Input
                allowClear
                placeholder="搜索学号、姓名、邮箱或班级"
                prefix={<SearchOutlined />}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                style={{ width: 220 }}
              />
              <Select
                style={{ width: 160 }}
                placeholder="全部班级"
                allowClear
                value={classFilter}
                onChange={setClassFilter}
                options={(classes as any[]).map((c: any) => ({ label: c.name, value: c.id }))}
              />
              <Select
                style={{ width: 160 }}
                placeholder="证书状态"
                allowClear
                value={certFilter}
                onChange={setCertFilter}
                options={[
                  { label: "已颁发", value: "issued" },
                  { label: "未颁发", value: "not_issued" },
                ]}
              />
              <DatePicker.RangePicker
                value={dateRange}
                onChange={(dates) => setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null)}
                style={{ width: 260 }}
              />
              <Select
                style={{ width: 200 }}
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { label: `全部 (${allEnrollments.length})`, value: "all" },
                  { label: `待审核 (${pendingEnrollments.length})`, value: "pending" },
                  { label: `学习中 (${activeEnrollments.length})`, value: "active" },
                  { label: `已结业 (${completedEnrollments.length})`, value: "completed" },
                  { label: `已拒绝 (${rejectedEnrollments.length})`, value: "rejected" },
                ]}
              />
              {hasFilters && (
                <Button icon={<ReloadOutlined />} onClick={resetFilters}>重置筛选</Button>
              )}
            </Space>
          </div>

          {statusFilter === "all" && (
            <Table
              rowKey="id"
              columns={allTableColumns}
              dataSource={filteredEnrollments}
              loading={enrollmentsLoading}
              pagination={{ pageSize: 10, size: "small" }}
              locale={{ emptyText: <Empty description="暂无匹配的学生" /> }}
            />
          )}
          {statusFilter === "pending" && (
            <Table
              rowKey="id"
              columns={pendingColumns}
              dataSource={pendingFiltered}
              loading={pendingLoading}
              pagination={{ pageSize: 10, size: "small" }}
              locale={{ emptyText: <Empty description="暂无待审核的申请" /> }}
            />
          )}
          {statusFilter === "active" && (
            <>
              <div style={{ marginBottom: 16, textAlign: "right" }}>
                <Button type="primary" icon={<UserAddOutlined />} onClick={() => {
                  setSelectedStudentIds([]);
                  setSearchText("");
                  setModalTab("list");
                  setAddModalVisible(true);
                }} style={canEdit ? undefined : { display: "none" }}>
                  手动添加学生
                </Button>
              </div>
              <Table
                rowKey="id"
                columns={activeColumns}
                dataSource={activeFiltered}
                loading={enrollmentsLoading}
                pagination={{ pageSize: 10, size: "small" }}
                locale={{ emptyText: <Empty description={enrollmentsLoading ? "加载中..." : "暂无学习中"} /> }}
              />
            </>
          )}
          {statusFilter === "completed" && (
            <Table
              rowKey="id"
              columns={completedColumns}
              dataSource={completedFiltered}
              loading={enrollmentsLoading}
              pagination={{ pageSize: 10, size: "small" }}
              locale={{ emptyText: <Empty description="暂无结业学生" /> }}
            />
          )}
          {statusFilter === "rejected" && (
            <Table
              rowKey="id"
              columns={rejectedColumns}
              dataSource={rejectedFiltered}
              loading={enrollmentsLoading}
              pagination={{ pageSize: 10, size: "small" }}
              locale={{ emptyText: <Empty description="暂无已拒绝的申请" /> }}
            />
          )}
        </Card>
      )}

      {/* 添加学生弹窗 */}
      <Modal
        title="手动添加学生到微专业"
        open={addModalVisible}
        onOk={() => selectedStudentIds.length > 0 && assignMutation.mutate()}
        onCancel={() => { setAddModalVisible(false); setSelectedStudentIds([]); }}
        confirmLoading={assignMutation.isPending}
        width={850}
        destroyOnClose
      >
        <div style={{ marginBottom: 12 }}>
          <Input
            placeholder="搜索学号、姓名、邮箱或班级"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
          />
        </div>
        <div style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>已选择: <Tag color="blue">{selectedStudentIds.length} 名学生</Tag></div>
          <Button size="small" onClick={() => {
            const allIds = filteredStudents.map((s) => s.id);
            setSelectedStudentIds(selectedStudentIds.length === allIds.length ? [] : allIds);
          }}>
            {selectedStudentIds.length === filteredStudents.length ? "取消全选" : "全选"}
          </Button>
        </div>
        <Tabs activeKey={modalTab} onChange={setModalTab} items={[
          {
            key: "list",
            label: <span><UnorderedListOutlined /> 学生列表</span>,
            children: (
              <Table
                columns={studentColumns}
                dataSource={filteredStudents}
                rowKey="id"
                rowSelection={{
                  selectedRowKeys: selectedStudentIds,
                  onChange: (keys) => setSelectedStudentIds(keys as string[]),
                }}
                pagination={{ pageSize: 12 }}
                size="small"
                scroll={{ y: 400 }}
              />
            ),
          },
          {
            key: "group",
            label: <span><AppstoreOutlined /> 班级分组</span>,
            children: (
              <Table
                columns={classColumns}
                dataSource={studentsByClass}
                rowKey="classId"
                expandable={{
                  expandedRowRender: (record) => (
                    <Table
                      columns={studentColumns}
                      dataSource={record.students}
                      rowKey="id"
                      rowSelection={{
                        selectedRowKeys: selectedStudentIds.filter((id) => record.students.some((s) => s.id === id)),
                        onChange: (keys) => {
                          const other = selectedStudentIds.filter((id) => !record.students.some((s) => s.id === id));
                          setSelectedStudentIds([...other, ...(keys as string[])]);
                        },
                      }}
                      pagination={false}
                      size="small"
                    />
                  ),
                  rowExpandable: (record) => record.students.length > 0,
                }}
                pagination={false}
                size="small"
              />
            ),
          },
        ]} />
      </Modal>

      {/* 拒绝弹窗 */}
      <Modal
        title="拒绝报名申请"
        open={rejectModalVisible}
        onOk={() => rejectMutation.mutate()}
        onCancel={() => { setRejectModalVisible(false); setRejectTarget(null); setRejectReason(""); }}
        confirmLoading={rejectMutation.isPending}
        okText="确认拒绝"
        okButtonProps={{ danger: true }}
        destroyOnClose
      >
        <div style={{ marginBottom: 12 }}>
          <Text>确定拒绝 <strong>{rejectTarget?.student?.name || "该学生"}</strong> 的报名申请？</Text>
        </div>
        <div>
          <Text type="secondary" style={{ display: "block", marginBottom: 6 }}>拒绝原因（可选）：</Text>
          <Input.TextArea rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="输入拒绝原因，学生端可见" />
        </div>
      </Modal>

      {/* ── 颁发证书弹窗 ── */}
      <Modal
        title={`颁发证书 - ${issueTarget?.student?.name || ""}`}
        open={issueModalVisible}
        onCancel={() => { setIssueModalVisible(false); setIssueTarget(null); setUploadedUrl(""); setIssueCertNo(""); }}
        onOk={handleIssueCert}
        confirmLoading={issueCertMutation.isPending}
        okText="颁发"
        destroyOnClose
      >
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          <div>
            <Text strong>颁发方式</Text>
            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              <Button
                type={issueMethod === "template" ? "primary" : "default"}
                icon={<FilePdfOutlined />}
                disabled={!template}
                onClick={() => setIssueMethod("template")}
              >
                {template ? "使用证书模板" : "暂无模板"}
              </Button>
              <Button
                type={issueMethod === "upload" ? "primary" : "default"}
                icon={<UploadOutlined />}
                onClick={() => setIssueMethod("upload")}
              >
                上传证书文件
              </Button>
            </div>
            {issueMethod === "template" && template && (
              <>
                <div style={{ marginTop: 8, padding: 8, background: "#f6ffed", borderRadius: 4, display: "flex", alignItems: "center", gap: 8 }}>
                  <Tag color={template.style === "scanned" ? "geekblue" : "green"}>
                    {template.style === "scanned" ? "图片扫描模板" : "在线设计模板"}
                  </Tag>
                  <Text style={{ color: "green" }}>
                    {template.style === "scanned"
                      ? "✓ 将在扫描背景图上叠加该学生姓名和编号"
                      : "✓ 将填入学生姓名生成"}
                  </Text>
                </div>

                {/* 证书预览：扫描件 → ScanTemplateEditor；在线设计 → 内联 HTML */}
                <div style={{
                  border: "1px dashed #d9d9d9", borderRadius: 4, padding: 16,
                  background: "#fafafa", marginTop: 8,
                  display: "flex", justifyContent: "center",
                }}>
                  {template.style === "scanned" ? (
                    template.backgroundImageUrl ? (
                      <ScanTemplateEditor
                        ref={issueCertPreviewRef}
                        backgroundUrl={template.backgroundImageUrl}
                        nameField={templateToNameField(template)}
                        certNoField={templateToCertNoField(template)}
                        studentName={issueTarget?.student?.name || "学生姓名"}
                        certNo={expandCertNoTemplate(issueCertNo)}
                        readOnly
                      />
                    ) : (
                      <Empty description="扫描件模板未上传背景图，请先到「证书模板」页面编辑" />
                    )
                  ) : (
                    <div ref={issueCertPreviewRef} style={{ padding: 8, border: `2px solid ${getBorderColor(template.style)}`, borderRadius: 2, background: "#FBF9F3", width: 500 }}>
                      <div style={{ padding: "24px 28px", border: `1px solid ${getInnerBorderColor(template.style)}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div style={{ width: 50, height: 50, display: "flex", alignItems: "center", justifyContent: "center", border: template.logoUrl ? "none" : "1px dashed #b3b1a8" }}>
                            {template.logoUrl ? <img src={template.logoUrl} alt="" crossOrigin="anonymous" referrerPolicy="no-referrer" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <Text style={{ fontSize: 10, color: "#8a8a86" }}>logo</Text>}
                          </div>
                          <div style={{ textAlign: "right", fontSize: 10, color: "#7a7a74" }}>
                            <div>编号: {issueCertNo || "-"}</div>
                            <div>日期: {new Date().toISOString().slice(0, 10)}</div>
                          </div>
                        </div>
                        <div style={{ textAlign: "center", marginTop: 16 }}>
                          <div style={{ fontFamily: template.titleFont || "ui-sans-serif, system-ui, sans-serif", fontSize: 26, letterSpacing: "4px", fontWeight: 500, color: template.titleColor || "#2b2b28" }}>结业证书</div>
                          <div style={{ fontSize: 10, marginTop: 4, letterSpacing: 3, color: "#8a8a86" }}>结业证书</div>
                        </div>
                        <div style={{ textAlign: "center", marginTop: 24, fontSize: 13, lineHeight: "2em", color: "#3a3a36" }}>
                          兹证明 <span style={{ fontWeight: 500 }}>{issueTarget?.student?.name || "学生姓名"}</span> 同学在本机构学习期间，
                          通过《{microMajor?.name || "微专业"}》微专业全部课程考核，
                          达到毕业要求，特发此证，以资证明。
                        </div>
                        {template.extraText && (
                          <div style={{ textAlign: "center", marginTop: 8, fontSize: 11, color: "#8a8a86" }}>{template.extraText}</div>
                        )}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 28 }}>
                          <div style={{ textAlign: "left" }}>
                            <div style={{ height: 28, display: "flex", alignItems: "flex-end", fontSize: 10, color: "#b3b1a8" }}>
                              {template.signatureUrl ? <img src={template.signatureUrl} alt="" crossOrigin="anonymous" referrerPolicy="no-referrer" style={{ height: 28, objectFit: "contain" }} /> : "签名区"}
                            </div>
                            <div style={{ borderTop: "1px solid #8a8a86", fontSize: 11, color: "#3a3a36", paddingTop: 2 }}>
                              签发人: {template.issuerName || "-"}
                            </div>
                          </div>
                          <div style={{ width: 64, height: 64, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, border: template.sealUrl ? "none" : "1px dashed #c99a9a", transform: "rotate(-6deg)", overflow: "hidden" }}>
                            {template.sealUrl ? <img src={template.sealUrl} alt="" crossOrigin="anonymous" referrerPolicy="no-referrer" style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: "50%" }} /> : "印章"}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {issueMethod === "template" && (
            <div>
              <Text strong>证书编号（选填）</Text>
              <Input
                value={issueCertNo}
                onChange={e => setIssueCertNo(e.target.value)}
                style={{ marginTop: 4 }}
                placeholder="例如: CJ-2026-0001 或输入模板"
              />
              <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                <Button size="small" type={issueCertNo === "{yyyy}-{mm}-{dd}" ? "primary" : "default"} onClick={() => setIssueCertNo("{yyyy}-{mm}-{dd}")}>yyyy-mm-dd</Button>
                <Button size="small" type={issueCertNo.startsWith("{yyyy}-{mm}-{dd} 第") ? "primary" : "default"} onClick={() => setIssueCertNo("{yyyy}-{mm}-{dd} 第001号")}>日期-编号</Button>
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: "#888" }}>
                💡 支持占位符：<code>{'{yyyy}'}</code>年 <code>{'{mm}'}</code>月 <code>{'{dd}'}</code>日 <code>{'{yyyyMMdd}'}</code>年月日
              </div>
            </div>
          )}

          {issueMethod === "upload" && (
            <div>
              <Text strong>上传证书文件</Text>
              <div style={{ marginTop: 4 }}>
                <Upload beforeUpload={handleUploadCert} showUploadList={false} accept="image/*,.pdf">
                  <Button icon={<UploadOutlined />} loading={uploading}>
                    {uploadedUrl ? "重新上传" : "选择文件"}
                  </Button>
                </Upload>
                <Text type="secondary" style={{ display: "block", fontSize: 11, marginTop: 4 }}>
                  支持 PNG、JPG、PDF，最大 20MB
                </Text>
                {uploadedUrl && (
                  <div style={{ marginTop: 8, padding: 8, background: "#f6ffed", borderRadius: 4 }}>
                    <Text style={{ color: "green" }}>已上传: {uploadedFileName}</Text>
                  </div>
                )}
              </div>
            </div>
          )}
        </Space>
      </Modal>

      {/* ── 证书预览 / 更换 ── */}
      <Modal
        title="结业证书"
        open={previewModalVisible}
        onCancel={() => { setPreviewModalVisible(false); setPreviewCert(null); setChangeCertTarget(null); }}
        footer={null}
        width={700}
        destroyOnClose
      >
        {previewCert && (
          <div style={{ textAlign: "center" }}>
            {previewCert.certNo && (
              <div style={{ marginBottom: 8 }}>
                <Tag color="blue">{previewCert.certNo}</Tag>
              </div>
            )}
            {previewCert.fileUrl ? (
              previewCert.certificateType === "uploaded_image" || previewCert.certificateType === "image" ? (
                <img src={previewCert.fileUrl} alt="证书" style={{ width: "100%", height: "auto", border: "1px solid #eee", borderRadius: 4 }} />
              ) : (
                <iframe src={previewCert.fileUrl} style={{ width: "100%", height: 450, border: "1px solid #eee", borderRadius: 4 }} title="证书预览" />
              )
            ) : (
              <Empty description="证书文件暂不可用" />
            )}
            <div style={{ marginTop: 16, display: "flex", justifyContent: "center", gap: 8 }}>
              {previewCert.fileUrl && (
                <Button icon={<DownloadOutlined />} href={previewCert.fileUrl} target="_blank" download={previewCert.fileName || "certificate"}>
                  下载
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
