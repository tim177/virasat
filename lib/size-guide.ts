// Body measurements (inches) for standard sizes. The first word of each size label matches the
// variant sizes in the catalogue ("M (US 8–10)" → "M"). Confirm with the tailor (plan Step 0).

export const womenSizeChart = [
  { size: "XS", us: "0–2", bust: 32, waist: 25, hip: 35 },
  { size: "S", us: "4–6", bust: 34, waist: 27, hip: 37 },
  { size: "M", us: "8–10", bust: 36, waist: 29, hip: 39 },
  { size: "L", us: "12–14", bust: 38, waist: 31, hip: 41 },
  { size: "XL", us: "16–18", bust: 40, waist: 33, hip: 43 },
] as const;

export const menSizeChart = [
  { size: "S", chest: 36, waist: 30 },
  { size: "M", chest: 38, waist: 32 },
  { size: "L", chest: 40, waist: 34 },
  { size: "XL", chest: 42, waist: 36 },
  { size: "XXL", chest: 44, waist: 38 },
] as const;
