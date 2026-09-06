import React, { useState } from "react";
import { Card, Button, Typography, Empty, Space, Spin, Drawer, Descriptions, Tag } from "antd";
import { DownloadOutlined, FileTextOutlined, EyeOutlined } from "@ant-design/icons";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const { Text, Paragraph } = Typography;

interface CurriculumDesign {
  id: string;
  title: string;
  description?: string | null;
  designData?: string | null;
  aiGenerated?: boolean;
  version?: number;
  status?: string;
  insertedAt?: string;
}

interface StudentCurriculumListProps {
  curriculumDesigns: CurriculumDesign[];
  loading?: boolean;
}

interface CurriculumContent {
  semesters?: Array<{
    semester: number;
    courses: Array<{
      name: string;
      credits: number;
      type: string;
    }>;
  }>;
  markdown?: string;
}

function parseDesignData(designData: string | null | undefined): CurriculumContent | null {
  if (!designData) return null;
  try {
    return JSON.parse(designData);
  } catch {
    return { markdown: designData };
  }
}

function CourseCard({ curriculum }: { curriculum: CurriculumDesign }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const content = parseDesignData(curriculum.designData);

  const handleDownload = () => {
    // 如果有 markdown 内容，可以下载
    if (content?.markdown) {
      const blob = new Blob([content.markdown], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${curriculum.title || "课程体系"}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <>
      <Card
        size="small"
        style={{ marginBottom: 8 }}
        title={
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 600 }}>{curriculum.title || "未命名课程体系"}</span>
            <Space>
              {curriculum.aiGenerated && <Tag color="blue">AI生成</Tag>}
              {curriculum.status === "published" && <Tag color="green">已发布</Tag>}
            </Space>
          </div>
        }
        extra={
          <Space>
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => setPreviewOpen(true)}
            >
              预览
            </Button>
            {content?.markdown && (
              <Button
                size="small"
                type="primary"
                icon={<DownloadOutlined />}
                onClick={handleDownload}
              >
                下载
              </Button>
            )}
          </Space>
        }
      >
        <Text type="secondary" style={{ fontSize: 12 }}>
          {curriculum.description || "暂无描述"}
        </Text>
        {content?.semesters && (
          <div style={{ marginTop: 8 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              包含 {content.semesters.length} 个学期课程安排
            </Text>
          </div>
        )}
        {curriculum.insertedAt && (
          <div style={{ marginTop: 4 }}>
            <Text type="secondary" style={{ fontSize: 11 }}>
              生成时间: {new Date(curriculum.insertedAt).toLocaleString("zh-CN")}
            </Text>
          </div>
        )}
      </Card>

      {/* Preview Drawer */}
      <Drawer
        title={curriculum.title || "课程体系预览"}
        placement="right"
        width={600}
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
      >
        {content?.markdown ? (
          <div
            style={{
              background: "#fafafa",
              border: "1px solid #f0f0f0",
              borderRadius: 6,
              padding: 20,
              maxHeight: "calc(100vh - 120px)",
              overflow: "auto",
              fontSize: 14,
              lineHeight: 1.8,
            }}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content.markdown}
            </ReactMarkdown>
          </div>
        ) : content?.semesters ? (
          <div>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="课程体系版本">V{curriculum.version || 1}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={curriculum.status === "published" ? "green" : "default"}>
                  {curriculum.status === "published" ? "已发布" : "草稿"}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="学期数">{content.semesters.length}</Descriptions.Item>
            </Descriptions>

            {content.semesters.map((sem) => (
              <Card
                key={sem.semester}
                size="small"
                title={`第 ${sem.semester} 学期`}
                style={{ marginTop: 16 }}
              >
                {sem.courses.map((course, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "6px 0",
                      borderBottom: idx < sem.courses.length - 1 ? "1px solid #f0f0f0" : "none",
                    }}
                  >
                    <Text>{course.name}</Text>
                    <Space size={8}>
                      <Tag>{course.credits} 学分</Tag>
                      <Tag color="blue">{course.type}</Tag>
                    </Space>
                  </div>
                ))}
              </Card>
            ))}
          </div>
        ) : (
          <Empty description="暂无详细内容" />
        )}
      </Drawer>
    </>
  );
}

export default function StudentCurriculumList({ curriculumDesigns, loading }: StudentCurriculumListProps) {
  if (loading) {
    return (
      <Card style={{ textAlign: "center" }}>
        <Spin size="large" />
      </Card>
    );
  }

  if (!curriculumDesigns || curriculumDesigns.length === 0) {
    return (
      <Card>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <Space direction="vertical" size={4}>
              <Text type="secondary">
                教师暂未生成课程体系
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                请等待教师完成课程体系设计
              </Text>
            </Space>
          }
        />
      </Card>
    );
  }

  // 只显示最近生成的一套课程体系
  const sortedDesigns = [...curriculumDesigns].sort((a, b) => {
    const dateA = a.insertedAt ? new Date(a.insertedAt).getTime() : 0;
    const dateB = b.insertedAt ? new Date(b.insertedAt).getTime() : 0;
    return dateB - dateA; // 最新的排在前面
  });
  const displayDesign = sortedDesigns[0];

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Text strong style={{ fontSize: 14 }}>
          <FileTextOutlined style={{ marginRight: 6 }} />
          课程体系
        </Text>
      </div>
      <CourseCard curriculum={displayDesign} />
    </div>
  );
}