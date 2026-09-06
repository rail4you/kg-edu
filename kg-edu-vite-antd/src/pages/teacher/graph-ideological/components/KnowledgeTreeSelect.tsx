import { useState, useMemo, useEffect } from "react";
import { Tree, Input, Empty } from "antd";
import { SearchOutlined, BookOutlined } from "@ant-design/icons";

interface IdeologicalKnowledgeItem {
  id: string;
  name: string;
  knowledgeType: string;
  subject?: string | null;
  unit?: string | null;
  tag?: string | null;
  childUnits?: IdeologicalKnowledgeItem[];
  childCells?: IdeologicalKnowledgeItem[];
  directCells?: IdeologicalKnowledgeItem[];
  subjectCells?: IdeologicalKnowledgeItem[];
  nestedChildCells?: IdeologicalKnowledgeItem[];
}

interface KnowledgeTreeItem {
  id: string;
  key: string | number;
  label: string;
  title?: React.ReactNode;
  children?: KnowledgeTreeItem[];
  knowledgeData: IdeologicalKnowledgeItem;
  icon?: React.ReactNode;
}

interface KnowledgeTreeSelectProps {
  value?: string;
  onChange?: (value: string) => void;
  treeData: KnowledgeTreeItem[];
  placeholder?: string;
  excludeIds?: string[];
}

