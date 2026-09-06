import { useEffect, useState } from "react";
import {
  Form,
  Input,
  Select,
  Button,
  Space,
  Row,
  Col,
  Upload,
  Avatar,
  message,
  Spin,
} from "antd";
import {
  UserOutlined,
  MailOutlined,
  PhoneOutlined,
  BankOutlined,
  LockOutlined,
  UploadOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import type { UploadProps } from "antd";
import type { IUserItem } from "@/types/user";
import { uploadFile } from "@/lib/oss-upload";

const { TextArea } = Input;

interface UserFormProps {
  user?: IUserItem | null;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  loading?: boolean;
}

const teacherJobTitles = [
  { value: "助教", label: "助教" },
  { value: "讲师", label: "讲师" },
  { value: "副教授", label: "副教授" },
  { value: "教授", label: "教授" },
];

export function UserForm({ user, onSubmit, onCancel, loading }: UserFormProps) {
  const [form] = Form.useForm();
  const isEditing = !!user;
  const selectedRole = Form.useWatch("role", form);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    if (user) {
      form.setFieldsValue({
        memberId: user.memberId,
        name: user.name,
        email: user.email,
        phone: user.phone,
        school: user.school,
        role: user.role,
        jobTitle: user.jobTitle,
        bio: user.bio,
        avatarUrl: user.avatarUrl,
      });
      setAvatarUrl(user.avatarUrl);
    } else {
      form.resetFields();
      form.setFieldsValue({ role: "user" });
      setAvatarUrl(undefined);
    }
  }, [user, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const finalData = {
        ...values,
        avatarUrl: avatarUrl || undefined,
      };
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

        <Col span={24}>
          <Form.Item
            name="role"
            label="用户角色"
            rules={[{ required: true, message: "请选择用户角色" }]}
          >
            <Select placeholder="选择用户角色">
              <Select.Option value="admin">
                <Space>
                  <span style={{ color: "#eb2f96" }}>🛡️</span>
                  管理员
                </Space>
              </Select.Option>
              <Select.Option value="teacher">
                <Space>
                  <span style={{ color: "#1890ff" }}>🎓</span>
                  教师
                </Space>
              </Select.Option>
              <Select.Option value="user">
                <Space>
                  <span style={{ color: "#52c41a" }}>📚</span>
                  学生
                </Space>
              </Select.Option>
            </Select>
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

        {selectedRole === "teacher" && (
          <>
            <Col span={24}>
              <Form.Item
                name="jobTitle"
                label="职称"
                rules={[
                  { required: selectedRole === "teacher", message: "教师角色必须选择职称" },
                ]}
              >
                <Select placeholder="选择教师的学术职称">
                  {teacherJobTitles.map((title) => (
                    <Select.Option key={title.value} value={title.value}>
                      {title.label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col span={24}>
              <Form.Item name="bio" label="个人简介">
                <TextArea
                  rows={4}
                  placeholder="请输入教师个人简介，包括教学经验、研究方向、专业特长、获得荣誉等详细描述..."
                />
              </Form.Item>
            </Col>
          </>
        )}
      </Row>

      <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: 16, marginTop: 16 }}>
        <Space style={{ width: "100%", justifyContent: "flex-end" }}>
          <Button onClick={onCancel} disabled={loading}>
            取消
          </Button>
          <Button type="primary" onClick={handleSubmit} loading={loading}>
            {isEditing ? "更新用户" : "创建用户"}
          </Button>
        </Space>
      </div>
    </Form>
  );
}
