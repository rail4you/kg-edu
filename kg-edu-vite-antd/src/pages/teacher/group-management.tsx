import { useNavigate } from "react-router-dom";
import * as React from "react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card, Table, Button, Typography, Modal, Input, Space, message, Popconfirm,
  Select, Row, Col, InputNumber,
} from "antd";
import type { TableColumnsType } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined, TeamOutlined, SwapOutlined, ArrowLeftOutlined } from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { getGroupsByCourse, createGroup, updateGroup, deleteGroup, listEnrollmentsByCourse, addMembers, removeMember, listUsers } from "@/lib/ash_rpc";
import { useCourses } from "@/hooks/use-courses";
import { useEditPermission } from "@/hooks/use-edit-permission";
import { ReadonlyActionButton } from "@/components/readonly-action-button";

const { Title, Text } = Typography;

interface Student {
  id: string;
  name?: string | null;
  email?: string | null;
  memberId?: string | null;
}

interface Group {
  id: string;
  name: string;
  description?: string;
  maxMembers?: number;
  courseId: string;
  createdById?: string | null;
  members?: Student[];
}

function getErrorMessage(result: unknown, fallback: string) {
  const errors = (result as { errors?: Array<{ message?: string }> })?.errors;
  return errors?.[0]?.message || fallback;
}

