import { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Button, Card, Empty, message, Space, Typography, Upload, Spin, Popconfirm,
  Radio, Input, Select, ColorPicker,
} from "antd";
import {
  DeleteOutlined, UploadOutlined, SaveOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { getSTSToken, uploadFileToOSS } from "@/lib/oss-upload";
import ContextSelector from "@/components/micro-major/context-selector";
import { ScanTemplateCanvas, ScanFieldSettings } from "@/components/certificate/ScanTemplateEditor";
import CertificateCard from "@/components/certificate/CertificateCard";
import { DEFAULT_NAME_FIELD, DEFAULT_CERT_NO_FIELD, type NameFieldConfig } from "@/components/certificate/name-field";
import {
  getMicroMajor,
  getTemplateByMicroMajor, createCertificateTemplate, updateCertificateTemplate, deleteCertificateTemplate,
} from "@/lib/ash_rpc";
import { useEditPermission } from "@/hooks/use-edit-permission";
import { AppPage } from "@/components/proto";

const { Text } = Typography;
const { TextArea } = Input;

// ─── Types ───

type AssetKey = "background" | "logo" | "seal" | "signature";

interface TemplateRecord {
  id: string;
  style: string;
  issuerName: string | null;
  extraText: string | null;
  logoUrl: string | null;
  sealUrl: string | null;
  signatureUrl: string | null;
  titleColor: string | null;
  titleFont: string | null;
  borderColor: string | null;
  backgroundImageUrl: string | null;
  nameFieldX: string | null;
  nameFieldY: string | null;
  nameFieldWidth: string | null;
  nameFieldHeight: string | null;
  nameFontFamily: string | null;
  nameFontSize: number | null;
  nameFontWeight: string | null;
  nameColor: string | null;
  nameLetterSpacing: number | null;
  nameTextAlign: string | null;
  certNoFieldX: string | null;
  certNoFieldY: string | null;
  certNoFieldWidth: string | null;
  certNoFieldHeight: string | null;
  certNoFontFamily: string | null;
  certNoFontSize: number | null;
  certNoFontWeight: string | null;
  certNoColor: string | null;
  certNoLetterSpacing: number | null;
  certNoTextAlign: string | null;
}

const TEMPLATE_NUM = (v: string | number | null | undefined, fallback: number): number => {
  if (v === null || v === undefined || v === "") return fallback;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};

function templateToNameField(t: TemplateRecord): NameFieldConfig {
  return {
    x: TEMPLATE_NUM(t.nameFieldX, DEFAULT_NAME_FIELD.x),
    y: TEMPLATE_NUM(t.nameFieldY, DEFAULT_NAME_FIELD.y),
    width: TEMPLATE_NUM(t.nameFieldWidth, DEFAULT_NAME_FIELD.width),
    height: TEMPLATE_NUM(t.nameFieldHeight, DEFAULT_NAME_FIELD.height),
    fontFamily: t.nameFontFamily || DEFAULT_NAME_FIELD.fontFamily,
    fontSize: TEMPLATE_NUM(t.nameFontSize, DEFAULT_NAME_FIELD.fontSize),
    fontWeight: (t.nameFontWeight as "normal" | "bold") || DEFAULT_NAME_FIELD.fontWeight,
    color: t.nameColor || DEFAULT_NAME_FIELD.color,
    letterSpacing: TEMPLATE_NUM(t.nameLetterSpacing, DEFAULT_NAME_FIELD.letterSpacing),
    textAlign: (t.nameTextAlign as "left" | "center" | "right") || DEFAULT_NAME_FIELD.textAlign,
  };
}

function templateToCertNoField(t: TemplateRecord): NameFieldConfig {
  return {
    x: TEMPLATE_NUM(t.certNoFieldX, DEFAULT_CERT_NO_FIELD.x),
    y: TEMPLATE_NUM(t.certNoFieldY, DEFAULT_CERT_NO_FIELD.y),
    width: TEMPLATE_NUM(t.certNoFieldWidth, DEFAULT_CERT_NO_FIELD.width),
    height: TEMPLATE_NUM(t.certNoFieldHeight, DEFAULT_CERT_NO_FIELD.height),
    fontFamily: t.certNoFontFamily || DEFAULT_CERT_NO_FIELD.fontFamily,
    fontSize: TEMPLATE_NUM(t.certNoFontSize, DEFAULT_CERT_NO_FIELD.fontSize),
    fontWeight: (t.certNoFontWeight as "normal" | "bold") || DEFAULT_CERT_NO_FIELD.fontWeight,
    color: t.certNoColor || DEFAULT_CERT_NO_FIELD.color,
    letterSpacing: TEMPLATE_NUM(t.certNoLetterSpacing, DEFAULT_CERT_NO_FIELD.letterSpacing),
    textAlign: (t.certNoTextAlign as "left" | "center" | "right") || DEFAULT_CERT_NO_FIELD.textAlign,
  };
}

const FONT_OPTIONS = [
  { value: "ui-sans-serif, system-ui, sans-serif", label: "无衬线 (黑体)" },
  { value: "serif", label: "衬线 (宋体)" },
  { value: '"KaiTi", "STKaiti", serif', label: "楷体" },
  { value: "monospace", label: "等宽" },
];

const STYLE_OPTIONS = [
  { value: "simple", label: "简约风" },
  { value: "classic", label: "学院经典" },
  { value: "modern", label: "现代风" },
];

const isOnlineStyle = (s: string) => s !== "scanned";

// ─── Component ───

export default function MMCertificateManagement() {
  const routeParams = useParams<{ microMajorId: string }>();
  const [searchParams] = useSearchParams();
  // Support both route param (:microMajorId) and search param (?mmId=)
  const microMajorId = routeParams.microMajorId || searchParams.get("mmId") || undefined;
  const { user, tenant } = useAuth();
  const queryClient = useQueryClient();
  const headers = getAuthHeaders(user) as Record<string, string>;
  const { canEdit } = useEditPermission();

  // Template form state
  const [editTemplateId, setEditTemplateId] = useState<string | null>(null);
  const [templateStyle, setTemplateStyle] = useState("simple");
  const [issuerName, setIssuerName] = useState("");
  const [extraText, setExtraText] = useState("");
  const [titleColor, setTitleColor] = useState("#2b2b28");
  const [titleFont, setTitleFont] = useState("ui-sans-serif, system-ui, sans-serif");
  const [borderColor, setBorderColor] = useState("#8a8a86");
  const [logoUrl, setLogoUrl] = useState("");
  const [sealUrl, setSealUrl] = useState("");
  const [signatureUrl, setSignatureUrl] = useState("");
  const [backgroundImageUrl, setBackgroundImageUrl] = useState("");
  const [uploadingAsset, setUploadingAsset] = useState<AssetKey | null>(null);
  const [nameFieldConfig, setNameFieldConfig] = useState<NameFieldConfig>(DEFAULT_NAME_FIELD);
  const [certNoFieldConfig, setCertNoFieldConfig] = useState<NameFieldConfig>(DEFAULT_CERT_NO_FIELD);

  const online = isOnlineStyle(templateStyle);

  // ─── Data Queries ───

  const { data: microMajor } = useQuery({
    queryKey: ["mm-for-cert", microMajorId, tenant],
    queryFn: async () => {
      const result = await getMicroMajor({
        tenant: tenant!, input: { id: microMajorId! },
        fields: ["id", "name"],
        headers,
      });
      if (!result.success) return null;
      const data = result.data as any;
      return Array.isArray(data) ? data[0] : data;
    },
    enabled: !!microMajorId && !!tenant,
  });

  // Template
  const { data: template, isLoading: templateLoading } = useQuery({
    queryKey: ["mm-cert-template", microMajorId, tenant],
    queryFn: async () => {
      if (!microMajorId) return null;
      const result = await getTemplateByMicroMajor({
        tenant: tenant!,
        input: { microMajorId: microMajorId! },
        fields: [
          "id", "style", "issuerName", "extraText", "logoUrl", "sealUrl", "signatureUrl",
          "titleColor", "titleFont", "borderColor",
          "backgroundImageUrl", "nameFieldX", "nameFieldY", "nameFieldWidth", "nameFieldHeight",
          "nameFontFamily", "nameFontSize", "nameFontWeight", "nameColor", "nameLetterSpacing", "nameTextAlign",
          "certNoFieldX", "certNoFieldY", "certNoFieldWidth", "certNoFieldHeight",
          "certNoFontFamily", "certNoFontSize", "certNoFontWeight", "certNoColor", "certNoLetterSpacing", "certNoTextAlign",
        ],
        headers,
      });
      if (!result.success || !result.data) return null;
      const data = result.data as any;
      const t = Array.isArray(data) ? data[0] : data;
      return t as TemplateRecord;
    },
    enabled: !!microMajorId && !!tenant,
  });

  // Sync loaded template into local editable state (only when the template identity changes)
  const appliedTemplateIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const id = template?.id ?? null;
    if (appliedTemplateIdRef.current === id) return;
    appliedTemplateIdRef.current = id;

    if (template) {
      setEditTemplateId(template.id);
      setTemplateStyle(template.style || "simple");
      setIssuerName(template.issuerName || "");
      setExtraText(template.extraText || "");
      setTitleColor(template.titleColor || "#2b2b28");
      setTitleFont(template.titleFont || "ui-sans-serif, system-ui, sans-serif");
      setBorderColor(template.borderColor || "#8a8a86");
      setLogoUrl(template.logoUrl || "");
      setSealUrl(template.sealUrl || "");
      setSignatureUrl(template.signatureUrl || "");
      setBackgroundImageUrl(template.backgroundImageUrl || "");
      setNameFieldConfig(templateToNameField(template));
      setCertNoFieldConfig(templateToCertNoField(template));
    } else {
      setEditTemplateId(null);
      setTemplateStyle("simple");
      setIssuerName("");
      setExtraText("");
      setTitleColor("#2b2b28");
      setTitleFont("ui-sans-serif, system-ui, sans-serif");
      setBorderColor("#8a8a86");
      setLogoUrl("");
      setSealUrl("");
      setSignatureUrl("");
      setBackgroundImageUrl("");
      setNameFieldConfig(DEFAULT_NAME_FIELD);
      setCertNoFieldConfig(DEFAULT_CERT_NO_FIELD);
    }
  }, [template]);

  // ─── Mutations ───

  const saveTemplateMutation = useMutation({
    mutationFn: async () => {
      const commonInput: any = {
        style: templateStyle,
        issuerName: issuerName || null,
        extraText: extraText || null,
        titleColor,
        titleFont,
        borderColor,
        logoUrl: logoUrl || null,
        sealUrl: sealUrl || null,
        signatureUrl: signatureUrl || null,
        backgroundImageUrl: online ? null : (backgroundImageUrl || null),
        nameFieldX: String(nameFieldConfig.x),
        nameFieldY: String(nameFieldConfig.y),
        nameFieldWidth: String(nameFieldConfig.width),
        nameFieldHeight: String(nameFieldConfig.height),
        nameFontFamily: nameFieldConfig.fontFamily,
        nameFontSize: nameFieldConfig.fontSize,
        nameFontWeight: nameFieldConfig.fontWeight,
        nameColor: nameFieldConfig.color,
        nameLetterSpacing: nameFieldConfig.letterSpacing,
        nameTextAlign: nameFieldConfig.textAlign,
        certNoFieldX: String(certNoFieldConfig.x),
        certNoFieldY: String(certNoFieldConfig.y),
        certNoFieldWidth: String(certNoFieldConfig.width),
        certNoFieldHeight: String(certNoFieldConfig.height),
        certNoFontFamily: certNoFieldConfig.fontFamily,
        certNoFontSize: certNoFieldConfig.fontSize,
        certNoFontWeight: certNoFieldConfig.fontWeight,
        certNoColor: certNoFieldConfig.color,
        certNoLetterSpacing: certNoFieldConfig.letterSpacing,
        certNoTextAlign: certNoFieldConfig.textAlign,
      };

      if (editTemplateId) {
        return updateCertificateTemplate({
          tenant: tenant!,
          primaryKey: editTemplateId,
          input: commonInput,
          fields: ["id"],
          headers,
        });
      } else {
        return createCertificateTemplate({
          tenant: tenant!,
          input: { microMajorId: microMajorId!, ...commonInput },
          fields: ["id"],
          headers,
        });
      }
    },
    onSuccess: () => {
      message.success(editTemplateId ? "模板已更新" : "模板已创建");
      queryClient.invalidateQueries({ queryKey: ["mm-cert-template", microMajorId] });
    },
    onError: (err: any) => message.error(err?.message || "保存失败"),
  });

  // ─── Upload handler ───

  const setAsset = (key: AssetKey, url: string) => {
    if (key === "background") setBackgroundImageUrl(url);
    else if (key === "logo") setLogoUrl(url);
    else if (key === "seal") setSealUrl(url);
    else setSignatureUrl(url);
  };

  const handleUploadImage = (key: AssetKey) => async (file: File) => {
    if (!file.type.startsWith("image/")) {
      message.error("仅支持图片格式");
      return false;
    }
    if (file.size > 20 * 1024 * 1024) {
      message.error("图片不能超过 20MB");
      return false;
    }
    setUploadingAsset(key);
    try {
      const sts = await getSTSToken(file.name, file.size, file.type);
      const result = await uploadFileToOSS(sts, { file, onProgress: () => {} });
      setAsset(key, result.url);
      message.success("上传成功");
    } catch (err: any) {
      message.error(err?.message || "上传失败");
    } finally {
      setUploadingAsset(null);
    }
    return false;
  };

  if (!microMajorId) return (
    <AppPage
      className="mm-certificate-management-wrap"
      title="证书管理"
      description="设计证书模板并管理证书"
      actions={<ContextSelector />}
    >
      <Empty description={
        <span>
          请在上方选择一个微专业<br />
          <Text type="secondary">选择微专业后即可设计证书模板和管理证书</Text>
        </span>
      } />
    </AppPage>
  );

  const preview = online ? (
    <CertificateCard
      style={templateStyle}
      titleColor={titleColor}
      titleFont={titleFont}
      borderColor={borderColor}
      issuerName={issuerName}
      extraText={extraText}
      logoUrl={logoUrl || null}
      sealUrl={sealUrl || null}
      signatureUrl={signatureUrl || null}
      studentName="示例学员"
      certNo="DEMO-2026-001"
      microMajorName={microMajor?.name || "微专业"}
      width="100%"
    />
  ) : (
    <ScanTemplateCanvas
      backgroundUrl={backgroundImageUrl || null}
      nameField={nameFieldConfig}
      onNameFieldChange={canEdit ? setNameFieldConfig : undefined}
      certNoField={certNoFieldConfig}
      onCertNoFieldChange={canEdit ? setCertNoFieldConfig : undefined}
      readOnly={!canEdit}
    />
  );

  return (
    <AppPage
      className="mm-certificate-management-wrap"
      title={`${microMajor?.name || "微专业"} - 证书模板`}
      description="设计证书模板，右侧实时预览效果"
      breadcrumb={<>微专业&nbsp;&nbsp;/&nbsp;&nbsp;证书模板</>}
      actions={
        <>
          {canEdit && (
            <Space>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                loading={saveTemplateMutation.isPending}
                onClick={() => saveTemplateMutation.mutate()}
              >
                保存模板
              </Button>
              {editTemplateId && (
                <Popconfirm title="确定删除模板？" onConfirm={async () => {
                  await deleteCertificateTemplate({ tenant: tenant!, primaryKey: editTemplateId, headers });
                  queryClient.invalidateQueries({ queryKey: ["mm-cert-template", microMajorId] });
                  message.success("模板已删除");
                }}>
                  <Button danger icon={<DeleteOutlined />}>删除模板</Button>
                </Popconfirm>
              )}
            </Space>
          )}
          <ContextSelector />
        </>
      }
    >
      <style>{`
.mm-cert-layout{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(320px,1fr);gap:20px;align-items:stretch;height:calc(100vh - 265px)}
.mm-cert-layout > .ant-card{height:100%;display:flex;flex-direction:column;min-height:0;overflow:hidden}
.mm-cert-layout > .ant-card > .ant-card-head{flex:0 0 auto}
.mm-cert-layout > .ant-card > .ant-card-body{flex:1 1 auto;min-height:0;overflow-y:auto}
@media(max-width:768px){
.mm-certificate-management-wrap{padding:12px!important}
.mm-cert-layout{grid-template-columns:1fr!important;height:auto}
.mm-cert-layout > .ant-card > .ant-card-body{overflow-y:visible}
}`}</style>

      {templateLoading ? (
        <Card><Spin /></Card>
      ) : (
        <div className="mm-cert-layout">
          <Card title="基本配置">
            <Space direction="vertical" size="large" style={{ width: "100%" }}>
              <div>
                <Text strong style={{ display: "block", marginBottom: 8 }}>模板类型</Text>
                <Radio.Group
                  value={online ? "online" : "scanned"}
                  disabled={!canEdit}
                  onChange={(e) => setTemplateStyle(e.target.value === "online" ? "simple" : "scanned")}
                  optionType="button"
                  buttonStyle="solid"
                  options={[
                    { value: "online", label: "在线排版" },
                    { value: "scanned", label: "扫描件" },
                  ]}
                />
                <Text type="secondary" style={{ display: "block", marginTop: 6, fontSize: 12 }}>
                  {online ? "填写文字信息，系统自动排版生成证书" : "上传证书扫描图，拖动定位姓名与编号区域"}
                </Text>
              </div>

              {online ? (
                <>
                  <div>
                    <Text strong style={{ display: "block", marginBottom: 8 }}>证书风格</Text>
                    <Radio.Group
                      value={templateStyle}
                      disabled={!canEdit}
                      onChange={(e) => setTemplateStyle(e.target.value)}
                      optionType="button"
                      options={STYLE_OPTIONS}
                    />
                  </div>
                  <div>
                    <Text strong style={{ display: "block", marginBottom: 8 }}>颁发单位</Text>
                    <Input
                      value={issuerName}
                      disabled={!canEdit}
                      onChange={(e) => setIssuerName(e.target.value)}
                      placeholder="例如：示范教学中心"
                    />
                  </div>
                  <div>
                    <Text strong style={{ display: "block", marginBottom: 8 }}>证书说明</Text>
                    <TextArea
                      value={extraText}
                      disabled={!canEdit}
                      onChange={(e) => setExtraText(e.target.value)}
                      placeholder="例如：已完成规定课程与项目考核。"
                      autoSize={{ minRows: 2, maxRows: 4 }}
                    />
                  </div>
                  <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                    <div>
                      <Text strong style={{ display: "block", marginBottom: 8 }}>标题字体</Text>
                      <Select
                        value={titleFont}
                        disabled={!canEdit}
                        onChange={setTitleFont}
                        options={FONT_OPTIONS}
                        style={{ width: 200 }}
                      />
                    </div>
                    <div>
                      <Text strong style={{ display: "block", marginBottom: 8 }}>标题颜色</Text>
                      <ColorPicker value={titleColor} disabled={!canEdit} onChange={(c) => setTitleColor(c.toHexString())} showText />
                    </div>
                    <div>
                      <Text strong style={{ display: "block", marginBottom: 8 }}>边框颜色</Text>
                      <ColorPicker value={borderColor} disabled={!canEdit} onChange={(c) => setBorderColor(c.toHexString())} showText />
                    </div>
                  </div>
                  <div>
                    <Text strong style={{ display: "block", marginBottom: 8 }}>素材图片</Text>
                    <Space size="middle" wrap>
                      {([
                        { key: "logo", label: "Logo", url: logoUrl },
                        { key: "seal", label: "印章", url: sealUrl },
                        { key: "signature", label: "签名", url: signatureUrl },
                      ] as { key: AssetKey; label: string; url: string }[]).map((item) => (
                        <div key={item.key} style={{ textAlign: "center" }}>
                          <div style={{ width: 72, height: 72, border: "1px dashed #d9d9d9", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", background: "#fafafa", marginBottom: 6 }}>
                            {item.url ? (
                              <img src={item.url} alt={item.label} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                            ) : (
                              <Text type="secondary" style={{ fontSize: 12 }}>无</Text>
                            )}
                          </div>
                          <Upload beforeUpload={handleUploadImage(item.key)} showUploadList={false} accept="image/*" disabled={!canEdit}>
                            <Button size="small" icon={<UploadOutlined />} loading={uploadingAsset === item.key}>{item.label}</Button>
                          </Upload>
                        </div>
                      ))}
                    </Space>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <Text strong style={{ display: "block", marginBottom: 8 }}>背景图</Text>
                    <Space wrap>
                      <Upload beforeUpload={handleUploadImage("background")} showUploadList={false} accept="image/*" disabled={!canEdit}>
                        <Button icon={<UploadOutlined />} loading={uploadingAsset === "background"}>
                          {backgroundImageUrl ? "更换背景图" : "上传背景图"}
                        </Button>
                      </Upload>
                      {backgroundImageUrl && <Text style={{ fontSize: 12, color: "green" }}>已上传背景图</Text>}
                    </Space>
                    <Text type="secondary" style={{ display: "block", marginTop: 6, fontSize: 12 }}>
                      在右侧预览图中拖动/缩放蓝色框（姓名）和绿色框（证书编号）定位字段区域
                    </Text>
                  </div>
                  <ScanFieldSettings
                    nameField={nameFieldConfig}
                    onNameFieldChange={canEdit ? setNameFieldConfig : undefined}
                    certNoField={certNoFieldConfig}
                    onCertNoFieldChange={canEdit ? setCertNoFieldConfig : undefined}
                  />
                </>
              )}
            </Space>
          </Card>

          <Card title="证书预览">
            {preview}
          </Card>
        </div>
      )}
    </AppPage>
  );
}
