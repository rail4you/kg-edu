import React, { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Card, Col, Empty, message, Popconfirm, Row, Select, Space, Table, Tag, Typography, Modal, Input, Tabs } from "antd";
import type { TableColumnsType } from "antd";
import { ArrowLeftOutlined, DeleteOutlined, TeamOutlined, UserAddOutlined, SearchOutlined, UnorderedListOutlined, AppstoreOutlined } from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { extractArrayData } from "@/utils/api-helpers";
import { listUsers, listClasses, listMajorEnrollmentsByMajor, removeMajorStudent, bulkAssignMajorStudents } from "@/lib/ash_rpc";
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

interface MajorEnrollment {
  id: string;
  studentId: string;
  status: string;
  assignedAt?: string;
  student?: Student;
}

const extractArray = (result: any) => {
  if (!result?.success) return [];
  const data = result.data;
  if (Array.isArray(data)) return data;
  return data?.results || [];
};

export default function MajorStudents() {
  const { majorId } = useParams<{ majorId: string }>();
  const navigate = useNavigate();
  const { user, tenant } = useAuth();
  const queryClient = useQueryClient();
  const headers = getAuthHeaders(user) as Record<string, string>;
  const { canEdit } = useEditPermission();

  // Modal state
  const [addStudentModalVisible, setAddStudentModalVisible] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string>("list");

  const { data: students = [], isLoading: studentsLoading } = useQuery({
    queryKey: ["major-student-options", tenant],
    queryFn: async () => {
      const result = await listUsers({
        tenant,
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

  // 获取班级列表
  const { data: classes = [] } = useQuery({
    queryKey: ["classes", tenant],
    queryFn: async () => {
      const result = await listClasses({
        tenant,
        fields: ["id", "name"],
        page: { limit: 1000 },
        headers,
      });
      return extractArrayData(result);
    },
    enabled: !!tenant && !!user,
  });

  const { data: enrollments = [], isLoading: enrollmentsLoading } = useQuery({
    queryKey: ["major-enrollments", majorId, tenant],
    queryFn: async () => {
      const result = await listMajorEnrollmentsByMajor({
        tenant,
        input: { majorId: majorId! },
        fields: ["id", "studentId", "status", "assignedAt", { student: ["id", "name", "email", "memberId", "major", "classId"] }],
        sort: "+assignedAt",
        headers,
      });
      return extractArrayData(result) as MajorEnrollment[];
    },
    enabled: !!majorId && !!tenant,
  });

  const assignedStudentIds = useMemo(() => new Set(enrollments.map(item => item.studentId)), [enrollments]);

  // 可选学生（排除已分配的）
  const availableStudents = useMemo(() => {
    return students
      .filter(student => !assignedStudentIds.has(student.id))
      .map(student => {
        const classInfo = classes.find((c: any) => c.id === student.classId);
        return {
          ...student,
          className: classInfo?.name || "未分配"
        };
      });
  }, [students, assignedStudentIds, classes]);

  // 过滤学生
  const filteredStudents = useMemo(() => {
    if (!searchText) return availableStudents;
    const lowerSearch = searchText.toLowerCase();
    return availableStudents.filter(
      (s) =>
        (s.name || "").toLowerCase().includes(lowerSearch) ||
        (s.email || "").toLowerCase().includes(lowerSearch) ||
        (s.memberId || "").toLowerCase().includes(lowerSearch) ||
        (s.className || "").toLowerCase().includes(lowerSearch)
    );
  }, [availableStudents, searchText]);

  // 按班级分组
  const studentsByClass = useMemo(() => {
    const grouped: Record<string, typeof availableStudents> = {};
    filteredStudents.forEach((student) => {
      const classId = student.classId || "unassigned";
      if (!grouped[classId]) {
        grouped[classId] = [];
      }
      grouped[classId].push(student);
    });
    return Object.entries(grouped).map(([classId, classStudents]) => ({
      classId,
      className: classStudents[0].className,
      students: classStudents,
      studentCount: classStudents.length,
    }));
  }, [filteredStudents]);

  // 批量分配学生
  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!majorId || selectedStudentIds.length === 0) return;
      const result = await bulkAssignMajorStudents({
        tenant,
        input: { majorId, studentIds: selectedStudentIds },
        headers,
      });
      if (!result.success) {
        throw new Error((result as any).errors?.[0]?.message || "添加学生失败");
      }
      return result;
    },
    onSuccess: () => {
      message.success(`已添加 ${selectedStudentIds.length} 名学生到微专业`);
      setSelectedStudentIds([]);
      setSearchText("");
      setAddStudentModalVisible(false);
      queryClient.invalidateQueries({ queryKey: ["major-enrollments", majorId] });
    },
    onError: (error: any) => message.error(error?.message || "添加学生失败"),
  });

  const removeMutation = useMutation({
    mutationFn: async (enrollmentId: string) => {
      const result = await removeMajorStudent({ tenant, primaryKey: enrollmentId, headers });
      if (!result.success) throw new Error((result as any).errors?.[0]?.message || "移除学生失败");
    },
    onSuccess: () => {
      message.success("已移除学生");
      queryClient.invalidateQueries({ queryKey: ["major-enrollments", majorId] });
    },
    onError: (error: any) => message.error(error?.message || "移除学生失败"),
  });

  const getAllSelectedCount = () => {
    return selectedStudentIds.filter(id => filteredStudents.some(s => s.id === id)).length;
  };

  // 打开添加弹窗
  const openAddModal = () => {
    setSelectedStudentIds([]);
    setSearchText("");
    setActiveTab("list");
    setAddStudentModalVisible(true);
  };

  // 关闭弹窗
  const handleModalClose = () => {
    setAddStudentModalVisible(false);
    setSelectedStudentIds([]);
    setSearchText("");
  };

  // 确认添加
  const handleAddStudents = () => {
    if (selectedStudentIds.length > 0) {
      assignMutation.mutate();
    }
  };

  const columns: TableColumnsType<MajorEnrollment> = [
    {
      title: "学号",
      key: "memberId",
      width: 180,
      render: (_, record) => record.student?.memberId || "-",
    },
    {
      title: "学生姓名",
      key: "name",
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <span style={{ fontWeight: 500 }}>{record.student?.name || "未命名学生"}</span>
          {record.student?.email && <span style={{ fontSize: 12, color: "#888" }}>{record.student.email}</span>}
        </Space>
      ),
    },
    {
      title: "班级",
      key: "className",
      render: (_, record) => {
        const classInfo = classes.find((c: any) => c.id === record.student?.classId);
        return classInfo?.name || "-";
      },
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      render: status => <Tag color={status === "active" ? "green" : "default"}>{status === "active" ? "学习中" : status}</Tag>,
    },
    {
      title: "加入时间",
      dataIndex: "assignedAt",
      key: "assignedAt",
      render: value => value ? new Date(value).toLocaleString("zh-CN") : "-",
    },
    {
      title: "操作",
      key: "actions",
      width: 100,
      align: "center" as const,
      render: (_, record) => (
        <Popconfirm title="确定从该微专业移除学生？" onConfirm={() => removeMutation.mutate(record.id)}>
          <ReadonlyActionButton size="small" danger icon={<DeleteOutlined />}>移除</ReadonlyActionButton>
        </Popconfirm>
      ),
    },
  ];

  // 弹窗中学生列表列
  const studentColumns: TableColumnsType<Student & { className?: string }> = [
    { title: "学号", dataIndex: "memberId", key: "memberId", width: 160 },
    { title: "学生姓名", dataIndex: "name", key: "name" },
    { title: "邮箱", dataIndex: "email", key: "email" },
    { title: "班级", dataIndex: "className", key: "className" },
  ];

  // 弹窗中班级分组列
  const classColumns: TableColumnsType<(typeof studentsByClass)[0]> = [
    {
      title: "班级",
      dataIndex: "className",
      key: "className",
      render: (text, record) => (
        <Space>
          <span>{text}</span>
          <Tag color="blue">{record.studentCount}</Tag>
        </Space>
      ),
    },
  ];

  if (!majorId) return <Empty description="微专业不存在" />;

  return (
    <div style={{ padding: 24 }}>
      <Button icon={<ArrowLeftOutlined />} style={{ marginBottom: 16 }} onClick={() => navigate(`/teacher/dashboard/major-detail/${majorId}`)}>
        返回微专业详情
      </Button>

      <Card>
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col>
            <Space>
              <TeamOutlined style={{ fontSize: 20, color: "#1890ff" }} />
              <Title level={4} style={{ margin: 0 }}>学生管理</Title>
            </Space>
            <div style={{ marginTop: 4 }}>
              <Text type="secondary">由教师端为学生分配微专业，学生端只展示已分配的微专业。</Text>
            </div>
          </Col>
          <Col>
            <Button
              type="primary"
              icon={<UserAddOutlined />}
              onClick={openAddModal}
              disabled={studentsLoading || availableStudents.length === 0}
              style={canEdit ? undefined : { display: "none" }}
            >
              添加学生
            </Button>
          </Col>
        </Row>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={enrollments}
          loading={enrollmentsLoading}
          pagination={{ pageSize: 10 }}
          locale={{
            emptyText: <Empty description={enrollmentsLoading ? "加载中..." : "暂无已分配学生"} />
          }}
        />
      </Card>

      {/* 添加学生弹窗 */}
      <Modal
        title="添加学生到微专业"
        open={addStudentModalVisible}
        onOk={handleAddStudents}
        onCancel={handleModalClose}
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

        <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            已选择: <Tag color="blue">{selectedStudentIds.length} 名学生</Tag>
            {searchText && (
              <span style={{ marginLeft: 8, color: "#888" }}>
                (当前搜索结果中选中了 {getAllSelectedCount()} 名)
              </span>
            )}
          </div>
          <Button
            size="small"
            onClick={() => {
              const allIds = filteredStudents.map(s => s.id);
              if (selectedStudentIds.length === allIds.length) {
                setSelectedStudentIds([]);
              } else {
                setSelectedStudentIds(allIds);
              }
            }}
          >
            {selectedStudentIds.length === filteredStudents.length ? '取消全选' : '全选'}
          </Button>
        </div>

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: "list",
              label: (
                <span><UnorderedListOutlined /> 学生列表</span>
              ),
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
              label: (
                <span><AppstoreOutlined /> 班级分组</span>
              ),
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
                          selectedRowKeys: selectedStudentIds.filter(id =>
                            record.students.some(s => s.id === id)
                          ),
                          onChange: (keys) => {
                            const newSelected = keys as string[];
                            const otherSelected = selectedStudentIds.filter(id =>
                              !record.students.some(s => s.id === id)
                            );
                            setSelectedStudentIds([...otherSelected, ...newSelected]);
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
          ]}
        />
      </Modal>
    </div>
  );
}
