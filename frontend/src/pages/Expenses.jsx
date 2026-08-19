import { useEffect, useState } from "react";
import api from "../lib/api";
import { formatIDR, formatDate } from "../lib/format";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Plus, Trash2, Receipt, TrendingDown, Wallet, Sparkles } from "lucide-react";
import { toast } from "sonner";

const CATS = ["Sewa Tempat", "Listrik & Air", "Kemasan", "Gaji", "Transport", "Marketing", "Lainnya"];

export default function Expenses() {
  const [items, setItems] = useState([]);
  const [np, setNp] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", category: "Lainnya", amount: 0, note: "" });

  const load = async () => {
    const [e, n] = await Promise.all([api.get("/expenses", { params: { days: 30 } }),
                                       api.get("/analytics/net-profit", { params: { days: 30 } })]);
    setItems(e.data); setNp(n.data);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name || !Number(form.amount)) { toast.error("Nama & nominal wajib"); return; }
    await api.post("/expenses", { ...form, amount: Number(form.amount) });
    toast.success("Pengeluaran tercatat");
    setOpen(false); setForm({ name: "", category: "Lainnya", amount: 0, note: "" }); load();
  };
  const del = async (id) => {
    if (!confirm("Hapus pengeluaran ini?")) return;
    await api.delete(`/expenses/${id}`); load();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-black tracking-tighter">Pengeluaran & Laba Bersih</h1>
          <p className="text-sm text-muted-foreground">Catat biaya operasional untuk melihat laba bersih sebenarnya.</p>
        </div>
        <Button onClick={() => setOpen(true)} className="tap" data-testid="add-expense-btn">
          <Plus className="h-4 w-4 mr-1" /> Catat Pengeluaran
        </Button>
      </div>

      {np && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatBox label="Pendapatan 30h" value={formatIDR(np.revenue)} tone="primary" />
          <StatBox label="HPP" value={formatIDR(np.hpp)} tone="muted" icon={Receipt} />
          <StatBox label="Biaya Operasional" value={formatIDR(np.operational_expenses)} tone="destructive" icon={TrendingDown} />
          <StatBox label="Laba Bersih Aktual" value={formatIDR(np.net_profit)} tone="emerald" icon={Sparkles} highlight />
        </div>
      )}

      <div>
        <div className="font-display font-black tracking-tight mb-2">Riwayat Pengeluaran (30 Hari)</div>
        <div className="space-y-2">
          {items.length === 0 && <div className="text-center py-6 text-sm text-muted-foreground">Belum ada pengeluaran dicatat.</div>}
          {items.map(e => (
            <Card key={e.id} className="p-3 flex items-center gap-3 border-border/70" data-testid={`expense-${e.id}`}>
              <div className="h-9 w-9 rounded-md bg-destructive/10 flex items-center justify-center flex-shrink-0">
                <Wallet className="h-4 w-4 text-destructive" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{e.name}</div>
                <div className="text-xs text-muted-foreground">{e.category} · {formatDate(e.date)}</div>
              </div>
              <div className="font-display font-black text-destructive">-{formatIDR(e.amount)}</div>
              <Button size="icon" variant="ghost" className="text-destructive" onClick={() => del(e.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </Card>
          ))}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent><DialogHeader><DialogTitle className="font-display">Catat Pengeluaran</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nama / Deskripsi</Label><Input value={form.name} onChange={(e)=>setForm({...form, name:e.target.value})} placeholder="Bayar listrik" data-testid="exp-name" /></div>
            <div>
              <Label>Kategori</Label>
              <Select value={form.category} onValueChange={(v)=>setForm({...form, category:v})}>
                <SelectTrigger data-testid="exp-cat"><SelectValue /></SelectTrigger>
                <SelectContent>{CATS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Nominal (Rp)</Label><Input type="number" value={form.amount} onChange={(e)=>setForm({...form, amount:e.target.value})} data-testid="exp-amt" /></div>
            <div><Label>Catatan</Label><Input value={form.note} onChange={(e)=>setForm({...form, note:e.target.value})} /></div>
            <Button onClick={save} className="w-full tap" data-testid="exp-save">Simpan</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatBox({ label, value, tone, icon: Icon, highlight }) {
  const toneClass = { primary: "text-primary", muted: "text-muted-foreground",
                       destructive: "text-destructive", emerald: "text-emerald-600" }[tone];
  return (
    <Card className={`p-4 border-border/70 ${highlight ? "border-emerald-500/40 bg-emerald-50/40 dark:bg-emerald-950/20" : ""}`}>
      <div className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-1">
        {Icon && <Icon className="h-3 w-3" />} {label}
      </div>
      <div className={`font-display font-black text-xl md:text-2xl tracking-tight mt-1 ${toneClass}`}>{value}</div>
    </Card>
  );
}
