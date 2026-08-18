import { useEffect, useState } from "react";
import api from "../lib/api";
import { formatIDR, formatDate } from "../lib/format";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Truck, CheckCircle2, MapPin, User, Phone, Package as Pkg, Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";

export default function OnlineOrders() {
  const [orders, setOrders] = useState([]);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get("/online-orders");
      setOrders(r.data);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, []);

  const markShipped = async (id) => {
    try {
      await api.post(`/online-orders/${id}/mark-shipped`);
      toast.success("Pesanan ditandai dikirim & stok terpotong");
      setDetail(null); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
  };
  const simulatePaid = async (id) => {
    try { await api.post(`/whatsapp/simulate-payment/${id}`); toast.success("Simulasi pembayaran berhasil"); load(); }
    catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
  };

  const statusBadge = (s) => {
    const map = {
      awaiting_payment: { label: "Menunggu Bayar", v: "secondary" },
      paid: { label: "Lunas - Menunggu Kirim", v: "default" },
      shipped: { label: "Dikirim", v: "outline" },
    };
    const c = map[s] || { label: s, v: "secondary" };
    return <Badge variant={c.v}>{c.label}</Badge>;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-black tracking-tighter">Pesanan Online</h1>
          <p className="text-sm text-muted-foreground">Pesanan otomatis dari bot WhatsApp.</p>
        </div>
        <Button variant="outline" onClick={load} className="tap" data-testid="refresh-orders">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
        </Button>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        {orders.length === 0 && <div className="col-span-full text-center py-16 text-muted-foreground">
          Belum ada pesanan online. Pesanan dari WA akan muncul di sini otomatis.
        </div>}
        {orders.map(o => (
          <Card key={o.id} onClick={() => setDetail(o)} className="p-4 tap border-border/70 cursor-pointer space-y-2" data-testid={`order-${o.id}`}>
            <div className="flex items-center justify-between">
              <div className="font-mono text-xs">#{o.id.slice(0,6).toUpperCase()}</div>
              {statusBadge(o.status)}
            </div>
            <div className="text-sm space-y-0.5">
              <div className="flex items-center gap-2"><User className="h-3 w-3 text-muted-foreground" />{o.customer_name || "-"}</div>
              <div className="flex items-center gap-2"><Phone className="h-3 w-3 text-muted-foreground" />{o.customer_phone}</div>
              <div className="flex items-start gap-2"><MapPin className="h-3 w-3 text-muted-foreground mt-1" /><span className="line-clamp-1">{o.address || "-"}</span></div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border/60">
              <span className="text-xs text-muted-foreground">{formatDate(o.created_at)}</span>
              <span className="font-display font-black text-primary">{formatIDR(o.total)}</span>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-display">Detail Pesanan</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">ID</span><span className="font-mono">#{detail.id.slice(0,6).toUpperCase()}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Status</span>{statusBadge(detail.status)}</div>
              <div className="border rounded-md p-3 space-y-1 bg-secondary/30">
                <div className="flex items-center gap-2"><User className="h-3 w-3" />{detail.customer_name}</div>
                <div className="flex items-center gap-2"><Phone className="h-3 w-3" />{detail.customer_phone}</div>
                <div className="flex items-start gap-2"><MapPin className="h-3 w-3 mt-1" />{detail.address}</div>
              </div>
              <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-1">
                {detail.items.map((it, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span>{it.qty}× {it.name}</span>
                    <span>{formatIDR(it.qty * it.price)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between font-display font-black text-primary text-lg">
                <span>Total</span><span>{formatIDR(detail.total)}</span>
              </div>
              <div className="flex gap-2">
                {detail.status === "awaiting_payment" && (
                  <Button variant="outline" className="flex-1 tap" onClick={() => simulatePaid(detail.id)} data-testid="simulate-paid">
                    <MessageCircle className="h-4 w-4 mr-1" /> Simulasi Bayar
                  </Button>
                )}
                {detail.status === "paid" && (
                  <Button className="flex-1 tap" onClick={() => markShipped(detail.id)} data-testid="mark-shipped">
                    <Truck className="h-4 w-4 mr-1" /> Tandai Dikirim
                  </Button>
                )}
                {detail.status === "shipped" && (
                  <div className="flex-1 text-center text-emerald-600 text-sm py-2 flex items-center justify-center gap-1">
                    <CheckCircle2 className="h-4 w-4" /> Sudah dikirim
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
