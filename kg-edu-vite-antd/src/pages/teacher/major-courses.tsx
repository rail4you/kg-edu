import React, { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Form,
  Input,
  InputNumber,
  List,
  message,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Spin,
  Switch,
  Tag,
  Typography,
} from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  SaveOutlined,
  BookOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import {
  getPublicMicroMajor,
  listMajorCoursesByMajor,
  listCourses,
  createMajorCourse,
  updateMajorCourse,
  deleteMajorCourse,
  replaceMajorCourses,
} from "@/lib/ash_rpc";
import { extractArrayData } from "@/utils/api-helpers";
import { useEditPermission } from "@/hooks/use-edit-permission";
import { ReadonlyActionButton } from "@/components/readonly-action-button";
import "./major-courses.css";

const { Title, Text } = Typography;

interface MajorCourse {
  id: string;
  majorId: string;
  courseId: string;
  courseType: "required" | "elective";
  supportRole: "core" | "supporting" | "practice";
  sortOrder: number;
  credit?: number | null;
  period?: number | null;
  description?: string | null;
  course?: {
    id: string;
    title: string;
    description?: string | null;
  };
}

interface Course {
  id: string;
  title: string;
  description?: string | null;
}

const COURSE_TYPE_OPTIONS = [
  { value: "required", label: "必修" },
  { value: "elective", label: "选修" },
];

const SUPPORT_ROLE_OPTIONS = [
  { value: "core", label: "核心" },
  { value: "supporting", label: "支撑" },
  { value: "practice", label: "实践" },
];

const extractArray = (result: any): MajorCourse[] => {
  if (!result?.success) return [];
  const data = result.data;
  if (Array.isArray(data)) return data;
  return data?.results || [];
};

