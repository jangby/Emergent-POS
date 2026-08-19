import { useEffect, useState } from "react";
import api from "../lib/api";
import { formatIDR, formatDate } from "../lib/format";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Plus, Users, Send, Phone, User, Wallet, Loader2, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [openNew, setOpenNew] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", note: "" });
  const [detail, setDetail] = useState(null);
  const [ledger, setLedger] = useState(null);
  const [payAmt, setPayAmt] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const r = await api.get("/customers");
    setCustomers(r.data);
  };
  useEffect(() => { load(); }, []);

  const openDetail = async (c) => {
    setDetail(c); setLedger(null);
    const r = await api.get(`/customers/${c.id}/ledger`);
    setLedger(r.data);
  };
  const save = async () => {
    if (!form.name) { toast.error("Nama wajib"); return; }
    await api.post("/customers", form);
    toast.success("Pelanggan disimpan"); setOpenNew(false); setForm({ name: "", phone: "", note: "" }); load();
  };
  const sendReminder = async (cid) => {
    setBusy(true);
    try {
      const r = await api.post(`/customers/${cid}/send-reminder`);
      toast.success(`Pengingat terkirim: ${formatIDR(r.data.amount)}`);
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal kirim WA"); }
    finally { setBusy(false); }
  };
  const payDebt = async () => {
    if (!detail || !payAmt) return;
    setBusy(true);
    try {
      await api.post(`/customers/${detail.id}/pay-debt`, { amount: Number(payAmt), method: "cash" });
      toast.success("Pembayaran tercatat");
      setPayAmt(""); openDetail(detail); load();
    } catch (e) { toast.error("Gagal"); }
    finally { setBusy(false); }
  };

  const totalDebt = customers.reduce((s, c) => s + (c.total_debt || 0), 0);

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-black tracking-tighter">Pelanggan & Utang</h1>
          <p className="text-sm text-muted-foreground">Kelola daftar bon dan kirim pengingat via WhatsApp.</p>
        </div>
        <Button onClick={() => setOpenNew(true)} className="tap" data-testid="add-customer-btn">
          <Plus className="h-4 w-4 mr-1" /> Tambah Pelanggan
        </Button>
      </div>

      <Card className="p-4 border-border/70 bg-gradient-to-br from-orange-50/50 to-transparent dark:from-orange-950/20" data-testid="total-debt-card">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
            <Wallet className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Total Piutang Aktif</div>
            <div className="font-display font-black text-2xl text-primary">{formatIDR(totalDebt)}</div>
          </div>
        </div>
      </Card>

      <div className="space-y-2">
        {customers.length === 0 && <div className="text-center py-8 text-muted-foreground text-sm">Belum ada pelanggan.</div>}
        {customers.map(c => (
          <Card key={c.id} className="p-4 border-border/70 flex items-center gap-3 hover:border-primary/40 cursor-pointer tap"
                onClick={() => openDetail(c)} data-testid={`customer-${c.id}`}>
            <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
              <User className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{c.name}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Phone className="h-3 w-3" /> {c.phone || "-"}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Utang</div>
              <div className={`font-display font-black ${c.total_debt > 0 ? "text-destructive" : "text-emerald-600"}`}>
                {formatIDR(c.total_debt || 0)}
              </div>
            </div>
            {c.total_debt > 0 && c.phone && (
              <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); sendReminder(c.id); }}
                      disabled={busy} data-testid={`reminder-${c.id}`}>
                <Send className="h-3 w-3 mr-1" /> WA
              </Button>
            )}
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Card>
        ))}
      </div>

      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent><DialogHeader><DialogTitle className="font-display">Pelanggan Baru</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nama</Label><Input value={form.name} onChange={(e)=>setForm({...form, name:e.target.value})} data-testid="cust-name" /></div>
            <div><Label>Nomor WhatsApp</Label><Input value={form.phone} onChange={(e)=>setForm({...form, phone:e.target.value})} placeholder="628..." data-testid="cust-phone" /></div>
            <div><Label>Catatan</Label><Input value={form.note} onChange={(e)=>setForm({...form, note:e.target.value})} /></div>
            <Button onClick={save} className="w-full tap" data-testid="cust-save">Simpan</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detail} onOpenChange={(o)=>!o && setDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="font-display">{detail?.name}</DialogTitle></DialogHeader>
          {ledger ? (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center border rounded-md p-3 bg-secondary/30">
                <div>
                  <div className="text-xs text-muted-foreground">Total Utang</div>
                  <div className="font-display font-black text-2xl text-destructive">{formatIDR(ledger.customer.total_debt)}</div>
                </div>
                {ledger.customer.total_debt > 0 && ledger.customer.phone && (
                  <Button onClick={() => sendReminder(detail.id)} disabled={busy} data-testid="detail-remind">
                    <Send className="h-4 w-4 mr-1" /> Kirim WA
                  </Button>
                )}
              </div>
              {ledger.customer.total_debt > 0 && (
                <div className="flex gap-2 items-end">
                  <div className="flex-1"><Label>Terima Pembayaran</Label>
                    <Input type="number" value={payAmt} onChange={(e)=>setPayAmt(e.target.value)} placeholder="0" data-testid="pay-amt" />
                  </div>
                  <Button onClick={payDebt} disabled={!payAmt || busy} data-testid="pay-btn">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Bayar"}
                  </Button>
                </div>
              )}
              <div className="border rounded-md divide-y max-h-64 overflow-y-auto">
                {ledger.entries.length === 0 && <div className="text-xs text-muted-foreground p-3 text-center">Belum ada catatan.</div>}
                {ledger.entries.map(e => (
                  <div key={e.id} className="flex items-center justify-between p-2 text-xs">
                    <div>
                      <Badge variant={e.type === "debit" ? "destructive" : "default"} className="text-[9px]">
                        {e.type === "debit" ? "UTANG" : "BAYAR"}
                      </Badge>
                      <span className="ml-2 text-muted-foreground">{formatDate(e.created_at)}</span>
                    </div>
                    <span className={`font-semibold ${e.type === "debit" ? "text-destructive" : "text-emerald-600"}`}>
                      {e.type === "debit" ? "+" : "-"}{formatIDR(e.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : <div className="text-center py-6"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
