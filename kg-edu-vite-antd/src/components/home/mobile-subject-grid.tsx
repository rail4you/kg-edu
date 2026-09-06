import {
  BookOutlined,
  CalculatorOutlined,
  ExperimentOutlined,
  GlobalOutlined,
  HistoryOutlined,
  MedicineBoxOutlined,
  ReadOutlined,
  RocketOutlined,
  SmileOutlined,
} from "@ant-design/icons";
import type { ReactNode } from "react";
import type { SubjectStat } from "@/hooks/use-course-catalog";

interface TileDef {
  code: string;
  name: string;
  icon: ReactNode;
  color: string;
}

/** 首页移动端学科圆形图标网格。
 *  10 个学科使用差异化图标与配色；数据缺失时显示 fallback 占位。
 *  仅在 ≤768px 显示。 */
const TILES: TileDef[] = [
  { code: "all", name: "全部", icon: <GlobalOutlined />, color: "#FF8A3D" },
  { code: "philosophy", name: "哲学", icon: <ReadOutlined />, color: "#2FA8FF" },
  { code: "economics", name: "经济学", icon: <CalculatorOutlined />, color: "#FF5A5F" },
  { code: "law", name: "法学", icon: <BookOutlined />, color: "#7B61FF" },
  { code: "education", name: "教育学", icon: <SmileOutlined />, color: "#11B981" },
  { code: "literature", name: "文学", icon: <ReadOutlined />, color: "#FFB400" },
  { code: "history", name: "历史学", icon: <HistoryOutlined />, color: "#13C2C2" },
  { code: "science", name: "理学", icon: <ExperimentOutlined />, color: "#9333EA" },
  { code: "engineering", name: "工学", icon: <RocketOutlined />, color: "#1677FF" },
  { code: "medical-vocational", name: "医学", icon: <MedicineBoxOutlined />, color: "#EC4899" },
];

export default function MobileSubjectGrid({
  subjects,
  totalCourses,
  onSubjectClick,
}: {
  subjects: SubjectStat[];
  totalCourses: number;
  onSubjectClick: (code: string) => void;
}) {
  const statMap = new Map(subjects.map((s) => [s.code, s]));

  return (
    <section className="mobile-subject-grid-section">
      <div className="mobile-subject-grid-section__grid">
        {TILES.map((tile) => {
          const stat = tile.code === "all" ? null : statMap.get(tile.code);
          const count = tile.code === "all" ? totalCourses : (stat?.count || 0);
          const name = tile.code === "all" ? "全部" : tile.name;
          return (
            <button
              key={tile.code}
              type="button"
              className="mobile-subject-grid-section__item"
              onClick={() => onSubjectClick(tile.code)}
            >
              <span
                className="mobile-subject-grid-section__icon"
                style={{ background: tile.color }}
              >
                {tile.icon}
              </span>
              <span className="mobile-subject-grid-section__label">{name}</span>
              {count > 0 && (
                <span className="mobile-subject-grid-section__count">{count}</span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}