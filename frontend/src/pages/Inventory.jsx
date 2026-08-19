import { useEffect, useRef, useState } from "react";
import api from "../lib/api";
import { formatIDR } from "../lib/format";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Plus, Pencil, Trash2, AlertTriangle, Search, Package, Upload, Loader2, ScanBarcode, Download, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import imageCompression from "browser-image-compression";
import BarcodeScanner from "../components/BarcodeScanner";
import { API_BASE } from "../lib/api";

const empty = { name: "", category: "", stock: 0, buy_price: 0, sell_price: 0, sku: "", image_url: "" };

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef(null);
  const excelRef = useRef(null);

  const load = async () => {
    const r = await api.get("/products");
    setItems(r.data);
  };
  useEffect(() => { load(); }, []);

  const onPickImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 0.4, maxWidthOrHeight: 800, useWebWorker: true, fileType: "image/jpeg", initialQuality: 0.75
      });
      const dataUrl = await imageCompression.getDataUrlFromFile(compressed);
      setForm(f => ({ ...f, image_url: dataUrl }));
      toast.success("Gambar diunggah");
    } catch (err) {
      toast.error("Gagal mengompres gambar");
    } finally { setUploading(false); }
  };

  const onImportExcel = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true); setImportResult(null);
    try {
      const fd = new FormData(); fd.append("file", file);
      const r = await api.post("/products/import", fd, { headers: { "Content-Type": "multipart/form-data" }});
      setImportResult(r.data);
      toast.success(`${r.data.created} baru · ${r.data.updated} diperbarui`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Gagal impor");
    } finally {
      setImporting(false);
      if (excelRef.current) excelRef.current.value = "";
    }
  };

  const save = async () => {
    const payload = {
      ...form,
      stock: Number(form.stock) || 0,
      buy_price: Number(form.buy_price) || 0,
      sell_price: Number(form.sell_price) || 0,
    };
    if (!payload.name || !payload.category) { toast.error("Nama & kategori wajib"); return; }
    if (editing) await api.put(`/products/${editing}`, payload);
    else await api.post("/products", payload);
    toast.success(editing ? "Produk diperbarui" : "Produk ditambahkan");
    setOpen(false); setForm(empty); setEditing(null); load();
  };
  const remove = async (id) => {
    if (!confirm("Hapus produk ini?")) return;
    await api.delete(`/products/${id}`);
    toast.success("Terhapus");
    load();
  };

  const filtered = items.filter(p => !q || p.name.toLowerCase().includes(q.toLowerCase()) || (p.sku || "").toLowerCase().includes(q.toLowerCase()));
  const lowCount = items.filter(p => p.stock <= 5).length;

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-black tracking-tighter">Produk</h1>
          <p className="text-sm text-muted-foreground">Kelola inventaris toko Anda.</p>
        </div>
        <Button onClick={()=>{setForm(empty); setEditing(null); setOpen(true);}} data-testid="add-product-btn" className="tap">
          <Plus className="h-4 w-4 mr-1" /> Tambah Produk
        </Button>
        <Button variant="outline" onClick={() => setImportOpen(true)} className="tap" data-testid="import-inv-btn">
          <FileSpreadsheet className="h-4 w-4 mr-1" /> Import Excel
        </Button>
        <a href={`${API_BASE}/exports/inventory.xlsx`} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" className="tap" data-testid="export-inv-btn">
            <Download className="h-4 w-4 mr-1" /> Export
          </Button>
        </a>
      </div>

      {lowCount > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-warning/30 bg-yellow-50 dark:bg-yellow-950/30" data-testid="low-stock-alert">
          <AlertTriangle className="h-5 w-5 text-yellow-600" />
          <div className="text-sm"><b>{lowCount}</b> produk stoknya menipis.</div>
        </div>
      )}

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e)=>setQ(e.target.value)} className="pl-9" placeholder="Cari…" data-testid="inv-search" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.map(p => (
          <Card key={p.id} className="p-3 flex gap-3 border-border/70" data-testid={`inv-${p.id}`}>
            <div className="w-20 h-20 rounded-md bg-secondary shrink-0 overflow-hidden">
              {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" /> :
                <div className="w-full h-full flex items-center justify-center text-muted-foreground"><Package className="h-6 w-6" /></div>}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">{p.category}</div>
              <div className="font-semibold truncate">{p.name}</div>
              <div className="flex items-center gap-2 flex-wrap mt-1">
                <span className="text-primary font-display font-black">{formatIDR(p.sell_price)}</span>
                <span className="text-xs text-muted-foreground">Modal {formatIDR(p.buy_price)}</span>
              </div>
              <div className="mt-1">
                {p.stock <= 5 ? (
                  <Badge variant="destructive" className="text-[10px]" data-testid={`stok-menipis-${p.id}`}>Stok Menipis · {p.stock}</Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px]">Stok {p.stock}</Badge>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Button size="icon" variant="ghost" onClick={()=>{setForm(p); setEditing(p.id); setOpen(true);}} data-testid={`edit-${p.id}`}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" className="text-destructive" onClick={()=>remove(p.id)} data-testid={`del-${p.id}`}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-display">{editing ? "Edit Produk" : "Tambah Produk"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nama</Label><Input value={form.name} onChange={(e)=>setForm({...form, name:e.target.value})} data-testid="form-name" /></div>
            <div><Label>Kategori</Label><Input value={form.category} onChange={(e)=>setForm({...form, category:e.target.value})} data-testid="form-cat" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Stok</Label><Input type="number" value={form.stock} onChange={(e)=>setForm({...form, stock:e.target.value})} data-testid="form-stock" /></div>
              <div>
                <Label>SKU/Barcode</Label>
                <div className="flex gap-1">
                  <Input value={form.sku || ""} onChange={(e)=>setForm({...form, sku:e.target.value})} data-testid="form-sku" />
                  <Button size="icon" variant="outline" type="button" onClick={()=>setScanOpen(true)} data-testid="form-scan-sku">
                    <ScanBarcode className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Harga Modal</Label><Input type="number" value={form.buy_price} onChange={(e)=>setForm({...form, buy_price:e.target.value})} data-testid="form-buy" /></div>
              <div><Label>Harga Jual</Label><Input type="number" value={form.sell_price} onChange={(e)=>setForm({...form, sell_price:e.target.value})} data-testid="form-sell" /></div>
            </div>
            <div>
              <Label>Gambar Produk</Label>
              <div className="flex items-center gap-3">
                <div className="w-20 h-20 rounded-md bg-secondary shrink-0 overflow-hidden border border-border/60">
                  {form.image_url ? <img src={form.image_url} alt="preview" className="w-full h-full object-cover" /> :
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground"><Package className="h-6 w-6" /></div>}
                </div>
                <div className="flex-1">
                  <Button type="button" variant="outline" onClick={()=>fileRef.current?.click()} disabled={uploading} className="w-full tap" data-testid="form-upload-img">
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Upload className="h-4 w-4 mr-1" /> Unggah Foto</>}
                  </Button>
                  <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onPickImage} className="hidden" />
                  <Input placeholder="atau tempel URL gambar" value={form.image_url && form.image_url.startsWith("http") ? form.image_url : ""}
                         onChange={(e)=>setForm({...form, image_url:e.target.value})} className="mt-2 text-xs" />
                </div>
              </div>
            </div>
            <Button onClick={save} className="w-full tap" data-testid="form-save">Simpan</Button>
          </div>
        </DialogContent>
      </Dialog>

      <BarcodeScanner open={scanOpen} onOpenChange={setScanOpen}
        onDetect={(code) => { setForm(f => ({...f, sku: code})); setScanOpen(false); toast.success(`SKU: ${code}`); }} />

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-display">Import Produk dari Excel</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Unggah file <b>.xlsx</b> berisi kolom: Nama, Kategori, SKU, Stok, Harga Modal, Harga Jual, URL Gambar.
              Produk dicocokkan berdasarkan SKU atau Nama. Yang sudah ada akan <b>diperbarui</b>, yang baru <b>dibuat</b>.
            </p>
            <a href={`${API_BASE}/products/import-template.xlsx`} target="_blank" rel="noopener noreferrer" className="text-primary text-sm hover:underline flex items-center gap-1" data-testid="import-template">
              <Download className="h-3 w-3" /> Unduh template Excel
            </a>
            <input ref={excelRef} type="file" accept=".xlsx"
                   onChange={onImportExcel} className="hidden" data-testid="import-file-input" />
            <Button className="w-full tap" disabled={importing}
                    onClick={() => excelRef.current?.click()} data-testid="import-pick-btn">
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> :
                <><Upload className="h-4 w-4 mr-1" /> Pilih File Excel</>}
            </Button>
            {importResult && (
              <div className="text-sm bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-500/30 rounded-md p-3 space-y-1" data-testid="import-result">
                <div>✓ <b>{importResult.created}</b> produk baru dibuat</div>
                <div>✓ <b>{importResult.updated}</b> produk diperbarui</div>
                {importResult.errors > 0 && (
                  <div className="text-destructive">⚠ {importResult.errors} baris error</div>
                )}
                {importResult.error_details?.length > 0 && (
                  <ul className="text-xs text-destructive list-disc pl-5">
                    {importResult.error_details.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
