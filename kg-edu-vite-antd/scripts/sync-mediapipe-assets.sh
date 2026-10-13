#!/usr/bin/env bash
# 同步 MediaPipe 人脸检测资源到前端 public/（用于离线自托管）。
# - wasm：从 node_modules/@mediapipe/tasks-vision/wasm 拷贝（随依赖安装，无需网络）
# - 模型：首次从 Google Storage 下载并缓存（之后可离线）
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
WASM_SRC="$DIR/node_modules/@mediapipe/tasks-vision/wasm"
DEST="$DIR/public/mediapipe"
MODEL_URL="https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite"

if [ ! -d "$WASM_SRC" ]; then
  echo "未找到 $WASM_SRC，请先 npm install" >&2
  exit 1
fi

mkdir -p "$DEST/wasm" "$DEST/models"
cp "$WASM_SRC"/* "$DEST/wasm/"

if [ ! -f "$DEST/models/blaze_face_short_range.tflite" ]; then
  echo "下载人脸检测模型..."
  curl -fL "$MODEL_URL" -o "$DEST/models/.blaze_face_short_range.tflite.tmp"
  mv "$DEST/models/.blaze_face_short_range.tflite.tmp" "$DEST/models/blaze_face_short_range.tflite"
fi

echo "MediaPipe 资源已同步到 $DEST"
