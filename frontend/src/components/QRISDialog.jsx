import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "./ui/button";
import api from "../lib/api";
import { formatIDR } from "../lib/format";

export default function QRISDialog({ open, onOpenChange, amount, orderId, onPaid, onCancel }) {
  const [qrUrl, setQrUrl] = useState(null);
  const [status, setStatus] = useState("loading"); // loading, pending, settlement, expire, error
  const [error, setError] = useState(null);
  const [remaining, setRemaining] = useState(300);

  useEffect(() => {
    if (!open) return;
    setStatus("loading");
    setError(null);
    setQrUrl(null);
    setRemaining(300);
    (async () => {
      try {
        const r = await api.post("/payments/qris", { order_id: orderId, amount });
        setQrUrl(r.data.qr_url);
        setStatus(r.data.status || "pending");
      } catch (e) {
        setStatus("error");
        setError(e.response?.data?.detail || e.message);
      }
    })();
  }, [open, orderId, amount]);

  useEffect(() => {
    if (!open || status !== "pending") return;
    const t = setInterval(async () => {
      try {
        const r = await api.get(`/payments/qris/${orderId}/status`);
        setStatus(r.data.status || "pending");
        if (["settlement", "capture"].includes(r.data.status)) {
          clearInterval(t);
          onPaid?.(r.data);
        }
      } catch {}
    }, 3000);
    const c = setInterval(() => setRemaining((s) => Math.max(0, s - 1)), 1000);
    return () => { clearInterval(t); clearInterval(c); };
  }, [open, status, orderId, onPaid]);

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm" data-testid="qris-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Pembayaran QRIS</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-center">
            <div className="text-xs text-muted-foreground uppercase tracking-widest">Total</div>
            <div className="font-display text-3xl font-black text-primary tracking-tight" data-testid="qris-amount">
              {formatIDR(amount)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Order: {orderId}</div>
          </div>

          <div className="rounded-lg border border-border p-4 bg-white flex items-center justify-center min-h-[240px]">
            {status === "loading" && <Loader2 className="h-8 w-8 animate-spin text-primary" />}
            {status === "error" && (
              <div className="text-center text-sm text-destructive">
                <XCircle className="h-8 w-8 mx-auto mb-2" />
                Gagal: {String(error).slice(0, 200)}
              </div>
            )}
            {qrUrl && ["pending", "settlement", "capture"].includes(status) && (
              <img src={qrUrl} alt="QRIS" className="w-56 h-56 object-contain" data-testid="qris-image" />
            )}
          </div>

          {status === "pending" && (
            <div className="text-center">
              <div className="pulse-slow text-sm text-muted-foreground" data-testid="qris-status">
                Menunggu Pembayaran… ({mm}:{ss})
              </div>
            </div>
          )}
          {(status === "settlement" || status === "capture") && (
            <div className="text-center text-primary font-semibold flex items-center justify-center gap-2" data-testid="qris-success">
              <CheckCircle2 className="h-5 w-5" /> Pembayaran Berhasil
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onCancel} data-testid="qris-cancel">Batal</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