export function KnowledgeTreeSelect({
  value,
  onChange,
  treeData,
  placeholder = "选择知识点",
  excludeIds = [],
}: KnowledgeTreeSelectProps) {
  const [searchValue, setSearchValue] = useState("");
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [autoExpanded, setAutoExpanded] = useState(true);

  useEffect(() => {
    setExpandedKeys([]);
    setAutoExpanded(true);
  }, [treeData]);

  const allKeys = useMemo(() => {
    const getKeys = (nodes: KnowledgeTreeItem[]): React.Key[] => {
      const keys: React.Key[] = [];
      nodes.forEach((node) => {
        keys.push(node.key);
        if (node.children) {
          keys.push(...getKeys(node.children));
        }
      });
      return keys;
    };
    return getKeys(treeData);
  }, [treeData]);

  const filterTree = (
    nodes: KnowledgeTreeItem[],
    search: string,
  ): KnowledgeTreeItem[] => {
    if (!search) return nodes;
    const searchLower = search.toLowerCase();
    return nodes
      .map((node) => {
        const label = node.label || node.title?.toString() || "";
        const match = label.toLowerCase().includes(searchLower);
        const filteredChildren = node.children
          ? filterTree(node.children, search)
          : undefined;
        if (match || (filteredChildren && filteredChildren.length > 0)) {
          return {
            ...node,
            children: filteredChildren,
          } as KnowledgeTreeItem;
        }
        return null;
      })
      .filter((node): node is KnowledgeTreeItem => node !== null);
  };

  const filteredItems = useMemo(() => {
    let items = treeData;
    if (excludeIds.length > 0) {
      const excludeSet = new Set(excludeIds);
      const filterExclude = (nodes: KnowledgeTreeItem[]): KnowledgeTreeItem[] => {
        return nodes
          .filter((node) => !excludeSet.has(node.id))
          .map((node) => ({
            ...node,
            children: node.children ? filterExclude(node.children) : undefined,
          }));
      };
      items = filterExclude(treeData);
    }
    return filterTree(items, searchValue);
  }, [treeData, searchValue, excludeIds]);

  const effectiveExpandedKeys = useMemo(() => {
    if (searchValue) {
      return allKeys;
    }
    if (expandedKeys.length > 0) {
      return expandedKeys;
    }
    if (autoExpanded && treeData.length > 0) {
      return allKeys;
    }
    return [];
  }, [searchValue, expandedKeys, autoExpanded, treeData, allKeys]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchValue(value);
    if (value) {
      setAutoExpanded(true);
    }
  };

  const handleExpand = (keys: React.Key[]) => {
    setExpandedKeys(keys);
    setAutoExpanded(false);
  };

  const handleSelect = (selectedKeys: React.Key[]) => {
    if (!selectedKeys.length) return;
    const itemId = selectedKeys[0] as string;
    if (onChange) {
      onChange(itemId);
    }
  };

  const enhanceTreeData = (
    items: KnowledgeTreeItem[],
    search: string,
  ): KnowledgeTreeItem[] => {
    return items.map((item) => {
      const label = item.label || item.title?.toString() || "";
      let titleNode: React.ReactNode = (
        <span style={{ fontSize: 14, lineHeight: 1.8 }}>{label}</span>
      );
      if (search) {
        const index = label.toLowerCase().indexOf(search.toLowerCase());
        if (index > -1) {
          const beforeStr = label.substring(0, index);
          const matchStr = label.substring(index, index + search.length);
          const afterStr = label.substring(index + search.length);
          titleNode = (
            <span style={{ fontSize: 14, lineHeight: 1.8 }}>
              {beforeStr}
              <span
                style={{
                  background: "#ffe58f",
                  color: "#1F1F1F",
                  padding: "0 2px",
                  borderRadius: 2,
                }}
              >
                {matchStr}
              </span>
              {afterStr}
            </span>
          );
        }
      }
      return {
        ...item,
        title: titleNode,
        icon: <BookOutlined style={{ color: "#0056D2", fontSize: 16 }} />,
        children: item.children
          ? enhanceTreeData(item.children, search)
          : undefined,
      } as KnowledgeTreeItem;
    });
  };

  const treeDataWithTitle = useMemo(
    () => enhanceTreeData(filteredItems, searchValue),
    [filteredItems, searchValue],
  );

  const selectedKeys = value ? [value] : [];

  const selectedNode = useMemo(() => {
    const findNode = (
      nodes: KnowledgeTreeItem[],
      id: string,
    ): KnowledgeTreeItem | null => {
      for (const node of nodes) {
        if (node.id === id) return node;
        if (node.children) {
          const found = findNode(node.children, id);
          if (found) return found;
        }
      }
      return null;
    };
    return findNode(treeData, value || "");
  }, [treeData, value]);

  return (
    <div>
      <Input
        placeholder="搜索知识点"
        prefix={<SearchOutlined />}
        value={searchValue}
        onChange={handleSearchChange}
        style={{ marginBottom: 8 }}
        allowClear
      />
      <div
        style={{
          border: "1px solid #d9d9d9",
          borderRadius: 4,
          maxHeight: 300,
          overflow: "auto",
          padding: 8,
        }}
      >
        {treeDataWithTitle.length > 0 ? (
          <Tree
            showIcon
            expandedKeys={effectiveExpandedKeys}
            onExpand={handleExpand}
            selectedKeys={selectedKeys}
            onSelect={handleSelect}
            treeData={treeDataWithTitle}
          />
        ) : (
          <Empty description="暂无知识点" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </div>
      {selectedNode && (
        <div style={{ marginTop: 8, color: "#666" }}>
          已选择: <strong>{selectedNode.label}</strong>
        </div>
      )}
    </div>
  );
}

export function buildIdeologicalKnowledgeTree(
  hierarchyData: any[],
): KnowledgeTreeItem[] {
  if (!hierarchyData || hierarchyData.length === 0) return [];

  const isIdeological = (node: any): boolean => {
    return node.tag && node.tag.includes("课程思政");
  };

  const globalSeenIds = new Set<string>();

  const convertToTree = (node: any): KnowledgeTreeItem | null => {
    if (!node.id || globalSeenIds.has(node.id)) {
      return null;
    }

    if (!isIdeological(node)) {
      return null;
    }

    globalSeenIds.add(node.id);

    const childArrays = [
      node.childUnits,
      node.directCells,
      node.subjectCells,
      node.childCells,
      node.nestedChildCells,
    ];

    const children: KnowledgeTreeItem[] = [];
    childArrays.forEach((arr) => {
      if (Array.isArray(arr)) {
        arr.forEach((child: any) => {
          const childNode = convertToTree(child);
          if (childNode) {
            children.push(childNode);
          }
        });
      }
    });

    return {
      id: node.id,
      key: node.id,
      label: node.name,
      title: node.name,
      children: children.length > 0 ? children : undefined,
      knowledgeData: node,
      icon: <BookOutlined style={{ color: "#0056D2", fontSize: 16 }} />,
    };
  };

  const treeItems = hierarchyData
    .map((node: any) => convertToTree(node))
    .filter((item): item is KnowledgeTreeItem => item !== null);
  return treeItems;
}

export function buildKnowledgeTreeFromList(
  knowledgeList: any[],
): KnowledgeTreeItem[] {
  if (!knowledgeList || knowledgeList.length === 0) return [];

  return knowledgeList.map((item: any) => ({
    id: item.id,
    key: item.id,
    label: item.name,
    title: item.name,
    knowledgeData: item,
    icon: <BookOutlined style={{ color: "#0056D2", fontSize: 16 }} />,
  }));
}
