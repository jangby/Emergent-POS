import { useState, useEffect } from "react";
import api from "../lib/api";
import { formatIDR } from "../lib/format";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { MessageCircle, Sparkles, Loader2, Plus, Minus, Trash2, Send, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function WhatsAppOrder() {
  const [text, setText] = useState("");
  const [items, setItems] = useState([]);
  const [unmatched, setUnmatched] = useState([]);
  const [loading, setLoading] = useState(false);
  const [customer, setCustomer] = useState("");
  const [processing, setProcessing] = useState(false);

  const parse = async () => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const r = await api.post("/ai/parse-order", { text });
      setItems(r.data.items || []);
      setUnmatched(r.data.unmatched || []);
      if ((r.data.items || []).length === 0) toast.error("Tidak ada item terdeteksi.");
      else toast.success(`${r.data.items.length} item dikenali.`);
    } catch (e) {
      toast.error(e.response?.data?.detail || "AI gagal memproses pesan");
    } finally { setLoading(false); }
  };

  const changeQty = (idx, d) => setItems(l => l.map((x, i) => i === idx ? { ...x, qty: Math.max(1, x.qty + d) } : x));
  const remove = (idx) => setItems(l => l.filter((_, i) => i !== idx));

  const total = items.reduce((s, x) => s + x.qty * x.price, 0);

  const checkout = async () => {
    if (!items.length) return;
    setProcessing(true);
    try {
      const payload = {
        items: items.map(({ product_id, name, qty, price, buy_price }) => ({
          product_id, name, qty, price, buy_price, discount: 0
        })),
        subtotal: total, discount: 0, tax: 0, total,
        payment_method: "cash", cash_tendered: total, change: 0,
      };
      const r = await api.post("/transactions", payload);
      toast.success("Transaksi dicatat!");
      if (customer.trim()) {
        try {
          await api.post("/whatsapp/send-receipt", { target: customer, transaction_id: r.data.id });
          toast.success("Struk terkirim via WhatsApp!");
        } catch (e) {
          toast.error(e.response?.data?.detail || "Gagal kirim WA (cek konfigurasi Fonnte)");
        }
      }
      setItems([]); setText(""); setUnmatched([]); setCustomer("");
    } catch (e) {
      toast.error("Gagal menyimpan transaksi");
    } finally { setProcessing(false); }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="font-display text-3xl md:text-4xl font-black tracking-tighter">Pesanan WhatsApp</h1>
        <p className="text-sm text-muted-foreground">Tempel pesan pelanggan, AI akan otomatis mencocokkan produk & harga.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-5 border-border/70 space-y-3">
          <div className="flex items-center gap-2 font-display font-black tracking-tight">
            <MessageCircle className="h-5 w-5 text-primary" /> Pesan Pelanggan
          </div>
          <Textarea rows={8} placeholder={"Contoh:\nBu, mau pesan:\n- Indomie goreng 3 pcs\n- Kopi kapal api 5\n- Aqua botol 2"}
                    value={text} onChange={(e) => setText(e.target.value)} data-testid="wa-order-text" />
          <Button className="w-full tap" onClick={parse} disabled={loading || !text.trim()} data-testid="parse-order-btn">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Sparkles className="h-4 w-4 mr-2" /> Analisis dengan AI</>}
          </Button>
          <div className="space-y-2 pt-2">
            <Label>Nomor WhatsApp Pelanggan (opsional, untuk kirim struk)</Label>
            <Input placeholder="628123456789 atau 08123..." value={customer}
                   onChange={(e) => setCustomer(e.target.value)} data-testid="wa-customer" />
          </div>
        </Card>

        <Card className="p-5 border-border/70">
          <div className="flex items-center justify-between mb-3">
            <div className="font-display font-black tracking-tight">Item Terdeteksi</div>
            {items.length > 0 && <span className="text-xs text-muted-foreground">{items.length} produk</span>}
          </div>
          <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
            {items.length === 0 && <div className="text-center text-sm text-muted-foreground py-12">
              Belum ada. Analisis pesan dulu.
            </div>}
            {items.map((it, i) => (
              <div key={i} className="flex items-center gap-2 border border-border/60 rounded-md p-2" data-testid={`wa-item-${i}`}>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{it.name}</div>
                  <div className="text-xs text-muted-foreground">{formatIDR(it.price)} · stok {it.stock}</div>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => changeQty(i, -1)}><Minus className="h-3 w-3" /></Button>
                  <span className="w-6 text-center text-sm font-semibold">{it.qty}</span>
                  <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => changeQty(i, 1)}><Plus className="h-3 w-3" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove(i)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </div>
            ))}
            {unmatched.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border/60">
                <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Tidak Cocok</div>
                <div className="flex flex-wrap gap-1">
                  {unmatched.map((u, i) => <Badge key={i} variant="destructive" className="text-[10px]">{u}</Badge>)}
                </div>
              </div>
            )}
          </div>
          {items.length > 0 && (
            <>
              <div className="flex justify-between items-baseline pt-3 border-t border-border mt-3">
                <span className="text-xs uppercase tracking-widest text-muted-foreground">Total</span>
                <span className="font-display font-black text-2xl text-primary tracking-tight">{formatIDR(total)}</span>
              </div>
              <Button onClick={checkout} disabled={processing} className="w-full mt-3 tap" data-testid="wa-checkout">
                {processing ? <Loader2 className="h-4 w-4 animate-spin" /> :
                  <><CheckCircle2 className="h-4 w-4 mr-2" /> Buat Transaksi{customer ? " & Kirim Struk WA" : ""}</>}
              </Button>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
