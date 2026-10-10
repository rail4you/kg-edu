import { useState, useMemo } from "react";
import { Form, Input, Button, message, Modal, Typography, Grid } from "antd";
import {
  UserOutlined,
  LockOutlined,
  TeamOutlined,
  PhoneOutlined,
  ApartmentOutlined,
} from "@ant-design/icons";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "@/auth/auth-context";
import { setCurrentTenant } from "@/lib/tenant";
import { usePageTitle } from "@/hooks/use-page-title";
import { useBranding } from "@/hooks/use-branding";
import { usePortalNavItems } from "@/hooks/use-portal-config";
import { UserMenu } from "@/components/layout/user-menu";
import GlobalFooter from "@/components/layout/global-footer";
import { ProtoTag } from "@/components/proto";
import "@/styles/home-portal-theme.css";
import "@/styles/portal-editorial.css";

const { Title, Text } = Typography;

/** 登录页品牌 Logo + 标题（与首页一致） */
function LoginBrandSection() {
  const branding = useBranding();
  return (
    <>
      <img src={branding.logo_dark} alt={branding.app_name} className="home-brand__logo" />
      <div className="home-brand__title">{branding.app_title}</div>
    </>
  );
}

interface MatchedTenant {
  tenantId: string;
  tenantName: string;
  schemaName: string;
}

type RoleType = "student" | "teacher" | "admin";
type LoginMode = "username" | "phone";

interface RoleConfig {
  key: RoleType;
  label: string;
  subtitle: string;
  backendRoles: string[];
  redirectPath: string;
}

const roleConfigs: Record<RoleType, RoleConfig> = {
  student: {
    key: "student",
    label: "学生登录",
    subtitle: "输入学号和密码，开始学习之旅",
    backendRoles: ["user"],
    redirectPath: "/",
  },
  teacher: {
    key: "teacher",
    label: "教师登录",
    subtitle: "输入教职工号和密码，进入教学管理",
    backendRoles: ["teacher"],
    redirectPath: "/teacher/module-home",
  },
  admin: {
    key: "admin",
    label: "管理员登录",
    subtitle: "输入管理员账号和密码，进入系统管理",
    backendRoles: ["admin", "super_admin"],
    redirectPath: "/admin/dashboard",
  },
};

