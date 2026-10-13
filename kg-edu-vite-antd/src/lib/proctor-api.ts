import { getAuthHeaders } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";

export interface ProctorExam {
  id: string;
  title: string;
  exam_type: string;
  started_at: string;
  duration_minutes: number;
  status: "ongoing" | "finished";
  student_count: number;
  room: string;
}

export interface ProctorStudent {
  student_id: string;
  student_name: string;
  student_email: string | null;
  seat: string;
  active: boolean;
  last_frame_url: string | null;
  last_frame_at: string | null;
  snapshot_count: number;
}

export interface ProctorSnapshot {
  id: string;
  exam_id: string;
  student_id: string;
  student_name: string | null;
  image_url: string | null;
  source: "manual" | "auto";
  captured_at: string;
}

function proctorHeaders(user?: any): Record<string, string> {
  const tenant = getCurrentTenant()?.schemaName || "";
  return { ...getAuthHeaders(user), "x-org-schema": tenant };
}

async function getJson(url: string, user?: any) {
  const r = await fetch(url, { headers: proctorHeaders(user) }).then((x) => x.json());
  if (!r.success) throw new Error(r.error || "请求失败");
  return r.data;
}

async function postJson(url: string, body: unknown, user?: any) {
  const r = await fetch(url, {
    method: "POST",
    headers: proctorHeaders(user),
    body: JSON.stringify(body),
  }).then((x) => x.json());
  if (!r.success) throw new Error(r.error || "请求失败");
  return r.data;
}

export const listProctorExams = (user?: any): Promise<ProctorExam[]> =>
  getJson("/api/proctor/exams", user);

export const listProctorStudents = (examId: string, user?: any): Promise<ProctorStudent[]> =>
  getJson(`/api/proctor/exams/${examId}/students`, user);

export const listProctorSnapshots = (examId: string, user?: any): Promise<ProctorSnapshot[]> =>
  getJson(`/api/proctor/exams/${examId}/snapshots`, user);

export const startProctorSession = (
  input: { examId: string; studentId: string; studentName?: string },
  user?: any
) => postJson("/api/proctor/session/start", input, user);

export const reportProctorFrame = (
  input: { examId: string; studentId: string; studentName?: string; image: string },
  user?: any
) => postJson("/api/proctor/session/frame", input, user);

export const stopProctorSession = (
  input: { examId: string; studentId: string },
  user?: any
) => postJson("/api/proctor/session/stop", input, user);

export const captureProctorSnapshot = (
  input: {
    examId: string;
    studentId: string;
    studentName?: string;
    image?: string;
    source?: "manual" | "auto";
  },
  user?: any
): Promise<ProctorSnapshot> => postJson("/api/proctor/snapshots", input, user);
