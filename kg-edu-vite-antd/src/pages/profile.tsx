import { useMemo, useRef, useState } from "react";
import {
  Avatar,
  Button,
  Col,
  Divider,
  Form,
  Input,
  Modal,
  Row,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from "antd";
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CameraOutlined,
  EyeOutlined,
  EyeTwoTone,
  LockOutlined,
  LogoutOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/auth-context";
import { useBranding } from "@/hooks/use-branding";
import GlobalFooter from "@/components/layout/global-footer";
import { getCurrentTenant, setCurrentTenant } from "@/lib/tenant";
import { getAuthHeaders } from "@/lib/auth";
import { changePassword, updateUser, myCourses, myMicroMajorEnrollments } from "@/lib/ash_rpc";
import { extractArrayData } from "@/utils/api-helpers";
import { uploadFile } from "@/lib/oss-upload";
import { AppPage, ProtoCard, PageScopeProvider } from "@/components/proto";

const { Text } = Typography;

const getRoleLabel = (role?: string) => {
  switch (role) {
    case "super_admin": return "超级管理员";
    case "admin": return "管理员";
    case "teacher": return "教师";
    case "user": return "学生";
    default: return role || "-";
  }
};

/**
 * 个人中心 —— 首页 / 课程 / 微专业 / 模板页 各种角色的公共个人资料页。
 * 学生端、教师端、管理端均复用该组件（渲染在各端布局的工作区内）。
 */
export default function ProfilePage() {
  const { user, tenant, logout, updateAvatarUrl, refreshCurrentUser } = useAuth();
  const currentTenant = getCurrentTenant();
  const tenantId = currentTenant?.schemaName || currentTenant?.id || tenant;
  const [form] = Form.useForm();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [coursesExpanded, setCoursesExpanded] = useState(false);
  const [majorsExpanded, setMajorsExpanded] = useState(false);
  const [passwordForm] = Form.useForm();

  const info = (user as any) || {};
  const isStudent = info.role === "user";
  const navigate = useNavigate();

  // 学生已选课程 / 微专业
  const { data: enrolledCourses = [] } = useQuery({
    queryKey: ["profile-my-courses", tenantId, info.id],
    queryFn: async () => {
      const res = await myCourses({
        tenant: tenantId,
        fields: ["id", "title", "major"],
        headers: getAuthHeaders(user),
      });
      return res.success ? extractArrayData<{ id: string; title?: string; major?: string }>(res) : [];
    },
    enabled: !!tenantId && !!user,
  });

  const { data: enrolledMajors = [] } = useQuery({
    queryKey: ["profile-my-micro-majors", tenantId, info.id],
    queryFn: async () => {
      const res = await myMicroMajorEnrollments({
        tenant: tenantId,
        fields: ["id", "status", { microMajor: ["id", "name", "intro"] }] as any,
        headers: getAuthHeaders(user),
      });
      return res.success
        ? extractArrayData<{ id: string; status?: string; microMajor?: { id: string; name?: string; intro?: string } }>(res)
        : [];
    },
    enabled: !!tenantId && !!user && isStudent,
  });

  const enterCourse = (courseId: string) => {
    if (tenantId) {
      setCurrentTenant({ id: tenantId, name: currentTenant?.name || tenantId, schemaName: tenantId });
    }
    navigate(`/dashboard/overview?courseId=${courseId}&tenant=${tenantId}`);
  };

  const enterMajor = (majorId: string) => {
    navigate(`/micro-majors/${tenantId}/${majorId}`);
  };

  const initialValues = useMemo(
    () => ({
      name: info.name || "",
      phone: info.phone || "",
      email: info.email || "",
      school: info.school || "",
      colledge: info.colledge || "",
      major: info.major || "",
      jobTitle: info.jobTitle || "",
      bio: info.bio || "",
    }),
    [info.name, info.phone, info.email, info.school, info.colledge, info.major, info.jobTitle, info.bio]
  );

  const updateMutation = useMutation({
    mutationFn: (values: Record<string, string>) =>
      updateUser({
        tenant: tenantId,
        primaryKey: info.id,
        input: {
          name: values.name?.trim() || undefined,
          phone: values.phone?.trim() || undefined,
          email: values.email?.trim() || undefined,
          bio: values.bio?.trim() || undefined,
        },
        fields: ["id"],
        headers: getAuthHeaders(user),
      }),
    onSuccess: (result: any) => {
      if (result?.success === false) {
        const msg = result?.errors?.[0]?.message || "保存失败";
        message.error(msg);
        return;
      }
      message.success("个人资料已保存");
      refreshCurrentUser();
    },
    onError: (error: any) => {
      message.error(error?.message || "保存失败");
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: (values: any) =>
      changePassword({
        tenant: tenantId,
        primaryKey: info.id,
        input: {
          currentPassword: values.currentPassword,
          password: values.newPassword,
          passwordConfirmation: values.confirmPassword,
        },
        fields: ["id"],
        headers: getAuthHeaders(user),
      }),
    onSuccess: () => {
      message.success("密码修改成功");
      setPasswordModalOpen(false);
      passwordForm.resetFields();
    },
    onError: (error: any) => {
      const raw = error?.message || "";
      if (raw.includes("current password") || raw.includes("invalid")) {
        message.error("当前密码不正确");
      } else if (raw.includes("match")) {
        message.error("新密码与确认密码不匹配");
      } else {
        message.error(raw || "密码修改失败");
      }
    },
  });

  const handleAvatarUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      message.error("只能上传图片文件");
      return;
    }
    if (file.size / 1024 / 1024 > 5) {
      message.error("图片大小不能超过 5MB");
      return;
    }
    setUploadingAvatar(true);
    try {
      const result = await uploadFile(file);
      const res: any = await updateUser({
        tenant: tenantId,
        primaryKey: info.id,
        input: { avatarUrl: result.url },
        fields: ["id", "avatarUrl"],
        headers: getAuthHeaders(user),
      });
      if (res?.success === false) {
        message.error(res?.errors?.[0]?.message || "头像保存失败");
        return;
      }
      updateAvatarUrl(result.url);
      await refreshCurrentUser();
      message.success("头像修改成功");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "头像上传失败");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!tenantId) {
      message.error("缺少租户信息，无法保存");
      return;
    }
    try {
      const values = await form.validateFields();
      updateMutation.mutate(values);
    } catch {
      /* 校验失败 */
    }
  };

  const handlePasswordOk = async () => {
    try {
      const values = await passwordForm.validateFields();
      changePasswordMutation.mutate(values);
    } catch {
      /* 校验失败 */
    }
  };

  return (
    <AppPage title="个人中心" description="维护你的个人资料、头像与账号安全">
      {isStudent && (
        <div className="profile-learn-columns" style={{ marginBottom: 24 }}>
          <ProtoCard title="我的课程" extra={<Text type="secondary">点击进入</Text>}>
            {enrolledCourses.length > 0 ? (
              <>
                {(coursesExpanded ? enrolledCourses : enrolledCourses.slice(0, 3)).map((course) => (
                  <div
                    key={course.id}
                    className="pu-item"
                    style={{ cursor: "pointer" }}
                    onClick={() => enterCourse(course.id)}
                  >
                    <div className="pu-item__body">
                      <h3>{course.title || "未命名课程"}</h3>
                      {course.major && <p>{course.major}</p>}
                    </div>
                    <ArrowRightOutlined style={{ color: "#94a3b8", flexShrink: 0 }} />
                  </div>
                ))}
                {enrolledCourses.length > 3 && (
                  <button type="button" className="profile-learn-more" onClick={() => setCoursesExpanded((v) => !v)}>
                    {coursesExpanded ? "收起" : `展开全部 ${enrolledCourses.length} 门课程`}
                  </button>
                )}
              </>
            ) : (
              <Text type="secondary">暂无选课</Text>
            )}
          </ProtoCard>

          <ProtoCard title="我的微专业" extra={<Text type="secondary">点击进入</Text>}>
            {enrolledMajors.length > 0 ? (
              <>
                {(majorsExpanded ? enrolledMajors : enrolledMajors.slice(0, 3)).map((item) => (
                  <div
                    key={item.id}
                    className="pu-item"
                    style={{ cursor: "pointer" }}
                    onClick={() => item.microMajor?.id && enterMajor(item.microMajor.id)}
                  >
                    <div className="pu-item__body">
                      <h3>{item.microMajor?.name || "微专业"}</h3>
                      <p>{item.status === "completed" ? "已完成" : item.status === "active" ? "学习中" : "待审核"}</p>
                    </div>
                    <ArrowRightOutlined style={{ color: "#94a3b8", flexShrink: 0 }} />
                  </div>
                ))}
                {enrolledMajors.length > 3 && (
                  <button type="button" className="profile-learn-more" onClick={() => setMajorsExpanded((v) => !v)}>
                    {majorsExpanded ? "收起" : `展开全部 ${enrolledMajors.length} 个微专业`}
                  </button>
                )}
              </>
            ) : (
              <Text type="secondary">暂无微专业</Text>
            )}
          </ProtoCard>
        </div>
      )}

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={15}>
          <ProtoCard title="基本资料">
            <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 26 }}>
              <div
                style={{ position: "relative", display: "inline-block", cursor: "pointer" }}
                onClick={() => avatarInputRef.current?.click()}
              >
                <Spin spinning={uploadingAvatar}>
                  <Avatar
                    size={76}
                    src={info.avatarUrl}
                    icon={!info.avatarUrl ? <UserOutlined /> : undefined}
                    style={{ background: info.avatarUrl ? "transparent" : "#edf2ff", color: "var(--pu-blue)" }}
                  >
                    {!info.avatarUrl && (info.name?.charAt(0)?.toUpperCase() || "U")}
                  </Avatar>
                </Spin>
                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    right: 0,
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    background: "#fff",
                    border: "1px solid var(--pu-line)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                  }}
                >
                  <CameraOutlined style={{ fontSize: 13, color: "var(--pu-blue)" }} />
                </div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleAvatarUpload(file);
                    e.target.value = "";
                  }}
                />
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 650, color: "var(--pu-ink)" }}>
                  {info.name || "未设置姓名"}
                </div>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  点击头像可上传新的图片（支持 JPG/PNG，≤5MB）
                </Text>
              </div>
            </div>

            <Form form={form} layout="vertical" initialValues={initialValues}>
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item name="name" label="姓名">
                    <Input placeholder="请输入姓名" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="用户名 / 学号 / 工号">
                    <Input value={info.memberId || "-"} disabled />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="phone" label="手机号">
                    <Input placeholder="请输入手机号" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="email" label="邮箱">
                    <Input placeholder="请输入邮箱" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="school" label="学校">
                    <Input placeholder="-" disabled />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="colledge" label="学院">
                    <Input placeholder="-" disabled />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="major" label="专业">
                    <Input placeholder="-" disabled />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="jobTitle" label="职位">
                    <Input placeholder="-" disabled />
                  </Form.Item>
                </Col>
                <Col xs={24}>
                  <Form.Item name="bio" label="个人简介">
                    <Input.TextArea rows={4} placeholder="介绍一下自己吧" maxLength={200} showCount />
                  </Form.Item>
                </Col>
              </Row>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
                <Button onClick={() => form.resetFields()}>重置</Button>
                <Button type="primary" loading={updateMutation.isPending} onClick={handleSave}>
                  保存
                </Button>
              </div>
            </Form>
          </ProtoCard>
        </Col>

        <Col xs={24} lg={9}>
          <ProtoCard title="账号信息">
            <div className="pu-info">
              <div className="pu-info__row">
                <span className="pu-info__label">角色</span>
                <span className="pu-info__value">
                  <Tag color="blue">{getRoleLabel(info.role)}</Tag>
                </span>
              </div>
              <div className="pu-info__row">
                <span className="pu-info__label">所属机构</span>
                <span className="pu-info__value">{currentTenant?.name || currentTenant?.schemaName || "-"}</span>
              </div>
              <div className="pu-info__row">
                <span className="pu-info__label">用户名</span>
                <span className="pu-info__value">{info.memberId || "-"}</span>
              </div>
              <div className="pu-info__row">
                <span className="pu-info__label">邮箱</span>
                <span className="pu-info__value">{info.email || "-"}</span>
              </div>
            </div>

            <Divider style={{ margin: "22px 0" }} />

            <Space direction="vertical" style={{ width: "100%" }} size={10}>
              <Button block icon={<LockOutlined />} onClick={() => setPasswordModalOpen(true)} style={{ height: 42 }}>
                修改密码
              </Button>
              <Button block danger icon={<LogoutOutlined />} onClick={logout} style={{ height: 42 }}>
                退出登录
              </Button>
            </Space>
          </ProtoCard>
        </Col>
      </Row>

      <Modal
        title="修改密码"
        open={passwordModalOpen}
        onCancel={() => {
          setPasswordModalOpen(false);
          passwordForm.resetFields();
        }}
        onOk={handlePasswordOk}
        confirmLoading={changePasswordMutation.isPending}
        okText="确认修改"
        cancelText="取消"
      >
        <Form form={passwordForm} layout="vertical">
          <Form.Item name="currentPassword" label="当前密码" rules={[{ required: true, message: "请输入当前密码" }]}>
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="请输入当前密码"
              iconRender={(visible) => (visible ? <EyeOutlined /> : <EyeTwoTone />)}
            />
          </Form.Item>
          <Form.Item
            name="newPassword"
            label="新密码"
            rules={[{ required: true, message: "请输入新密码" }, { min: 6, message: "密码至少6位" }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="请输入新密码（至少6位）"
              iconRender={(visible) => (visible ? <EyeOutlined /> : <EyeTwoTone />)}
            />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="确认新密码"
            dependencies={["newPassword"]}
            rules={[
              { required: true, message: "请确认新密码" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("newPassword") === value) return Promise.resolve();
                  return Promise.reject(new Error("两次输入的密码不一致"));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="请再次输入新密码"
              iconRender={(visible) => (visible ? <EyeOutlined /> : <EyeTwoTone />)}
            />
          </Form.Item>
        </Form>
      </Modal>
    </AppPage>
  );
}

/**
 * 学生端独立个人中心：不显示左侧课程导航（未选课时无法确定当前课程），
 * 仅展示个人中心内容 + 返回上一页按钮。
 */
export function StandaloneProfile() {
  const navigate = useNavigate();
  const branding = useBranding();

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--pu-bg, #f5f7fb)",
      }}
    >
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          background: "#fff",
          borderBottom: "1px solid var(--pu-line, #e3e9f1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          minHeight: 60,
        }}
      >
        <div
          style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
          onClick={() => navigate("/dashboard/overview")}
        >
          <img src={branding.logo_dark} alt={branding.app_name} style={{ height: 32, objectFit: "contain" }} />
          <span style={{ fontSize: 18, fontWeight: 700, color: "var(--pu-ink)" }}>
            {branding.app_title}
          </span>
        </div>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
          返回
        </Button>
      </div>

      <div style={{ flex: 1 }}>
        <PageScopeProvider label="学生学习空间">
          <ProfilePage />
        </PageScopeProvider>
      </div>

      <GlobalFooter />
    </div>
  );
}
