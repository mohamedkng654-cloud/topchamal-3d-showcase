import { useEffect, useState } from "react";

export type AdminToolOption = {
  id: string;
  label: string;
};

const storageKey = "topchamal-admin-hidden-tools";

function readPreferences(): Record<string, unknown> {
  if (typeof window === "undefined") return {};
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(storageKey) || "{}");
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function readHiddenTools(section: string, tools: readonly AdminToolOption[]) {
  const stored = readPreferences()[section];
  const validIds = new Set(tools.map((tool) => tool.id));
  return new Set(
    Array.isArray(stored)
      ? stored.filter((id): id is string => typeof id === "string" && validIds.has(id))
      : [],
  );
}

export function useAdminToolPreferences(section: string, tools: readonly AdminToolOption[]) {
  const toolIds = tools.map((tool) => tool.id);
  const [hiddenTools, setHiddenTools] = useState(() => readHiddenTools(section, tools));

  useEffect(() => {
    if (typeof window === "undefined") return;
    const preferences = readPreferences();
    preferences[section] = [...hiddenTools];
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(preferences));
    } catch {
      // Keep preferences for this session if browser storage is unavailable.
    }
  }, [hiddenTools, section]);

  function toggleTool(id: string) {
    if (!toolIds.includes(id)) return;
    setHiddenTools((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function showAllTools() {
    setHiddenTools(new Set());
  }

  function hideAllTools() {
    setHiddenTools(new Set(toolIds));
  }

  return {
    hiddenTools,
    isVisible: (id: string) => !hiddenTools.has(id),
    toggleTool,
    showAllTools,
    hideAllTools,
  };
}