async function callFindUserTenants(memberId: string, password: string): Promise<{ success: boolean; data?: any; errors?: any[] }> {
  const response = await fetch("/api/session/find-tenants", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ memberId, password }),
  });

  if (!response.ok) {
    return {
      success: false,
      errors: [{ type: "network", message: response.statusText, details: {} }],
    };
  }

  return response.json();
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, user } = useAuth();
  const screens = Grid.useBreakpoint();
  const navItems = usePortalNavItems();
  usePageTitle();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [loginMode, setLoginMode] = useState<LoginMode>("username");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [tenantModalVisible, setTenantModalVisible] = useState(false);
  const [matchedTenants, setMatchedTenants] = useState<MatchedTenant[]>([]);
  const [pendingCredentials, setPendingCredentials] = useState<{ memberId: string; password: string } | null>(null);

  const roleParam = searchParams.get("role") as RoleType | null;
  const redirectParam = searchParams.get("redirect");
  const roleConfig = useMemo(() => {
    if (roleParam && roleConfigs[roleParam]) {
      return roleConfigs[roleParam];
    }
    return null;
  }, [roleParam]);
  const isMobile = !screens.md;
  const otherRoles = roleConfig
    ? (["student", "teacher", "admin"] as RoleType[]).filter((r) => r !== roleConfig.key)
    : [];

  // 计算登录成功后的跳转路径：优先使用 redirect 参数，否则使用 roleConfig 的默认路径
  const getRedirectPath = () => {
    if (redirectParam) {
      return redirectParam;
    }
    return roleConfig?.redirectPath || "/dashboard";
  };

  const handleLoginWithTenant = async (tenant: MatchedTenant) => {
    if (!pendingCredentials) return;
    setTenantModalVisible(false);
    setLoading(true);

    try {
      setCurrentTenant({
        id: tenant.tenantId,
        name: tenant.tenantName,
        schemaName: tenant.schemaName,
      });

      const user = await login(
        pendingCredentials.memberId,
        pendingCredentials.password,
        tenant.schemaName,
        tenant.tenantId,
      );

      if (roleConfig && roleConfig.backendRoles.length > 0 && !roleConfig.backendRoles.includes(user.role)) {
        message.error(`您不是${roleConfig.label}，请重新选择角色登录`);
        return;
      }

      message.success("登录成功！");
      navigate(getRedirectPath());
    } catch (error: any) {
      const msg = error.message || "登录失败，请检查用户名和密码";
      setErrorMsg(msg);
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const onFinish = async (values: { memberId: string; password: string }) => {
    setLoading(true);
    setErrorMsg("");

    try {
      const result = await callFindUserTenants(values.memberId, values.password);

      if (!result.success) {
        const errorMsg = result.errors?.[0]?.message || "登录失败";
        setErrorMsg(errorMsg);
        message.error(errorMsg);
        setLoading(false);
        return;
      }

      const tenants = result.data?.tenants || [];

      if (tenants.length === 0) {
        const errorMsg = "未找到对应的组织，请确认账号密码是否正确";
        setErrorMsg(errorMsg);
        message.error(errorMsg);
        setLoading(false);
        return;
      }

      if (tenants.length === 1) {
        const tenant = tenants[0];
        setCurrentTenant({
          id: tenant.tenantId,
          name: tenant.tenantName,
          schemaName: tenant.schemaName,
        });

        const user = await login(values.memberId, values.password, tenant.schemaName, tenant.tenantId);

        if (roleConfig && roleConfig.backendRoles.length > 0 && !roleConfig.backendRoles.includes(user.role)) {
          message.error(`您不是${roleConfig.label}，请重新选择角色登录`);
          setLoading(false);
          return;
        }

        message.success("登录成功！");
        navigate(getRedirectPath());
      } else {
        setMatchedTenants(tenants);
        setPendingCredentials({ memberId: values.memberId, password: values.password });
        setTenantModalVisible(true);
      }
    } catch (error: any) {
      const msg = error.message || "登录失败，请检查用户名和密码";
      setErrorMsg(msg);
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleLoginModeChange = (mode: LoginMode) => {
    setLoginMode(mode);
    setErrorMsg("");
    form.setFieldsValue({ memberId: undefined });
  };

  const roleSelection = (
    <>
      <h2 className="pu-section-title" style={{ marginBottom: 6 }}>选择登录角色</h2>
      <p style={{ color: "var(--pu-muted)", fontSize: 13, marginBottom: 20 }}>
        请选择您的身份进入对应的登录页面
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {(["student", "teacher", "admin"] as RoleType[]).map((role) => {
          const config = roleConfigs[role];
          return (
            <button
              key={role}
              type="button"
              className="pu-role-option"
              onClick={() => {
                const params = new URLSearchParams();
                params.set("role", role);
                if (redirectParam) params.set("redirect", redirectParam);
                navigate(`/login?${params.toString()}`);
              }}
            >
              <span className="pu-role-option__icon">
                <TeamOutlined style={{ fontSize: 22 }} />
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 16, fontWeight: 650, color: "var(--pu-ink)" }}>
                  {config.label}
                </span>
                <span style={{ display: "block", fontSize: 13, color: "var(--pu-muted)", marginTop: 3 }}>
                  {config.subtitle}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </>
  );

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--pu-bg, #f5f7fb)" }}>
      {/* Header（与首页一致） */}
      <header className="home-header ed-top" style={{ boxShadow: "none" }}>
        <div className="home-header__inner">
          <div className="home-header__left">
            <div className="home-brand" style={{ cursor: "pointer" }} onClick={() => navigate("/")}>
              <LoginBrandSection />
            </div>

            {!isMobile && (
              <div className="home-nav">
                {navItems.map((item) => (
                  <Button
                    key={item.key}
                    type="text"
                    className={`home-nav__button ${item.key === "/" ? "is-active" : ""}`}
                    onClick={() => navigate(item.key)}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            )}
          </div>

          <div className="home-header__actions">
            {user ? (
              <UserMenu role="student" variant="header" />
            ) : (
              <Button className="home-login-button" onClick={() => navigate("/login")}>
                登录
              </Button>
            )}
          </div>
        </div>
      </header>

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <div className="pu-login-wrap">
          {/* 左侧品牌区 */}
          <div className="pu-login-art">
            <div className="pu-eyebrow">学习 · 连接 · 成长</div>
            <h1>
              让知识相连，
              <br />
              让成长可见。
            </h1>
            <p>
              {roleConfig
                ? roleConfig.subtitle + "。在易课程，连接课程、知识与实践，开启更清晰的学习旅程。"
                : "在易课程，连接课程、知识与实践，开启更清晰的教学与学习旅程。"}
            </p>
          </div>

          {/* 右侧表单/角色选择 */}
          <div className="pu-card" style={{ padding: isMobile ? 20 : 32 }}>
            <div style={{ width: "100%", maxWidth: 400, margin: "0 auto" }}>
            {!roleConfig ? (
              roleSelection
            ) : (
              <>
                {/* 登录标题 */}
                <div style={{ marginBottom: 18 }}>
                  <h2 className="pu-section-title" style={{ marginBottom: 4 }}>{roleConfig.label}</h2>
                  <p style={{ color: "var(--pu-muted)", fontSize: 13 }}>{roleConfig.subtitle}</p>
                </div>

                {/* 登录模式切换 */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", background: "#f3f5fb", borderRadius: 10, padding: 3 }}>
                    {[
                      { key: "username" as LoginMode, label: "用户名登录" },
                      { key: "phone" as LoginMode, label: "手机号登录" },
                    ].map((mode) => (
                      <div
                        key={mode.key}
                        onClick={() => handleLoginModeChange(mode.key)}
                        style={{
                          flex: 1,
                          textAlign: "center",
                          padding: "8px 12px",
                          borderRadius: 8,
                          cursor: "pointer",
                          background: loginMode === mode.key ? "#FFFFFF" : "transparent",
                          boxShadow: loginMode === mode.key ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                          transition: "all 0.2s ease",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: loginMode === mode.key ? 600 : 400,
                            color: loginMode === mode.key ? "var(--pu-blue)" : "#666",
                          }}
                        >
                          {mode.label}
                        </Text>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 错误提示 */}
                {errorMsg && (
                  <div
                    style={{
                      marginBottom: 12,
                      padding: "10px 12px",
                      background: "#fdeef1",
                      border: "1px solid #f6d0d7",
                      borderRadius: 8,
                      color: "var(--pu-red)",
                      fontSize: 13,
                    }}
                  >
                    {errorMsg}
                  </div>
                )}

                {/* 表单 */}
                <Form form={form} onFinish={onFinish} layout="vertical">
                  <Form.Item
                    name="memberId"
                    rules={[
                      { required: true, message: loginMode === "username" ? "请输入用户名" : "请输入手机号" },
                      ...(loginMode === "phone"
                        ? [{ pattern: /^1[3-9]\d{9}$/, message: "请输入正确的手机号格式" }]
                        : []),
                    ]}
                  >
                    <Input
                      prefix={loginMode === "username" ? <UserOutlined style={{ color: "#999" }} /> : <PhoneOutlined style={{ color: "#999" }} />}
                      placeholder={loginMode === "username" ? "请输入用户名" : "请输入手机号"}
                      size="large"
                      maxLength={loginMode === "phone" ? 11 : undefined}
                      style={{ borderRadius: 8, height: 46 }}
                    />
                  </Form.Item>

                  <Form.Item
                    name="password"
                    rules={[
                      { required: true, message: "请输入密码" },
                      { min: 6, message: "密码长度不能少于6位" },
                    ]}
                  >
                    <Input.Password
                      prefix={<LockOutlined style={{ color: "#999" }} />}
                      placeholder="请输入密码"
                      size="large"
                      style={{ borderRadius: 8, height: 46 }}
                    />
                  </Form.Item>

                  <Form.Item style={{ marginTop: 4, marginBottom: 0 }}>
                    <Button
                      type="primary"
                      htmlType="submit"
                      block
                      size="large"
                      loading={loading}
                      style={{
                        background: "var(--pu-blue)",
                        border: "none",
                        borderRadius: 8,
                        height: 46,
                        fontSize: 15,
                        fontWeight: 600,
                      }}
                    >
                      登 录
                    </Button>
                  </Form.Item>
                </Form>

                {/* 切换身份（紧凑单行） */}
                {otherRoles.length > 0 && (
                  <div style={{ marginTop: 18, textAlign: "center", fontSize: 13, color: "var(--pu-muted)" }}>
                    切换身份：
                    {otherRoles.map((r, i) => (
                      <span key={r}>
                        {i > 0 && <span style={{ margin: "0 6px", color: "#cbd5e1" }}>·</span>}
                        <Link
                          to={`/login?role=${r}${redirectParam ? `&redirect=${encodeURIComponent(redirectParam)}` : ""}`}
                          style={{ color: "var(--pu-blue)", fontWeight: 600 }}
                        >
                          {roleConfigs[r].label}
                        </Link>
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}
            </div>
          </div>
        </div>
      </div>

      <GlobalFooter />

      {/* 组织选择弹窗 */}
      <Modal
        title="选择组织"
        open={tenantModalVisible}
        onCancel={() => {
          setTenantModalVisible(false);
          setPendingCredentials(null);
        }}
        footer={null}
        centered
        width={isMobile ? "calc(100vw - 24px)" : 440}
        styles={{ content: { borderRadius: 16, padding: 26 } }}
      >
        {(() => {
          const urlTenantHint = redirectParam
            ? new URLSearchParams(
                redirectParam.includes("?")
                  ? redirectParam.split("?")[1] || ""
                  : ""
              ).get("tenant") || ""
            : "";
          const hasUrlHint =
            !!urlTenantHint &&
            matchedTenants.some((t) => t.schemaName === urlTenantHint);

          return (
            <>
              <p style={{ color: "var(--pu-muted)", fontSize: 14, marginBottom: 16 }}>
                您的账号存在于多个组织中，请选择要登录的组织：
              </p>

              {!hasUrlHint && urlTenantHint && (
                <div
                  style={{
                    marginBottom: 14,
                    padding: "10px 14px",
                    background: "#fff4df",
                    border: "1px solid #f0d9a8",
                    borderRadius: 10,
                    fontSize: 13,
                    lineHeight: 1.7,
                    color: "#956009",
                  }}
                >
                  ⚠ 本链接属于租户 <code>{urlTenantHint}</code>，但你当前账号无权访问。下面的列表是该账号可登录的组织。
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {matchedTenants.map((tenant) => {
                  const recommended = tenant.schemaName === urlTenantHint;
                  return (
                    <button
                      key={tenant.schemaName}
                      type="button"
                      className="pu-role-option"
                      style={recommended ? { borderColor: "var(--pu-blue)", background: "#f7faff" } : undefined}
                      onClick={() => handleLoginWithTenant(tenant)}
                    >
                      <span className="pu-role-option__icon">
                        <ApartmentOutlined style={{ fontSize: 20 }} />
                      </span>
                      <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                        <span style={{ display: "block", fontSize: 15, fontWeight: 650, color: "var(--pu-ink)" }}>
                          {tenant.tenantName || tenant.schemaName}
                        </span>
                      </span>
                      {recommended && <ProtoTag tone="blue">推荐</ProtoTag>}
                    </button>
                  );
                })}
              </div>
            </>
          );
        })()}
      </Modal>
    </div>
  );
}
