import { useState, useCallback, useMemo } from "react";

export function useToast() {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((type, title, message, duration = 4000) => {
    const id = Date.now() + Math.random();   // unique even if two toasts fire in the same millisecond
    setToasts(t => [...t, { id, type, title, message }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(t => t.filter(x => x.id !== id));
  }, []);

  // useMemo -> the SAME object on every render. Otherwise anything that lists `toast` in a
  // dependency array (useEffect / useCallback) re-runs on every single render.
  const toast = useMemo(() => ({
    success: (title, message) => addToast("success", title, message),
    error:   (title, message) => addToast("error",   title, message),
    warning: (title, message) => addToast("warning", title, message),
    info:    (title, message) => addToast("info",    title, message),
  }), [addToast]);

  return { toasts, toast, removeToast };
}
