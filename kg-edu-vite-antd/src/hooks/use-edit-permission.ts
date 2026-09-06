import { useMemo } from "react";
import { useAuth } from "@/auth/auth-context";

export type EditPermissionStatus =
  | "ok"
  | "na"
  | "disabled"
  | "not_started"
  | "expired";

export interface EditPermissionInfo {
  canEdit: boolean;
  status: EditPermissionStatus;
  statusText: string;
  isTeacher: boolean;
  start?: string | null;
  end?: string | null;
}

const STATUS_TEXT: Record<Exclude<EditPermissionStatus, "not_started" | "expired">, string> = {
  ok: "",
  na: "",
  disabled: "编辑权限已被管理员关闭，当前仅可查看",
};

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * 计算某用户的编辑权限状态（与后端 KgEdu.Accounts.EditPermission 逻辑一致）。
 * 仅对 teacher / admin 角色生效。
 */
export function computeEditPermission(user: {
  role?: string;
  editEnabled?: boolean | null;
  editPeriodStart?: string | null;
  editPeriodEnd?: string | null;
} | null): EditPermissionInfo {
  if (!user) return { canEdit: true, status: "na", statusText: "", isTeacher: false };

  const isTeacher = user.role === "teacher" || user.role === "admin";
  if (!isTeacher) return { canEdit: true, status: "na", statusText: "", isTeacher: false };

  const start = user.editPeriodStart || null;
  const end = user.editPeriodEnd || null;
  const today = todayStr();

  if (user.editEnabled === false) {
    return { canEdit: false, status: "disabled", statusText: STATUS_TEXT.disabled, isTeacher, start, end };
  }

  if (start && today < start) {
    return {
      canEdit: false,
      status: "not_started",
      statusText: `编辑权限将于 ${start} 开始生效，当前仅可查看`,
      isTeacher,
      start,
      end,
    };
  }

  if (end && today > end) {
    return {
      canEdit: false,
      status: "expired",
      statusText: `编辑权限已于 ${end} 到期，当前仅可查看`,
      isTeacher,
      start,
      end,
    };
  }

  return { canEdit: true, status: "ok", statusText: "", isTeacher, start, end };
}

/** 当前登录用户的编辑权限状态 hook。 */
export function useEditPermission(): EditPermissionInfo {
  const { user } = useAuth();
  return useMemo(() => computeEditPermission(user), [user]);
}
