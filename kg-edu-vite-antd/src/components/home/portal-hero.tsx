import { useEffect, useMemo, useRef, useState } from "react";
import { Grid } from "antd";
import type { CatalogCourse } from "@/hooks/use-course-catalog";

interface PortalHeroProps {
  /** Hero 轮播课程（首页取「新开课程」前 3 个） */
  heroCourses: CatalogCourse[];
}

const FALLBACK_TITLE = "精品在线课程资源库";

/**
 * 桌面端 Hero（学银在线风格）
 * - 居中大标题 + 3D 数据图浅蓝背景
 * - 标题 = heroCourses[0].title（fallback "精品在线课程资源库"）
 * - 副标题：主讲教师：${teacherName} · ${orgName}
 * - 3 张 slide 自动轮播（5500ms）+ 底部圆点指示器
 * - 移动端不渲染（由 home.tsx 接入 MobilePromoBanner 等组件）
 */
export default function PortalHero({ heroCourses }: PortalHeroProps) {
  const breakpoint = Grid.useBreakpoint();
  const isMobile = !breakpoint.md;

  const [activeIndex, setActiveIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const slideAccents = useMemo(
    () => [
      {
        label: "精品课程",
        titleFallback: FALLBACK_TITLE,
        bg: "linear-gradient(135deg, #0E5BB8 0%, #1F8FE0 60%, #42C2F5 100%)",
        image: "/assets/home-portal-hero-bg.png",
        overlay: "none",
      },
      {
        label: "AI 课程",
        titleFallback: "智慧教学 · 知识图谱驱动",
        bg: "linear-gradient(135deg, #0B4CA8 0%, #1A6DD8 50%, #2FA8FF 100%)",
        image: "/assets/decor/knowledge-bg_001.jpg",
        overlay:
          "linear-gradient(120deg, rgba(8, 27, 62, 0.55) 0%, rgba(8, 27, 62, 0.32) 55%, rgba(8, 27, 62, 0.18) 100%)",
      },
      {
        label: "能力图谱",
        titleFallback: "能力图谱 · 教学新范式",
        bg: "linear-gradient(135deg, #08448F 0%, #1668C8 50%, #3D9BFF 100%)",
        image: "/assets/decor/micromajor-bg_001.jpg",
        overlay: "none",
      },
    ],
    [],
  );

  const slides = useMemo(
    () =>
      slideAccents.map((accent, idx) => {
        const recommended = heroCourses[idx];
        const fallback = heroCourses[0];
        const course = recommended ?? fallback;

        const title = course?.title?.trim() || accent.titleFallback;
        const teacherName = course?.teacherName || "教师待完善";
        const orgName = course?.orgName || "全国合作院校";
        const subtitle = `主讲教师：${teacherName} · ${orgName}`;

        return {
          accent: accent.label,
          title,
          subtitle,
          bg: accent.bg,
          image: accent.image,
          overlay: accent.overlay,
        };
      }),
    [heroCourses, slideAccents],
  );

  useEffect(() => {
    if (isMobile) return;
    timerRef.current = setTimeout(() => {
      setActiveIndex((prev) => (prev + 1) % slides.length);
    }, 5500);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [activeIndex, isMobile, slides.length]);

  // 移动端不再由 PortalHero 渲染，由 home.tsx 接入 MobilePromoBanner / MobileSubjectGrid 等组件。
  if (isMobile) {
    return null;
  }

  const currentSlide = slides[activeIndex];

  return (
    <section
      className="xyedu-hero"
      style={
        {
          "--hero-bg": currentSlide.bg,
          "--hero-image": `url("${currentSlide.image}")`,
          "--hero-overlay": currentSlide.overlay,
        } as React.CSSProperties
      }
    >
      <div className="xyedu-hero__shell">
        <div className="xyedu-hero__slide" key={activeIndex}>
          <span className="xyedu-hero__accent">{currentSlide.accent}</span>
          <h1 className="xyedu-hero__title">{currentSlide.title}</h1>
          <p className="xyedu-hero__subtitle">{currentSlide.subtitle}</p>
        </div>

        <div className="xyedu-hero__indicators">
          {slides.map((_, idx) => (
            <button
              key={idx}
              type="button"
              className={`xyedu-hero__indicator ${idx === activeIndex ? "is-active" : ""}`}
              onClick={() => setActiveIndex(idx)}
              aria-label={`第 ${idx + 1} 张`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
