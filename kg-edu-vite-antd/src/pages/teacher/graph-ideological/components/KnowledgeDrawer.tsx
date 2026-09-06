import React from "react";
import { Drawer, Typography, Tag, Tabs, Button } from "antd";
import { CloseOutlined, ReadOutlined, FileOutlined } from "@ant-design/icons";
import { KnowledgePoint } from "../types";

const { Title, Text } = Typography;

interface KnowledgeDrawerProps {
  open: boolean;
  onClose: () => void;
  knowledge: KnowledgePoint | null;
}

const KnowledgeDrawer: React.FC<KnowledgeDrawerProps> = ({
  open,
  onClose,
  knowledge,
}) => {
  const [activeTab, setActiveTab] = React.useState("files");

  const tabItems = [
    {
      key: "files",
      label: (
        <span>
          <FileOutlined style={{ marginRight: 4 }} />
          文件
        </span>
      ),
      children: (
        <div style={{ padding: 16 }}>
          <Text type="secondary">此知识点暂无相关文件</Text>
        </div>
      ),
    },
    {
      key: "exercises",
      label: (
        <span>
          <ReadOutlined style={{ marginRight: 4 }} />
          练习
        </span>
      ),
      children: (
        <div style={{ padding: 16 }}>
          <Text type="secondary">此知识点暂无相关练习</Text>
        </div>
      ),
    },
  ];

  return (
    <Drawer
      title={
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>知识点详情</span>
          <Button type="text" icon={<CloseOutlined />} onClick={onClose} />
        </div>
      }
      placement="right"
      width={600}
      onClose={onClose}
      open={open}
      closable={false}
    >
      {knowledge && (
        <>
          <div
            style={{
              padding: 16,
              backgroundColor: "#f5f5f5",
              borderBottom: "1px solid #e8e8e8",
              marginBottom: 16,
            }}
          >
            <Title level={4} style={{ marginBottom: 12 }}>
              {knowledge.name}
            </Title>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                marginBottom: 12,
              }}
            >
              <Tag color="blue">知识点</Tag>
            </div>
            {knowledge.description && (
              <Text type="secondary">{knowledge.description}</Text>
            )}
          </div>
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={tabItems}
          />
        </>
      )}
    </Drawer>
  );
};

export default KnowledgeDrawer;
