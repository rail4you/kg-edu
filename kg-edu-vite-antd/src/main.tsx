// 兼容老内核 — 必须在所有业务代码之前
import "./polyfills";
// fetch 拦截器 — 必须在所有模块导入前加载，确保最先安装
import { installFetchInterceptor } from "./lib/fetch-interceptor";
installFetchInterceptor();

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query";
import { ConfigProvider, App as AntdApp, theme as antdTheme } from "antd";
import { StyleProvider } from "@ant-design/cssinjs";
import zhCN from "antd/locale/zh_CN";
import { AuthProvider } from "./auth/auth-context";
import { ThemeProvider, useTheme } from "./styles/theme-context";
import { BrandingProvider } from "./hooks/use-branding";
import { AntdStaticBridge } from "./lib/antd-static-bridge";
import App from "./App";
import "./index.css";
import "./styles/coursera-theme.css";
import "./styles/student-theme.css";
import "./styles/assistant-ui.css";
import "./styles/chrome95-compat.css";

// 统一的认证错误处理：检测 401/403 并跳转登录页
function handleAuthError(error: unknown) {
  import("@/lib/auth-check").then(({ isAuthError, clearAuthStorage, getLoginRedirectPath }) => {
    if (isAuthError(error)) {
      console.warn("[Auth] API 请求返回认证错误，清除登录状态并跳转登录页", error);
      const role = sessionStorage.getItem("user_role") || "";
      clearAuthStorage();
      setTimeout(() => {
        window.location.href = getLoginRedirectPath(role);
      }, 100);
    }
  });
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error: unknown) => {
      handleAuthError(error);
    },
  }),
  mutationCache: new MutationCache({
    onError: (error: unknown) => {
      handleAuthError(error);
    },
  }),
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// 动态 Ant Design 主题 - 仅首页支持切换亮色/门户主题，内部页面保持浅色风格
function DynamicAntdConfig({ children }: { children: React.ReactNode }) {
  const { mode, colors } = useTheme();
  const location = useLocation();
  const isHomePage = location.pathname === "/";
  const isPortal = isHomePage && mode === "portal";


  return (
    <StyleProvider hashPriority="high" layer={false as any}>
      <ConfigProvider
        locale={zhCN}
        theme={{
          algorithm: antdTheme.defaultAlgorithm,
          hashed: false,
          token: {
            colorPrimary: colors.primary,
            colorSuccess: isPortal ? "#16B67F" : "#10B981",
            colorWarning: "#F59E0B",
            colorError: "#DC2626",
            colorBgLayout: isPortal ? "#F3F8FF" : "#F8FAFC",
            colorBgContainer: "#FFFFFF",
            colorBorder: isPortal ? "#D9E7FF" : "#E5E7EB",
            colorText: isPortal ? "#16386F" : "#111827",
            colorTextSecondary: isPortal ? "#607AA7" : "#6B7280",
            borderRadius: isPortal ? 14 : 8,
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', 'PingFang SC', 'Microsoft YaHei', Arial, sans-serif",
          },
          components: {
            Button: {
              borderRadius: isPortal ? 12 : 6,
              controlHeight: 38,
            },
            Card: {
              borderRadius: isPortal ? 18 : 12,
            },
            Input: {
              borderRadius: isPortal ? 12 : 6,
            },
            Select: {
              borderRadius: isPortal ? 12 : 6,
            },
          },
        }}
      >
        <AntdApp>
          <AntdStaticBridge />
          {children}
        </AntdApp>
      </ConfigProvider>
    </StyleProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <DynamicAntdConfig>
            <BrandingProvider>
            <AuthProvider>
                <App />
            </AuthProvider>
            </BrandingProvider>
          </DynamicAntdConfig>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
