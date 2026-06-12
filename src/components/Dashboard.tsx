import React from "react";
import { 
  TrendingUp, 
  ShoppingBag, 
  AlertCircle, 
  DollarSign, 
  Wrench, 
  Star,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  Percent
} from "lucide-react";
import { Product, Sale, RepairOrder, UserProfile } from "../types";

interface DashboardProps {
  userProfile: UserProfile;
  products: Product[];
  sales: Sale[];
  repairs: RepairOrder[];
}

export default function Dashboard({ userProfile, products, sales, repairs }: DashboardProps) {
  
  // Date helpers
  const todayStr = new Date().toDateString();
  const currentMonthIdx = new Date().getMonth();
  const currentYearIdx = new Date().getFullYear();

  // 1. Filter metrics today
  const salesToday = sales.filter(s => new Date(s.fecha).toDateString() === todayStr);
  const revenueToday = salesToday.reduce((acc, curr) => acc + curr.subtotal, 0);
  const profitTodaySales = salesToday.reduce((acc, curr) => acc + curr.gananciaTotal, 0);

  const repairsToday = repairs.filter(r => r.fechaEntrega && new Date(r.fechaEntrega).toDateString() === todayStr);
  const profitTodayRepairs = repairsToday.reduce((acc, curr) => acc + (curr.reparacionGanancia || 0), 0);

  const totalRevenueTodayCombined = revenueToday + repairsToday.reduce((acc, r) => acc + (r.reparacionCobrado || 0), 0);
  const totalProfitTodayCombined = profitTodaySales + profitTodayRepairs;

  // 2. Filter metrics monthly
  const salesThisMonth = sales.filter(s => {
    const d = new Date(s.fecha);
    return d.getMonth() === currentMonthIdx && d.getFullYear() === currentYearIdx;
  });
  const revenueThisMonth = salesThisMonth.reduce((acc, curr) => acc + curr.subtotal, 0);
  const profitThisMonthSales = salesThisMonth.reduce((acc, curr) => acc + curr.gananciaTotal, 0);

  const repairsThisMonth = repairs.filter(r => {
    if (!r.fechaEntrega) return false;
    const d = new Date(r.fechaEntrega);
    return d.getMonth() === currentMonthIdx && d.getFullYear() === currentYearIdx;
  });
  const profitThisMonthRepairs = repairsThisMonth.reduce((acc, curr) => acc + (curr.reparacionGanancia || 0), 0);

  const totalRevenueThisMonthCombined = revenueThisMonth + repairsThisMonth.reduce((acc, r) => acc + (r.reparacionCobrado || 0), 0);
  const totalProfitThisMonthCombined = profitThisMonthSales + profitThisMonthRepairs;

  // 3. Products metrics
  const lowStockItems = products.filter(p => p.stockActual <= p.stockMinimo);
  const totalStockItemsSold = salesThisMonth.reduce((acc, s) => acc + s.items.reduce((a, item) => a + item.cantidad, 0), 0);

  // 4. Ticket Promedio
  const avgTicketSales = salesThisMonth.length > 0 ? (revenueThisMonth / salesThisMonth.length) : 0;

  // 5. Valoración de Inventario
  const totalInventoryCostValue = products.reduce((acc, p) => acc + (p.precioCosto * p.stockActual), 0);

  // 6. Top brand compatibles sold metrics (Samsung vs Motorola vs iPhone)
  const compatibleSalesMap: { [brand: string]: number } = {
    "Samsung": 0,
    "Motorola": 0,
    "iPhone": 0,
    "Xiaomi": 0,
    "Otros": 0
  };

  salesThisMonth.forEach(sale => {
    sale.items.forEach(item => {
      // Find item in products list to track its compatible Brand
      const origProd = products.find(p => p.id === item.productId);
      const compatBrand = origProd?.marcaCompatible ? origProd.marcaCompatible.toLowerCase() : "";
      
      if (compatBrand.includes("samsung")) {
        compatibleSalesMap["Samsung"] += item.cantidad;
      } else if (compatBrand.includes("motorola") || compatBrand.includes("moto")) {
        compatibleSalesMap["Motorola"] += item.cantidad;
      } else if (compatBrand.includes("iphone") || compatBrand.includes("apple") || compatBrand.includes("ios")) {
        compatibleSalesMap["iPhone"] += item.cantidad;
      } else if (compatBrand.includes("xiaomi") || compatBrand.includes("redmi")) {
        compatibleSalesMap["Xiaomi"] += item.cantidad;
      } else {
        compatibleSalesMap["Otros"] += item.cantidad;
      }
    });
  });

  const topBrandData = Object.entries(compatibleSalesMap).map(([name, value]) => ({ name, value }));

  // 7. Earnings by Category
  const categoryGainsMap: { [cat: string]: number } = {};
  salesThisMonth.forEach(sale => {
    sale.items.forEach(item => {
      const p = products.find(prod => prod.id === item.productId);
      const category = p?.categoria || "Varias";
      const itemProfit = (item.precioVenta - item.precioCosto) * item.cantidad;
      categoryGainsMap[category] = (categoryGainsMap[category] || 0) + itemProfit;
    });
  });

  // Include repairs gain as a category under Dashboard
  categoryGainsMap["Servicio Técnico"] = profitThisMonthRepairs;

  const categoryGainsData = Object.entries(categoryGainsMap).map(([name, value]) => ({ name, value }));

  // Formatter currency helper
  const formatMoney = (val: number) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 0
    }).format(val);
  };

  return (
    <div className="space-y-6">
      
      {/* Greetings banner header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900 text-white p-6 rounded-3xl overflow-hidden relative">
        <div className="absolute right-0 bottom-0 h-40 w-40 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="space-y-1">
          <h1 className="text-xl font-black tracking-tight flex items-center gap-2 leading-none">
            Hola, {userProfile.displayName || userProfile.email || "Usuario del Sistema"}
            <span className="text-[12px] bg-indigo-600 font-extrabold px-2.5 py-1 rounded-full uppercase scale-90">
              ★ {userProfile.role}
            </span>
          </h1>
          <p className="text-xs text-slate-400">Este es el panel gerencial unificado de ventas, stock y reparaciones.</p>
        </div>
        
        <div className="shrink-0 text-xs border border-slate-800 bg-slate-950/40 p-3 rounded-xl flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-semibold text-slate-300">Base Activa Offline/Online sincronizada</span>
        </div>
      </div>

      {/* Numerical cards Grid row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Sales Daily */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl shrink-0">
            <DollarSign size={20} />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Facturación Hoy</div>
            <div className="text-xl font-black text-slate-900 mt-0.5 font-mono">{formatMoney(totalRevenueTodayCombined)}</div>
            <span className="text-[10px] text-emerald-500 mt-1 block font-bold">+ {formatMoney(totalProfitTodayCombined)} ganancias</span>
          </div>
        </div>

        {/* Sales Monthly */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
            <TrendingUp size={20} />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Ventas de este mes</div>
            <div className="text-xl font-black text-slate-900 mt-0.5 font-mono">{formatMoney(totalRevenueThisMonthCombined)}</div>
            <span className="text-[10px] text-emerald-500 mt-1 block font-bold">+ {formatMoney(totalProfitThisMonthCombined)} ganancias</span>
          </div>
        </div>

        {/* Quantities alerts */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-rose-50 text-rose-500 rounded-xl shrink-0">
            <AlertCircle size={20} />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Poco Stock / Alerta</div>
            <div className="text-xl font-black text-slate-900 mt-0.5 font-mono">{lowStockItems.length} <span className="text-xs text-slate-400 font-normal">items</span></div>
            <span className="text-[10px] text-rose-450 mt-1 block font-bold">Requieren reposición</span>
          </div>
        </div>

        {/* Average ticket */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-500 rounded-xl shrink-0">
            <Star size={20} />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Consumo Ticket Promedio</div>
            <div className="text-xl font-black text-slate-900 mt-0.5 font-mono">{formatMoney(avgTicketSales)}</div>
            <span className="text-[10px] text-slate-400 mt-1 block">Por compra mensual de POS</span>
          </div>
        </div>

      </div>

      {/* Visual Analytics section with custom charts widgets (Section 12 & 13) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Category profits graphic */}
        <div className="lg:col-span-12 xl:col-span-8 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-50">
            <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5 leading-none">
              <Layers size={16} className="text-indigo-600" />
              Rendimiento de Ganancia por Categorías y Servicio Técnico
            </h3>
            <span className="text-[10px] font-bold uppercase bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Mensual</span>
          </div>

          {categoryGainsData.length === 0 ? (
            <p className="p-8 text-center text-slate-400 text-xs">Cargá ventas para reflejar distribución.</p>
          ) : (
            <div className="space-y-3 pt-2">
              {categoryGainsData.map(c => {
                const maxGain = Math.max(...categoryGainsData.map(d => d.value), 1);
                const percent = (c.value / maxGain) * 100;
                return (
                  <div key={c.name} className="space-y-1">
                    <div className="flex justify-between text-xs font-bold text-slate-700">
                      <span className="uppercase text-slate-600">{c.name}</span>
                      <span>{formatMoney(c.value)}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Brand Compatibles chart distribution (Section 12) */}
        <div className="lg:col-span-12 xl:col-span-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-50">
              <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5 leading-none">
                <Percent size={16} className="text-emerald-500" />
                Venta por Marca Compatible
              </h3>
            </div>

            {/* Custom Pie-gauge list mapping */}
            <div className="space-y-3.5">
              {topBrandData.map((b) => {
                const totalUnits = topBrandData.reduce((acc, d) => acc + d.value, 0);
                const percentage = totalUnits > 0 ? (b.value / totalUnits) * 100 : 0;
                return (
                  <div key={b.name} className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${
                        b.name === "Samsung" ? "bg-indigo-605 text-indigo-600 bg-indigo-500" :
                        b.name === "Motorola" ? "bg-emerald-500" :
                        b.name === "iPhone" ? "bg-amber-500" :
                        b.name === "Xiaomi" ? "bg-sky-500" : "bg-slate-400"
                      }`} />
                      <span className="uppercase">{b.name}</span>
                    </div>
                    <div className="font-mono text-slate-800">
                      {b.value} u <span className="text-[10px] text-slate-400">({percentage.toFixed(0)}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 mt-6 flex justify-between items-center text-xs text-slate-400">
            <span>Depósito Valuación:</span>
            <span className="font-bold text-slate-900 font-mono">{formatMoney(totalInventoryCostValue)}</span>
          </div>
        </div>

      </div>

    </div>
  );
}
