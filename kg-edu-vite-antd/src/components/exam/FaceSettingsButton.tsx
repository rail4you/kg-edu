import { Button, Divider, Popover, Switch, Typography } from "antd";
import { SettingOutlined } from "@ant-design/icons";
import { FACE_SCENE_LABEL, type FaceCheckSettings } from "@/lib/face-settings";

const { Text } = Typography;

interface FaceSettingsButtonProps {
  settings: FaceCheckSettings;
  onChange: (s: FaceCheckSettings) => void;
  size?: "small" | "middle";
  label?: boolean;
}

export default function FaceSettingsButton({ settings, onChange, size = "small", label }: FaceSettingsButtonProps) {
  const set = (patch: Partial<FaceCheckSettings>) => onChange({ ...settings, ...patch });

  const content = (
    <div style={{ width: 280 }}>
      <Text strong>抓拍节点</Text>
      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
        {(["entry", "video_start", "video_playing", "video_resume", "video_end"] as const).map((node) => (
          <div key={node} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontSize: 13 }}>{FACE_SCENE_LABEL[node]}</Text>
            <Switch
              size="small"
              checked={settings.nodes[node]}
              onChange={(v) => set({ nodes: { ...settings.nodes, [node]: v } })}
            />
          </div>
        ))}
      </div>

      <Divider style={{ margin: "12px 0" }} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ fontSize: 13 }}>定时抓拍（每 {Math.round(settings.timedIntervalSec / 60)} 分钟）</Text>
        <Switch size="small" checked={settings.timedEnabled} onChange={(v) => set({ timedEnabled: v })} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
        <Text style={{ fontSize: 13 }}>随机抓拍</Text>
        <Switch size="small" checked={settings.randomEnabled} onChange={(v) => set({ randomEnabled: v })} />
      </div>

      <Divider style={{ margin: "12px 0" }} />

      <Text strong style={{ fontSize: 13 }}>识别失败处理</Text>
      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
        <Button
          size="small"
          type={settings.mode === "record" ? "primary" : "default"}
          onClick={() => set({ mode: "record" })}
        >
          记录并继续
        </Button>
        <Button
          size="small"
          danger
          type={settings.mode === "block" ? "primary" : "default"}
          onClick={() => set({ mode: "block" })}
        >
          不允许学习
        </Button>
      </div>

      <Divider style={{ margin: "12px 0" }} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ fontSize: 13 }}>演示：模拟识别失败</Text>
        <Switch size="small" checked={settings.simulateFail} onChange={(v) => set({ simulateFail: v })} />
      </div>
    </div>
  );

  return (
    <Popover content={content} title="抓拍设置" trigger="click" placement="bottomRight">
      <Button size={size} icon={<SettingOutlined />}>
        {label ? "抓拍设置" : null}
      </Button>
    </Popover>
  );
}
