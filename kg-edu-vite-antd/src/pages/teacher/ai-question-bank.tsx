import { Card, Empty } from "antd";
import { AppPage } from "@/components/proto";

export default function AIQuestionBankPage() {
  return (
    <AppPage title="AI题库" description="AI智能题库功能开发中...">
      <Card>
        <Empty description="功能开发中" />
      </Card>
    </AppPage>
  );
}
