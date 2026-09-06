import React, { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Button, Card, Col, Descriptions, Empty, Form, Grid, Input, InputNumber, List,
  message, Modal, Row, Select, Space, Spin, Tag, Typography,
} from "antd";
import {
  PlusOutlined, ArrowLeftOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { extractArrayData } from "@/utils/api-helpers";
import {
  getMicroMajor, listCoursesByMicroMajor, listCourses,
  createMicroMajorCourse, updateMicroMajorCourse, deleteMicroMajorCourse,
} from "@/lib/ash_rpc";
import { useEditPermission } from "@/hooks/use-edit-permission";

const { Title, Text } = Typography;

const COURSE_TYPE_OPTIONS = [
  { value: "required", label: "必修" },
  { value: "elective", label: "选修" },
];

interface MicroMajorCourse {
  id: string;
  microMajorId: string;
  courseId: string;
  courseType: string;
  semester?: string | null;
  sortOrder: number;
  credit?: number | null;
  period?: number | null;
  description?: string | null;
  course?: { id: string; title: string; description?: string | null };
}

const extractArray = (result: any): any[] => {
  if (!result?.success) return [];
  const data = result.data;
  if (Array.isArray(data)) return data;
  return data?.results || [];
};

export default function MicroMajorCourses() {
  const { microMajorId } = useParams<{ microMajorId: string }>();
  const navigate = useNavigate();
  const { user, tenant } = useAuth();
  const queryClient = useQueryClient();
  const headers = getAuthHeaders(user) as Record<string, string>;
  const [form] = Form.useForm();
  const { canEdit } = useEditPermission();
  const bp = Grid.useBreakpoint();
  const isMobile = !bp.md;

  const [modalVisible, setModalVisible] = useState(false);
  const [editingCourse, setEditingCourse] = useState<MicroMajorCourse | null>(null);

  // 获取微专业详情
  const { data: microMajor, isLoading: majorLoading } = useQuery({
    queryKey: ["micro-major-detail", microMajorId, tenant],
    queryFn: async () => {
      const result = await getMicroMajor({
        tenant: tenant!,
        input: { id: microMajorId! },
        fields: ["id", "name", "status", "learningCycle", "intro"],
        headers,
      });
      if (!result.success) return null;
      const data = result.data as any;
      return Array.isArray(data) ? data[0] : data;
    },
    enabled: !!microMajorId && !!tenant,
  });

  // 获取微专业课程列表
  const { data: mmCourses = [], isLoading: coursesLoading } = useQuery({
    queryKey: ["micro-major-courses", microMajorId, tenant],
    queryFn: async () => {
      const result = await listCoursesByMicroMajor({
        tenant: tenant!,
        input: { microMajorId: microMajorId! },
        fields: [
          "id", "microMajorId", "courseId", "courseType", "semester",
          "sortOrder", "credit", "period", "description",
          { course: ["id", "title", "description"] },
        ],
        headers,
      });
      return extractArray(result) as MicroMajorCourse[];
    },
    enabled: !!microMajorId && !!tenant,
  });

  // 获取可选课程
  const { data: availableCourses = [] } = useQuery({
    queryKey: ["available-courses-mm", tenant],
    queryFn: async () => {
      const result = await listCourses({
        tenant: tenant!,
        fields: ["id", "title", "description"],
        page: { limit: 500 },
        headers,
      });
      return extractArrayData(result) as { id: string; title: string; description?: string }[];
    },
    enabled: !!tenant,
  });

  const linkedCourseIds = useMemo(() => new Set(mmCourses.map((mc) => mc.courseId)), [mmCourses]);
  const selectableCourses = useMemo(
    () => availableCourses.filter((c) => !linkedCourseIds.has(c.id)),
    [availableCourses, linkedCourseIds],
  );

  // 创建
  const createMutation = useMutation({
    mutationFn: async (values: any) =>
      createMicroMajorCourse({
        tenant: tenant!,
        input: {
          microMajorId: microMajorId!,
          courseId: values.courseId,
          courseType: values.courseType || "required",
          semester: values.semester || null,
          sortOrder: values.sortOrder || 0,
          credit: values.credit || null,
          period: values.period || null,
          description: values.description || null,
        },
        fields: ["id"],
        headers,
      }),
    onSuccess: (result) => {
      if (result.success) {
        message.success("添加成功");
        queryClient.invalidateQueries({ queryKey: ["micro-major-courses"] });
        setModalVisible(false);
        form.resetFields();
      } else {
        message.error((result as any).errors?.[0]?.message || "添加失败");
      }
    },
  });

  // 更新
  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: any }) =>
      updateMicroMajorCourse({
        tenant: tenant!,
        primaryKey: id,
        input: values,
        fields: ["id"],
        headers,
      }),
    onSuccess: (result) => {
      if (result.success) {
        message.success("更新成功");
        queryClient.invalidateQueries({ queryKey: ["micro-major-courses"] });
        setEditingCourse(null);
        setModalVisible(false);
      } else {
        message.error((result as any).errors?.[0]?.message || "更新失败");
      }
    },
  });

  // 删除
  const deleteMutation = useMutation({
    mutationFn: async (id: string) =>
      deleteMicroMajorCourse({ tenant: tenant!, primaryKey: id, headers }),
    onSuccess: (result) => {
      if (result.success) {
        message.success("删除成功");
        queryClient.invalidateQueries({ queryKey: ["micro-major-courses"] });
      } else {
        message.error((result as any).errors?.[0]?.message || "删除失败");
      }
    },
  });

  const handleAddCourse = () => {
    setEditingCourse(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEditCourse = (course: MicroMajorCourse) => {
    setEditingCourse(course);
    form.setFieldsValue({
      courseType: course.courseType,
      semester: course.semester,
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
    } catch {}
  };

  if (majorLoading) {
    return (
      <div style={{ padding: 24, textAlign: "center", marginTop: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!microMajor) {
    return (
      <div className="micro-major-courses-wrap" style={{ padding: 24 }}>
<style>{`@media(max-width:768px){.micro-major-courses-wrap{padding:12px!important}.micro-major-courses-wrap .ant-table-cell{padding:6px 4px!important}}`}</style>
        <Empty description="微专业不存在" />
      </div>
    );
  }

  return (
    <div className="micro-major-courses-wrap" style={{ padding: 24 }}>
<style>{`@media(max-width:768px){.micro-major-courses-wrap{padding:12px!important}.micro-major-courses-wrap .ant-table-cell{padding:6px 4px!important}}`}</style>
      <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Button
          icon={<ArrowLeftOutlined />}
          size={isMobile ? "small" : "middle"}
          onClick={() => navigate("/teacher/dashboard/micro-major-list")}
        >
          返回
        </Button>
      </div>

      <Card style={{ marginBottom: 12 }} bodyStyle={isMobile ? { padding: 16 } : undefined}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 6 : 8, minWidth: 0, flex: 1 }}>
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate("/micro-major/dashboard")}
              style={{ color: "#1890ff", padding: "4px 6px", fontSize: isMobile ? 14 : 16, flexShrink: 0 }}
            />
            <div style={{ minWidth: 0 }}>
              <Title level={isMobile ? 5 : 4} style={{ margin: 0, fontSize: isMobile ? 15 : undefined }}>
                {microMajor.name} - 课程配置
              </Title>
              <Text type="secondary" style={{ fontSize: isMobile ? 12 : 14 }}>
                {microMajor.learningCycle && `学习周期: ${microMajor.learningCycle}`}
              </Text>
            </div>
          </div>
          <Button type="primary" icon={<PlusOutlined />} size={isMobile ? "small" : "middle"} onClick={handleAddCourse} style={canEdit ? undefined : { display: "none" }}>
            {isMobile ? "添加" : "添加课程"}
          </Button>
        </div>
      </Card>

      <Card
        title={<span style={{ fontSize: isMobile ? 14 : 16 }}>{`课程列表 (${mmCourses.length})`}</span>}
        bodyStyle={isMobile ? { padding: 12 } : undefined}
      >
        {coursesLoading ? (
          <div style={{ textAlign: "center", padding: 40 }}><Spin /></div>
        ) : mmCourses.length === 0 ? (
          <Empty description="暂无课程，请点击添加" />
        ) : (
          <List
            itemLayout={isMobile ? "vertical" : "horizontal"}
            size={isMobile ? "small" : "default"}
            dataSource={mmCourses}
            renderItem={(item, index) => (
              <List.Item
                style={isMobile ? { padding: "8px 0" } : undefined}
                actions={[]}
              >
                <List.Item.Meta
                  avatar={isMobile ? null : (
                    <div style={{
                      width: 40, height: 40, borderRadius: 8, background: "#f0f5ff",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#1890ff", fontWeight: 600,
                    }}>
                      {index + 1}
                    </div>
                  )}
                  title={
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <Tag color={item.courseType === "required" ? "blue" : "green"} style={{ fontSize: isMobile ? 11 : 13, padding: isMobile ? "0 6px" : "0 8px", lineHeight: isMobile ? "20px" : undefined }}>
                        {item.courseType === "required" ? "必修" : "选修"}
                      </Tag>
                      {item.semester && <Tag color="orange" style={{ fontSize: isMobile ? 11 : 13 }}>{item.semester}</Tag>}
                      <Text strong style={{ fontSize: isMobile ? 14 : 16 }}>{item.course?.title || "课程"}</Text>
                    </div>
                  }
                  description={isMobile ? null : (
                    <Space size={16}>
                      {item.credit != null && <span>{item.credit} 学分</span>}
                      {item.period != null && <span>{item.period} 学时</span>}
                      {item.description && <Text type="secondary">{item.description}</Text>}
                    </Space>
                  )}
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
        onCancel={() => { setModalVisible(false); form.resetFields(); }}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        width={isMobile ? "95%" : 560}
        destroyOnClose
      >
        <Form form={form} layout="vertical" size={isMobile ? "small" : "middle"}>
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

          <Row gutter={isMobile ? 8 : 16}>
            <Col span={isMobile ? 24 : 12}>
              <Form.Item name="courseType" label="课程类型" initialValue="required">
                <Select options={COURSE_TYPE_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={isMobile ? 24 : 12}>
              <Form.Item name="semester" label="学期">
                <Input placeholder="如：第一学期" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={isMobile ? 8 : 16}>
            <Col span={isMobile ? 24 : 12}>
              <Form.Item name="credit" label="学分">
                <InputNumber min={0} step={0.5} style={{ width: "100%" }} placeholder="课程学分" />
              </Form.Item>
            </Col>
            <Col span={isMobile ? 24 : 12}>
              <Form.Item name="period" label="学时">
                <InputNumber min={0} style={{ width: "100%" }} placeholder="课程学时" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="备注">
            <Input.TextArea rows={2} placeholder="可选备注" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
