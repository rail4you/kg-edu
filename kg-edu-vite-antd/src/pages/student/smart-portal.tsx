import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, Spin, Typography } from "antd";
import { fetchSmartPortalLayout, EMPTY_LAYOUT } from "@/lib/smart-portal";
import { SmartPortalRenderer } from "@/components/smart-portal/SmartPortalRenderer";
import { useSmartPortalData } from "@/components/smart-portal/use-smart-portal-data";

const { Title, Text } = Typography;

export default function StudentSmartPortal() {
  const navigate = useNavigate();

  const layoutQuery = useQuery({
    queryKey: ["smart-portal-layout"],
    queryFn: fetchSmartPortalLayout,
    staleTime: 5 * 60 * 1000,
  });
  const dataQuery = useSmartPortalData();

  const layout = layoutQuery.data?.layout ?? EMPTY_LAYOUT;
  const config = layoutQuery.data;

  return (
    <div style={{ padding: "20px 24px", maxWidth: 1280, margin: "0 auto" }}>
      <div style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          {config?.name || "智能门户"}
        </Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          汇集课程、知识点与学情数据的个性化门户
        </Text>
      </div>

      <Spin spinning={layoutQuery.isLoading}>
        {config && !config.enabled ? (
          <Card>
            <Text type="secondary">门户暂未启用</Text>
          </Card>
        ) : (
          <SmartPortalRenderer
            layout={layout}
            data={
              dataQuery.data ?? {
                courses: [],
                knowledgePoints: [],
                stats: { courses: 0, students: 0, videos: 0, exercises: 0 },
                loading: false,
                errorSources: [],
              }
            }
            loading={dataQuery.isFetching}
            onNavigate={navigate}
          />
        )}
      </Spin>
    </div>
  );
}
