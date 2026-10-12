import { useNavigate } from "react-router-dom";
import "./module-switcher.css";

export type ModuleKey = "smart-course" | "micro-major";

const MODULES: { key: ModuleKey; label: string; path: string }[] = [
  { key: "smart-course", label: "智慧课程", path: "/teacher/dashboard" },
  { key: "micro-major", label: "微专业", path: "/micro-major/dashboard" },
];

export function ModuleSwitcher({ active }: { active: ModuleKey }) {
  const navigate = useNavigate();

  return (
    <div className="module-switcher" role="tablist" aria-label="模块切换">
      {MODULES.map((m) => {
        const isActive = active === m.key;
        return (
          <button
            key={m.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            data-module={m.key}
            className={`module-switcher__item${isActive ? " is-active" : ""}`}
            title={`切换到${m.label}`}
            onClick={() => {
              if (!isActive) navigate(m.path);
            }}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
