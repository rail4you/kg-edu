import { Card, Typography, Empty } from "antd";

const { Title, Text } = Typography;

export default function AIQuestionBankPage() {
  return (
    <div style={{ padding: 24 }}>
      <Card>
        <div style={{ textAlign: "center", padding: 60 }}>
          <Title level={4} style={{ color: "#333", marginBottom: 12 }}>
            AI题库
          </Title>
          <Text style={{ color: "#666" }}>
            AI智能题库功能开发中...
          </Text>
        </div>
        <Empty description="功能开发中" />
      </Card>
    </div>
  );
}
