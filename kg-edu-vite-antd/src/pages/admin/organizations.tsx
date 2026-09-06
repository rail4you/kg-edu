import { useState, useMemo, useRef } from "react";
import {
  Card,
  Table,
  Button,
  Space,
  Typography,
  Modal,
  Tooltip,
  Alert,
  Drawer,
  Descriptions,
  Input,
  App,
  Popconfirm,
  Form,
  Upload,
  Spin,
  Statistic,
  Tag,
  Divider,
  Empty,
} from "antd";
import type { DescriptionsProps } from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  SearchOutlined,
  ExclamationCircleOutlined,
  ExportOutlined,
  ImportOutlined,
  DownloadOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/auth/auth-context";
import {
  listOrganizations,
  createOrganizationWithMigrations,
  updateOrganization,
  deleteOrganization,
} from "@/lib/ash_rpc";
import { getAuthHeaders } from "@/lib/auth";
import { MobileTableCard } from "@/components/admin/mobile-table-card";
import { useEditPermission } from "@/hooks/use-edit-permission";
import { ReadonlyActionButton } from "@/components/readonly-action-button";
import { useResponsive } from "@/hooks/use-responsive";

interface OrgData {
  id: string;
  name: string;
  schemaName?: string;
}

const transformAshOrg = (ashOrg: any): OrgData => ({
  id: ashOrg.id,
  name: ashOrg.name || "",
  schemaName: ashOrg.schemaName,
});

