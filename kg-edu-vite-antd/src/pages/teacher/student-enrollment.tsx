import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Table,
  Button,
  Card,
  Typography,
  Select,
  Space,
  Tag,
  message,
  Spin,
  Alert,
  Modal,
  Input,
  Tabs,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import EmptyState from "@/components/EmptyState";
import {
  TeamOutlined,
  DeleteOutlined,
  SearchOutlined,
  UnorderedListOutlined,
  AppstoreOutlined,
  ArrowLeftOutlined,
} from "@ant-design/icons";
import {
  listEnrollmentsByCourse,
  listUsers,
  bulkEnrollStudents,
  unenrollStudent,
  listClasses,
} from "@/lib/ash_rpc";
import { useCourses } from "@/hooks/use-courses";
import { getAuthHeaders } from "@/lib/auth";
import { useAuth } from "@/auth/auth-context";
import { getCurrentTenant } from "@/lib/tenant";
import { extractArrayData } from "@/utils/api-helpers";
import { useNavigate } from "react-router-dom";
import { useEditPermission } from "@/hooks/use-edit-permission";
import { ReadonlyActionButton } from "@/components/readonly-action-button";

const { Title, Text } = Typography;

interface Student {
  id: string;
  name: string;
  email: string;
  classId?: string;
  className?: string;
  memberId?: string;
}

interface Enrollment {
  id: string;
  memberId: string;
  enrolledAt?: string;
}

const getHeaders = (user: any): Record<string, string> => {
  return getAuthHeaders(user) as Record<string, string>;
};

