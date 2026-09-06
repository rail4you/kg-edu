import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom";
import {
  Card,
  Typography,
  Button,
  Input,
  Modal,
  Tag,
  Alert,
  Avatar,
  Empty,
  Spin,
  Row,
  Col,
  Table,
  Space,
  message,
  Tooltip,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CodeOutlined,
  RobotOutlined,
  AppstoreOutlined,
  UnorderedListOutlined,
  ArrowLeftOutlined
} from "@ant-design/icons";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslate } from "@/locales/use-locales";
import {
  createCommand,
  listCommands,
  updateCommand,
  deleteCommand,
  getCommand,
  type AICommandResourceSchema,
} from "@/lib/ash_rpc";
import { getAuthHeaders } from "@/lib/auth";
import { useAuth } from "@/auth/auth-context";
import { useEditPermission } from "@/hooks/use-edit-permission";
import { ReadonlyActionButton } from "@/components/readonly-action-button";
import TemplateSelector from "@/components/ai-command-templates/TemplateSelector";
import type { AITemplate } from "@/config/aiCommandTemplates";

const { Title, Text } = Typography;
const { TextArea } = Input;

const commandFormSchema = z.object({
  title: z.string().optional(),
  user: z.string().optional(),
  system: z.string().optional(),
  assistant: z.string().optional(),
});

type CommandFormData = z.infer<typeof commandFormSchema>;

interface AICommand extends AICommandResourceSchema {
  id: string;
  title: string | null;
  user: string | null;
  system: string | null;
  assistant: string | null;
}

const extractArrayData = (result: any): any[] => {
  if (result?.success && result.data) {
    if (Array.isArray(result.data)) return result.data;
    if ("results" in result.data && Array.isArray(result.data.results))
      return result.data.results;
    if ("data" in result.data && Array.isArray(result.data.data))
      return result.data.data;
  }
  return [];
};

const getHeaders = (user: any): Record<string, string> =>
  getAuthHeaders(user) as Record<string, string>;

const TEXT_MAX_LENGTH = 80;

const isTextTooLong = (text: string | null): boolean => {
  return text ? text.length > TEXT_MAX_LENGTH : false;
};

