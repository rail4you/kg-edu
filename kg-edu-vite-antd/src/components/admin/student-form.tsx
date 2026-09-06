import { useEffect } from "react";
import {
  Form,
  Input,
  Select,
  Button,
  Space,
  Row,
  Col,
} from "antd";
import {
  UserOutlined,
  MailOutlined,
  PhoneOutlined,
  BankOutlined,
  LockOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/auth/auth-context";
import { listClasses } from "@/lib/ash_rpc";
import { getAuthHeaders } from "@/lib/auth";

interface StudentData {
  id?: string;
  memberId: string;
  name: string;
  email?: string;
  phone?: string;
  colledge?: string;
  major?: string;
  classId?: string;
  password?: string;
}

interface StudentFormProps {
  student?: StudentData | null;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  loading?: boolean;
  tenant?: string;
}

export function StudentForm({ student, onSubmit, onCancel, loading, tenant }: StudentFormProps) {
  const [form] = Form.useForm();
  const { user } = useAuth();
  const isEditing = !!student;

  const { data: classesResponse } = useQuery({
    queryKey: ["classes-for-student-form", tenant],
    queryFn: () =>
      listClasses({
        tenant: tenant,
        fields: ["id", "name"],
        sort: "+name",
        page: { limit: 100, offset: 0 },
        headers: getAuthHeaders(user),
      }),
    enabled: !!user && !!tenant,
  });

  const classes = classesResponse?.success
    ? Array.isArray(classesResponse.data)
      ? classesResponse.data
      : (classesResponse.data as any)?.results || []
    : [];

  useEffect(() => {
    if (student) {
      form.setFieldsValue({
        memberId: student.memberId,
        name: student.name,
        email: student.email,
        phone: student.phone,
        colledge: student.colledge,
        major: student.major,
        classId: student.classId,
      });
    } else {
      form.resetFields();
    }
  }, [student, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      onSubmit(values);
    } catch (error) {
      console.error("Validation failed:", error);
    }
  };

  return (
    <Form form={form} layout="vertical">
      <Row gutter={24}>
        <Col span={12}>
          <Form.Item
            name="memberId"
            label="学生ID"
            rules={[{ required: true, message: "请输入学生ID" }]}
          >
            <Input prefix={<UserOutlined />} disabled={isEditing} />
          </Form.Item>
        </Col>

        <Col span={12}>
          <Form.Item
            name="name"
            label="姓名"
            rules={[{ required: true, message: "请输入姓名" }]}
          >
            <Input prefix={<UserOutlined />} />
          </Form.Item>
        </Col>

        <Col span={24}>
          <Form.Item
            name="email"
            label="邮箱"
            rules={[{ type: "email", message: "请输入有效的邮箱地址" }]}
          >
            <Input prefix={<MailOutlined />} />
          </Form.Item>
        </Col>

        <Col span={12}>
          <Form.Item name="phone" label="手机号">
            <Input prefix={<PhoneOutlined />} />
          </Form.Item>
        </Col>

        <Col span={12}>
          <Form.Item name="colledge" label="学院">
            <Input prefix={<BankOutlined />} />
          </Form.Item>
        </Col>

        <Col span={12}>
          <Form.Item name="major" label="专业">
            <Input />
          </Form.Item>
        </Col>

        <Col span={12}>
          <Form.Item name="classId" label="关联班级">
            <Select placeholder="选择班级" allowClear>
              {classes.map((cls: any) => (
                <Select.Option key={cls.id} value={cls.id}>
                  {cls.name}
                </Select.Option>
              ))}
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
                  { min: 6, message: "密码至少6位" },
                ]}
              >
                <Input.Password prefix={<LockOutlined />} />
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
                      return Promise.reject(new Error("密码不匹配"));
                    },
                  }),
                ]}
              >
                <Input.Password prefix={<LockOutlined />} />
              </Form.Item>
            </Col>
          </>
        )}

        {isEditing && (
          <>
            <Col span={12}>
              <Form.Item
                name="password"
                label="新密码（可选）"
                rules={[{ min: 6, message: "密码至少6位" }]}
              >
                <Input.Password prefix={<LockOutlined />} placeholder="留空则不修改" />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                name="passwordConfirmation"
                label="确认新密码"
                dependencies={["password"]}
                rules={[
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      const password = getFieldValue("password");
                      if (!password && !value) {
                        return Promise.resolve();
                      }
                      if (password && !value) {
                        return Promise.reject(new Error("请确认密码"));
                      }
                      if (password !== value) {
                        return Promise.reject(new Error("密码不匹配"));
                      }
                      return Promise.resolve();
                    },
                  }),
                ]}
              >
                <Input.Password prefix={<LockOutlined />} />
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
            {isEditing ? "更新学生" : "创建学生"}
          </Button>
        </Space>
      </div>
    </Form>
  );
}
