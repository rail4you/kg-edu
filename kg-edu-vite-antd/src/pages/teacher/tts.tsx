import * as React from "react";
import { useState, useEffect, useRef } from "react";
import {
  Card, Button, Typography, Spin, Input, Select, Slider, Tag, Space, message,
  Row, Col, Alert, Divider,
} from "antd";
import { ArrowLeftOutlined, PlayCircleOutlined, LoadingOutlined, CopyOutlined, CheckOutlined } from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { useNavigate } from "react-router-dom";
import { getAuthHeaders } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

interface Voice {
  voice: string;
  label: string;
  gender: string;
  language: string;
}

const LANGUAGE_OPTIONS = [
  { value: "zh", label: "中文" },
  { value: "en", label: "英语" },
  { value: "ja", label: "日语" },
  { value: "es", label: "西班牙语" },
];

/** cosyvoice-v3-flash 情感指令（instruction 须为中文固定格式） */
const EMOTIONS = [
  { value: "", label: "无（自然语气）" },
  { value: "neutral", label: "平静" },
  { value: "happy", label: "开心" },
  { value: "sad", label: "悲伤" },
  { value: "angry", label: "生气" },
  { value: "surprised", label: "惊讶" },
  { value: "fearful", label: "害怕" },
  { value: "disgusted", label: "厌恶" },
];

/** 听力题/口语测评题快速模板 */
const LISTENING_PRESETS = [
  "请听下面的对话，回答问题：你今天打算去哪里？",
  "听力填空题：The weather is ___ today.",
  "口语测评题：请用英语介绍你的家乡。",
];