export default function MajorCourses() {
  const { majorId } = useParams<{ majorId: string }>();
  const navigate = useNavigate();
  const { user, tenant } = useAuth();
  const queryClient = useQueryClient();
  const headers = getAuthHeaders(user) as Record<string, string>;
  const [form] = Form.useForm();
  const { canEdit } = useEditPermission();

  const [modalVisible, setModalVisible] = useState(false);
  const [editingCourse, setEditingCourse] = useState<MajorCourse | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  // 获取微专业详情
  const { data: major, isLoading: majorLoading } = useQuery({
    queryKey: ["micro-major-for-courses", majorId, tenant],
    queryFn: async () => {
      const result = await getPublicMicroMajor({
        tenant: tenant!,
        input: { id: majorId! },
        fields: ["id", "name", "code", "college", "credit", "period"],
        headers,
      });
      if (!result.success) return null;
      const data = result.data as any;
      return Array.isArray(data) ? data[0] : data;
    },
    enabled: !!majorId && !!tenant,
  });

  // 获取当前微专业课程列表
  const { data: majorCourses = [], isLoading: coursesLoading } = useQuery({
    queryKey: ["major-courses", majorId, tenant],
    queryFn: async () => {
      const result = await listMajorCoursesByMajor({
        tenant: tenant!,
        input: { majorId: majorId! },
        fields: [
          "id",
          "majorId",
          "courseId",
          "courseType",
          "supportRole",
          "sortOrder",
          "credit",
          "period",
          "description",
          { course: ["id", "title", "description"] },
        ],
        headers,
      });
      return extractArray(result);
    },
    enabled: !!majorId && !!tenant,
  });

  // 获取可选课程列表
  const { data: availableCourses = [] } = useQuery({
    queryKey: ["available-courses-for-major", tenant, majorId],
    queryFn: async () => {
      const result = await listCourses({
        tenant: tenant!,
        fields: ["id", "title", "description"],
        page: { limit: 500 },
        headers,
      });
      return extractArrayData(result) as Course[];
    },
    enabled: !!tenant,
  });

  // 已关联的课程 ID
  const linkedCourseIds = useMemo(
    () => new Set(majorCourses.map((mc) => mc.courseId)),
    [majorCourses]
  );

  // 可选的课程（排除已关联的）
  const selectableCourses = useMemo(
    () => availableCourses.filter((c) => !linkedCourseIds.has(c.id)),
    [availableCourses, linkedCourseIds]
  );

  // 创建课程关联
  const createMutation = useMutation({
    mutationFn: async (values: any) => {
      return createMajorCourse({
        tenant: tenant!,
        input: {
          majorId: majorId!,
          courseId: values.courseId,
          courseType: values.courseType || "required",
          supportRole: values.supportRole || "core",
          sortOrder: values.sortOrder || 0,
          credit: values.credit,
          period: values.period,
          description: values.description,
        },
        fields: ["id", "majorId", "courseId", "courseType", "supportRole", "sortOrder", "credit"],
        headers,
      });
    },
    onSuccess: (result) => {
      if (result.success) {
        message.success("添加成功");
        queryClient.invalidateQueries({ queryKey: ["major-courses"] });
        setModalVisible(false);
        form.resetFields();
      } else {
        message.error(result.errors?.[0]?.message || "添加失败");
      }
    },
  });

  // 更新课程关联
  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: any }) => {
      return updateMajorCourse({
        tenant: tenant!,
        input: { id, ...values },
        fields: ["id", "majorId", "courseId", "courseType", "supportRole", "sortOrder", "credit"],
        headers,
      });
    },
    onSuccess: (result) => {
      if (result.success) {
        message.success("更新成功");
        queryClient.invalidateQueries({ queryKey: ["major-courses"] });
        setEditingCourse(null);
      } else {
        message.error(result.errors?.[0]?.message || "更新失败");
      }
    },
  });

  // 删除课程关联
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return deleteMajorCourse({
        tenant: tenant!,
        input: { id },
        fields: ["id"],
        headers,
      });
    },
    onSuccess: (result) => {
      if (result.success) {
        message.success("删除成功");
        queryClient.invalidateQueries({ queryKey: ["major-courses"] });
      } else {
        message.error(result.errors?.[0]?.message || "删除失败");
      }
    },
  });

  // 批量替换课程
  const replaceMutation = useMutation({
    mutationFn: async (courses: any[]) => {
      return replaceMajorCourses({
        tenant: tenant!,
        input: {
          majorId: majorId!,
          courses: courses.map((c, idx) => ({
            courseId: c.courseId,
            courseType: c.courseType,
            supportRole: c.supportRole,
            sortOrder: c.sortOrder ?? idx,
            credit: c.credit,
            period: c.period,
            description: c.description,
          })),
        },
        headers,
      });
    },
    onSuccess: (result) => {
      if (result.success) {
        message.success("保存成功");
        queryClient.invalidateQueries({ queryKey: ["major-courses"] });
      } else {
        message.error(result.errors?.[0]?.message || "保存失败");
      }
    },
  });

  const handleAddCourse = () => {
    setEditingCourse(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEditCourse = (course: MajorCourse) => {
    setEditingCourse(course);
    form.setFieldsValue({
      courseId: course.courseId,
      courseType: course.courseType,
      supportRole: course.supportRole,
      sortOrder: course.sortOrder,
      credit: course.credit,
      period: course.period,
      description: course.description,
    });
    setModalVisible(true);
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      if (editingCourse) {
        updateMutation.mutate({ id: editingCourse.id, values });
      } else {
        createMutation.mutate(values);
      }
    } catch (err) {
      // 表单验证失败
    }
  };


  if (majorLoading) {
    return (
      <div className="major-courses-page">
        <div className="loading">
          <Spin size="large" />
          <Text>加载中...</Text>
        </div>
      </div>
    );
  }

  if (!major) {
    return (
      <div className="major-courses-page">
        <Empty description="微专业不存在" />
      </div>
    );
  }

  return (
    <div className="major-courses-page">
      <Card className="page-header">
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={4} style={{ margin: 0 }}>
              {major.name || "微专业"} - 课程配置
            </Title>
            <Text type="secondary">
              {major.college && `${major.college} | `}
              {major.credit && `${major.credit} 学分 | `}
              {major.period && `${major.period} 学时`}
            </Text>
          </Col>
          <Col>
            <Space>
              <Button onClick={() => navigate(-1)}>返回</Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleAddCourse}
                style={canEdit ? undefined : { display: "none" }}
              >
                添加课程
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card className="courses-list" title={`课程列表 (${majorCourses.length})`}>
        {coursesLoading ? (
          <div className="loading">
            <Spin />
          </div>
        ) : majorCourses.length === 0 ? (
          <Empty description="暂无课程，请添加" />
        ) : (
          <List
            itemLayout="horizontal"
            dataSource={majorCourses}
            renderItem={(item, index) => (
              <List.Item
                actions={[
                  <ReadonlyActionButton
                    key="edit"
                    type="text"
                    icon={<EditOutlined />}
                    onClick={() => handleEditCourse(item)}
                  />,
                  <Popconfirm
                    key="delete"
                    title="确认删除"
                    description="删除后学生将无法通过此微专业访问该课程"
                    onConfirm={() => deleteMutation.mutate(item.id)}
                    okText="确认"
                    cancelText="取消"
                  >
                    <ReadonlyActionButton type="text" danger icon={<DeleteOutlined />} />
                  </Popconfirm>,
                ]}
              >
                <List.Item.Meta
                  avatar={
                    <div className="course-index">
                      <TeamOutlined />
                      <span>{index + 1}</span>
                    </div>
                  }
                  title={
                    <Space>
                      <Tag color={item.courseType === "required" ? "blue" : "green"}>
                        {item.courseType === "required" ? "必修" : "选修"}
                      </Tag>
                      <Tag color="purple">
                        {item.supportRole === "core"
                          ? "核心"
                          : item.supportRole === "supporting"
                          ? "支撑"
                          : "实践"}
                      </Tag>
                      <Text strong>{item.course?.title || "课程"}</Text>
                    </Space>
                  }
                  description={
                    <Space>
                      {item.credit && <span>{item.credit} 学分</span>}
                      {item.period && <span>{item.period} 学时</span>}
                      {item.description && (
                        <Text type="secondary">{item.description}</Text>
                      )}
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>

      <Modal
        title={editingCourse ? "编辑课程" : "添加课程"}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        okText="确定"
        cancelText="取消"
        confirmLoading={createMutation.isPending || updateMutation.isPending}
      >
        <Form form={form} layout="vertical">
          {editingCourse ? (
            <Form.Item label="课程">
              <Input value={editingCourse.course?.title || "课程"} disabled />
            </Form.Item>
          ) : (
            <Form.Item
              name="courseId"
              label="选择课程"
              rules={[{ required: true, message: "请选择课程" }]}
            >
              <Select
                showSearch
                placeholder="请选择课程"
                optionFilterProp="label"
                options={selectableCourses.map((c) => ({
                  value: c.id,
                  label: c.title,
                }))}
              />
            </Form.Item>
          )}

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="courseType" label="课程类型" initialValue="required">
                <Select options={COURSE_TYPE_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="supportRole" label="支撑角色" initialValue="core">
                <Select options={SUPPORT_ROLE_OPTIONS} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="credit" label="学分">
            <InputNumber min={0} step={0.5} style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item name="description" label="备注">
            <Input.TextArea rows={2} placeholder="可选备注" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}