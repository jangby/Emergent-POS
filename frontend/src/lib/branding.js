// Dynamic PWA branding: build a per-tenant manifest via Blob URL and update
// document title, theme-color, apple-touch-icon, favicon, and CSS variables.

export const DEFAULT_BRANDING = {
  app_name: "KasirPintar AI",
  short_name: "KasirPintar",
  theme_color: "#e85d04",
  logo_base64: "",
};

const FALLBACK_ICON_512 =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'>" +
      "<rect width='512' height='512' rx='96' fill='%COLOR%'/>" +
      "<path d='M150 118h54v122l100-122h64l-108 124 112 154h-64l-86-118-18 24v92h-54z' fill='white'/>" +
      "<circle cx='372' cy='156' r='26' fill='%23FCD34D'/>" +
    "</svg>"
  );

let _blobUrl = null;

function _svgFor(color) {
  const c = (color || "#e85d04").replace("#", "%23");
  return FALLBACK_ICON_512.replace("%COLOR%", c);
}

function _hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : { r: 232, g: 93, b: 4 };
}
function _lum({ r, g, b }) {
  const norm = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * norm(r) + 0.7152 * norm(g) + 0.0722 * norm(b);
}
export function contrastForeground(hex) {
  return _lum(_hexToRgb(hex)) > 0.55 ? "#111111" : "#ffffff";
}

function _upsertLink(rel, href, extraAttrs = {}) {
  let link = document.querySelector(`link[rel="${rel}"]`);
  if (!link) {
    link = document.createElement("link");
    link.rel = rel;
    document.head.appendChild(link);
  }
  Object.entries(extraAttrs).forEach(([k, v]) => link.setAttribute(k, v));
  link.href = href;
  return link;
}

function _upsertMeta(name, content) {
  let meta = document.querySelector(`meta[name="${name}"]`);
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = name;
    document.head.appendChild(meta);
  }
  meta.content = content;
  return meta;
}

/** Apply branding across the DOM: title, meta theme-color, favicon, apple-touch-icon,
 *  manifest (as Blob URL), and CSS custom properties. */
export function applyBranding(input) {
  const b = { ...DEFAULT_BRANDING, ...(input || {}) };
  const iconSrc = b.logo_base64 || _svgFor(b.theme_color);

  document.title = b.app_name;
  _upsertMeta("theme-color", b.theme_color);
  _upsertMeta("apple-mobile-web-app-title", b.short_name);

  document.documentElement.style.setProperty("--brand-color", b.theme_color);
  document.documentElement.style.setProperty("--brand-foreground", contrastForeground(b.theme_color));

  const manifest = {
    name: b.app_name,
    short_name: b.short_name,
    description: b.app_name,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#ffffff",
    theme_color: b.theme_color,
    lang: "id-ID",
    categories: ["business", "productivity", "finance"],
    icons: [
      { src: iconSrc, sizes: "192x192", type: b.logo_base64 ? "image/png" : "image/svg+xml", purpose: "any maskable" },
      { src: iconSrc, sizes: "512x512", type: b.logo_base64 ? "image/png" : "image/svg+xml", purpose: "any maskable" },
    ],
  };
  const blob = new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" });
  if (_blobUrl) URL.revokeObjectURL(_blobUrl);
  _blobUrl = URL.createObjectURL(blob);
  _upsertLink("manifest", _blobUrl);

  _upsertLink("icon", iconSrc, { type: b.logo_base64 ? "image/png" : "image/svg+xml" });
  _upsertLink("apple-touch-icon", iconSrc, { sizes: "180x180" });

  return b;
}

/** Client-side auto-crop to a centered 512x512 PNG data URL. */
export function cropLogoToSquare(file, size = 512) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        try {
          const side = Math.min(img.width, img.height);
          const canvas = document.createElement("canvas");
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
          resolve(canvas.toDataURL("image/png"));
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => reject(new Error("File tidak bisa dibaca sebagai gambar"));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error("Gagal membaca file"));
    reader.readAsDataURL(file);
  });
}
