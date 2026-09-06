import { useEffect, useState } from "react";
import {
  Form,
  Input,
  Button,
  Space,
  Row,
  Col,
  Upload,
  Avatar,
  message,
  Spin,
  Switch,
  DatePicker,
  Typography,
} from "antd";
import {
  UserOutlined,
  MailOutlined,
  PhoneOutlined,
  BankOutlined,
  LockOutlined,
  UploadOutlined,
  DeleteOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";
import type { UploadProps } from "antd";
import dayjs from "dayjs";
import type { IUserItem } from "@/types/user";
import { uploadFile } from "@/lib/oss-upload";
import { useAuth } from "@/auth/auth-context";

const { RangePicker } = DatePicker;

interface AdminFormProps {
  user?: IUserItem | null;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  loading?: boolean;
}

export function AdminForm({ user, onSubmit, onCancel, loading }: AdminFormProps) {
  const [form] = Form.useForm();
  const isEditing = !!user;
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  // 编辑权限/使用期限仅超级管理员可配置
  const { user: loginUser } = useAuth();
  const isSuperAdmin = loginUser?.role === "super_admin";

  useEffect(() => {
    if (user) {
      form.setFieldsValue({
        memberId: user.memberId,
        name: user.name,
        email: user.email,
        phone: user.phone,
        school: user.school,
        avatarUrl: user.avatarUrl,
        editEnabled: user.editEnabled !== false,
        editPeriodRange:
          user.editPeriodStart && user.editPeriodEnd
            ? [dayjs(user.editPeriodStart), dayjs(user.editPeriodEnd)]
            : undefined,
      });
      setAvatarUrl(user.avatarUrl);
    } else {
      form.resetFields();
      setAvatarUrl(undefined);
    }
  }, [user, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const [start, end] = values.editPeriodRange || [];
      const finalData: Record<string, unknown> = {
        ...values,
        role: "admin",
        avatarUrl: avatarUrl || undefined,
      };
      // 仅超管提交使用期限字段；普通管理员不携带（后端同样强制重置/还原）
      if (isSuperAdmin) {
        finalData.editEnabled = values.editEnabled !== false;
        finalData.editPeriodStart = start ? start.format("YYYY-MM-DD") : null;
        finalData.editPeriodEnd = end ? end.format("YYYY-MM-DD") : null;
      }
      onSubmit(finalData);
    } catch (error) {
      console.error("Validation failed:", error);
    }
  };

  const handleAvatarUpload = async (file: File) => {
    const isImage = file.type.startsWith("image/");
    if (!isImage) {
      message.error("只能上传图片文件!");
      return false;
    }
    const isLt5M = file.size / 1024 / 1024 < 5;
    if (!isLt5M) {
      message.error("图片大小不能超过 5MB!");
      return false;
    }

    setUploadingAvatar(true);
    try {
      const result = await uploadFile(file);
      setAvatarUrl(result.url);
      form.setFieldValue("avatarUrl", result.url);
      message.success("头像上传成功");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "头像上传失败");
    } finally {
      setUploadingAvatar(false);
    }
    return false;
  };

  const handleRemoveAvatar = () => {
    setAvatarUrl(undefined);
    form.setFieldValue("avatarUrl", undefined);
  };

  const uploadProps: UploadProps = {
    name: "file",
    showUploadList: false,
    beforeUpload: (file) => {
      handleAvatarUpload(file);
      return false;
    },
  };

  return (
    <Form form={form} layout="vertical">
      <Row gutter={24}>
        <Col span={24}>
          <Form.Item label="用户头像">
            <Space align="start" size="large">
              <Spin spinning={uploadingAvatar}>
                {avatarUrl ? (
                  <Avatar
                    key={avatarUrl}
                    size={88}
                    src={avatarUrl}
                    style={{ backgroundColor: "transparent" }}
                  />
                ) : (
                  <Avatar
                    size={88}
                    style={{ backgroundColor: "#722ed1" }}
                    icon={<UserOutlined />}
                  >
                    {user?.name?.charAt(0)?.toUpperCase() || "U"}
                  </Avatar>
                )}
              </Spin>
              <div>
                <p style={{ marginBottom: 8, color: "#666" }}>
                  支持 JPG、PNG 格式，文件大小不超过 5MB
                </p>
                <Space>
                  <Upload {...uploadProps}>
                    <Button icon={<UploadOutlined />} loading={uploadingAvatar}>
                      {uploadingAvatar ? "上传中..." : "选择图片"}
                    </Button>
                  </Upload>
                  {avatarUrl && (
                    <Button
                      icon={<DeleteOutlined />}
                      danger
                      onClick={handleRemoveAvatar}
                      disabled={uploadingAvatar}
                    >
                      移除
                    </Button>
                  )}
                </Space>
              </div>
            </Space>
          </Form.Item>
        </Col>

        {!isEditing && (
          <Col span={24}>
            <Form.Item
              name="memberId"
              label="用户ID"
              rules={[{ required: true, message: "请输入用户ID" }]}
            >
              <Input prefix={<UserOutlined />} placeholder="用于登录的唯一标识符" />
            </Form.Item>
          </Col>
        )}

        <Col span={24}>
          <Form.Item
            name="name"
            label="姓名"
            rules={[{ required: true, message: "请输入用户姓名" }]}
          >
            <Input prefix={<UserOutlined />} placeholder="用户的真实姓名" />
          </Form.Item>
        </Col>

        <Col span={12}>
          <Form.Item
            name="email"
            label="邮箱"
            rules={[{ type: "email", message: "请输入有效的邮箱地址" }]}
          >
            <Input prefix={<MailOutlined />} placeholder="用于接收通知和找回密码" />
          </Form.Item>
        </Col>

        <Col span={12}>
          <Form.Item name="phone" label="手机号">
            <Input prefix={<PhoneOutlined />} placeholder="可选，用于紧急联系" />
          </Form.Item>
        </Col>

        <Col span={24}>
          <Form.Item name="school" label="学校/机构">
            <Input prefix={<BankOutlined />} placeholder="用户所属的学校或机构" />
          </Form.Item>
        </Col>

        {!isEditing && (
          <>
            <Col span={12}>
              <Form.Item
                name="password"
                label="密码"
                rules={[
                  { required: true, message: "请输入密码" },
                  { min: 6, message: "密码至少需要6个字符" },
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder="建议使用包含字母和数字的强密码"
                />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                name="passwordConfirmation"
                label="确认密码"
                dependencies={["password"]}
                rules={[
                  { required: true, message: "请确认密码" },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue("password") === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error("两次输入的密码不一致"));
                    },
                  }),
                ]}
              >
                <Input.Password prefix={<LockOutlined />} placeholder="请再次输入密码" />
              </Form.Item>
            </Col>
          </>
        )}

        <Col span={24}>
          <div
            style={{
              borderTop: "1px solid #f0f0f0",
              borderBottom: "1px solid #f0f0f0",
              padding: "16px 0",
              margin: "8px 0",
            }}
          >
            <Space style={{ width: "100%", justifyContent: "space-between" }}>
              <Space>
                <ClockCircleOutlined style={{ color: "#1677ff" }} />
                <Typography.Text strong>编辑权限 / 使用期限</Typography.Text>
                {!isSuperAdmin && (
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    （仅超级管理员可设置）
                  </Typography.Text>
                )}
              </Space>
              <Form.Item name="editEnabled" valuePropName="checked" noStyle>
                <Switch
                  checkedChildren="允许编辑"
                  unCheckedChildren="只读"
                  disabled={!isSuperAdmin}
                />
              </Form.Item>
            </Space>
            <div style={{ marginTop: 8 }}>
              <Form.Item
                name="editPeriodRange"
                label="编辑使用期限"
                rules={
                  isSuperAdmin
                    ? [
                        ({ getFieldValue }) => ({
                          validator(_, value) {
                            if (!value || value.length !== 2) return Promise.resolve();
                            if (value[0] && value[1] && value[0].isAfter(value[1])) {
                              return Promise.reject(new Error("截止日期不能早于起始日期"));
                            }
                            return Promise.resolve();
                          },
                        }),
                      ]
                    : []
                }
              >
                <RangePicker
                  style={{ width: "100%" }}
                  allowEmpty={[true, true]}
                  disabled={!isSuperAdmin}
                />
              </Form.Item>
              {isSuperAdmin ? (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  不设置期限表示不限时间；超出设置期限后管理员仅可查看，无法进行任何编辑操作。
                </Typography.Text>
              ) : (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  当前设置仅展示，如需调整请联系超级管理员。
                </Typography.Text>
              )}
            </div>
          </div>
        </Col>
      </Row>

      <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: 16, marginTop: 16 }}>
        <Space style={{ width: "100%", justifyContent: "flex-end" }}>
          <Button onClick={onCancel} disabled={loading}>
            取消
          </Button>
          <Button type="primary" onClick={handleSubmit} loading={loading}>
            {isEditing ? "更新管理员" : "创建管理员"}
          </Button>
        </Space>
      </div>
    </Form>
  );
}
