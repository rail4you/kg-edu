import { useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Button, Card, Empty, message, Space, Typography, Modal, Upload, Input, Row, Col, Spin, Popconfirm,
} from "antd";
import {
  ArrowLeftOutlined, PlusOutlined, DeleteOutlined,
  UploadOutlined, SettingOutlined, FilePdfOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { getSTSToken, uploadFileToOSS } from "@/lib/oss-upload";
import ContextSelector from "@/components/micro-major/context-selector";
import ScanTemplateEditor from "@/components/certificate/ScanTemplateEditor";
import { DEFAULT_NAME_FIELD, DEFAULT_CERT_NO_FIELD, type NameFieldConfig } from "@/components/certificate/name-field";
import {
  getMicroMajor,
  getTemplateByMicroMajor, createCertificateTemplate, updateCertificateTemplate, deleteCertificateTemplate,
} from "@/lib/ash_rpc";
import { useEditPermission } from "@/hooks/use-edit-permission";
import { ReadonlyActionButton } from "@/components/readonly-action-button";

const { Title, Text } = Typography;

// ─── Types ───

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

// ─── Style defaults ───



// ─── Helpers ───

function extractArray(result: any): any[] {
  if (!result?.success) return [];
  const data = result.data;
  if (Array.isArray(data)) return data;
  return data?.results || [];
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── Component ───

export default function MMCertificateManagement() {
  const routeParams = useParams<{ microMajorId: string }>();
  const [searchParams] = useSearchParams();
  // Support both route param (:microMajorId) and search param (?mmId=)
  const microMajorId = routeParams.microMajorId || searchParams.get("mmId") || undefined;
  const navigate = useNavigate();
  const { user, tenant } = useAuth();
  const queryClient = useQueryClient();
  const headers = getAuthHeaders(user) as Record<string, string>;
  const { canEdit } = useEditPermission();



  // Template form state
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [editTemplateId, setEditTemplateId] = useState<string | null>(null);
  const [backgroundImageUrl, setBackgroundImageUrl] = useState("");
  const [bgUploading, setBgUploading] = useState(false);
  const [nameFieldConfig, setNameFieldConfig] = useState<NameFieldConfig>(DEFAULT_NAME_FIELD);
  const [certNoFieldConfig, setCertNoFieldConfig] = useState<NameFieldConfig>(DEFAULT_CERT_NO_FIELD);


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

  // ─── Mutations ───

  const saveTemplateMutation = useMutation({
    mutationFn: async () => {
      const commonInput: any = {
        style: "scanned",
        backgroundImageUrl: backgroundImageUrl || null,
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
      setShowTemplateEditor(false);
      setEditTemplateId(null);
    },
    onError: (err: any) => message.error(err?.message || "保存失败"),
  });

  // ─── Upload handler ───

  const handleUploadBackground = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      message.error("仅支持图片格式");
      return false;
    }
    if (file.size > 20 * 1024 * 1024) {
      message.error("图片不能超过 20MB");
      return false;
    }
    setBgUploading(true);
    try {
      const sts = await getSTSToken(file.name, file.size, file.type);
      const result = await uploadFileToOSS(sts, { file, onProgress: () => {} });
      setBackgroundImageUrl(result.url);
      message.success("背景图上传成功");
    } catch (err: any) {
      message.error(err?.message || "上传失败");
    } finally {
      setBgUploading(false);
    }
    return false;
  };

  // ─── Template editor initialization ───

  const openTemplateEditor = () => {
    if (template) {
      setEditTemplateId(template.id);
      setBackgroundImageUrl(template.backgroundImageUrl || "");
      setNameFieldConfig(templateToNameField(template));
      setCertNoFieldConfig(templateToCertNoField(template));
    } else {
      setEditTemplateId(null);
      setBackgroundImageUrl("");
      setNameFieldConfig(DEFAULT_NAME_FIELD);
      setCertNoFieldConfig(DEFAULT_CERT_NO_FIELD);
    }
    setShowTemplateEditor(true);
  };

  // ─── Certificate template preview ───


  // ─── Tables ───

  if (!microMajorId) return (
    <div style={{ padding: 48, textAlign: "center" }}>
      <ContextSelector />
      <Empty description={
        <span>
          请在上方选择一个微专业<br />
          <Text type="secondary">选择微专业后即可设计证书模板和管理证书</Text>
        </span>
      } />
    </div>
  );

  return (
    <div className="mm-certificate-management-wrap" style={{ padding: 24 }}>
<style>{`@media(max-width:768px){.mm-certificate-management-wrap{padding:12px!important}.mm-certificate-management-wrap .ant-table-cell{padding:6px 4px!important}}`}</style>
      <Button icon={<ArrowLeftOutlined />} style={{ marginBottom: 16 }}
        onClick={() => navigate("/micro-major/dashboard")}>
        返回
      </Button>

      <ContextSelector />
      <Card>
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col>
            <Space>
              <FilePdfOutlined style={{ fontSize: 20, color: "#722ed1" }} />
                        <Button
            className="teacher-page-back-btn"
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/micro-major/dashboard")}
            style={{ color: "#1890ff", padding: "4px 8px", fontSize: 16 }}
          />
<Title level={4} style={{ margin: 0 }}>
                {microMajor?.name || "微专业"} - 证书管理
              </Title>
            </Space>
          </Col>
          <Col>
            <Space>
              <Button icon={<SettingOutlined />} onClick={openTemplateEditor} style={canEdit ? undefined : { display: "none" }}>
                {template ? "编辑证书模板" : "设计证书模板"}
              </Button>
            </Space>
          </Col>
        </Row>

        <div>
          {templateLoading ? (
            <Spin />
          ) : template ? (
            <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <Space direction="vertical">
                  <>
                    <Text strong>模板类型: 扫描件模板</Text>
                    <Text>背景图: {template.backgroundImageUrl ? "已上传" : "未上传"}</Text>
                    <Text>姓名字号: {template.nameFontSize ?? 36}px</Text>
                    <Text>姓名颜色: {template.nameColor || "#000000"}</Text>
                  </>
                  <Space style={{ marginTop: 12 }}>
                    <ReadonlyActionButton icon={<SettingOutlined />} onClick={openTemplateEditor}>编辑模板</ReadonlyActionButton>
                    <Popconfirm title="确定删除模板？" onConfirm={async () => {
                      await deleteCertificateTemplate({ tenant: tenant!, primaryKey: template.id, headers });
                      queryClient.invalidateQueries({ queryKey: ["mm-cert-template", microMajorId] });
                      message.success("模板已删除");
                    }}>
                      <ReadonlyActionButton danger icon={<DeleteOutlined />}>删除模板</ReadonlyActionButton>
                    </Popconfirm>
                  </Space>
                </Space>
              </div>
              <div style={{ width: 400 }}>
                {template.backgroundImageUrl ? (
                  <ScanTemplateEditor
                    backgroundUrl={template.backgroundImageUrl}
                    nameField={templateToNameField(template)}
                    certNoField={templateToCertNoField(template)}
                    readOnly
                  />
                ) : (
                  <Empty description="未上传背景图" />
                )}
              </div>
            </div>
          ) : (
            <Empty description={
              <span>尚未设计证书模板<br />
                <Button type="primary" icon={<PlusOutlined />} onClick={openTemplateEditor} style={canEdit ? { marginTop: 8 } : { display: "none" }}>
                  设计证书模板
                </Button>
              </span>
            } />
          )}
        </div>
      </Card>

      {/* ── Template Editor Modal ── */}
      <Modal
        title={editTemplateId ? "编辑证书模板" : "设计证书模板"}
        open={showTemplateEditor}
        onCancel={() => { setShowTemplateEditor(false); setEditTemplateId(null); }}
        onOk={() => saveTemplateMutation.mutate()}
        confirmLoading={saveTemplateMutation.isPending}
        width={960}
        destroyOnClose
      >
        <div>
          <Space style={{ marginBottom: 12 }}>
            <Upload beforeUpload={handleUploadBackground} showUploadList={false} accept="image/*">
              <Button icon={<UploadOutlined />} loading={bgUploading}>
                {backgroundImageUrl ? "更换背景图" : "上传背景图"}
              </Button>
            </Upload>
            {backgroundImageUrl && <Text style={{ fontSize: 12, color: "green" }}>已上传背景图</Text>}
            <Text type="secondary" style={{ fontSize: 12 }}>
              上传证书扫描图，拖动/缩放蓝色框（姓名）和绿色框（证书编号）定位字段区域
            </Text>
          </Space>
          <ScanTemplateEditor
            backgroundUrl={backgroundImageUrl || null}
            nameField={nameFieldConfig}
            onNameFieldChange={setNameFieldConfig}
            certNoField={certNoFieldConfig}
            onCertNoFieldChange={setCertNoFieldConfig}
          />
        </div>
      </Modal>
    </div>
  );
}

