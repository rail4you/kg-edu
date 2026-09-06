import { useState, useCallback } from "react";
import {
  Modal,
  Steps,
  Upload,
  Button,
  Typography,
  Space,
  Alert,
  Table,
  message,
  Select,
  Collapse,
} from "antd";
import { UploadOutlined, InfoCircleOutlined } from "@ant-design/icons";
import {
  parseUserFile,
  fileToBase64,
  importUsersFromExcel,
  UserImportData,
  UserImportResult,
  UserRole,
} from "@/lib/user-import-export";
import { getCurrentTenant } from "@/lib/tenant";

const { Text, Title, Paragraph } = Typography;

interface ImportUserModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  role?: UserRole;
  /** 指定导入的目标租户（超管场景），缺省使用当前租户上下文 */
  tenant?: string;
}

export function ImportUserModal({ open, onClose, onSuccess, role: fixedRole, tenant }: ImportUserModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<UserImportData[]>([]);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<UserImportResult | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>(fixedRole || "user");

  const handleFileSelect = useCallback(async (file: File) => {
    setSelectedFile(file);
    setIsUploading(true);
    setImportResult(null);

    try {
      const base64 = await fileToBase64(file);
      setFileBase64(base64);

      const data = await parseUserFile(file, selectedRole);
      setPreviewData(data);
      setCurrentStep(1);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "文件解析失败");
    } finally {
      setIsUploading(false);
    }

    return false;
  }, [selectedRole]);

  const handleImport = useCallback(async () => {
    if (!fileBase64 || previewData.length === 0) return;

    const currentTenant = getCurrentTenant();
    const tenantId = tenant || (currentTenant ? currentTenant.schemaName || currentTenant.id : null);
    if (!tenantId) {
      setImportResult({
        success: false,
        message: "导入失败：未选择租户",
        errors: ["请先选择一个组织/租户"],
      });
      return;
    }

    setIsImporting(true);
    try {
      const result = await importUsersFromExcel(tenantId, fileBase64, selectedRole);
      setImportResult(result);

      if (result.success) {
        message.success(result.message);
        setTimeout(() => {
          onSuccess();
          handleClose();
        }, 1500);
      }
    } catch (error: any) {
      const rawMessage = error?.message || error?.toString() || "未知错误";
      const cleanErrors = parseImportErrors(rawMessage);
      setImportResult({
        success: false,
        message: "导入失败",
        errors: cleanErrors,
      });
    } finally {
      setIsImporting(false);
    }
  }, [fileBase64, previewData, onSuccess, selectedRole]);

  const parseImportErrors = (rawMessage: string): string[] => {
    const errors: string[] = [];
    
    const failedMatch = rawMessage.match(/Failed to process any users:\s*\[?"([^"]+)"\]?/);
    if (failedMatch) {
      const errorMsg = failedMatch[1];
      if (errorMsg.includes("Invalid email format")) {
        errors.push("邮箱格式错误，请检查Excel中的邮箱列");
      } else if (errorMsg.includes("Invalid phone")) {
        errors.push("电话格式错误，请检查Excel中的电话列");
      } else if (errorMsg.includes("password")) {
        errors.push("密码格式错误，密码至少需要6位");
      } else if (errorMsg.includes("duplicate") || errorMsg.includes("already exists")) {
        errors.push("用户ID已存在，请检查是否有重复的用户ID");
      } else {
        errors.push(errorMsg);
      }
    } else if (rawMessage.includes("Invalid email format")) {
      errors.push("邮箱格式错误，请检查Excel中的邮箱列");
    } else if (rawMessage.includes("Invalid")) {
      const invalidMatch = rawMessage.match(/Invalid\s+(\w+)/);
      if (invalidMatch) {
        errors.push(`${invalidMatch[1]}格式错误`);
      } else {
        errors.push("数据格式错误，请检查Excel文件");
      }
    } else {
      errors.push("导入失败，请检查Excel文件格式");
    }
    
    return errors;
  };

  const handleClose = useCallback(() => {
    setCurrentStep(0);
    setSelectedFile(null);
    setPreviewData([]);
    setFileBase64(null);
    setImportResult(null);
    setIsUploading(false);
    setIsImporting(false);
    setSelectedRole(fixedRole || "user");
    onClose();
  }, [onClose]);

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      setPreviewData([]);
      setSelectedFile(null);
      setFileBase64(null);
      setImportResult(null);
    }
  }, [currentStep]);

  const columns = [
    { title: "工号", dataIndex: "memberId", key: "memberId", width: 80 },
    { title: "姓名", dataIndex: "name", key: "name", width: 80 },
    { title: "电话", dataIndex: "phone", key: "phone", width: 100, render: (v: string) => v || "-" },
    { title: "邮箱", dataIndex: "email", key: "email", width: 140, render: (v: string) => v || "-" },
    { title: "密码", dataIndex: "password", key: "password", width: 70, render: (v: string) => (v && v.length >= 6 ? "✓" : v ? `✗ (${v.length}位)` : "✗") },
    { title: "角色", dataIndex: "role", key: "role", width: 60, render: (v: string) => (v === "admin" ? "管理员" : v === "teacher" ? "教师" : "学生") },
    { title: "学校", dataIndex: "school", key: "school", width: 80, render: (v: string) => v || "-" },
    { title: "学院", dataIndex: "colledge", key: "colledge", width: 80, render: (v: string) => v || "-" },
    { title: "专业", dataIndex: "major", key: "major", width: 80, render: (v: string) => v || "-" },
    { title: "班级", dataIndex: "className", key: "className", width: 80, render: (v: string) => v || "-" },
  ];

  return (
    <Modal
      title="导入用户"
      open={open}
      onCancel={handleClose}
      width={800}
      footer={
        <Space>
          <Button onClick={handleClose} disabled={isImporting}>
            {currentStep === 0 || importResult?.success ? "关闭" : "取消"}
          </Button>
          {currentStep === 1 && !importResult && (
            <Button onClick={handleBack} disabled={isImporting}>
              上一步
            </Button>
          )}
          {currentStep === 1 && !importResult && (
            <Button type="primary" onClick={handleImport} loading={isImporting} disabled={previewData.length === 0}>
              开始导入
            </Button>
          )}
        </Space>
      }
    >
      <Steps current={currentStep} items={[{ title: "上传文件" }, { title: "预览并导入" }]} style={{ marginBottom: 24 }} />

      {currentStep === 0 && (
        <div style={{ textAlign: "center" }}>
          {!fixedRole && (
          <div style={{ marginBottom: 24 }}>
            <Space direction="vertical" size="middle" style={{ width: "100%" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
                <Text strong>导入角色：</Text>
                <Select
                  value={selectedRole}
                  onChange={(value) => setSelectedRole(value)}
                  style={{ width: 160 }}
                  options={[
                    { label: "学生", value: "user" },
                    { label: "教师", value: "teacher" },
                    { label: "管理员", value: "admin" },
                  ]}
                />
              </div>
            </Space>
          </div>
          )}

          <Paragraph>请选择用户导入Excel文件 (.xlsx 或 .xls)</Paragraph>

          <Collapse
            ghost
            style={{ marginBottom: 24, textAlign: "left" }}
            items={[
              {
                key: "format",
                label: (
                  <Space>
                    <InfoCircleOutlined style={{ color: "#1677ff" }} />
                    <Text style={{ color: "#1677ff" }}>Excel文件格式要求</Text>
                  </Space>
                ),
                children: (
                  <>
                    <Table
                      size="small"
                      pagination={false}
                      dataSource={[{ key: 1, a: "张三", b: "13800138000", c: "zhang@example.com", d: "123456", e: "计算机学院", f: "软件工程", g: "软工1班" }]}
                      columns={[
                        { title: "A列 (姓名)", dataIndex: "a", width: 80 },
                        { title: "B列 (电话)", dataIndex: "b", width: 100 },
                        { title: "C列 (邮箱)", dataIndex: "c", width: 120 },
                        { title: "D列 (密码)", dataIndex: "d", width: 70 },
                        { title: "E列 (学院)", dataIndex: "e", width: 80 },
                        { title: "F列 (专业)", dataIndex: "f", width: 80 },
                        { title: "G列 (班级)", dataIndex: "g", width: 80 },
                      ]}
                      scroll={{ x: 700 }}
                    />
                    <Paragraph type="secondary" style={{ marginTop: 12, fontSize: 12 }}>
                      <strong>A列 (姓名)</strong>：必填<br />
                      <strong>B列 (电话)</strong>：选填，将用作登录账号（无手机号则自动生成）<br />
                      <strong>C列 (邮箱)</strong>：选填<br />
                      <strong>D列 (密码)</strong>：必填，至少6位<br />
                      <strong>E列 (学院)</strong>：选填<br />
                      <strong>F列 (专业)</strong>：选填<br />
                      <strong>G列 (班级)</strong>：选填，仅学生角色有效
                    </Paragraph>
                  </>
                ),
              },
            ]}
          />

          <Upload
            accept=".xlsx,.xls"
            showUploadList={false}
            beforeUpload={handleFileSelect}
          >
            <Button icon={<UploadOutlined />} size="large" loading={isUploading}>
              {isUploading ? "解析中..." : "选择文件"}
            </Button>
          </Upload>

          {selectedFile && (
            <Paragraph type="secondary" style={{ marginTop: 12 }}>
              已选择文件: {selectedFile.name}
            </Paragraph>
          )}
        </div>
      )}

      {currentStep === 1 && (
        <div>
          <Title level={5}>预览导入数据 ({previewData.length} 个用户)</Title>

          <Table
            size="small"
            columns={columns}
            dataSource={previewData.map((u, i) => ({ ...u, key: i }))}
            pagination={{ pageSize: 5 }}
            scroll={{ x: 900 }}
            style={{ marginTop: 16 }}
          />

          {importResult && (
            <Alert
              type={importResult.success ? "success" : "error"}
              message={importResult.message}
              showIcon
              style={{ marginTop: 16 }}
              description={
                importResult.errors &&
                importResult.errors.length > 0 && (
                  <div>
                    {importResult.errors.map((item, idx) => (
                      <div key={idx}>• {item}</div>
                    ))}
                    {!importResult.success && (
                      <div style={{ marginTop: 12, fontSize: 12, color: "#666" }}>
                        <div>请检查以下内容：</div>
                        <ul style={{ margin: "4px 0", paddingLeft: 20 }}>
                          <li>邮箱格式是否正确（如：user@example.com）</li>
                          <li>如果邮箱为空，请确保单元格完全为空</li>
                          <li>用户ID是否已存在</li>
                          <li>密码是否至少6位</li>
                        </ul>
                      </div>
                    )}
                  </div>
                )
              }
            />
          )}

          {!importResult && (
            <Alert
              type="info"
              message="确认以上信息无误后，点击开始导入按钮进行导入"
              style={{ marginTop: 16 }}
            />
          )}
        </div>
      )}
    </Modal>
  );
}
