import { useEffect, useState } from "react";
import api from "../lib/api";
import { formatIDR, formatIDRShort } from "../lib/format";
import { Card } from "../components/ui/card";
import { Sparkles, TrendingUp, Wallet, ShoppingBag, Loader2 } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, BarChart, Bar } from "recharts";

export default function Analytics() {
  const [data, setData] = useState(null);
  const [insight, setInsight] = useState(null);
  const [loadingInsight, setLoadingInsight] = useState(false);

  useEffect(() => { (async () => {
    const r = await api.get("/analytics/summary"); setData(r.data);
  })(); }, []);

  const genInsight = async () => {
    setLoadingInsight(true);
    try { const r = await api.get("/ai/insights"); setInsight(r.data.insight); }
    finally { setLoadingInsight(false); }
  };

  if (!data) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const stats = [
    { label: "Hari Ini", value: formatIDR(data.today_revenue), icon: Wallet, color: "text-primary" },
    { label: "7 Hari", value: formatIDR(data.week_revenue), icon: TrendingUp, color: "text-emerald-600" },
    { label: "30 Hari", value: formatIDR(data.month_revenue), icon: ShoppingBag, color: "text-blue-600" },
    { label: "Laba 30 Hari", value: formatIDR(data.month_profit), icon: Sparkles, color: "text-purple-600" },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div>
        <h1 className="font-display text-3xl md:text-4xl font-black tracking-tighter">Analitik</h1>
        <p className="text-sm text-muted-foreground">Wawasan bisnis toko Anda.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s, i) => (
          <Card key={i} className="p-4 border-border/70" data-testid={`stat-${i}`}>
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
              <s.icon className={`h-4 w-4 ${s.color}`} /> {s.label}
            </div>
            <div className="font-display font-black text-xl md:text-2xl tracking-tight mt-2">{s.value}</div>
          </Card>
        ))}
      </div>

      {/* AI Insight */}
      <Card className="p-5 border-primary/30 bg-gradient-to-br from-orange-50/60 to-transparent dark:from-orange-950/20" data-testid="ai-insight-card">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="font-display font-black tracking-tight">Wawasan AI</span>
          </div>
          <button onClick={genInsight} disabled={loadingInsight}
                  className="text-xs uppercase tracking-widest text-primary hover:underline" data-testid="gen-insight-btn">
            {loadingInsight ? "Menganalisis…" : (insight ? "Perbarui" : "Buat Ringkasan")}
          </button>
        </div>
        {loadingInsight ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> AI sedang menganalisis…</div>
        ) : insight ? (
          <p className="text-sm leading-relaxed" data-testid="insight-text">{insight}</p>
        ) : (
          <p className="text-sm text-muted-foreground">Klik "Buat Ringkasan" untuk mendapatkan analisis penjualan dan saran otomatis.</p>
        )}
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5 border-border/70">
          <div className="font-display font-bold tracking-tight mb-3">Pendapatan vs Laba (30 Hari)</div>
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={data.daily_series} margin={{ left: 0, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatIDRShort(v)} width={55} />
                <Tooltip formatter={(v) => formatIDR(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                <Line type="monotone" dataKey="revenue" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} name="Pendapatan" />
                <Line type="monotone" dataKey="profit" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} name="Laba" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5 border-border/70">
          <div className="font-display font-bold tracking-tight mb-3">Top 5 Produk Terlaris</div>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={data.top_products} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={110} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                <Bar dataKey="qty" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Terjual" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}
