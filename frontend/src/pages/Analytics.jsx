import { useEffect, useState } from "react";
import api from "../lib/api";
import { formatIDR, formatIDRShort } from "../lib/format";
import { Card } from "../components/ui/card";
import { Sparkles, TrendingUp, Wallet, ShoppingBag, Loader2, Trophy, Award, Medal, Users } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, BarChart, Bar } from "recharts";

export default function Analytics() {
  const [data, setData] = useState(null);
  const [insight, setInsight] = useState(null);
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [board, setBoard] = useState([]);

  useEffect(() => { (async () => {
    const [s, b] = await Promise.all([api.get("/analytics/summary"), api.get("/analytics/cashier-leaderboard")]);
    setData(s.data); setBoard(b.data);
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

  const rankIcon = (i) => {
    if (i === 0) return <Trophy className="h-6 w-6 text-yellow-500" fill="currentColor" />;
    if (i === 1) return <Award className="h-6 w-6 text-gray-400" fill="currentColor" />;
    if (i === 2) return <Medal className="h-6 w-6 text-amber-700" fill="currentColor" />;
    return <span className="w-6 text-center font-display font-black text-muted-foreground">#{i + 1}</span>;
  };
  const maxRev = Math.max(1, ...board.map(b => b.revenue));

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

      {/* Papan Kasir Harian */}
      <Card className="p-5 border-border/70 bg-gradient-to-br from-yellow-50/40 to-transparent dark:from-yellow-950/10" data-testid="leaderboard-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            <span className="font-display font-black tracking-tight">Papan Kasir Hari Ini</span>
          </div>
          <span className="text-xs text-muted-foreground uppercase tracking-widest">{board.length} kasir aktif</span>
        </div>
        {board.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm flex flex-col items-center gap-2">
            <Users className="h-8 w-8" />
            Belum ada transaksi hari ini. Ayo mulai jualan!
          </div>
        ) : (
          <div className="space-y-2">
            {board.map((b, i) => (
              <div key={b.cashier} className="flex items-center gap-3 p-3 rounded-md border border-border/60 bg-card"
                   data-testid={`leader-${i}`}>
                <div className="flex items-center justify-center w-8">{rankIcon(i)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="font-semibold truncate">{b.name}</div>
                    <div className="font-display font-black text-primary tracking-tight">{formatIDR(b.revenue)}</div>
                  </div>
                  <div className="relative h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all"
                         style={{ width: `${(b.revenue / maxRev) * 100}%` }} />
                  </div>
                  <div className="flex gap-3 mt-1 text-[10px] text-muted-foreground uppercase tracking-widest">
                    <span>{b.tx_count} tx</span>
                    <span>{b.items_sold} item</span>
                    <span>Cash {formatIDRShort(b.cash)}</span>
                    <span>QRIS {formatIDRShort(b.qris)}</span>
                    <span className="text-emerald-600">Laba {formatIDRShort(b.profit)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

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
