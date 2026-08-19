import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Download, X, Sparkles, Share, PlusSquare, Check, Smartphone } from "lucide-react";
import { toast } from "sonner";

const DISMISS_KEY = "kp_install_dismissed_at";

function isIOS() {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  return /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
}
function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)")?.matches ||
         window.navigator.standalone === true;
}

// Global state shared across hook uses
let _deferredPrompt = null;
const _listeners = new Set();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    _deferredPrompt = e;
    _listeners.forEach((fn) => fn());
  });
  window.addEventListener("appinstalled", () => {
    _deferredPrompt = null;
    _listeners.forEach((fn) => fn());
    localStorage.setItem("kp_installed", "1");
  });
}

export function useInstallPWA() {
  const [available, setAvailable] = useState(!!_deferredPrompt);
  const [standalone, setStandalone] = useState(isStandalone());
  useEffect(() => {
    const upd = () => setAvailable(!!_deferredPrompt);
    _listeners.add(upd);
    const mq = window.matchMedia?.("(display-mode: standalone)");
    const onChange = () => setStandalone(isStandalone());
    mq?.addEventListener?.("change", onChange);
    return () => { _listeners.delete(upd); mq?.removeEventListener?.("change", onChange); };
  }, []);
  const promptInstall = async () => {
    if (isIOS()) return "ios";
    if (!_deferredPrompt) return "unavailable";
    _deferredPrompt.prompt();
    const choice = await _deferredPrompt.userChoice;
    _deferredPrompt = null;
    _listeners.forEach((fn) => fn());
    return choice.outcome; // "accepted" | "dismissed"
  };
  return { available: available || isIOS(), standalone, promptInstall, isIOS: isIOS() };
}

export function InstallButton({ variant = "default", size = "sm", className = "" }) {
  const { available, standalone, promptInstall } = useInstallPWA();
  const [iosOpen, setIosOpen] = useState(false);
  if (standalone) return null;
  if (!available) return null;
  const onClick = async () => {
    const r = await promptInstall();
    if (r === "ios") setIosOpen(true);
    else if (r === "accepted") toast.success("Aplikasi berhasil diinstal!");
  };
  return (
    <>
      <Button variant={variant} size={size} onClick={onClick} className={`tap ${className}`} data-testid="install-app-btn">
        <Download className="h-4 w-4 mr-1" /> Instal Aplikasi
      </Button>
      <IOSGuideDialog open={iosOpen} onOpenChange={setIosOpen} />
    </>
  );
}

function IOSGuideDialog({ open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm" data-testid="ios-install-modal">
        <DialogHeader><DialogTitle className="font-display flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-primary" /> Instal di iPhone / iPad
        </DialogTitle></DialogHeader>
        <ol className="space-y-3 text-sm">
          <li className="flex gap-3">
            <span className="flex-shrink-0 h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-black text-xs">1</span>
            <div className="flex-1 flex items-center gap-2">
              Ketuk ikon <Share className="inline h-4 w-4 text-blue-500" /> <b>Bagikan (Share)</b> di bagian bawah Safari.
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-black text-xs">2</span>
            <div className="flex-1 flex items-center gap-2">
              Gulir ke bawah, pilih <PlusSquare className="inline h-4 w-4 text-blue-500" /> <b>"Tambah ke Layar Utama"</b> (Add to Home Screen).
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-black text-xs">3</span>
            <div className="flex-1">Ketuk <b>"Tambah"</b> di sudut kanan atas. Ikon KasirPintar akan muncul di layar utama Anda.</div>
          </li>
        </ol>
        <Button onClick={() => onOpenChange(false)} className="w-full tap mt-2" data-testid="ios-modal-close">Mengerti</Button>
      </DialogContent>
    </Dialog>
  );
}

export function InstalledBadge() {
  const { standalone } = useInstallPWA();
  if (!standalone) return null;
  return (
    <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-300" data-testid="installed-badge">
      <Check className="h-3 w-3" /> Aplikasi Terinstal (Mode Native App)
    </div>
  );
}

export default function InstallBanner() {
  const { available, standalone, promptInstall } = useInstallPWA();
  const [visible, setVisible] = useState(false);
  const [iosOpen, setIosOpen] = useState(false);

  useEffect(() => {
    if (standalone || !available) { setVisible(false); return; }
    const dismissed = Number(localStorage.getItem(DISMISS_KEY) || 0);
    // Show only if not dismissed in the last 24h
    if (Date.now() - dismissed > 24 * 3600 * 1000) {
      const t = setTimeout(() => setVisible(true), 2500);
      return () => clearTimeout(t);
    }
  }, [available, standalone]);

  if (!visible || standalone) return null;

  const install = async () => {
    const r = await promptInstall();
    if (r === "ios") { setIosOpen(true); return; }
    if (r === "accepted") {
      toast.success("Aplikasi berhasil diinstal! 🎉");
      setVisible(false);
    } else {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
      setVisible(false);
    }
  };
  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  return (
    <>
      <div className="fixed bottom-20 left-3 right-3 md:left-auto md:right-6 md:bottom-6 md:max-w-sm z-[70] animate-in fade-in slide-in-from-bottom-4"
           data-testid="install-banner">
        <div className="rounded-xl border-2 border-primary/40 bg-card shadow-2xl p-4 flex gap-3 items-start">
          <div className="h-11 w-11 rounded-lg bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display font-black tracking-tight text-sm">Instal KasirPintar AI</div>
            <div className="text-xs text-muted-foreground mt-0.5 mb-2 leading-relaxed">
              Instal di HP / PC Anda untuk akses cepat & fungsi offline!
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={install} className="tap flex-1" data-testid="install-now-btn">
                <Download className="h-3 w-3 mr-1" /> Instal Sekarang
              </Button>
              <Button size="sm" variant="ghost" onClick={dismiss} data-testid="install-later-btn">Nanti</Button>
            </div>
          </div>
          <button onClick={dismiss} className="text-muted-foreground hover:text-foreground -mt-1 -mr-1" aria-label="close">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <IOSGuideDialog open={iosOpen} onOpenChange={setIosOpen} />
    </>
  );
}
