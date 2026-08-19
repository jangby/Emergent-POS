import { useEffect, useState } from "react";
import { WifiOff, Wifi, Loader2 } from "lucide-react";
import { queueSize, syncQueue, isOnline } from "../lib/offline";
import api from "../lib/api";
import { toast } from "sonner";

export default function OfflineIndicator() {
  const [online, setOnline] = useState(isOnline());
  const [qsize, setQsize] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const refresh = async () => setQsize(await queueSize());
    refresh();
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    const t = setInterval(refresh, 3000);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    if (online && qsize > 0 && !syncing) {
      (async () => {
        setSyncing(true);
        try {
          const r = await syncQueue(api);
          if (r.synced > 0) {
            toast.success(`Berhasil mengunggah ${r.synced} transaksi offline ke server!`, { duration: 4500 });
          }
          setQsize(await queueSize());
        } finally { setSyncing(false); }
      })();
    }
  }, [online, qsize, syncing]);

  return (
    <div
      className={`fixed top-3 right-3 z-[60] rounded-full shadow-lg px-3 py-1.5 text-xs font-medium flex items-center gap-2 border ${
        online
          ? "bg-emerald-500 border-emerald-600 text-white"
          : "bg-red-600 border-red-700 text-white pulse-slow"
      }`}
      data-testid="offline-indicator"
      title={online ? "Online" : "Offline - Transaksi Disimpan Lokal"}
    >
      {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> :
        online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
      <span>
        {syncing
          ? `Sinkronisasi ${qsize}…`
          : online
            ? (qsize > 0 ? `Online · ${qsize} antre` : "Online")
            : `Offline${qsize ? ` · ${qsize} tersimpan lokal` : " - Transaksi Disimpan Lokal"}`}
      </span>
    </div>
  );
}
