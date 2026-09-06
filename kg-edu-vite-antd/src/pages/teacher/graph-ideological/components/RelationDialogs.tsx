import React, { useMemo } from "react";
import { Modal, Select, Button, Alert, Row, Col } from "antd";
import { CloseOutlined } from "@ant-design/icons";
import { RelationType, IdeopoliticalRelationRow } from "../types";
import { KnowledgeTreeSelect, buildKnowledgeTreeFromList } from "./KnowledgeTreeSelect";

interface RelationFormData {
  sourceKnowledgeId: string;
  targetKnowledgeId: string;
  relationTypeId: string;
}

interface RelationDialogsProps {
  createModalOpen: boolean;
  createLoading: boolean;
  createError: Error | null;
  relationFormData: RelationFormData;
  relationTypesData: RelationType[];
  relationTypesLoading: boolean;
  knowledgeData: any[];
  resourcesLoading: boolean;
  onCreateClose: () => void;
  onCreateSubmit: () => void;
  onRelationFormChange: (data: RelationFormData) => void;

  updateModalOpen: boolean;
  updateLoading: boolean;
  updateError: Error | null;
  selectedRelation: IdeopoliticalRelationRow | null;
  onUpdateClose: () => void;
  onUpdateSubmit: () => void;

  deleteModalOpen: boolean;
  deleteLoading: boolean;
  onDeleteClose: () => void;
  onDeleteSubmit: () => void;

  relationsData?: IdeopoliticalRelationRow[];
}

const RelationDialogs: React.FC<RelationDialogsProps> = ({
  createModalOpen,
  createLoading,
  createError,
  relationFormData,
  relationTypesData,
  relationTypesLoading,
  knowledgeData,
  resourcesLoading,
  onCreateClose,
  onCreateSubmit,
  onRelationFormChange,

  updateModalOpen,
  updateLoading,
  updateError,
  onUpdateClose,
  onUpdateSubmit,

  deleteModalOpen,
  deleteLoading,
  onDeleteClose,
  onDeleteSubmit,
  selectedRelation,
  relationsData = [],
}) => {
  const formIsValid =
    relationFormData.sourceKnowledgeId &&
    relationFormData.targetKnowledgeId &&
    relationFormData.relationTypeId;

  const knowledgeTreeData = useMemo(
    () => buildKnowledgeTreeFromList(knowledgeData),
    [knowledgeData],
  );

  const targetExcludeIds = useMemo(() => {
    const excludeSet = new Set<string>();
    if (relationFormData.sourceKnowledgeId) {
      excludeSet.add(relationFormData.sourceKnowledgeId);
      relationsData.forEach((relation) => {
        if (relation.sourceKnowledgeId === relationFormData.sourceKnowledgeId) {
          excludeSet.add(relation.targetKnowledgeId);
        }
      });
    }
    return Array.from(excludeSet);
  }, [relationFormData.sourceKnowledgeId, relationsData]);

  const renderRelationForm = () => (
    <>
      <div>
        <label style={{ display: "block", marginBottom: 4 }}>
          关系类型 <span style={{ color: "red" }}>*</span>
        </label>
        <Select
          value={relationFormData.relationTypeId || undefined}
          placeholder="选择关系类型"
          style={{ width: "100%" }}
          onChange={(value) =>
            onRelationFormChange({ ...relationFormData, relationTypeId: value })
          }
          loading={relationTypesLoading}
          options={(relationTypesData || [])?.map((relationType) => ({
            label: relationType.displayName,
            value: relationType.id,
          }))}
        />
      </div>

      <Row gutter={16}>
        <Col span={12}>
          <label style={{ display: "block", marginBottom: 4 }}>
            源知识 <span style={{ color: "red" }}>*</span>
          </label>
          <KnowledgeTreeSelect
            value={relationFormData.sourceKnowledgeId || undefined}
            onChange={(value) =>
              onRelationFormChange({
                ...relationFormData,
                sourceKnowledgeId: value,
                targetKnowledgeId:
                  relationFormData.targetKnowledgeId === value
                    ? ""
                    : relationFormData.targetKnowledgeId,
              })
            }
            treeData={knowledgeTreeData}
            placeholder="选择源知识"
          />
        </Col>

        <Col span={12}>
          <label style={{ display: "block", marginBottom: 4 }}>
            目标知识 <span style={{ color: "red" }}>*</span>
          </label>
          <KnowledgeTreeSelect
            value={relationFormData.targetKnowledgeId || undefined}
            onChange={(value) =>
              onRelationFormChange({ ...relationFormData, targetKnowledgeId: value })
            }
            treeData={knowledgeTreeData}
            placeholder="选择目标知识"
            excludeIds={targetExcludeIds}
          />
        </Col>
      </Row>
    </>
  );

  return (
    <>
      {/* Create Relation Modal */}
      <Modal
        title={
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>创建思政知识关系</span>
            <Button type="text" icon={<CloseOutlined />} onClick={onCreateClose} />
          </div>
        }
        open={createModalOpen}
        onCancel={onCreateClose}
        closable={false}
        onOk={onCreateSubmit}
        confirmLoading={createLoading}
        okText="创建"
        cancelText="取消"
        okButtonProps={{ disabled: !formIsValid }}
        width={900}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 8 }}>
          {renderRelationForm()}
        </div>
        {createError && (
          <Alert
            type="error"
            message={`创建失败: ${createError.message}`}
            style={{ marginTop: 16 }}
          />
        )}
      </Modal>

      {/* Update Relation Modal */}
      <Modal
        title={
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>更新思政知识关系</span>
            <Button type="text" icon={<CloseOutlined />} onClick={onUpdateClose} />
          </div>
        }
        open={updateModalOpen}
        onCancel={onUpdateClose}
        closable={false}
        onOk={onUpdateSubmit}
        confirmLoading={updateLoading}
        okText="更新"
        cancelText="取消"
        okButtonProps={{ disabled: !formIsValid }}
        width={900}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 8 }}>
          {renderRelationForm()}
        </div>
        {updateError && (
          <Alert
            type="error"
            message={`更新失败: ${updateError.message}`}
            style={{ marginTop: 16 }}
          />
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        title="确认删除"
        open={deleteModalOpen}
        onCancel={onDeleteClose}
        onOk={onDeleteSubmit}
        confirmLoading={deleteLoading}
        okText="删除"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        <p>
          确定要删除知识关系 "{selectedRelation?.sourceKnowledgeName} →{" "}
          {selectedRelation?.targetKnowledgeName}" 吗？此操作无法撤销。
        </p>
      </Modal>
    </>
  );
};

export default RelationDialogs;
