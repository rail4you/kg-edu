import { createContext, useContext } from "react";

export interface PortalQueryState {
  query: string;
  setQuery: (q: string) => void;
}

/** 门户页面内共享的搜索关键词（搜索条设置，列表类组件消费） */
export const PortalQueryContext = createContext<PortalQueryState>({
  query: "",
  setQuery: () => {},
});

export const usePortalQuery = () => useContext(PortalQueryContext);
