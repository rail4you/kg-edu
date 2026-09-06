import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { ColorPicker, InputNumber, Radio, Select, Space, Typography } from "antd";
import type { NameFieldConfig } from "./name-field";

const { Text } = Typography;

export type { NameFieldConfig } from "./name-field";

const MIN_SIZE = 0.02;

const FONT_OPTIONS = [
  { value: "serif", label: "衬线 (宋体)" },
  { value: "sans-serif", label: "无衬线 (黑体)" },
  { value: '"KaiTi", "STKaiti", serif', label: "楷体" },
  { value: "monospace", label: "等宽" },
];

type DragMode =
  | "move"
  | "resize-nw"
  | "resize-n"
  | "resize-ne"
  | "resize-e"
  | "resize-se"
  | "resize-s"
  | "resize-sw"
  | "resize-w";

interface DragState {
  mode: DragMode;
  startX: number;
  startY: number;
  orig: { x: number; y: number; width: number; height: number };
  containerW: number;
  containerH: number;
}

interface FieldInfo {
  field: NameFieldConfig;
  onChange?: (cfg: NameFieldConfig) => void;
  label: string;
  placeholder: string;
  color: string; // box border color
}

interface Props {
  backgroundUrl?: string | null;
  nameField: NameFieldConfig;
  onNameFieldChange?: (cfg: NameFieldConfig) => void;
  certNoField?: NameFieldConfig;
  onCertNoFieldChange?: (cfg: NameFieldConfig) => void;
  studentName?: string;
  certNo?: string;
  readOnly?: boolean;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

const HANDLES: { mode: DragMode; cursor: string; style: React.CSSProperties }[] = [
  { mode: "resize-nw", cursor: "nwse-resize", style: { left: -5, top: -5 } },
  { mode: "resize-n", cursor: "ns-resize", style: { left: "calc(50% - 5px)", top: -5 } },
  { mode: "resize-ne", cursor: "nesw-resize", style: { right: -5, top: -5 } },
  { mode: "resize-e", cursor: "ew-resize", style: { right: -5, top: "calc(50% - 5px)" } },
  { mode: "resize-se", cursor: "nwse-resize", style: { right: -5, bottom: -5 } },
  { mode: "resize-s", cursor: "ns-resize", style: { left: "calc(50% - 5px)", bottom: -5 } },
  { mode: "resize-sw", cursor: "nesw-resize", style: { left: -5, bottom: -5 } },
  { mode: "resize-w", cursor: "ew-resize", style: { left: -5, top: "calc(50% - 5px)" } },
];

function FieldBox({
  fieldInfo,
  containerRef,
  displayH,
  naturalH,
  readOnly,
}: {
  fieldInfo: FieldInfo;
  containerRef: React.RefObject<HTMLDivElement | null>;
  displayH: number;
  naturalH: number;
  readOnly: boolean;
}) {
  const { field, onChange, label, placeholder, color } = fieldInfo;
  const dragRef = useRef<DragState | null>(null);

  const handleMouseDown = (mode: DragMode) => (e: React.MouseEvent) => {
    if (readOnly) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      orig: { x: field.x, y: field.y, width: field.width, height: field.height },
      containerW: rect.width,
      containerH: rect.height,
    };
  };

