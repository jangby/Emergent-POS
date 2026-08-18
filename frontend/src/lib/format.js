export const formatIDR = (v) =>
  "Rp" + new Intl.NumberFormat("id-ID").format(Math.round(v || 0));

export const formatIDRShort = (v) => {
  const n = Math.round(v || 0);
  if (n >= 1_000_000) return `Rp${(n / 1_000_000).toFixed(1)}jt`;
  if (n >= 1_000) return `Rp${(n / 1_000).toFixed(0)}rb`;
  return `Rp${n}`;
};

export const formatDate = (iso) => {
  try {
    return new Date(iso).toLocaleString("id-ID", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
};
