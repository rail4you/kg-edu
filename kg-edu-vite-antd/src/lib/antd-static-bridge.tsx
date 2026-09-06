import { App } from "antd";
import type { MessageInstance } from "antd/es/message/interface";
import type { HookAPI as ModalInstance } from "antd/es/modal/useModal";
import * as antd from "antd";

/**
 * React 19 + antd v5 兼容桥接。
 *
 * 背景：应用使用 React 19，而 antd v5 的静态方法（`message.success`、`Modal.confirm` 等）
 * 内部持有的渲染根无法正常渲染，导致全站 toast / 确认弹窗不显示、点击无响应。
 *
 * 解决：在 `<AntdApp>` 内挂载本组件，把 antd 导出的静态 `message` / `Modal` 方法
 * 重定向到 `App.useApp()` 的上下文实例，从而让全站 `message.*`、`Modal.confirm` 等
 * 在不改各页面 import 的前提下恢复正常。
 */
export function AntdStaticBridge() {
  const { message, modal } = App.useApp();

  if (!AntdStaticBridge.installed) {
    AntdStaticBridge.installed = true;
    installStaticMessage(message);
    installStaticModal(modal);
  }

  return null;
}

AntdStaticBridge.installed = false;

function installStaticMessage(message: MessageInstance) {
  const staticMessage = antd.message as unknown as MessageInstance;

  staticMessage.open = (config) => message.open(config);
  staticMessage.success = (content, duration, onClose) =>
    message.success(content, duration, onClose);
  staticMessage.error = (content, duration, onClose) =>
    message.error(content, duration, onClose);
  staticMessage.warning = (content, duration, onClose) =>
    message.warning(content, duration, onClose);
  staticMessage.info = (content, duration, onClose) =>
    message.info(content, duration, onClose);
  staticMessage.loading = (content, duration, onClose) =>
    message.loading(content, duration, onClose);
}

function installStaticModal(modal: ModalInstance) {
  const staticModal = antd.Modal as unknown as ModalInstance;

  staticModal.confirm = (config: any) => modal.confirm(config);
  staticModal.info = (config: any) => modal.info(config);
  staticModal.success = (config: any) => modal.success(config);
  staticModal.error = (config: any) => modal.error(config);
  staticModal.warning = (config: any) => modal.warning(config);
}
