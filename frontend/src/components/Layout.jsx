import { NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  ShoppingCart, Package, ScanLine, Receipt, BarChart3, Settings as Cog,
  Sun, Moon, LogOut, Sparkles, MessageCircle, Truck, Clock, Tag, MoreHorizontal, Barcode,
  Users, TrendingDown, Zap
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useBranding } from "../context/BrandingContext";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "./ui/sheet";
import { InstallButton } from "./InstallPWA";

const PRIMARY_NAV = [
  { to: "/", label: "Kasir", icon: ShoppingCart, testid: "nav-pos" },
  { to: "/inventory", label: "Produk", icon: Package, testid: "nav-inventory" },
  { to: "/online-orders", label: "Online", icon: Truck, testid: "nav-online" },
  { to: "/wa-orders", label: "WA", icon: MessageCircle, testid: "nav-wa" },
];
const SECONDARY_NAV = [
  { to: "/customers", label: "Bon/Utang", icon: Users, testid: "nav-customers" },
  { to: "/expenses", label: "Pengeluaran", icon: TrendingDown, testid: "nav-expenses" },
  { to: "/bundles", label: "AI Bundle", icon: Zap, testid: "nav-bundles" },
  { to: "/restock", label: "Scan Nota", icon: ScanLine, testid: "nav-restock" },
  { to: "/barcodes", label: "Cetak Label", icon: Barcode, testid: "nav-barcodes" },
  { to: "/shifts", label: "Shift", icon: Clock, testid: "nav-shifts" },
  { to: "/promotions", label: "Promo", icon: Tag, testid: "nav-promo" },
  { to: "/transactions", label: "Riwayat", icon: Receipt, testid: "nav-transactions" },
  { to: "/analytics", label: "Analitik", icon: BarChart3, testid: "nav-analytics" },
  { to: "/settings", label: "Pengaturan", icon: Cog, testid: "nav-settings" },
];
const ALL_NAV = [...PRIMARY_NAV, ...SECONDARY_NAV];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const { branding } = useBranding();
  const nav = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);

  const LogoIcon = () => (
    branding?.logo_base64 ? (
      <img src={branding.logo_base64} alt={branding.short_name}
           className="h-full w-full object-cover" />
    ) : (
      <Sparkles className="h-full w-full p-[22%] text-primary-foreground" strokeWidth={2} />
    )
  );

  const NavItem = ({ n, mobile }) => (
    <NavLink to={n.to} end={n.to === "/"} data-testid={mobile ? `${n.testid}-mobile` : n.testid}
      onClick={() => mobile && setMoreOpen(false)}
      className={({ isActive }) =>
        mobile
          ? `flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] ${isActive ? "text-primary" : "text-muted-foreground"}`
          : `flex items-center gap-3 px-3 py-2.5 rounded-md tap text-sm font-medium ${
              isActive ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-secondary text-foreground/80"
            }`
      }>
      <n.icon className="h-4 w-4" strokeWidth={1.75} />
      <span className={mobile ? "leading-none" : ""}>{n.label}</span>
    </NavLink>
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex overflow-x-hidden">
      <aside className="hidden md:flex w-64 border-r border-border/60 bg-card/60 flex-col p-5 sticky top-0 h-screen">
        <div className="flex items-center gap-2 mb-8">
          <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center overflow-hidden">
            <LogoIcon />
          </div>
          <div>
            <div className="font-display font-black text-lg leading-none tracking-tight truncate max-w-[10rem]" data-testid="brand-name-desktop">{branding?.short_name || "KasirPintar"}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest">POS · AI</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto">
          {ALL_NAV.map((n) => <NavItem key={n.to} n={n} />)}
        </nav>
        <div className="border-t border-border/60 pt-4 mt-4 space-y-2">
          <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{user?.role}</div>
          <InstallButton variant="outline" size="sm" className="w-full" />
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

      <main className="flex-1 pb-24 md:pb-0 min-w-0">
        <div className="md:hidden sticky top-0 z-40 backdrop-blur-xl bg-background/85 border-b border-border/60 flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center overflow-hidden">
              <LogoIcon />
            </div>
            <span className="font-display font-black tracking-tight truncate max-w-[10rem]" data-testid="brand-name-mobile">{branding?.short_name || "KasirPintar"}</span>
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

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 backdrop-blur-xl bg-background/85 border-t border-border/60">
        <div className="grid grid-cols-5">
          {PRIMARY_NAV.map((n) => <NavItem key={n.to} n={n} mobile />)}
          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <SheetTrigger asChild>
              <button className="flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] text-muted-foreground" data-testid="nav-more-mobile">
                <MoreHorizontal className="h-4 w-4" />
                <span className="leading-none">Lainnya</span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom">
              <SheetHeader><SheetTitle className="font-display">Menu Lainnya</SheetTitle></SheetHeader>
              <div className="grid grid-cols-3 gap-3 mt-3">
                {SECONDARY_NAV.map((n) => (
                  <NavLink key={n.to} to={n.to} onClick={() => setMoreOpen(false)}
                    data-testid={`${n.testid}-mobile`}
                    className="flex flex-col items-center gap-2 p-3 rounded-md border border-border/60 tap hover:bg-secondary">
                    <n.icon className="h-5 w-5 text-primary" />
                    <span className="text-xs">{n.label}</span>
                  </NavLink>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </div>
  );
}
