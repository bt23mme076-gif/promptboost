import { useState, useEffect, useCallback } from "react";
import { PromptHistoryItem } from "@/types";

export function useHistory() {
  const [history, setHistory] = useState<PromptHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const res = await chrome.runtime.sendMessage({ type: "GET_HISTORY" });
    if (res?.success) {
      setHistory((res.data as PromptHistoryItem[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const deleteItem = useCallback(async (id: string) => {
    await chrome.runtime.sendMessage({ type: "DELETE_HISTORY_ITEM", payload: { id } });
    setHistory((prev) => prev.filter((h) => h.id !== id));
  }, []);

  const toggleFavorite = useCallback(async (id: string) => {
    await chrome.runtime.sendMessage({ type: "TOGGLE_FAVORITE", payload: { id } });
    setHistory((prev) =>
      prev.map((h) => (h.id === id ? { ...h, favorited: !h.favorited } : h))
    );
  }, []);

  const clearAll = useCallback(async () => {
    await chrome.runtime.sendMessage({ type: "CLEAR_HISTORY" });
    setHistory([]);
  }, []);

  return { history, loading, deleteItem, toggleFavorite, clearAll, refresh };
}