  useEffect(() => {
    if (readOnly) return;
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = (e.clientX - d.startX) / d.containerW;
      const dy = (e.clientY - d.startY) / d.containerH;
      let { x, y, width, height } = d.orig;

      if (d.mode === "move") {
        x = clamp(d.orig.x + dx, 0, 1 - width);
        y = clamp(d.orig.y + dy, 0, 1 - height);
      } else {
        const right = d.orig.x + d.orig.width;
        const bottom = d.orig.y + d.orig.height;
        if (d.mode.includes("w")) {
          x = clamp(d.orig.x + dx, 0, right - MIN_SIZE);
          width = right - x;
        }
        if (d.mode.includes("e")) {
          width = clamp(d.orig.width + dx, MIN_SIZE, 1 - d.orig.x);
        }
        if (d.mode.includes("n")) {
          y = clamp(d.orig.y + dy, 0, bottom - MIN_SIZE);
          height = bottom - y;
        }
        if (d.mode.includes("s")) {
          height = clamp(d.orig.height + dy, MIN_SIZE, 1 - d.orig.y);
        }
      }
      onChange?.({ ...field, x, y, width, height });
    };
    const onUp = () => {
      dragRef.current = null;
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [field, onChange, readOnly, containerRef]);

  const scaleFactor = naturalH > 0 && displayH > 0 ? displayH / naturalH : 1;
  const displayFontSize = Math.max(8, field.fontSize * scaleFactor);

  const boxStyle: React.CSSProperties = {
    position: "absolute",
    left: `${field.x * 100}%`,
    top: `${field.y * 100}%`,
    width: `${field.width * 100}%`,
    height: `${field.height * 100}%`,
    display: "flex",
    alignItems: "center",
    justifyContent:
      field.textAlign === "left" ? "flex-start" : field.textAlign === "right" ? "flex-end" : "center",
    overflow: "hidden",
  };

  const textStyle: React.CSSProperties = {
    fontFamily: field.fontFamily,
    fontSize: displayFontSize,
    fontWeight: field.fontWeight,
    color: field.color,
    letterSpacing: field.letterSpacing * scaleFactor,
    textAlign: field.textAlign,
    lineHeight: 1,
    whiteSpace: "nowrap",
  };

  return (
    <>
      {/* Text rendering layer */}
      <div style={boxStyle}>
        <span style={textStyle}>{placeholder}</span>
      </div>
      {/* Edit control layer */}
      {!readOnly && (
        <div
          onMouseDown={handleMouseDown("move")}
          title={label}
          style={{
            ...boxStyle,
            border: `1.5px dashed ${color}`,
            background: `${color}11`,
            cursor: "move",
          }}
        >
          {HANDLES.map((h) => (
            <div
              key={h.mode}
              onMouseDown={handleMouseDown(h.mode)}
              style={{
                position: "absolute",
                width: 10,
                height: 10,
                background: "#fff",
                border: `1.5px solid ${color}`,
                borderRadius: 2,
                cursor: h.cursor,
                ...h.style,
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}

function FieldSettings({
  field,
  onChange,
  label,
}: {
  field: NameFieldConfig;
  onChange?: (cfg: NameFieldConfig) => void;
  label: string;
}) {
  const emit = useCallback(
    (patch: Partial<NameFieldConfig>) => {
      onChange?.({ ...field, ...patch });
    },
    [field, onChange],
  );

  return (
    <Space direction="vertical" size="small" style={{ width: "100%" }}>
      <Text strong style={{ fontSize: 13 }}>{label}</Text>
      <div>
        <Text style={{ fontSize: 12 }}>字体</Text>
        <Select
          value={field.fontFamily}
          onChange={(v) => emit({ fontFamily: v })}
          options={FONT_OPTIONS}
          style={{ width: "100%", marginTop: 2 }}
          size="small"
        />
      </div>
      <div>
        <Text style={{ fontSize: 12 }}>字号 (px)</Text>
        <InputNumber
          value={field.fontSize}
          min={8}
          max={200}
          onChange={(v) => emit({ fontSize: v ?? 36 })}
          style={{ width: "100%", marginTop: 2 }}
          size="small"
        />
      </div>
      <div>
        <Text style={{ fontSize: 12 }}>字重</Text>
        <Select
          value={field.fontWeight}
          onChange={(v) => emit({ fontWeight: v })}
          options={[
            { value: "normal", label: "常规" },
            { value: "bold", label: "加粗" },
          ]}
          style={{ width: "100%", marginTop: 2 }}
          size="small"
        />
      </div>
      <div>
        <Text style={{ fontSize: 12 }}>颜色</Text>
        <div style={{ marginTop: 2 }}>
          <ColorPicker
            size="small"
            value={field.color}
            onChange={(c) => emit({ color: c.toHexString() })}
            showText
          />
        </div>
      </div>
      <div>
        <Text style={{ fontSize: 12 }}>字间距 (px)</Text>
        <InputNumber
          value={field.letterSpacing}
          min={0}
          max={50}
          onChange={(v) => emit({ letterSpacing: v ?? 0 })}
          style={{ width: "100%", marginTop: 2 }}
          size="small"
        />
      </div>
      <div>
        <Text style={{ fontSize: 12 }}>对齐</Text>
        <Radio.Group
          value={field.textAlign}
          onChange={(e) => emit({ textAlign: e.target.value })}
          size="small"
          optionType="button"
          buttonStyle="solid"
          style={{ marginTop: 2, display: "flex" }}
          options={[
            { value: "left", label: "左" },
            { value: "center", label: "中" },
            { value: "right", label: "右" },
          ]}
        />
      </div>
    </Space>
  );
}

/**
 * 扫描件证书模板编辑器：背景图 + 可拖拽/缩放的姓名定位框 + 证书编号定位框。
 */
const ScanTemplateEditor = forwardRef<HTMLDivElement, Props>(function ScanTemplateEditor(
  { backgroundUrl, nameField, onNameFieldChange, certNoField, onCertNoFieldChange, studentName, certNo, readOnly = false },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [naturalRatio, setNaturalRatio] = useState<number | null>(null);
  const [displayH, setDisplayH] = useState(0);
  const [naturalH, setNaturalH] = useState(0);

  const namePlaceholder = studentName || "[学生姓名]";
  const certNoPlaceholder = certNo || "CJ-2026-000001";

  const onImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.naturalWidth && img.naturalHeight) {
      setNaturalRatio(img.naturalWidth / img.naturalHeight);
      setNaturalH(img.naturalHeight);
    }
    setDisplayH(img.clientHeight);
  };

  const fields: FieldInfo[] = [
    {
      field: nameField,
      onChange: onNameFieldChange,
      label: "姓名",
      placeholder: namePlaceholder,
      color: "#1677ff",
    },
  ];

  if (certNoField) {
    fields.push({
      field: certNoField,
      onChange: onCertNoFieldChange,
      label: "证书编号",
      placeholder: certNoPlaceholder,
      color: "#52c41a",
    });
  }

  const canvas = (
    <div
      ref={ref}
      style={{
        position: "relative",
        width: "100%",
        userSelect: "none",
        aspectRatio: naturalRatio ? `${naturalRatio}` : undefined,
        background: backgroundUrl ? undefined : "#f5f5f5",
      }}
    >
      <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
        {backgroundUrl ? (
          <img
            src={backgroundUrl}
            referrerPolicy="no-referrer"
            draggable={false}
            onLoad={onImgLoad}
            style={{ display: "block", width: "100%", height: "auto" }}
            alt="证书背景"
          />
        ) : (
          <div
            style={{
              width: "100%",
              paddingTop: "70%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#999",
            }}
          >
            <span style={{ position: "absolute" }}>请先上传背景图</span>
          </div>
        )}

        {backgroundUrl && fields.map((fi, idx) => (
          <FieldBox
            key={idx}
            fieldInfo={fi}
            containerRef={containerRef}
            displayH={displayH}
            naturalH={naturalH}
            readOnly={readOnly}
          />
        ))}
      </div>
    </div>
  );

  if (readOnly) return canvas;

  return (
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
      <div style={{ flex: 1, minWidth: 0 }}>{canvas}</div>
      <Space direction="vertical" style={{ width: 200, flexShrink: 0 }} size="middle">
        <FieldSettings field={nameField} onChange={onNameFieldChange} label="姓名字段" />
        {certNoField && onCertNoFieldChange && (
          <>
            <div style={{ borderTop: "1px solid #f0f0f0", margin: "4px 0" }} />
            <FieldSettings field={certNoField} onChange={onCertNoFieldChange} label="证书编号字段" />
          </>
        )}
      </Space>
    </div>
  );
});

export default ScanTemplateEditor;
