import { NavLink, useNavigate } from "react-router-dom";
import {
  ShoppingCart, Package, ScanLine, Receipt, BarChart3, Settings as Cog,
  Sun, Moon, LogOut, Sparkles
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { Button } from "./ui/button";

const NAV = [
  { to: "/", label: "Kasir", icon: ShoppingCart, testid: "nav-pos" },
  { to: "/inventory", label: "Produk", icon: Package, testid: "nav-inventory" },
  { to: "/restock", label: "Scan Nota", icon: ScanLine, testid: "nav-restock" },
  { to: "/transactions", label: "Riwayat", icon: Receipt, testid: "nav-transactions" },
  { to: "/analytics", label: "Analitik", icon: BarChart3, testid: "nav-analytics" },
  { to: "/settings", label: "Pengaturan", icon: Cog, testid: "nav-settings" },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const nav = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground flex overflow-x-hidden">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex w-64 border-r border-border/60 bg-card/60 flex-col p-5 sticky top-0 h-screen">
        <div className="flex items-center gap-2 mb-8">
          <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <div className="font-display font-black text-lg leading-none tracking-tight">KasirPintar</div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest">AI · POS</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              data-testid={n.testid}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-md tap text-sm font-medium ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "hover:bg-secondary text-foreground/80"
                }`
              }
            >
              <n.icon className="h-4 w-4" strokeWidth={1.75} /> {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-border/60 pt-4 mt-4 space-y-2">
          <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={toggle} data-testid="theme-toggle">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="sm" onClick={async () => { await logout(); nav("/login"); }}
                    data-testid="logout-btn" className="flex-1">
              <LogOut className="h-4 w-4 mr-1" /> Keluar
            </Button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 pb-24 md:pb-0 min-w-0">
        {/* Mobile header */}
        <div className="md:hidden sticky top-0 z-40 backdrop-blur-xl bg-background/85 border-b border-border/60 flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-display font-black tracking-tight">KasirPintar</span>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={toggle} data-testid="theme-toggle-mobile">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={async () => { await logout(); nav("/login"); }}
                    data-testid="logout-mobile">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="p-4 md:p-8">{children}</div>
      </main>

      {/* Bottom Nav (mobile) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 backdrop-blur-xl bg-background/85 border-t border-border/60">
        <div className="grid grid-cols-6">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === "/"} data-testid={`${n.testid}-mobile`}
                     className={({ isActive }) =>
                       `flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] ${
                         isActive ? "text-primary" : "text-muted-foreground"
                       }`
                     }>
              <n.icon className="h-4 w-4" strokeWidth={1.75} />
              <span className="leading-none">{n.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
