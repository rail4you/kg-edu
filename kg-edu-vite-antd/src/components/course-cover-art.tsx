import { useId } from "react";
import { Avatar } from "antd";
import { UserOutlined } from "@ant-design/icons";

/**
 * 生成式学术插画封面（参考 course-card-grid 风格）
 * - 纸色渐变底 + 蓝图网格 + 黄金分割矩形 motif + 四色圆点 + 手绘曲线
 * - 底部深色渐变上压标题（衬线标题 + 副标题）
 * - 按 seed 稳定生成 4 种变体，同一课程每次渲染一致
 * - 绝对定位铺满父容器（父容器需 relative + 16:9）
 */

const BG_PAIRS: Array<[string, string]> = [
  ["#EFE7D6", "#E4D9C2"],
  ["#F0EADB", "#E2D5BC"],
  ["#ECE9DF", "#DCD5C2"],
  ["#F2E8D8", "#E3CFAF"],
];

const DOT_SETS: string[][] = [
  ["#C08A2E", "#1F3A54", "#8A9A8E", "#B65C3C"],
  ["#1F3A54", "#C08A2E", "#B65C3C", "#8A9A8E"],
  ["#8A9A8E", "#B65C3C", "#1F3A54", "#C08A2E"],
  ["#B65C3C", "#8A9A8E", "#C08A2E", "#1F3A54"],
];

const CURVES = [
  "M 18 100 C 60 78, 100 112, 140 92 S 200 78, 260 102",
  "M 18 108 C 62 88, 104 116, 148 96 S 208 84, 262 104",
  "M 18 96 C 58 112, 100 82, 142 100 S 204 108, 262 94",
  "M 18 104 C 64 96, 102 108, 144 90 S 206 96, 262 100",
];

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h;
}

interface CourseCoverArtProps {
  seed: string;
  title: string;
  subtitle?: string;
}

export default function CourseCoverArt({ seed, title, subtitle }: CourseCoverArtProps) {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const variant = hashSeed(seed) % 4;
  const [bgFrom, bgTo] = BG_PAIRS[variant];
  const dots = DOT_SETS[variant];
  const curve = CURVES[variant];
  const flip = variant % 2 === 1;

  return (
    <div aria-hidden={!title} style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <svg
        viewBox="0 0 300 170"
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid slice"
        style={{ display: "block", width: "100%", height: "100%" }}
      >
        <defs>
          <linearGradient id={`ccabg${rawId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={bgFrom} />
            <stop offset="100%" stopColor={bgTo} />
          </linearGradient>
          <linearGradient id={`ccascrim${rawId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#152A3D" stopOpacity="0" />
            <stop offset="50%" stopColor="#152A3D" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#152A3D" stopOpacity="0.9" />
          </linearGradient>
        </defs>

        <rect width="300" height="170" fill={`url(#ccabg${rawId})`} />

        <g stroke="#1F3A54" strokeOpacity="0.16" strokeWidth="1">
          {Array.from({ length: 7 }).map((_, i) => (
            <line key={`v${i}`} x1={20 + i * 40} y1="0" x2={20 + i * 40} y2="170" />
          ))}
          {Array.from({ length: 5 }).map((_, i) => (
            <line key={`h${i}`} x1="0" y1={15 + i * 35} x2="300" y2={15 + i * 35} />
          ))}
        </g>

        <g
          fill="none"
          stroke="#1F3A54"
          strokeOpacity="0.55"
          strokeWidth="1.3"
          transform={flip ? "translate(300,0) scale(-1,1)" : undefined}
        >
          <rect x="170" y="12" width="112" height="112" />
          <rect x="170" y="12" width="69.2" height="69.2" />
          <rect x="239.2" y="12" width="42.8" height="42.8" />
          <rect x="239.2" y="54.8" width="26.5" height="26.5" />
          <path d="M 170 124 A 112 112 0 0 1 282 12" />
        </g>

        <g>
          {dots.map((color, i) => (
            <circle key={color} cx={28 + i * 20} cy="118" r="5" fill={color} />
          ))}
        </g>

        <path
          d={curve}
          fill="none"
          stroke="#171A21"
          strokeOpacity="0.5"
          strokeWidth="1.8"
          strokeLinecap="round"
        />

        <rect width="300" height="170" fill={`url(#ccascrim${rawId})`} />
      </svg>

      <div style={{ position: "absolute", left: 12, right: 12, bottom: 10 }}>
        <div
          style={{
            margin: 0,
            fontFamily: 'Georgia, "Songti SC", "STSong", "Noto Serif SC", serif',
            fontWeight: 600,
            fontSize: 17,
            lineHeight: 1.25,
            color: "#FFFFFF",
            letterSpacing: "0.01em",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            textShadow: "0 1px 3px rgba(0,0,0,0.4)",
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div
            style={{
              margin: "3px 0 0",
              fontSize: 11,
              color: "rgba(255,255,255,0.78)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}

/** 教师头像：有照片用照片，无照片用藏青首字圆（参考风格 footer） */
export function TeacherInitial({ name, avatar }: { name?: string; avatar?: string }) {
  if (avatar) {
    return <Avatar size={20} src={avatar} icon={<UserOutlined />} />;
  }
  const initial = (name ?? "").trim().slice(-1) || "师";
  return <span className="portal-course-card__teacher-initial">{initial}</span>;
}
