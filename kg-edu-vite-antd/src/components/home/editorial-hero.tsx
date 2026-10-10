import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/auth-context";

const SLIDES = [
  {
    kicker: "易课程 · 智慧教育",
    titleA: "让知识相连，",
    titleB: "让未来展开。",
    desc: "从一门好课程出发，连接知识、思考与实践。在易课程，找到属于你的成长方向。",
    tab: "智慧课程",
    cta: "探索智慧课程",
    to: "/courses",
    note: "以优质课程，打开学习的新视野",
    image: "/assets/home-hero/hero-1.png",
    alt: "阳光照进现代大学图书馆，开阔的空间与层叠书架",
  },
  {
    kicker: "知识相连 · 图谱导学",
    titleA: "看见知识的联系，",
    titleB: "走出自己的路径。",
    desc: "让零散的知识成为清晰的体系。沿知识图谱探索，在每一次理解中更进一步。",
    tab: "知识图谱",
    cta: "体验知识图谱",
    to: "/courses",
    note: "从一个知识点，走向完整的理解",
    image: "/assets/home-hero/hero-2.png",
    alt: "深蓝空间中相互连接的发光知识节点",
  },
  {
    kicker: "微专业 · 真实技能",
    titleA: "以热爱为起点，",
    titleB: "让能力更进一步。",
    desc: "围绕真实问题，展开一段系统学习。用微专业课程与项目实践，拓展新的可能。",
    tab: "微专业",
    cta: "发现微专业",
    to: "/micro-majors",
    note: "用一段系统学习，拓展一项能力",
    image: "/assets/home-hero/hero-3.png",
    alt: "两位大学生在现代工作室共同研究课程项目",
  },
];

export default function EditorialHero() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const profilePath =
    user?.role === "teacher"
      ? "/teacher/dashboard/profile"
      : user?.role === "admin" || user?.role === "super_admin"
        ? "/admin/dashboard/profile"
        : "/dashboard/profile";
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), 7000);
    return () => clearInterval(t);
  }, [paused]);
  const go = (i: number) => { setIndex((i + SLIDES.length) % SLIDES.length); setPaused(true); };
  return (
    <section
      className="ed-carousel"
      aria-label="易课程精选专题"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {SLIDES.map((s, i) => {
        return (
          <article key={s.tab} className={`ed-slide ${i === index ? "is-active" : ""}`} aria-hidden={i !== index}>
            <img className="ed-slide__bg" src={s.image} alt={s.alt} />
            <div className="ed-slide__shade" />
            <div className="ed-slide__inner">
              <div className="ed-copy">
                <div className="ed-kicker"><span />{s.kicker}</div>
                <h1>{s.titleA}<br />{s.titleB}</h1>
                <p>{s.desc}</p>
                <div className="ed-hero-actions">
                  <a className="ed-cta" onClick={() => navigate(s.to)}>{s.cta}<span>↗</span></a>
                  <a className="ed-secondary" onClick={() => navigate(user ? profilePath : "/login")}>{user ? "个人中心" : "登录"} <span>→</span></a>
                </div>
              </div>
            </div>
          </article>
        );
      })}
      <div className="ed-carousel__bottom">
        <div className="ed-pagination">
          {SLIDES.map((s, i) => (
            <button key={s.tab} className={`ed-selector ${i === index ? "is-active" : ""}`} onClick={() => go(i)}>
              <span className="ed-selector__line" />
              <span className="ed-selector__label"><small>0{i + 1}</small>{s.tab}</span>
            </button>
          ))}
        </div>
        <div className="ed-controls">
          <span>0{index + 1} <em>/ 03</em></span>
          <button aria-label="上一张" onClick={() => go(index - 1)}>←</button>
          <button aria-label="下一张" onClick={() => go(index + 1)}>→</button>
        </div>
      </div>
    </section>
  );
}
