import { useMemo, useState } from "react";
import { Empty, Input, Select, Space, Spin, Table, Typography } from "antd";
import { SearchOutlined } from "@ant-design/icons";

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

export interface StudentTableSelectProps {
  students: StudentOption[];
  classes: ClassOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  loading?: boolean;
  emptyText?: string;
}

/**
 * 内嵌的学生多选表格：支持按班级过滤 + 姓名/邮箱搜索，勾选选择。
 */
export function StudentTableSelect({
  students,
  classes,
  value,
  onChange,
  loading,
  emptyText = "暂无可分配的学生",
}: StudentTableSelectProps) {
  const [keyword, setKeyword] = useState("");
  const [classId, setClassId] = useState<string | undefined>(undefined);

  const classNameById = useMemo(() => {
    const map = new Map<string, string>();
    classes.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [classes]);

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

  const columns = [
    {
      title: "姓名",
      dataIndex: "name",
      key: "name",
      width: 200,
      render: (v: string | null | undefined, r: StudentOption) => v || r.email || r.id.slice(0, 8),
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
    <div>
      <Space style={{ width: "100%", marginBottom: 12 }} wrap>
        <Input
          allowClear
          prefix={<SearchOutlined style={{ color: "#9aa7ba" }} />}
          placeholder="搜索学生姓名 / 邮箱"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          style={{ width: 260 }}
        />
        <Select
          allowClear
          placeholder="按班级过滤"
          style={{ width: 200 }}
          value={classId}
          onChange={setClassId}
          options={classOptions}
        />
        <Text type="secondary">
          已选 {value.length} 人 · 可选 {filtered.length} 人
        </Text>
      </Space>
      {loading ? (
        <div style={{ textAlign: "center", padding: 40 }}>
          <Spin />
        </div>
      ) : students.length === 0 ? (
        <Empty description={emptyText} image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <Table
          size="middle"
          rowKey="id"
          dataSource={filtered}
          columns={columns}
          rowSelection={{
            selectedRowKeys: value,
            preserveSelectedRowKeys: true,
            onChange: (keys) => onChange(keys as string[]),
          }}
          onRow={(r) => ({
            onClick: (e) => {
              const target = e.target as HTMLElement;
              if (target.closest(".ant-table-selection-column")) return;
              onChange(value.includes(r.id) ? value.filter((id) => id !== r.id) : [...value, r.id]);
            },
            style: { cursor: "pointer" },
          })}
          pagination={filtered.length > 8 ? { pageSize: 8, showSizeChanger: false } : false}
          locale={{ emptyText: <Empty description="没有匹配的学生" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
        />
      )}
    </div>
  );
}

export default StudentTableSelect;
