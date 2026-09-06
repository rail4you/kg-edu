import { useEffect, useState } from "react";
import { App, Button, Card, Divider, Form, Input, Spin, Typography, Upload } from "antd";
import { SaveOutlined, UploadOutlined, EyeOutlined } from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { DEFAULT_BRANDING, fetchBranding, saveBranding, type BrandingConfig } from "@/config/branding";
import { useBrandingContext } from "@/hooks/use-branding";
import { uploadFileViaServer } from "@/lib/oss-upload";

const { Title, Text } = Typography;
const { TextArea } = Input;

interface BrandingForm {
  app_name: string;
  app_title: string;
  app_description: string;
  app_copyright: string;
  logo_light: string;
  logo_dark: string;
  favicon: string;
}

function LogoPreview({ src, label }: { src: string; label: string }) {
  const display = src?.trim() || "";
  if (!display) return <Text type="secondary">未配置</Text>;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
      <img
        src={display}
        alt={label}
        style={{ height: 40, maxWidth: 160, objectFit: "contain", border: "1px solid #f0f0f0", borderRadius: 6, padding: 4, background: "#fff" }}
        onError={(e) => ((e.currentTarget.style.display = "none"))}
      />
      <Text type="secondary" style={{ fontSize: 12, wordBreak: "break-all" }}>{display}</Text>
    </div>
  );
}

