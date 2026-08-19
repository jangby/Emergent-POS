import { useEffect, useState } from "react";
import api from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Sparkles, Loader2, Zap, ArrowRight, Package } from "lucide-react";
import { toast } from "sonner";

export default function Bundles() {
  const [suggestions, setSuggestions] = useState([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(null);
  const [applied, setApplied] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get("/ai/suggest-bundles");
      setSuggestions(r.data.suggestions || []);
      setNote(r.data.note || "");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Gagal minta saran AI");
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const apply = async (s, idx) => {
    setApplying(idx);
    try {
      await api.post("/ai/apply-bundle", {
        slow_id: s.slow_id, popular_id: s.popular_id,
        promo_name: s.promo_name, discount_pct: s.discount_pct || 10,
      });
      setApplied(a => [...a, idx]);
      toast.success(`Promo "${s.promo_name}" aktif!`);
    } catch (e) { toast.error("Gagal membuat promo"); }
    finally { setApplying(null); }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-black tracking-tighter">AI Bundling</h1>
          <p className="text-sm text-muted-foreground">AI merekomendasikan bundle untuk mengangkat produk yang lambat terjual.</p>
        </div>
        <Button onClick={load} disabled={loading} variant="outline" className="tap" data-testid="refresh-bundles">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Sparkles className="h-4 w-4 mr-1" /> Analisis Ulang</>}
        </Button>
      </div>

      {loading && <div className="text-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        <div className="text-sm text-muted-foreground mt-3">AI sedang menganalisis pola penjualan…</div></div>}

      {!loading && suggestions.length === 0 && (
        <Card className="p-8 text-center border-dashed">
          <Package className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
          <div className="text-sm text-muted-foreground">{note || "Belum ada saran bundle. Coba lagi setelah ada beberapa transaksi."}</div>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-3">
        {suggestions.map((s, i) => (
          <Card key={i} className="p-5 border-primary/30 space-y-3" data-testid={`bundle-${i}`}>
            <div className="flex items-start justify-between">
              <div>
                <Badge variant="outline" className="mb-1">AI</Badge>
                <div className="font-display font-black tracking-tight text-lg">{s.promo_name}</div>
              </div>
              <div className="flex items-center gap-1 text-primary">
                <Zap className="h-4 w-4" />
                <span className="font-display font-black">{s.discount_pct}%</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm bg-secondary/40 rounded-md p-3">
              <span className="flex-1 truncate">🔥 {s.popular_name}</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 truncate">🐢 {s.slow_name}</span>
            </div>
            {s.reason && <p className="text-xs text-muted-foreground italic">"{s.reason}"</p>}
            <Button className="w-full tap" onClick={() => apply(s, i)}
                    disabled={applying === i || applied.includes(i)} data-testid={`apply-bundle-${i}`}>
              {applied.includes(i) ? "✓ Promo Aktif" :
               applying === i ? <Loader2 className="h-4 w-4 animate-spin" /> :
               <><Sparkles className="h-4 w-4 mr-1" /> Terapkan ke POS & WA Bot</>}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
