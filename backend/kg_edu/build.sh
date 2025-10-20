docker buildx build \
  --platform linux/amd64 \
  -t registry.cn-zhangjiakou.aliyuncs.com/myelixir/kg_edu_backend:latest \
  --load \
  .

docker push registry.cn-zhangjiakou.aliyuncs.com/myelixir/kg_edu_backend:latest