export default function GroupManagement() {
  const navigate = useNavigate();
  const { user, tenant } = useAuth();
  const queryClient = useQueryClient();
  const { canEdit } = useEditPermission();
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    maxMembers: undefined as number | undefined,
    memberIds: [] as string[],
  });

  const { courses } = useCourses();
  const headers = getAuthHeaders(user) as Record<string, string>;

  const { data: groupsResult, isLoading } = useQuery({
    queryKey: ["groups", selectedCourseId, tenant],
    queryFn: async () => {
      if (!selectedCourseId || !tenant) return { success: false, data: [] };
      const result = await getGroupsByCourse({
        tenant,
        input: { courseId: selectedCourseId },
        fields: ["id", "name", "description", "maxMembers", "courseId", "createdById", { members: ["id", "name", "email", "memberId"] }],
        headers,
      } as any);
      if (!result.success) {
        throw new Error(getErrorMessage(result, "加载分组失败"));
      }
      return result;
    },
    enabled: !!selectedCourseId && !!tenant,
  });

  const { data: students = [], isLoading: studentsLoading } = useQuery({
    queryKey: ["group-course-students", selectedCourseId, tenant],
    queryFn: async () => {
      if (!selectedCourseId || !tenant) return [];
      const enrollmentsResult = await listEnrollmentsByCourse({
        tenant,
        input: { courseId: selectedCourseId },
        fields: ["id", "memberId"],
        headers,
      });
      if (!enrollmentsResult.success) {
        throw new Error(getErrorMessage(enrollmentsResult, "加载课程学生失败"));
      }

      const data = (enrollmentsResult as any).data;
      const enrollments = Array.isArray(data) ? data : data?.results || data?.data || [];
      const memberIds = Array.from(new Set(enrollments.map((item: any) => item.memberId).filter(Boolean)));
      if (memberIds.length === 0) return [];

      const usersResult = await listUsers({
        tenant,
        fields: ["id", "name", "email", "memberId"],
        filter: { id: { in: memberIds } },
        sort: "+name",
        headers,
      });
      if (!usersResult.success) {
        throw new Error(getErrorMessage(usersResult, "加载课程学生失败"));
      }

      const usersData = (usersResult as any).data;
      const users = Array.isArray(usersData) ? usersData : usersData?.results || usersData?.data || [];
      return users as Student[];
    },
    enabled: !!selectedCourseId && !!tenant,
  });

  const groups: Group[] =
    (groupsResult as any)?.success ? ((groupsResult as any).data?.results || (groupsResult as any).data || []) : [];

  const saveMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string; maxMembers?: number; memberIds: string[] }) => {
      if (!tenant || !selectedCourseId) throw new Error("Missing");
      if (!data.name.trim()) throw new Error("请输入小组名称");
      if (data.maxMembers && data.memberIds.length > data.maxMembers) {
        throw new Error("所选学生数量不能超过最大人数");
      }

      if (editingGroup) {
        const updateResult = await updateGroup({
          tenant,
          primaryKey: editingGroup.id,
          input: {
            name: data.name.trim(),
            description: data.description?.trim() || null,
            maxMembers: data.maxMembers ?? null,
          },
          fields: ["id"],
          headers,
        });
        if (!updateResult.success) {
          throw new Error(getErrorMessage(updateResult, "更新小组失败"));
        }

        const currentMemberIds = new Set((editingGroup.members || []).map((member) => member.id));
        const nextMemberIds = new Set(data.memberIds);
        const memberIdsToAdd = data.memberIds.filter((id) => !currentMemberIds.has(id));
        const memberIdsToRemove = Array.from(currentMemberIds).filter((id) => !nextMemberIds.has(id));

        if (memberIdsToAdd.length > 0) {
          const addResult = await addMembers({
            tenant,
            primaryKey: editingGroup.id,
            input: { memberIds: memberIdsToAdd },
            fields: ["id"],
            headers,
          });
          if (!addResult.success) {
            throw new Error(getErrorMessage(addResult, "添加组员失败"));
          }
        }

        for (const memberId of memberIdsToRemove) {
          const removeResult = await removeMember({
            tenant,
            primaryKey: editingGroup.id,
            input: { memberId },
            fields: ["id"],
            headers,
          });
          if (!removeResult.success) {
            throw new Error(getErrorMessage(removeResult, "移除组员失败"));
          }
        }

        return updateResult;
      }

      const result = await createGroup({
        tenant,
        input: {
          name: data.name.trim(),
          description: data.description?.trim() || null,
          maxMembers: data.maxMembers ?? null,
          courseId: selectedCourseId,
          memberIds: data.memberIds,
        },
        fields: ["id"],
        headers,
      });
      if (!result.success) {
        throw new Error(getErrorMessage(result, "创建小组失败"));
      }
      return result;
    },
    onSuccess: () => {
      message.success(editingGroup ? "小组已更新" : "小组已创建");
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      setDialogOpen(false); setEditingGroup(null);
      setFormData({ name: "", description: "", maxMembers: undefined, memberIds: [] });
    },
    onError: (error: Error) => message.error(error.message || "操作失败"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!tenant) throw new Error("缺少租户信息");
      const result = await deleteGroup({ tenant, primaryKey: id, headers });
      if (!result.success) {
        throw new Error(getErrorMessage(result, "删除小组失败"));
      }
      return result;
    },
    onSuccess: () => { message.success("已删除"); queryClient.invalidateQueries({ queryKey: ["groups"] }); },
    onError: (error: Error) => message.error(error.message || "删除失败"),
  });

  const columns: TableColumnsType<Group> = [
    { title: "小组名称", dataIndex: "name", key: "name", ellipsis: true },
    { title: "描述", dataIndex: "description", key: "description", ellipsis: true },
    {
      title: "成员",
      key: "members",
      render: (_: unknown, record: Group) => {
        const members = record.members || [];
        if (members.length === 0) return "-";
        const preview = members.slice(0, 3).map((member) => member.name || member.email || member.memberId || member.id);
        return `${preview.join("、")}${members.length > 3 ? ` 等 ${members.length} 人` : ""}`;
      },
    },
    { title: "最大人数", dataIndex: "maxMembers", key: "maxMembers", render: (v: number) => v || "不限" },
    { title: "创建者", dataIndex: "createdById", key: "createdById", render: (v: string | null | undefined) => v ? `${v.slice(0, 8)}...` : "-" },
    {
      title: "操作", key: "actions",
      render: (_: unknown, record: Group) => (
        <Space>
          <ReadonlyActionButton
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingGroup(record);
              setFormData({
                name: record.name,
                description: record.description || "",
                maxMembers: record.maxMembers,
                memberIds: (record.members || []).map((member) => member.id),
              });
              setDialogOpen(true);
            }}
          />
          <Popconfirm title="确定删除？" onConfirm={() => deleteMutation.mutate(record.id)}>
            <ReadonlyActionButton size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col>        <Button
                    className="teacher-page-back-btn"
                    type="text"
                    icon={<ArrowLeftOutlined />}
                    onClick={() => navigate("/teacher/dashboard")}
                    style={{ color: "#1890ff", padding: "4px 8px", fontSize: 16 }}
                  />
                    <Title level={4} style={{ margin: 0 }}><TeamOutlined /> 分组管理</Title></Col>
          <Col>
            <Space>
              <Select style={{ width: 240 }} placeholder="选择课程" value={selectedCourseId} onChange={setSelectedCourseId}
                options={courses?.map((c: any) => ({ label: c.title, value: c.id })) || []} />
              <Button type="primary" icon={<PlusOutlined />} disabled={!selectedCourseId} style={canEdit ? undefined : { display: "none" }}
                onClick={() => { setEditingGroup(null); setFormData({ name: "", description: "", maxMembers: undefined, memberIds: [] }); setDialogOpen(true); }}>创建小组</Button>
              <Button icon={<SwapOutlined />} disabled={!selectedCourseId} style={canEdit ? undefined : { display: "none" }}>随机分组</Button>
            </Space>
          </Col>
        </Row>
        <Table
            columns={columns} dataSource={groups} rowKey="id" loading={isLoading} locale={{ emptyText: selectedCourseId ? "暂无小组" : "请先选择课程" }} />
      </Card>

      <Modal title={editingGroup ? "编辑小组" : "创建小组"} open={dialogOpen}
        onCancel={() => { setDialogOpen(false); setEditingGroup(null); }}
        onOk={() => saveMutation.mutate(formData)} confirmLoading={saveMutation.isPending}>
        <Space direction="vertical" style={{ width: "100%" }}>
          <div><Text>小组名称 *</Text><Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="输入小组名称" /></div>
          <div><Text>描述</Text><Input.TextArea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={3} /></div>
          <div><Text>最大人数</Text><InputNumber value={formData.maxMembers} onChange={v => setFormData({ ...formData, maxMembers: v || undefined })} min={2} max={20} style={{ width: "100%" }} placeholder="不限制" /></div>
          <div>
            <Text>关联学生</Text>
            <Select
              mode="multiple"
              style={{ width: "100%", marginTop: 8 }}
              placeholder={selectedCourseId ? "选择本课程学生" : "请先选择课程"}
              value={formData.memberIds}
              loading={studentsLoading}
              onChange={(memberIds) => setFormData({ ...formData, memberIds })}
              optionFilterProp="label"
              options={students.map((student) => ({
                value: student.id,
                label: `${student.name || "未命名学生"}${student.memberId ? ` (${student.memberId})` : ""}`,
              }))}
            />
          </div>
        </Space>
      </Modal>
    </div>
  );
}
