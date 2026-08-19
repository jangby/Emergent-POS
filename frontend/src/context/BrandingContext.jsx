import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "../lib/api";
import { applyBranding, DEFAULT_BRANDING } from "../lib/branding";
import { useAuth } from "./AuthContext";

const BrandingContext = createContext(null);

export function BrandingProvider({ children }) {
  const [branding, setBranding] = useState(DEFAULT_BRANDING);
  const [ready, setReady] = useState(false);
  const { user } = useAuth();

  // Apply defaults on mount so unauthenticated pages get consistent look
  useEffect(() => { applyBranding(DEFAULT_BRANDING); }, []);

  // Fetch tenant branding whenever the logged-in user changes
  useEffect(() => {
    if (!user || user === false) {
      applyBranding(DEFAULT_BRANDING);
      setBranding(DEFAULT_BRANDING);
      setReady(true);
      return;
    }
    (async () => {
      try {
        const r = await api.get("/settings/branding");
        const b = { ...DEFAULT_BRANDING, ...r.data };
        applyBranding(b);
        setBranding(b);
      } catch {
        applyBranding(DEFAULT_BRANDING);
        setBranding(DEFAULT_BRANDING);
      } finally { setReady(true); }
    })();
  }, [user]);

  const refresh = useCallback(async () => {
    const r = await api.get("/settings/branding");
    const b = { ...DEFAULT_BRANDING, ...r.data };
    applyBranding(b);
    setBranding(b);
    return b;
  }, []);

  const updateLocal = useCallback((b) => {
    const merged = { ...DEFAULT_BRANDING, ...b };
    applyBranding(merged);
    setBranding(merged);
  }, []);

  return (
    <BrandingContext.Provider value={{ branding, ready, refresh, updateLocal }}>
      {children}
    </BrandingContext.Provider>
  );
}

export const useBranding = () => useContext(BrandingContext);
