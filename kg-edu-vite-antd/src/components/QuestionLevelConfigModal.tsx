import * as React from "react";
import { Modal, Form, Input, ColorPicker, Space, Button, Spin, type FormInstance } from "antd";
import { SettingOutlined } from "@ant-design/icons";
import { App } from "antd";
import {
  DEFAULT_QUESTION_LEVEL_CONFIGS,
  QUESTION_LEVEL_KEYS,
  listQuestionLevelConfigs,
  saveQuestionLevelConfigs,
  type QuestionLevelConfig,
} from "@/lib/question-level-config";
import { getCurrentTenant } from "@/lib/tenant";

type LevelFormValues = { label: string; description?: string; color: string };

type ConfigItem = QuestionLevelConfig;

export function QuestionLevelConfigModal({
  open,
  onClose,
  courseId,
}: {
  open: boolean;
  onClose: () => void;
  courseId?: string;
}) {
  const { message } = App.useApp();
  const currentTenant = getCurrentTenant();
  const tenant = currentTenant?.schemaName || "";

  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [configMap, setConfigMap] = React.useState<Record<string, ConfigItem>>({});

  const formRefs = React.useRef<Record<string, FormInstance<LevelFormValues>>>({});

  // 加载配置数据
  const loadConfigs = React.useCallback(() => {
    if (!courseId || !tenant) return;
    setLoading(true);
    try {
      const data = listQuestionLevelConfigs(tenant, courseId) as ConfigItem[];
      const map: Record<string, ConfigItem> = {};
      data.forEach((item) => {
        map[item.levelKey] = item;
      });
      setConfigMap(map);

      setTimeout(() => {
        QUESTION_LEVEL_KEYS.forEach((levelKey) => {
          const form = formRefs.current[levelKey];
          const config = map[levelKey];
          const defaults = DEFAULT_QUESTION_LEVEL_CONFIGS[levelKey];
          if (form) {
            form.setFieldsValue({
              label: config?.label || defaults.label || levelKey,
              description: config?.description || defaults.description || "",
              color: config?.color || defaults.color || "#999",
            });
          }
        });
      }, 0);
    } catch (error) {
      console.error("Failed to load question level configs:", error);
      message.error("加载配置失败");
    } finally {
      setLoading(false);
    }
  }, [courseId, tenant, message]);

  // 每次 Modal 打开且 courseId 变化时，直接从服务器获取最新数据
  React.useEffect(() => {
    if (open && courseId && tenant) {
      loadConfigs();
    }
  }, [open, courseId, tenant, loadConfigs]);

  // 当 courseId 变化时，清空表单
  const prevCourseIdRef = React.useRef(courseId);
  React.useEffect(() => {
    if (courseId !== prevCourseIdRef.current) {
      prevCourseIdRef.current = courseId;
      // 清空表单
      Object.values(formRefs.current).forEach((form) => {
        form?.resetFields();
      });
    }
  }, [courseId]);

  const handleSave = async () => {
    if (!courseId || !tenant) {
      message.warning("请先选择课程");
      return;
    }

    setSaving(true);
    const nextConfigs: ConfigItem[] = [];

    for (const levelKey of QUESTION_LEVEL_KEYS) {
      const config = configMap[levelKey];
      const form = formRefs.current[levelKey];
      if (!form) {
        continue;
      }

      try {
        const values = await form.validateFields();
        nextConfigs.push({
          id: config?.id || `local-${courseId}-${levelKey}`,
          courseId,
          levelKey,
          label: values.label,
          description: values.description || "",
          color: values.color,
          position: DEFAULT_QUESTION_LEVEL_CONFIGS[levelKey].position,
        });
      } catch (e) {
        console.error("Validation/Update error:", e);
        setSaving(false);
        return;
      }
    }

    saveQuestionLevelConfigs(tenant, courseId, nextConfigs);
    setSaving(false);
    message.success(`已更新 ${nextConfigs.length} 个配置`);
    setConfigMap(
      nextConfigs.reduce<Record<string, ConfigItem>>((acc, item) => {
        acc[item.levelKey] = item;
        return acc;
      }, {}),
    );
    setTimeout(() => onClose(), 300);
  };

  const getInitialValues = (levelKey: string): LevelFormValues => {
    const config = configMap[levelKey];
    const defaults = DEFAULT_QUESTION_LEVEL_CONFIGS[levelKey as keyof typeof DEFAULT_QUESTION_LEVEL_CONFIGS];
    return {
      label: config?.label || defaults?.label || levelKey,
      description: config?.description || defaults?.description || "",
      color: config?.color || defaults?.color || "#999",
    };
  };

  return (
    <Modal
      title={
        <Space>
          <SettingOutlined />
          问题层级配置
        </Space>
      }
      open={open}
      onCancel={onClose}
      width={580}
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" onClick={handleSave} loading={saving}>
            保存配置
          </Button>
        </div>
      }
    >
      <Spin spinning={loading}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {QUESTION_LEVEL_KEYS.map((levelKey) => (
            <LevelConfigForm
              key={levelKey}
              levelKey={levelKey}
              headerLabel={getInitialValues(levelKey).label}
              headerColor={getInitialValues(levelKey).color}
              initialValues={getInitialValues(levelKey)}
              formRef={(form) => {
                if (form) formRefs.current[levelKey] = form;
              }}
              disabled={loading}
            />
          ))}
        </div>
      </Spin>
    </Modal>
  );
}

function LevelConfigForm({
  levelKey,
  headerLabel,
  headerColor,
  initialValues,
  formRef,
  disabled,
}: {
  levelKey: string;
  headerLabel: string;
  headerColor: string;
  initialValues: LevelFormValues;
  formRef: (form: FormInstance<LevelFormValues> | null) => void;
  disabled: boolean;
}) {
  const [form] = Form.useForm<LevelFormValues>();

  // 只在 form 第一次创建时设置初始值，之后不再自动覆盖用户输入
  const isInitialized = React.useRef(false);
  React.useEffect(() => {
    if (!isInitialized.current) {
      isInitialized.current = true;
      form.setFieldsValue(initialValues);
    }
  }, []);

  React.useEffect(() => {
    formRef(form);
    return () => formRef(null);
  }, [form, formRef]);

  return (
    <div style={{ padding: 16, border: "1px solid #e8e8e8", borderRadius: 8, background: "#fafafa" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div style={{ width: 12, height: 12, borderRadius: "50%", background: headerColor, flexShrink: 0 }} />
        <span style={{ fontWeight: 600, fontSize: 14 }}>{headerLabel}</span>
        <span style={{ color: "#999", fontSize: 12 }}>({levelKey})</span>
      </div>
      <Form form={form} layout="vertical" size="small">
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <Form.Item
            name="label"
            label="标签"
            rules={[{ required: true, message: "请输入标签" }]}
            style={{ marginBottom: 0, flex: "0 0 140px" }}
          >
            <Input placeholder="显示名称" disabled={disabled} />
          </Form.Item>
          <Form.Item
            name="color"
            label="颜色"
            rules={[{ required: true, message: "请选择颜色" }]}
            style={{ marginBottom: 0 }}
            getValueFromEvent={(color) => (typeof color === "string" ? color : color?.toHexString?.() || color)}
          >
            <ColorPicker disabled={disabled} />
          </Form.Item>
        </div>
        <Form.Item name="description" label="描述" style={{ marginBottom: 0, marginTop: 12 }}>
          <Input.TextArea rows={2} placeholder="层级描述" disabled={disabled} />
        </Form.Item>
      </Form>
    </div>
  );
}
