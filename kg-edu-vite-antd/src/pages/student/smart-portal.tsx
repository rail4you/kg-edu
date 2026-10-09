import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Spin, Typography } from "antd";
import { fetchSmartPortalLayout, EMPTY_LAYOUT } from "@/lib/smart-portal";
import { SmartPortalRenderer } from "@/components/smart-portal/SmartPortalRenderer";
import { PageHead } from "@/components/proto";
import { useSmartPortalData } from "@/components/smart-portal/use-smart-portal-data";

const { Text } = Typography;

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
    <div className="pu-page">
      <PageHead
        title={config?.name || "智能门户"}
        description="汇集课程、知识点与学情数据的个性化门户。"
      />

      <Spin spinning={layoutQuery.isLoading}>
        {config && !config.enabled ? (
          <div className="pu-card" style={{ padding: 24 }}>
            <Text type="secondary">门户暂未启用</Text>
          </div>
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
