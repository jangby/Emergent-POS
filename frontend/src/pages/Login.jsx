import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const { login, register } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("robaya05@gmail.com");
  const [password, setPassword] = useState("admin123");
  const [name, setName] = useState("Owner");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        await login(email, password);
        toast.success("Selamat datang kembali!");
      } else {
        await register(email, password, name);
        toast.success("Akun berhasil dibuat!");
      }
      nav("/");
    } catch (err) {
      const d = err.response?.data?.detail;
      toast.error(typeof d === "string" ? d : "Gagal masuk. Coba lagi.");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="hidden md:flex bg-gradient-to-br from-primary to-orange-700 text-white p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{backgroundImage:"radial-gradient(circle at 20% 20%, white 1px, transparent 1px)", backgroundSize:"24px 24px"}}/>
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-white/20 backdrop-blur flex items-center justify-center">
              <Sparkles className="h-6 w-6" />
            </div>
            <div className="font-display text-3xl font-black tracking-tight">KasirPintar AI</div>
          </div>
        </div>
        <div className="relative space-y-4">
          <div className="text-xs uppercase tracking-widest opacity-80">Untuk UMKM Indonesia</div>
          <div className="font-display text-4xl font-black leading-tight tracking-tighter">
            Kelola toko, scan nota, terima QRIS — semua dari satu layar.
          </div>
          <div className="text-white/85 max-w-md">
            POS pintar dengan AI vision untuk otomatis update stok dari nota grosir.
            Terintegrasi Midtrans QRIS & printer Bluetooth thermal.
          </div>
        </div>
        <div className="relative text-sm opacity-70">© 2026 KasirPintar. Dibuat dengan cinta di Nusantara.</div>
      </div>

      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md border-border/70 shadow-lg">
          <CardContent className="p-8">
            <div className="md:hidden flex items-center gap-2 mb-6">
              <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="font-display font-black text-lg tracking-tight">KasirPintar AI</div>
            </div>
            <h1 className="font-display text-3xl font-black tracking-tighter mb-1">
              {mode === "login" ? "Masuk" : "Daftar"}
            </h1>
            <p className="text-sm text-muted-foreground mb-6">
              {mode === "login" ? "Kelola toko Anda dengan cerdas." : "Buat akun baru untuk memulai."}
            </p>
            <form onSubmit={submit} className="space-y-4">
              {mode === "register" && (
                <div>
                  <Label htmlFor="name">Nama</Label>
                  <Input id="name" value={name} onChange={(e)=>setName(e.target.value)} data-testid="register-name" />
                </div>
              )}
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e)=>setEmail(e.target.value)}
                       required data-testid="login-email" />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e)=>setPassword(e.target.value)}
                       required data-testid="login-password" />
              </div>
              <Button type="submit" className="w-full tap" disabled={loading} data-testid="login-submit">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (mode === "login" ? "Masuk" : "Daftar")}
              </Button>
            </form>
            <div className="mt-4 text-center text-sm">
              {mode === "login" ? (
                <button className="text-primary hover:underline" onClick={()=>setMode("register")} data-testid="switch-register">
                  Belum punya akun? Daftar
                </button>
              ) : (
                <button className="text-primary hover:underline" onClick={()=>setMode("login")} data-testid="switch-login">
                  Sudah punya akun? Masuk
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