export default function AiCommand() {
  const navigate = useNavigate();
  const { t } = useTranslate("teacher");
  const { user } = useAuth();
  const { canEdit } = useEditPermission();

  const [commands, setCommands] = useState<AICommand[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCommand, setEditingCommand] = useState<AICommand | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [commandToDelete, setCommandToDelete] = useState<string | null>(null);
  const [templateSelectorOpen, setTemplateSelectorOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"card" | "table">("card");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
    setValue,
    trigger,
    watch,
  } = useForm<CommandFormData>({
    resolver: zodResolver(commandFormSchema),
    defaultValues: {
      title: "",
      user: "",
      system: "",
      assistant: "",
    },
  });

  const watchFields = watch(["title", "user", "system", "assistant"]);

  const loadCommands = async () => {
    try {
      setLoading(true);
      const result = await listCommands({
        fields: ["id", "title", "user", "system", "assistant"],
        page: { limit: 50 },
        headers: getHeaders(user),
      });

      const data = extractArrayData(result);
      setCommands(data as AICommand[]);
    } catch (error) {
      message.error(t("pages.aiCommand.loadError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCommands();
  }, []);

  const handleCreate = () => {
    setEditingCommand(null);
    setValue("title", "");
    setValue("user", "");
    setValue("system", "");
    setValue("assistant", "");
    setDialogOpen(true);
  };

  const handleTemplateSelect = (template: AITemplate) => {
    setEditingCommand(null);
    setDialogOpen(true);
    setValue("title", template.name);
    setValue("user", template.userPrompt);
    setValue("system", template.systemPrompt);
    setValue("assistant", "");
    trigger(["title", "user", "system", "assistant"]);
  };

  const handleEdit = async (command: AICommand) => {
    try {
      const result = await getCommand({
        input: { id: command.id },
        fields: ["id", "title", "user", "system", "assistant"],
        headers: getHeaders(user),
      });

      if (result.success && result.data) {
        setEditingCommand(result.data as AICommand);
        setValue("title", result.data.title || "");
        setValue("user", result.data.user || "");
        setValue("system", result.data.system || "");
        setValue("assistant", result.data.assistant || "");
        setDialogOpen(true);
      } else {
        message.error(t("pages.aiCommand.loadFailed"));
      }
    } catch (error) {
      message.error(t("pages.aiCommand.loadError"));
    }
  };

  const handleDelete = (id: string) => {
    setCommandToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!commandToDelete) return;

    try {
      const result = await deleteCommand({
        primaryKey: commandToDelete,
        headers: getHeaders(user),
      });

      if (result.success) {
        message.success(t("pages.aiCommand.deleteSuccess"));
        loadCommands();
      } else {
        message.error(t("pages.aiCommand.deleteFailed"));
      }
    } catch (error) {
      message.error(t("pages.aiCommand.saveError"));
    } finally {
      setDeleteDialogOpen(false);
      setCommandToDelete(null);
    }
  };

  const onSubmit = async (data: CommandFormData) => {
    try {
      if (editingCommand) {
        const result = await updateCommand({
          primaryKey: editingCommand.id,
          input: {
            title: data.title || null,
            user: data.user || null,
            system: data.system || null,
            assistant: data.assistant || null,
          },
          fields: ["id", "title", "user", "system", "assistant"],
          headers: getHeaders(user),
        });

        if (result.success) {
          message.success(t("pages.aiCommand.updateSuccess"));
          loadCommands();
          setDialogOpen(false);
        } else {
          message.error(t("pages.aiCommand.updateFailed"));
        }
      } else {
        const result = await createCommand({
          input: {
            title: data.title || null,
            user: data.user || null,
            system: data.system || null,
            assistant: data.assistant || null,
          },
          fields: ["id", "title", "user", "system", "assistant"],
          headers: getHeaders(user),
        });

        if (result.success) {
          message.success(t("pages.aiCommand.createSuccess"));
          loadCommands();
          setDialogOpen(false);
        } else {
          message.error(t("pages.aiCommand.createFailed"));
        }
      }
    } catch (error) {
      message.error(t("pages.aiCommand.saveError"));
    }
  };

  return (
    <div className="ai-cmd-wrap" style={{ padding: 24, minHeight: "100vh" }}>
      <style>{`@media(max-width:768px){.ai-cmd-wrap{padding:12px!important}.ai-cmd-wrap .ant-table-cell{padding:6px 4px!important}.ai-cmd-wrap .cmd-action-text{display:none!important}}`}</style>
      {/* 标题区域 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <Button
            className="teacher-page-back-btn"
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/teacher/dashboard")}
            style={{ color: "#1890ff", padding: "4px 8px", fontSize: 16 }}
          />
          <RobotOutlined style={{ fontSize: 24, color: "#1890ff" }} />
          <Title level={4} style={{ margin: 0 }}>{t("pages.aiCommand.title")}</Title>
        </div>
        <Text type="secondary">{t("pages.aiCommand.description")}</Text>
      </div>

      {/* 工具栏 */}
      <div style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <Space>
          <Button icon={<AppstoreOutlined />} onClick={() => setTemplateSelectorOpen(true)} style={canEdit ? undefined : { display: "none" }}>
            {t("pages.aiCommand.useTemplate")}
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate} style={canEdit ? undefined : { display: "none" }}>
            {t("pages.aiCommand.createNew")}
          </Button>
        </Space>
        <Space.Compact>
          <Button
            type={viewMode === "card" ? "primary" : "default"}
            icon={<AppstoreOutlined />}
            onClick={() => setViewMode("card")}
          >
            卡片
          </Button>
          <Button
            type={viewMode === "table" ? "primary" : "default"}
            icon={<UnorderedListOutlined />}
            onClick={() => setViewMode("table")}
          >
            表格
          </Button>
        </Space.Compact>
      </div>

      {/* 内容区域 */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 64 }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>
            <Text type="secondary">{t("pages.aiCommand.loading")}</Text>
          </div>
        </div>
      ) : commands.length === 0 ? (
        <Empty
          image={<CodeOutlined style={{ fontSize: 64, color: "#1890ff" }} />}
          description={
            <div>
              <Text strong style={{ display: "block", marginBottom: 8 }}>
                {t("pages.aiCommand.noCommands")}
              </Text>
              <Text type="secondary">
                {t("pages.aiCommand.noCommandsHint")}
              </Text>
              <div style={{ marginTop: 16 }}>
                <Space>
                  <Button icon={<AppstoreOutlined />} onClick={() => setTemplateSelectorOpen(true)} style={canEdit ? undefined : { display: "none" }}>
                    {t("pages.aiCommand.useTemplate")}
                  </Button>
                  <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate} style={canEdit ? undefined : { display: "none" }}>
                    {t("pages.aiCommand.createNew")}
                  </Button>
                </Space>
              </div>
            </div>
          }
        />
      ) : viewMode === "card" ? (
        <Row gutter={[16, 16]}>
          {commands.map((command) => (
            <Col xs={24} sm={12} lg={8} key={command.id}>
              <Card
                style={{ borderRadius: 8, border: "1px solid #f0f0f0" }}
                styles={{ body: { padding: 16 } }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                  <Text strong style={{ fontSize: 15 }}>
                    {command.title || t("pages.aiCommand.unnamedCommand")}
                  </Text>
                  <Space size={4}>
                    <ReadonlyActionButton title={t("pages.aiCommand.editCommand")} type="text" size="small" icon={<EditOutlined />} onClick={() => handleEdit(command)} />
                    <ReadonlyActionButton title={t("pages.aiCommand.deleteCommand")} type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(command.id)} />
                  </Space>
                </div>
                {command.user && (
                  <Text type="secondary" style={{ fontSize: 13 }} ellipsis={{ rows: 2 }}>
                    {command.user}
                  </Text>
                )}
              </Card>
            </Col>
          ))}
        </Row>
      ) : (
        <Card style={{ borderRadius: 8 }}>
          <Table
            dataSource={commands}
            columns={[
              {
                title: "命令名称",
                dataIndex: "title",
                key: "title",
                render: (_, record) => {
                  const name = record.title || t("pages.aiCommand.unnamedCommand");
                  return <Tooltip title={name} mouseEnterDelay={0.3}><Text style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</Text></Tooltip>;
                },
              },
              {
                title: "用户模板",
                dataIndex: "user",
                key: "user",
                render: (user) => user ? <Text ellipsis style={{ maxWidth: 300 }}>{user}</Text> : "-",
              },
              {
                title: "操作",
                key: "actions",
                width: 100,
                render: (_, record) => (
                  <Space>
                    <ReadonlyActionButton type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
                      {t("pages.aiCommand.editCommand")}
                    </ReadonlyActionButton>
                    <ReadonlyActionButton type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)}>
                      {t("pages.aiCommand.deleteCommand")}
                    </ReadonlyActionButton>
                  </Space>
                ),
              },
            ]}
            rowKey="id"
            pagination={false}
            size="small"
          />
        </Card>
      )}

      {/* 表单弹窗 */}
      <Modal
        open={dialogOpen}
        onCancel={() => setDialogOpen(false)}
        footer={null}
        width={600}
        title={editingCommand ? t("pages.aiCommand.dialogEditTitle") : t("pages.aiCommand.dialogCreateTitle")}
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          <div style={{ marginBottom: 16 }}>
            <Text strong style={{ display: "block", marginBottom: 8 }}>{t("pages.aiCommand.fieldName")}</Text>
            <Input
              placeholder={t("pages.aiCommand.fieldNamePlaceholder")}
              value={watchFields[0]}
              onChange={(e) => setValue("title", e.target.value)}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <Text strong style={{ display: "block", marginBottom: 8 }}>{t("pages.aiCommand.fieldUserTemplate")}</Text>
            <TextArea
              rows={3}
              placeholder={t("pages.aiCommand.fieldUserPlaceholder")}
              value={watchFields[1]}
              onChange={(e) => setValue("user", e.target.value)}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <Text strong style={{ display: "block", marginBottom: 8 }}>{t("pages.aiCommand.fieldSystem")}</Text>
            <TextArea
              rows={3}
              placeholder={t("pages.aiCommand.fieldSystemPlaceholder")}
              value={watchFields[2]}
              onChange={(e) => setValue("system", e.target.value)}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <Text strong style={{ display: "block", marginBottom: 8 }}>{t("pages.aiCommand.fieldAssistant")}</Text>
            <TextArea
              rows={3}
              placeholder={t("pages.aiCommand.fieldAssistantPlaceholder")}
              value={watchFields[3]}
              onChange={(e) => setValue("assistant", e.target.value)}
            />
          </div>
          <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end", gap: 12 }}>
            <Button onClick={() => setDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button type="primary" htmlType="submit">
              {editingCommand ? t("pages.aiCommand.buttonUpdate") : t("pages.aiCommand.buttonCreate")}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={deleteDialogOpen}
        onCancel={() => setDeleteDialogOpen(false)}
        onOk={confirmDelete}
        okText={t("dialog.confirm")}
        cancelText={t("common.cancel")}
        okButtonProps={{ danger: true }}
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Avatar style={{ backgroundColor: "#fee2e2", color: "#dc2626" }}>
              <DeleteOutlined />
            </Avatar>
            <div>
              <div style={{ fontWeight: 600 }}>
                {t("pages.aiCommand.deleteConfirmTitle")}
              </div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t("pages.aiCommand.deleteConfirmDesc")}
              </Text>
            </div>
          </div>
        }
      >
        <p style={{ marginBottom: 16 }}>
          {t("pages.aiCommand.deleteConfirmMessage")}
        </p>
        <Alert
          type="warning"
          message={t("pages.aiCommand.deleteWarning")}
          showIcon
        />
      </Modal>

      <TemplateSelector
        open={templateSelectorOpen}
        onClose={() => setTemplateSelectorOpen(false)}
        onSelect={handleTemplateSelect}
      />
    </div>
  );
}
