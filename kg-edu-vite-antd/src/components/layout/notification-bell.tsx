import { BellOutlined } from '@ant-design/icons';
import { Tooltip } from 'antd';
import { useAuth } from '@/auth/auth-context';

export function NotificationBell() {
  const { user } = useAuth();
  const hasUser = !!user?.id;

  return (
    <Tooltip title={hasUser ? '通知功能已迁移' : '请登录后查看通知'}>
      <BellOutlined
        style={{
          fontSize: 16,
          color: hasUser ? '#fff' : 'rgba(255,255,255,0.5)',
          cursor: hasUser ? 'default' : 'not-allowed',
        }}
      />
    </Tooltip>
  );
}
