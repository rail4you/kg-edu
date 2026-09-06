import { useState, useEffect } from "react";

import {
  Card,
  Row,
  Col,
  Typography,
  Button,
  Input,
  Select,
  Space,
  Divider,
  Modal,
  Alert,
  message,
  Tag,
} from "antd";
import {
  CheckCircleOutlined,
  BgColorsOutlined,
  UserOutlined,
  RobotOutlined,
  KeyOutlined,
  SettingOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";

import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { changePasswordDirect } from "@/lib/ash_rpc";
import { useTranslate } from "@/locales/use-locales";

const { Title, Text } = Typography;

interface AppSettings {
  language: string;
  aiKey: string;
  aiModel: string;
}

const SETTINGS_KEY = "teacher_app_settings";

const aiModelOptions = [
  { value: "qwen-max", label: "qwen-max" },
  { value: "qwen-plus", label: "qwen-plus" },
];

const defaultSettings: AppSettings = {
  language: "zh",
  aiKey: "",
  aiModel: "qwen-max",
};

const surfaceStyle = {
  borderRadius: 20,
  border: "1px solid #e8ecf0",
  boxShadow: "0 14px 40px rgba(15, 23, 42, 0.06)",
} as const;

const panelTitleStyle = {
  fontSize: 24,
  fontWeight: 700,
  lineHeight: "32px",
  color: "#0f172a",
} as const;

const panelDescStyle = {
  fontSize: 14,
  lineHeight: "22px",
  color: "#64748b",
} as const;

export default function TeacherSettingsPage() {
  const { user, tenant } = useAuth();
  const { t } = useTranslate("teacher");

  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [hasChanges, setHasChanges] = useState(false);

  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    newPassword: "",
    passwordConfirmation: "",
  });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);

  const languageOptions = [
    { value: "zh", label: t("pages.settings.language.zh") },
    { value: "en", label: t("pages.settings.language.en") },
  ];

  useEffect(() => {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSettings({ ...defaultSettings, ...parsed });
      } catch (e) {
        console.error("Failed to parse saved settings:", e);
      }
    }
  }, []);

  const handleSettingChange = (key: keyof AppSettings, value: string) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
    setHasChanges(true);
  };

  const handleSaveSettings = () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    message.success(t("pages.settings.messages.saved"));
    setHasChanges(false);
  };

  const handleChangePasswordClick = () => {
    setPasswordDialogOpen(true);
    setPasswordError(null);
    setPasswordSuccess(false);
    setPasswordForm({
      newPassword: "",
      passwordConfirmation: "",
    });
  };

  const handleClosePasswordDialog = () => {
    setPasswordDialogOpen(false);
    setPasswordForm({
      newPassword: "",
      passwordConfirmation: "",
    });
    setPasswordError(null);
    setPasswordSuccess(false);
  };

  const handlePasswordChange = async () => {
    setPasswordError(null);
    setPasswordSuccess(false);

    if (!passwordForm.newPassword || !passwordForm.passwordConfirmation) {
      setPasswordError(t("pages.settings.messages.allFieldsRequired"));
      return;
    }

    if (passwordForm.newPassword !== passwordForm.passwordConfirmation) {
      setPasswordError(t("pages.settings.messages.passwordMismatch"));
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setPasswordError(t("pages.settings.messages.passwordMinLength"));
      return;
    }

    setIsSubmittingPassword(true);

    try {
      const result = await changePasswordDirect({
        tenant: tenant || "",
        input: {
          newPassword: passwordForm.newPassword,
          passwordConfirmation: passwordForm.passwordConfirmation,
        },
        headers: getAuthHeaders(user) as Record<string, string>,
      });

      if (result.success) {
        setPasswordSuccess(true);
        setPasswordForm({
          newPassword: "",
          passwordConfirmation: "",
        });
        setTimeout(() => {
          setPasswordDialogOpen(false);
          setPasswordSuccess(false);
        }, 2000);
      } else {
        setPasswordError(t("pages.settings.messages.passwordFailed"));
      }
    } catch (error: unknown) {
      setPasswordError(
        error instanceof Error
          ? error.message
          : t("pages.settings.messages.passwordFailedRetry"),
      );
    } finally {
      setIsSubmittingPassword(false);
    }
  };

  return (
    <div
      style={{
        padding: 24,
        maxWidth: 1280,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 24,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          padding: 24,
          borderRadius: 24,
          background:
            "linear-gradient(135deg, #f8fbff 0%, #eef6ff 48%, #f7fafc 100%)",
          border: "1px solid #dbe7f3",
        }}
      >
        <div style={{ maxWidth: 720 }}>
          <Tag
            color="blue"
            style={{
              marginBottom: 12,
              borderRadius: 999,
              paddingInline: 10,
              lineHeight: "24px",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            教师工作台设置
          </Tag>
          <Title level={3} style={{ margin: 0, marginBottom: 6, color: "#0f172a" }}>
            {t("pages.settings.title")}
          </Title>
          <Text type="secondary" style={{ fontSize: 15, lineHeight: "24px" }}>
            {t("pages.settings.description")} 统一维护应用偏好、AI 工作参数和账户安全信息。
          </Text>
          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              marginTop: 16,
            }}
          >
            <Tag
              style={{
                borderRadius: 999,
                paddingInline: 10,
                lineHeight: "26px",
                fontSize: 12,
                borderColor: hasChanges ? "#faad14" : "#b7eb8f",
                color: hasChanges ? "#ad6800" : "#237804",
                background: hasChanges ? "#fff7e6" : "#f6ffed",
              }}
            >
              {hasChanges ? "存在未保存更改" : "当前配置已同步"}
            </Tag>
            <Tag
              style={{
                borderRadius: 999,
                paddingInline: 10,
                lineHeight: "26px",
                fontSize: 12,
                color: "#1d4ed8",
                borderColor: "#bfdbfe",
                background: "#eff6ff",
              }}
            >
              账户角色：{user?.role || t("pages.settings.teacher")}
            </Tag>
          </div>
        </div>
        <div
          style={{
            minWidth: 260,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            alignItems: "stretch",
          }}
        >
          <Card
            styles={{ body: { padding: 16 } }}
            style={{
              borderRadius: 18,
              border: "1px solid #dbe7f3",
              background: "rgba(255,255,255,0.82)",
            }}
          >
            <Text strong style={{ display: "block", marginBottom: 4, color: "#0f172a" }}>
              配置状态
            </Text>
            <Text type="secondary" style={{ display: "block", marginBottom: 14 }}>
              保存后会写入本地偏好，并立即用于教师端界面与 AI 调用配置。
            </Text>
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={handleSaveSettings}
              disabled={!hasChanges}
              block
              size="large"
              style={{ height: 42, borderRadius: 12, fontWeight: 600 }}
            >
              {t("pages.settings.saveButton")}
            </Button>
          </Card>
        </div>
      </div>

      <Card style={surfaceStyle} styles={{ body: { padding: 0 } }}>
        <div
          style={{
            padding: "24px 28px",
            borderBottom: "1px solid #e8ecf0",
            background:
              "linear-gradient(180deg, rgba(239,246,255,0.9) 0%, rgba(255,255,255,0.96) 100%)",
          }}
        >
          <Space size={14} align="start">
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#dbeafe",
                color: "#2563eb",
                flexShrink: 0,
              }}
            >
              <SettingOutlined style={{ fontSize: 22 }} />
            </div>
            <div>
              <div style={panelTitleStyle}>应用管理</div>
              <div style={panelDescStyle}>
                维护教师工作台的使用偏好、语言设置与 AI 工作参数，影响日常教学操作体验。
              </div>
            </div>
          </Space>
        </div>

        <div style={{ padding: 28 }}>
          <Row gutter={[24, 24]}>
            <Col xs={24} lg={10}>
              <Card
                bordered={false}
                style={{ borderRadius: 18, background: "#f8fbff", height: "100%" }}
                styles={{ body: { padding: 22 } }}
              >
                <div style={{ display: "flex", alignItems: "center", marginBottom: 18 }}>
                  <BgColorsOutlined
                    style={{ fontSize: 20, color: "#2563eb", marginRight: 10 }}
                  />
                  <Text strong style={{ fontSize: 16, color: "#0f172a" }}>
                    {t("pages.settings.interfaceSettings")}
                  </Text>
                </div>

                <div style={{ marginBottom: 8 }}>
                  <Text style={{ fontSize: 14, color: "#334155" }}>
                    {t("pages.settings.language")}
                  </Text>
                  <Select
                    value={settings.language}
                    onChange={(value) => handleSettingChange("language", value)}
                    style={{ width: "100%", marginTop: 10 }}
                    size="large"
                    options={languageOptions}
                  />
                </div>

                <div
                  style={{
                    marginTop: 18,
                    padding: 14,
                    borderRadius: 14,
                    background: "#ffffff",
                    border: "1px solid #dbe7f3",
                  }}
                >
                  <Text strong style={{ display: "block", marginBottom: 4 }}>
                    应用说明
                  </Text>
                  <Text type="secondary" style={{ fontSize: 13, lineHeight: "21px" }}>
                    语言设置会优先影响教师端界面文案与后续本地配置读取行为。
                  </Text>
                </div>
              </Card>
            </Col>

            <Col xs={24} lg={14}>
              <Card
                bordered={false}
                style={{ borderRadius: 18, background: "#fafcff", height: "100%" }}
                styles={{ body: { padding: 22 } }}
              >
                <div style={{ display: "flex", alignItems: "center", marginBottom: 18 }}>
                  <RobotOutlined
                    style={{ fontSize: 20, color: "#1677ff", marginRight: 10 }}
                  />
                  <Text strong style={{ fontSize: 16, color: "#0f172a" }}>
                    {t("pages.settings.aiSettings")}
                  </Text>
                </div>

                <Row gutter={[16, 16]}>
                  <Col xs={24}>
                    <Text style={{ fontSize: 14, color: "#334155" }}>
                      {t("pages.settings.aiKey")}
                    </Text>
                    <Input.Password
                      value={settings.aiKey}
                      onChange={(e) => handleSettingChange("aiKey", e.target.value)}
                      placeholder={t("pages.settings.aiKeyPlaceholder")}
                      style={{ marginTop: 10 }}
                      size="large"
                    />
                  </Col>

                  <Col xs={24} md={12}>
                    <Text style={{ fontSize: 14, color: "#334155" }}>
                      {t("pages.settings.aiModel")}
                    </Text>
                    <Select
                      value={settings.aiModel}
                      onChange={(value) => handleSettingChange("aiModel", value)}
                      style={{ width: "100%", marginTop: 10 }}
                      size="large"
                      options={aiModelOptions}
                    />
                  </Col>

                  <Col xs={24} md={12}>
                    <div
                      style={{
                        height: "100%",
                        minHeight: 106,
                        padding: 16,
                        borderRadius: 16,
                        background: "#ffffff",
                        border: "1px dashed #cbd5e1",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                      }}
                    >
                      <Text strong style={{ marginBottom: 6 }}>
                        AI 工作区建议
                      </Text>
                      <Text type="secondary" style={{ fontSize: 13, lineHeight: "21px" }}>
                        建议按课程或租户维度统一配置模型与密钥，减少不同教学任务之间的行为漂移。
                      </Text>
                    </div>
                  </Col>
                </Row>
              </Card>
            </Col>
          </Row>
        </div>
      </Card>

      <Card style={surfaceStyle} styles={{ body: { padding: 0 } }}>
        <div
          style={{
            padding: "24px 28px",
            borderBottom: "1px solid #e8ecf0",
            background:
              "linear-gradient(180deg, rgba(255,247,237,0.92) 0%, rgba(255,255,255,0.96) 100%)",
          }}
        >
          <Space size={14} align="start">
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#ffedd5",
                color: "#ea580c",
                flexShrink: 0,
              }}
            >
              <SafetyCertificateOutlined style={{ fontSize: 22 }} />
            </div>
            <div>
              <div style={panelTitleStyle}>账户管理</div>
              <div style={panelDescStyle}>
                查看当前教师账户身份信息，统一处理认证凭据和安全相关操作。
              </div>
            </div>
          </Space>
        </div>

        <div style={{ padding: 28 }}>
          <Row gutter={[24, 24]}>
            <Col xs={24} xl={16}>
              <Card
                bordered={false}
                style={{ borderRadius: 18, background: "#fcfcfd", height: "100%" }}
                styles={{ body: { padding: 22 } }}
              >
                <div style={{ display: "flex", alignItems: "center", marginBottom: 18 }}>
                  <UserOutlined
                    style={{ fontSize: 20, color: "#ea580c", marginRight: 10 }}
                  />
                  <Text strong style={{ fontSize: 16, color: "#0f172a" }}>
                    {t("pages.settings.accountInfo")}
                  </Text>
                </div>

                <Row gutter={[20, 18]}>
                  <Col xs={24} md={12}>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      {t("pages.settings.username")}
                    </Text>
                    <Input
                      value={user?.memberId || user?.email || ""}
                      disabled
                      size="large"
                      style={{ marginTop: 10 }}
                    />
                    <Text type="secondary" style={{ fontSize: 12, marginTop: 6, display: "block" }}>
                      {t("pages.settings.usernameReadonly")}
                    </Text>
                  </Col>
                  <Col xs={24} md={12}>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      {t("pages.settings.email")}
                    </Text>
                    <Input
                      value={user?.email || ""}
                      disabled
                      size="large"
                      style={{ marginTop: 10 }}
                    />
                    <Text type="secondary" style={{ fontSize: 12, marginTop: 6, display: "block" }}>
                      {t("pages.settings.emailReadonly")}
                    </Text>
                  </Col>
                  <Col xs={24} md={12}>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      {t("pages.settings.accountType")}
                    </Text>
                    <Input
                      value={user?.role || t("pages.settings.teacher")}
                      disabled
                      size="large"
                      style={{ marginTop: 10 }}
                    />
                  </Col>
                </Row>
              </Card>
            </Col>

            <Col xs={24} xl={8}>
              <Card
                bordered={false}
                style={{ borderRadius: 18, background: "#fffaf5", height: "100%" }}
                styles={{ body: { padding: 22, height: "100%" } }}
              >
                <div style={{ display: "flex", alignItems: "center", marginBottom: 18 }}>
                  <KeyOutlined
                    style={{ fontSize: 20, color: "#d97706", marginRight: 10 }}
                  />
                  <Text strong style={{ fontSize: 16, color: "#0f172a" }}>
                    安全与认证
                  </Text>
                </div>

                <Text type="secondary" style={{ fontSize: 13, lineHeight: "22px", display: "block", marginBottom: 18 }}>
                  建议定期更新登录密码，并避免在共享环境中长期保留敏感凭据。
                </Text>

                <div
                  style={{
                    padding: 16,
                    borderRadius: 16,
                    background: "#ffffff",
                    border: "1px solid #fde7cf",
                    marginBottom: 18,
                  }}
                >
                  <Text strong style={{ display: "block", marginBottom: 6 }}>
                    密码管理
                  </Text>
                  <Text type="secondary" style={{ fontSize: 13, lineHeight: "21px" }}>
                    修改后会直接更新当前教师账号密码，建议使用不少于 8 位的高强度密码。
                  </Text>
                </div>

                <Divider style={{ margin: "18px 0" }} />

                <Button
                  type="primary"
                  icon={<KeyOutlined />}
                  onClick={handleChangePasswordClick}
                  block
                  size="large"
                  style={{ height: 42, borderRadius: 12, fontWeight: 600 }}
                >
                  {t("pages.settings.changePassword")}
                </Button>
              </Card>
            </Col>
          </Row>
        </div>
      </Card>

      <Modal
        title={t("pages.settings.passwordDialog.title")}
        open={passwordDialogOpen}
        onCancel={handleClosePasswordDialog}
        footer={null}
      >
        <div style={{ marginTop: 16 }}>
          {passwordError && (
            <Alert
              message={passwordError}
              type="error"
              style={{ marginBottom: 16 }}
            />
          )}
          {passwordSuccess && (
            <Alert
              message={t("pages.settings.passwordDialog.success")}
              type="success"
              style={{ marginBottom: 16 }}
            />
          )}

          <div style={{ marginBottom: 16 }}>
            <Text>{t("pages.settings.passwordDialog.newPassword")}</Text>
            <Input.Password
              value={passwordForm.newPassword}
              onChange={(e) =>
                setPasswordForm({
                  ...passwordForm,
                  newPassword: e.target.value,
                })
              }
              disabled={isSubmittingPassword || passwordSuccess}
              placeholder={t("pages.settings.passwordDialog.newPasswordPlaceholder")}
              style={{ marginTop: 8 }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t("pages.settings.passwordDialog.minLength")}
            </Text>
          </div>

          <div style={{ marginBottom: 24 }}>
            <Text>{t("pages.settings.passwordDialog.confirmPassword")}</Text>
            <Input.Password
              value={passwordForm.passwordConfirmation}
              onChange={(e) =>
                setPasswordForm({
                  ...passwordForm,
                  passwordConfirmation: e.target.value,
                })
              }
              disabled={isSubmittingPassword || passwordSuccess}
              placeholder={t("pages.settings.passwordDialog.confirmPlaceholder")}
              status={
                !!passwordForm.passwordConfirmation &&
                passwordForm.newPassword !== passwordForm.passwordConfirmation
                  ? "error"
                  : undefined
              }
              style={{ marginTop: 8 }}
            />
            {!!passwordForm.passwordConfirmation &&
              passwordForm.newPassword !==
                passwordForm.passwordConfirmation && (
                <Text type="danger" style={{ fontSize: 12 }}>
                  {t("pages.settings.passwordDialog.mismatch")}
                </Text>
              )}
          </div>

          <Space style={{ width: "100%", justifyContent: "flex-end" }}>
            <Button
              onClick={handleClosePasswordDialog}
              disabled={isSubmittingPassword}
            >
              {t("pages.settings.passwordDialog.cancel")}
            </Button>
            <Button
              type="primary"
              onClick={handlePasswordChange}
              disabled={isSubmittingPassword || passwordSuccess}
              loading={isSubmittingPassword}
            >
              {t("pages.settings.passwordDialog.confirm")}
            </Button>
          </Space>
        </div>
      </Modal>
    </div>
  );
}
