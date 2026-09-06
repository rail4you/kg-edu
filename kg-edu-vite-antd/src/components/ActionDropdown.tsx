import { Button, Dropdown, MenuProps } from "antd";
import { MoreOutlined } from "@ant-design/icons";

interface ActionDropdownProps {
  items: MenuProps["items"];
  disabled?: boolean;
}

export default function ActionDropdown({ items, disabled }: ActionDropdownProps) {
  return (
    <Dropdown
      menu={{ items }}
      trigger={["click"]}
      disabled={disabled}
    >
      <Button type="text" size="small" icon={<MoreOutlined />} />
    </Dropdown>
  );
}
