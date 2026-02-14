import { useState } from "react";

const PREVIEW_MUTED_KEY = "is-preview-muted";

export const usePreviewMuted = () => {
  const defaultMuted = localStorage.getItem(PREVIEW_MUTED_KEY);
  const [muted, setMuted] = useState(
    defaultMuted ? defaultMuted === "true" : true,
  );

  const toggleMuted = () => {
    setMuted(!muted);
    localStorage.setItem(PREVIEW_MUTED_KEY, muted ? "false" : "true");
  };

  return { muted, toggleMuted };
};
