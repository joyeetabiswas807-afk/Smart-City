export const STATUS = {
  waterlogged:                { label: "Waterlogged",                icon: "💧", color: "#d64545" },
  verified_still_waterlogged: { label: "Verified still waterlogged", icon: "⚠",  color: "#8f1d2c" },
  reported_clear_pending:     { label: "Reported clear (pending)",   icon: "⏳", color: "#e0a100", dashed: true },
  clear:                      { label: "Clear",                      icon: "○",  color: "#6fb3a0" },
  verified_clear:             { label: "Verified clear",             icon: "✔",  color: "#2c8a4b" }
};
export const STATUS_ORDER = Object.keys(STATUS);

export const OUTCOME = {
  verified: { label: "Verified", color: "#2c8a4b" },
  rejected: { label: "Rejected", color: "#8a96a0" },
  pending:  { label: "Pending",  color: "#e0a100" }
};

export const DEPTHS = [
  { v: "none",  l: "None",   s: "cleared" },
  { v: "ankle", l: "Ankle",  s: "< 15 cm" },
  { v: "knee",  l: "Knee",   s: "15–50 cm" },
  { v: "waist", l: "Waist+", s: "> 50 cm" }
];
export const DEPTH_LABEL = Object.fromEntries(DEPTHS.map(d => [d.v, d.l]));
