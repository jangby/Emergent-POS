import { useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { X } from "lucide-react";

export default function BarcodeScanner({ open, onOpenChange, onDetect }) {
  const scannerRef = useRef(null);
  const containerId = "barcode-reader-region";

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const start = async () => {
      try {
        const html5 = new Html5Qrcode(containerId, { verbose: false });
        scannerRef.current = html5;
        await html5.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 260, height: 160 } },
          (decodedText) => {
            if (cancelled) return;
            cancelled = true;
            html5.stop().then(() => html5.clear()).catch(() => {});
            onDetect(decodedText);
          },
          () => {}
        );
      } catch (e) {
        console.error("Scanner error:", e);
      }
    };
    start();
    return () => {
      cancelled = true;
      const s = scannerRef.current;
      if (s) {
        s.stop().then(() => s.clear()).catch(() => {});
      }
    };
  }, [open, onDetect]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm" data-testid="barcode-scanner">
        <DialogHeader>
          <DialogTitle className="font-display">Scan Barcode</DialogTitle>
        </DialogHeader>
        <div id={containerId} className="rounded-lg overflow-hidden bg-black min-h-[240px]"></div>
        <p className="text-xs text-muted-foreground">Arahkan kamera ke barcode produk (SKU).</p>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          <X className="h-4 w-4 mr-1" /> Tutup
        </Button>
      </DialogContent>
    </Dialog>
  );
}
