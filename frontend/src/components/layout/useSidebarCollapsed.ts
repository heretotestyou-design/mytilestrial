"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "mtt.sidebar.collapsed";

/** Desktop sidebar collapsed state, remembered per browser. Toggle with ⌘B / Ctrl+B. */
export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(false);
  // Read after hydration (the server can't know); `ready` skips the width animation on load.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(KEY) === "1");
    } catch {
      /* storage unavailable */
    }
    const t = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(KEY, c ? "0" : "1");
      } catch {
        /* storage unavailable */
      }
      return !c;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b" && !e.altKey && !e.shiftKey) {
        const el = e.target as HTMLElement | null;
        if (el?.closest("input, textarea, [contenteditable=true]")) return;
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  return { collapsed, toggle, ready };
}
