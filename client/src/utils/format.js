export const fmtMoney = (n) =>
  Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtQty = (n) =>
  Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 3 });
