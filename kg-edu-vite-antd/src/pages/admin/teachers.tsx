import { useState, useMemo } from "react";
import type { Key } from "react";
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Typography,
  Modal,
  Tooltip,
  Alert,
  Drawer,
  Descriptions,
  Avatar,
  Input,
  App,
  Popconfirm,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  DownloadOutlined,
  UploadOutlined,
  SearchOutlined,
  KeyOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Form } from "antd";
import { useAuth } from "@/auth/auth-context";
import { getUsersFromTenant, createUser, updateUser, deleteUser, adminChangeUserPassword } from "@/lib/ash_rpc";
import { getAuthHeaders } from "@/lib/auth";
import { hasTenant } from "@/lib/tenant";
import { downloadUserTemplate } from "@/lib/user-import-export";
import { TeacherForm } from "@/components/admin/teacher-form";
import { ImportUserModal } from "@/components/admin/import-user-modal";
import { BatchEditPermissionModal } from "@/components/admin/batch-edit-permission-modal";
import { EditPermissionTag } from "@/components/edit-permission-tag";
import { useEditPermission } from "@/hooks/use-edit-permission";
import { ReadonlyActionButton } from "@/components/readonly-action-button";
import { useTenantFilter, ALL_TENANTS } from "@/hooks/use-tenant-filter";
import { TenantLayout } from "@/components/admin/tenant-layout";
import { fetchAcrossTenants } from "@/lib/tenant-query";
import { MobileTableCard } from "@/components/admin/mobile-table-card";
import { useResponsive } from "@/hooks/use-responsive";
import type { IUserItem } from "@/types/user";

const { Text } = Typography;

interface TeacherData {
  id: string;
  memberId: string;
  name: string;
  email?: string;
  phone?: string;
  school?: string;
  role: string;
  jobTitle?: string;
  bio?: string;
  avatarUrl?: string;
  employeeId?: string;
  editEnabled?: boolean | null;
  editPeriodStart?: string | null;
  editPeriodEnd?: string | null;
  _tenant?: string;
}

const transformAshUser = (ashUser: any): TeacherData => ({
  id: ashUser.id,
  memberId: ashUser.memberId || "",
  name: ashUser.name || "",
  employeeId: ashUser.employeeId,
  email: ashUser.email,
  phone: ashUser.phone,
  school: ashUser.school,
  role: ashUser.role || "teacher",
  jobTitle: ashUser.jobTitle,
  bio: ashUser.bio,
  avatarUrl: ashUser.avatarUrl,
  editEnabled: ashUser.editEnabled,
  editPeriodStart: ashUser.editPeriodStart,
  editPeriodEnd: ashUser.editPeriodEnd,
  _tenant: ashUser._tenant,
});

const getJobTitleTag = (jobTitle?: string) => {
  switch (jobTitle) {
    case "教授":
      return <Tag color="gold">教授</Tag>;
    case "副教授":
      return <Tag color="orange">副教授</Tag>;
    case "讲师":
      return <Tag color="blue">讲师</Tag>;
    case "助教":
      return <Tag color="cyan">助教</Tag>;
    default:
      return null;
  }
};

const getEditPermissionTag = (record: TeacherData) => <EditPermissionTag user={record} />;

