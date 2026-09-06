import React, { useState, useEffect, useRef } from "react";
import {
  Card,
  Row,
  Col,
  Typography,
  Button,
  Input,
  Avatar,
  Tag,
  List,
  Tabs,
  Switch,
  Alert,
  Progress,
  Space,
  Badge,
  Table,
  Tooltip,
  message,
} from "antd";
import type { TabsProps } from "antd";
import {
  SendOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  UserOutlined,
  RobotOutlined,
  SettingOutlined,
  PlusOutlined,
  SearchOutlined,
  FilterOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
  CommentOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { useEditPermission } from "@/hooks/use-edit-permission";
import { ReadonlyActionButton } from "@/components/readonly-action-button";

const { Title, Text } = Typography;
const { Search } = Input;

interface Message {
  id: string;
  content: string;
  sender: string;
  senderType: "user" | "ai";
  avatar?: string;
  timestamp: Date;
  isOnline?: boolean;
}

interface User {
  id: string;
  name: string;
  avatar?: string;
  role: "teacher" | "student" | "ai";
  isOnline: boolean;
  lastSeen?: Date;
  checkedIn?: boolean;
  checkInTime?: Date;
  status: "online" | "offline" | "busy";
}

interface ChatGroup {
  id: string;
  courseName: string;
  courseId: string;
  instructorId: string;
  instructorName: string;
  isActive: boolean;
  checkInEnabled: boolean;
  checkInStartTime: Date | null;
  checkInEndTime: Date | null;
  participants: User[];
  aiCharacters: User[];
  messages: Message[];
  checkInStats: {
    total: number;
    checkedIn: number;
    rate: number;
  };
  createdAt: Date;
}

export default function AIDiscussionPage() {
  const { user } = useAuth();
  const tenant = getCurrentTenant()?.schemaName;
  const { canEdit } = useEditPermission();
  const [activeTab, setActiveTab] = useState("0");
  const [messageText, setMessageText] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [chatGroups, setChatGroups] = useState<ChatGroup[]>([
    {
      id: "1",
      courseName: "高等数学微积分",
      courseId: "math-101",
      instructorId: "teacher-1",
      instructorName: "张教授",
      isActive: true,
      checkInEnabled: false,
      checkInStartTime: null,
      checkInEndTime: null,
      participants: [
        {
          id: "user-1",
          name: "李小明",
          avatar: "LM",
          role: "student",
          isOnline: true,
          lastSeen: new Date(),
          checkedIn: true,
          checkInTime: new Date(Date.now() - 30 * 60 * 1000),
          status: "online",
        },
        {
          id: "user-2",
          name: "王芳",
          avatar: "WF",
          role: "student",
          isOnline: true,
          lastSeen: new Date(),
          checkedIn: false,
          status: "online",
        },
        {
          id: "user-3",
          name: "赵强",
          avatar: "ZQ",
          role: "student",
          isOnline: false,
          lastSeen: new Date(Date.now() - 5 * 60 * 1000),
          checkedIn: true,
          checkInTime: new Date(Date.now() - 15 * 60 * 1000),
          status: "offline",
        },
      ],
      aiCharacters: [
        {
          id: "ai-1",
          name: "数学助教",
          avatar: "MA",
          role: "ai",
          isOnline: true,
          status: "online",
        },
        {
          id: "ai-2",
          name: "概念解析师",
          avatar: "CA",
          role: "ai",
          isOnline: true,
          status: "online",
        },
      ],
      messages: [
        {
          id: "msg-1",
          content:
            "欢迎来到高等数学微积分课程讨论组！今天我们讨论的是函数极限的定义和计算方法。",
          sender: "张教授",
          senderType: "user",
          avatar: "TC",
          timestamp: new Date(Date.now() - 10 * 60 * 1000),
        },
        {
          id: "msg-2",
          content: "老师，我对ε-δ定义还有些困惑，能再解释一下吗？",
          sender: "李小明",
          senderType: "user",
          avatar: "LM",
          timestamp: new Date(Date.now() - 8 * 60 * 1000),
          isOnline: true,
        },
        {
          id: "msg-3",
          content:
            "ε-δ定义是理解连续性的关键。对于任意ε > 0，存在δ > 0，使得当0 < |x-a| < δ时，|f(x) - L| < ε。这意味着要使函数值无限接近L，只要x足够接近a即可。",
          sender: "数学助教",
          senderType: "ai",
          avatar: "MA",
          timestamp: new Date(Date.now() - 5 * 60 * 1000),
          isOnline: true,
        },
      ],
      checkInStats: {
        total: 3,
        checkedIn: 2,
        rate: 66.7,
      },
      createdAt: new Date(),
    },
    {
      id: "2",
      courseName: "数据结构与算法",
      courseId: "cs-101",
      instructorId: "teacher-2",
      instructorName: "刘老师",
      isActive: true,
      checkInEnabled: true,
      checkInStartTime: new Date(Date.now() - 60 * 60 * 1000),
      checkInEndTime: new Date(Date.now() + 60 * 60 * 1000),
      participants: [
        {
          id: "user-4",
          name: "陈晓东",
          avatar: "CX",
          role: "student",
          isOnline: true,
          lastSeen: new Date(),
          checkedIn: true,
          checkInTime: new Date(Date.now() - 2 * 60 * 1000),
          status: "online",
        },
      ],
      aiCharacters: [
        {
          id: "ai-3",
          name: "算法专家",
          avatar: "AE",
          role: "ai",
          isOnline: true,
          status: "online",
        },
      ],
      messages: [
        {
          id: "msg-4",
          content: "今天我们来学习二叉树的基本概念和遍历算法。",
          sender: "刘老师",
          senderType: "user",
          avatar: "LL",
          timestamp: new Date(Date.now() - 5 * 60 * 1000),
        },
      ],
      checkInStats: {
        total: 1,
        checkedIn: 1,
        rate: 100,
      },
      createdAt: new Date(Date.now() - 2 * 60 * 1000),
    },
    {
      id: "3",
      courseName: "大学物理实验",
      courseId: "phys-201",
      instructorId: "teacher-3",
      instructorName: "周教授",
      isActive: false,
      checkInEnabled: false,
      checkInStartTime: null,
      checkInEndTime: null,
      participants: [
        {
          id: "user-5",
          name: "孙丽华",
          avatar: "SL",
          role: "student",
          isOnline: false,
          lastSeen: new Date(Date.now() - 30 * 60 * 1000),
          checkedIn: false,
          status: "offline",
        },
      ],
      aiCharacters: [],
      messages: [],
      checkInStats: {
        total: 1,
        checkedIn: 0,
        rate: 0,
      },
      createdAt: new Date(Date.now() - 5 * 60 * 1000),
    },
  ]);

  const currentGroup = chatGroups.find((group) => group.id === selectedGroup);

  useEffect(() => {
    if (!selectedGroup && chatGroups.length > 0) {
      setSelectedGroup(chatGroups[0].id);
    }
  }, [selectedGroup, chatGroups]);

  const handleGroupSelect = (groupId: string) => {
    setSelectedGroup(groupId);
  };

  const handleSendMessage = () => {
    if (!messageText.trim() || !currentGroup) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      content: messageText,
      sender: "当前用户",
      senderType: "user",
      timestamp: new Date(),
    };

    setChatGroups((prev) =>
      prev.map((group) =>
        group.id === selectedGroup
          ? {
              ...group,
              messages: [...group.messages, newMessage],
            }
          : group,
      ),
    );

    setMessageText("");
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const handleToggleCheckIn = (groupId: string, enabled: boolean) => {
    setChatGroups((prev) =>
      prev.map((group) => {
        if (group.id === groupId) {
          return {
            ...group,
            checkInEnabled: enabled,
            checkInStartTime: enabled ? new Date() : null,
            checkInEndTime: enabled
              ? new Date(Date.now() + 60 * 60 * 1000)
              : null,
            participants: group.participants.map((participant) => ({
              ...participant,
              checkedIn: false,
            })),
            checkInStats: {
              total: group.participants.length,
              checkedIn: 0,
              rate: 0,
            },
          };
        }
        return group;
      }),
    );
  };

  const handleUserCheckIn = (userId: string) => {
    setChatGroups((prev) =>
      prev.map((group) => {
        if (group.id === selectedGroup && group.checkInEnabled) {
          const updatedParticipants = group.participants.map((participant) =>
            participant.id === userId
              ? { ...participant, checkedIn: !participant.checkedIn }
              : participant,
          );

          const checkedInCount = updatedParticipants.filter(
            (p) => p.checkedIn,
          ).length;

          return {
            ...group,
            participants: updatedParticipants,
            checkInStats: {
              total: updatedParticipants.length,
              checkedIn: checkedInCount,
              rate: Math.round(
                (checkedInCount / updatedParticipants.length) * 100,
              ),
            },
          };
        }
        return group;
      }),
    );
  };

  const groupColumns = [
    {
      title: "课程名称",
      dataIndex: "courseName",
      key: "courseName",
      ellipsis: true,
    },
    {
      title: "教师",
      dataIndex: "instructorName",
      key: "instructorName",
      width: 120,
    },
    {
      title: "参与人数",
      dataIndex: "participants",
      key: "participants",
      width: 100,
      render: (participants: User[]) => (
        <Space>
          <TeamOutlined style={{ color: "#666" }} />
          <Text>{participants.length}</Text>
        </Space>
      ),
    },
    {
      title: "签到率",
      key: "checkInRate",
      width: 100,
      render: (_: unknown, record: ChatGroup) => (
        <Text style={{ color: "#52c41a" }}>{record.checkInStats.rate}%</Text>
      ),
    },
    {
      title: "状态",
      dataIndex: "isActive",
      key: "isActive",
      width: 100,
      render: (isActive: boolean) => (
        <Tag color={isActive ? "green" : "default"}>
          {isActive ? "活跃" : "非活跃"}
        </Tag>
      ),
    },
    {
      title: "操作",
      key: "actions",
      width: 100,
      render: () => (
        <Space>
          <Button type="text" size="small" icon={<SearchOutlined />} />
          <ReadonlyActionButton type="text" size="small" icon={<SettingOutlined />} />
        </Space>
      ),
    },
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentGroup?.messages]);

  const renderTab1 = () => (
    <Card>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <Search
          placeholder="搜索讨论组..."
          style={{ width: 300 }}
          prefix={<SearchOutlined />}
        />
        <Button icon={<FilterOutlined />}>筛选</Button>
      </div>
      <Table
        columns={groupColumns}
        dataSource={chatGroups}
        rowKey="id"
        pagination={false}
        onRow={(record) => ({
          onClick: () => handleGroupSelect(record.id),
          style: { cursor: "pointer" },
        })}
      />
    </Card>
  );

  const renderTab2 = () => (
    <Row gutter={16} style={{ height: "calc(100vh - 240px)" }}>
      <Col xs={24} md={6}>
        <Card
          style={{ height: "100%", overflow: "auto" }}
          styles={{ body: { padding: 16 } }}
        >
          <Title level={5} style={{ marginBottom: 16 }}>
            讨论组列表
          </Title>
          <List
            dataSource={chatGroups}
            style={{ maxHeight: 400, overflow: "auto" }}
            renderItem={(group) => (
              <List.Item
                onClick={() => handleGroupSelect(group.id)}
                style={{
                  cursor: "pointer",
                  backgroundColor:
                    selectedGroup === group.id ? "#1890ff" : "transparent",
                  borderRadius: 8,
                  padding: "8px 12px",
                  marginBottom: 8,
                  color: selectedGroup === group.id ? "#fff" : "inherit",
                }}
              >
                <List.Item.Meta
                  avatar={
                    <Avatar
                      style={{
                        backgroundColor:
                          selectedGroup === group.id ? "#fff" : "#999",
                      }}
                    >
                      <TeamOutlined />
                    </Avatar>
                  }
                  title={
                    <span
                      style={{
                        color: selectedGroup === group.id ? "#fff" : "inherit",
                      }}
                    >
                      {group.courseName}
                    </span>
                  }
                  description={
                    <span
                      style={{
                        color:
                          selectedGroup === group.id
                            ? "rgba(255,255,255,0.8)"
                            : "#666",
                      }}
                    >
                      {group.participants.length}人参与
                    </span>
                  }
                />
                <Space>
                  {group.checkInEnabled && <Tag color="blue">签到中</Tag>}
                  <Badge
                    count={group.participants.filter((p) => p.isOnline).length}
                    size="small"
                    style={{ backgroundColor: "#52c41a" }}
                  />
                </Space>
              </List.Item>
            )}
          />
        </Card>
      </Col>

      <Col xs={24} md={12}>
        {currentGroup ? (
          <Card
            style={{ height: "100%", display: "flex", flexDirection: "column" }}
            styles={{
              body: {
                padding: 0,
                display: "flex",
                flexDirection: "column",
                flex: 1,
              },
            }}
          >
            <div
              style={{
                padding: 16,
                borderBottom: "1px solid #f0f0f0",
                backgroundColor: "#fafafa",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Space>
                <Avatar style={{ backgroundColor: "#1890ff" }}>
                  <TeamOutlined />
                </Avatar>
                <div>
                  <Title level={5} style={{ margin: 0 }}>
                    {currentGroup.courseName}
                  </Title>
                  <Text type="secondary">
                    {currentGroup.instructorName} •{" "}
                    {currentGroup.participants.length}人参与
                  </Text>
                </div>
              </Space>
              <Space>
                {currentGroup.checkInEnabled && (
                  <Alert
                    type="info"
                    style={{ padding: "4px 12px" }}
                    message={
                      <Space>
                        <ClockCircleOutlined />
                        <Text>
                          签到{" "}
                          {new Date(
                            currentGroup.checkInEndTime!,
                          ).toLocaleTimeString()}
                        </Text>
                      </Space>
                    }
                  />
                )}
                {currentGroup.isActive && <Tag color="success">进行中</Tag>}
              </Space>
            </div>

            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: 16,
                backgroundColor: "#fff",
              }}
            >
              {currentGroup.messages.map((msg) => (
                <div
                  key={msg.id}
                  style={{
                    display: "flex",
                    justifyContent:
                      msg.senderType === "user" ? "flex-end" : "flex-start",
                    marginBottom: 16,
                  }}
                >
                  {msg.senderType !== "user" && (
                    <Avatar
                      style={{
                        backgroundColor:
                          msg.senderType === "ai" ? "#722ed1" : "#1890ff",
                        marginRight: 8,
                        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                      }}
                    >
                      {msg.senderType === "ai" ? (
                        <RobotOutlined />
                      ) : (
                        <UserOutlined />
                      )}
                    </Avatar>
                  )}
                  <div
                    style={{
                      padding: 12,
                      maxWidth: "70%",
                      backgroundColor:
                        msg.senderType === "user" ? "#1890ff" : "#fff",
                      color: msg.senderType === "user" ? "#fff" : "inherit",
                      borderRadius:
                        msg.senderType === "user"
                          ? "16px 16px 4px 16px"
                          : "16px 16px 16px 4px",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                      border:
                        msg.senderType === "user"
                          ? "none"
                          : "1px solid #f0f0f0",
                    }}
                  >
                    <Text
                      style={{
                        color: msg.senderType === "user" ? "#fff" : "inherit",
                        lineHeight: 1.5,
                      }}
                    >
                      {msg.content}
                    </Text>
                    <div
                      style={{
                        color:
                          msg.senderType === "user"
                            ? "rgba(255,255,255,0.8)"
                            : "#999",
                        marginTop: 4,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          color:
                            msg.senderType === "user"
                              ? "rgba(255,255,255,0.8)"
                              : "#999",
                        }}
                      >
                        {msg.timestamp.toLocaleTimeString()}
                      </Text>
                    </div>
                  </div>
                  {msg.senderType === "user" && (
                    <Avatar
                      style={{
                        backgroundColor: "#667eea",
                        marginLeft: 8,
                        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                      }}
                    >
                      <UserOutlined />
                    </Avatar>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div style={{ padding: 16, borderTop: "1px solid #f0f0f0" }}>
              <Space.Compact style={{ width: "100%" }}>
                <Input.TextArea
                  placeholder="输入消息..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  autoSize={{ minRows: 1, maxRows: 3 }}
                  onPressEnter={(e) => {
                    if (!e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  disabled={!currentGroup}
                />
                <Button
                  type="primary"
                  onClick={handleSendMessage}
                  disabled={!currentGroup || !messageText.trim()}
                  icon={<SendOutlined />}
                  style={canEdit ? undefined : { display: "none" }}
                >
                  发送
                </Button>
              </Space.Compact>
            </div>
          </Card>
        ) : (
          <Card
            style={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <CommentOutlined
                style={{ fontSize: 48, color: "#ccc", marginBottom: 16 }}
              />
              <Title level={5} type="secondary">
                选择一个讨论组开始聊天
              </Title>
              <Text type="secondary">从左侧列表中选择或创建新的讨论组</Text>
            </div>
          </Card>
        )}
      </Col>

      <Col xs={24} md={6}>
        <Card
          style={{ height: "100%", overflow: "auto" }}
          styles={{ body: { padding: 16 } }}
        >
          <Space style={{ marginBottom: 16 }}>
            <TeamOutlined style={{ color: "#1890ff" }} />
            <Title level={5} style={{ margin: 0 }}>
              参与者 ({currentGroup?.participants.length || 0})
            </Title>
          </Space>

          {currentGroup && (
            <>
              <div style={{ marginBottom: 24 }}>
                <Space style={{ marginBottom: 8 }}>
                  <Badge status="success" />
                  <Text strong style={{ color: "#52c41a" }}>
                    在线用户 (
                    {currentGroup.participants.filter((p) => p.isOnline).length}
                    )
                  </Text>
                </Space>
                <List
                  size="small"
                  dataSource={currentGroup.participants.filter(
                    (p) => p.isOnline,
                  )}
                  renderItem={(user) => (
                    <List.Item style={{ padding: "4px 0" }}>
                      <List.Item.Meta
                        avatar={
                          <Avatar
                            size={32}
                            style={{
                              backgroundColor: "#52c41a",
                              border: "2px solid #fff",
                            }}
                          >
                            {user.avatar}
                          </Avatar>
                        }
                        title={user.name}
                        description={
                          user.checkedIn ? (
                            <Space size={4}>
                              <CheckCircleOutlined
                                style={{ fontSize: 12, color: "#52c41a" }}
                              />
                              <Text style={{ fontSize: 12, color: "#52c41a" }}>
                                已签到
                              </Text>
                            </Space>
                          ) : null
                        }
                      />
                      {user.role === "student" &&
                        currentGroup.checkInEnabled && canEdit && (
                          <Button
                            type="text"
                            size="small"
                            icon={
                              user.checkedIn ? (
                                <CheckCircleOutlined
                                  style={{ color: "#52c41a" }}
                                />
                              ) : (
                                <CheckCircleOutlined
                                  style={{ color: "#999" }}
                                />
                              )
                            }
                            onClick={() => handleUserCheckIn(user.id)}
                          />
                        )}
                    </List.Item>
                  )}
                />
              </div>

              {currentGroup.participants.filter((p) => !p.isOnline).length >
                0 && (
                <div style={{ marginBottom: 24 }}>
                  <Space style={{ marginBottom: 8 }}>
                    <Badge status="default" />
                    <Text strong type="secondary">
                      离线用户 (
                      {
                        currentGroup.participants.filter((p) => !p.isOnline)
                          .length
                      }
                      )
                    </Text>
                  </Space>
                  <List
                    size="small"
                    dataSource={currentGroup.participants.filter(
                      (p) => !p.isOnline,
                    )}
                    renderItem={(user) => (
                      <List.Item style={{ padding: "4px 0" }}>
                        <List.Item.Meta
                          avatar={
                            <Avatar
                              size={32}
                              style={{ backgroundColor: "#999", opacity: 0.7 }}
                            >
                              {user.avatar}
                            </Avatar>
                          }
                          title={user.name}
                          description={
                            user.checkedIn ? (
                              <Space size={4}>
                                <CheckCircleOutlined
                                  style={{ fontSize: 12, color: "#52c41a" }}
                                />
                                <Text
                                  style={{ fontSize: 12, color: "#52c41a" }}
                                >
                                  已签到
                                </Text>
                              </Space>
                            ) : null
                          }
                        />
                        {user.role === "student" &&
                          currentGroup.checkInEnabled && canEdit && (
                            <Button
                              type="text"
                              size="small"
                              icon={
                                user.checkedIn ? (
                                  <CheckCircleOutlined
                                    style={{ color: "#52c41a" }}
                                  />
                                ) : (
                                  <CheckCircleOutlined
                                    style={{ color: "#999" }}
                                  />
                                )
                              }
                              onClick={() => handleUserCheckIn(user.id)}
                            />
                          )}
                      </List.Item>
                    )}
                  />
                </div>
              )}

              {currentGroup.aiCharacters.length > 0 && (
                <div>
                  <Space style={{ marginBottom: 8 }}>
                    <RobotOutlined style={{ color: "#722ed1" }} />
                    <Text strong style={{ color: "#722ed1" }}>
                      AI助教 ({currentGroup.aiCharacters.length})
                    </Text>
                  </Space>
                  <List
                    size="small"
                    dataSource={currentGroup.aiCharacters}
                    renderItem={(ai) => (
                      <List.Item style={{ padding: "4px 0" }}>
                        <List.Item.Meta
                          avatar={
                            <Avatar
                              size={32}
                              style={{
                                backgroundColor: "#722ed1",
                                border: "2px solid #fff",
                              }}
                            >
                              {ai.avatar}
                            </Avatar>
                          }
                          title={ai.name}
                          description={<Tag color="purple">AI</Tag>}
                        />
                      </List.Item>
                    )}
                  />
                </div>
              )}
            </>
          )}
        </Card>
      </Col>
    </Row>
  );

  const renderTab3 = () => (
    <Row gutter={[16, 16]}>
      <Col span={24}>
        <Card>
          <Title level={5} style={{ marginBottom: 16 }}>
            签到状态概览
          </Title>
          <Row gutter={[16, 16]}>
            {chatGroups
              .filter((group) => group.checkInEnabled)
              .map((group) => (
                <Col xs={24} md={12} lg={8} key={group.id}>
                  <Card
                    style={{
                      border: group.checkInEnabled
                        ? "2px solid #52c41a"
                        : "1px solid #f0f0f0",
                      backgroundColor: group.checkInEnabled
                        ? "#f6ffed"
                        : "inherit",
                    }}
                    styles={{ body: { padding: 16 } }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: 16,
                      }}
                    >
                      <div>
                        <Title level={5} style={{ margin: 0 }}>
                          {group.courseName}
                        </Title>
                        <Text type="secondary">{group.instructorName}</Text>
                      </div>
                      <Tag color="blue">签到中</Tag>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      <Text strong>签到时间</Text>
                      <div>
                        <Text>
                          {new Date(group.checkInStartTime!).toLocaleString()} -
                          {new Date(group.checkInEndTime!).toLocaleString()}
                        </Text>
                      </div>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      <Text strong>签到进度</Text>
                      <Progress
                        percent={Math.min(
                          100,
                          Math.round(
                            ((Date.now() -
                              new Date(group.checkInStartTime!).getTime()) /
                              (60 * 60 * 1000) /
                              (Date.now() -
                                new Date(group.checkInStartTime!).getTime())) *
                              100,
                          ),
                        )}
                      />
                    </div>

                    <Text>
                      签到统计: {group.checkInStats.checkedIn}/
                      {group.checkInStats.total}({group.checkInStats.rate}%)
                    </Text>
                  </Card>
                </Col>
              ))}
          </Row>
        </Card>
      </Col>

      <Col xs={24} md={12}>
        <Card>
          <Title level={5} style={{ marginBottom: 16 }}>
            实时签到状态
          </Title>
          <Alert
            type="info"
            style={{ marginBottom: 16 }}
            message={
              <Space>
                <CalendarOutlined />
                系统正在监控签到状态，任何签到状态变化都会实时更新
              </Space>
            }
          />

          {chatGroups
            .filter((group) => group.checkInEnabled)
            .map((group) => (
              <div key={group.id} style={{ marginBottom: 16 }}>
                <Text strong style={{ marginBottom: 8, display: "block" }}>
                  {group.courseName} - 实时状态
                </Text>

                <Row gutter={16}>
                  <Col span={12}>
                    <Card
                      styles={{
                        body: {
                          padding: 16,
                          textAlign: "center",
                          backgroundColor: "#f5f5f5",
                        },
                      }}
                    >
                      <Title
                        level={3}
                        style={{ color: "#1890ff", marginBottom: 8 }}
                      >
                        {group.checkInStats.checkedIn}/
                        {group.checkInStats.total}
                      </Title>
                      <Text>已签到</Text>
                      <br />
                      <Text type="secondary">
                        签到率: {group.checkInStats.rate}%
                      </Text>
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card
                      styles={{
                        body: {
                          padding: 16,
                          textAlign: "center",
                          backgroundColor: "#f5f5f5",
                        },
                      }}
                    >
                      <Title
                        level={3}
                        type="secondary"
                        style={{ marginBottom: 8 }}
                      >
                        {group.checkInStats.total -
                          group.checkInStats.checkedIn}
                      </Title>
                      <Text>未签到</Text>
                    </Card>
                  </Col>
                </Row>
              </div>
            ))}
        </Card>
      </Col>

      <Col xs={24} md={12}>
        <Card>
          <Title level={5} style={{ marginBottom: 16 }}>
            签到历史记录
          </Title>
          <List
            dataSource={[
              {
                user: "李小明",
                action: "签到",
                time: "10:30:15",
                course: "高等数学微积分",
              },
              {
                user: "王芳",
                action: "离线",
                time: "10:45:20",
                course: "数据结构",
              },
              {
                user: "赵强",
                action: "完成签到",
                time: "11:20:30",
                course: "大学物理实验",
              },
            ]}
            renderItem={(record) => (
              <List.Item style={{ padding: "8px 0" }}>
                <List.Item.Meta
                  title={`${record.user} - ${record.action}`}
                  description={`${record.time} • ${record.course}`}
                />
                {record.action === "签到" || record.action === "完成签到" ? (
                  <CheckCircleOutlined
                    style={{ fontSize: 16, color: "#52c41a" }}
                  />
                ) : (
                  <CheckCircleOutlined
                    style={{ fontSize: 16, color: "#999" }}
                  />
                )}
              </List.Item>
            )}
          />
        </Card>
      </Col>

      <Col span={24}>
        <div
          style={{ display: "flex", justifyContent: "center", marginTop: 16 }}
        >
          <Button
            type="primary"
            icon={<SettingOutlined />}
            style={canEdit ? { minWidth: 150 } : { display: "none" }}
          >
            签到设置
          </Button>
        </div>
      </Col>
    </Row>
  );

  const tabItems: TabsProps["items"] = [
    {
      key: "0",
      label: "讨论组管理",
      children: renderTab1(),
    },
    {
      key: "1",
      label: "聊天界面",
      children: renderTab2(),
    },
    {
      key: "2",
      label: "签到监控",
      children: renderTab3(),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <div>
          <Title
            level={4}
            style={{ margin: 0, marginBottom: 4, fontWeight: 600 }}
          >
            AI课程讨论
          </Title>
          <Text type="secondary">智能聊天组与签到管理，打造互动式课堂体验</Text>
        </div>
        <Button icon={<PlusOutlined />} style={canEdit ? undefined : { display: "none" }}>创建讨论组</Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card styles={{ body: { padding: 16 } }}>
            <Space>
              <Avatar style={{ backgroundColor: "#1890ff" }}>
                <CommentOutlined />
              </Avatar>
              <div>
                <Title level={5} style={{ margin: 0, fontWeight: 600 }}>
                  {chatGroups.length}
                </Title>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  讨论组总数
                </Text>
              </div>
            </Space>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card styles={{ body: { padding: 16 } }}>
            <Space>
              <Avatar style={{ backgroundColor: "#52c41a" }}>
                <TeamOutlined />
              </Avatar>
              <div>
                <Title level={5} style={{ margin: 0, fontWeight: 600 }}>
                  {chatGroups.reduce(
                    (acc, group) => acc + group.participants.length,
                    0,
                  )}
                </Title>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  总参与人数
                </Text>
              </div>
            </Space>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card styles={{ body: { padding: 16 } }}>
            <Space>
              <Avatar style={{ backgroundColor: "#faad14" }}>
                <RobotOutlined />
              </Avatar>
              <div>
                <Title level={5} style={{ margin: 0, fontWeight: 600 }}>
                  {chatGroups.reduce(
                    (acc, group) => acc + group.aiCharacters.length,
                    0,
                  )}
                </Title>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  AI助教数量
                </Text>
              </div>
            </Space>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card styles={{ body: { padding: 16 } }}>
            <Space>
              <Avatar style={{ backgroundColor: "#1890ff" }}>
                <CheckCircleOutlined />
              </Avatar>
              <div>
                <Title level={5} style={{ margin: 0, fontWeight: 600 }}>
                  {Math.round(
                    (chatGroups.filter((g) => g.checkInEnabled).length /
                      chatGroups.length) *
                      100,
                  )}
                  %
                </Title>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  启用签到率
                </Text>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>

      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />

      {canEdit && (
      <Button
        type="primary"
        shape="circle"
        size="large"
        icon={<PlusOutlined />}
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          width: 56,
          height: 56,
        }}
      />
      )}
    </div>
  );
}