export default function BrandingConfigPage() {
  const { message } = App.useApp();
  const { user } = useAuth();
  const { refresh } = useBrandingContext();
  const [form] = Form.useForm<BrandingForm>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<BrandingConfig>(DEFAULT_BRANDING);

  const isSuperAdmin = user?.role === "super_admin";

  const load = async () => {
    setLoading(true);
    try {
      const b = await fetchBranding(true);
      form.setFieldsValue({
        app_name: b.app_name,
        app_title: b.app_title,
        app_description: b.app_description,
        app_copyright: b.app_copyright,
        logo_light: b.logo_light,
        logo_dark: b.logo_dark,
        favicon: b.favicon,
      });
      setPreview(b);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleValuesChange = (_: any, all: BrandingForm) => {
    setPreview((prev) => ({ ...prev, ...all }));
  };

  const handleUpload = async (file: File, field: keyof BrandingForm) => {
    try {
      const result = await uploadFileViaServer(file);
      if (result.url) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        form.setFieldsValue({ [field]: result.url } as any);
        setPreview((prev) => ({ ...prev, [field]: result.url }));
        message.success("上传成功");
        return result.url;
      }
      throw new Error("上传未返回 URL");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      message.error(e?.message || "上传失败");
      return null;
    }
  };

  const handleSave = async () => {
    if (!isSuperAdmin) {
      message.error("仅超级管理员可修改品牌配置");
      return;
    }
    try {
      const values = await form.validateFields();
      setSaving(true);
      const result = await saveBranding(
        {
          app_name: values.app_name?.trim() || "",
          app_title: values.app_title?.trim() || "",
          app_description: values.app_description?.trim() || "",
          app_copyright: values.app_copyright?.trim() || "",
          logo_light: values.logo_light?.trim() || "",
          logo_dark: values.logo_dark?.trim() || "",
          favicon: values.favicon?.trim() || "",
        },
        getAuthHeaders(user)
      );
      if (result.ok) {
        message.success("品牌配置已保存，页面将自动更新");
        await refresh();
        if (result.data) {
          setPreview(result.data);
        }
      } else {
        message.error(result.error || "保存失败");
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error(e?.message || "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefault = () => {
    form.setFieldsValue({
      app_name: DEFAULT_BRANDING.app_name,
      app_title: DEFAULT_BRANDING.app_title,
      app_description: DEFAULT_BRANDING.app_description,
      app_copyright: DEFAULT_BRANDING.app_copyright,
      logo_light: DEFAULT_BRANDING.logo_light,
      logo_dark: DEFAULT_BRANDING.logo_dark,
      favicon: DEFAULT_BRANDING.favicon,
    });
    setPreview(DEFAULT_BRANDING);
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 80 }}>
        <Spin size="large" tip="加载品牌配置..." />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <Card style={{ width: "100%" }}>
        <div style={{ marginBottom: 20 }}>
          <Title level={4} style={{ margin: 0, marginBottom: 4 }}>
            品牌配置
          </Title>
          <Text type="secondary">
            配置全站 Logo、应用名称与页脚版权（超级管理员专属，保存后全站实时生效）
          </Text>
        </div>

        <Form<BrandingForm> form={form} layout="vertical" disabled={!isSuperAdmin} onValuesChange={handleValuesChange}>
          <Divider orientation="left" orientationMargin={0}>应用名称</Divider>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Form.Item name="app_name" label="应用名称" rules={[{ required: true, message: "请输入应用名称" }]} extra="显示在导航 Logo 旁、浏览器标题前部">
              <Input placeholder="如：易课程" />
            </Form.Item>
            <Form.Item name="app_title" label="应用标题 / 副标题" rules={[{ required: true, message: "请输入应用标题" }]} extra="显示在标题分隔符后，如：智慧教学系统">
              <Input placeholder="如：智慧教学系统" />
            </Form.Item>
          </div>

          <Form.Item name="app_description" label="应用描述" extra="用于 SEO / 分享描述">
            <TextArea rows={2} placeholder="如：融合知识图谱与人工智能技术的智慧教学平台" />
          </Form.Item>

          <Divider orientation="left" orientationMargin={0}>Logo 配置</Divider>
          <Text type="secondary" style={{ display: "block", marginBottom: 16, fontSize: 12 }}>
            支持直接填写 URL 或点击“上传”选择本地图片（PNG/SVG/JPG，建议 ≤2MB，上传后自动填入 URL）
          </Text>

          <Form.Item
            name="logo_light"
            label="浅色 Logo（门户/首页深色背景使用）"
            extra={`默认：${DEFAULT_BRANDING.logo_light}`}
          >
            <Input
              placeholder="/logo/yike-home-light.png 或 https://..."
              addonAfter={
                <Upload
                  accept="image/*"
                  showUploadList={false}
                  beforeUpload={(file) => {
                    handleUpload(file, "logo_light");
                    return false;
                  }}
                >
                  <Button size="small" icon={<UploadOutlined />} disabled={!isSuperAdmin}>上传</Button>
                </Upload>
              }
            />
          </Form.Item>
          <LogoPreview src={preview.logo_light} label="浅色Logo" />

          <Form.Item
            name="logo_dark"
            label="深色 Logo（管理后台/教师端浅色背景使用）"
            extra={`默认：${DEFAULT_BRANDING.logo_dark}`}
            style={{ marginTop: 16 }}
          >
            <Input
              placeholder="/logo/yike-home.png 或 https://..."
              addonAfter={
                <Upload
                  accept="image/*"
                  showUploadList={false}
                  beforeUpload={(file) => {
                    handleUpload(file, "logo_dark");
                    return false;
                  }}
                >
                  <Button size="small" icon={<UploadOutlined />} disabled={!isSuperAdmin}>上传</Button>
                </Upload>
              }
            />
          </Form.Item>
          <LogoPreview src={preview.logo_dark} label="深色Logo" />

          <Form.Item
            name="favicon"
            label="Favicon（浏览器标签图标）"
            extra={`默认：${DEFAULT_BRANDING.favicon}，建议 .ico 或 32x32 PNG`}
            style={{ marginTop: 16 }}
          >
            <Input
              placeholder="/favicon/favicon.ico 或 https://..."
              addonAfter={
                <Upload
                  accept="image/*,.ico"
                  showUploadList={false}
                  beforeUpload={(file) => {
                    handleUpload(file, "favicon");
                    return false;
                  }}
                >
                  <Button size="small" icon={<UploadOutlined />} disabled={!isSuperAdmin}>上传</Button>
                </Upload>
              }
            />
          </Form.Item>
          <div style={{ marginTop: 8, marginBottom: 16 }}>
            {preview.favicon ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <img src={preview.favicon} alt="favicon" style={{ width: 16, height: 16 }} onError={(e) => ((e.currentTarget.style.display = "none"))} />
                <Text type="secondary" style={{ fontSize: 12 }}>{preview.favicon}</Text>
              </span>
            ) : (
              <Text type="secondary">未配置</Text>
            )}
          </div>

          <Divider orientation="left" orientationMargin={0}>页脚文本</Divider>

          <Form.Item name="app_copyright" label="页脚版权文本" extra="显示在全站底部 GlobalFooter，如：易课程 © 2026 - ...">
            <TextArea rows={2} placeholder="如：易课程 © 2026 - 融合知识图谱与人工智能技术 | 智慧教学平台" />
          </Form.Item>

          <Divider />

          {/* 实时预览 */}
          <Card size="small" style={{ background: "#fafafa", marginBottom: 24 }}>
            <Text strong style={{ fontSize: 12, color: "#8c8c8c" }}><EyeOutlined /> 预览</Text>
            <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12 }}>
              <img src={preview.logo_light} alt="preview light" style={{ height: 28, background: "#0B4CA8", padding: "4px 8px", borderRadius: 4 }} onError={(e) => ((e.currentTarget.style.display = "none"))} />
              <span style={{ fontWeight: 600 }}>{preview.app_name} · {preview.app_title}</span>
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: "#8c8c8c" }}>{preview.app_copyright}</div>
          </Card>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, alignItems: "center" }}>
            {!isSuperAdmin && <Text type="warning">仅超级管理员可修改品牌配置</Text>}
            {isSuperAdmin && (
              <Button onClick={handleResetDefault}>恢复默认</Button>
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
