import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Spin, Typography } from "antd";
import { fetchStudentSmartPortal, EMPTY_LAYOUT } from "@/lib/smart-portal";
import { SmartPortalRenderer } from "@/components/smart-portal/SmartPortalRenderer";
import { PageHead } from "@/components/proto";
import { useSmartPortalData } from "@/components/smart-portal/use-smart-portal-data";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";

const { Text } = Typography;

export default function StudentSmartPortal() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const headers = useMemo(() => getAuthHeaders(user) as Record<string, string>, [user]);

  const layoutQuery = useQuery({
    queryKey: ["student-smart-portal", user?.id],
    queryFn: () => fetchStudentSmartPortal(user?.id, headers),
    staleTime: 60 * 1000,
    enabled: !!user?.id,
  });
  const dataQuery = useSmartPortalData();

  const layout = layoutQuery.data?.layout ?? EMPTY_LAYOUT;
  const config = layoutQuery.data;

  return (
    <div className="pu-page">
      <PageHead
        title={config?.name || "智能门户"}
        description={
          config?.assigned
            ? "由你的老师配置的 AI 实践与学习模块。"
            : "汇集 AI 实践、课程、知识点与学情数据的个性化门户。"
        }
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
