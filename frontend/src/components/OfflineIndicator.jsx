import { useEffect, useState } from "react";
import { WifiOff, Wifi, Loader2 } from "lucide-react";
import { getQueue, syncQueue, isOnline } from "../lib/offline";
import api from "../lib/api";
import { toast } from "sonner";

export default function OfflineIndicator() {
  const [online, setOnline] = useState(isOnline());
  const [queue, setQueue] = useState(getQueue().length);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    const t = setInterval(() => setQueue(getQueue().length), 3000);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    if (online && queue > 0 && !syncing) {
      (async () => {
        setSyncing(true);
        try {
          const r = await syncQueue(api);
          if (r.synced > 0) toast.success(`${r.synced} transaksi offline tersinkron`);
          setQueue(getQueue().length);
        } finally { setSyncing(false); }
      })();
    }
  }, [online, queue, syncing]);

  if (online && queue === 0) return null;

  return (
    <div className={`fixed top-4 right-4 z-[60] rounded-full shadow-lg px-3 py-1.5 text-xs flex items-center gap-2 ${
      online ? "bg-emerald-600 text-white" : "bg-yellow-600 text-white"
    }`} data-testid="offline-indicator">
      {syncing ? <Loader2 className="h-3 w-3 animate-spin" /> : online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
      {online ? (syncing ? "Sinkronisasi…" : `${queue} menunggu sync`) : `Offline${queue ? ` · ${queue} antrean` : ""}`}
    </div>
  );
}
