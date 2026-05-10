import type { Txn, StockItem, PettyEntry } from "@/types";
import type { OpExEntry } from "@/types";

export interface BusinessSnapshot {
  txns: Txn[];
  stock: StockItem[];
  opex: OpExEntry[];
  petty: PettyEntry[];
  businessName: string;
}

export function buildSystemPrompt(data: BusinessSnapshot): string {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekStart = todayStart - 6 * 24 * 60 * 60 * 1000;

  const todayTxns = data.txns.filter((t) => t.ts >= todayStart);
  const weekTxns  = data.txns.filter((t) => t.ts >= weekStart);

  const todaySales    = todayTxns.filter(t => t.type === "in").reduce((s, t) => s + t.amount, 0);
  const weekSales     = weekTxns.filter(t => t.type === "in").reduce((s, t) => s + t.amount, 0);
  const weekExpenses  = weekTxns.filter(t => t.type === "out").reduce((s, t) => s + t.amount, 0);

  const todayOpex      = data.opex.filter(e => e.ts >= todayStart);
  const cogsToday      = todayOpex.filter(e => e.category === "Kos Bahan").reduce((s, e) => s + e.amount, 0);
  const utilitiToday   = todayOpex.filter(e => e.category === "Utiliti").reduce((s, e) => s + e.amount, 0);
  const bungkusToday   = todayOpex.filter(e => e.category === "Pembungkusan").reduce((s, e) => s + e.amount, 0);
  const gajiToday      = todayOpex.filter(e => e.category === "Gaji").reduce((s, e) => s + e.amount, 0);
  const transportToday = todayOpex.filter(e => e.category === "Pengangkutan").reduce((s, e) => s + e.amount, 0);
  const lainToday      = todayOpex.filter(e => e.category === "Lain-lain").reduce((s, e) => s + e.amount, 0);
  const totalOpex      = todayOpex.reduce((s, e) => s + e.amount, 0);

  const grossProfit    = todaySales - cogsToday;
  const netProfit      = grossProfit - (totalOpex - cogsToday);
  const grossMarginPct = todaySales > 0 ? ((grossProfit / todaySales) * 100).toFixed(1) : "0";
  const weekExpRatio   = weekSales > 0 ? ((weekExpenses / weekSales) * 100).toFixed(1) : "0";
  const pettyBalance   = data.petty[data.petty.length - 1]?.balance ?? 0;

  const lowStock = data.stock.filter(s => s.qty <= s.restockQty);
  const stockLines = data.stock.length > 0
    ? data.stock.map(s => `  ${s.emoji} ${s.name}: ${s.qty}${s.unit} (min restock: ${s.restockQty}${s.unit})${s.qty <= s.restockQty ? " ⚠️ RENDAH" : ""}`).join("\n")
    : "  (tiada stok direkod)";

  const lastSale = todayTxns.filter(t => t.type === "in").sort((a, b) => b.ts - a.ts)[0];
  const lastSaleHour = lastSale ? new Date(lastSale.ts).getHours() : -1;

  const warnings: string[] = [];
  if (weekSales > 0 && parseFloat(weekExpRatio) > 70)
    warnings.push(`⚠️ Nisbah perbelanjaan minggu ini ${weekExpRatio}% — terlalu tinggi (had: 70%)`);
  if (lowStock.length > 0)
    warnings.push(`⚠️ Stok hampir habis: ${lowStock.map(s => s.name).join(", ")}`);
  if (todaySales > 0 && lastSaleHour >= 0 && lastSaleHour < 14 && now.getHours() >= 14)
    warnings.push(`⚠️ Tiada jualan selepas 2PM hari ini`);
  if (pettyBalance < 20 && data.petty.length > 0)
    warnings.push(`⚠️ Baki Petty Cash rendah: RM ${pettyBalance.toFixed(2)}`);

  return `You are WarkahBiz AI, a friendly financial advisor for a Malaysian micro F&B business. Speak simple Malay. Be direct and specific with numbers. Use **bold** for important figures. End every reply with ONE recommendation starting with "💡 Cadangan:".

Perniagaan: ${data.businessName || "WarkahBiz"}
Tarikh: ${now.toLocaleDateString("ms-MY", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}

=== DATA HARI INI ===
Jualan Kasar:      RM ${todaySales.toFixed(2)}
Kos Bahan (COGS):  RM ${cogsToday.toFixed(2)}
Untung Kasar:      RM ${grossProfit.toFixed(2)} (margin: ${grossMarginPct}%)
Utiliti:           RM ${utilitiToday.toFixed(2)}
Pembungkusan:      RM ${bungkusToday.toFixed(2)}
Gaji:              RM ${gajiToday.toFixed(2)}
Pengangkutan:      RM ${transportToday.toFixed(2)}
Lain-lain:         RM ${lainToday.toFixed(2)}
JUMLAH KOS OPERASI: RM ${totalOpex.toFixed(2)}
Untung Bersih:     RM ${netProfit.toFixed(2)}

MINGGU INI:
Jualan: RM ${weekSales.toFixed(2)} | Perbelanjaan: RM ${weekExpenses.toFixed(2)} | Nisbah: ${weekExpRatio}%

STOK:
${stockLines}

PETTY CASH: RM ${pettyBalance.toFixed(2)}

${warnings.length > 0 ? `=== AMARAN AKTIF ===\n${warnings.join("\n")}` : "=== Tiada amaran — kewangan stabil ==="}

=== PERATURAN KIRAAN ===

1. P&L HARIAN — bila ditanya untung/rugi/P&L:
   Untung Kasar = Jualan Kasar − COGS
   Untung Bersih = Untung Kasar − Jumlah Kos Operasi (tidak termasuk COGS)
   Tunjuk pecahan lengkap.

2. BREAK-EVEN — bila ditanya modal balik/minimum jualan:
   Break-even Bulanan = Kos Tetap ÷ (Margin% / 100)
   Break-even Harian = Bulanan ÷ hari operasi
   Jika tiada data, anggar dari data hari ini.

3. MARGIN PRODUK — bila ditanya untung per unit/produk:
   Untung per Unit = Harga Jual − Jumlah Kos per Unit
   Margin% = (Untung ÷ Harga Jual) × 100

4. AMARAN CASH FLOW — semak SETIAP jawapan:
   Jika ada amaran aktif di atas, WAJIB sebut di hujung jawapan.`;
}