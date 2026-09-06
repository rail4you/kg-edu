import { Form, Input, Button, Space, Row, Col, Typography } from "antd";
import { BankOutlined, BookOutlined } from "@ant-design/icons";

const { Paragraph } = Typography;

interface ClassData {
  id?: string;
  name: string;
  college?: string;
  major?: string;
}

interface ClassFormProps {
  classItem?: ClassData | null;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  loading?: boolean;
}

export function ClassForm({ classItem, onSubmit, onCancel, loading }: ClassFormProps) {
  const [form] = Form.useForm();
  const isEditing = !!classItem;

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      onSubmit(values);
    } catch (error) {
      console.error("Validation failed:", error);
    }
  };

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{
        name: classItem?.name || "",
        college: classItem?.college || "",
        major: classItem?.major || "",
      }}
    >
      <Row gutter={24}>
        <Col span={24}>
          <Form.Item
            name="name"
            label="班级名称"
            rules={[
              { required: true, message: "请输入班级名称" },
              { min: 2, message: "班级名称至少需要2个字符" },
            ]}
          >
            <Input placeholder="请输入班级名称" />
          </Form.Item>
        </Col>

        <Col span={24}>
          <Form.Item name="college" label="学院">
            <Input prefix={<BankOutlined />} placeholder="请输入学院名称" />
          </Form.Item>
        </Col>

        <Col span={24}>
          <Form.Item name="major" label="专业">
            <Input prefix={<BookOutlined />} placeholder="请输入专业名称" />
          </Form.Item>
        </Col>
      </Row>

      <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 16 }}>
        <strong>提示：</strong>
        <ul style={{ margin: "8px 0", paddingLeft: "20px" }}>
          <li>班级名称为必填项，建议使用有意义的命名规则</li>
          <li>学院和专业信息为可选项，有助于更好地组织和管理班级</li>
          <li>创建后可以在学生管理中将学生关联到对应班级</li>
        </ul>
      </Paragraph>

      <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: 16, marginTop: 16 }}>
        <Space style={{ width: "100%", justifyContent: "flex-end" }}>
          <Button onClick={onCancel} disabled={loading}>
            取消
          </Button>
          <Button type="primary" onClick={handleSubmit} loading={loading}>
            {isEditing ? "更新" : "创建"}
          </Button>
        </Space>
      </div>
    </Form>
  );
}
