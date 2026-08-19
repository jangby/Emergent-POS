import { useEffect, useState } from "react";
import api from "../lib/api";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { toast } from "sonner";
import { Users, UserPlus, Trash2, KeyRound, ShieldCheck, ShoppingCart } from "lucide-react";

export default function Staff() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [pwForms, setPwForms] = useState({}); // {uid: password}

  const load = async () => {
    try {
      const r = await api.get("/users");
      setRows(r.data.filter((u) => u.role === "cashier"));
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal memuat daftar kasir");
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      toast.error("Nama, email, dan password wajib diisi");
      return;
    }
    if (form.password.length < 6) { toast.error("Password minimal 6 karakter"); return; }
    setCreating(true);
    try {
      await api.post("/users/cashier", { name: form.name.trim(), email: form.email.trim(), password: form.password });
      toast.success(`Kasir ${form.name} berhasil dibuat`);
      setForm({ name: "", email: "", password: "" });
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal membuat kasir");
    } finally { setCreating(false); }
  };

  const remove = async (uid, name) => {
    if (!window.confirm(`Hapus kasir "${name}"? Data transaksi mereka tetap tersimpan.`)) return;
    try {
      await api.delete(`/users/${uid}`);
      toast.success("Kasir dihapus");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal menghapus");
    }
  };

  const resetPw = async (uid, name) => {
    const pw = pwForms[uid];
    if (!pw || pw.length < 6) { toast.error("Password baru minimal 6 karakter"); return; }
    try {
      await api.put(`/users/${uid}`, { password: pw });
      toast.success(`Password ${name} berhasil direset`);
      setPwForms({ ...pwForms, [uid]: "" });
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal reset password");
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl md:text-4xl font-black tracking-tighter">Manajemen Staff</h1>
        <p className="text-sm text-muted-foreground">
          Buat akun kasir untuk staf toko Anda. Kasir hanya bisa mengakses layar POS dan buka/tutup shift — tidak bisa lihat analitik, ubah stok, atau ganti pengaturan.
        </p>
      </div>

      <Card className="p-5 border-border/70 space-y-4" data-testid="staff-create-card">
        <div className="flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-primary" />
          <span className="font-display font-black tracking-tight">Tambah Kasir Baru</span>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <Label>Nama Kasir</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                   placeholder="Budi" data-testid="staff-name" />
          </div>
          <div>
            <Label>Email Login</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                   placeholder="budi@toko.com" data-testid="staff-email" />
          </div>
          <div>
            <Label>Password</Label>
            <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                   placeholder="Min. 6 karakter" data-testid="staff-password" />
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5" /> Akun kasir hanya bisa: <ShoppingCart className="h-3 w-3 mx-1" /> Kasir + Shift + Riwayat sendiri
          </p>
          <Button onClick={create} disabled={creating} className="tap" data-testid="staff-create-btn">
            <UserPlus className="h-4 w-4 mr-1" /> {creating ? "Menyimpan…" : "Tambah Kasir"}
          </Button>
        </div>
      </Card>

      <Card className="p-5 border-border/70 space-y-3" data-testid="staff-list-card">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <span className="font-display font-black tracking-tight">Daftar Kasir ({rows.length})</span>
        </div>
        {loading && <div className="text-sm text-muted-foreground">Memuat…</div>}
        {!loading && rows.length === 0 && (
          <div className="text-sm text-muted-foreground py-6 text-center border border-dashed rounded-md">
            Belum ada kasir. Tambahkan kasir baru untuk mulai membagi tugas operasional toko.
          </div>
        )}
        <div className="space-y-2">
          {rows.map((u) => (
            <div key={u.id} className="border border-border/60 rounded-md p-3 flex flex-col md:flex-row md:items-center gap-3" data-testid={`staff-row-${u.id}`}>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{u.name}</div>
                <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                <div className="text-[10px] text-muted-foreground mt-1 uppercase tracking-widest">Kasir</div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Input type="password" placeholder="Reset password…" className="w-40"
                       value={pwForms[u.id] || ""}
                       onChange={(e) => setPwForms({ ...pwForms, [u.id]: e.target.value })}
                       data-testid={`staff-pw-${u.id}`} />
                <Button variant="outline" size="sm" onClick={() => resetPw(u.id, u.name)} data-testid={`staff-pw-save-${u.id}`}>
                  <KeyRound className="h-3.5 w-3.5 mr-1" /> Reset
                </Button>
                <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => remove(u.id, u.name)} data-testid={`staff-delete-${u.id}`}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Hapus
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
