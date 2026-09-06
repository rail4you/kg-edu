import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { checkStoredToken, clearAuthStorage, getLoginRedirectPath } from "@/lib/auth-check";

interface User {
  id: string;
  memberId: string;
  role: string;
  displayName?: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  tenantId?: string;
  editEnabled?: boolean | null;
  editPeriodStart?: string | null;
  editPeriodEnd?: string | null;
  organization?: {
    id: string;
    schemaName: string;
    name: string;
  };
}

interface AuthContextType {
  user: User | null;
  tenant: string;
  loading: boolean;
  authenticated: boolean;
  login: (
    memberId: string,
    password: string,
    tenant: string,
    tenantId: string,
  ) => Promise<User>;
  logout: () => void;
  clearAuthState: () => void;
  checkUserSession: () => void;
  updateAvatarUrl: (url: string) => void;
  refreshCurrentUser: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const checkUserSession = useCallback(() => {
    try {
      const userData = sessionStorage.getItem("user_data");
      const storedTenant = sessionStorage.getItem("tenant");

      if (userData) {
        // 验证 token 是否有效（检查 JWT 过期时间）
        const tokenCheck = checkStoredToken();
        if (!tokenCheck.valid) {
          console.warn(
            `[Auth] Token 无效 (${tokenCheck.reason})，清除登录状态并跳转登录页`
          );
          const role = sessionStorage.getItem("user_role") || "";
          clearAuthStorage();
          setUser(null);
          setTenant("");
          setLoading(false);

          // 小幅延迟确保 React 状态更新完成后再跳转
          setTimeout(() => {
            window.location.href = getLoginRedirectPath(role);
          }, 100);
          return;
        }

        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
      }
      if (storedTenant) {
        setTenant(storedTenant);
      }
    } catch (error) {
      console.error("Error checking user session:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkUserSession();
  }, [checkUserSession]);

  const login = async (
    memberId: string,
    password: string,
    tenantName: string,
    tenantId: string,
  ): Promise<User> => {
    const { signInTenant } = await import("@/lib/ash_rpc");

    const result = await signInTenant({
      tenant: tenantName,
      input: { memberId, password, tenantId },
      metadataFields: ["token"],
    });

    if (result.success) {
      const userData = result.data as User;

      sessionStorage.setItem("user_data", JSON.stringify(userData));
      sessionStorage.setItem("user_role", userData.role);
      sessionStorage.setItem("tenant", tenantName);      let token = null;
      if ((result as any).metadata?.token) {
        token = (result as any).metadata.token;
      } else if ((userData as any).token) {
        token = (userData as any).token;
      } else if ((userData as any).Metadata?.token) {
        token = (userData as any).Metadata.token;
      } else if ((userData as any).authToken) {
        token = (userData as any).authToken;
      }

      if (token) {
        sessionStorage.setItem("jwt_access_token", token);
      }

      setUser(userData);
      setTenant(tenantName);
      return userData;
    } else {
      const errors = (result as any).errors || [];
      const detailMsg = errors[0]?.details?.errors?.[0]?.message;
      let errorMsg = "登录失败，请检查用户名和密码";
      if (detailMsg) {
        if (detailMsg.includes("invalid_credentials")) {
          errorMsg = "用户名或密码错误";
        } else if (detailMsg.includes("not_found") || detailMsg.includes("is invalid")) {
          errorMsg = "账号不存在，请检查组织和用户名";
        } else {
          errorMsg = detailMsg;
        }
      }
      throw new Error(errorMsg);
    }
  };

  const logout = useCallback(() => {
    const currentRole = user?.role || sessionStorage.getItem("user_role") || "";
    clearAuthStorage();
    setUser(null);
    setTenant("");

    const redirectPath = getLoginRedirectPath(currentRole);
    window.location.href = redirectPath;
  }, [user]);

  const clearAuthState = useCallback(() => {
    clearAuthStorage();
    setUser(null);
    setTenant("");
  }, []);

  const updateAvatarUrl = (url: string) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, avatarUrl: url } as User;
      sessionStorage.setItem("user_data", JSON.stringify(updated));
      return updated;
    });
  };

  const refreshCurrentUser = useCallback(async (): Promise<User | null> => {
    try {
      const { getCurrentUser } = await import("@/lib/ash_rpc");
      const storedTenant = sessionStorage.getItem("tenant") || "";

      const result = await getCurrentUser({
        tenant: storedTenant,
        fields: [
          "id",
          "memberId",
          "name",
          "role",
          "email",
          "phone",
          "avatarUrl",
          "editEnabled",
          "editPeriodStart",
          "editPeriodEnd",
        ],
      });

      if (!result.success || !result.data) return null;

      const freshUser = result.data as unknown as User;
      setUser((prev) => {
        const merged = { ...(prev || {}), ...freshUser } as User;
        sessionStorage.setItem("user_data", JSON.stringify(merged));
        return merged;
      });
      return freshUser;
    } catch (error) {
      console.error("Error refreshing current user:", error);
      return null;
    }
  }, []);

  return (
    <AuthContext
      value={{
        user,
        tenant,
        loading,
        authenticated: !!user,
        login,
        logout,
        clearAuthState,
        checkUserSession,
        updateAvatarUrl,
        refreshCurrentUser,
      }}
    >
      {children}
    </AuthContext>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
