import React from "react";
import { useMemo, useCallback } from "react";
import {
  DEFAULT_QUESTION_LEVEL_CONFIGS,
  listQuestionLevelConfigs,
  seedQuestionLevelConfigs,
  subscribeQuestionLevelConfigChanges,
  type QuestionLevelConfig,
} from "@/lib/question-level-config";
import { getCurrentTenant } from "@/lib/tenant";

// 模块级常量，避免每次渲染创建新的空数组/空对象引用
const EMPTY_CONFIGS: QuestionLevelConfig[] = [];
const EMPTY_CONFIG_MAP: Record<string, { id: string; label: string; description: string; color: string; position: number }> = {};

export function useQuestionLevelConfig(courseId?: string) {
  const currentTenant = getCurrentTenant();
  const tenant = currentTenant?.schemaName || "";
  const [configs, setConfigs] = React.useState<QuestionLevelConfig[]>(EMPTY_CONFIGS);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSeeding, setIsSeeding] = React.useState(false);

  // 本地状态来存储 configMap，允许外部更新
  const [localConfigMap, setLocalConfigMap] = React.useState<
    Record<string, { id: string; label: string; description: string; color: string; position: number }>
  >(EMPTY_CONFIG_MAP);

  const loadConfigs = useCallback(() => {
    if (!tenant || !courseId) {
      setConfigs(EMPTY_CONFIGS);
      setIsLoading(false);
      return EMPTY_CONFIGS;
    }

    setIsLoading(true);
    const nextConfigs = listQuestionLevelConfigs(tenant, courseId);
    setConfigs(nextConfigs);
    setIsLoading(false);
    return nextConfigs;
  }, [tenant, courseId]);

  React.useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  React.useEffect(() => {
    return subscribeQuestionLevelConfigChanges((detail) => {
      if (detail.tenant === tenant && detail.courseId === courseId) {
        loadConfigs();
      }
    });
  }, [tenant, courseId, loadConfigs]);

  // 使用稳定引用，避免 query.data 为 undefined 时 || [] 每次创建新数组导致无限渲染循环
  const safeConfigs = configs ?? EMPTY_CONFIGS;

  // 当 courseId 变化时，强制重新获取数据
  const prevCourseIdRef = React.useRef<string | undefined>(undefined);
  React.useEffect(() => {
    // 只有在 courseId 真正改变时才重置
    if (courseId !== prevCourseIdRef.current) {
      prevCourseIdRef.current = courseId;
      setLocalConfigMap(EMPTY_CONFIG_MAP);
      loadConfigs();
    }
  }, [courseId, tenant, loadConfigs]);

  // Auto-seed defaults if no configs exist for this course
  const shouldSeed =
    !isLoading &&
    safeConfigs.length === 0 &&
    !!tenant &&
    !!courseId;

  const seedDefaults = useCallback(() => {
    if (!tenant || !courseId) return;

    setIsSeeding(true);
    const nextConfigs = seedQuestionLevelConfigs(tenant, courseId);
    setConfigs(nextConfigs);
    setIsSeeding(false);
  }, [tenant, courseId]);

  // Build a map keyed by levelKey - 优先使用本地状态
  const configMap = useMemo(() => {
    // 如果有本地数据，使用本地数据
    if (localConfigMap && Object.keys(localConfigMap).length > 0) {
      return localConfigMap;
    }
    // 否则从 configs 构建
    if (safeConfigs.length === 0) {
      return EMPTY_CONFIG_MAP;
    }
    return configs.reduce<
      Record<string, { id: string; label: string; description: string; color: string; position: number }>
    >((acc, config) => {
      acc[config.levelKey] = {
        id: config.id,
        label: config.label,
        description: config.description || "",
        color: config.color,
        position: config.position,
      };
      return acc;
    }, {});
  }, [configs, safeConfigs, localConfigMap]);

  // 更新本地 configMap 的函数
  const setConfigMap = useCallback((newMap: typeof localConfigMap) => {
    setLocalConfigMap(newMap);
  }, []);

  // Get label for a level key, with fallback - memoized to prevent re-renders
  const getLabel = useCallback((levelKey: string): string => {
    return configMap[levelKey]?.label || DEFAULT_QUESTION_LEVEL_CONFIGS[levelKey]?.label || levelKey;
  }, [configMap]);

  // Get color for a level key, with fallback - memoized to prevent re-renders
  const getColor = useCallback((levelKey: string): string => {
    return configMap[levelKey]?.color || DEFAULT_QUESTION_LEVEL_CONFIGS[levelKey]?.color || "#999";
  }, [configMap]);

  // Get description for a level key, with fallback - memoized to prevent re-renders
  const getDescription = useCallback((levelKey: string): string => {
    return configMap[levelKey]?.description || DEFAULT_QUESTION_LEVEL_CONFIGS[levelKey]?.description || "";
  }, [configMap]);

  return {
    configs: safeConfigs,
    configMap,
    getLabel,
    getColor,
    getDescription,
    isLoading,
    shouldSeed,
    seedDefaults,
    isSeeding,
    setConfigMap,
    refetch: loadConfigs,
  };
}
