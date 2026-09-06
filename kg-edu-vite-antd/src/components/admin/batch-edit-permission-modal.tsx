import { useEffect, useMemo } from "react";
import { Modal, Form, Switch, DatePicker, Typography, App } from "antd";
import type { Dayjs } from "dayjs";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { bulkUpdateEditPermission } from "@/lib/ash_rpc";

const { RangePicker } = DatePicker;

export interface BatchTargetItem {
  id: string;
  tenant: string;
}

interface BatchEditPermissionModalProps {
  open: boolean;
  /** 选中的目标（含各自所属租户），支持跨租户批量设置 */
  selected: BatchTargetItem[];
  targetLabel: string;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * 批量设置教师/管理员编辑权限（使用期限）弹窗。
 * 支持跨租户：按租户分组后分别调用批量接口。
 */
export function BatchEditPermissionModal({
  open,
  selected,
  targetLabel,
  onClose,
  onSuccess,
}: BatchEditPermissionModalProps) {
  const { message } = App.useApp();
  const { user } = useAuth();
  const [form] = Form.useForm();

  useEffect(() => {
    if (open) {
      form.setFieldsValue({ editEnabled: true, editPeriodRange: undefined });
    }
  }, [open, form]);

  // 按租户分组：{ tenant: [ids] }
  const tenantGroups = useMemo(() => {
    const groups: Record<string, string[]> = {};
    for (const item of selected) {
      if (!item.tenant) continue;
      (groups[item.tenant] = groups[item.tenant] || []).push(item.id);
    }
    return Object.entries(groups).map(([tenant, userIds]) => ({ tenant, userIds }));
  }, [selected]);

  const mutation = useMutation({
    mutationFn: async (values: {
      editEnabled: boolean;
      editPeriodRange?: [Dayjs | null, Dayjs | null];
    }) => {
      const [start, end] = values.editPeriodRange || [];
      const input = {
        editEnabled: values.editEnabled,
        editPeriodStart: start ? start.format("YYYY-MM-DD") : null,
        editPeriodEnd: end ? end.format("YYYY-MM-DD") : null,
      };
      let total = 0;
      let failed = 0;
      for (const group of tenantGroups) {
        const result = await bulkUpdateEditPermission({
          tenant: group.tenant,
          input: { userIds: group.userIds, ...input },
          headers: getAuthHeaders(user),
        });
        if (result.success) {
          total += group.userIds.length;
        } else {
          failed += group.userIds.length;
        }
      }
      return { total, failed };
    },
    onSuccess: ({ total, failed }) => {
      if (failed > 0) {
        message.warning(`已设置 ${total} 个，失败 ${failed} 个`);
      } else {
        message.success(`已为 ${total} 个${targetLabel}设置编辑权限`);
      }
      onSuccess();
      onClose();
    },
    onError: (error: unknown) => {
      message.error((error as Error)?.message || "设置失败");
    },
  });

  const handleOk = () => {
    form.validateFields().then((values) => {
      mutation.mutate(values);
    });
  };

  return (
    <Modal
      title={`批量设置${targetLabel}编辑权限`}
      open={open}
      onCancel={onClose}
      onOk={handleOk}
      confirmLoading={mutation.isPending}
      okText="确认设置"
      cancelText="取消"
      width="95%"
      style={{ maxWidth: 520 }}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
          将统一为选中的 {selected.length} 个{targetLabel}
          {tenantGroups.length > 1 ? `（跨 ${tenantGroups.length} 个租户）` : ""}
          设置编辑权限与使用期限。
        </Typography.Paragraph>
        <Form.Item
          name="editEnabled"
          label="编辑权限"
          valuePropName="checked"
          style={{ marginBottom: 8 }}
        >
          <Switch checkedChildren="允许编辑" unCheckedChildren="只读" />
        </Form.Item>
        <Form.Item
          name="editPeriodRange"
          label="编辑使用期限"
          rules={[
            () => ({
              validator(_, value) {
                if (!value || value.length !== 2) return Promise.resolve();
                if (value[0] && value[1] && value[0].isAfter(value[1])) {
                  return Promise.reject(new Error("截止日期不能早于起始日期"));
                }
                return Promise.resolve();
              },
            }),
          ]}
        >
          <RangePicker style={{ width: "100%" }} allowEmpty={[true, true]} />
        </Form.Item>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          不设置期限表示不限时间；超出设置期限后该{targetLabel}仅可查看，无法进行任何编辑操作。
        </Typography.Text>
      </Form>
    </Modal>
  );
}
