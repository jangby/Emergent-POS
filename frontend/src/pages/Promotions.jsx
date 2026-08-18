import { useEffect, useState } from "react";
import api from "../lib/api";
import { formatIDR } from "../lib/format";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Switch } from "../components/ui/switch";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Plus, Tag, Trash2, Pencil, Gift, Percent } from "lucide-react";
import { toast } from "sonner";

const empty = { name: "", type: "percentage", value: 0, product_id: "", buy_qty: 0,
                get_product_id: "", get_qty: 0, min_purchase: 0, active: true };

export default function Promotions() {
  const [promos, setPromos] = useState([]);
  const [products, setProducts] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    const [p, pr] = await Promise.all([api.get("/promotions"), api.get("/products")]);
    setPromos(p.data); setProducts(pr.data);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name) return toast.error("Nama promo wajib");
    const payload = { ...form, value: Number(form.value) || 0,
                      buy_qty: Number(form.buy_qty) || 0, get_qty: Number(form.get_qty) || 0,
                      min_purchase: Number(form.min_purchase) || 0 };
    if (editing) await api.put(`/promotions/${editing}`, payload);
    else await api.post("/promotions", payload);
    toast.success(editing ? "Promo diperbarui" : "Promo dibuat");
    setOpen(false); setForm(empty); setEditing(null); load();
  };
  const remove = async (id) => {
    if (!confirm("Hapus promo ini?")) return;
    await api.delete(`/promotions/${id}`); toast.success("Terhapus"); load();
  };
  const toggle = async (p) => {
    await api.put(`/promotions/${p.id}`, { ...p, active: !p.active });
    load();
  };

  const productName = (id) => products.find(p => p.id === id)?.name || "-";

  const describe = (p) => {
    if (p.type === "percentage") return `${p.value}% ${p.product_id ? `untuk ${productName(p.product_id)}` : "seluruh belanja"}`;
    if (p.type === "fixed") return `${formatIDR(p.value)} ${p.product_id ? `untuk ${productName(p.product_id)}` : "seluruh belanja"}`;
    if (p.type === "bxgy") return `Beli ${p.buy_qty} ${productName(p.product_id)}, gratis ${p.get_qty} ${productName(p.get_product_id)}`;
    if (p.type === "min_purchase") return `Belanja min ${formatIDR(p.min_purchase)} → ${p.value > 0 ? `diskon ${formatIDR(p.value)}` : "gratis ongkir"}`;
    return p.type;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-black tracking-tighter">Promo & Diskon</h1>
          <p className="text-sm text-muted-foreground">Kelola aturan promosi otomatis (POS & WA Bot).</p>
        </div>
        <Button onClick={() => { setForm(empty); setEditing(null); setOpen(true); }} className="tap" data-testid="add-promo-btn">
          <Plus className="h-4 w-4 mr-1" /> Buat Promo
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {promos.length === 0 && <div className="col-span-full text-center py-12 text-muted-foreground">
          Belum ada promo. Buat aturan pertama Anda.
        </div>}
        {promos.map(p => (
          <Card key={p.id} className="p-4 border-border/70 space-y-2" data-testid={`promo-${p.id}`}>
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {p.type === "bxgy" ? <Gift className="h-4 w-4 text-primary" /> : <Percent className="h-4 w-4 text-primary" />}
                  <div className="font-semibold">{p.name}</div>
                  <Badge variant="outline" className="text-[10px] uppercase">{p.type}</Badge>
                </div>
                <div className="text-sm text-muted-foreground mt-1">{describe(p)}</div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={p.active} onCheckedChange={() => toggle(p)} data-testid={`toggle-${p.id}`} />
                <Button size="icon" variant="ghost" onClick={() => { setForm(p); setEditing(p.id); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-display">{editing ? "Edit Promo" : "Promo Baru"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nama Promo</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="promo-name" /></div>
            <div>
              <Label>Jenis</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger data-testid="promo-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Diskon Persen (%)</SelectItem>
                  <SelectItem value="fixed">Diskon Nominal (Rp)</SelectItem>
                  <SelectItem value="bxgy">Beli X Gratis Y</SelectItem>
                  <SelectItem value="min_purchase">Minimum Belanja</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(form.type === "percentage" || form.type === "fixed") && (
              <>
                <div>
                  <Label>{form.type === "percentage" ? "Persen (%)" : "Nominal (Rp)"}</Label>
                  <Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} data-testid="promo-value" />
                </div>
                <div>
                  <Label>Produk (kosong = seluruh belanja)</Label>
                  <Select value={form.product_id || "__all__"} onValueChange={(v) => setForm({ ...form, product_id: v === "__all__" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Seluruh belanja" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Seluruh belanja</SelectItem>
                      {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            {form.type === "bxgy" && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Beli Qty</Label><Input type="number" value={form.buy_qty} onChange={(e) => setForm({ ...form, buy_qty: e.target.value })} /></div>
                  <div><Label>Gratis Qty</Label><Input type="number" value={form.get_qty} onChange={(e) => setForm({ ...form, get_qty: e.target.value })} /></div>
                </div>
                <div>
                  <Label>Produk yang Dibeli</Label>
                  <Select value={form.product_id} onValueChange={(v) => setForm({ ...form, product_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Pilih produk" /></SelectTrigger>
                    <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Produk Gratis</Label>
                  <Select value={form.get_product_id} onValueChange={(v) => setForm({ ...form, get_product_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Pilih produk" /></SelectTrigger>
                    <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </>
            )}
            {form.type === "min_purchase" && (
              <>
                <div><Label>Minimum Belanja (Rp)</Label><Input type="number" value={form.min_purchase} onChange={(e) => setForm({ ...form, min_purchase: e.target.value })} /></div>
                <div><Label>Diskon (Rp) - kosong utk Gratis Ongkir</Label><Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></div>
              </>
            )}
            <Button onClick={save} className="w-full tap" data-testid="promo-save">Simpan Promo</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
