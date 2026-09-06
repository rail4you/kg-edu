import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import * as echarts from "echarts";
import { Empty } from "antd";

interface Props {
  highlightedGraphData: any;
  casesData: any[];
  searchText: string;
  onNodeClick: (params: any) => void;
  onNodeContextMenu?: (params: any) => void;
}

export default function IdeologicalGraphChart({
  highlightedGraphData,
  casesData,
  searchText,
  onNodeClick,
  onNodeContextMenu,
}: Props) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);
  const zoomRatio = useRef(1);
  const baseNodesRef = useRef<any[]>([]);
  const autoFitDoneRef = useRef(false);
  const [zoomPercent, setZoomPercent] = useState(100);

  const fitGraphToViewport = useCallback((chart: echarts.ECharts) => {
    try {
      const container = chartRef.current;
      if (!container) return;

      const seriesModel = (chart as any).getModel?.().getSeries?.()?.[0];
      const data = seriesModel?.getData?.();
      const layouts = data?._itemLayouts;
      if (!layouts || !layouts.length) return;

      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

      layouts.forEach((layout: { x: number; y: number }, index: number) => {
        if (!layout) return;
        const rawNode = baseNodesRef.current[index];
        const symbolSize = typeof rawNode?.symbolSize === "number" ? rawNode.symbolSize : 40;
        const radius = symbolSize / 2 + 24;
        minX = Math.min(minX, layout.x - radius);
        maxX = Math.max(maxX, layout.x + radius);
        minY = Math.min(minY, layout.y - radius);
        maxY = Math.max(maxY, layout.y + radius);
      });

      if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY)) return;

      const boundsWidth = Math.max(maxX - minX, 1);
      const boundsHeight = Math.max(maxY - minY, 1);
      const padding = 80;
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;

      if (!containerWidth || !containerHeight) return;

      const fitZoom = Math.max(0.15, Math.min(2.5,
        (containerWidth - padding * 2) / boundsWidth,
        (containerHeight - padding * 2) / boundsHeight,
      ));

      const centerX = containerWidth / 2 - ((minX + maxX) / 2) * fitZoom;
      const centerY = containerHeight / 2 - ((minY + maxY) / 2) * fitZoom;

      chart.setOption({
        series: [{
          id: "ideological-graph",
          zoom: fitZoom,
          center: [centerX, centerY],
        }],
      });

      zoomRatio.current = fitZoom;
      setZoomPercent(Math.round(fitZoom * 100));
    } catch (e) {
      console.error("[GraphIdeological] auto-fit error:", e);
    }
  }, []);

  // Chart effect
  useEffect(() => {
    if (!highlightedGraphData?.nodes?.length || !chartRef.current) return;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.dispose();
    }

    const chart = echarts.init(chartRef.current);
    chartInstanceRef.current = chart;
    autoFitDoneRef.current = false;
    chart.showLoading();

    const BASE_FONT_SIZES = { label: 12, emphasis: 12 };

    baseNodesRef.current = (highlightedGraphData.nodes || []).map((node: any) => ({
      ...node,
      _baseFontSize: node.label?.fontSize || BASE_FONT_SIZES.label,
    }));

    const getScaledFontSize = (baseSize: number) => {
      return Math.max(8, Math.round(baseSize * zoomRatio.current));
    };

    const option = {
      backgroundColor: "#ffffff",
      tooltip: {
        trigger: "item",
        formatter: (params: any) => {
          if (params.dataType === "node") {
            const data = params.data as any;
            const categoryName =
              data.category !== undefined ? highlightedGraphData.categories[data.category]?.name : "";
            return `<strong>${data.name}</strong><br/><span style="color: #ddd; font-size: 11px;">${categoryName}</span>`;
          }
          if (params.dataType === "edge") {
            const data = params.data as any;
            const relationName = data.relationData?.relationName || data.name || "关联";
            return `<strong>${relationName}</strong>`;
          }
          return "";
        },
        backgroundColor: "rgba(0,0,0,0.8)",
        textStyle: { color: "#fff", fontSize: 12 },
        borderColor: "transparent",
      },
      legend: [
        {
          data: highlightedGraphData.categories?.map((c: any) => c.name) || [],
          orient: "vertical",
          left: 50,
          top: 20,
          textStyle: { fontSize: 12, color: "#333" },
        },
      ],
      animation: true,
      animationDuration: 1500,
      series: [{
        id: "ideological-graph",
        name: "思政图谱",
        type: "graph",
        layout: "force",
        data: highlightedGraphData.nodes || [],
        links: highlightedGraphData.links || [],
        categories: highlightedGraphData.categories || [],
        roam: true,
        force: {
          repulsion: 1000,
          gravity: 0.1,
          edgeLength: 150,
          layoutAnimation: true,
        },
        draggable: true,
        label: {
          show: true,
          formatter: (params: any) => params.data.name || params.name,
          fontSize: getScaledFontSize(BASE_FONT_SIZES.label),
          color: "#333",
        },
        labelLayout: { hideOverlap: true },
        emphasis: {
          focus: "adjacency",
          label: { show: true, fontSize: getScaledFontSize(BASE_FONT_SIZES.emphasis), fontWeight: "bold", color: "#333" },
          lineStyle: { width: 3, opacity: 0.8 },
        },
        lineStyle: { color: "source", curveness: 0.3, opacity: 0.6 },
        edgeSymbol: ["none", "arrow"],
        edgeSymbolSize: [0, 8],
      }],
    };

    chart.hideLoading();
    chart.setOption(option as any);
    chart.on("click", onNodeClick);
    if (onNodeContextMenu) {
      chart.on("contextmenu", onNodeContextMenu);
    }

    const handleFinished = () => {
      if (autoFitDoneRef.current) return;
      autoFitDoneRef.current = true;
      fitGraphToViewport(chart);
      window.setTimeout(() => {
        if (chartInstanceRef.current === chart) {
          chart.resize();
          fitGraphToViewport(chart);
        }
      }, 250);
    };
    chart.on("finished", handleFinished);

    const handleGraphRoam = () => {
      if (!chartInstanceRef.current) return;
      try {
        const opt = chartInstanceRef.current.getOption() as any;
        const series = opt?.series?.[0];
        if (!series) return;
        const currentZoom = series.zoom || 1;
        zoomRatio.current = currentZoom;
        setZoomPercent(Math.round(currentZoom * 100));

        const scaledFontSize = getScaledFontSize(BASE_FONT_SIZES.label);
        const scaledEmphasisFontSize = getScaledFontSize(BASE_FONT_SIZES.emphasis);

        const updatedData = baseNodesRef.current.map((node: any) => ({
          ...node,
          label: {
            ...node.label,
            fontSize: getScaledFontSize(node._baseFontSize || BASE_FONT_SIZES.label),
          },
        }));

        chartInstanceRef.current.setOption({
          series: [{
            id: 'ideological-graph',
            data: updatedData,
            label: { fontSize: scaledFontSize },
            emphasis: { label: { fontSize: scaledEmphasisFontSize } },
          }],
        });
      } catch (e) {
        console.error('[GraphIdeological] zoom error:', e);
      }
    };

    chart.on('graphRoam', handleGraphRoam);

    const resizeObserver = new ResizeObserver(() => chart.resize());
    resizeObserver.observe(chartRef.current!);

    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleResize);
      chart.off("finished", handleFinished);
      chart.off('graphRoam', handleGraphRoam);
      chart.dispose();
      chartInstanceRef.current = null;
    };
  }, [fitGraphToViewport, highlightedGraphData, onNodeClick]);

  return (
    <div style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column" }}>
      {/* Zoom toolbar */}
      <div style={{
        minHeight: 44,
        background: "#fff",
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
        gap: 8,
        flexShrink: 0,
        borderBottom: "1px solid #e5e7eb",
        justifyContent: "flex-end",
      }}>
        {searchText && (
          <span style={{ color: "#888", fontSize: 12, marginRight: "auto" }}>
            {highlightedGraphData.nodes?.length || 0} 个节点
          </span>
        )}
        <span style={{ color: "#666", fontSize: 12 }}>{zoomPercent}%</span>
        {[["−", -0.15], ["+", 0.15], ["⟳", "reset"]].map(([label, val]) => (
          <button key={label as string} onClick={() => {
            if (!chartInstanceRef.current) return;
            try {
              const opt = chartInstanceRef.current.getOption() as any;
              const cur = opt?.series?.[0]?.zoom || 1;
              const next = val === "reset" ? 1 : Math.max(0.2, Math.min(3, cur + (val as number)));
              chartInstanceRef.current.setOption({ series: [{ id: 'ideological-graph', zoom: next }] });
              zoomRatio.current = next;
              setZoomPercent(Math.round(next * 100));
            } catch (e) {
              console.error("[GraphIdeological] toolbar zoom error:", e);
            }
          }}
            style={{ background: "#f5f5f5", border: "1px solid #d9d9d9", borderRadius: 5, color: "#333", padding: "4px 12px", cursor: "pointer", fontSize: 14 }}>
            {label as string}
          </button>
        ))}
      </div>
      {/* Chart */}
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
        {highlightedGraphData.nodes?.length > 0 ? (
          <div
            ref={chartRef}
            style={{ position: "absolute", inset: 0, backgroundColor: "white", overflow: "hidden" }}
          />
        ) : (
          <div style={{ position: "absolute", inset: 0, display: "flex", justifyContent: "center", alignItems: "center" }}>
            <Empty description="暂无图谱数据，请选择课程后添加知识点和案例" />
          </div>
        )}
      </div>
    </div>
  );
}
