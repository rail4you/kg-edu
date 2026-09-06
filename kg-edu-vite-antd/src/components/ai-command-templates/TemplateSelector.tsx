import { useState } from "react";
import {
  Modal,
  Card,
  Typography,
  Button,
  Empty,
  Row,
  Col,
} from "antd";
import {
  FileTextOutlined,
  CheckOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import { aiCommandTemplates, type AITemplate } from "@/config/aiCommandTemplates";
import { useTranslate } from "@/locales/use-locales";

const { Text } = Typography;

interface TemplateSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelect: (template: AITemplate) => void;
}

export default function TemplateSelector({
  open,
  onClose,
  onSelect,
}: TemplateSelectorProps) {
  const { t } = useTranslate("teacher");
  const [previewTemplate, setPreviewTemplate] = useState<AITemplate | null>(null);

  const handleSelect = (template: AITemplate) => {
    onSelect(template);
    setPreviewTemplate(null);
    onClose();
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={700}
      title={t("pages.aiCommand.templateTitle")}
    >
      <Row gutter={[12, 12]}>
        {aiCommandTemplates.map((template) => (
          <Col xs={24} sm={12} key={template.id}>
            <Card
              hoverable
              size="small"
              style={{
                borderRadius: 8,
                border: previewTemplate?.id === template.id ? "2px solid #1890ff" : "1px solid #d9d9d9",
              }}
              onClick={() => setPreviewTemplate(template)}
            >
              <Text strong style={{ display: "block", marginBottom: 4 }}>
                {template.name}
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {template.description}
              </Text>
            </Card>
          </Col>
        ))}
      </Row>

      {previewTemplate && (
        <>
          <div style={{ margin: "16px 0", padding: 12, background: "#f5f7fa", borderRadius: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <EyeOutlined />
                <Text strong>{t("pages.aiCommand.preview")}</Text>
              </div>
              <Button type="primary" icon={<CheckOutlined />} onClick={() => handleSelect(previewTemplate)}>
                {t("pages.aiCommand.useThisTemplate")}
              </Button>
            </div>
            <div style={{ marginBottom: 12 }}>
              <Text strong style={{ fontSize: 12, display: "block", marginBottom: 4 }}>{t("pages.aiCommand.systemPrompt")}</Text>
              <div style={{ background: "#fff", borderRadius: 4, padding: 8, border: "1px solid #d9d9d9", maxHeight: 100, overflow: "auto" }}>
                <Text style={{ fontSize: 12, whiteSpace: "pre-wrap" }}>{previewTemplate.systemPrompt}</Text>
              </div>
            </div>
            <div>
              <Text strong style={{ fontSize: 12, display: "block", marginBottom: 4 }}>{t("pages.aiCommand.userPrompt")}</Text>
              <div style={{ background: "#fff", borderRadius: 4, padding: 8, border: "1px solid #d9d9d9", maxHeight: 100, overflow: "auto" }}>
                <Text style={{ fontSize: 12, whiteSpace: "pre-wrap" }}>{previewTemplate.userPrompt}</Text>
              </div>
            </div>
          </div>
        </>
      )}

      {!previewTemplate && (
        <div style={{ textAlign: "center", padding: 24 }}>
          <Text type="secondary">{t("pages.aiCommand.clickToPreview")}</Text>
        </div>
      )}
    </Modal>
  );
}
