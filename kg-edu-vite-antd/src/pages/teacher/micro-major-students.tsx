import React, { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Button, Card, Col, Empty, message, Popconfirm, Row, Select, Space, Table, Tag, Typography, Modal, Input, Tabs, Badge,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  ArrowLeftOutlined, DeleteOutlined, TeamOutlined, UserAddOutlined, SearchOutlined,
  UnorderedListOutlined, AppstoreOutlined, CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined,
  TrophyOutlined, FilePdfOutlined, UndoOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { extractArrayData } from "@/utils/api-helpers";
import {
  getMicroMajor, listUsers, listClasses,
  listEnrollmentsByMicroMajor, removeStudentFromMicroMajor, bulkAssignStudentsToMicroMajor,
  listPendingEnrollments, approveEnrollment, rejectEnrollment,
  completeEnrollment, revokeCompletion,
  listCertificatesByMicroMajor, deleteCertificate,
} from "@/lib/ash_rpc";
import { useEditPermission } from "@/hooks/use-edit-permission";
import { ReadonlyActionButton } from "@/components/readonly-action-button";

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

export default function MicroMajorStudents() {
  const { microMajorId } = useParams<{ microMajorId: string }>();
  const navigate = useNavigate();
  const { user, tenant } = useAuth();
  const queryClient = useQueryClient();
  const headers = getAuthHeaders(user) as Record<string, string>;
  const { canEdit } = useEditPermission();

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("pending");
  const [modalTab, setModalTab] = useState("list");

  // 拒绝弹窗
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<Enrollment | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // 获取微专业详情
  const { data: microMajor } = useQuery({
    queryKey: ["micro-major-for-students", microMajorId, tenant],
    queryFn: async () => {
      const result = await getMicroMajor({
        tenant: tenant!,
        input: { id: microMajorId! },
        fields: ["id", "name", "status"],
        headers,
      });
      if (!result.success) return null;
      const data = result.data as any;
      return Array.isArray(data) ? data[0] : data;
    },
    enabled: !!microMajorId && !!tenant,
  });

  // 所有学生
  const { data: students = [] } = useQuery({
    queryKey: ["all-students-mm", tenant],
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
    queryKey: ["classes-mm", tenant],
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

  // 全部 enrollment（含 pending/rejected）
  const { data: allEnrollments = [], isLoading: enrollmentsLoading } = useQuery({
    queryKey: ["micro-major-enrollments", microMajorId, tenant],
    queryFn: async () => {
      const result = await listEnrollmentsByMicroMajor({
        tenant: tenant!,
        input: { microMajorId: microMajorId! },
        fields: [
          "id", "studentId", "status", "progress", "assignedAt", "rejectedReason",
          { student: ["id", "name", "email", "memberId", "major", "classId"] },
        ],
        headers,
      });
      return extractArray(result) as Enrollment[];
    },
    enabled: !!microMajorId && !!tenant,
  });

  // 待审批列表
  const { data: pendingEnrollments = [], isLoading: pendingLoading } = useQuery({
    queryKey: ["mm-pending-enrollments", microMajorId, tenant],
    queryFn: async () => {
      const result = await listPendingEnrollments({
        tenant: tenant!,
        input: { microMajorId: microMajorId! },
        fields: [
          "id", "studentId", "assignedAt",
          { student: ["id", "name", "email", "memberId", "major", "classId"] },
        ],
        headers,
      });
      return extractArray(result) as Enrollment[];
    },
    enabled: !!microMajorId && !!tenant,
  });

  // 证书查询
  const { data: certificates = [] } = useQuery({
    queryKey: ["mm-certificates-for-students", microMajorId, tenant],
    queryFn: async () => {
      if (!microMajorId) return [];
      const result = await listCertificatesByMicroMajor({
        tenant: tenant!,
        input: { microMajorId: microMajorId! },
        fields: ["id", "studentId", "certificateType", "fileUrl", "status"],
        headers,
      });
      return extractArray(result);
    },
    enabled: !!microMajorId && !!tenant,
  });

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

  const certificateMap = useMemo(() => {
    const map = new Map<string, any>();
    (certificates as any[]).forEach((c: any) => {
      if (c.status === "active") {
        map.set(c.studentId, c);
      }
    });
    return map;
  }, [certificates]);

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
      if (!microMajorId || selectedStudentIds.length === 0) return;
      return bulkAssignStudentsToMicroMajor({
        tenant: tenant!,
        input: { microMajorId, studentIds: selectedStudentIds },
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
      queryClient.invalidateQueries({ queryKey: ["micro-major-enrollments", microMajorId] });
      queryClient.invalidateQueries({ queryKey: ["mm-pending-enrollments", microMajorId] });
    },
    onError: (err: any) => message.error(err?.message || "添加失败"),
  });

  // 移除学生
  const removeMutation = useMutation({
    mutationFn: async (enrollmentId: string) =>
      removeStudentFromMicroMajor({ tenant: tenant!, primaryKey: enrollmentId, headers }),
    onSuccess: (result) => {
      if (!result.success) {
        message.error((result as any).errors?.[0]?.message || "移除失败");
        return;
      }
      message.success("已移除");
      queryClient.invalidateQueries({ queryKey: ["micro-major-enrollments", microMajorId] });
    },
  });

  // 审核通过
  const approveMutation = useMutation({
    mutationFn: async (enrollmentId: string) =>
      approveEnrollment({ tenant: tenant!, primaryKey: enrollmentId, input: {}, fields: ["id", "status"], headers }),
    onSuccess: (result) => {
      if (!result.success) {
        message.error((result as any).errors?.[0]?.message || "审批失败");
        return;
      }
      message.success("已批准");
      queryClient.invalidateQueries({ queryKey: ["micro-major-enrollments", microMajorId] });
      queryClient.invalidateQueries({ queryKey: ["mm-pending-enrollments", microMajorId] });
    },
    onError: (err: any) => message.error(err?.message || "审批失败"),
  });

  // 审核拒绝
  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!rejectTarget) return;
      return rejectEnrollment({
        tenant: tenant!,
        primaryKey: rejectTarget.id,
        input: { rejectedReason: rejectReason || undefined },
        fields: ["id", "status"],
        headers,
      });
    },
    onSuccess: (result) => {
      if (!result.success) {
        message.error((result as any).errors?.[0]?.message || "拒绝失败");
        return;
      }
      message.success("已拒绝");
      setRejectModalVisible(false);
      setRejectTarget(null);
      setRejectReason("");
      queryClient.invalidateQueries({ queryKey: ["micro-major-enrollments", microMajorId] });
      queryClient.invalidateQueries({ queryKey: ["mm-pending-enrollments", microMajorId] });
    },
    onError: (err: any) => message.error(err?.message || "拒绝失败"),
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
      queryClient.invalidateQueries({ queryKey: ["micro-major-enrollments", microMajorId] });
      queryClient.invalidateQueries({ queryKey: ["mm-certificates-for-students", microMajorId] });
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
          // 忽略删除证书的错误
        }
      }
      message.success("已撤销结业，证书已取消");
      queryClient.invalidateQueries({ queryKey: ["micro-major-enrollments", microMajorId] });
      queryClient.invalidateQueries({ queryKey: ["mm-certificates-for-students", microMajorId] });
    } catch (err: any) {
      message.error(err?.message || "操作失败");
    }
  };

  // ── 表格列 ──

  const commonColumns: TableColumnsType<Enrollment> = [
    {
      title: "学号", key: "memberId", width: 140,
      render: (_, r) => r.student?.memberId || "-",
    },
    {
      title: "学生姓名", key: "name",
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <span style={{ fontWeight: 500 }}>{r.student?.name || "未命名"}</span>
          {r.student?.email && <span style={{ fontSize: 12, color: "#888" }}>{r.student.email}</span>}
        </Space>
      ),
    },
    {
      title: "班级", key: "className", width: 120,
      render: (_, r) => {
        const cls = classes.find((c: any) => c.id === r.student?.classId);
        return cls?.name || "-";
      },
    },
    {
      title: "报名时间", dataIndex: "assignedAt", key: "assignedAt", width: 170,
      render: (v: string) => v ? new Date(v).toLocaleString("zh-CN") : "-",
    },
  ];

  // 待审核列
  const pendingColumns: TableColumnsType<Enrollment> = [
    ...commonColumns,
    {
      title: "操作", key: "actions", width: 180, align: "center" as const,
      render: (_, r) => (
        <Space>
          <ReadonlyActionButton
            size="small"
            type="primary"
            icon={<CheckCircleOutlined />}
            loading={approveMutation.isPending}
            onClick={() => approveMutation.mutate(r.id)}
          >
            批准
          </ReadonlyActionButton>
          <ReadonlyActionButton
            size="small"
            danger
            icon={<CloseCircleOutlined />}
            onClick={() => openRejectModal(r)}
          >
            拒绝
          </ReadonlyActionButton>
        </Space>
      ),
    },
  ];

  // 已通过列
  const activeColumns: TableColumnsType<Enrollment> = [
    ...commonColumns,
    {
      title: "进度", dataIndex: "progress", key: "progress", width: 80,
      render: (v: number) => v != null ? `${Math.round(v)}%` : "-",
    },
    {
      title: "加入时间", dataIndex: "assignedAt", key: "assignedAt", width: 170,
      render: (v: string) => v ? new Date(v).toLocaleString("zh-CN") : "-",
    },
    {
      title: "操作", key: "actions", width: 220, align: "center" as const,
      render: (_, r) => (
        <Space>
          <ReadonlyActionButton
            size="small"
            type="primary"
            style={{ background: "#52c41a", borderColor: "#52c41a" }}
            icon={<TrophyOutlined />}
            loading={completeMutation.isPending}
            onClick={() => handleComplete(r)}
          >
            标记结业
          </ReadonlyActionButton>
          <Popconfirm title="确定移除该学生？" onConfirm={() => removeMutation.mutate(r.id)}>
            <ReadonlyActionButton size="small" danger icon={<DeleteOutlined />}>移除</ReadonlyActionButton>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 已结业列
  const completedColumns: TableColumnsType<Enrollment> = [
    {
      title: "学号", key: "memberId", width: 140,
      render: (_, r) => r.student?.memberId || "-",
    },
    {
      title: "学生姓名", key: "name",
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <span style={{ fontWeight: 500 }}>{r.student?.name || "未命名"}</span>
        </Space>
      ),
    },
    {
      title: "班级", key: "className", width: 120,
      render: (_, r) => {
        const cls = classes.find((c: any) => c.id === r.student?.classId);
        return cls?.name || "-";
      },
    },
    {
      title: "证书", key: "cert", width: 120,
      render: (_, r) => {
        const certExist = certificateMap.has(r.studentId);
        return certExist ? (
          <Tag icon={<FilePdfOutlined />} color="green">已颁发</Tag>
        ) : (
          <Tag color="default">未颁发</Tag>
        );
      },
    },
    {
      title: "操作", key: "actions", width: 160, align: "center" as const,
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<FilePdfOutlined />} onClick={() => navigate(`/micro-major/certificate-management/${microMajorId}`)}>
            证书
          </Button>
          <Popconfirm title="确定撤销结业状态？证书也将被取消。" onConfirm={() => handleRevoke(r.id, r.studentId)}>
            <ReadonlyActionButton size="small" icon={<UndoOutlined />}>撤销结业</ReadonlyActionButton>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 已拒绝列
  const rejectedColumns: TableColumnsType<Enrollment> = [
    ...commonColumns,
    {
      title: "拒绝原因", dataIndex: "rejectedReason", key: "rejectedReason", width: 200,
      render: (v: string | null) => v || "-",
    },
    {
      title: "操作", key: "actions", width: 100, align: "center" as const,
      render: (_, r) => (
        <ReadonlyActionButton
          size="small"
          type="primary"
          ghost
          icon={<CheckCircleOutlined />}
          onClick={() => approveMutation.mutate(r.id)}
        >
          批准
        </ReadonlyActionButton>
      ),
    },
  ];

  // ── 添加学生弹窗的列 ──
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

  if (!microMajorId) return <Empty description="微专业不存在" />;

  return (
    <div className="micro-major-students-wrap" style={{ padding: 24 }}>
<style>{`@media(max-width:768px){.micro-major-students-wrap{padding:12px!important}.micro-major-students-wrap .ant-table-cell{padding:6px 4px!important}}`}</style>
      <Button icon={<ArrowLeftOutlined />} style={{ marginBottom: 16 }}
        onClick={() => navigate("/micro-major/dashboard")}>
        返回微专业列表
      </Button>

      <Card>
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col>
            <Space>
              <TeamOutlined style={{ fontSize: 20, color: "#1890ff" }} />
                        <Button
            className="teacher-page-back-btn"
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/micro-major/dashboard")}
            style={{ color: "#1890ff", padding: "4px 8px", fontSize: 16 }}
          />
<Title level={4} style={{ margin: 0 }}>
                {microMajor?.name || "微专业"} - 学生管理
              </Title>
            </Space>
            <div style={{ marginTop: 4 }}>
              <Text type="secondary">
                已通过 {activeEnrollments.length} 名学生，
                <Text style={{ color: "#faad14" }}>待审核 {pendingEnrollments.length} 名</Text>，
                <Text type="secondary">已拒绝 {rejectedEnrollments.length} 名</Text>
              </Text>
            </div>
          </Col>
        </Row>

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: "pending",
              label: (
                <span>
                  <Badge count={pendingEnrollments.length} size="small" offset={[6, -2]}>
                    <ClockCircleOutlined style={{ marginRight: 6 }} />
                  </Badge>
                  待审核
                </span>
              ),
              children: (
                <>
                  <Table
                    rowKey="id"
                    columns={pendingColumns}
                    dataSource={pendingEnrollments}
                    loading={pendingLoading}
                    pagination={{ pageSize: 10 }}
                    locale={{ emptyText: <Empty description="暂无待审核的申请" /> }}
                  />
                </>
              ),
            },
            {
              key: "active",
              label: (
                <span>
                  <CheckCircleOutlined style={{ marginRight: 6 }} />
                  学习中 ({activeEnrollments.length})
                </span>
              ),
              children: (
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
                    <Button
                      icon={<FilePdfOutlined />}
                      style={{ marginLeft: 8 }}
                      onClick={() => navigate(`/micro-major/certificate-management/${microMajorId}`)}
                    >
                      证书管理
                    </Button>
                  </div>
                  <Table
                    rowKey="id"
                    columns={activeColumns}
                    dataSource={activeEnrollments}
                    loading={enrollmentsLoading}
                    pagination={{ pageSize: 10 }}
                    locale={{ emptyText: <Empty description={enrollmentsLoading ? "加载中..." : "暂无学习中"} /> }}
                  />
                </>
              ),
            },
            {
              key: "completed",
              label: (
                <span>
                  <TrophyOutlined style={{ marginRight: 6, color: "#52c41a" }} />
                  已结业 ({completedEnrollments.length})
                </span>
              ),
              children: (
                <Table
                  rowKey="id"
                  columns={completedColumns}
                  dataSource={completedEnrollments}
                  loading={enrollmentsLoading}
                  pagination={{ pageSize: 10 }}
                  locale={{ emptyText: <Empty description="暂无结业学生" /> }}
                />
              ),
            },
            {
              key: "rejected",
              label: (
                <span>
                  <CloseCircleOutlined style={{ marginRight: 6 }} />
                  已拒绝
                </span>
              ),
              children: (
                <Table
                  rowKey="id"
                  columns={rejectedColumns}
                  dataSource={rejectedEnrollments}
                  loading={enrollmentsLoading}
                  pagination={{ pageSize: 10 }}
                  locale={{ emptyText: <Empty description="暂无已拒绝的申请" /> }}
                />
              ),
            },
          ]}
        />
      </Card>

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
          <div>
            已选择: <Tag color="blue">{selectedStudentIds.length} 名学生</Tag>
          </div>
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
          <Input.TextArea
            rows={3}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="输入拒绝原因，学生端可见"
          />
        </div>
      </Modal>
    </div>
  );
}
