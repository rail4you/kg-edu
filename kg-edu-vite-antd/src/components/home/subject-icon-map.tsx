import type { ReactNode } from "react";
import {
  BookOutlined,
  CameraOutlined,
  CompassOutlined,
  ExperimentOutlined,
  FireOutlined,
  HeartOutlined,
  MedicineBoxOutlined,
  PhoneOutlined,
  ReadOutlined,
  TeamOutlined,
} from "@ant-design/icons";

/**
 * 首页移动端学科圆形图标映射。
 *
 * - 优先复用 36 条 STANDARD_SUBJECT_TEMPLATES 中已存在的 code（如 medicine / medical-vocational）；
 * - 缺失 code 的位置用 fallback 占位（如"基础医学"、"公共卫生"、"医学影像"等），通过 isFallback 标记。
 *
 * ⚠️ 修改顺序会直接影响移动端"5 × 2 网格"的展示顺序。
 */
export interface SubjectTile {
  /** 学科 code（与 SubjectStat.code 对齐或为 fallback 标记） */
  code: string;
  /** 显示名称 */
  name: string;
  /** 圆底图标 */
  icon: ReactNode;
  /** 圆底色 */
  color: string;
  /** 是否为 fallback（数据库中无对应模板） */
  isFallback?: boolean;
}

export const SUBJECT_TILES: SubjectTile[] = [
  { code: "public-undergraduate", name: "本科一流课程", icon: <BookOutlined />, color: "#FF8A3D" },
  { code: "medical-vocational", name: "职业教育精品", icon: <MedicineBoxOutlined />, color: "#2FA8FF" },
  { code: "medicine", name: "临床医学", icon: <HeartOutlined />, color: "#FF5A5F" },
  { code: "bio-chemical", name: "药学", icon: <ExperimentOutlined />, color: "#7B61FF" },
  { code: "tcm", name: "中医中药", icon: <ReadOutlined />, color: "#11B981", isFallback: true },
  { code: "basic-medicine", name: "基础医学", icon: <CompassOutlined />, color: "#FFB400", isFallback: true },
  { code: "public-service", name: "公共卫生", icon: <TeamOutlined />, color: "#13C2C2" },
  { code: "imaging", name: "医学影像", icon: <CameraOutlined />, color: "#9333EA", isFallback: true },
  { code: "stomatology", name: "口腔医学", icon: <PhoneOutlined />, color: "#1677FF", isFallback: true },
  { code: "nursing", name: "护理学", icon: <FireOutlined />, color: "#EC4899", isFallback: true },
];

/** 通过 code 查找 tile，找不到则返回 undefined */
export function findSubjectTile(code: string): SubjectTile | undefined {
  return SUBJECT_TILES.find((tile) => tile.code === code);
}