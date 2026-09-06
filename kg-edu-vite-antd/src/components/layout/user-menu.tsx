import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Drawer,
  Avatar,
  Space,
  Typography,
  Button,
  Modal,
  Form,
  Input,
  message,
  Tag,
  Spin,
  Divider,
  List,
  Collapse,
} from "antd";
import {
  LogoutOutlined,
  LockOutlined,
  IdcardOutlined,
  PhoneOutlined,
  BankOutlined,
  BookOutlined,
  UserOutlined,
  EyeOutlined,
  EyeTwoTone,
  DownOutlined,
  UpOutlined,
  CameraOutlined,
  CloseOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { getCurrentTenant } from "@/lib/tenant";
import { getAuthHeaders } from "@/lib/auth";
import { myCourses, changePassword, updateUser } from "@/lib/ash_rpc";
import { uploadFile } from "@/lib/oss-upload";
import { themeColors } from "@/styles/theme";

const { Text, Title } = Typography;
const { Panel } = Collapse;

interface UserMenuProps {
  role: "admin" | "teacher" | "student";
  variant?: "default" | "header";
  compact?: boolean;
}

const getRoleLabel = (role?: string) => {
  switch (role) {
    case "super_admin": return "超级管理员";
    case "admin": return "管理员";
    case "teacher": return "教师";
    case "user": return "学生";
    default: return role || "-";
  }
};

const getRoleColor = (role?: string) => {
  switch (role) {
    case "super_admin":
    case "admin": return "gold";
    case "teacher": return "blue";
    case "user": return "green";
    default: return "default";
  }
};

export function UserMenu({ role, variant = "default", compact }: UserMenuProps) {
  const { user, logout, updateAvatarUrl } = useAuth();
  const currentTenant = getCurrentTenant();
  const tenantId = currentTenant?.schemaName || currentTenant?.id;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [coursesExpand, setCoursesExpand] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [form] = Form.useForm();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const { data: coursesData, isLoading: loadingCourses } = useQuery({
    queryKey: ["my-courses-menu", tenantId],
    queryFn: () =>
      myCourses({
        tenant: tenantId,
        fields: ["id", "title"],
        headers: getAuthHeaders(user),
      }),
    enabled: drawerOpen && !!tenantId && !!user,
  });

  const courses = coursesData?.success
    ? Array.isArray(coursesData.data)
      ? coursesData.data
      : (coursesData.data as any)?.results || []
    : [];

  const displayCourses = coursesExpand ? courses : courses.slice(0, 5);

  const changePasswordMutation = useMutation({
    mutationFn: (values: any) =>
      changePassword({
        tenant: tenantId,
        primaryKey: (user as any)?.id,
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
      form.resetFields();
    },
    onError: (error: any) => {
      const rawMessage = error?.message || "";
      if (rawMessage.includes("current password") || rawMessage.includes("invalid")) {
        message.error("当前密码不正确");
      } else if (rawMessage.includes("match")) {
        message.error("新密码与确认密码不匹配");
      } else {
        message.error(rawMessage || "密码修改失败");
      }
    },
  });

  const handlePasswordSubmit = async () => {
    try {
      const values = await form.validateFields();
      changePasswordMutation.mutate(values);
    } catch (error) {
      console.error("Validation failed:", error);
    }
  };

  const handleAvatarUpload = async (file: File) => {
    const isImage = file.type.startsWith("image/");
    if (!isImage) {
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
      await updateUser({
        tenant: tenantId,
        primaryKey: (user as any)?.id,
        input: { avatarUrl: result.url },
        fields: ["id", "avatarUrl"],
        headers: getAuthHeaders(user),
      });
      updateAvatarUrl(result.url);
      message.success("头像修改成功");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "头像上传失败");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const userInfo = (user as any) || {};
  const isHeaderVariant = variant === "header";

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          cursor: "pointer",
          padding: isHeaderVariant ? "4px 8px" : "2px 4px",
          borderRadius: isHeaderVariant ? 14 : 8,
          transition: "background 0.2s ease",
          border: "none",
          background: "transparent",
        }}
        onClick={() => setDrawerOpen(true)}
      >
        {userInfo.avatarUrl ? (
          <Avatar
            size={28}
            src={userInfo.avatarUrl}
            style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}
          />
        ) : (
          <Avatar
            size={28}
            style={{
              background: isHeaderVariant
                ? "var(--front-icon-bg, #ffffff)"
                : themeColors.primary,
              color: isHeaderVariant
                ? "var(--front-icon-text, #1f2937)"
                : undefined,
            }}
            icon={<UserOutlined style={{ fontSize: 14 }} />}
          />
        )}
        {!compact && (
          <span
            style={{
              color: isHeaderVariant
                ? "var(--front-brand-text, #ffffff)"
                : "#191c1d",
              fontSize: isHeaderVariant ? 14 : 14,
              fontWeight: isHeaderVariant ? 600 : 500,
              textShadow: isHeaderVariant ? "0 1px 2px rgba(15,23,42,0.08)" : "none",
            }}
          >
            {userInfo.name || userInfo.memberId || "用户"}
          </span>
        )}
      </div>

      <Drawer
        title={null}
        placement="right"
        width={380}
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
        closable={false}
        styles={{ body: { padding: 0 } }}
      >
        <div
          style={{
            padding: 24,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            background: `linear-gradient(135deg, ${themeColors.navBg} 0%, #1E3A8A 100%)`,
            position: "relative",
          }}
        >
          <div
            onClick={() => setDrawerOpen(false)}
            style={{
              position: "absolute",
              top: 12,
              left: 12,
              cursor: "pointer",
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 0.2s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.25)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.15)"; }}
          >
            <CloseOutlined style={{ color: "#fff", fontSize: 13 }} />
          </div>
          <div
            style={{ position: "relative", display: "inline-block", marginBottom: 12 }}
            onClick={() => avatarInputRef.current?.click()}
          >
            <Spin spinning={uploadingAvatar}>
              <Avatar
                size={72}
                src={userInfo.avatarUrl}
                style={{ backgroundColor: userInfo.avatarUrl ? "transparent" : "#fff", cursor: "pointer" }}
                icon={!userInfo.avatarUrl ? <UserOutlined /> : undefined}
              >
                {!userInfo.avatarUrl && (userInfo.name?.charAt(0)?.toUpperCase() || "U")}
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
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                cursor: "pointer",
              }}
            >
              <CameraOutlined style={{ fontSize: 13, color: themeColors.primary }} />
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
          <Space style={{ marginBottom: 4 }}>
            <Text strong style={{ fontSize: 18, color: "#fff" }}>
              {userInfo.name || "未设置姓名"}
            </Text>
            <Tag color="gold">{getRoleLabel(userInfo.role)}</Tag>
          </Space>
          <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.8)" }}>
            {userInfo.email || "未设置邮箱"}
          </Text>
        </div>

        <div style={{ padding: "16px 20px" }}>
          <Text strong style={{ fontSize: 14, color: themeColors.primary }}>基本信息</Text>
        </div>
        <div style={{ padding: "0 20px 16px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {userInfo.memberId && (
              <div style={{ display: "flex", alignItems: "center" }}>
                <IdcardOutlined style={{ color: "#8c8c8c", marginRight: 8 }} />
                <div>
                  <Text type="secondary" style={{ fontSize: 11 }}>学号/工号</Text>
                  <br />
                  <Text strong style={{ fontSize: 13 }}>{userInfo.memberId}</Text>
                </div>
              </div>
            )}
            {userInfo.phone && (
              <div style={{ display: "flex", alignItems: "center" }}>
                <PhoneOutlined style={{ color: "#8c8c8c", marginRight: 8 }} />
                <div>
                  <Text type="secondary" style={{ fontSize: 11 }}>手机号</Text>
                  <br />
                  <Text strong style={{ fontSize: 13 }}>{userInfo.phone}</Text>
                </div>
              </div>
            )}
            {userInfo.school && (
              <div style={{ display: "flex", alignItems: "center" }}>
                <BankOutlined style={{ color: "#8c8c8c", marginRight: 8 }} />
                <div>
                  <Text type="secondary" style={{ fontSize: 11 }}>学校</Text>
                  <br />
                  <Text strong style={{ fontSize: 13 }}>{userInfo.school}</Text>
                </div>
              </div>
            )}
            {userInfo.colledge && (
              <div style={{ display: "flex", alignItems: "center" }}>
                <BankOutlined style={{ color: "#8c8c8c", marginRight: 8 }} />
                <div>
                  <Text type="secondary" style={{ fontSize: 11 }}>学院</Text>
                  <br />
                  <Text strong style={{ fontSize: 13 }}>{userInfo.colledge}</Text>
                </div>
              </div>
            )}
            {userInfo.major && (
              <div style={{ display: "flex", alignItems: "center" }}>
                <BookOutlined style={{ color: "#8c8c8c", marginRight: 8 }} />
                <div>
                  <Text type="secondary" style={{ fontSize: 11 }}>专业</Text>
                  <br />
                  <Text strong style={{ fontSize: 13 }}>{userInfo.major}</Text>
                </div>
              </div>
            )}
            {userInfo.jobTitle && (
              <div style={{ display: "flex", alignItems: "center" }}>
                <UserOutlined style={{ color: "#8c8c8c", marginRight: 8 }} />
                <div>
                  <Text type="secondary" style={{ fontSize: 11 }}>职位</Text>
                  <br />
                  <Text strong style={{ fontSize: 13 }}>{userInfo.jobTitle}</Text>
                </div>
              </div>
            )}
          </div>
        </div>

        {role !== "admin" && (
          <>
            <Divider style={{ margin: 0 }} />
            <div style={{ padding: "16px 20px" }}>
              <Text strong style={{ fontSize: 14, color: themeColors.primary }}>
                <BookOutlined style={{ marginRight: 8 }} />
                {role === "teacher" ? "教授课程" : "我的课程"}
                <Tag style={{ marginLeft: 8 }}>{courses.length}</Tag>
              </Text>
            </div>
            <div style={{ padding: "0 20px 16px", maxHeight: 300, overflow: "auto" }}>
              {loadingCourses ? (
                <div style={{ textAlign: "center", padding: 24 }}>
                  <Spin size="small" />
                </div>
              ) : courses.length > 0 ? (
                <>
                  <List
                    size="small"
                    dataSource={displayCourses}
                    renderItem={(course: any) => (
                      <List.Item style={{ padding: "8px 12px", background: "#fafafa", borderRadius: 6, marginBottom: 8 }}>
                        <Text ellipsis style={{ fontSize: 13 }}>{course.title || "未命名课程"}</Text>
                      </List.Item>
                    )}
                  />
                  {courses.length > 5 && (
                    <Button 
                      type="link" 
                      onClick={() => setCoursesExpand(!coursesExpand)}
                      style={{ padding: "4px 0", fontSize: 13 }}
                    >
                      {coursesExpand ? (
                        <>收起全部 <UpOutlined /></>
                      ) : (
                        <>展开更多 {courses.length - 5} 门课程 <DownOutlined /></>
                      )}
                    </Button>
                  )}
                </>
              ) : (
                <Text type="secondary" style={{ fontSize: 13 }}>
                  {role === "teacher" ? "暂无教授课程" : "暂无选课"}
                </Text>
              )}
            </div>
          </>
        )}

        <Divider style={{ margin: 0 }} />

        <div style={{ padding: "12px 20px" }}>
          <Space direction="vertical" style={{ width: "100%" }} size={8}>
            <Button
              block
              icon={<LockOutlined />}
              onClick={() => {
                setDrawerOpen(false);
                setPasswordModalOpen(true);
              }}
              style={{ height: 44, textAlign: "left" }}
            >
              修改密码
            </Button>
            <Button
              block
              danger
              icon={<LogoutOutlined />}
              onClick={logout}
              style={{ height: 44, textAlign: "left" }}
            >
              退出登录
            </Button>
          </Space>
        </div>
      </Drawer>

      <Modal
        title="修改密码"
        open={passwordModalOpen}
        onCancel={() => {
          setPasswordModalOpen(false);
          form.resetFields();
        }}
        onOk={handlePasswordSubmit}
        confirmLoading={changePasswordMutation.isPending}
        okText="确认修改"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="currentPassword"
            label="当前密码"
            rules={[{ required: true, message: "请输入当前密码" }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="请输入当前密码"
              iconRender={(visible) => (visible ? <EyeOutlined /> : <EyeTwoTone />)}
            />
          </Form.Item>
          <Form.Item
            name="newPassword"
            label="新密码"
            rules={[
              { required: true, message: "请输入新密码" },
              { min: 6, message: "密码至少6位" },
            ]}
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
                  if (!value || getFieldValue("newPassword") === value) {
                    return Promise.resolve();
                  }
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
    </>
  );
}
