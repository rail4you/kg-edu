import { useMemo, useState } from "react";
import { Button, Empty, Input, Modal, Select, Space, Spin, Table, Tag, Typography } from "antd";
import { SwapOutlined, SearchOutlined, CheckOutlined } from "@ant-design/icons";

const { Text } = Typography;

export interface StudentOption {
  id: string;
  name?: string | null;
  email?: string | null;
  classId?: string | null;
}

export interface ClassOption {
  id: string;
  name: string;
}

export interface StudentSelectButtonProps {
  /** 弹窗标题 */
  title?: string;
  /** 按钮文案 */
  buttonLabel?: string;
  students: StudentOption[];
  classes: ClassOption[];
  value?: string | null;
  onChange: (id: string | undefined) => void;
  loading?: boolean;
}

/**
 * 选择学生按钮 + 带「班级过滤 + 关键字搜索」的学生表格弹窗。
 */
export function StudentSelectButton({
  title = "选择学生",
  buttonLabel = "切换学生",
  students,
  classes,
  value,
  onChange,
  loading,
}: StudentSelectButtonProps) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [classId, setClassId] = useState<string | undefined>(undefined);

  const classNameById = useMemo(() => {
    const map = new Map<string, string>();
    classes.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [classes]);

  // 仅展示当前学生就读的班级（避免无关选项）
  const classOptions = useMemo(() => {
    const present = new Set(students.map((s) => s.classId).filter(Boolean) as string[]);
    return classes.filter((c) => present.has(c.id)).map((c) => ({ value: c.id, label: c.name }));
  }, [students, classes]);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return students.filter((s) => {
      if (classId && s.classId !== classId) return false;
      if (!kw) return true;
      return (s.name || "").toLowerCase().includes(kw) || (s.email || "").toLowerCase().includes(kw);
    });
  }, [students, keyword, classId]);

  const current = students.find((s) => s.id === value);

  const select = (id?: string) => {
    onChange(id);
    setOpen(false);
  };

  const columns = [
    {
      title: "姓名",
      dataIndex: "name",
      key: "name",
      width: 200,
      render: (v: string | null | undefined, r: StudentOption) => (
        <Space size={6}>
          <span>{v || r.email || r.id.slice(0, 8)}</span>
          {r.id === value && (
            <Tag icon={<CheckOutlined />} color="blue">
              当前
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: "班级",
      dataIndex: "classId",
      key: "classId",
      width: 170,
      render: (v: string | null | undefined) =>
        v ? classNameById.get(v) || "-" : <Text type="secondary">未分班</Text>,
    },
    {
      title: "邮箱",
      dataIndex: "email",
      key: "email",
      ellipsis: true,
      render: (v: string | null | undefined) => v || <Text type="secondary">-</Text>,
    },
  ];

  return (
    <>
      <Button icon={<SwapOutlined />} onClick={() => setOpen(true)}>
        {buttonLabel}
        {current ? `：${current.name || current.email || ""}` : ""}
      </Button>
      <Modal
        className="student-select-modal"
        title={title}
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        width={820}
        styles={{ body: { padding: "18px 24px 24px" } }}
      >
        <style>{`
          .student-select-modal .ant-modal-title { font-size: 17px; }
          .student-select-modal .ant-table { font-size: 14px; }
          .student-select-modal .ant-table-thead > tr > th {
            padding: 15px 16px !important; font-size: 14px; font-weight: 600;
          }
          .student-select-modal .ant-table-tbody > tr > td {
            padding: 15px 16px !important; font-size: 14px;
          }
          .student-select-modal .ant-select-selection-item,
          .student-select-modal .ant-select-selection-placeholder { font-size: 14px; }
          .student-select-modal .ant-table-tbody > tr.is-current > td {
            background: rgba(37, 115, 230, 0.06);
          }
        `}</style>
        <Space size="middle" style={{ width: "100%", marginBottom: 16 }} wrap>
          <Input
            allowClear
            size="large"
            prefix={<SearchOutlined style={{ color: "#9aa7ba" }} />}
            placeholder="搜索学生姓名 / 邮箱"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 280 }}
          />
          <Select
            allowClear
            size="large"
            placeholder="按班级过滤"
            style={{ width: 220 }}
            value={classId}
            onChange={setClassId}
            options={classOptions}
          />
          <Text type="secondary" style={{ fontSize: 14 }}>
            共 {filtered.length} 人
          </Text>
        </Space>
        {loading ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <Spin />
          </div>
        ) : filtered.length === 0 ? (
          <Empty description="暂无学生" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <Table
            size="middle"
            rowKey="id"
            dataSource={filtered}
            columns={columns}
            pagination={filtered.length > 8 ? { pageSize: 8, showSizeChanger: false } : false}
            rowClassName={(r) => (r.id === value ? "is-current" : "")}
            onRow={(r) => ({
              onClick: () => select(r.id),
              style: { cursor: "pointer" },
            })}
          />
        )}
      </Modal>
    </>
  );
}

export default StudentSelectButton;
