import { Avatar } from "antd";
import { UserOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/auth-context";

interface UserMenuProps {
  role: "admin" | "teacher" | "student";
  variant?: "default" | "header";
  compact?: boolean;
}

const PROFILE_PATH: Record<UserMenuProps["role"], string> = {
  student: "/dashboard/profile",
  teacher: "/teacher/dashboard/profile",
  admin: "/admin/dashboard/profile",
};

/**
 * 顶栏账户入口：圆形头像 + 用户名，无容器（透明），点击进入对应角色的个人中心。
 */
export function UserMenu({ role, compact }: UserMenuProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const userInfo = (user as any) || {};
  const displayName = userInfo.name || userInfo.memberId || "用户";

  return (
    <button
      type="button"
      className="user-menu-trigger"
      aria-label="个人中心"
      onClick={() => navigate(PROFILE_PATH[role])}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "2px 4px",
        border: "none",
        background: "transparent",
        cursor: "pointer",
      }}
    >
      {userInfo.avatarUrl ? (
        <Avatar size={32} src={userInfo.avatarUrl} style={{ flexShrink: 0 }} />
      ) : (
        <Avatar
          size={32}
          style={{ flexShrink: 0, background: "#e8eeff", color: "var(--pu-blue, #2859df)", fontWeight: 700 }}
          icon={<UserOutlined style={{ fontSize: 16 }} />}
        >
          {displayName.charAt(0).toUpperCase()}
        </Avatar>
      )}
      {!compact && (
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--pu-ink, #202f47)", whiteSpace: "nowrap" }}>
          {displayName}
        </span>
      )}
    </button>
  );
}

export default UserMenu;
