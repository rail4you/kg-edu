import { getAuthHeaders } from "@/lib/auth";

/**
 * Extract array data from various API response formats
 * Handles: direct array, { success, data: array }, { success, data: { results: array } }, etc.
 */
export function extractArrayData(result: any): any[] {
  console.log("[extractArrayData] input:", result);
  if (!result) {
    console.log("[extractArrayData] result is null/undefined, returning []");
    return [];
  }
  if (Array.isArray(result)) {
    console.log("[extractArrayData] result is array, returning directly");
    return result;
  }
  if ("results" in result && Array.isArray(result.results)) {
    console.log("[extractArrayData] found results property");
    return result.results;
  }
  if (result?.success && result.data) {
    console.log("[extractArrayData] success=true, data:", result.data, "isArray:", Array.isArray(result.data));
    if (Array.isArray(result.data)) {
      console.log("[extractArrayData] returning result.data, length:", result.data.length);
      return result.data;
    }
    if ("results" in result.data && Array.isArray(result.data.results))
      return result.data.results;
    if ("data" in result.data && Array.isArray(result.data.data))
      return result.data.data;
    if ("recommendations" in result.data && Array.isArray(result.data.recommendations))
      return result.data.recommendations;
  }
  if (result?.data) {
    console.log("[extractArrayData] has data property (no success), data:", result.data);
    if (Array.isArray(result.data)) {
      console.log("[extractArrayData] returning result.data, length:", result.data.length);
      return result.data;
    }
    if ("results" in result.data && Array.isArray(result.data.results))
      return result.data.results;
    if ("recommendations" in result.data && Array.isArray(result.data.recommendations))
      return result.data.recommendations;
  }
  console.log("[extractArrayData] no match found, returning []");
  return [];
}

/**
 * Extract count from paginated API response
 */
export function extractCount(data: unknown): number {
  if (!data) return 0;
  if (typeof data === "object" && data !== null) {
    if ("count" in data && typeof (data as any).count === "number") {
      return (data as any).count;
    }
  }
  return 0;
}

/**
 * Get auth headers with proper typing
 */
export function getHeaders(user: any): Record<string, string> {
  return getAuthHeaders(user) as Record<string, string>;
}