export default function TeacherManagement() {
  const { message } = App.useApp();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { isMobile } = useResponsive();
  const { canEdit } = useEditPermission();
  const {
    isSuperAdmin,
    tenantOptions,
    selectedTenantId,
    setSelectedTenantId,
    queryTenants,
    defaultTenant,
  } = useTenantFilter("teacher");
  // 编辑/新增等写操作的目标租户："全部租户"模式下无具体租户，禁止写操作
  const editTenant =
    isSuperAdmin && selectedTenantId === ALL_TENANTS ? null : queryTenants[0] || defaultTenant;
  const resolveTenant = (target?: { _tenant?: string }) =>
    target?._tenant || editTenant || defaultTenant;

  const [selectedUser, setSelectedUser] = useState<TeacherData | null>(null);
  const [viewingUser, setViewingUser] = useState<TeacherData | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState<TeacherData | null>(null);
  const [passwordForm] = Form.useForm();

  const {
    data: rawUsers,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["tenant-teachers", queryTenants],
    queryFn: () =>
      fetchAcrossTenants<TeacherData>(queryTenants, (tenant) =>
        getUsersFromTenant({
          tenant,
          fields: [
            "id",
            "memberId",
            "name",
            "employeeId",
            "email",
            "phone",
            "school",
            "role",
            "jobTitle",
            "bio",
            "avatarUrl",
            "editEnabled",
            "editPeriodStart",
            "editPeriodEnd",
          ],
          filter: { role: { eq: "teacher" } },
          headers: getAuthHeaders(user),
        }),
      ),
    enabled: queryTenants.length > 0,
  });

  const users = useMemo(() => {
    return (rawUsers || []).map(transformAshUser);
  }, [rawUsers]);

  const filteredUsers = useMemo(() => {
    if (!searchText) return users;
    const lower = searchText.toLowerCase();
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(lower) ||
        u.memberId.toLowerCase().includes(lower) ||
        u.employeeId?.toLowerCase().includes(lower) ||
        u.email?.toLowerCase().includes(lower) ||
        u.school?.toLowerCase().includes(lower)
    );
  }, [users, searchText]);

  const parseUserError = (error: any): string => {
    const rawMessage = error?.message || error?.toString() || "";

    if (rawMessage.includes("has already been taken") || rawMessage.includes("already been taken")) {
      if (rawMessage.includes("member_id")) {
        return "用户ID已存在，请使用其他ID";
      }
      return "该值已存在，请使用其他值";
    }

    if (rawMessage.includes("Invalid email format")) {
      return "邮箱格式不正确";
    }

    if (rawMessage.includes("Invalid phone")) {
      return "电话格式不正确";
    }

    if (rawMessage.includes("password")) {
      return "密码格式不正确，至少需要6位";
    }

    return rawMessage || "操作失败";
  };

  const createUserMutation = useMutation({
    mutationFn: (data: any) =>
      createUser({
        tenant: editTenant as string,
        input: {
          memberId: data.memberId,
          name: data.name,
          ...(data.employeeId && { employeeId: data.employeeId }),
          ...(data.email && { email: data.email }),
          ...(data.phone && { phone: data.phone }),
          ...(data.school && { school: data.school }),
          password: data.password,
          role: "teacher",
          ...(data.jobTitle && { jobTitle: data.jobTitle }),
          ...(data.bio && { bio: data.bio }),
          employeeId: data.employeeId || null,
          avatarUrl: data.avatarUrl || null,
          editEnabled: data.editEnabled,
          editPeriodStart: data.editPeriodStart || null,
          editPeriodEnd: data.editPeriodEnd || null,
        },
        fields: ["id", "memberId", "name", "email", "phone", "school", "role", "jobTitle", "bio", "avatarUrl", "editEnabled", "editPeriodStart", "editPeriodEnd"],
        headers: getAuthHeaders(user),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-teachers", queryTenants] });
      setModalOpen(false);
      setSelectedUser(null);
      message.success("教师创建成功");
    },
    onError: (error: any) => {
      const errorMsg = parseUserError(error);
      message.error(errorMsg);
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data, tenant }: { id: string; data: any; tenant: string }) =>
      updateUser({
        tenant,
        primaryKey: id,
        input: {
          name: data.name,
          ...(data.employeeId && { employeeId: data.employeeId }),
          ...(data.email && { email: data.email }),
          ...(data.phone && { phone: data.phone }),
          ...(data.school && { school: data.school }),
          ...(data.jobTitle && { jobTitle: data.jobTitle }),
          ...(data.bio && { bio: data.bio }),
          employeeId: data.employeeId || null,
          avatarUrl: data.avatarUrl || null,
          editEnabled: data.editEnabled,
          editPeriodStart: data.editPeriodStart || null,
          editPeriodEnd: data.editPeriodEnd || null,
        },
        fields: ["id", "memberId", "name", "employeeId", "email", "phone", "school", "role", "jobTitle", "bio", "avatarUrl", "editEnabled", "editPeriodStart", "editPeriodEnd"],
        headers: getAuthHeaders(user),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-teachers", queryTenants] });
      setModalOpen(false);
      setSelectedUser(null);
      message.success("教师更新成功");
    },
    onError: (error: any) => {
      const errorMsg = parseUserError(error);
      message.error(errorMsg);
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: ({ id, tenant }: { id: string; tenant: string }) =>
      deleteUser({
        tenant,
        primaryKey: id,
        headers: getAuthHeaders(user),
      }),
    onSuccess: (result) => {
      if (result?.success) {
        queryClient.invalidateQueries({ queryKey: ["tenant-teachers", queryTenants] });
        message.success("教师删除成功");
      } else {
        const errorMsg = result?.errors?.[0]?.message || "删除教师失败";
        message.error(errorMsg);
      }
    },
    onError: (error: any) => {
      const errorMsg = error?.message || "";
      if (errorMsg.includes("foreign_key_constraint")) {
        message.error("无法删除该教师：存在关联记录");
      } else {
        message.error(errorMsg || "删除教师失败");
      }
    },
  });

  const handleCreate = () => {
    if (!editTenant) {
      message.warning("请先在左侧选择具体租户后再创建");
      return;
    }
    setSelectedUser(null);
    setModalOpen(true);
  };

  const handleOpenImport = () => {
    if (!editTenant) {
      message.warning("请先在左侧选择具体租户后再导入");
      return;
    }
    setImportModalOpen(true);
  };

  const handleEdit = (record: TeacherData) => {
    setSelectedUser(record);
    setModalOpen(true);
  };

  const handleView = (record: TeacherData) => {
    setViewingUser(record);
    setDrawerOpen(true);
  };

  const handleDelete = (record: TeacherData) => {
    deleteUserMutation.mutate({ id: record.id, tenant: resolveTenant(record) });
  };

  const handleChangePassword = (record: TeacherData) => {
    setPasswordTarget(record);
    passwordForm.resetFields();
    setPasswordModalOpen(true);
  };

  const handlePasswordSubmit = () => {
    passwordForm.validateFields().then((values) => {
      if (passwordTarget) {
        changePasswordMutation.mutate({
          userId: passwordTarget.id,
          newPassword: values.newPassword,
          passwordConfirmation: values.passwordConfirmation,
          tenant: resolveTenant(passwordTarget),
        });
      }
    });
  };

  const handleSubmit = (data: any) => {
    if (selectedUser) {
      updateUserMutation.mutate({
        id: selectedUser.id,
        data,
        tenant: resolveTenant(selectedUser),
      });
    } else {
      createUserMutation.mutate(data);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      await downloadUserTemplate();
      message.success("模板下载成功");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "模板下载失败");
    }
  };

  const changePasswordMutation = useMutation({
    mutationFn: (data: {
      userId: string;
      newPassword: string;
      passwordConfirmation: string;
      tenant: string;
    }) =>
      adminChangeUserPassword({
        tenant: data.tenant,
        input: {
          userId: data.userId,
          newPassword: data.newPassword,
          passwordConfirmation: data.passwordConfirmation,
        },
        headers: getAuthHeaders(user),
      }),
    onSuccess: () => {
      setPasswordModalOpen(false);
      setPasswordTarget(null);
      passwordForm.resetFields();
      message.success("密码修改成功");
    },
    onError: (error: any) => {
      const msg = error?.message || "密码修改失败";
      message.error(msg);
    },
  });

  const handleImportSuccess = () => {
    refetch();
  };

  const columns: ColumnsType<TeacherData> = [
    {
      title: "用户ID",
      dataIndex: "memberId",
      key: "memberId",
      width: 120,
    },
    {
      title: "工号",
      dataIndex: "employeeId",
      key: "employeeId",
      width: 100,
      render: (text) => text || "-",
    },
    {
      title: "姓名",
      dataIndex: "name",
      key: "name",
      width: 120,
      render: (text, record) => (
        <Space>
          <Avatar size="small" src={record.avatarUrl} style={{ backgroundColor: "#722ed1" }}>
            {text?.charAt(0)?.toUpperCase() || "U"}
          </Avatar>
          {text}
        </Space>
      ),
    },
    {
      title: "邮箱",
      dataIndex: "email",
      key: "email",
      width: 200,
      ellipsis: true,
    },
    {
      title: "手机号",
      dataIndex: "phone",
      key: "phone",
      width: 130,
      render: (text) => text || "-",
    },
    {
      title: "学校/机构",
      dataIndex: "school",
      key: "school",
      width: 150,
      ellipsis: true,
      render: (text) => text || "-",
    },
    {
      title: "职称",
      dataIndex: "jobTitle",
      key: "jobTitle",
      width: 100,
      render: (jobTitle) => getJobTitleTag(jobTitle) || <Text type="secondary">未设置</Text>,
    },
    {
      title: "编辑权限",
      key: "editPermission",
      width: 170,
      render: (_, record) => getEditPermissionTag(record),
    },
    {
      title: "操作",
      key: "action",
      width: 150,
      fixed: "right",
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => handleView(record)} />
          </Tooltip>
          <Tooltip title="修改密码">
            <ReadonlyActionButton type="text" size="small" icon={<KeyOutlined />} onClick={() => handleChangePassword(record)} />
          </Tooltip>
          <Tooltip title="编辑">
            <ReadonlyActionButton type="text" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          </Tooltip>
          <Popconfirm
            title="确定要删除这个教师吗？"
            description="此操作不可撤销"
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

  if (!isSuperAdmin && !hasTenant()) {
    return (
      <Card>
        <Alert
          message="请先选择组织"
          description="教师管理需要在特定组织/租户下进行。请先选择一个组织。"
          type="warning"
          showIcon
        />
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
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Tag color="blue" style={{ fontSize: 11, padding: "0 6px" }}>
                教师: {users.length}
              </Tag>
              <Space size={4} wrap>
                <Button size="small" icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>
                  模板
                </Button>
                <ReadonlyActionButton
                  size="small"
                  icon={<UploadOutlined />}
                  onClick={handleOpenImport}
                >
                  导入
                </ReadonlyActionButton>
                <ReadonlyActionButton
                  type="primary"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={handleCreate}
                >
                  添加
                </ReadonlyActionButton>
              </Space>
            </div>
            <Input
              placeholder="搜索教师..."
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
            dataSource={filteredUsers}
            rowKey="id"
            loading={isLoading}
            scroll={{ x: 1100 }}
            rowSelection={{
              selectedRowKeys,
              onChange: (keys) => setSelectedRowKeys(keys),
            }}
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
                <Space wrap>
                  <Tag color="blue" style={{ fontSize: 13 }}>
                    教师: {users.length}
                  </Tag>
                  <Input
                    placeholder="搜索教师..."
                    prefix={<SearchOutlined />}
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    style={{ width: 250 }}
                    allowClear
                  />
                </Space>
                <Space wrap>
                  {selectedRowKeys.length > 0 && isSuperAdmin && canEdit && (
                    <Button
                      icon={<ClockCircleOutlined />}
                      onClick={() => setBatchModalOpen(true)}
                    >
                      批量设置期限 ({selectedRowKeys.length})
                    </Button>
                  )}
                  <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>
                    下载模板
                  </Button>
                  <ReadonlyActionButton
                    icon={<UploadOutlined />}
                    onClick={handleOpenImport}
                  >
                    导入教师
                  </ReadonlyActionButton>
                  <ReadonlyActionButton
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={handleCreate}
                  >
                    添加教师
                  </ReadonlyActionButton>
                </Space>
              </div>
            )}
            pagination={{
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 条`,
              defaultPageSize: 10,
              size: "small",
            }}
          />
        )}

        {isMobile && (
          <MobileTableCard<TeacherData>
            dataSource={filteredUsers}
            loading={isLoading}
            title={(r) => r.name}
            subtitle={(r) => `${r.memberId}${r.employeeId ? ` · 工号 ${r.employeeId}` : ""}`}
            extra={(r) => (r.jobTitle ? getJobTitleTag(r.jobTitle) : null)}
            fields={(r) => [
              { label: "邮箱", value: r.email },
              { label: "手机", value: r.phone },
              { label: "学校", value: r.school },
            ]}
            actions={(r) => (
              <Space size={4} wrap>
                <Button size="small" type="text" icon={<EyeOutlined />} onClick={() => handleView(r)}>
                  查看
                </Button>
                <ReadonlyActionButton size="small" type="text" icon={<KeyOutlined />} onClick={() => handleChangePassword(r)}>
                  密码
                </ReadonlyActionButton>
                <ReadonlyActionButton size="small" type="text" icon={<EditOutlined />} onClick={() => handleEdit(r)}>
                  编辑
                </ReadonlyActionButton>
                <Popconfirm
                  title="删除教师？"
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
      </Card>

      <Modal
        title={selectedUser ? "编辑教师" : "创建新教师"}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setSelectedUser(null);
        }}
        footer={null}
        width="95%"
        style={{ maxWidth: 700 }}
        destroyOnHidden
      >
        <TeacherForm
          user={selectedUser as IUserItem}
          onSubmit={handleSubmit}
          onCancel={() => {
            setModalOpen(false);
            setSelectedUser(null);
          }}
          loading={createUserMutation.isPending || updateUserMutation.isPending}
        />
      </Modal>

      <Drawer
        title="教师详情"
        placement="right"
        width={isMobile ? "100%" : 400}
        onClose={() => {
          setDrawerOpen(false);
          setViewingUser(null);
        }}
        open={drawerOpen}
      >
        {viewingUser && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="头像">
              <Avatar size={64} src={viewingUser.avatarUrl} style={{ backgroundColor: "#722ed1" }}>
                {viewingUser.name?.charAt(0)?.toUpperCase() || "U"}
              </Avatar>
            </Descriptions.Item>
            <Descriptions.Item label="用户ID">{viewingUser.memberId}</Descriptions.Item>
            <Descriptions.Item label="工号">{viewingUser.employeeId || "-"}</Descriptions.Item>
            <Descriptions.Item label="姓名">{viewingUser.name}</Descriptions.Item>
            <Descriptions.Item label="邮箱">{viewingUser.email || "-"}</Descriptions.Item>
            <Descriptions.Item label="手机号">{viewingUser.phone || "-"}</Descriptions.Item>
            <Descriptions.Item label="学校/机构">{viewingUser.school || "-"}</Descriptions.Item>
            <Descriptions.Item label="职称">{getJobTitleTag(viewingUser.jobTitle) || "-"}</Descriptions.Item>
            <Descriptions.Item label="编辑权限">{getEditPermissionTag(viewingUser)}</Descriptions.Item>
            <Descriptions.Item label="个人简介">{viewingUser.bio || "-"}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>

      <ImportUserModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onSuccess={handleImportSuccess}
        role="teacher"
        tenant={editTenant as string}
      />

      <BatchEditPermissionModal
        open={batchModalOpen}
        selected={users
          .filter((u) => selectedRowKeys.includes(u.id))
          .map((u) => ({ id: u.id, tenant: u._tenant || (editTenant as string) }))}
        targetLabel="教师"
        onClose={() => {
          setBatchModalOpen(false);
          setSelectedRowKeys([]);
        }}
        onSuccess={() => {
          setSelectedRowKeys([]);
          refetch();
        }}
      />

      <Modal
        title={`修改密码 - ${passwordTarget?.name || ""}`}
        open={passwordModalOpen}
        onCancel={() => {
          setPasswordModalOpen(false);
          setPasswordTarget(null);
          passwordForm.resetFields();
        }}
        onOk={handlePasswordSubmit}
        confirmLoading={changePasswordMutation.isPending}
        okText="确认修改"
        cancelText="取消"
        width="95%"
        style={{ maxWidth: 480 }}
        destroyOnHidden
      >
        <Form form={passwordForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="newPassword"
            label="新密码"
            rules={[
              { required: true, message: "请输入新密码" },
              { min: 6, message: "密码至少6位" },
            ]}
          >
            <Input.Password placeholder="请输入新密码（至少6位）" />
          </Form.Item>
          <Form.Item
            name="passwordConfirmation"
            label="确认密码"
            dependencies={["newPassword"]}
            rules={[
              { required: true, message: "请确认密码" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("newPassword") === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error("两次输入的密码不一致"));
                },
              }),
            ]}
          >
            <Input.Password placeholder="请再次输入新密码" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
    </TenantLayout>
  );
}
