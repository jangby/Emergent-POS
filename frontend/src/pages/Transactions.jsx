import { useEffect, useState } from "react";
import api from "../lib/api";
import { formatIDR, formatDate } from "../lib/format";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Search, Printer, Receipt, MessageCircle, Send, Download } from "lucide-react";
import { printReceipt, printReceiptWeb, isBluetoothSupported } from "../lib/bluetooth";
import { toast } from "sonner";
import { API_BASE } from "../lib/api";

export default function Transactions() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState(null);
  const [store, setStore] = useState({});
  const [waTarget, setWaTarget] = useState("");
  const [waSending, setWaSending] = useState(false);

  const load = async () => {
    const [t, s] = await Promise.all([api.get("/transactions", { params: { days: 30, q: q || undefined } }),
                                       api.get("/settings")]);
    setItems(t.data);
    setStore(s.data.store);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); /* eslint-disable-next-line */ }, [q]);

  const doPrint = async (tx) => {
    if (isBluetoothSupported()) {
      try { await printReceipt({ store, tx }); toast.success("Terkirim ke printer"); return; }
      catch { toast.error("Bluetooth gagal, cetak web."); }
    }
    printReceiptWeb({ store, tx });
  };

  const sendWA = async () => {
    if (!waTarget.trim() || !detail) return;
    setWaSending(true);
    try {
      await api.post("/whatsapp/send-receipt", { target: waTarget, transaction_id: detail.id });
      toast.success("Struk terkirim via WhatsApp");
      setWaTarget("");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Gagal kirim WA");
    } finally { setWaSending(false); }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-black tracking-tighter">Riwayat Transaksi</h1>
          <p className="text-sm text-muted-foreground">30 hari terakhir.</p>
        </div>
        <a href={`${API_BASE}/exports/transactions.xlsx?days=30`} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" className="tap" data-testid="export-tx-btn">
            <Download className="h-4 w-4 mr-1" /> Export Excel
          </Button>
        </a>
      </div>
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e)=>setQ(e.target.value)} className="pl-9" placeholder="Cari Order ID…" data-testid="trx-search" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map(t => (
          <Card key={t.id} className="p-4 flex items-center justify-between gap-3 border-border/70 tap"
                onClick={()=>setDetail(t)} data-testid={`trx-${t.id}`}>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-muted-foreground" />
                <span className="font-mono text-sm truncate">{t.order_id}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">{formatDate(t.created_at)}</div>
              <div className="flex gap-2 mt-1">
                <Badge variant={t.payment_method === "qris" ? "default" : "secondary"} className="text-[10px] uppercase">{t.payment_method}</Badge>
                <Badge variant={t.status === "completed" ? "outline" : "secondary"} className="text-[10px] uppercase">{t.status}</Badge>
              </div>
            </div>
            <div className="text-right">
              <div className="font-display font-black text-lg text-primary tracking-tight">{formatIDR(t.total)}</div>
              <div className="text-xs text-muted-foreground">{t.items.length} item</div>
            </div>
          </Card>
        ))}
        {items.length === 0 && <div className="col-span-full text-center py-12 text-muted-foreground">Belum ada transaksi.</div>}
      </div>

      <Dialog open={!!detail} onOpenChange={(o)=>!o && setDetail(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-display">Detail Transaksi</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-xs"><span>Order</span><span className="font-mono">{detail.order_id}</span></div>
              <div className="flex justify-between text-xs"><span>Tanggal</span><span>{formatDate(detail.created_at)}</span></div>
              <div className="border-t border-border pt-2 space-y-1 max-h-60 overflow-y-auto">
                {detail.items.map((it, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="truncate">{it.qty}× {it.name}</span>
                    <span>{formatIDR(it.qty * it.price)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between font-display font-black text-primary text-lg pt-2 border-t border-border">
                <span>Total</span><span>{formatIDR(detail.total)}</span>
              </div>
              <Button className="w-full tap" onClick={()=>doPrint(detail)} data-testid="reprint-btn">
                <Printer className="h-4 w-4 mr-2" /> Cetak Ulang Struk
              </Button>
              <div className="pt-2 border-t border-border/60 space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-widest">
                  <MessageCircle className="h-3 w-3" /> Kirim ke WhatsApp
                </div>
                <div className="flex gap-2">
                  <Input placeholder="628123..." value={waTarget} onChange={(e)=>setWaTarget(e.target.value)} data-testid="wa-target" />
                  <Button variant="outline" onClick={sendWA} disabled={!waTarget.trim() || waSending} data-testid="wa-send-btn">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
