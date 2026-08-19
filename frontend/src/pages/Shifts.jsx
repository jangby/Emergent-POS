import { useEffect, useState } from "react";
import api from "../lib/api";
import { formatIDR, formatDate } from "../lib/format";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Play, Square, Download, Loader2, Wallet, TrendingUp, Users, Sun } from "lucide-react";
import { toast } from "sonner";
import { API_BASE } from "../lib/api";
import { useAuth } from "../context/AuthContext";

export default function Shifts() {
  const { user } = useAuth();
  const isOwner = user?.role === "owner";

  const [current, setCurrent] = useState({ open: false, today: null });
  const [history, setHistory] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [closeDialog, setCloseDialog] = useState(false);
  const [openingCash, setOpeningCash] = useState("");
  const [actualCash, setActualCash] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [c, h] = await Promise.all([api.get("/shifts/current"), api.get("/shifts")]);
    setCurrent(c.data); setHistory(h.data);
  };
  useEffect(() => { load(); const t = setInterval(load, 12000); return () => clearInterval(t); }, []);

  const doOpen = async () => {
    setBusy(true);
    try {
      await api.post("/shifts/open", { opening_cash: Number(openingCash) || 0 });
      toast.success("Shift dibuka");
      setOpenDialog(false); setOpeningCash(""); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
    finally { setBusy(false); }
  };
  const doClose = async () => {
    setBusy(true);
    try {
      const r = await api.post("/shifts/close", { closing_cash_actual: Number(actualCash) || 0, notes });
      const d = r.data.discrepancy || 0;
      toast.success(`Shift ditutup. Selisih: ${formatIDR(d)}`);
      setCloseDialog(false); setActualCash(""); setNotes(""); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
    finally { setBusy(false); }
  };

  const t = current.totals || {};
  const today = current.today || { revenue: 0, tx_count: 0, cash: 0, qris: 0 };
  const closedHistory = history.filter(s => s.status === "closed");

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-black tracking-tighter">
            {isOwner ? "Shift Kasir" : "Shift Saya"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isOwner ? "Semua shift kasir toko Anda." : "Buka & tutup kas untuk shift Anda hari ini."}
          </p>
        </div>
        {isOwner && (
          <a href={`${API_BASE}/exports/shifts.xlsx`} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" className="tap" data-testid="export-shifts">
              <Download className="h-4 w-4 mr-1" /> Export Excel
            </Button>
          </a>
        )}
      </div>

      {/* Today Sold summary — always visible so cashier sees performance instantly */}
      <Card className="p-5 border-border/70 bg-gradient-to-br from-primary/5 to-transparent" data-testid="today-sold-card">
        <div className="flex items-center gap-2 mb-3">
          <Sun className="h-4 w-4 text-primary" />
          <span className="text-xs uppercase tracking-widest text-muted-foreground">Terjual Hari Ini</span>
          {!isOwner && <span className="text-[10px] text-muted-foreground">(oleh Anda)</span>}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Total Penjualan" val={formatIDR(today.revenue)} highlight testid="today-revenue" />
          <Stat label="Jumlah Transaksi" val={today.tx_count} testid="today-tx-count" />
          <Stat label="Cash" val={formatIDR(today.cash)} icon={Wallet} testid="today-cash" />
          <Stat label="QRIS" val={formatIDR(today.qris)} icon={TrendingUp} testid="today-qris" />
        </div>
      </Card>

      <Card className={`p-5 border-border/70 space-y-3 ${current.open ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500/30" : ""}`}>
        <div className="flex items-center justify-between">
          <div className="font-display font-black tracking-tight text-lg">
            {current.open ? "Shift Aktif" : "Tidak ada shift aktif"}
          </div>
          {current.open ? (
            <Button variant="destructive" onClick={() => setCloseDialog(true)} className="tap" data-testid="close-shift-btn">
              <Square className="h-4 w-4 mr-1" /> Tutup Shift
            </Button>
          ) : (
            <Button onClick={() => setOpenDialog(true)} className="tap" data-testid="open-shift-btn">
              <Play className="h-4 w-4 mr-1" /> Buka Shift
            </Button>
          )}
        </div>
        {current.open && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
            <Stat label="Modal Awal" val={formatIDR(current.shift?.opening_cash)} />
            <Stat label="Kas Tunai" val={formatIDR(t.cash_total)} icon={Wallet} />
            <Stat label="QRIS" val={formatIDR(t.qris_total)} icon={TrendingUp} />
            <Stat label="Total Penjualan" val={formatIDR(t.grand_total)} highlight />
          </div>
        )}
      </Card>

      <div>
        <div className="font-display font-black tracking-tight mb-3">
          {isOwner ? "Riwayat Shift" : "Riwayat Shift Saya"}
        </div>
        <div className="space-y-2" data-testid="shift-history-list">
          {closedHistory.map(s => (
            <Card key={s.id} className="p-4 border-border/70" data-testid={`shift-${s.id}`}>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">{s.user_name || s.user_email}</span>
                  {isOwner && s.user_email !== s.user_name && (
                    <span className="text-[10px] text-muted-foreground">({s.user_email})</span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">{formatDate(s.opened_at)} → {formatDate(s.closed_at)}</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                <div><div className="text-muted-foreground uppercase tracking-widest">Modal</div><div className="font-semibold">{formatIDR(s.opening_cash)}</div></div>
                <div><div className="text-muted-foreground uppercase tracking-widest">Cash</div><div className="font-semibold">{formatIDR(s.totals?.cash_total)}</div></div>
                <div><div className="text-muted-foreground uppercase tracking-widest">QRIS</div><div className="font-semibold">{formatIDR(s.totals?.qris_total)}</div></div>
                <div><div className="text-muted-foreground uppercase tracking-widest">Aktual</div><div className="font-semibold">{formatIDR(s.closing_cash_actual)}</div></div>
                <div><div className="text-muted-foreground uppercase tracking-widest">Selisih</div>
                  <div className={`font-semibold ${(s.discrepancy||0) < 0 ? "text-destructive" : (s.discrepancy||0) > 0 ? "text-emerald-600" : ""}`}>
                    {formatIDR(s.discrepancy)}
                  </div></div>
              </div>
            </Card>
          ))}
          {closedHistory.length === 0 &&
            <div className="text-center text-sm text-muted-foreground py-8" data-testid="shift-empty">
              {isOwner ? "Belum ada shift ditutup." : "Anda belum menutup shift apa pun."}
            </div>}
        </div>
      </div>

      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent><DialogHeader><DialogTitle className="font-display">Buka Shift</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Modal Awal (Kas di Laci)</Label>
            <Input type="number" value={openingCash} onChange={(e) => setOpeningCash(e.target.value)}
                   placeholder="100000" data-testid="opening-cash-input" />
            <Button onClick={doOpen} disabled={busy} className="w-full tap" data-testid="open-shift-confirm">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Mulai Shift"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={closeDialog} onOpenChange={setCloseDialog}>
        <DialogContent><DialogHeader><DialogTitle className="font-display">Tutup Shift</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-sm space-y-1 border rounded-md p-3 bg-secondary/30">
              <div className="flex justify-between"><span>Modal Awal</span><span>{formatIDR(current.shift?.opening_cash)}</span></div>
              <div className="flex justify-between"><span>Kas Tunai Masuk</span><span>{formatIDR(t.cash_total)}</span></div>
              <div className="flex justify-between font-semibold border-t pt-1"><span>Kas Ekspektasi</span><span>{formatIDR((current.shift?.opening_cash || 0) + (t.cash_total || 0))}</span></div>
            </div>
            <Label>Kas Aktual di Laci</Label>
            <Input type="number" value={actualCash} onChange={(e) => setActualCash(e.target.value)}
                   placeholder="hitung kas fisik" data-testid="actual-cash-input" />
            <Label>Catatan (opsional)</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            <Button onClick={doClose} disabled={busy} className="w-full tap" data-testid="close-shift-confirm">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Tutup Shift"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, val, icon: Icon, highlight, testid }) {
  return (
    <div className={`rounded-md p-3 border border-border/60 ${highlight ? "bg-primary/10" : "bg-card"}`} data-testid={testid}>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1">
        {Icon && <Icon className="h-3 w-3" />} {label}
      </div>
      <div className={`font-display font-black tracking-tight ${highlight ? "text-primary" : ""}`}>{val}</div>
    </div>
  );
}
