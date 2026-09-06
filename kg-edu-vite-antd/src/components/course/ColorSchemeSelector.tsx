import React, { useMemo, useState } from "react";
import {
  Modal,
  Button,
  Select,
  Spin,
  Typography,
  Space,
  Card,
  Tooltip,
} from "antd";
import {
  BgColorsOutlined,
  CheckOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { getCourseByGuest } from "@/lib/ash_rpc";
import { getCurrentTenant } from "@/lib/tenant";
import { useAuth } from "@/auth/auth-context";
import { getHeaders } from "@/utils/api-helpers";

const { Text, Title } = Typography;

type ColorSchemeKey =
  | "auto"
  | "pure"
  | "graphite_blue"
  | "sea_mist"
  | "pine_green"
  | "amber_brown"
  | "mist_purple"
  | "inkstone_gray"
  | "celadon_gray";

interface ColorSchemeOption {
  key: ColorSchemeKey;
  name: string;
  description: string;
  swatch: string;
  preview: {
    headerBg: string;
    cardBg: string;
    textColor: string;
    accentColor: string;
  };
}

const colorSchemeOptions: ColorSchemeOption[] = [
  {
    key: "auto",
    name: "自动匹配",
    description: "根据课程图片稳定映射到专业色域",
    swatch: "linear-gradient(135deg, #506481 0%, #9aa9bc 100%)",
    preview: {
      headerBg: "rgba(14, 20, 31, 0.82)",
      cardBg: "rgba(33, 44, 61, 0.58)",
      textColor: "#f7fbff",
      accentColor: "#80a0cb",
    },
  },
  {
    key: "pure",
    name: "纯图模式",
    description: "只显示背景图片，不叠加颜色滤镜",
    swatch: "linear-gradient(135deg, #ffffff 0%, #f0f0f0 100%)",
    preview: {
      headerBg: "rgba(255, 255, 255, 0.92)",
      cardBg: "rgba(255, 255, 255, 0.72)",
      textColor: "#1a1a1a",
      accentColor: "#4a6d99",
    },
  },
  {
    key: "graphite_blue",
    name: "石墨蓝",
    description: "冷静克制，适合作为默认推荐方案",
    swatch: "linear-gradient(135deg, #314965 0%, #7e96b4 100%)",
    preview: {
      headerBg: "rgba(14, 20, 31, 0.82)",
      cardBg: "rgba(33, 44, 61, 0.58)",
      textColor: "#f7fbff",
      accentColor: "#80a0cb",
    },
  },
  {
    key: "sea_mist",
    name: "海雾青",
    description: "偏科技与理工表达，适合冷色封面图",
    swatch: "linear-gradient(135deg, #2d4b56 0%, #7ea7b6 100%)",
    preview: {
      headerBg: "rgba(14, 24, 29, 0.82)",
      cardBg: "rgba(31, 49, 56, 0.58)",
      textColor: "#f4fbfc",
      accentColor: "#7da8bd",
    },
  },
  {
    key: "pine_green",
    name: "松烟绿",
    description: "沉静自然，适合知识与研究表达",
    swatch: "linear-gradient(135deg, #31483f 0%, #7f9f8f 100%)",
    preview: {
      headerBg: "rgba(15, 24, 21, 0.82)",
      cardBg: "rgba(30, 48, 42, 0.58)",
      textColor: "#f5fbf7",
      accentColor: "#7ea38d",
    },
  },
  {
    key: "amber_brown",
    name: "暖金棕",
    description: "温润成熟，适合人文与通识课程",
    swatch: "linear-gradient(135deg, #8e6b45 0%, #e7d2af 100%)",
    preview: {
      headerBg: "rgba(248, 240, 228, 0.84)",
      cardBg: "rgba(255, 251, 246, 0.62)",
      textColor: "#4f3a26",
      accentColor: "#b98556",
    },
  },
  {
    key: "mist_purple",
    name: "雾紫灰",
    description: "理性克制，适合交叉学科与设计表达",
    swatch: "linear-gradient(135deg, #5f5870 0%, #d3cbdd 100%)",
    preview: {
      headerBg: "rgba(242, 239, 247, 0.84)",
      cardBg: "rgba(255, 255, 255, 0.56)",
      textColor: "#4b4559",
      accentColor: "#9f89c2",
    },
  },
  {
    key: "inkstone_gray",
    name: "砚石灰",
    description: "中性稳重，适合建筑、法学、管理类内容",
    swatch: "linear-gradient(135deg, #474f5d 0%, #c7ced9 100%)",
    preview: {
      headerBg: "rgba(241, 244, 248, 0.84)",
      cardBg: "rgba(255, 255, 255, 0.58)",
      textColor: "#444d5c",
      accentColor: "#8799b2",
    },
  },
  {
    key: "celadon_gray",
    name: "瓷青灰",
    description: "清透克制，适合医学、基础学科与浅色封面",
    swatch: "linear-gradient(135deg, #4f6565 0%, #d8e4df 100%)",
    preview: {
      headerBg: "rgba(242, 247, 245, 0.84)",
      cardBg: "rgba(255, 255, 255, 0.58)",
      textColor: "#44615e",
      accentColor: "#87a3b2",
    },
  },
];

interface ColorSchemeSelectorProps {
  courseId: string;
  tenant?: string;
  currentScheme?: string | null;
  onChange: (scheme: ColorSchemeKey) => void;
}

export default function ColorSchemeSelector({
  courseId,
  tenant,
  currentScheme,
  onChange,
}: ColorSchemeSelectorProps) {
  const { user } = useAuth();
  const currentTenant = getCurrentTenant();
  const tenantToUse = tenant || currentTenant?.schemaName || "";
  const [previewVisible, setPreviewVisible] = useState(false);
  const [selectedScheme, setSelectedScheme] = useState<ColorSchemeKey>(
    (currentScheme as ColorSchemeKey) || "auto",
  );

  // 获取课程图片用于预览
  const { data: courseData } = useQuery({
    queryKey: ["course-preview", courseId, tenantToUse],
    queryFn: async () => {
      const result = await getCourseByGuest({
        tenant: tenantToUse,
        fields: ["id", "title", "imageUrl"],
        input: { courseId },
      });
      return result.success ? result.data : null;
    },
    enabled: !!courseId && !!tenantToUse,
  });

  const handleSave = () => {
    onChange(selectedScheme);
    setPreviewVisible(false);
  };

  const selectedOption = colorSchemeOptions.find(
    (opt) => opt.key === selectedScheme,
  );

  return (
    <>
      <Tooltip title="设置课程主页颜色主题">
        <Button
          icon={<BgColorsOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            setPreviewVisible(true);
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          颜色主题
          {currentScheme && currentScheme !== "auto" && (
            <span
              style={{
                width: 16,
                height: 16,
                borderRadius: "50%",
                background:
                  colorSchemeOptions.find((o) => o.key === currentScheme)?.swatch ||
                  "#ccc",
              }}
            />
          )}
        </Button>
      </Tooltip>

      <Modal
        open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        title={
          <Space>
            <BgColorsOutlined />
            <span>课程主页颜色主题设置</span>
          </Space>
        }
        width={900}
        footer={[
          <Button
            key="cancel"
            onClick={(e) => {
              // 阻止事件冒泡到卡片，避免误跳转
              e.stopPropagation();
              setPreviewVisible(false);
            }}
          >
            取消
          </Button>,
          <Button
            key="save"
            type="primary"
            onClick={(e) => {
              // 阻止事件冒泡到卡片，避免误跳转
              e.stopPropagation();
              handleSave();
            }}
          >
            保存设置
          </Button>,
        ]}
      >
        <div style={{ padding: "16px 0" }}>
          <Text type="secondary" style={{ marginBottom: 16, display: "block" }}>
            选择课程主页的展示风格。预览效果基于课程封面图片 {courseData?.imageUrl ? "✓ 已加载" : "加载中..."}
          </Text>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            {/* 左侧：主题选择 */}
            <div>
              <Title level={5} style={{ marginBottom: 12 }}>
                主题方案
              </Title>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {colorSchemeOptions.map((option) => (
                  <div
                    key={option.key}
                    onClick={(e) => {
                      // 阻止事件冒泡到卡片，避免误跳转到课程详情页
                      e.stopPropagation();
                      setSelectedScheme(option.key);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 12px",
                      borderRadius: 8,
                      cursor: "pointer",
                      border:
                        selectedScheme === option.key
                          ? "2px solid #1890ff"
                          : "2px solid transparent",
                      background:
                        selectedScheme === option.key
                          ? "#f0f7ff"
                          : "#fafafa",
                      transition: "all 0.2s",
                    }}
                  >
                    <span
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        flexShrink: 0,
                        background: option.swatch,
                        boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.08)",
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>
                        {option.name}
                      </div>
                      <div style={{ fontSize: 12, color: "#8c8c8c" }}>
                        {option.description}
                      </div>
                    </div>
                    {selectedScheme === option.key && (
                      <CheckOutlined style={{ color: "#1890ff" }} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 右侧：预览效果 */}
            <div>
              <Title level={5} style={{ marginBottom: 12 }}>
                预览效果
              </Title>
              <div
                style={{
                  width: "100%",
                  height: 280,
                  borderRadius: 12,
                  overflow: "hidden",
                  position: "relative",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                }}
              >
                {/* 背景图片或渐变 */}
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    bottom: 0,
                    left: 0,
                    inset: 0,
                    backgroundImage: courseData?.imageUrl
                      ? selectedScheme === "pure"
                        ? `url(${courseData.imageUrl})`
                        : `linear-gradient(180deg, ${selectedOption?.preview.headerBg} 0%, ${selectedOption?.preview.cardBg} 100%), url(${courseData.imageUrl})`
                      : selectedOption?.swatch || "#666",
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                />

                {/* 预览内容叠加层 */}
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    bottom: 0,
                    left: 0,
                    inset: 0,
                    padding: 16,
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  {/* 模拟顶部导航 */}
                  <div
                    style={{
                      height: 36,
                      borderRadius: 8,
                      background: selectedOption?.preview.headerBg || "rgba(0,0,0,0.5)",
                      display: "flex",
                      alignItems: "center",
                      padding: "0 12px",
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 4,
                        background: selectedOption?.preview.textColor || "#fff",
                        opacity: 0.8,
                      }}
                    />
                    <span
                      style={{
                        color: selectedOption?.preview.textColor || "#fff",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      智慧教学系统
                    </span>
                  </div>

                  {/* 模拟标题区域 */}
                  <div style={{ flex: 1 }}>
                    <h2
                      style={{
                        margin: 0,
                        color: selectedOption?.preview.textColor || "#fff",
                        fontSize: 18,
                        fontWeight: 700,
                      }}
                    >
                      {courseData?.title || "课程标题"}
                    </h2>
                    <p
                      style={{
                        margin: "4px 0 0",
                        color: selectedOption?.preview.textColor || "#fff",
                        opacity: 0.8,
                        fontSize: 12,
                      }}
                    >
                      学期：2024春季 | 学时：48
                    </p>
                  </div>

                  {/* 模拟卡片 */}
                  <div
                    style={{
                      height: 80,
                      borderRadius: 8,
                      background: selectedOption?.preview.cardBg || "rgba(0,0,0,0.3)",
                      backdropFilter: "blur(8px)",
                      padding: 12,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                    }}
                  >
                    <span
                      style={{
                        color: selectedOption?.preview.textColor || "#fff",
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      课程简介
                    </span>
                    <span
                      style={{
                        color: selectedOption?.preview.textColor || "#fff",
                        opacity: 0.7,
                        fontSize: 11,
                        marginTop: 4,
                      }}
                    >
                      课程介绍内容预览...
                    </span>
                  </div>
                </div>

                {/* 主题标签 */}
                <div
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    padding: "4px 10px",
                    borderRadius: 12,
                    background: selectedOption?.preview.accentColor || "#666",
                    color: "#fff",
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  {selectedOption?.name}
                </div>
              </div>

              <Text
                type="secondary"
                style={{ marginTop: 12, display: "block", fontSize: 12 }}
              >
                预览效果仅供参考，实际效果可能因浏览器和设备略有差异
              </Text>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}

export { colorSchemeOptions, type ColorSchemeKey, type ColorSchemeOption };