export default function AdminOrganizations() {
  const { message, modal } = App.useApp();
  const { user } = useAuth();
  const { canEdit } = useEditPermission();
  const queryClient = useQueryClient();
  const { isMobile } = useResponsive();

  const [selectedOrg, setSelectedOrg] = useState<OrgData | null>(null);
  const [viewingOrg, setViewingOrg] = useState<OrgData | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importName, setImportName] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [form] = Form.useForm();

  const isSuperAdmin = user?.role === "super_admin";

  const {
    data: orgsResponse,
    isLoading,
  } = useQuery({
    queryKey: ["organizations"],
    queryFn: () =>
      listOrganizations({
        fields: ["id", "name", "schemaName"],
        page: { limit: 100, offset: 0 },
        headers: getAuthHeaders(user),
      }),
    enabled: isSuperAdmin,
  });

  const orgs = useMemo(() => {
    if (!orgsResponse?.success) return [];
    const orgData = Array.isArray(orgsResponse.data)
      ? orgsResponse.data
      : (orgsResponse.data as any)?.results || [];
    return orgData.map(transformAshOrg);
  }, [orgsResponse]);

  const filteredOrgs = useMemo(() => {
    if (!searchText) return orgs;
    const lower = searchText.toLowerCase();
    return orgs.filter(
      (o) =>
        o.name.toLowerCase().includes(lower) ||
        o.schemaName?.toLowerCase().includes(lower)
    );
  }, [orgs, searchText]);

  const createOrgMutation = useMutation({
    mutationFn: (name: string) =>
      createOrganizationWithMigrations({
        input: { name },
        headers: getAuthHeaders(user),
      }),
    onSuccess: (result) => {
      if (result?.success) {
        queryClient.invalidateQueries({ queryKey: ["organizations"] });
        setModalOpen(false);
        form.resetFields();
        message.success("租户创建成功");
      } else {
        const errorMsg = result?.errors?.[0]?.message || "创建租户失败";
        message.error(errorMsg);
      }
    },
    onError: (error: any) => {
      message.error(error?.message || "创建租户失败");
    },
  });

  const updateOrgMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      updateOrganization({
        primaryKey: id,
        input: { name },
        fields: ["id", "name", "schemaName"],
        headers: getAuthHeaders(user),
      }),
    onSuccess: (result) => {
      if (result?.success) {
        queryClient.invalidateQueries({ queryKey: ["organizations"] });
        setModalOpen(false);
        setSelectedOrg(null);
        form.resetFields();
        message.success("租户更新成功");
      } else {
        const errorMsg = result?.errors?.[0]?.message || "更新租户失败";
        message.error(errorMsg);
      }
    },
    onError: (error: any) => {
      message.error(error?.message || "更新租户失败");
    },
  });

  const deleteOrgMutation = useMutation({
    mutationFn: (id: string) =>
      deleteOrganization({
        primaryKey: id,
        headers: getAuthHeaders(user),
      }),
    onSuccess: (result) => {
      if (result?.success) {
        queryClient.invalidateQueries({ queryKey: ["organizations"] });
        message.success("租户删除成功");
      } else {
        const errorMsg = result?.errors?.[0]?.message || "删除租户失败";
        message.error(errorMsg);
      }
    },
    onError: (error: any) => {
      message.error(error?.message || "删除租户失败");
    },
  });

  const handleCreate = () => {
    setSelectedOrg(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (record: OrgData) => {
    setSelectedOrg(record);
    form.setFieldsValue({ name: record.name });
    setModalOpen(true);
  };

  const handleView = (record: OrgData) => {
    setViewingOrg(record);
    setDrawerOpen(true);
  };

  // Fetch organization summary when viewing
  const {
    data: orgSummary,
    isLoading: summaryLoading,
  } = useQuery({
    queryKey: ["organization-summary", viewingOrg?.id],
    queryFn: async () => {
      if (!viewingOrg) return null;
      const token = sessionStorage.getItem("jwt_access_token");
      const resp = await fetch(`/api/organizations/${viewingOrg.id}/summary`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await resp.json();
      return json.success ? json.data : null;
    },
    enabled: !!viewingOrg,
  });

  const handleDelete = (id: string, name: string) => {
    modal.confirm({
      title: "确认删除租户",
      icon: <ExclamationCircleOutlined />,
      content: `即将删除租户「${name}」及其所有数据，此操作不可撤销！`,
      okText: "确认删除",
      okType: "danger",
      cancelText: "取消",
      onOk: () => deleteOrgMutation.mutate(id),
    });
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (selectedOrg) {
        updateOrgMutation.mutate({ id: selectedOrg.id, name: values.name });
      } else {
        createOrgMutation.mutate(values.name);
      }
    } catch {
      // form validation failed
    }
  };

  const handleExport = async (org: OrgData) => {
    const token = sessionStorage.getItem("jwt_access_token");
    try {
      const resp = await fetch(`/api/organizations/${org.id}/export`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!resp.ok) throw new Error("导出失败");

      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kg_edu_export_${org.schemaName || org.id}.sql`;
      a.click();
      URL.revokeObjectURL(url);
      message.success(`租户「${org.name}」导出成功`);
    } catch (e: any) {
      message.error(e?.message || "导出失败");
    }
  };

  const handleImport = async () => {
    if (!importFile || !importName.trim()) {
      message.warning("请填写租户名称并选择文件");
      return;
    }
    setImporting(true);
    try {
      const token = sessionStorage.getItem("jwt_access_token");
      const formData = new FormData();
      formData.append("name", importName.trim());
      formData.append("file", importFile);

      const resp = await fetch("/api/organizations/import", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const result = await resp.json();
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ["organizations"] });
        setImportOpen(false);
        setImportName("");
        setImportFile(null);
        message.success(`租户「${importName}」导入成功`);
      } else {
        message.error(result.error || "导入失败");
      }
    } catch (e: any) {
      message.error(e?.message || "导入失败");
    } finally {
      setImporting(false);
    }
  };

  const columns: ColumnsType<OrgData> = [
    {
      title: "租户名称",
      dataIndex: "name",
      key: "name",
      width: 200,
      ellipsis: true,
    },
    {
      title: "操作",
      key: "action",
      width: 200,
      fixed: "right",
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="导出数据">
            <Button type="text" size="small" icon={<DownloadOutlined />} onClick={() => handleExport(record)} />
          </Tooltip>
          <Tooltip title="查看详情">
            <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => handleView(record)} />
          </Tooltip>
          <Tooltip title="编辑">
            <ReadonlyActionButton type="text" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          </Tooltip>
          <Popconfirm
            title="确定要删除这个租户吗？"
            description="此操作不可撤销，将删除租户及所有关联数据！"
            onConfirm={() => handleDelete(record.id, record.name)}
            okText="确定删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="删除">
              <ReadonlyActionButton type="text" size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (!isSuperAdmin) {
    return (
      <Card>
        <Alert
          message="权限不足"
          description="仅超级管理员(super_admin)可以管理租户。"
          type="error"
          showIcon
        />
      </Card>
    );
  }

  return (
    <div>
      <Card styles={{ body: { padding: isMobile ? 12 : 24 } }}>
        {/* 移动端工具栏 */}
        {isMobile && (
          <div style={{ marginBottom: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <Tag color="blue" style={{ fontSize: 11, padding: "0 6px" }}>
                租户: {orgs.length}
              </Tag>
              <Space size={4} wrap>
                <Button size="small" icon={<ImportOutlined />} onClick={() => setImportOpen(true)} style={canEdit ? undefined : { display: "none" }}>
                  导入
                </Button>
                <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleCreate} style={canEdit ? undefined : { display: "none" }}>
                  创建
                </Button>
              </Space>
            </div>
            <Input
              placeholder="搜索租户..."
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
            dataSource={filteredOrgs}
            rowKey="id"
            loading={isLoading}
            scroll={{ x: 600 }}
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
                    租户: {orgs.length}
                  </Tag>
                  <Input
                    placeholder="搜索租户..."
                    prefix={<SearchOutlined />}
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    style={{ width: 250 }}
                    allowClear
                  />
                </Space>
                <Space wrap>
                  <Button icon={<ImportOutlined />} onClick={() => setImportOpen(true)} style={canEdit ? undefined : { display: "none" }}>
                    导入租户
                  </Button>
                  <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate} style={canEdit ? undefined : { display: "none" }}>
                    创建租户
                  </Button>
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
          <MobileTableCard<OrgData>
            dataSource={filteredOrgs}
            loading={isLoading}
            title={(r) => r.name}
            subtitle={(r) => r.name}
            fields={(r) => []}
            actions={(r) => (
              <Space size={4} wrap>
                <Button size="small" type="text" icon={<DownloadOutlined />} onClick={() => handleExport(r)}>
                  导出
                </Button>
                <Button size="small" type="text" icon={<EyeOutlined />} onClick={() => handleView(r)}>
                  查看
                </Button>
                <ReadonlyActionButton size="small" type="text" icon={<EditOutlined />} onClick={() => handleEdit(r)}>
                  编辑
                </ReadonlyActionButton>
                <Popconfirm
                  title="删除租户？"
                  description="此操作不可撤销"
                  onConfirm={() => handleDelete(r.id, r.name)}
                  okText="确定"
                  cancelText="取消"
                  okButtonProps={{ danger: true }}
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
        title={selectedOrg ? "编辑租户" : "创建新租户"}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setSelectedOrg(null);
          form.resetFields();
        }}
        onOk={handleSubmit}
        confirmLoading={createOrgMutation.isPending || updateOrgMutation.isPending}
        okText={selectedOrg ? "保存" : "创建"}
        cancelText="取消"
        width="95%"
        style={{ maxWidth: 500 }}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="租户名称"
            rules={[{ required: true, message: "请输入租户名称" }]}
          >
            <Input placeholder="请输入租户名称" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Import Modal */}
      <Modal
        title="导入租户数据"
        open={importOpen}
        onCancel={() => {
          setImportOpen(false);
          setImportName("");
          setImportFile(null);
        }}
        onOk={handleImport}
        confirmLoading={importing}
        okText="开始导入"
        cancelText="取消"
        width="95%"
        style={{ maxWidth: 500 }}
        destroyOnHidden
      >
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <Typography.Text strong>新租户名称 *</Typography.Text>
            <Input
              placeholder="请输入新租户名称"
              value={importName}
              onChange={(e) => setImportName(e.target.value)}
              style={{ marginTop: 4 }}
            />
          </div>
          <div>
            <Typography.Text strong>选择导出文件 *</Typography.Text>
            <input
              type="file"
              accept=".sql"
              onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              style={{ display: "block", marginTop: 4, width: "100%" }}
            />
            {importFile && (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                已选择: {importFile.name}
              </Typography.Text>
            )}
          </div>
          <Alert
            message="导入将创建新租户并恢复所有数据（用户、课程、知识点等）"
            type="info"
            showIcon
            style={{ fontSize: 13 }}
          />
        </div>
      </Modal>

      <Drawer
        title={`租户详情 - ${viewingOrg?.name || ""}`}
        placement="right"
        width={isMobile ? "100%" : 480}
        onClose={() => {
          setDrawerOpen(false);
          setViewingOrg(null);
        }}
        open={drawerOpen}
      >
        {viewingOrg && (
          <Spin spinning={summaryLoading}>
            <Descriptions column={1} bordered size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="租户名称">{viewingOrg.name}</Descriptions.Item>
            </Descriptions>

            {orgSummary ? (
              <>
                <Divider orientation="left" style={{ fontSize: 14, margin: "12px 0" }}>
                  业务统计
                </Divider>

                <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
                  <Statistic title="用户" value={orgSummary.users?.total ?? 0} valueStyle={{ color: "#1677ff" }} />
                  <Statistic title="课程" value={orgSummary.courses?.total ?? 0} valueStyle={{ color: "#722ed1" }} />
                  <Statistic title="资源" value={orgSummary.knowledge_resources?.total ?? 0} valueStyle={{ color: "#fa8c16" }} />
                  <Statistic title="习题" value={orgSummary.exercises?.total ?? 0} valueStyle={{ color: "#eb2f96" }} />
                  <Statistic title="文件" value={orgSummary.files?.total ?? 0} valueStyle={{ color: "#13c2c2" }} />
                </div>

                <Divider orientation="left" style={{ fontSize: 14, margin: "12px 0" }}>
                  数据库统计
                </Divider>

                <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
                  <Statistic
                    title="业务表数量"
                    value={orgSummary.database?.table_count ?? 0}
                    valueStyle={{ color: "#1677ff" }}
                  />
                  <Statistic
                    title="总数据行数"
                    value={orgSummary.database?.total_rows ?? 0}
                    valueStyle={{ color: "#52c41a" }}
                  />
                </div>

              </>
            ) : (
              !summaryLoading && (
                <Empty description="暂无统计数据" style={{ marginTop: 32 }} />
              )
            )}
          </Spin>
        )}
      </Drawer>
    </div>
  );
}
