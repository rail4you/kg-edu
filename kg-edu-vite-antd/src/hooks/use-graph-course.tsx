import React, { createContext, useContext, useState, useCallback } from "react";

export type GraphTabType = "tree" | "circle" | "knowledge" | "question";

interface GraphCourseContextType {
  selectedCourseId: string | undefined;
  setSelectedCourseId: (courseId: string | undefined) => void;
  activeTab: GraphTabType;
  setActiveTab: (tab: GraphTabType) => void;
}

const GraphCourseContext = createContext<GraphCourseContextType | undefined>(
  undefined,
);

export function GraphCourseProvider({ children }: { children: React.ReactNode }) {
  const [selectedCourseId, setSelectedCourseId] = useState<string | undefined>(
    undefined,
  );
  const [activeTab, setActiveTab] = useState<GraphTabType>("tree");

  return (
    <GraphCourseContext.Provider value={{ selectedCourseId, setSelectedCourseId, activeTab, setActiveTab }}>
      {children}
    </GraphCourseContext.Provider>
  );
}

export function useGraphCourse() {
  const context = useContext(GraphCourseContext);
  if (context === undefined) {
    const localCourseId = localStorage.getItem("selectedCourse") || undefined;
    return {
      selectedCourseId: localCourseId,
      setSelectedCourseId: (_id: string | undefined) => {},
      activeTab: "tree" as GraphTabType,
      setActiveTab: (_tab: GraphTabType) => {},
    };
  }
  return context;
}
