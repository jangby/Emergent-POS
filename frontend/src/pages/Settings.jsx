import { useEffect, useRef, useState } from "react";
import api from "../lib/api";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "../components/ui/select";
import { Printer, Bluetooth, Store, KeyRound, CheckCircle2, MessageCircle, Download, Sparkles, TestTube2, Trash2, Palette, Upload, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { connectPrinter, printTest, isBluetoothSupported, getConnectedPrinter } from "../lib/bluetooth";
import { InstallButton, InstalledBadge } from "../components/InstallPWA";
import { cropLogoToSquare, contrastForeground, DEFAULT_BRANDING } from "../lib/branding";
import { useBranding } from "../context/BrandingContext";

const PRESET_COLORS = ["#e85d04", "#0ea5e9", "#16a34a", "#7c3aed", "#db2777", "#f59e0b", "#111827"];

export default function Settings() {
  const [store, setStore] = useState({ name: "", address: "", phone: "", footer: "" });
  const [mt, setMt] = useState({ mode: "sandbox", merchant_id: "", client_key: "", server_key: "", configured: false });
  const [fn, setFn] = useState({ token: "", configured: false });
  const [gm, setGm] = useState({ api_key: "", configured: false, model: "gemini-3.6-flash" });
  const [gmTesting, setGmTesting] = useState(false);
  const [br, setBr] = useState(DEFAULT_BRANDING);
  const [brSaving, setBrSaving] = useState(false);
  const brandingCtx = useBranding();
  const fileRef = useRef(null);
  const [printer, setPrinter] = useState(getConnectedPrinter());

  const refresh = async () => {
    const r = await api.get("/settings");
    setStore(r.data.store);
    setMt({ ...r.data.midtrans, server_key: "" });
    setFn({ token: "", configured: !!r.data.fonnte?.configured });
    setGm({ api_key: "", configured: !!r.data.gemini?.configured, model: r.data.gemini?.model || "gemini-3.6-flash" });
    if (r.data.branding) setBr({ ...DEFAULT_BRANDING, ...r.data.branding });
  };
  useEffect(() => { refresh(); }, []);

  const saveStore = async () => { await api.put("/settings/store", store); toast.success("Profil toko tersimpan"); };
  const saveMt = async () => {
    await api.put("/settings/midtrans", {
      mode: mt.mode, merchant_id: mt.merchant_id || "",
      client_key: mt.client_key || "", server_key: mt.server_key || ""
    });
    toast.success("Konfigurasi Midtrans tersimpan");
    setMt(m => ({ ...m, configured: true, server_key: "" }));
  };

  const saveFn = async () => {
    if (!fn.token || fn.token.length < 5) { toast.error("Token Fonnte tidak valid"); return; }
    await api.put("/settings/fonnte", { token: fn.token });
    toast.success("Token Fonnte tersimpan");
    setFn({ token: "", configured: true });
  };

  const saveGm = async () => {
    const key = (gm.api_key || "").trim();
    if (key.length < 20) { toast.error("Gemini API Key terlalu pendek. Ambil dari aistudio.google.com/apikey."); return; }
    try {
      await api.put("/settings/gemini", { api_key: key });
      toast.success("Gemini API Key tersimpan");
      setGm(g => ({ ...g, configured: true, api_key: "" }));
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal menyimpan key");
    }
  };

  const testGm = async () => {
    setGmTesting(true);
    try {
      const r = await api.post("/settings/gemini/test");
      toast.success(`✓ Gemini merespons: "${r.data.reply || 'OK'}"`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Test gagal");
    } finally { setGmTesting(false); }
  };

  const clearGm = async () => {
    if (!window.confirm("Hapus Gemini API Key tersimpan? Semua fitur AI akan berhenti sampai Anda memasukkan key lagi.")) return;
    try {
      await api.delete("/settings/gemini");
      toast.success("Key dihapus");
      setGm({ api_key: "", configured: false, model: gm.model });
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal menghapus");
    }
  };

  const onLogoPick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { toast.error("File terlalu besar, maks 4 MB"); return; }
    try {
      const dataUrl = await cropLogoToSquare(file, 512);
      setBr((b) => ({ ...b, logo_base64: dataUrl }));
      toast.success("Logo di-crop 512×512. Klik simpan untuk menerapkan.");
    } catch (err) {
      toast.error(err.message || "Gagal memproses gambar");
    }
  };

  const saveBranding = async () => {
    if (!br.app_name?.trim() || !br.short_name?.trim()) {
      toast.error("Nama aplikasi & nama singkat wajib diisi");
      return;
    }
    if (br.short_name.length > 12) { toast.error("Nama singkat maksimum 12 karakter"); return; }
    if (br.app_name.length > 30) { toast.error("Nama aplikasi maksimum 30 karakter"); return; }
    setBrSaving(true);
    try {
      const r = await api.put("/settings/branding", {
        app_name: br.app_name.trim(),
        short_name: br.short_name.trim(),
        theme_color: br.theme_color,
        logo_base64: br.logo_base64 || "",
      });
      // Apply immediately across app (title, theme meta, manifest, icons, CSS vars, layout header)
      brandingCtx?.updateLocal(r.data);
      toast.success("Branding tersimpan & diterapkan");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal menyimpan branding");
    } finally { setBrSaving(false); }
  };

  const resetBranding = async () => {
    if (!window.confirm("Kembalikan ke branding bawaan KasirPintar?")) return;
    try {
      await api.delete("/settings/branding");
      const fresh = await api.get("/settings/branding");
      setBr({ ...DEFAULT_BRANDING, ...fresh.data });
      brandingCtx?.updateLocal(fresh.data);
      toast.success("Branding direset");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal mereset");
    }
  };

  // Live-preview: apply immediately as user edits (title, header, manifest)
  useEffect(() => {
    if (brandingCtx?.updateLocal) brandingCtx.updateLocal(br);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [br.app_name, br.short_name, br.theme_color, br.logo_base64]);

  const doPair = async () => {
    try { const r = await connectPrinter(); setPrinter(r.deviceName); toast.success(`Terhubung ke ${r.deviceName}`); }
    catch (e) { toast.error(e.message || "Gagal menghubungkan printer"); }
  };
  const doTest = async () => {
    try { await printTest(); toast.success("Uji cetak terkirim"); }
    catch (e) { toast.error(e.message || "Gagal cetak"); }
  };

  const fg = contrastForeground(br.theme_color);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl md:text-4xl font-black tracking-tighter">Pengaturan</h1>
        <p className="text-sm text-muted-foreground">Branding, profil toko, konfigurasi AI, Midtrans, WhatsApp, dan printer Bluetooth.</p>
      </div>

      <Card className="p-5 border-border/70 space-y-4" data-testid="branding-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            <span className="font-display font-black tracking-tight">Branding & Tampilan Aplikasi</span>
          </div>
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-red-600" onClick={resetBranding} data-testid="brand-reset">
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Reset
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Kustomisasi tampilan aplikasi & pintasan PWA di HP pelanggan. Nama, logo, dan warna akan langsung diterapkan
          ke header, ikon pintasan (Android/iOS), status bar, dan tab browser.
        </p>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <Label>Nama Aplikasi / Toko <span className="text-[10px] text-muted-foreground">({(br.app_name || "").length}/30)</span></Label>
              <Input
                value={br.app_name || ""}
                maxLength={30}
                onChange={(e) => setBr({ ...br, app_name: e.target.value })}
                placeholder="Kasir Toko Berkah"
                data-testid="brand-app-name"
              />
            </div>
            <div>
              <Label>Nama Singkat Pintasan <span className="text-[10px] text-muted-foreground">({(br.short_name || "").length}/12)</span></Label>
              <Input
                value={br.short_name || ""}
                maxLength={12}
                onChange={(e) => setBr({ ...br, short_name: e.target.value })}
                placeholder="Berkah"
                data-testid="brand-short-name"
              />
              <p className="text-[10px] text-muted-foreground mt-1">Muncul di bawah ikon pintasan di Home Screen HP.</p>
            </div>
            <div>
              <Label>Warna Tema Utama</Label>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="color"
                  value={br.theme_color}
                  onChange={(e) => setBr({ ...br, theme_color: e.target.value })}
                  className="h-10 w-14 rounded-md border border-border/60 cursor-pointer"
                  data-testid="brand-color"
                />
                <Input
                  value={br.theme_color}
                  onChange={(e) => setBr({ ...br, theme_color: e.target.value })}
                  className="w-28 font-mono text-sm uppercase"
                  data-testid="brand-color-hex"
                  maxLength={7}
                />
                <div className="flex gap-1">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setBr({ ...br, theme_color: c })}
                      style={{ background: c }}
                      className={`h-7 w-7 rounded-full border-2 ${br.theme_color === c ? "border-foreground" : "border-transparent"}`}
                      data-testid={`brand-color-preset-${c.replace('#', '')}`}
                      aria-label={c}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div>
              <Label>Logo / Ikon Aplikasi</Label>
              <div className="flex items-center gap-3 flex-wrap">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={onLogoPick}
                  data-testid="brand-logo-file"
                />
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} data-testid="brand-logo-btn">
                  <Upload className="h-4 w-4 mr-1" /> Pilih File
                </Button>
                {br.logo_base64 && (
                  <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700"
                          onClick={() => setBr({ ...br, logo_base64: "" })} data-testid="brand-logo-clear">
                    Hapus Logo
                  </Button>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">PNG/JPG/WEBP. Otomatis di-crop ke bujur sangkar 512×512px.</p>
            </div>
            <Button onClick={saveBranding} disabled={brSaving} className="tap w-full md:w-auto" data-testid="brand-save">
              <CheckCircle2 className="h-4 w-4 mr-1" /> {brSaving ? "Menyimpan…" : "Simpan & Terapkan Branding"}
            </Button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground uppercase tracking-widest">Pratinjau Pintasan (Live)</span>
            </div>

            {/* Android home screen mock */}
            <div className="rounded-2xl p-4 bg-gradient-to-br from-slate-800 to-slate-900 shadow-inner">
              <div className="text-[10px] text-slate-400 mb-3 uppercase tracking-widest">Android Home Screen</div>
              <div className="grid grid-cols-4 gap-3">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <div className={`h-12 w-12 rounded-2xl ${i === 2 ? "" : "bg-slate-700/50"}`}
                         style={i === 2 ? { background: br.theme_color, boxShadow: `0 6px 16px -6px ${br.theme_color}aa` } : {}}>
                      {i === 2 && (br.logo_base64 ? (
                        <img src={br.logo_base64} alt="" className="h-full w-full object-cover rounded-2xl" />
                      ) : (
                        <div className="h-full w-full rounded-2xl flex items-center justify-center font-black text-lg" style={{ color: fg }}>
                          {(br.short_name || "K")[0].toUpperCase()}
                        </div>
                      ))}
                    </div>
                    <div className="text-[9px] text-slate-100 truncate w-full text-center leading-tight" data-testid={i === 2 ? "brand-preview-label" : undefined}>
                      {i === 2 ? (br.short_name || "KasirPintar") : ["Chrome", "Gmail", "Chat", "Maps"][Math.min(i, 3)]}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* iOS-style */}
            <div className="rounded-2xl p-4 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-slate-700 dark:to-slate-800 shadow-inner">
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-widest">iOS Home Screen</div>
              <div className="grid grid-cols-4 gap-3">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <div className={`h-14 w-14 rounded-[16px] shadow-md ${i === 0 ? "" : "bg-white/70 dark:bg-slate-600/70"}`}
                         style={i === 0 ? { background: br.theme_color } : {}}>
                      {i === 0 && (br.logo_base64 ? (
                        <img src={br.logo_base64} alt="" className="h-full w-full object-cover rounded-[16px]" />
                      ) : (
                        <div className="h-full w-full rounded-[16px] flex items-center justify-center font-black text-xl" style={{ color: fg }}>
                          {(br.short_name || "K")[0].toUpperCase()}
                        </div>
                      ))}
                    </div>
                    <div className="text-[10px] text-slate-800 dark:text-slate-100 truncate w-full text-center leading-tight">
                      {i === 0 ? (br.short_name || "KasirPintar") : ["Safari", "Notes", "Wallet"][i - 1]}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Browser tab mock */}
            <div className="rounded-md border border-border/60 p-2 bg-muted/50">
              <div className="flex items-center gap-2">
                {br.logo_base64 ? (
                  <img src={br.logo_base64} alt="" className="h-4 w-4 rounded-sm" />
                ) : (
                  <div className="h-4 w-4 rounded-sm flex items-center justify-center text-[8px] font-black" style={{ background: br.theme_color, color: fg }}>
                    {(br.short_name || "K")[0].toUpperCase()}
                  </div>
                )}
                <span className="text-xs truncate">{br.app_name || "KasirPintar AI"}</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-5 border-border/70 space-y-3">
        <div className="flex items-center gap-2">
          <Download className="h-5 w-5 text-primary" />
          <span className="font-display font-black tracking-tight">Aplikasi PWA</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Instal {br.app_name || "KasirPintar"} sebagai aplikasi native di HP / desktop Anda untuk akses cepat & mode offline penuh.
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <InstalledBadge />
          <InstallButton variant="default" size="default" />
        </div>
      </Card>

      <Card className="p-5 border-border/70 space-y-3">
        <div className="flex items-center gap-2"><Store className="h-5 w-5 text-primary" /><span className="font-display font-black tracking-tight">Profil Toko</span></div>
        <div className="grid md:grid-cols-2 gap-3">
          <div><Label>Nama Toko</Label><Input value={store.name || ""} onChange={(e)=>setStore({...store, name:e.target.value})} data-testid="store-name" /></div>
          <div><Label>Telepon</Label><Input value={store.phone || ""} onChange={(e)=>setStore({...store, phone:e.target.value})} data-testid="store-phone" /></div>
          <div className="md:col-span-2"><Label>Alamat</Label><Input value={store.address || ""} onChange={(e)=>setStore({...store, address:e.target.value})} data-testid="store-address" /></div>
          <div className="md:col-span-2"><Label>Footer Struk</Label><Input value={store.footer || ""} onChange={(e)=>setStore({...store, footer:e.target.value})} data-testid="store-footer" /></div>
        </div>
        <Button onClick={saveStore} className="tap" data-testid="save-store">Simpan Profil</Button>
      </Card>

      <Card className="p-5 border-border/70 space-y-3" data-testid="ai-config-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="font-display font-black tracking-tight">Konfigurasi AI (Google Gemini)</span>
          </div>
          {gm.configured && <span className="text-xs flex items-center gap-1 text-emerald-600" data-testid="gm-status"><CheckCircle2 className="h-3 w-3" /> Terkonfigurasi</span>}
        </div>
        <p className="text-xs text-muted-foreground">
          Fitur AI (Scan Nota, Ringkasan Bisnis, Saran Bundling, Bot WhatsApp) menggunakan API key Google Gemini Anda sendiri (BYOK).
          Dapatkan key gratis di <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="underline text-primary">aistudio.google.com/apikey</a>.
          Key akan disimpan terenkripsi & hanya digunakan oleh akun toko Anda. Model aktif: <code className="text-[10px] bg-muted px-1 py-0.5 rounded">{gm.model}</code>.
        </p>
        <div>
          <Label>Gemini API Key {gm.configured && <span className="text-muted-foreground text-xs">(isi ulang untuk mengganti)</span>}</Label>
          <Input
            type="password"
            value={gm.api_key}
            onChange={(e)=>setGm({...gm, api_key:e.target.value})}
            placeholder={gm.configured ? "•••• tersimpan" : "AIza…"}
            data-testid="gm-key"
            autoComplete="new-password"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={saveGm} className="tap" data-testid="save-gm">
            Simpan API Key
          </Button>
          {gm.configured && (
            <>
              <Button onClick={testGm} variant="outline" className="tap" disabled={gmTesting} data-testid="test-gm">
                <TestTube2 className="h-4 w-4 mr-1" /> {gmTesting ? "Menguji…" : "Uji Key"}
              </Button>
              <Button onClick={clearGm} variant="ghost" className="tap text-red-600 hover:text-red-700" data-testid="clear-gm">
                <Trash2 className="h-4 w-4 mr-1" /> Hapus Key
              </Button>
            </>
          )}
        </div>
      </Card>

      <Card className="p-5 border-border/70 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" /><span className="font-display font-black tracking-tight">Midtrans QRIS</span></div>
          {mt.configured && <span className="text-xs flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-3 w-3" /> Terkonfigurasi</span>}
        </div>
        <p className="text-xs text-muted-foreground">
          Dapatkan kunci di dashboard.sandbox.midtrans.com (Sandbox) atau dashboard.midtrans.com (Produksi) → Settings → Access Keys.
        </p>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <Label>Mode</Label>
            <Select value={mt.mode} onValueChange={(v)=>setMt({...mt, mode:v})}>
              <SelectTrigger data-testid="mt-mode"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sandbox">Sandbox</SelectItem>
                <SelectItem value="production">Production</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Merchant ID</Label><Input value={mt.merchant_id || ""} onChange={(e)=>setMt({...mt, merchant_id:e.target.value})} data-testid="mt-merchant" /></div>
          <div><Label>Client Key</Label><Input value={mt.client_key || ""} onChange={(e)=>setMt({...mt, client_key:e.target.value})} data-testid="mt-client" /></div>
          <div>
            <Label>Server Key {mt.configured && <span className="text-muted-foreground text-xs">(diisi ulang untuk mengganti)</span>}</Label>
            <Input type="password" value={mt.server_key || ""} onChange={(e)=>setMt({...mt, server_key:e.target.value})}
                   placeholder={mt.configured ? "•••• tersimpan" : "SB-Mid-server-…"} data-testid="mt-server" />
          </div>
        </div>
        <Button onClick={saveMt} className="tap" data-testid="save-mt">Simpan Konfigurasi</Button>
      </Card>

      <Card className="p-5 border-border/70 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><MessageCircle className="h-5 w-5 text-primary" /><span className="font-display font-black tracking-tight">WhatsApp (Fonnte)</span></div>
          {fn.configured && <span className="text-xs flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-3 w-3" /> Terkonfigurasi</span>}
        </div>
        <p className="text-xs text-muted-foreground">
          Dapatkan device token di dashboard fonnte.com → Device. Token akan disimpan terenkripsi dan digunakan untuk mengirim struk / notifikasi WA.
        </p>
        <div>
          <Label>Device Token {fn.configured && <span className="text-muted-foreground text-xs">(isi ulang untuk mengganti)</span>}</Label>
          <Input type="password" value={fn.token} onChange={(e)=>setFn({...fn, token:e.target.value})}
                 placeholder={fn.configured ? "•••• tersimpan" : "Fonnte device token"} data-testid="fn-token" />
        </div>
        <Button onClick={saveFn} className="tap" data-testid="save-fn">Simpan Token WhatsApp</Button>
      </Card>

      <Card className="p-5 border-border/70 space-y-3">
        <div className="flex items-center gap-2"><Printer className="h-5 w-5 text-primary" /><span className="font-display font-black tracking-tight">Printer Bluetooth Thermal</span></div>
        <p className="text-xs text-muted-foreground">
          Menggunakan Web Bluetooth. Didukung Chrome/Edge di Android & desktop. Kompatibel printer ESC/POS 58mm / 80mm.
        </p>
        {!isBluetoothSupported() && (
          <div className="text-sm text-yellow-600">Peramban ini tidak mendukung Web Bluetooth. Struk akan otomatis dicetak via browser.</div>
        )}
        <div className="text-sm">
          Status: {printer ? <span className="text-emerald-600">Terhubung — {printer}</span> : <span className="text-muted-foreground">Belum terhubung</span>}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={doPair} variant="outline" className="tap" data-testid="pair-printer">
            <Bluetooth className="h-4 w-4 mr-1" /> Pairing Printer
          </Button>
          <Button onClick={doTest} className="tap" data-testid="test-print">
            <Printer className="h-4 w-4 mr-1" /> Uji Cetak
          </Button>
        </div>
      </Card>
    </div>
  );
}