export default function StudentEnrollmentPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const currentTenant = getCurrentTenant();
  const queryClient = useQueryClient();
  const { canEdit } = useEditPermission();
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [addStudentModalVisible, setAddStudentModalVisible] = useState<boolean>(false);
  const [searchText, setSearchText] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string>("list");

  const tenant = currentTenant?.schemaName || "";

  // ALL HOOKS BEFORE CONDITIONAL RETURNS
  const { courses, loading: coursesLoading } = useCourses({
    fields: ["id", "title", "description"],
  });

  // 自动选择第一个课程
  useEffect(() => {
    if (courses.length > 0 && !selectedCourseId) {
      setSelectedCourseId(courses[0].id);
    }
  }, [courses, selectedCourseId]);

  const { data: students = [] } = useQuery({
    queryKey: ["users-students", tenant],
    queryFn: async () => {
      const result = await listUsers({
        tenant,
        fields: ["id", "name", "email", "role", "classId", "memberId"],
        filter: { role: { eq: "user" } },
        sort: "+name",
        headers: getHeaders(user),
      });
      return extractArrayData(result);
    },
    enabled: !!tenant && !!user,
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["classes", tenant],
    queryFn: async () => {
      const result = await listClasses({
        tenant,
        fields: ["id", "name"],
        page: { limit: 1000 },
        headers: getHeaders(user),
      });
      return extractArrayData(result);
    },
    enabled: !!tenant && !!user,
  });

  const {
    data: enrollments = [],
    isLoading: enrollmentsLoading,
    refetch: refetchEnrollments,
  } = useQuery({
    queryKey: ["enrollments", selectedCourseId, tenant],
    queryFn: async () => {
      if (!selectedCourseId) return [];
      const result = await listEnrollmentsByCourse({
        tenant,
        fields: ["id", "memberId", "enrolledAt"],
        input: { courseId: selectedCourseId },
        headers: getHeaders(user),
      });
      return extractArrayData(result);
    },
    enabled: !!selectedCourseId && !!tenant && !!user,
  });

  const enrollMutation = useMutation({
    mutationFn: async (studentIds: string[]) => {
      return bulkEnrollStudents({
        tenant,
        input: { courseId: selectedCourseId, memberIds: studentIds },
        headers: getHeaders(user),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });
      refetchEnrollments();
      message.success("添加成功");
    },
  });

  const unenrollMutation = useMutation({
    mutationFn: async (enrollmentId: string) => {
      return unenrollStudent({
        tenant,
        primaryKey: enrollmentId,
        headers: getHeaders(user),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });
      refetchEnrollments();
      message.success("移除成功");
    },
  });

  const enrolledStudentIds = enrollments.map((e: Enrollment) => e.memberId);
  const availableStudents = useMemo(() => {
    return (students as Student[]).filter(
      (s) => !enrolledStudentIds.includes(s.id)
    ).map((s) => {
      const classInfo = classes.find((c: any) => c.id === s.classId);
      return {
        ...s,
        className: classInfo?.name || "未分配"
      };
    });
  }, [students, enrolledStudentIds, classes]);

  const filteredStudents = useMemo(() => {
    if (!searchText) return availableStudents;
    const lowerSearch = searchText.toLowerCase();
    return (availableStudents as Student[]).filter(
      (s) =>
        (s.name || "").toLowerCase().includes(lowerSearch) ||
        (s.email || "").toLowerCase().includes(lowerSearch) ||
        (s.className || "").toLowerCase().includes(lowerSearch)
    );
  }, [availableStudents, searchText]);

  const studentsByClass = useMemo(() => {
    const grouped: Record<string, Student[]> = {};
    (filteredStudents as Student[]).forEach((student) => {
      const classId = student.classId || "unassigned";
      if (!grouped[classId]) {
        grouped[classId] = [];
      }
      grouped[classId].push(student);
    });
    return Object.entries(grouped).map(([classId, students]) => ({
      classId,
      className: students[0].className,
      students,
      studentCount: students.length,
    }));
  }, [filteredStudents]);

  const getAllSelectedCount = () => {
    const selectedInFiltered = (filteredStudents as Student[]).filter(
      (s) => selectedStudentIds.includes(s.id)
    ).length;
    return selectedInFiltered;
  };

  // CONDITIONAL RETURNS AFTER ALL HOOKS
  if (authLoading) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ padding: 24 }}>
        <Alert message="请先登录" type="warning" showIcon />
      </div>
    );
  }

  if (!currentTenant?.schemaName) {
    return (
      <div style={{ padding: 24 }}>
        <Alert message="未选择租户" type="warning" showIcon />
      </div>
    );
  }

  const getStudentById = (studentId: string): Student | undefined => {
    const student = students.find((s: Student) => s.id === studentId);
    if (student && student.classId) {
      const classInfo = classes.find((c: any) => c.id === student.classId);
      return { ...student, className: classInfo?.name || student.classId };
    }
    return student;
  };

  const handleAddStudent = () => {
    if (selectedStudentIds.length > 0) {
      enrollMutation.mutate(selectedStudentIds);
      setAddStudentModalVisible(false);
      setSelectedStudentIds([]);
      setSearchText("");
    }
  };

  const handleRemoveStudent = (enrollmentId: string) => {
    unenrollMutation.mutate(enrollmentId);
  };

  const classColumns: ColumnsType<any> = [
    {
      title: "班级",
      dataIndex: "className",
      key: "className",
      render: (text, record) => (
        <Space>
          <span>{text}</span>
          <Tag>{record.studentCount}</Tag>
        </Space>
      ),
    },
  ];

  const studentColumns: ColumnsType<Student> = [
    {
      title: "学号",
      dataIndex: "memberId",
      key: "memberId",
      width: 120,
    },
    {
      title: "学生姓名",
      dataIndex: "name",
      key: "name",
      width: 120,
    },
    {
      title: "邮箱",
      dataIndex: "email",
      key: "email",
      width: 200,
    },
  ];

  const handleModalClose = () => {
    setAddStudentModalVisible(false);
    setSelectedStudentIds([]);
    setSearchText("");
  };

  const columns: ColumnsType<Enrollment> = [
    {
      title: "学号",
      key: "memberId",
      render: (_, row) => getStudentById(row.memberId)?.memberId || "-",
      width: 120,
      fixed: "left",
    },
    {
      title: "学生姓名",
      key: "name",
      render: (_, row) => getStudentById(row.memberId)?.name || "N/A",
      width: 120,
    },
    {
      title: "邮箱",
      key: "email",
      render: (_, row) => getStudentById(row.memberId)?.email || "N/A",
      width: 200,
      className: "enroll-mobile-hide",
    },
    {
      title: "班级",
      key: "className",
      render: (_, row) => getStudentById(row.memberId)?.className || "-",
      width: 120,
      className: "enroll-mobile-hide",
    },
    {
      title: "选课时间",
      dataIndex: "enrolledAt",
      key: "enrolledAt",
      render: (date: string) =>
        date ? new Date(date).toLocaleString("zh-CN") : "-",
      width: 160,
      className: "enroll-mobile-hide",
    },
    {
      title: "操作",
      key: "actions",
      width: 48,
      className: "enroll-actions-col",
      render: (_, row) => (
        <ReadonlyActionButton
          size="small"
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleRemoveStudent(row.id)}
        />
      ),
    },
  ];

  return (
    <div className="enroll-page-wrap" style={{ padding: 24 }}>
      <style>{`
        @media (max-width: 768px) {
          .enroll-page-wrap { padding: 12px !important; }
          .enroll-mobile-hide { display: none !important; }
          .enroll-mobile-hide-in-modal { display: none !important; }
          .enroll-page-wrap .ant-table-cell { padding: 6px 4px !important; }
          .ant-table-thead .enroll-actions-col,
          .ant-table-tbody .enroll-actions-col {
            padding: 4px 2px !important;
            width: 36px !important;
            min-width: 36px !important;
            text-align: center !important;
          }

          .enroll-back-btn { display: inline-flex !important; }
        }
        @media (min-width: 769px) {
          .enroll-back-btn { display: none !important; }
        }
      `}</style>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "8px 0",
          borderBottom: "1px solid #f0f0f0",
          gap: 12,
        }}
      >
        <Button
          className="enroll-back-btn"
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate("/teacher/dashboard")}
          style={{ color: "#1890ff", padding: "4px 8px", fontSize: 16 }}
        />
        <TeamOutlined style={{ fontSize: 24, color: "#1890ff" }} />
        <Title level={4} style={{ margin: 0 }}>
          学生选课管理
        </Title>
      </div>

      <div style={{ marginTop: 16, marginBottom: 16 }}>
        <Space wrap>
          <Text strong>选择课程：</Text>
          <Select
            style={{ width: 280 }}
            placeholder="请选择课程"
            value={selectedCourseId || undefined}
            onChange={setSelectedCourseId}
            loading={coursesLoading}
            options={(Array.isArray(courses) ? courses : []).map((c: any) => ({ value: c.id, label: c.title }))}
          />
        </Space>
      </div>

      <Card style={{ borderRadius: 8 }}>
        <Table
          className="theme-table"
          columns={columns}
          dataSource={selectedCourseId ? enrollments : []}
          rowKey="id"
          loading={selectedCourseId ? enrollmentsLoading : false}
          scroll={{ x: 600 }}
          locale={{
            emptyText: (
              <EmptyState
                description={selectedCourseId ? "暂无选课学生" : "请先选择一个课程"}
              />
            ),
          }}
          title={() => (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Space wrap>
                {selectedCourseId && availableStudents.length > 0 && canEdit && (
                  <Button
                    type="primary"
                    size="small"
                    onClick={() => setAddStudentModalVisible(true)}
                    disabled={enrollMutation.isPending}
                  >
                    添加学生
                  </Button>
                )}
                <Text strong>已选课学生 ({selectedCourseId ? enrollments.length : 0})</Text>
              </Space>
            </div>
          )}
          pagination={{ pageSize: 10, size: "small" }}
          size="small"
        />
      </Card>

      {/* 添加学生弹窗 */}
      <Modal
        title="添加学生"
        open={addStudentModalVisible}
        onOk={handleAddStudent}
        onCancel={handleModalClose}
        confirmLoading={enrollMutation.isPending}
        width={800}
      >
        <div style={{ marginBottom: 16 }}>
          <Input
            placeholder="搜索学生姓名、邮箱或班级"
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
              const allIds = (filteredStudents as Student[]).map(s => s.id);
              if (selectedStudentIds.length === allIds.length) {
                setSelectedStudentIds([]);
              } else {
                setSelectedStudentIds(allIds);
              }
            }}
          >
            {selectedStudentIds.length === (filteredStudents as Student[]).length ? '取消全选' : '全选'}
          </Button>
        </div>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: "list",
              label: (
                <span>
                  <UnorderedListOutlined />
                  学生列表
                </span>
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
                  pagination={{ pageSize: 10, size: "small" }}
                  size="small"
                />
              ),
            },
            {
              key: "group",
              label: (
                <span>
                  <AppstoreOutlined />
                  班级分组
                </span>
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
