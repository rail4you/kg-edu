import { useEffect, useState } from "react";
import { App, Button, Card, Form, Input, Spin, Typography } from "antd";
import { SaveOutlined } from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { fetchSiteContent, saveSiteContent } from "@/lib/site-content";
import { getAuthHeaders } from "@/lib/auth";

const { Title, Text } = Typography;
const { TextArea } = Input;

interface SiteContentForm {
  aboutIntro: string;
  contactEmail: string;
  contactAddress: string;
  contactHours: string;
  privacyPolicy: string;
}

/** 站点内容配置 — 平台简介 / 联系我们 / 隐私条款（首页 footer 动态展示） */
export default function SiteContentConfigPage() {
  const { message } = App.useApp();
  const { user } = useAuth();
  const [form] = Form.useForm<SiteContentForm>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isSuperAdmin = user?.role === "super_admin";

  const load = async () => {
    setLoading(true);
    const content = await fetchSiteContent();
    form.setFieldsValue({
      aboutIntro: content.aboutIntro,
      contactEmail: content.contactEmail,
      contactAddress: content.contactAddress,
      contactHours: content.contactHours,
      privacyPolicy: content.privacyPolicy,
    });
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    if (!isSuperAdmin) {
      message.error("仅超级管理员可修改站点内容");
      return;
    }
    const values = await form.validateFields();
    setSaving(true);
    const result = await saveSiteContent(
      {
        aboutIntro: values.aboutIntro || "",
        contactEmail: values.contactEmail || "",
        contactAddress: values.contactAddress || "",
        contactHours: values.contactHours || "",
        privacyPolicy: values.privacyPolicy || "",
      },
      getAuthHeaders(user)
    );
    setSaving(false);
    if (result.ok) {
      message.success("站点内容已保存");
    } else {
      message.error(result.error || "保存失败");
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 80 }}>
        <Spin size="large" tip="加载配置..." />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <div style={{ marginBottom: 20 }}>
          <Title level={4} style={{ margin: 0, marginBottom: 4 }}>
            站点内容配置
          </Title>
          <Text type="secondary">
            配置首页 footer 的「平台简介 / 联系我们 / 隐私条款」展示文案
          </Text>
        </div>

        <Form<SiteContentForm> form={form} layout="vertical" disabled={!isSuperAdmin}>
          <Form.Item
            name="aboutIntro"
            label="平台简介（每段文字用空行分隔）"
            extra="用于「关于我们」页面的平台简介，多段文字之间空一行即可。"
          >
            <TextArea rows={6} placeholder="第一段平台简介&#10;&#10;第二段平台简介&#10;&#10;第三段平台简介" />
          </Form.Item>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Form.Item name="contactEmail" label="联系邮箱">
              <Input placeholder="example@example.com" />
            </Form.Item>
            <Form.Item name="contactHours" label="工作时间">
              <Input placeholder="工作日 9:00 - 18:00" />
            </Form.Item>
          </div>

          <Form.Item name="contactAddress" label="联系地址">
            <Input placeholder="联系地址" />
          </Form.Item>

          <Form.Item
            name="privacyPolicy"
            label="隐私条款·版权声明"
            extra="展示在首页 footer「隐私条款」弹窗的版权声明部分。"
          >
            <TextArea rows={6} placeholder="版权声明全文" />
          </Form.Item>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
            {!isSuperAdmin && (
              <Text type="warning">仅超级管理员可修改站点内容</Text>
            )}
            <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave} disabled={!isSuperAdmin}>
              保存
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  );
}