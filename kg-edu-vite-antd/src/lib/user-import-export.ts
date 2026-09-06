import * as XLSX from "xlsx";
import { getFileTemplateBySection, importExcel } from "./ash_rpc";

export type UserRole = "admin" | "user" | "teacher";

export interface UserImportData {
  memberId: string;
  name: string;
  password: string;
  employeeId?: string;
  phone?: string;
  email?: string;
  role: UserRole;
  school?: string;
  colledge?: string;
  major?: string;
  className?: string;
}

export interface UserImportResult {
  success: boolean;
  message: string;
  importedCount?: number;
  createdCount?: number;
  updatedCount?: number;
  errors?: string[];
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function downloadUserTemplate(): Promise<void> {
  try {
    const result = await getFileTemplateBySection({
      input: { section: "user" },
      fields: ["id", "filePath", "section"],
    });

    if (result.success && (result.data as any)?.filePath) {
      const link = document.createElement("a");
      link.href = (result.data as any).filePath;
      link.download = "user_import_template.xlsx";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      throw new Error("无法获取用户模板文件");
    }
  } catch (error) {
    console.error("下载用户模板失败:", error);
    throw error;
  }
}

export async function parseUserFile(file: File, role: UserRole): Promise<UserImportData[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        const users: UserImportData[] = [];
        let autoId = 1;

        // 自动检测 Excel 格式
        // 格式1 (旧): 工号(A), 姓名(B), 电话(C), 邮箱(D), 密码(E), 角色(F), 学校(G), 学院(H), 专业(I), 班级(J)
        // 格式2 (新): 姓名(A), 电话(B), 电子邮箱(C), 密码(D), 学院(E), 专业(F), 班级(G)
        const firstRow = (jsonData[0] as string[]) || [];
        const secondRow = (jsonData[1] as string[]) || [];

        // 判断是否为新格式：第一行含"姓名"或"电话"等中文表头
        const isNewFormat = secondRow.some(
          (v) => typeof v === "string" && (v.includes("姓名") || v.includes("电话"))
        ) || firstRow.some(
          (v) => typeof v === "string" && v.includes("使用说明")
        );

        if (isNewFormat) {
          // 新格式: 工号(A), 姓名(B), 电话(C), 电子邮箱(D), 密码(E), 学院(F), 专业(G), 班级(H)
          // 跳过说明行和表头行
          for (let i = 2; i < jsonData.length; i++) {
            const row = jsonData[i] as string[];
            // 姓名必填(B列), 密码必填(E列)
            if (!row[1] && !row[4]) continue;
            if (!row[1]) continue;

            const employeeId = row[0] ? String(row[0]).trim() : undefined;
            const name = String(row[1]).trim();
            const phone = row[2] ? String(row[2]).trim() : undefined;
            const email = row[3] ? String(row[3]).trim() : undefined;
            const password = row[4] ? String(row[4]).trim() : undefined;

            if (!name) continue;
            if (!password) continue;

            // member_id: 优先用手机号，其次用邮箱，最后自动生成
            const memberId = phone || email || `user_${Date.now()}_${autoId++}`;

            const user: UserImportData = {
              memberId,
              name,
              password,
              employeeId,
              phone,
              email,
              role,
              colledge: row[5] ? String(row[5]).trim() : undefined,
              major: row[6] ? String(row[6]).trim() : undefined,
              className: row[7] ? String(row[7]).trim() : undefined,
            };

            users.push(user);
          }
        } else {
          // 旧格式: 工号(A), 姓名(B), 电话(C), 邮箱(D), 密码(E), 角色(F), ...
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i] as string[];
            if (row.length >= 5 && row[0] && row[1] && row[4]) {
              const user: UserImportData = {
                memberId: String(row[0]).trim(),
                name: String(row[1]).trim(),
                phone: row[2] ? String(row[2]).trim() : undefined,
                email: row[3] ? String(row[3]).trim() : undefined,
                password: String(row[4]).trim(),
                role,
                school: row[6] ? String(row[6]).trim() : undefined,
                colledge: row[7] ? String(row[7]).trim() : undefined,
                major: row[8] ? String(row[8]).trim() : undefined,
                className: row[9] ? String(row[9]).trim() : undefined,
              };

              users.push(user);
            }
          }
        }

        if (users.length === 0) {
          reject(new Error("Excel文件中没有找到有效的用户数据"));
          return;
        }

        resolve(users);
      } catch (error) {
        reject(new Error("文件解析失败: " + (error instanceof Error ? error.message : "未知错误")));
      }
    };

    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsArrayBuffer(file);
  });
}

export async function importUsersFromExcel(
  tenantId: string,
  fileBase64: string,
  role?: UserRole
): Promise<UserImportResult> {
  try {
    const result = await importExcel({
      tenant: tenantId,
      input: {
        excelFile: fileBase64,
        ...(role && { role }),
      },
    });

    if (result.success && result.data) {
      const { count, createdCount, updatedCount, message } = result.data as any;
      let resultMessage = message || "导入完成";
      const details: string[] = [];

      if (createdCount > 0) details.push(`创建 ${createdCount} 个用户`);
      if (updatedCount > 0) details.push(`更新 ${updatedCount} 个用户`);

      if (details.length > 0) resultMessage += ` (${details.join(", ")})`;

      return {
        success: true,
        message: resultMessage,
        importedCount: count || 0,
        createdCount,
        updatedCount,
      };
    } else {
      const rawErrors = (result as any).errors;
      const cleanErrors = parseImportErrors(rawErrors);
      return {
        success: false,
        message: "导入失败",
        errors: cleanErrors,
      };
    }
  } catch (error: any) {
    const rawMessage = error?.message || error?.toString() || "未知错误";
    throw new Error(rawMessage);
  }
}

function parseImportErrors(errors: any[]): string[] {
  if (!errors || !Array.isArray(errors)) {
    return ["导入失败，请检查Excel文件格式"];
  }

  const cleanErrors: string[] = [];
  
  for (const err of errors) {
    const rawMessage = err?.message || err?.toString() || "";
    
    const failedMatch = rawMessage.match(/Failed to process any users:\s*\[?"([^"]+)"\]?/);
    if (failedMatch) {
      const errorMsg = failedMatch[1];
      if (errorMsg.includes("Invalid email format")) {
        cleanErrors.push("邮箱格式错误，请检查Excel中的邮箱列");
      } else if (errorMsg.includes("Invalid phone")) {
        cleanErrors.push("电话格式错误，请检查Excel中的电话列");
      } else if (errorMsg.includes("password")) {
        cleanErrors.push("密码格式错误，密码至少需要6位");
      } else if (errorMsg.includes("duplicate") || errorMsg.includes("already exists")) {
        cleanErrors.push("用户ID已存在，请检查是否有重复的用户ID");
      } else {
        cleanErrors.push(errorMsg);
      }
    } else if (rawMessage.includes("Invalid email format")) {
      cleanErrors.push("邮箱格式错误，请检查Excel中的邮箱列");
    } else if (rawMessage && !rawMessage.includes("(ash") && !rawMessage.includes("lib/")) {
      cleanErrors.push(rawMessage);
    }
  }

  if (cleanErrors.length === 0) {
    cleanErrors.push("导入失败，请检查Excel文件格式");
  }
  
  return cleanErrors;
}
