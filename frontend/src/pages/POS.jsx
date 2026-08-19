import { useEffect, useMemo, useRef, useState } from "react";
import api from "../lib/api";
import { formatIDR } from "../lib/format";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card } from "../components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "../components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Search, Plus, Minus, Trash2, ShoppingCart, Banknote, QrCode, Printer, X, Package, CheckCircle2, Barcode, CreditCard } from "lucide-react";
import { toast } from "sonner";
import QRISDialog from "../components/QRISDialog";
import { connectPrinter, printReceipt, printReceiptWeb, isBluetoothSupported } from "../lib/bluetooth";
import { cacheProducts, readCachedProducts, cacheStore, readCachedStore, queueTransaction, isOnline as checkOnline } from "../lib/offline";

export default function POS() {
  const [products, setProducts] = useState([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [payMode, setPayMode] = useState(null); // 'cash'|'qris'
  const [cashAmount, setCashAmount] = useState("");
  const [qrisOrderId, setQrisOrderId] = useState(null);
  const [store, setStore] = useState({});
  const [completedTx, setCompletedTx] = useState(null);
  const [shiftStatus, setShiftStatus] = useState({ open: true });
  const [appliedPromos, setAppliedPromos] = useState([]);
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [manualBarcode, setManualBarcode] = useState("");
  const [creditForm, setCreditForm] = useState({ name: "", phone: "" });
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const barcodeInputRef = useRef(null);
  const scanBufferRef = useRef({ chars: "", lastAt: 0 });
  const audioCtxRef = useRef(null);

  const load = async () => {
    try {
      const [pr, st, sh] = await Promise.all([api.get("/products"), api.get("/settings"), api.get("/shifts/current")]);
      setProducts(pr.data); cacheProducts(pr.data);
      setStore(st.data.store); cacheStore(st.data.store);
      setShiftStatus(sh.data);
    } catch {
      // Offline fallback
      const cached = await readCachedProducts();
      if (cached.length) {
        setProducts(cached);
        setStore(await readCachedStore());
        toast.warning("Mode Offline aktif - pakai data cache lokal", { duration: 3000 });
      }
    }
  };
  useEffect(() => { load(); }, []);

  // Track online/offline
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  // Physical barcode scanner: capture rapid keypress sequences ending with Enter
  const beep = () => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square"; osc.frequency.value = 1200;
      gain.gain.value = 0.15;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch {}
  };

  const lookupBarcode = async (code) => {
    const clean = (code || "").trim();
    if (clean.length < 2) return;
    try {
      const r = await api.get(`/products/by-sku/${encodeURIComponent(clean)}`);
      addToCart(r.data);
      beep();
      toast.success(`✓ ${r.data.name}`, { duration: 1500 });
    } catch {
      toast.error(`Produk dengan Barcode ${clean} tidak ditemukan`, { duration: 2200 });
    }
  };

  useEffect(() => {
    const onKey = async (e) => {
      // Ignore keys typed inside inputs/textareas EXCEPT the dedicated barcode input
      const tag = (e.target?.tagName || "").toLowerCase();
      const isBarcodeInput = e.target === barcodeInputRef.current;
      if (!isBarcodeInput && (tag === "input" || tag === "textarea" || e.target?.isContentEditable)) return;
      const now = Date.now();
      const buf = scanBufferRef.current;
      if (now - buf.lastAt > 100) buf.chars = "";
      buf.lastAt = now;
      if (e.key === "Enter") {
        const code = buf.chars.trim();
        buf.chars = "";
        if (code.length >= 2) {
          e.preventDefault();
          await lookupBarcode(code);
          // Refocus manual input so cashier can keep scanning
          barcodeInputRef.current?.focus();
          setManualBarcode("");
        }
        return;
      }
      if (e.key.length === 1 && /[a-zA-Z0-9\-_]/.test(e.key)) buf.chars += e.key;
    };
    window.addEventListener("keydown", onKey);
    // Autofocus the manual barcode input on mount
    setTimeout(() => barcodeInputRef.current?.focus(), 300);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products]);

  // Keep barcode input focused when user clicks anywhere in POS (except other inputs/buttons)
  useEffect(() => {
    const refocus = (e) => {
      const tag = (e.target?.tagName || "").toLowerCase();
      if (["input", "textarea", "button", "select", "a"].includes(tag)) return;
      if (e.target?.closest("[data-no-refocus]")) return;
      barcodeInputRef.current?.focus();
    };
    document.addEventListener("click", refocus);
    return () => document.removeEventListener("click", refocus);
  }, []);

  const categories = useMemo(() => ["all", ...Array.from(new Set(products.map(p => p.category)))], [products]);
  const filtered = useMemo(() => products.filter(p =>
    (cat === "all" || p.category === cat) &&
    (!q || p.name.toLowerCase().includes(q.toLowerCase()) || (p.sku || "").toLowerCase().includes(q.toLowerCase()))
  ), [products, q, cat]);

  const addToCart = (p) => {
    if (p.stock <= 0) { toast.error("Stok habis"); return; }
    setCart(c => {
      const exists = c.find(x => x.product_id === p.id);
      if (exists) {
        if (exists.qty + 1 > p.stock) { toast.error("Melebihi stok"); return c; }
        return c.map(x => x.product_id === p.id ? { ...x, qty: x.qty + 1 } : x);
      }
      return [...c, { product_id: p.id, name: p.name, qty: 1, price: p.sell_price, buy_price: p.buy_price, discount: 0, stock: p.stock }];
    });
  };

  const onBarcodeSubmit = async (e) => {
    e.preventDefault();
    if (!manualBarcode.trim()) return;
    await lookupBarcode(manualBarcode);
    setManualBarcode("");
    barcodeInputRef.current?.focus();
  };

  const changeQty = (pid, d) => setCart(c => c.map(x => x.product_id === pid ? { ...x, qty: Math.max(1, Math.min(x.stock, x.qty + d)) } : x));
  const removeItem = (pid) => setCart(c => c.filter(x => x.product_id !== pid));

  const subtotal = cart.reduce((s, x) => s + x.price * x.qty, 0);
  const totalDiscount = cart.reduce((s, x) => s + (x.discount || 0), 0) + promoDiscount;
  const total = Math.max(0, subtotal - totalDiscount);
  const change = Math.max(0, (Number(cashAmount) || 0) - total);

  // Preview promotions whenever cart changes
  useEffect(() => {
    let cancelled = false;
    if (cart.length === 0) { setPromoDiscount(0); setAppliedPromos([]); return; }
    (async () => {
      try {
        const r = await api.post("/promotions/preview", {
          items: cart.map(x => ({ product_id: x.product_id, name: x.name, qty: x.qty, price: x.price }))
        });
        if (cancelled) return;
        setPromoDiscount(r.data.total_discount || 0);
        setAppliedPromos(r.data.applied || []);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [cart]);

  const finishTx = async (method, extra = {}) => {
    const payload = {
      items: cart.map(({ product_id, name, qty, price, buy_price, discount }) => ({ product_id, name, qty, price, buy_price, discount })),
      subtotal, discount: totalDiscount, tax: 0, total,
      payment_method: method,
      cash_tendered: method === "cash" ? Number(cashAmount) || total : total,
      change: method === "cash" ? change : 0,
      applied_promos: appliedPromos,
      ...extra,
    };
    try {
      const r = await api.post("/transactions", payload);
      setCompletedTx(r.data);
      toast.success("Transaksi tersimpan!");
    } catch (e) {
      // Offline fallback for cash only (QRIS/credit need network)
      if (method === "cash" && !navigator.onLine) {
        const entry = await queueTransaction(payload);
        setCompletedTx({ ...payload,
          id: entry._local_id,
          order_id: `LOCAL-${Date.now()}`,
          created_at: new Date().toISOString(),
          _offline: true });
        toast.warning("Disimpan lokal. Akan sync otomatis saat online.", { duration: 3500 });
      } else {
        toast.error("Gagal simpan transaksi");
        return;
      }
    }
    setCart([]);
    setCashAmount("");
    setPayMode(null);
    setCartOpen(false);
    setCreditForm({ name: "", phone: "" });
    load();
  };

  const handlePrint = async () => {
    if (!completedTx) return;
    if (isBluetoothSupported()) {
      try {
        await printReceipt({ store, tx: completedTx });
        toast.success("Struk terkirim ke printer");
        return;
      } catch (e) {
        toast.error("Bluetooth gagal, gunakan cetak web.");
      }
    }
    printReceiptWeb({ store, tx: completedTx });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-black tracking-tighter">Kasir</h1>
          <p className="text-sm text-muted-foreground">Scan barcode fisik — atau ketik manual di kolom bawah.</p>
        </div>
        {!shiftStatus.open && (
          <a href="/shifts" className="text-xs px-3 py-1.5 rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-950/50 dark:text-yellow-300 border border-yellow-500/40" data-testid="shift-warning">
            ⚠ Shift belum dibuka
          </a>
        )}
      </div>

      {/* Dedicated barcode input — auto-focused, receives physical scanner input */}
      <form onSubmit={onBarcodeSubmit} className="sticky top-0 z-30 -mx-4 px-4 md:mx-0 md:px-0 py-2 bg-background/95 backdrop-blur">
        <div className="relative">
          <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-primary" />
          <Input
            ref={barcodeInputRef}
            value={manualBarcode}
            onChange={(e) => setManualBarcode(e.target.value)}
            placeholder="Scan atau Ketik Barcode/SKU Manual… (auto-focus)"
            className="pl-11 pr-4 h-12 text-base font-mono border-2 border-primary/40 focus:border-primary shadow-sm"
            data-testid="barcode-input"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      </form>

      <div className="grid lg:grid-cols-[1fr_380px] gap-4">
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Cari nama produk / SKU…"
                     className="pl-9" data-testid="pos-search" />
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {categories.map(c => (
              <button key={c} onClick={()=>setCat(c)} data-testid={`cat-${c}`}
                      className={`px-4 py-1.5 rounded-full text-xs uppercase tracking-widest font-medium whitespace-nowrap tap ${
                        cat === c ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                      }`}>
                {c === "all" ? "Semua" : c}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtered.map(p => (
              <Card key={p.id} onClick={()=>addToCart(p)}
                    data-testid={`product-${p.id}`}
                    className="cursor-pointer tap overflow-hidden border-border/70 hover:border-primary/60 hover:shadow-md">
                <div className="relative aspect-square bg-secondary/50">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <Package className="h-8 w-8" />
                    </div>
                  )}
                  {p.stock <= 5 && (
                    <Badge variant="destructive" className="absolute top-2 left-2 text-[10px]" data-testid={`low-${p.id}`}>
                      {p.stock <= 0 ? "Habis" : `Stok ${p.stock}`}
                    </Badge>
                  )}
                </div>
                <div className="p-3">
                  <div className="text-xs text-muted-foreground uppercase tracking-widest truncate">{p.category}</div>
                  <div className="text-sm font-medium line-clamp-2 min-h-[2.5rem]">{p.name}</div>
                  <div className="font-display font-black text-primary tracking-tight mt-1">{formatIDR(p.sell_price)}</div>
                </div>
              </Card>
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                Tidak ada produk ditemukan.
              </div>
            )}
          </div>
        </div>

        {/* Cart desktop */}
        <div className="hidden lg:block">
          <CartCard cart={cart} changeQty={changeQty} removeItem={removeItem}
                    subtotal={subtotal} total={total} onPay={() => setCartOpen(true)}
                    appliedPromos={appliedPromos} promoDiscount={promoDiscount} />
        </div>
      </div>

      <div className="lg:hidden fixed bottom-20 right-4 z-40">
        <Sheet open={cartOpen} onOpenChange={setCartOpen}>
          <SheetTrigger asChild>
            <Button size="lg" className="rounded-full shadow-2xl h-14 px-5 tap" data-testid="open-cart">
              <ShoppingCart className="h-5 w-5 mr-2" />
              {cart.length} item · {formatIDR(total)}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[90vh]">
            <SheetHeader><SheetTitle className="font-display">Keranjang</SheetTitle></SheetHeader>
            <CartCard cart={cart} changeQty={changeQty} removeItem={removeItem}
                      subtotal={subtotal} total={total} onPay={() => setPayMode("choose")} inSheet
                      appliedPromos={appliedPromos} promoDiscount={promoDiscount} />
          </SheetContent>
        </Sheet>
      </div>

      {/* Payment method modal (desktop uses same trigger) */}
      <Dialog open={payMode === "choose" || (cartOpen && cart.length > 0 && payMode === null && false)} onOpenChange={(o)=>!o && setPayMode(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Pilih Pembayaran</DialogTitle></DialogHeader>
          <div className="grid grid-cols-3 gap-3">
            <Button size="lg" onClick={()=>setPayMode("cash")} className="h-24 flex-col tap" data-testid="pay-cash-btn">
              <Banknote className="h-6 w-6 mb-1" /> Tunai
            </Button>
            <Button size="lg" variant="outline" onClick={()=>{setQrisOrderId(`TRX-${Date.now()}`); setPayMode("qris");}}
                    disabled={!online} className="h-24 flex-col tap relative" data-testid="pay-qris-btn">
              <QrCode className="h-6 w-6 mb-1" /> QRIS
              {!online && <span className="absolute -top-2 -right-2 text-[9px] bg-red-600 text-white rounded-full px-1.5 py-0.5">Butuh Internet</span>}
            </Button>
            <Button size="lg" variant="outline" onClick={()=>setPayMode("credit")}
                    disabled={!online} className="h-24 flex-col tap relative" data-testid="pay-credit-btn">
              <CreditCard className="h-6 w-6 mb-1" /> Bon/Kredit
              {!online && <span className="absolute -top-2 -right-2 text-[9px] bg-red-600 text-white rounded-full px-1.5 py-0.5">Butuh Internet</span>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cash dialog */}
      <Dialog open={payMode === "cash"} onOpenChange={(o)=>!o && setPayMode(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Bayar Tunai</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="text-center">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Total</div>
              <div className="font-display text-3xl font-black text-primary tracking-tight">{formatIDR(total)}</div>
            </div>
            <div>
              <label className="text-sm">Nominal Diterima</label>
              <Input type="number" value={cashAmount} onChange={(e)=>setCashAmount(e.target.value)}
                     placeholder="0" className="text-lg" data-testid="cash-input" />
              <div className="flex gap-2 mt-2 flex-wrap">
                {[total, 20000, 50000, 100000].map((v, i) => (
                  <button key={i} onClick={()=>setCashAmount(String(v))}
                          className="px-3 py-1 text-xs rounded-full bg-secondary tap">
                    {formatIDR(v)}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-between text-sm">
              <span>Kembalian</span>
              <span className="font-display font-black text-lg" data-testid="cash-change">{formatIDR(change)}</span>
            </div>
            <Button className="w-full tap" disabled={(Number(cashAmount)||0) < total}
                    onClick={()=>finishTx("cash")} data-testid="cash-confirm">
              <CheckCircle2 className="h-4 w-4 mr-2" /> Selesaikan Transaksi
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* QRIS dialog */}
      <QRISDialog open={payMode === "qris"} onOpenChange={(o)=>!o && setPayMode(null)}
                  amount={total} orderId={qrisOrderId || ""}
                  onPaid={(d) => finishTx("qris", { qris_order_id: qrisOrderId, qris_status: d.status })}
                  onCancel={()=>setPayMode(null)} />

      {/* Credit dialog */}
      <Dialog open={payMode === "credit"} onOpenChange={(o)=>!o && setPayMode(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Bayar dengan Bon / Kredit</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-center">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Utang</div>
              <div className="font-display text-3xl font-black text-destructive tracking-tight">{formatIDR(total)}</div>
            </div>
            <div>
              <label className="text-sm">Nama Pelanggan</label>
              <Input value={creditForm.name} onChange={(e)=>setCreditForm({...creditForm, name:e.target.value})}
                     placeholder="Bu Sari" data-testid="credit-name" />
            </div>
            <div>
              <label className="text-sm">Nomor WhatsApp (untuk pengingat)</label>
              <Input value={creditForm.phone} onChange={(e)=>setCreditForm({...creditForm, phone:e.target.value})}
                     placeholder="628..." data-testid="credit-phone" />
            </div>
            <Button className="w-full tap" disabled={!creditForm.name}
                    onClick={()=>finishTx("credit", { customer_name: creditForm.name, customer_phone: creditForm.phone })}
                    data-testid="credit-confirm">
              <CheckCircle2 className="h-4 w-4 mr-2" /> Catat sebagai Utang
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Completed */}
      <Dialog open={!!completedTx} onOpenChange={(o)=>!o && setCompletedTx(null)}>
        <DialogContent data-testid="tx-complete">
          <DialogHeader><DialogTitle className="font-display">Transaksi Selesai ✓</DialogTitle></DialogHeader>
          {completedTx && (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span>Order</span><span className="font-mono">{completedTx.order_id}</span></div>
              <div className="flex justify-between"><span>Total</span><span className="font-display font-black text-primary">{formatIDR(completedTx.total)}</span></div>
              {completedTx.change ? <div className="flex justify-between"><span>Kembalian</span><span>{formatIDR(completedTx.change)}</span></div> : null}
              <div className="flex gap-2 pt-2">
                <Button className="flex-1" onClick={handlePrint} data-testid="print-btn">
                  <Printer className="h-4 w-4 mr-2" /> Cetak Struk
                </Button>
                <Button variant="outline" onClick={()=>setCompletedTx(null)}>Tutup</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CartCard({ cart, changeQty, removeItem, subtotal, total, onPay, inSheet, appliedPromos = [], promoDiscount = 0 }) {
  return (
    <div className={inSheet ? "" : "sticky top-4 border border-border/70 rounded-lg bg-card"}>
      <div className={inSheet ? "space-y-3 mt-2" : "p-4 space-y-3"}>
        {!inSheet && <div className="font-display font-black tracking-tight">Keranjang</div>}
        <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
          {cart.length === 0 && <div className="text-sm text-muted-foreground text-center py-8">Belum ada item.</div>}
          {cart.map(x => (
            <div key={x.product_id} className="flex items-center gap-2 py-2 border-b border-border/50" data-testid={`cart-item-${x.product_id}`}>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{x.name}</div>
                <div className="text-xs text-muted-foreground">{formatIDR(x.price)}</div>
              </div>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="outline" className="h-7 w-7" onClick={()=>changeQty(x.product_id, -1)}><Minus className="h-3 w-3" /></Button>
                <span className="w-6 text-center text-sm font-semibold" data-testid={`qty-${x.product_id}`}>{x.qty}</span>
                <Button size="icon" variant="outline" className="h-7 w-7" onClick={()=>changeQty(x.product_id, 1)}><Plus className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={()=>removeItem(x.product_id)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
          ))}
        </div>
        <div className="pt-2 border-t border-border/60 space-y-1 text-sm">
          <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{formatIDR(subtotal)}</span></div>
          {appliedPromos.map((p, i) => (
            <div key={i} className="flex justify-between text-emerald-600 text-xs" data-testid={`applied-promo-${i}`}>
              <span>🎁 {p.name}</span>
              <span>{p.free_delivery ? "Gratis Ongkir" : `-${formatIDR(p.discount || 0)}`}</span>
            </div>
          ))}
          <div className="flex justify-between items-baseline">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Total</span>
            <span className="font-display font-black text-2xl text-primary tracking-tight" data-testid="cart-total">{formatIDR(total)}</span>
          </div>
        </div>
        <Button className="w-full h-12 tap font-semibold text-base" disabled={cart.length === 0}
                onClick={onPay} data-testid="pay-btn">
          <ShoppingCart className="h-5 w-5 mr-2" /> BAYAR
        </Button>
      </div>
    </div>
  );
}
