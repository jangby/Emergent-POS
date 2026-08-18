import { useEffect, useMemo, useRef, useState } from "react";
import api from "../lib/api";
import { formatIDR } from "../lib/format";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Checkbox } from "../components/ui/checkbox";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "../components/ui/select";
import { Printer, Barcode as BarcodeIcon, Sparkles, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import JsBarcode from "jsbarcode";

export default function BarcodePrint() {
  const [products, setProducts] = useState([]);
  const [selected, setSelected] = useState({});
  const [qty, setQty] = useState({});
  const [q, setQ] = useState("");
  const [cols, setCols] = useState("3");
  const [generating, setGenerating] = useState(false);
  const printRef = useRef(null);

  const load = async () => {
    const r = await api.get("/products");
    setProducts(r.data);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => products.filter(p =>
    !q || p.name.toLowerCase().includes(q.toLowerCase()) || (p.sku || "").toLowerCase().includes(q.toLowerCase())
  ), [products, q]);

  const missingCount = products.filter(p => !p.sku).length;

  const generateSku = async () => {
    setGenerating(true);
    try {
      const r = await api.post("/products/generate-sku");
      toast.success(`${r.data.updated} produk kini punya SKU`);
      load();
    } catch { toast.error("Gagal generate SKU"); }
    finally { setGenerating(false); }
  };

  const toggle = (id) => setSelected(s => ({ ...s, [id]: !s[id] }));
  const setQtyFor = (id, v) => setQty(q => ({ ...q, [id]: Math.max(1, Number(v) || 1) }));
  const selectAll = () => {
    const map = {};
    filtered.forEach(p => { if (p.sku) map[p.id] = true; });
    setSelected(map);
  };
  const clearAll = () => setSelected({});

  const labels = useMemo(() => {
    const list = [];
    for (const p of products) {
      if (!selected[p.id] || !p.sku) continue;
      const n = qty[p.id] || 1;
      for (let i = 0; i < n; i++) list.push(p);
    }
    return list;
  }, [products, selected, qty]);

  // Render barcodes each render
  useEffect(() => {
    labels.forEach((p, i) => {
      const el = document.getElementById(`bc-${i}`);
      if (el) {
        try {
          JsBarcode(el, p.sku, {
            format: "CODE128", displayValue: true, fontSize: 10,
            height: 40, margin: 0, width: 1.4,
          });
        } catch {}
      }
    });
  }, [labels]);

  const doPrint = () => {
    if (labels.length === 0) { toast.error("Pilih produk dulu"); return; }
    window.print();
  };

  const totalSelected = Object.values(selected).filter(Boolean).length;

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 8px; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-black tracking-tighter">Cetak Label Barcode</h1>
          <p className="text-sm text-muted-foreground">Pilih produk, atur jumlah label, lalu cetak di kertas label / A4.</p>
        </div>
        {missingCount > 0 && (
          <Button variant="outline" onClick={generateSku} disabled={generating} className="tap" data-testid="gen-sku-btn">
            {generating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
            Generate SKU untuk {missingCount} produk
          </Button>
        )}
      </div>

      <Card className="no-print p-4 border-border/70 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e)=>setQ(e.target.value)} className="pl-9" placeholder="Cari produk…" data-testid="bc-search" />
          </div>
          <Button variant="outline" size="sm" onClick={selectAll} data-testid="bc-select-all">Pilih Semua</Button>
          <Button variant="outline" size="sm" onClick={clearAll}>Bersihkan</Button>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Kolom:</span>
            <Select value={cols} onValueChange={setCols}>
              <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="3">3</SelectItem>
                <SelectItem value="4">4</SelectItem>
                <SelectItem value="5">5</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1" />
          <Button onClick={doPrint} disabled={labels.length === 0} className="tap" data-testid="print-labels-btn">
            <Printer className="h-4 w-4 mr-1" /> Cetak ({labels.length} label)
          </Button>
        </div>

        <div className="border rounded-md divide-y max-h-80 overflow-y-auto">
          {filtered.map(p => (
            <label key={p.id} className="flex items-center gap-3 p-2 hover:bg-secondary/50 cursor-pointer" data-testid={`bc-row-${p.id}`}>
              <Checkbox checked={!!selected[p.id]} onCheckedChange={() => toggle(p.id)} disabled={!p.sku} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{p.name}</div>
                <div className="text-xs text-muted-foreground">{p.sku || <span className="text-destructive">Belum ada SKU</span>} · {formatIDR(p.sell_price)}</div>
              </div>
              {selected[p.id] && (
                <Input type="number" min="1" value={qty[p.id] || 1}
                  onChange={(e) => setQtyFor(p.id, e.target.value)}
                  onClick={(e) => e.preventDefault()}
                  className="w-16 text-sm" />
              )}
            </label>
          ))}
          {filtered.length === 0 && <div className="text-sm text-muted-foreground text-center py-6">Tidak ada produk.</div>}
        </div>
        <div className="text-xs text-muted-foreground">{totalSelected} produk dipilih · total {labels.length} label akan dicetak</div>
      </Card>

      <div id="print-area" ref={printRef}>
        <div className={`grid gap-2`} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {labels.map((p, i) => (
            <div key={i} className="border border-black/30 rounded p-2 text-center break-inside-avoid" style={{ pageBreakInside: "avoid" }}>
              <div className="text-[10px] font-semibold truncate">{p.name}</div>
              <svg id={`bc-${i}`} className="mx-auto"></svg>
              <div className="text-[11px] font-bold">{formatIDR(p.sell_price)}</div>
            </div>
          ))}
          {labels.length === 0 && (
            <div className="col-span-full text-center text-sm text-muted-foreground py-12 border border-dashed rounded">
              Pilih produk untuk pratinjau label barcode.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
