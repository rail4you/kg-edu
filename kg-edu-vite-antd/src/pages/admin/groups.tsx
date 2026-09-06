import { useState, useMemo } from "react";
import {
  Card,
  Table,
  Space,
  Tag,
  Typography,
  Modal,
  Tooltip,
  Alert,
  Input,
  App,
  Popconfirm,
  Form,
  InputNumber,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UserAddOutlined,
  UserDeleteOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/auth/auth-context";
import { listGroups, createGroup, updateGroup, deleteGroup, addMembers, removeMember, listUsers } from "@/lib/ash_rpc";
import { getAuthHeaders } from "@/lib/auth";
import { hasTenant } from "@/lib/tenant";
import { MobileTableCard } from "@/components/admin/mobile-table-card";
import { ReadonlyActionButton } from "@/components/readonly-action-button";
import { useTenantFilter, ALL_TENANTS } from "@/hooks/use-tenant-filter";
import { TenantLayout } from "@/components/admin/tenant-layout";
import { fetchAcrossTenants } from "@/lib/tenant-query";
import { useResponsive } from "@/hooks/use-responsive";

const { Text } = Typography;

interface GroupData {
  id: string;
  name: string;
  description?: string;
  maxMembers?: number;
  memberCount: number;
  _tenant?: string;
}

interface StudentData {
  id: string;
  name: string;
  memberId: string;
  email?: string;
}

export default function GroupManagement() {
  const { message } = App.useApp();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { isMobile } = useResponsive();
  const {
    isSuperAdmin,
    tenantOptions,
    selectedTenantId,
    setSelectedTenantId,
    queryTenants,
    defaultTenant,
  } = useTenantFilter("groups");
  const editTenant =
    isSuperAdmin && selectedTenantId === ALL_TENANTS ? null : queryTenants[0] || defaultTenant;
  const resolveTenant = (target?: { _tenant?: string }) =>
    target?._tenant || editTenant || defaultTenant;

  const [selectedGroup, setSelectedGroup] = useState<GroupData | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [removeMemberOpen, setRemoveMemberOpen] = useState(false);
  const [groupForMembers, setGroupForMembers] = useState<GroupData | null>(null);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [searchText, setSearchText] = useState("");
  const [form] = Form.useForm();

  // --- Group queries ---
  const { data: rawGroups, isLoading } = useQuery({
    queryKey: ["groups", queryTenants],
    queryFn: () =>
      fetchAcrossTenants<{ id: string; name: string; description: string | null; maxMembers: number | null; members?: any[] }>(
        queryTenants,
        (tenant) =>
          listGroups({
            tenant,
            fields: ["id", "name", "description", "maxMembers", { members: ["id"] } as any],
            sort: "+name",
            page: { limit: 100, offset: 0 },
            headers: getAuthHeaders(user),
          }),
      ),
    enabled: queryTenants.length > 0,
  });

  // --- Student queries ---
  const { data: rawStudents } = useQuery({
    queryKey: ["students-for-group", queryTenants],
    queryFn: () =>
      fetchAcrossTenants<{ id: string; name: string; memberId: string; email: string | null }>(
        queryTenants,
        (tenant) =>
          listUsers({
            tenant,
            fields: ["id", "name", "memberId", "email"],
            filter: { role: { eq: "user" } },
            headers: getAuthHeaders(user),
          }),
      ),
    enabled: queryTenants.length > 0,
  });

  // --- Group data with member counts ---
  const groups = useMemo<GroupData[]>(() => {
    const data = (rawGroups || []) as any[];
    return data.map((g: any) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      maxMembers: g.maxMembers,
      memberCount: g.members?.length || 0,
      _tenant: g._tenant,
    }));
  }, [rawGroups]);

  const students = useMemo<StudentData[]>(() => {
    const data = (rawStudents || []) as any[];
    return data.map((s: any) => ({
      id: s.id,
      name: s.name,
      memberId: s.memberId,
      email: s.email,
    }));
  }, [rawStudents]);

  const filteredGroups = useMemo(() => {
    if (!searchText) return groups;
    const lower = searchText.toLowerCase();
    return groups.filter(
      (g) =>
        g.name.toLowerCase().includes(lower) ||
        g.description?.toLowerCase().includes(lower)
    );
  }, [groups, searchText]);

  // --- Mutations ---
  const createGroupMutation = useMutation({
    mutationFn: (data: any) =>
      createGroup({
        tenant: editTenant as string,
        input: data,
        fields: ["id", "name", "description", "maxMembers"],
        headers: getAuthHeaders(user),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups", queryTenants] });
      setModalOpen(false);
      setSelectedGroup(null);
      form.resetFields();
      message.success("小组创建成功");
    },
    onError: (error: any) => {
      message.error(error?.message || "创建小组失败");
    },
  });

  const updateGroupMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      updateGroup({
        tenant: editTenant as string,
        primaryKey: id,
        input: data,
        fields: ["id", "name", "description", "maxMembers"],
        headers: getAuthHeaders(user),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups", queryTenants] });
      setModalOpen(false);
      setSelectedGroup(null);
      form.resetFields();
      message.success("小组更新成功");
    },
    onError: (error: any) => {
      message.error(error?.message || "更新小组失败");
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: ({ id, tenant }: { id: string; tenant: string }) =>
      deleteGroup({
        tenant,
        primaryKey: id,
        headers: getAuthHeaders(user),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups", queryTenants] });
      message.success("小组删除成功");
    },
    onError: (error: any) => {
      message.error(error?.message || "删除小组失败");
    },
  });

  const addMembersMutation = useMutation({
    mutationFn: ({ groupId, memberIds }: { groupId: string; memberIds: string[] }) =>
      addMembers({
        tenant: editTenant as string,
        primaryKey: groupId,
        input: { memberIds },
        fields: ["id", "name"],
        headers: getAuthHeaders(user),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups", queryTenants] });
      setAddMemberOpen(false);
      setGroupForMembers(null);
      setSelectedStudents([]);
      message.success("成员添加成功");
    },
    onError: (error: any) => {
      message.error(error?.message || "添加成员失败");
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: ({ groupId, memberId }: { groupId: string; memberId: string }) =>
      removeMember({
        tenant: editTenant as string,
        primaryKey: groupId,
        input: { memberId },
        fields: ["id", "name"],
        headers: getAuthHeaders(user),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups", queryTenants] });
      setRemoveMemberOpen(false);
      setGroupForMembers(null);
      setSelectedStudents([]);
      message.success("成员移除成功");
    },
    onError: (error: any) => {
      message.error(error?.message || "移除成员失败");
    },
  });

  // --- Handlers ---
  const handleCreate = () => {
    setSelectedGroup(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (record: GroupData) => {
    setSelectedGroup(record);
    form.setFieldsValue({
      name: record.name,
      description: record.description,
      maxMembers: record.maxMembers,
    });
    setModalOpen(true);
  };

  const handleDelete = (record: GroupData) => {
    deleteGroupMutation.mutate({ id: record.id, tenant: resolveTenant(record) });
  };

  const handleAddMembers = (record: GroupData) => {
    setGroupForMembers(record);
    setSelectedStudents([]);
    setAddMemberOpen(true);
  };

  const handleRemoveMembers = (record: GroupData) => {
    setGroupForMembers(record);
    setSelectedStudents([]);
    setRemoveMemberOpen(true);
  };

  const handleSubmit = () => {
    form.validateFields().then((values) => {
      if (selectedGroup) {
        updateGroupMutation.mutate({ id: selectedGroup.id, data: values });
      } else {
        createGroupMutation.mutate(values);
      }
    });
  };

  const handleConfirmAddMembers = () => {
    if (groupForMembers && selectedStudents.length > 0) {
      addMembersMutation.mutate({
        groupId: groupForMembers.id,
        memberIds: selectedStudents,
      });
    }
  };

  const handleConfirmRemoveMembers = () => {
    if (groupForMembers && selectedStudents.length > 0) {
      // Remove one at a time
      const promises = selectedStudents.map((studentId) =>
        removeMemberMutation.mutateAsync({
          groupId: groupForMembers.id,
          memberId: studentId,
        })
      );
      Promise.all(promises).then(() => {
        queryClient.invalidateQueries({ queryKey: ["groups", queryTenants] });
        setRemoveMemberOpen(false);
        setGroupForMembers(null);
        setSelectedStudents([]);
        message.success("成员移除成功");
      });
    }
  };

  const columns: ColumnsType<GroupData> = [
    {
      title: "小组名称",
      dataIndex: "name",
      key: "name",
      width: 180,
      ellipsis: true,
    },
    {
      title: "描述",
      dataIndex: "description",
      key: "description",
      width: 200,
      ellipsis: true,
      render: (text) => text || <Text type="secondary">-</Text>,
    },
    {
      title: "人数",
      dataIndex: "memberCount",
      key: "memberCount",
      width: 80,
      render: (count, record) => (
        <Tag color={count > 0 ? "success" : "default"}>
          {count}{record.maxMembers ? `/${record.maxMembers}` : ""}
        </Tag>
      ),
    },
    {
      title: "操作",
      key: "action",
      width: 220,
      fixed: "right",
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="编辑">
            <ReadonlyActionButton type="text" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          </Tooltip>
          <Tooltip title="添加学生">
            <ReadonlyActionButton type="text" size="small" icon={<UserAddOutlined />} onClick={() => handleAddMembers(record)} />
          </Tooltip>
          <Tooltip title="移除学生">
            <ReadonlyActionButton
              type="text"
              size="small"
              icon={<UserDeleteOutlined />}
              onClick={() => handleRemoveMembers(record)}
              disabled={record.memberCount === 0}
            />
          </Tooltip>
          <Popconfirm
            title="确定要删除这个小组吗？"
            onConfirm={() => handleDelete(record)}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <ReadonlyActionButton type="text" size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const studentColumns: ColumnsType<StudentData> = [
    {
      title: "学生ID",
      dataIndex: "memberId",
      key: "memberId",
      width: 120,
    },
    {
      title: "姓名",
      dataIndex: "name",
      key: "name",
      width: 120,
    },
    {
      title: "邮箱",
      dataIndex: "email",
      key: "email",
      width: 180,
      render: (text) => text || <Text type="secondary">-</Text>,
    },
  ];

  // --- Get existing member IDs for add member filtering ---
  const groupMemberIds = useMemo(() => {
    if (!groupForMembers) return new Set<string>();
    const g = (rawGroups || []).find((x: any) => x.id === groupForMembers.id);
    if (!g?.members) return new Set<string>();
    return new Set(g.members.map((m: any) => m.id || m));
  }, [groupForMembers, rawGroups]);

  if (!isSuperAdmin && !hasTenant()) {
    return (
      <Card>
        <Alert message="请先选择组织" type="warning" showIcon />
      </Card>
    );
  }

  return (
    <TenantLayout
      tenants={tenantOptions}
      selected={selectedTenantId}
      onSelect={setSelectedTenantId}
    >
    <div>
      <Card styles={{ body: { padding: isMobile ? 12 : 24 } }}>
        {/* 移动端工具栏 */}
        {isMobile && (
          <div style={{ marginBottom: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <Space size={4} wrap>
                <Tag color="blue" style={{ fontSize: 11, padding: "0 6px" }}>
                  小组: {filteredGroups.length}
                </Tag>
                <Tag color="green" style={{ fontSize: 11, padding: "0 6px" }}>
                  成员: {groups.reduce((sum, g) => sum + g.memberCount, 0)}
                </Tag>
              </Space>
              <ReadonlyActionButton type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                创建小组
              </ReadonlyActionButton>
            </div>
            <Input
              placeholder="搜索小组..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              size="small"
            />
          </div>
        )}

        {!isMobile && (
          <Table
            columns={columns}
            dataSource={filteredGroups}
            rowKey="id"
            loading={isLoading}
            scroll={{ x: 800 }}
            title={() => (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <Space size={4} wrap>
                  <Tag color="blue" style={{ fontSize: 13 }}>
                    小组: {filteredGroups.length}
                  </Tag>
                  <Tag color="green" style={{ fontSize: 13 }}>
                    成员: {groups.reduce((sum, g) => sum + g.memberCount, 0)}
                  </Tag>
                  <Input
                    placeholder="搜索小组..."
                    prefix={<SearchOutlined />}
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    style={{ width: 250 }}
                    allowClear
                  />
                </Space>
                <ReadonlyActionButton type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                  创建小组
                </ReadonlyActionButton>
              </div>
            )}
            pagination={{
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条`,
              defaultPageSize: 10,
              size: "small",
            }}
          />
        )}

        {isMobile && (
          <MobileTableCard<GroupData>
            dataSource={filteredGroups}
            loading={isLoading}
            title={(r) => r.name}
            extra={(r) => (
              <Tag color={r.memberCount > 0 ? "success" : "default"}>
                {r.memberCount}
                {r.maxMembers ? `/${r.maxMembers}` : ""}
              </Tag>
            )}
            fields={(r) => [
              { label: "描述", value: r.description || <Text type="secondary">-</Text> },
            ]}
            actions={(r) => (
              <Space size={4} wrap>
                <ReadonlyActionButton size="small" type="text" icon={<EditOutlined />} onClick={() => handleEdit(r)}>
                  编辑
                </ReadonlyActionButton>
                <ReadonlyActionButton size="small" type="text" icon={<UserAddOutlined />} onClick={() => handleAddMembers(r)}>
                  添加
                </ReadonlyActionButton>
                <ReadonlyActionButton
                  size="small"
                  type="text"
                  icon={<UserDeleteOutlined />}
                  onClick={() => handleRemoveMembers(r)}
                  disabled={r.memberCount === 0}
                >
                  移除
                </ReadonlyActionButton>
                <Popconfirm
                  title="删除小组？"
                  onConfirm={() => handleDelete(r)}
                  okText="确定"
                  cancelText="取消"
                >
                  <ReadonlyActionButton size="small" type="text" danger icon={<DeleteOutlined />}>
                    删除
                  </ReadonlyActionButton>
                </Popconfirm>
              </Space>
            )}
          />
        )}

        {!isMobile && (
          <Alert
            message="管理提示"
            description={
              <ul style={{ margin: "8px 0", paddingLeft: "20px" }}>
                <li>小组与班级独立管理，不依赖课程</li>
                <li>可创建小组后添加学生成员</li>
                <li>支持设置小组人数上限</li>
              </ul>
            }
            type="info"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        title={selectedGroup ? "编辑小组" : "创建小组"}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setSelectedGroup(null); form.resetFields(); }}
        onOk={handleSubmit}
        confirmLoading={createGroupMutation.isPending || updateGroupMutation.isPending}
        okText={selectedGroup ? "更新" : "创建"}
        width="95%"
        style={{ maxWidth: 500 }}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="小组名称" rules={[{ required: true, message: "请输入小组名称" }]}>
            <Input placeholder="例如：第一小组、A组" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="可选，小组的描述信息" />
          </Form.Item>
          <Form.Item name="maxMembers" label="人数上限">
            <InputNumber min={1} style={{ width: "100%" }} placeholder="可选，不填则无上限" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Add Members Modal */}
      <Modal
        title={`添加学生到: ${groupForMembers?.name}`}
        open={addMemberOpen}
        onCancel={() => { setAddMemberOpen(false); setGroupForMembers(null); setSelectedStudents([]); }}
        onOk={handleConfirmAddMembers}
        okText={`确认添加 (${selectedStudents.length})`}
        okButtonProps={{ disabled: selectedStudents.length === 0 }}
        width="95%"
        style={{ maxWidth: 700 }}
      >
        <div style={{ marginBottom: 16 }}>
          <Text>可选学生: {students.filter((s) => !groupMemberIds.has(s.id)).length} 人</Text>
          {selectedStudents.length > 0 && (
            <Tag color="blue" style={{ marginLeft: 8 }}>已选择 {selectedStudents.length} 名</Tag>
          )}
        </div>
        <Table
          columns={studentColumns}
          dataSource={students.filter((s) => !groupMemberIds.has(s.id))}
          rowKey="id"
          rowSelection={{
            selectedRowKeys: selectedStudents,
            onChange: (keys) => setSelectedStudents(keys as string[]),
          }}
          size="small"
          scroll={{ x: 500 }}
          pagination={{ pageSize: 10, simple: isMobile }}
        />
      </Modal>

      {/* Remove Members Modal */}
      <Modal
        title={`从小组移除学生: ${groupForMembers?.name}`}
        open={removeMemberOpen}
        onCancel={() => { setRemoveMemberOpen(false); setGroupForMembers(null); setSelectedStudents([]); }}
        onOk={handleConfirmRemoveMembers}
        okText={`确认移除 (${selectedStudents.length})`}
        okButtonProps={{ disabled: selectedStudents.length === 0 }}
        width="95%"
        style={{ maxWidth: 700 }}
      >
        <div style={{ marginBottom: 16 }}>
          <Text>当前成员: {groupMemberIds.size} 人</Text>
          {selectedStudents.length > 0 && (
            <Tag color="warning" style={{ marginLeft: 8 }}>已选择 {selectedStudents.length} 名</Tag>
          )}
        </div>
        <Table
          columns={studentColumns}
          dataSource={students.filter((s) => groupMemberIds.has(s.id))}
          rowKey="id"
          rowSelection={{
            selectedRowKeys: selectedStudents,
            onChange: (keys) => setSelectedStudents(keys as string[]),
          }}
          size="small"
          scroll={{ x: 500 }}
          pagination={{ pageSize: 10, simple: isMobile }}
        />
      </Modal>
    </div>
    </TenantLayout>
  );
}
