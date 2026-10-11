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
  AppstoreOutlined,
  UnorderedListOutlined,
  SearchOutlined,
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
import { AppPage, ProtoCard, ProtoTabs, ProtoEmpty } from "@/components/proto";
import TemplateSelector from "@/components/ai-command-templates/TemplateSelector";
import type { AITemplate } from "@/config/aiCommandTemplates";

const { Text } = Typography;
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
  const [subtab, setSubtab] = useState("all");
  const [searchText, setSearchText] = useState("");

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
    <AppPage
      className="ai-cmd-wrap"
      title="AI命令中心"
      description="配置与管理工作台中的 AI 命令模板，辅助备课、答疑与知识梳理。"
      breadcrumb={<>智慧课程&nbsp;&nbsp;/&nbsp;&nbsp;AI命令中心</>}
      actions={
        <>
          <Button icon={<AppstoreOutlined />} onClick={() => setTemplateSelectorOpen(true)} style={canEdit ? undefined : { display: "none" }}>
            {t("pages.aiCommand.useTemplate")}
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate} style={canEdit ? undefined : { display: "none" }}>
            {t("pages.aiCommand.createNew")}
          </Button>
        </>
      }
    >
      <ProtoCard>
        <ProtoTabs
          items={[
            { id: "all", label: "全部记录" },
            { id: "recent", label: "最近更新" },
          ]}
          active={subtab}
          onChange={setSubtab}
        />

        <div className="pu-filters">
          <Input
            className="pu-search"
            placeholder="搜索命令名称"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
          />
          <Button onClick={() => setSearchText("")}>重置</Button>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 64 }}>
            <Spin size="large" />
          </div>
        ) : commands.filter((c) =>
            !searchText ||
            (c.title || "").toLowerCase().includes(searchText.toLowerCase()),
          ).length === 0 ? (
          <ProtoEmpty
            title={t("pages.aiCommand.noCommands")}
            description={
              searchText
                ? "未找到匹配的命令，请调整关键词。"
                : t("pages.aiCommand.noCommandsHint")
            }
            action={
              <Space>
                <Button icon={<AppstoreOutlined />} onClick={() => setTemplateSelectorOpen(true)} style={canEdit ? undefined : { display: "none" }}>
                  {t("pages.aiCommand.useTemplate")}
                </Button>
                <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate} style={canEdit ? undefined : { display: "none" }}>
                  {t("pages.aiCommand.createNew")}
                </Button>
              </Space>
            }
          />
        ) : (
          <>
            <Table
              dataSource={commands.filter((c) =>
                !searchText ||
                (c.title || "").toLowerCase().includes(searchText.toLowerCase()),
              )}
              columns={[
                {
                  title: "命令名称",
                  dataIndex: "title",
                  key: "title",
                  render: (_, record) => {
                    const name = record.title || t("pages.aiCommand.unnamedCommand");
                    return (
                      <Tooltip title={name} mouseEnterDelay={0.3}>
                        <Text style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {name}
                        </Text>
                      </Tooltip>
                    );
                  },
                },
                {
                  title: "用户模板",
                  dataIndex: "user",
                  key: "user",
                  render: (user) => (user ? <Text ellipsis style={{ maxWidth: 300 }}>{user}</Text> : "-"),
                },
                {
                  title: "操作",
                  key: "actions",
                  width: 140,
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
              size="middle"
            />
            <div className="pu-table-footer">
              <span>共 {commands.length} 条命令</span>
            </div>
          </>
        )}
      </ProtoCard>

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
    </AppPage>
  );
}
