import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Typography, Slider, Button, Spin, Drawer, Grid } from "antd";
import { ReloadOutlined, BookOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/auth/auth-context";
import { getCurrentTenant } from "@/lib/tenant";
import {
  listCourses,
  listExercises,
  listKnowledges,
  listMainAbilities,
  listSubAbilities,
} from "@/lib/ash_rpc";
import { extractArrayData, getHeaders } from "@/utils/api-helpers";

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

interface KnowledgeItem {
  id: string;
  name?: string;
  tag?: string;
}

interface Layer {
  name: string;
  color: number;
  nodes: number;
  position: number;
  nodeObjects: THREE.Mesh[];
}

interface Connection {
  start: THREE.Mesh;
  end: THREE.Mesh;
}

export default function GraphLayerPage() {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const canvasRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const knowledgeGraphGroupRef = useRef<THREE.Group | null>(null);
  const connectionGroupRef = useRef<THREE.Group | null>(null);
  const connectionsRef = useRef<Connection[]>([]);
  const layerGroupsRef = useRef<THREE.Group[]>([]);
  const particlesRef = useRef<THREE.Points | null>(null);
  const isInitialized = useRef(false);
  const animationRef = useRef<number | undefined>(undefined);
  const targetRotationX = useRef(0);
  const targetRotationY = useRef(0);
  const isMouseDown = useRef(false);
  const lastTouchPoint = useRef<{ x: number; y: number } | null>(null);
  const lastPinchDistance = useRef<number | null>(null);

  const { user } = useAuth();
  const currentTenant = getCurrentTenant();
  const [layerSpacing, setLayerSpacing] = useState(5);
  const [controlsOpen, setControlsOpen] = useState(false);

  const selectedCourseId = localStorage.getItem("selectedCourse") || "";

  const { data: courseData } = useQuery({
    queryKey: ["course-info", selectedCourseId, currentTenant?.id],
    queryFn: () =>
      selectedCourseId
        ? listCourses({
            tenant: currentTenant?.schemaName || "public",
            fields: ["id", "title"],
            filter: { id: { eq: selectedCourseId } },
            headers: getHeaders(user),
          })
        : null,
    enabled: !!selectedCourseId && !!currentTenant && !!user,
  });

  const course = (() => {
    const arr = extractArrayData(courseData);
    return arr.length > 0 ? arr[0] : null;
  })();

  // 获取知识图谱数据（不含思政标签的）
  const { data: knowledgeData } = useQuery({
    queryKey: ["knowledge-graph-layer", selectedCourseId, currentTenant?.id],
    queryFn: () =>
      selectedCourseId
        ? listKnowledges({
            tenant: currentTenant?.schemaName || "public",
            fields: ["id", "name"],
            filter: { courseId: { eq: selectedCourseId } },
            headers: getHeaders(user),
          })
        : null,
    enabled: !!selectedCourseId && !!currentTenant && !!user,
  });

  // 获取思政图谱数据（包含"课程思政"标签的）
  const { data: ideologicalData } = useQuery({
    queryKey: ["ideological-graph-layer", selectedCourseId, currentTenant?.id],
    queryFn: () =>
      selectedCourseId
        ? listKnowledges({
            tenant: currentTenant?.schemaName || "public",
            fields: ["id", "name", "tag"],
            filter: { courseId: { eq: selectedCourseId } },
            headers: getHeaders(user),
          })
        : null,
    enabled: !!selectedCourseId && !!currentTenant && !!user,
  });

  // 获取问题图谱数据
  const { data: exercisesData } = useQuery({
    queryKey: ["exercises-graph-layer", selectedCourseId, currentTenant?.id],
    queryFn: () =>
      selectedCourseId
        ? listExercises({
            tenant: currentTenant?.schemaName || "public",
            fields: ["id"],
            filter: { courseId: { eq: selectedCourseId } },
            headers: getHeaders(user),
          })
        : null,
    enabled: !!selectedCourseId && !!currentTenant && !!user,
  });

  // 获取能力图谱数据 - 主能力
  const { data: mainAbilitiesData } = useQuery({
    queryKey: ["main-abilities-graph-layer", selectedCourseId, currentTenant?.id],
    queryFn: () =>
      selectedCourseId
        ? listMainAbilities({
            tenant: currentTenant?.schemaName || "public",
            fields: ["id", "name"],
            filter: { courseId: { eq: selectedCourseId } },
            headers: getHeaders(user),
          })
        : null,
    enabled: !!selectedCourseId && !!currentTenant && !!user,
  });

  // 获取能力图谱数据 - 子能力
  const { data: subAbilitiesData } = useQuery({
    queryKey: ["sub-abilities-graph-layer", selectedCourseId, currentTenant?.id],
    queryFn: () =>
      selectedCourseId
        ? listSubAbilities({
            tenant: currentTenant?.schemaName || "public",
            fields: ["id", "name"],
            filter: { courseId: { eq: selectedCourseId } },
            headers: getHeaders(user),
          })
        : null,
    enabled: !!selectedCourseId && !!currentTenant && !!user,
  });

  // 处理数据
  const allKnowledges = extractArrayData(knowledgeData) as KnowledgeItem[] || [];
  const ideologicalKnowledges = (extractArrayData(ideologicalData) as KnowledgeItem[] || []).filter(
    (k: KnowledgeItem) => k.tag && k.tag.includes("课程思政")
  );
  const questionData = extractArrayData(exercisesData) || [];
  const mainAbilities = extractArrayData(mainAbilitiesData) || [];
  const subAbilities = extractArrayData(subAbilitiesData) || [];

  // 各图谱的节点数量
  const courseGraphCount = course ? 1 : 0;
  const knowledgeGraphCount = allKnowledges.length;
  const ideologicalGraphCount = ideologicalKnowledges.length;
  const questionGraphCount = questionData.length;
  const abilityGraphCount = mainAbilities.length + subAbilities.length;

  const isLoading = !selectedCourseId || !courseData || !knowledgeData;

  const initScene = () => {
    if (!canvasRef.current || isInitialized.current) return;
    isInitialized.current = true;

    const container = canvasRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = null;
    scene.fog = new THREE.Fog(0x764ba2, 15, 50);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(20, 15, 30);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000, 0);

    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    scene.add(new THREE.AmbientLight(0xffffff, 0.3));
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(10, 10, 10);
    scene.add(directionalLight);
    scene.add(new THREE.PointLight(0x4a90e2, 0.5, 100));

    const knowledgeGraphGroup = new THREE.Group();
    scene.add(knowledgeGraphGroup);
    knowledgeGraphGroupRef.current = knowledgeGraphGroup;

    const layers: Layer[] = [
      {
        name: "课程图谱",
        color: 0x4a90e2,
        nodes: knowledgeGraphCount,
        position: 8,
        nodeObjects: [],
      },
      {
        name: "问题图谱",
        color: 0xffc107,
        nodes: questionGraphCount,
        position: 4,
        nodeObjects: [],
      },
      {
        name: "思政图谱",
        color: 0xe91e63,
        nodes: ideologicalGraphCount,
        position: 0,
        nodeObjects: [],
      },
      {
        name: "能力图谱",
        color: 0x00bcd4,
        nodes: abilityGraphCount,
        position: -4,
        nodeObjects: [],
      },
    ];

    const nodeTypeColors = [
      0xff7f50, 0x87cefa, 0x32cd32, 0xffd700, 0x6a5acd, 0xda70d6,
    ];
    const layerGroups: THREE.Group[] = [];

    layers.forEach((layer, index) => {
      const group = new THREE.Group();
      group.position.y = layer.position;

      const planeSize = 22;
      const planeGeometry = new THREE.PlaneGeometry(planeSize, planeSize);
      const planeMaterial = new THREE.MeshPhongMaterial({
        color: 0x1a1a1a,
        transparent: true,
        opacity: 0.08,
        side: THREE.DoubleSide,
        emissive: layer.color,
        emissiveIntensity: 0.05,
      });
      const plane = new THREE.Mesh(planeGeometry, planeMaterial);
      plane.rotation.x = -Math.PI / 2;
      group.add(plane);

      const edgeGeometry = new THREE.EdgesGeometry(planeGeometry);
      const edgeMaterial = new THREE.LineBasicMaterial({
        color: layer.color,
        linewidth: 1.5,
        transparent: true,
        opacity: 0.4,
      });
      const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
      edges.rotation.x = -Math.PI / 2;
      group.add(edges);

      // 节点半径
      const nodeRadius = Math.max(0.12, 0.35 - index * 0.04);
      for (let i = 0; i < layer.nodes; i++) {
        const randomColor =
          nodeTypeColors[Math.floor(Math.random() * nodeTypeColors.length)];
        const nodeMaterial = new THREE.MeshPhongMaterial({
          color: randomColor,
          emissive: randomColor,
          emissiveIntensity: 0.5,
        });
        const node = new THREE.Mesh(
          new THREE.SphereGeometry(nodeRadius, 20, 20),
          nodeMaterial
        );

        if (layer.nodes === 1) {
          node.position.set(0, 0.25, 0);
        } else {
          node.position.set(
            (Math.random() - 0.5) * (planeSize * 0.85),
            0.25,
            (Math.random() - 0.5) * (planeSize * 0.85)
          );
        }
        group.add(node);
        layer.nodeObjects.push(node);
      }

      // 清晰的标签 - 带背景框
      const labelCanvas = document.createElement("canvas");
      labelCanvas.width = 280;
      labelCanvas.height = 50;
      const labelCtx = labelCanvas.getContext("2d");
      if (labelCtx) {
        // 绘制带背景的标签 - Coursera风格深蓝色
        labelCtx.fillStyle = "rgba(33, 33, 33, 0.9)";
        labelCtx.roundRect(0, 0, 280, 50, 8);
        labelCtx.fill();

        labelCtx.font = "bold 20px Microsoft YaHei, Arial";
        labelCtx.fillStyle = "#ffffff";
        labelCtx.textAlign = "center";
        labelCtx.textBaseline = "middle";
        labelCtx.fillText(`${layer.name} (${layer.nodes}个节点)`, 140, 28);

        const labelTexture = new THREE.Texture(labelCanvas);
        labelTexture.needsUpdate = true;

        const labelSprite = new THREE.Sprite(
          new THREE.SpriteMaterial({ map: labelTexture, transparent: true })
        );
        labelSprite.position.set(0, 1.2, planeSize / 2 + 1.5);
        labelSprite.scale.set(7, 1.4, 1);
        group.add(labelSprite);
      }

      layerGroups.push(group);
      knowledgeGraphGroup.add(group);
    });

    layerGroupsRef.current = layerGroups;

    const connections: Connection[] = [];
    const connectionGroup = new THREE.Group();
    knowledgeGraphGroup.add(connectionGroup);
    connectionGroupRef.current = connectionGroup;

    const connectionMaterial = new THREE.LineBasicMaterial({
      color: 0x666666,
      transparent: true,
      opacity: 0.2,
    });

    for (let i = 0; i < layers.length - 1; i++) {
      const parentNodes = layers[i].nodeObjects;
      const childNodes = layers[i + 1].nodeObjects;

      parentNodes.forEach((parentNode) => {
        const connectionProbability = layers[i + 1].nodes > 100 ? 0.03 : 0.25;
        childNodes.forEach((childNode) => {
          if (Math.random() < connectionProbability) {
            connections.push({ start: parentNode, end: childNode });
          }
        });
      });
    }

    connectionsRef.current = connections;

    const updateConnections = () => {
      if (!connectionGroupRef.current || !knowledgeGraphGroupRef.current)
        return;

      while (connectionGroupRef.current.children.length) {
        connectionGroupRef.current.remove(
          connectionGroupRef.current.children[0]
        );
      }

      const startPos = new THREE.Vector3();
      const endPos = new THREE.Vector3();

      connections.forEach((conn) => {
        conn.start.getWorldPosition(startPos);
        conn.end.getWorldPosition(endPos);

        knowledgeGraphGroupRef.current!.worldToLocal(startPos);
        knowledgeGraphGroupRef.current!.worldToLocal(endPos);

        const geometry = new THREE.BufferGeometry().setFromPoints([
          startPos,
          endPos,
        ]);
        const line = new THREE.Line(geometry, connectionMaterial);
        connectionGroupRef.current!.add(line);
      });
    };

    updateConnections();

    const particleCount = 800;
    const particlesGeometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    for (let i = 0; i < particleCount; i++) {
      positions.push(
        (Math.random() - 0.5) * 60,
        (Math.random() - 0.5) * 60,
        (Math.random() - 0.5) * 60
      );
    }
    particlesGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3)
    );
    const particles = new THREE.Points(
      particlesGeometry,
      new THREE.PointsMaterial({
        size: 0.08,
        color: 0x555555,
        transparent: true,
        opacity: 0.5,
      })
    );
    scene.add(particles);
    particlesRef.current = particles;

    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);

      if (knowledgeGraphGroupRef.current) {
        knowledgeGraphGroupRef.current.rotation.y +=
          (targetRotationY.current - knowledgeGraphGroupRef.current.rotation.y) *
          0.05;
        knowledgeGraphGroupRef.current.rotation.x +=
          (targetRotationX.current - knowledgeGraphGroupRef.current.rotation.x) *
          0.05;
      }

      if (particlesRef.current) {
        particlesRef.current.rotation.y += 0.0002;
      }

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };

    animate();
  };

  useEffect(() => {
    const container = canvasRef.current;
    if (!container) return;

    const handleMouseDown = (event: MouseEvent) => {
      if (container.contains(event.target as Node)) {
        isMouseDown.current = true;
      }
    };

    const handleMouseUp = () => {
      isMouseDown.current = false;
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (isMouseDown.current && container.contains(event.target as Node)) {
        const rect = container.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        targetRotationY.current += ((event.clientX - centerX) / 100) * 0.005;
        targetRotationX.current += ((event.clientY - centerY) / 100) * 0.005;
      }
    };

    const handleWheel = (event: WheelEvent) => {
      if (container.contains(event.target as Node) && cameraRef.current) {
        event.preventDefault();
        updateCameraDistance(event.deltaY * 0.02);
      }
    };

    const getTouchDistance = (touches: TouchList) => {
      if (touches.length < 2) return null;
      const [first, second] = [touches[0], touches[1]];
      return Math.hypot(
        first.clientX - second.clientX,
        first.clientY - second.clientY,
      );
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (!container.contains(event.target as Node)) return;
      if (event.touches.length === 1) {
        isMouseDown.current = true;
        lastTouchPoint.current = {
          x: event.touches[0].clientX,
          y: event.touches[0].clientY,
        };
        lastPinchDistance.current = null;
      } else if (event.touches.length === 2) {
        lastPinchDistance.current = getTouchDistance(event.touches);
      }
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (!container.contains(event.target as Node)) return;
      if (event.touches.length === 1 && lastTouchPoint.current) {
        event.preventDefault();
        const touch = event.touches[0];
        targetRotationY.current += (touch.clientX - lastTouchPoint.current.x) * 0.0009;
        targetRotationX.current += (touch.clientY - lastTouchPoint.current.y) * 0.0009;
        lastTouchPoint.current = { x: touch.clientX, y: touch.clientY };
      } else if (event.touches.length === 2) {
        event.preventDefault();
        const nextDistance = getTouchDistance(event.touches);
        if (nextDistance !== null && lastPinchDistance.current !== null) {
          updateCameraDistance((lastPinchDistance.current - nextDistance) * 0.04);
        }
        lastPinchDistance.current = nextDistance;
      }
    };

    const handleTouchEnd = () => {
      isMouseDown.current = false;
      lastTouchPoint.current = null;
      lastPinchDistance.current = null;
    };

    const handleResize = () => {
      if (cameraRef.current && rendererRef.current && container) {
        const width = container.clientWidth;
        const height = container.clientHeight;

        cameraRef.current.aspect = width / height;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(width, height);
      }
    };

    container.addEventListener("mousedown", handleMouseDown);
    container.addEventListener("wheel", handleWheel, { passive: false });
    container.addEventListener("touchstart", handleTouchStart, { passive: false });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });
    container.addEventListener("touchend", handleTouchEnd);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("resize", handleResize);

    return () => {
      container.removeEventListener("mousedown", handleMouseDown);
      container.removeEventListener("wheel", handleWheel);
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    if (layerGroupsRef.current) {
      layerGroupsRef.current.forEach((group, index) => {
        group.position.y = 8 - index * layerSpacing;
      });

      if (
        connectionGroupRef.current &&
        knowledgeGraphGroupRef.current &&
        connectionsRef.current
      ) {
        while (connectionGroupRef.current.children.length) {
          connectionGroupRef.current.remove(
            connectionGroupRef.current.children[0]
          );
        }

        const startPos = new THREE.Vector3();
        const endPos = new THREE.Vector3();
        const connectionMaterial = new THREE.LineBasicMaterial({
          color: 0x666666,
          transparent: true,
          opacity: 0.2,
        });

        connectionsRef.current.forEach((conn) => {
          conn.start.getWorldPosition(startPos);
          conn.end.getWorldPosition(endPos);

          knowledgeGraphGroupRef.current!.worldToLocal(startPos);
          knowledgeGraphGroupRef.current!.worldToLocal(endPos);

          const geometry = new THREE.BufferGeometry().setFromPoints([
            startPos,
            endPos,
          ]);
          const line = new THREE.Line(geometry, connectionMaterial);
          connectionGroupRef.current!.add(line);
        });
      }
    }
  }, [layerSpacing]);

  useEffect(() => {
    if (isInitialized.current) {
      if (rendererRef.current && canvasRef.current) {
        canvasRef.current.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
      }
      isInitialized.current = false;
    }
    initScene();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (rendererRef.current && canvasRef.current) {
        if (canvasRef.current.contains(rendererRef.current.domElement)) {
          canvasRef.current.removeChild(rendererRef.current.domElement);
        }
        rendererRef.current.dispose();
      }
      isInitialized.current = false;
    };
  }, [selectedCourseId, questionGraphCount, knowledgeGraphCount, abilityGraphCount, ideologicalGraphCount, courseGraphCount]);

  const resetView = () => {
    if (cameraRef.current && knowledgeGraphGroupRef.current) {
      cameraRef.current.position.set(20, 15, 30);
      cameraRef.current.lookAt(0, 0, 0);
      knowledgeGraphGroupRef.current.rotation.set(0, 0, 0);
      targetRotationX.current = 0;
      targetRotationY.current = 0;
    }
  };

  const updateCameraDistance = (delta: number) => {
    if (!cameraRef.current) return;
    cameraRef.current.position.z += delta;
    cameraRef.current.position.z = Math.max(
      10,
      Math.min(50, cameraRef.current.position.z)
    );
  };

  if (!selectedCourseId) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",
          borderRadius: 8,
        }}
      >
        <BookOutlined style={{ fontSize: 64, color: "#2573E6", marginBottom: 24 }} />
        <Title level={3} style={{ color: "#333", marginBottom: 8 }}>
          请先选择一个课程
        </Title>
        <Text style={{ color: "#666", fontSize: 16 }}>
          选择课程后将显示该课程的图谱层级数据
        </Text>
      </div>
    );
  }

  const controlPanelContent = (
    <>
      <Title level={5} style={{ marginBottom: 20, color: "#333" }}>
        视图控制
      </Title>

      <div style={{ marginBottom: 20 }}>
        <Text
          style={{
            display: "block",
            marginBottom: 8,
            fontSize: 13,
            color: "#666",
            fontWeight: 500,
          }}
        >
          层间距
        </Text>
        <Slider
          min={2}
          max={8}
          step={0.5}
          value={layerSpacing}
          onChange={setLayerSpacing}
          style={{ width: "100%" }}
        />
      </div>

      <Button
        type="primary"
        icon={<ReloadOutlined />}
        onClick={resetView}
        block
        style={{
          height: 40,
          fontWeight: 500,
          marginBottom: 20,
        }}
      >
        重置视图
      </Button>

      <div style={{ marginTop: "auto", paddingTop: 16 }}>
        <div
          style={{
            fontSize: 11,
            color: "#999",
            textAlign: "center",
            fontWeight: 500,
            background: "#f5f5f5",
            padding: 10,
            borderRadius: 4,
          }}
        >
          {isMobile ? "单指拖动旋转，双指缩放" : "鼠标左键拖动：旋转，滚轮：缩放"}
        </div>
      </div>
    </>
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        background: "#f0f2f5",
      }}
    >
      {/* 简洁顶部标题 */}
      <div
        style={{
          flexShrink: 0,
          background: "#2573E6",
          padding: isMobile ? "14px 16px" : "16px 32px",
          zIndex: 1000,
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <Title level={isMobile ? 5 : 4} style={{ margin: 0, color: "#fff", fontWeight: 500 }}>
          课程图谱总览 - {course?.title || "加载中..."}
        </Title>
        {isMobile && (
          <Button onClick={() => setControlsOpen(true)}>
            视图控制
          </Button>
        )}
      </div>

      <div
        style={{
          display: "flex",
          flex: 1,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            flex: 1,
            position: "relative",
            overflow: "hidden",
            background: "#f7f8fa",
          }}
        >
          {isLoading && (
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                zIndex: 1000,
                textAlign: "center",
              }}
            >
              <Spin size="large" />
              <div style={{ color: "#fff", marginTop: 16, fontSize: 16 }}>
                加载图谱数据中...
              </div>
            </div>
          )}
          <div
            ref={canvasRef}
            style={{
              width: "100%",
              height: "100%",
              position: "absolute",
              top: 0,
              left: 0,
            }}
          />

          {!isMobile && (
            <div
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                width: 220,
                height: "100%",
                background: "rgba(255, 255, 255, 0.95)",
                borderLeft: "1px solid #e0e0e0",
                zIndex: 100,
                color: "#333",
                display: "flex",
                flexDirection: "column",
                padding: 20,
              }}
            >
              {controlPanelContent}
            </div>
          )}
        </div>
      </div>

      <Drawer
        title="视图控制"
        placement="bottom"
        height={280}
        onClose={() => setControlsOpen(false)}
        open={controlsOpen}
      >
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
          {controlPanelContent}
        </div>
      </Drawer>
    </div>
  );
}
