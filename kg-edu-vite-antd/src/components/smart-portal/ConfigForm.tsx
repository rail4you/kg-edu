import * as React from "react";
import {
  Checkbox,
  Input,
  InputNumber,
  Select,
  Switch,
  Space,
  Button,
  Form,
} from "antd";
import { PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import type { FieldDef } from "./registry";
import { METRIC_KEYS, METRIC_LABELS } from "./widgets";

interface NavOption {
  label: string;
  to: string;
}

interface ConfigFormProps {
  fields: FieldDef[];
  config: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
}

/** 按 `configFields` 描述渲染组件参数表单（无重量级表单库依赖） */
export const ConfigForm: React.FC<ConfigFormProps> = ({ fields, config, onChange }) => {
  const set = (key: string, value: unknown) => onChange({ [key]: value });

  return (
    <Form layout="vertical" size="small">
      {fields.map((f) => (
        <Form.Item key={f.key} label={f.label} help={f.help} style={{ marginBottom: 16 }}>
          {renderField(f, config, set)}
        </Form.Item>
      ))}
    </Form>
  );
};

function renderField(
  f: FieldDef,
  config: Record<string, unknown>,
  set: (key: string, value: unknown) => void
) {
  const value = config[f.key];

  switch (f.type) {
    case "textarea": {
      const str = typeof value === "string" ? value : "";
      return (
        <Input.TextArea
          rows={4}
          value={str}
          placeholder={f.placeholder}
          onChange={(e) => set(f.key, e.target.value)}
        />
      );
    }
    case "number":
      return (
        <InputNumber
          style={{ width: "100%" }}
          value={typeof value === "number" ? value : undefined}
          min={f.min}
          max={f.max}
          onChange={(v) => set(f.key, v ?? 0)}
        />
      );
    case "switch":
      return (
        <Switch
          checked={typeof value === "boolean" ? value : value === "true"}
          onChange={(v) => set(f.key, v)}
        />
      );
    case "select":
      return (
        <Select
          style={{ width: "100%" }}
          value={typeof value === "string" ? value : undefined}
          placeholder={f.placeholder}
          options={f.options}
          onChange={(v) => set(f.key, v)}
        />
      );
    case "metrics": {
      const selected = Array.isArray(value) ? value.map(String) : [];
      return (
        <Checkbox.Group
          value={selected}
          onChange={(v) => set(f.key, v as string[])}
          options={METRIC_KEYS.map((k) => ({ label: METRIC_LABELS[k], value: k }))}
        />
      );
    }
    case "options": {
      const items = Array.isArray(value) ? (value as NavOption[]) : [];
      const update = (next: NavOption[]) => set(f.key, next);
      return (
        <Space direction="vertical" style={{ width: "100%" }} size={8}>
          {items.map((it, i) => (
            <Space.Compact key={i} style={{ width: "100%" }}>
              <Input
                style={{ width: "42%" }}
                placeholder="名称"
                value={it.label}
                onChange={(e) => {
                  const next = [...items];
                  next[i] = { ...it, label: e.target.value };
                  update(next);
                }}
              />
              <Input
                style={{ width: "48%" }}
                placeholder="路径 /dashboard/..."
                value={it.to}
                onChange={(e) => {
                  const next = [...items];
                  next[i] = { ...it, to: e.target.value };
                  update(next);
                }}
              />
              <Button
                icon={<DeleteOutlined />}
                onClick={() => update(items.filter((_, idx) => idx !== i))}
              />
            </Space.Compact>
          ))}
          <Button
            block
            icon={<PlusOutlined />}
            onClick={() => update([...items, { label: "", to: "" }])}
          >
            添加导航项
          </Button>
        </Space>
      );
    }
    case "text":
    default: {
      const str = typeof value === "string" ? value : "";
      return (
        <Input
          value={str}
          placeholder={f.placeholder}
          onChange={(e) => set(f.key, e.target.value)}
        />
      );
    }
  }
}
