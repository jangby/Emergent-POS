import { useEffect, useState } from "react";
import api from "../lib/api";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "../components/ui/select";
import { Printer, Bluetooth, Store, KeyRound, CheckCircle2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { connectPrinter, printTest, isBluetoothSupported, getConnectedPrinter } from "../lib/bluetooth";

export default function Settings() {
  const [store, setStore] = useState({ name: "", address: "", phone: "", footer: "" });
  const [mt, setMt] = useState({ mode: "sandbox", merchant_id: "", client_key: "", server_key: "", configured: false });
  const [fn, setFn] = useState({ token: "", configured: false });
  const [printer, setPrinter] = useState(getConnectedPrinter());

  useEffect(() => { (async () => {
    const r = await api.get("/settings");
    setStore(r.data.store);
    setMt({ ...r.data.midtrans, server_key: "" });
    setFn({ token: "", configured: !!r.data.fonnte?.configured });
  })(); }, []);

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

  const doPair = async () => {
    try { const r = await connectPrinter(); setPrinter(r.deviceName); toast.success(`Terhubung ke ${r.deviceName}`); }
    catch (e) { toast.error(e.message || "Gagal menghubungkan printer"); }
  };
  const doTest = async () => {
    try { await printTest(); toast.success("Uji cetak terkirim"); }
    catch (e) { toast.error(e.message || "Gagal cetak"); }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl md:text-4xl font-black tracking-tighter">Pengaturan</h1>
        <p className="text-sm text-muted-foreground">Profil toko, Midtrans, dan printer Bluetooth.</p>
      </div>

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
