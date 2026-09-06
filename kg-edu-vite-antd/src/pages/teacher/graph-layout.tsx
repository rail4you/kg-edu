import React from "react";
import { GraphCourseProvider } from "@/hooks/use-graph-course";

interface GraphLayoutProps {
  children: React.ReactNode;
}

export default function GraphLayout({ children }: GraphLayoutProps) {
  return (
    <GraphCourseProvider>
      {children}
    </GraphCourseProvider>
  );
}
