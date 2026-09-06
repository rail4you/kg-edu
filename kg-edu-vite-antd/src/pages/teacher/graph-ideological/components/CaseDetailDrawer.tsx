import React from "react";
import { Drawer, Descriptions } from "antd";
import { CaseDetail } from "../types";

interface CaseDetailDrawerProps {
  open: boolean;
  caseDetail: CaseDetail | null;
  onClose: () => void;
}

const CaseDetailDrawer: React.FC<CaseDetailDrawerProps> = ({
  open,
  caseDetail,
  onClose,
}) => {
  return (
    <Drawer
      title="案例详情"
      placement="right"
      width={400}
      onClose={onClose}
      open={open}
    >
      {caseDetail && (
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="标题">{caseDetail.title}</Descriptions.Item>
          <Descriptions.Item label="描述">
            {caseDetail.description || "暂无描述"}
          </Descriptions.Item>
          <Descriptions.Item label="关联名称">
            {caseDetail.caseRelationName || "无"}
          </Descriptions.Item>
          <Descriptions.Item label="内容">
            <div style={{ maxHeight: 300, overflow: "auto" }}>
              {caseDetail.content || "暂无内容"}
            </div>
          </Descriptions.Item>
        </Descriptions>
      )}
    </Drawer>
  );
};

export default CaseDetailDrawer;
