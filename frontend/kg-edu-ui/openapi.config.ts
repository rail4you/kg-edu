import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: '../../shared_data/openapi-schema.json',
  output: 'src/lib/api',
  client: '@hey-api/client-fetch',
  exportSchemas: true,
  format: true,
  lint: false,
  useEnumType: true,
  operationId: true,
});