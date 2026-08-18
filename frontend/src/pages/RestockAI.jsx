import { useRef, useState } from "react";
import api from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { ScanLine, Upload, Loader2, Trash2, CheckCircle2, Camera } from "lucide-react";
import { toast } from "sonner";
import { formatIDR } from "../lib/format";

export default function RestockAI() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef();

  const onPick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setItems([]);
  };

  const scan = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await api.post("/ai/scan-receipt", fd, { headers: { "Content-Type": "multipart/form-data" } });
      const list = (r.data.items || []).map(x => ({ ...x, category: "Umum" }));
      setItems(list);
      if (!list.length) toast.error("AI tidak menemukan item. Coba foto yang lebih jelas.");
      else toast.success(`Ditemukan ${list.length} item.`);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Gagal memproses nota");
    } finally { setLoading(false); }
  };

  const update = (i, key, val) => setItems(l => l.map((x, idx) => idx === i ? { ...x, [key]: key === "name" || key === "category" ? val : Number(val) || 0 } : x));
  const remove = (i) => setItems(l => l.filter((_, idx) => idx !== i));

  const confirm = async () => {
    if (!items.length) return;
    try {
      const r = await api.post("/ai/confirm-restock", { items });
      toast.success(`Stok diperbarui: ${r.data.updated} produk, ${r.data.created} produk baru.`);
      setItems([]); setFile(null); setPreview(null);
    } catch (e) {
      toast.error("Gagal memperbarui stok");
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="font-display text-3xl md:text-4xl font-black tracking-tighter">Scan Nota Grosir</h1>
        <p className="text-sm text-muted-foreground">AI otomatis membaca nota belanja grosir Anda dan memperbarui stok.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-5 border-border/70 space-y-3">
          <div className="flex items-center gap-2 font-display font-black tracking-tight">
            <ScanLine className="h-5 w-5 text-primary" /> Unggah Nota
          </div>
          <div onClick={() => inputRef.current?.click()}
               className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/60 tap"
               data-testid="upload-area">
            {preview ? (
              <img src={preview} alt="preview" className="max-h-80 mx-auto rounded" />
            ) : (
              <>
                <Camera className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                <div className="text-sm">Klik untuk pilih foto / capture nota</div>
                <div className="text-xs text-muted-foreground mt-1">JPG, PNG, WEBP</div>
              </>
            )}
            <input ref={inputRef} type="file" accept="image/*" capture="environment"
                   onChange={onPick} className="hidden" data-testid="file-input" />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => inputRef.current?.click()} className="flex-1 tap" data-testid="pick-file">
              <Upload className="h-4 w-4 mr-1" /> Pilih Foto
            </Button>
            <Button disabled={!file || loading} onClick={scan} className="flex-1 tap" data-testid="scan-btn">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ScanLine className="h-4 w-4 mr-1" /> Scan dengan AI</>}
            </Button>
          </div>
        </Card>

        <Card className="p-5 border-border/70">
          <div className="flex items-center justify-between mb-3">
            <div className="font-display font-black tracking-tight">Review Item</div>
            {items.length > 0 && <span className="text-xs text-muted-foreground">{items.length} baris</span>}
          </div>
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {items.length === 0 && <div className="text-center text-sm text-muted-foreground py-12">
              Belum ada item. Unggah nota lalu scan.
            </div>}
            {items.map((it, i) => (
              <div key={i} className="border border-border/70 rounded-md p-2 space-y-2" data-testid={`review-item-${i}`}>
                <div className="flex gap-2 items-center">
                  <Input value={it.name} onChange={(e)=>update(i, "name", e.target.value)} placeholder="Nama produk" className="flex-1" />
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={()=>remove(i)}><Trash2 className="h-4 w-4" /></Button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div><label className="text-[10px] text-muted-foreground uppercase tracking-widest">Qty</label>
                    <Input type="number" value={it.qty} onChange={(e)=>update(i, "qty", e.target.value)} /></div>
                  <div><label className="text-[10px] text-muted-foreground uppercase tracking-widest">Harga/Unit</label>
                    <Input type="number" value={it.buy_price} onChange={(e)=>update(i, "buy_price", e.target.value)} /></div>
                  <div><label className="text-[10px] text-muted-foreground uppercase tracking-widest">Subtotal</label>
                    <div className="text-sm font-display font-black text-primary pt-2">{formatIDR(it.qty * it.buy_price)}</div></div>
                </div>
              </div>
            ))}
          </div>
          {items.length > 0 && (
            <Button onClick={confirm} className="w-full mt-4 tap" data-testid="confirm-restock">
              <CheckCircle2 className="h-4 w-4 mr-2" /> Konfirmasi Restock
            </Button>
          )}
        </Card>
      </div>
    </div>
  );
}
