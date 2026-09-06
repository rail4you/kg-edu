import { Tag } from "antd";

interface EditPermissionUser {
  editEnabled?: boolean | null;
  editPeriodStart?: string | null;
  editPeriodEnd?: string | null;
}

/** 根据编辑开关与起止日期渲染编辑权限状态标签 */
export function EditPermissionTag({ user }: { user: EditPermissionUser }) {
  const enabled = user.editEnabled !== false;
  const start = user.editPeriodStart;
  const end = user.editPeriodEnd;
  const today = new Date().toISOString().slice(0, 10);

  if (!enabled) {
    return <Tag color="red">已关闭</Tag>;
  }
  if (start && today < start) {
    return <Tag color="orange">未开始 · {start}</Tag>;
  }
  if (end && today > end) {
    return <Tag color="red">已过期 · {end}</Tag>;
  }
  if (start && end) {
    return <Tag color="green">正常 · {start}~{end}</Tag>;
  }
  if (start) {
    return <Tag color="green">正常 · {start} 起</Tag>;
  }
  if (end) {
    return <Tag color="green">正常 · 至 {end}</Tag>;
  }
  return <Tag color="green">不限时</Tag>;
}
