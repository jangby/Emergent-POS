import { createContext, useContext, useEffect, useState } from "react";
import api from "../lib/api";
import { clearAllLocalData } from "../lib/offline";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null=loading, false=guest, obj=user
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("kp_token");
    if (!token) { setUser(false); setReady(true); return; }
    (async () => {
      try {
        const r = await api.get("/auth/me");
        // Guard against stale caches: if last user id differs, wipe local data.
        const lastUid = localStorage.getItem("kp_last_uid");
        if (lastUid && lastUid !== r.data.id) {
          await clearAllLocalData();
        }
        localStorage.setItem("kp_last_uid", r.data.id);
        setUser(r.data);
      } catch {
        // Token invalid → clear any leftover cache
        await clearAllLocalData();
        localStorage.removeItem("kp_token");
        localStorage.removeItem("kp_last_uid");
        setUser(false);
      }
      finally { setReady(true); }
    })();
  }, []);

  const login = async (email, password) => {
    // Wipe any residual data from a previous user before logging in.
    await clearAllLocalData();
    const r = await api.post("/auth/login", { email, password });
    if (r.data.access_token) localStorage.setItem("kp_token", r.data.access_token);
    localStorage.setItem("kp_last_uid", r.data.id);
    setUser(r.data);
    return r.data;
  };
  const register = async (email, password, name) => {
    await clearAllLocalData();
    const r = await api.post("/auth/register", { email, password, name });
    if (r.data.access_token) localStorage.setItem("kp_token", r.data.access_token);
    localStorage.setItem("kp_last_uid", r.data.id);
    setUser(r.data);
    return r.data;
  };
  const logout = async () => {
    try { await api.post("/auth/logout"); } catch {}
    await clearAllLocalData();
    localStorage.removeItem("kp_token");
    localStorage.removeItem("kp_last_uid");
    setUser(false);
  };

  return (
    <AuthContext.Provider value={{ user, ready, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
