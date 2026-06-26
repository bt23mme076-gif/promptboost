import { useState, useEffect, useCallback } from "react";
import { Settings, DEFAULT_SETTINGS } from "@/types";

type Status = "loading" | "ready" | "saving" | "error";

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    chrome.runtime.sendMessage({ type: "GET_SETTINGS" }).then((res) => {
      if (res?.success) {
        setSettings(res.data as Settings);
        setStatus("ready");
      } else {
        setError(res?.error ?? "Failed to load settings");
        setStatus("error");
      }
    });
  }, []);

  const save = useCallback(async (updates: Partial<Settings>) => {
    setStatus("saving");
    setError("");
    const merged = { ...settings, ...updates };
    setSettings(merged);

    const res = await chrome.runtime.sendMessage({
      type: "SAVE_SETTINGS",
      payload: updates,
    });

    if (res?.success) {
      setStatus("ready");
    } else {
      setError(res?.error ?? "Failed to save settings");
      setStatus("error");
    }
  }, [settings]);

  return { settings, status, error, save };
}