export default function TtsSynthesis() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const currentTenant = getCurrentTenant();
  const tenant = currentTenant?.schemaName || "";
  const headers = getAuthHeaders(user) as Record<string, string>;

  const [voices, setVoices] = useState<Voice[]>([]);
  const [voice, setVoice] = useState("longxiaochun");
  const [speechRate, setSpeechRate] = useState(1.0);
  const [volume, setVolume] = useState(50);
  const [language, setLanguage] = useState("zh");
  const [emotion, setEmotion] = useState("");
  const [text, setText] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [synthesizing, setSynthesizing] = useState(false);
  const [copied, setCopied] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    fetch("/api/tts/voices", { headers: { ...headers, "x-org-schema": tenant } })
      .then((r) => r.json())
      .then((r) => {
        if (r.success && Array.isArray(r.data)) {
          setVoices(r.data);
          if (r.data.length > 0) setVoice(r.data[0].voice);
        }
      })
      .catch(() => message.error("加载音色列表失败"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const selectedVoice = voices.find((v) => v.voice === voice);

  const copyUrl = async () => {
    if (!audioUrl) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(audioUrl);
      } else {
        throw new Error("no clipboard api");
      }
      setCopied(true);
      message.success("链接已复制");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 降级方案：临时 textarea + execCommand
      try {
        const ta = document.createElement("textarea");
        ta.value = audioUrl;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopied(true);
        message.success("链接已复制");
        setTimeout(() => setCopied(false), 2000);
      } catch {
        message.error("复制失败，请手动复制");
      }
    }
  };

  const synthesize = async () => {
    const t = text.trim();
    if (!t) {
      message.warning("请输入要合成的文字");
      return;
    }
    setSynthesizing(true);
    setAudioUrl("");
    try {
      // cosyvoice-v3-flash 的 instruction 须为中文固定格式；未选情感则不传
      const instruction =
        emotion && emotion !== "" ? `你说话的情感是${emotion}。` : undefined;
      const r = await fetch("/api/tts/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers, "x-org-schema": tenant },
        body: JSON.stringify({
          tenant,
          text: t,
          voice,
          speech_rate: speechRate,
          volume,
          language,
          instruction,
          userId: user?.id,
        }),
      }).then((x) => x.json());
      if (r.success) {
        setAudioUrl(r.url);
        message.success("语音合成成功，可点击播放试听");
      } else {
        message.error(r.error || "合成失败");
      }
    } finally {
      setSynthesizing(false);
    }
  };

  const voiceLabel = (v: Voice) =>
    `${v.label}${v.language && v.language !== "zh" ? `（${v.language}）` : ""}`;

  if (authLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f5", paddingBottom: 24 }}>
      <div style={{ padding: 24, background: "white", borderBottom: "1px solid #e0e0e0", display: "flex", alignItems: "center", gap: 8 }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} style={{ color: "#1890ff" }} />
        <Title level={4} style={{ margin: 0 }}>AI 语音合成（听力题 / 口语测评）</Title>
        <Text type="secondary" style={{ marginLeft: 8 }}>文字 → 多音色多语言语音</Text>
      </div>

      <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={14}>
            <Card title="1. 输入合成文本">
              <TextArea
                rows={5}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="输入要合成语音的文字，用于听力题或口语测评题，如：请听下面的对话并回答问题……"
              />
              <Divider orientation="left" plain style={{ margin: "12px 0" }}>
                <Text type="secondary" style={{ fontSize: 12 }}>听力 / 口语题快速模板</Text>
              </Divider>
              <Space wrap>
                {LISTENING_PRESETS.map((p) => (
                  <Button key={p} size="small" onClick={() => setText(p)}>{p.slice(0, 16)}…</Button>
                ))}
              </Space>
            </Card>

            <Card title="2. 语音参数（音色 / 语速 / 音量 / 语言）" style={{ marginTop: 16 }}>
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Text strong>音色（支持男女声 / 多语言 / 情感音色）</Text>
                  <Select
                    style={{ width: "100%", marginTop: 8 }}
                    value={voice}
                    onChange={setVoice}
                    options={voices.map((v) => ({
                      value: v.voice,
                      label: `${voiceLabel(v)} · ${v.gender === "male" ? "男声" : "女声"}`,
                    }))}
                  />
                  {selectedVoice && (
                    <Text type="secondary" style={{ display: "block", marginTop: 4, fontSize: 12 }}>
                      支持语言：{selectedVoice.language}
                    </Text>
                  )}
                </Col>
                <Col xs={24} md={12}>
                  <Text strong>语言</Text>
                  <Select
                    style={{ width: "100%", marginTop: 8 }}
                    value={language}
                    onChange={setLanguage}
                    options={LANGUAGE_OPTIONS}
                  />
                </Col>
              </Row>
              <Divider style={{ margin: "16px 0 8px" }} />
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Text>语速（0.5 ~ 2.0）：{speechRate.toFixed(1)}</Text>
                  <Slider min={0.5} max={2} step={0.1} value={speechRate} onChange={(v) => setSpeechRate(v as number)} />
                </Col>
                <Col xs={24} md={12}>
                  <Text>音量（0 ~ 100）：{volume}</Text>
                  <Slider min={0} max={100} value={volume} onChange={(v) => setVolume(v as number)} />
                </Col>
              </Row>
              <div style={{ marginTop: 8 }}>
                <Text strong>情感语气（可选）</Text>
                <Select
                  style={{ width: "100%", marginTop: 8 }}
                  value={emotion}
                  onChange={setEmotion}
                  options={EMOTIONS}
                />
              </div>
            </Card>
          </Col>

          <Col xs={24} lg={10}>
            <Card title="3. 合成并试听">
              <Button type="primary" size="large" block icon={<PlayCircleOutlined />} loading={synthesizing} onClick={synthesize}>
                合成语音
              </Button>
              {synthesizing && (
                <div style={{ textAlign: "center", marginTop: 16 }}>
                  <LoadingOutlined style={{ fontSize: 28, color: "#1890ff" }} />
                  <Text type="secondary" style={{ display: "block", marginTop: 8 }}>正在调用 AI 语音合成服务…</Text>
                </div>
              )}
              {audioUrl && (
                <div style={{ marginTop: 16 }}>
                  <Text strong>合成结果：</Text>
                  <audio controls src={audioUrl} ref={audioRef} style={{ width: "100%", marginTop: 8 }} />
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      音频已保存至系统资源，可复制链接用于听力题 / 口语测评题：
                    </Text>
                    <Button
                      size="small"
                      icon={copied ? <CheckOutlined /> : <CopyOutlined />}
                      onClick={copyUrl}
                    >
                      {copied ? "已复制" : "复制链接"}
                    </Button>
                  </div>
                </div>
              )}
            </Card>

            <Card title="应用场景说明" style={{ marginTop: 16, background: "#f6f0ff" }}>
              <Paragraph style={{ margin: 0, fontSize: 13, lineHeight: 1.8 }}>
                · <Text strong>听力题</Text>：将题干 / 听力原文合成为语音，供听力练习或考试播放。<br />
                · <Text strong>口语测评题</Text>：合成标准发音，作为示范或评分参考。<br />
                · 支持<Text strong>男声 / 女声</Text>、<Text strong>中文 / 英语 / 日语 / 西班牙语</Text>等多语言、<Text strong>语速 / 音量</Text>调节及<Text strong>情感指令</Text>，满足教学与考试要求。
              </Paragraph>
            </Card>

            {voices.length === 0 && (
              <Alert style={{ marginTop: 16 }} type="info" showIcon message="未加载到音色列表，请确认后端已配置 Qwen API Key（provider=qwen）" />
            )}
          </Col>
        </Row>
      </div>
    </div>
  );
}