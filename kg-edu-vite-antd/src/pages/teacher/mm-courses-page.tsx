import { useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Empty, Button } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import ContextSelector from "@/components/micro-major/context-selector";
import { AppPage } from "@/components/proto";
import { useEditPermission } from "@/hooks/use-edit-permission";
import MicroMajorCourseList, { type MicroMajorCourseListHandle } from "./mm-course-list";

export default function MMCoursesPage() {
  const [searchParams] = useSearchParams();
  const mmId = searchParams.get("mmId");
  const listRef = useRef<MicroMajorCourseListHandle>(null);
  const { canEdit } = useEditPermission();

  return (
    <AppPage
      className="mm-courses-page-wrap"
      title="课程管理"
      description="管理微专业课程"
      breadcrumb={<>微专业&nbsp;&nbsp;/&nbsp;&nbsp;课程管理</>}
      actions={
        mmId && canEdit ? (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => listRef.current?.openCreate()}>
            新增课程
          </Button>
        ) : undefined
      }
    >
      <style>{`@media(max-width:768px){.mm-courses-page-wrap{padding:12px!important}.mm-courses-page-wrap .ant-table-cell{padding:6px 4px!important}}`}</style>

      <ContextSelector />

      {mmId ? (
        <MicroMajorCourseList ref={listRef} mmId={mmId} standalone={false} />
      ) : (
        <Empty description="请在上方选择一个微专业" />
      )}
    </AppPage>
  );
}
