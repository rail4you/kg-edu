import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Button, Card, Col, Empty, Form, Input, Row, Select, Space, Spin, Typography, message, Tag, Upload, Progress,
} from "antd";
import { ArrowLeftOutlined, SaveOutlined, UploadOutlined, SendOutlined } from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { extractArrayData } from "@/utils/api-helpers";
import { getSTSToken, uploadFileToOSS } from "@/lib/oss-upload";
import {
  getMicroMajor, updateMicroMajor, listUsers, publishMicroMajor,
} from "@/lib/ash_rpc";
import { useEditPermission } from "@/hooks/use-edit-permission";

const { Title, Text } = Typography;

const STATUS_OPTIONS = [
  { value: "draft", label: "草稿" },
  { value: "active", label: "已发布" },
  { value: "archived", label: "已归档" },
];

export default function MicroMajorEdit() {
  const { microMajorId } = useParams<{ microMajorId: string }>();
  const navigate = useNavigate();
  const { user, tenant } = useAuth();
  const queryClient = useQueryClient();
  const headers = getAuthHeaders(user) as Record<string, string>;
  const [form] = Form.useForm();
  const { canEdit } = useEditPermission();
  const [initialized, setInitialized] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageProgress, setImageProgress] = useState(0);

  // 获取教师列表
  const { data: teachers = [] } = useQuery({
    queryKey: ["teachers-mm-edit", tenant],
    queryFn: async () => {
      const result = await listUsers({
        tenant: tenant!,
        fields: ["id", "name", "jobTitle"],
        filter: { role: { eq: "teacher" } },
        page: { limit: 500 },
        headers,
      });
      return extractArrayData(result);
    },
    enabled: !!tenant,
  });

  const teacherOptions = teachers.map((t: any) => ({
    value: t.id,
    label: `${t.name || "未命名"}${t.jobTitle ? ` (${t.jobTitle})` : ""}`,
  }));

  // 获取微专业详情
  const { data: microMajor, isLoading } = useQuery({
    queryKey: ["micro-major-edit", microMajorId, tenant],
    queryFn: async () => {
      const result = await getMicroMajor({
        tenant: tenant!,
        input: { id: microMajorId! },
        fields: [
          "id", "name", "projectBackground", "knowledgeObjective", "abilityObjective",
          "qualityObjective", "projectFeatures", "learningCycle", "assessmentMethod",
          "tuitionFee", "coverUrl", "intro", "responsibleTeacherId", "consultantTeacherId",
          "status", "sortOrder",
        ],
        headers,
      });
      if (!result.success) return null;
      const data = result.data as any;
      return Array.isArray(data) ? data[0] : data;
    },
    enabled: !!microMajorId && !!tenant,
  });

  // 初始化表单
  useEffect(() => {
    if (microMajor && !initialized) {
      form.setFieldsValue({
        name: microMajor.name || "",
        projectBackground: microMajor.projectBackground || "",
        knowledgeObjective: microMajor.knowledgeObjective || "",
        abilityObjective: microMajor.abilityObjective || "",
        qualityObjective: microMajor.qualityObjective || "",
        projectFeatures: microMajor.projectFeatures || "",
        learningCycle: microMajor.learningCycle || "",
        assessmentMethod: microMajor.assessmentMethod || "",
        tuitionFee: microMajor.tuitionFee || "",
        coverUrl: microMajor.coverUrl || "",
        intro: microMajor.intro || "",
        responsibleTeacherId: microMajor.responsibleTeacherId || undefined,
        consultantTeacherId: microMajor.consultantTeacherId || undefined,
        status: microMajor.status || "draft",
        sortOrder: microMajor.sortOrder || 0,
      });
      setInitialized(true);
    }
  }, [microMajor, form, initialized]);

  // 更新
  const updateMutation = useMutation({
    mutationFn: async (values: any) =>
      updateMicroMajor({
        tenant: tenant!,
        primaryKey: microMajorId!,
        input: {
          name: values.name,
          projectBackground: values.projectBackground || null,
          knowledgeObjective: values.knowledgeObjective || null,
          abilityObjective: values.abilityObjective || null,
          qualityObjective: values.qualityObjective || null,
          projectFeatures: values.projectFeatures || null,
          learningCycle: values.learningCycle || null,
          assessmentMethod: values.assessmentMethod || null,
          tuitionFee: values.tuitionFee || null,
          coverUrl: values.coverUrl || null,
          intro: values.intro || null,
          responsibleTeacherId: values.responsibleTeacherId || null,
          consultantTeacherId: values.consultantTeacherId || null,
          status: values.status || "draft",
          sortOrder: values.sortOrder || 0,
        },
        fields: ["id"],
        headers,
      }),
    onSuccess: (result) => {
      if (result.success) {
        message.success("保存成功");
        setInitialized(false);
        queryClient.invalidateQueries({ queryKey: ["micro-major-edit", microMajorId] });
        queryClient.invalidateQueries({ queryKey: ["micro-majors"] });
        // 延迟关闭，返回到列表页
        setTimeout(() => navigate("/teacher/dashboard/micro-major-list"), 500);
      } else {
        message.error((result as any).errors?.[0]?.message || "保存失败");
      }
    },
  });

  // 发布
  const publishMutation = useMutation({
    mutationFn: async () =>
      publishMicroMajor({
        tenant: tenant!,
        primaryKey: microMajorId!,
        input: { status: "active" },
        fields: ["id"],
        headers,
      }),
    onSuccess: (result) => {
      if (result.success) {
        message.success("已发布");
        setInitialized(false);
        queryClient.invalidateQueries({ queryKey: ["micro-major-edit", microMajorId] });
        queryClient.invalidateQueries({ queryKey: ["micro-majors"] });
      } else {
        message.error((result as any).errors?.[0]?.message || "发布失败");
      }
    },
  });

  if (isLoading) {
    return <div style={{ padding: 24, textAlign: "center", marginTop: 80 }}><Spin size="large" /></div>;
  }
  if (!microMajor) {
    return <div className="micro-major-edit-wrap" style={{ padding: 24 }}>
<style>{`@media(max-width:768px){.micro-major-edit-wrap{padding:12px!important}.micro-major-edit-wrap .ant-table-cell{padding:6px 4px!important}}`}</style><Empty description="微专业不存在" /></div>;
  }

  return (
    <div className="micro-major-edit-wrap" style={{ padding: 24 }}>
<style>{`@media(max-width:768px){.micro-major-edit-wrap{padding:12px!important}.micro-major-edit-wrap .ant-table-cell{padding:6px 4px!important}}`}</style>
      <Button icon={<ArrowLeftOutlined />} style={{ marginBottom: 16 }}
        onClick={() => navigate("/teacher/dashboard/micro-major-list")}>
        返回微专业列表
      </Button>

      <Card>
        <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
          <Col>          <Button
            className="teacher-page-back-btn"
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/micro-major/dashboard")}
            style={{ color: "#1890ff", padding: "4px 8px", fontSize: 16 }}
          />
<Title level={4} style={{ margin: 0 }}>编辑微专业</Title></Col>
          <Col>
            <Space>
              {microMajor?.status !== "active" && (
                <Button
                  icon={<SendOutlined />}
                  onClick={() => publishMutation.mutate()}
                  loading={publishMutation.isPending}
                  style={canEdit ? undefined : { display: "none" }}
                >
                  发布
                </Button>
              )}
              {microMajor?.status === "active" && (
                <Tag color="green" style={{ fontSize: 14, padding: "4px 12px" }}>已发布</Tag>
              )}
            </Space>
          </Col>
        </Row>

        <Form form={form} layout="vertical" onFinish={(values) => updateMutation.mutate(values)}>
          {/* 基本信息 */}
          <Card type="inner" title="基本信息" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="name" label="微专业名称" rules={[{ required: true, message: "请输入名称" }]}>
                  <Input placeholder="请输入微专业名称" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="status" label="状态">
                  <Select options={STATUS_OPTIONS} />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="intro" label="简短介绍">
              <Input.TextArea rows={2} placeholder="一句话介绍微专业" />
            </Form.Item>
            <Form.Item label="封面图片">
              <Form.Item name="coverUrl" noStyle>
                <Input type="hidden" />
              </Form.Item>
              {form.getFieldValue("coverUrl") && (
                <div style={{ marginBottom: 8 }}>
                  <img
                    src={form.getFieldValue("coverUrl")}
                    alt="封面预览"
                    style={{ width: 160, height: 100, objectFit: "cover", borderRadius: 8, border: "1px solid #d9d9d9" }}
                  />
                </div>
              )}
              {imageUploading ? (
                <Progress percent={imageProgress} size="small" style={{ width: 200 }} />
              ) : (
                <Upload
                  beforeUpload={async (file) => {
                    if (file.size > 10 * 1024 * 1024) { message.error("图片不能超过10MB"); return false; }
                    if (!file.type.startsWith("image/")) { message.error("只能上传图片"); return false; }
                    setImageUploading(true);
                    setImageProgress(0);
                    try {
                      const sts = await getSTSToken(file.name, file.size, file.type);
                      const result = await uploadFileToOSS(sts, { file, onProgress: (p) => setImageProgress(Math.min(p.percent, 90)) });
                      form.setFieldValue("coverUrl", result.url);
                      setImageProgress(100);
                      message.success("封面上传成功");
                    } catch (err: any) {
                      message.error(err?.message || "上传失败");
                    } finally {
                      setImageUploading(false);
                    }
                    return false;
                  }}
                  showUploadList={false}
                  accept="image/*"
                >
                  <Button icon={<UploadOutlined />} size="small" style={canEdit ? undefined : { display: "none" }}>上传封面图片</Button>
                </Upload>
              )}
            </Form.Item>
          </Card>

          {/* 项目信息 */}
          <Card type="inner" title="项目信息" style={{ marginBottom: 16 }}>
            <Form.Item name="projectBackground" label="项目背景">
              <Input.TextArea rows={4} placeholder="介绍项目的背景和意义" />
            </Form.Item>

            <Card type="inner" title="培养目标" size="small" style={{ marginBottom: 16 }}>
              <Form.Item name="knowledgeObjective" label="知识目标">
                <Input.TextArea rows={3} placeholder="学生应掌握的知识体系" />
              </Form.Item>
              <Form.Item name="abilityObjective" label="能力目标">
                <Input.TextArea rows={3} placeholder="学生应具备的能力" />
              </Form.Item>
              <Form.Item name="qualityObjective" label="素养目标">
                <Input.TextArea rows={3} placeholder="学生应养成的素养" />
              </Form.Item>
            </Card>

            <Form.Item name="projectFeatures" label="项目特色">
              <Input.TextArea rows={3} placeholder="微专业的特色与亮点" />
            </Form.Item>
          </Card>

          {/* 学习信息 */}
          <Card type="inner" title="学习信息" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="learningCycle" label="学习周期">
                  <Input placeholder="如：一学期、6个月" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="assessmentMethod" label="考核方式">
                  <Input placeholder="如：过程性评价+终结性评价" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="tuitionFee" label="学费标准">
                  <Input placeholder="如：免费、2000元" />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          {/* 负责人 */}
          <Card type="inner" title="负责人" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="responsibleTeacherId" label="微专业负责人">
                  <Select
                    allowClear
                    placeholder="选择负责人"
                    options={teacherOptions}
                    showSearch
                    optionFilterProp="label"
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="consultantTeacherId" label="微专业顾问">
                  <Select
                    allowClear
                    placeholder="选择顾问"
                    options={teacherOptions}
                    showSearch
                    optionFilterProp="label"
                  />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          <div style={{ textAlign: "center", marginTop: 16 }}>
            <Button onClick={() => navigate("/teacher/dashboard/micro-major-list")}>返回列表</Button>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={updateMutation.isPending} style={canEdit ? undefined : { display: "none" }}>
              保存并返回列表
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  );
}
