import { FilesetResolver, FaceDetector } from "@mediapipe/tasks-vision";

// MediaPipe Tasks Vision 人脸检测。wasm 与模型本地自托管（public/mediapipe），
// 随前端 dist 一起部署，无需外网 / CDN。
const BASE = import.meta.env.BASE_URL || "/";
const WASM_URL = `${BASE}mediapipe/wasm`;
const MODEL_URL = `${BASE}mediapipe/models/blaze_face_short_range.tflite`;

let detectorPromise: Promise<FaceDetector | null> | null = null;

// 串行化 detect 调用：同一 detector 并发 detect 可能出错/结果错乱
let detectQueue: Promise<unknown> = Promise.resolve();
function serialize<T>(fn: () => T): Promise<T> {
  const run = detectQueue.then(fn, fn);
  detectQueue = run.catch(() => {});
  return run;
}

async function createDetector(): Promise<FaceDetector | null> {
  const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
  // 固定使用 CPU（WebAssembly）推理：不依赖 GPU，兼容服务器/无显卡环境；
  // 部分机器 GPU delegate 会“创建成功但检测恒为空”，故不启用。
  const detector = await FaceDetector.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
    runningMode: "IMAGE",
    minDetectionConfidence: 0.3,
  });
  console.info("[face-detect] detector ready: CPU (wasm)");
  return detector;
}

/** 预加载检测器（幂等）。初始化失败返回 null，并允许后续重试。 */
export function preloadFaceDetector(): Promise<FaceDetector | null> {
  if (!detectorPromise) {
    detectorPromise = createDetector().catch((e) => {
      console.warn("[face-detect] 初始化失败", e);
      detectorPromise = null;
      return null;
    });
  }
  return detectorPromise;
}

export interface FaceDetectResult {
  ok: boolean;
  faces: number;
  raw: number;
  maxScore: number;
  brightness?: number;
  error?: string;
}

/** 在当前帧上检测人脸。 */
export async function detectFace(
  source: HTMLCanvasElement | HTMLVideoElement
): Promise<FaceDetectResult> {
  const detector = await preloadFaceDetector();
  if (!detector) {
    return { ok: false, faces: 0, raw: 0, maxScore: 0, error: "人脸识别模型加载失败" };
  }
  try {
    let brightness: number | undefined;
    if (source instanceof HTMLCanvasElement) {
      try {
        const c = source.getContext("2d");
        const px = c?.getImageData(0, 0, source.width, source.height).data;
        if (px) {
          let sum = 0;
          let n = 0;
          for (let i = 0; i < px.length; i += 4 * 97) {
            sum += (px[i] + px[i + 1] + px[i + 2]) / 3;
            n++;
          }
          brightness = n ? Math.round(sum / n) : -1;
        }
      } catch {
        /* ignore */
      }
    }
    return await serialize(() => {
      const res = detector.detect(source);
      const dets = res.detections ?? [];
      const isCanvas = source instanceof HTMLCanvasElement;
      const vw = (isCanvas ? source.width : source.videoWidth) || 1;
      const vh = (isCanvas ? source.height : source.videoHeight) || 1;

      let maxScore = 0;
      let valid = 0;
      for (const d of dets) {
        const score = d.categories?.[0]?.score ?? 0;
        const bb = d.boundingBox;
        const areaRatio = bb ? (bb.width * bb.height) / (vw * vh) : 0;
        if (score > maxScore) maxScore = score;
        // 置信度 >= 0.3 且人脸框面积占画面 >= 1%（宽松阈值，减少漏检）
        if (score >= 0.3 && areaRatio >= 0.01) valid += 1;
      }

      console.debug(
        "[face-detect] raw=",
        dets.length,
        "valid=",
        valid,
        "brightness=",
        brightness,
        "size=",
        vw,
        vh,
        "scores=",
        dets.map((d) => Number((d.categories?.[0]?.score ?? 0).toFixed(3)))
      );

      return { ok: valid > 0, faces: valid, raw: dets.length, maxScore, brightness };
    });
  } catch (e: any) {
    return { ok: false, faces: 0, raw: 0, maxScore: 0, error: e?.message || "人脸识别失败" };
  }
}
