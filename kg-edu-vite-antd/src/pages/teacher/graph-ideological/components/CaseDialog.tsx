import React from "react";
import { Modal, Input, Select, Typography, Button } from "antd";
import { CloseOutlined } from "@ant-design/icons";

const { TextArea } = Input;
const { Text } = Typography;

interface CaseDialogProps {
  open: boolean;
  editingItem: {
    type: "knowledge" | "case";
    item?: any;
    isNew: boolean;
  } | null;
  formData: Record<string, any>;
  knowledgeData: any[];
  isLoading: boolean;
  onClose: () => void;
  onSubmit: () => void;
  onFormChange: (field: string, value: any) => void;
}

const CaseDialog: React.FC<CaseDialogProps> = ({
  open,
  editingItem,
  formData,
  knowledgeData,
  isLoading,
  onClose,
  onSubmit,
  onFormChange,
}) => {
  const isKnowledge = editingItem?.type === "knowledge";

  return (
    <Modal
      title={
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>
            {editingItem?.isNew ? "添加" : "编辑"}
            {isKnowledge ? "知识点" : "思政案例"}
          </span>
          <Button type="text" icon={<CloseOutlined />} onClick={onClose} />
        </div>
      }
      open={open}
      onCancel={onClose}
      closable={false}
      onOk={onSubmit}
      confirmLoading={isLoading}
      okText={editingItem?.isNew ? "创建" : "保存"}
      cancelText="取消"
      width={isKnowledge ? 480 : 720}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 16 }}>
        {isKnowledge ? (
          <>
            <div>
              <label style={{ display: "block", marginBottom: 4 }}>
                知识点名称 <span style={{ color: "red" }}>*</span>
              </label>
              <Input
                value={formData.name || ""}
                onChange={(e) => onFormChange("name", e.target.value)}
                placeholder="输入知识点名称..."
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 4 }}>标签</label>
              <Input
                value={formData.tag || "课程思政"}
                onChange={(e) => onFormChange("tag", e.target.value)}
                placeholder="输入标签..."
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                默认为"课程思政"，带有此标签的知识点会显示在思政图谱中
              </Text>
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 4 }}>描述</label>
              <TextArea
                rows={3}
                value={formData.description || ""}
                onChange={(e) => onFormChange("description", e.target.value)}
                placeholder="输入知识点描述..."
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 4 }}>重要程度</label>
              <Select
                value={formData.importanceLevel || "normal"}
                style={{ width: "100%" }}
                onChange={(value) => onFormChange("importanceLevel", value)}
                options={[
                  { label: "简单", value: "simple" },
                  { label: "一般", value: "normal" },
                  { label: "重点", value: "important" },
                  { label: "难点", value: "hard" },
                ]}
              />
            </div>
          </>
        ) : (
          <>
            {editingItem?.isNew ? (
              <div>
                <label style={{ display: "block", marginBottom: 4 }}>关联知识点</label>
                <Select
                  value={formData.knowledgeResourceId || undefined}
                  placeholder="选择知识点"
                  style={{ width: "100%" }}
                  onChange={(value) => onFormChange("knowledgeResourceId", value)}
                  options={knowledgeData?.map((knowledge: any) => ({
                    label: knowledge.name,
                    value: knowledge.id,
                  }))}
                />
              </div>
            ) : (
              <div>
                <label style={{ display: "block", marginBottom: 4 }}>关联知识点</label>
                <Input value={editingItem?.item?.knowledgeResource?.name || "未关联"} disabled />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  案例创建后不能更改关联的知识点
                </Text>
              </div>
            )}

            <div>
              <label style={{ display: "block", marginBottom: 4 }}>案例标题</label>
              <Input
                value={formData.title || ""}
                onChange={(e) => onFormChange("title", e.target.value)}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 4 }}>案例描述</label>
              <TextArea
                rows={3}
                value={formData.description || ""}
                onChange={(e) => onFormChange("description", e.target.value)}
                placeholder="简短描述这个案例..."
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 4 }}>关联名称</label>
              <Input
                value={formData.caseRelationName || ""}
                onChange={(e) => onFormChange("caseRelationName", e.target.value)}
                placeholder="输入与知识点的关联关系名称..."
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                例如：包含、体现、印证等
              </Text>
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 4 }}>案例内容</label>
              <TextArea
                rows={6}
                value={formData.content || ""}
                onChange={(e) => onFormChange("content", e.target.value)}
                placeholder="详细描述案例内容..."
              />
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

export default CaseDialog;
