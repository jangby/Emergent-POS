// ESC/POS Bluetooth thermal printer helper
// Uses Web Bluetooth API

const PRINTER_SERVICE_UUIDS = [
  "000018f0-0000-1000-8000-00805f9b34fb", // common ESC/POS
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
];

let cachedDevice = null;
let cachedCharacteristic = null;

export const isBluetoothSupported = () =>
  typeof navigator !== "undefined" && !!navigator.bluetooth;

export async function connectPrinter() {
  if (!isBluetoothSupported()) throw new Error("Web Bluetooth tidak didukung di browser ini");
  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: PRINTER_SERVICE_UUIDS,
  });
  cachedDevice = device;
  const server = await device.gatt.connect();
  const services = await server.getPrimaryServices();
  let writeChar = null;
  for (const svc of services) {
    const chars = await svc.getCharacteristics();
    for (const c of chars) {
      if (c.properties.write || c.properties.writeWithoutResponse) {
        writeChar = c;
        break;
      }
    }
    if (writeChar) break;
  }
  if (!writeChar) throw new Error("Karakteristik write printer tidak ditemukan");
  cachedCharacteristic = writeChar;
  return { deviceName: device.name || "Bluetooth Printer" };
}

export function getConnectedPrinter() {
  if (cachedDevice && cachedDevice.gatt.connected) return cachedDevice.name;
  return null;
}

async function writeChunks(char, bytes) {
  const chunkSize = 100;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.slice(i, i + chunkSize);
    if (char.properties.writeWithoutResponse) {
      await char.writeValueWithoutResponse(chunk);
    } else {
      await char.writeValue(chunk);
    }
  }
}

