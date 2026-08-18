import { createContext, useContext, useEffect, useState } from "react";
import api from "../lib/api";

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
        setUser(r.data);
      } catch { setUser(false); }
      finally { setReady(true); }
    })();
  }, []);

  const login = async (email, password) => {
    const r = await api.post("/auth/login", { email, password });
    if (r.data.access_token) localStorage.setItem("kp_token", r.data.access_token);
    setUser(r.data);
    return r.data;
  };
  const register = async (email, password, name) => {
    const r = await api.post("/auth/register", { email, password, name });
    if (r.data.access_token) localStorage.setItem("kp_token", r.data.access_token);
    setUser(r.data);
    return r.data;
  };
  const logout = async () => {
    try { await api.post("/auth/logout"); } catch {}
    localStorage.removeItem("kp_token");
    setUser(false);
  };

  return (
    <AuthContext.Provider value={{ user, ready, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