// Build ESC/POS raw bytes for a receipt
function buildReceiptBytes({ store, tx }) {
  const enc = new TextEncoder();
  const parts = [];

  const ESC = 0x1b;
  const GS = 0x1d;

  parts.push(new Uint8Array([ESC, 0x40])); // init
  parts.push(new Uint8Array([ESC, 0x61, 0x01])); // center
  parts.push(new Uint8Array([ESC, 0x21, 0x30])); // double size
  parts.push(enc.encode((store?.name || "TOKO SAYA") + "\n"));
  parts.push(new Uint8Array([ESC, 0x21, 0x00])); // normal
  if (store?.address) parts.push(enc.encode(store.address + "\n"));
  if (store?.phone) parts.push(enc.encode(store.phone + "\n"));
  parts.push(enc.encode("--------------------------------\n"));

  parts.push(new Uint8Array([ESC, 0x61, 0x00])); // left
  parts.push(enc.encode(`No  : ${tx.order_id}\n`));
  parts.push(enc.encode(`Tgl : ${new Date(tx.created_at).toLocaleString("id-ID")}\n`));
  const cashierDisplay = tx.cashier_name || (tx.cashier || "").split("@")[0];
  if (cashierDisplay) parts.push(enc.encode(`Kasir: ${cashierDisplay}\n`));
  parts.push(enc.encode("--------------------------------\n"));

  const fmt = (n) => new Intl.NumberFormat("id-ID").format(Math.round(n || 0));
  for (const it of tx.items) {
    parts.push(enc.encode(`${it.name}\n`));
    const line = `  ${it.qty} x ${fmt(it.price)}`;
    const right = fmt(it.qty * it.price);
    const spaces = Math.max(1, 32 - line.length - right.length);
    parts.push(enc.encode(line + " ".repeat(spaces) + right + "\n"));
  }
  parts.push(enc.encode("--------------------------------\n"));

  const totalLine = (label, val) => {
    const right = "Rp" + fmt(val);
    const spaces = Math.max(1, 32 - label.length - right.length);
    return label + " ".repeat(spaces) + right + "\n";
  };
  parts.push(enc.encode(totalLine("Subtotal", tx.subtotal)));
  if (tx.discount) parts.push(enc.encode(totalLine("Diskon", -tx.discount)));
  if (tx.tax) parts.push(enc.encode(totalLine("Pajak", tx.tax)));

  parts.push(new Uint8Array([ESC, 0x21, 0x10])); // double height
  parts.push(enc.encode(totalLine("TOTAL", tx.total)));
  parts.push(new Uint8Array([ESC, 0x21, 0x00]));

  parts.push(enc.encode(totalLine("Bayar (" + tx.payment_method.toUpperCase() + ")", tx.cash_tendered || tx.total)));
  if (tx.change) parts.push(enc.encode(totalLine("Kembalian", tx.change)));

  parts.push(enc.encode("--------------------------------\n"));
  parts.push(new Uint8Array([ESC, 0x61, 0x01]));
  parts.push(enc.encode((store?.footer || "Terima Kasih") + "\n\n\n\n"));
  parts.push(new Uint8Array([GS, 0x56, 0x00])); // cut

  // concat
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

export async function printReceipt({ store, tx }) {
  if (!cachedCharacteristic || !cachedDevice?.gatt?.connected) {
    await connectPrinter();
  }
  const bytes = buildReceiptBytes({ store, tx });
  await writeChunks(cachedCharacteristic, bytes);
}

export async function printTest() {
  if (!cachedCharacteristic || !cachedDevice?.gatt?.connected) {
    await connectPrinter();
  }
  const enc = new TextEncoder();
  const bytes = new Uint8Array([
    0x1b, 0x40,
    ...enc.encode("KasirPintar AI\n"),
    ...enc.encode("Test Print OK ✓\n"),
    ...enc.encode(new Date().toLocaleString("id-ID") + "\n\n\n"),
    0x1d, 0x56, 0x00,
  ]);
  await writeChunks(cachedCharacteristic, bytes);
}

// Fallback: open a print-friendly window
export function printReceiptWeb({ store, tx }) {
  const fmt = (n) => "Rp" + new Intl.NumberFormat("id-ID").format(Math.round(n || 0));
  const win = window.open("", "_blank", "width=380,height=600");
  const html = `<!doctype html><html><head><title>${tx.order_id}</title>
    <style>
      body{font-family:monospace;font-size:12px;width:280px;margin:8px auto;color:#000}
      .c{text-align:center}.r{text-align:right}
      table{width:100%;border-collapse:collapse}
      td{padding:2px 0;vertical-align:top}
      hr{border:none;border-top:1px dashed #000}
      h1{font-size:16px;margin:0}
    </style></head><body>
    <div class="c"><h1>${store?.name || ""}</h1>
    <div>${store?.address || ""}</div><div>${store?.phone || ""}</div></div>
    <hr/>
    <div>No: ${tx.order_id}</div>
    <div>Tgl: ${new Date(tx.created_at).toLocaleString("id-ID")}</div>
    ${(tx.cashier_name || (tx.cashier || "").split("@")[0]) ? `<div>Kasir: ${tx.cashier_name || (tx.cashier || "").split("@")[0]}</div>` : ""}
    <hr/>
    <table>${tx.items.map(it => `
      <tr><td colspan="2">${it.name}</td></tr>
      <tr><td>${it.qty} x ${fmt(it.price)}</td><td class="r">${fmt(it.qty * it.price)}</td></tr>
    `).join("")}</table>
    <hr/>
    <table>
      <tr><td>Subtotal</td><td class="r">${fmt(tx.subtotal)}</td></tr>
      ${tx.discount ? `<tr><td>Diskon</td><td class="r">-${fmt(tx.discount)}</td></tr>` : ""}
      ${tx.tax ? `<tr><td>Pajak</td><td class="r">${fmt(tx.tax)}</td></tr>` : ""}
      <tr><td><b>TOTAL</b></td><td class="r"><b>${fmt(tx.total)}</b></td></tr>
      <tr><td>Bayar (${(tx.payment_method || "").toUpperCase()})</td><td class="r">${fmt(tx.cash_tendered || tx.total)}</td></tr>
      ${tx.change ? `<tr><td>Kembalian</td><td class="r">${fmt(tx.change)}</td></tr>` : ""}
    </table>
    <hr/><div class="c">${store?.footer || "Terima Kasih"}</div>
    <script>window.print();setTimeout(()=>window.close(),300);</script>
    </body></html>`;
  win.document.write(html);
  win.document.close();
}
