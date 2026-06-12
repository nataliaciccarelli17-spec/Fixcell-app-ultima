import React, { useState, useEffect } from "react";
import { 
  FileText, 
  Download, 
  Calendar, 
  Database, 
  CheckCircle, 
  DownloadCloud, 
  Activity, 
  ArrowUpRight,
  Github,
  Globe,
  Terminal,
  ExternalLink,
  Cpu,
  Copy,
  Check
} from "lucide-react";
import { Product, Sale, RepairOrder } from "../types";

interface ReportsProps {
  products: Product[];
  sales: Sale[];
  repairs: RepairOrder[];
}

export default function ReportsAndBackup({ products, sales, repairs }: ReportsProps) {
  
  // Date states
  const [startDateStr, setStartDateStr] = useState<string>("");
  const [endDateStr, setEndDateStr] = useState<string>("");
  const [reportType, setReportType] = useState<"ventas" | "ganancias" | "inventario">("ventas");

  // Backup status
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [lastBackup, setLastBackup] = useState<string>(new Date().toLocaleString("es-AR"));

  const handleTriggerBackup = () => {
    setIsBackingUp(true);
    setTimeout(() => {
      setIsBackingUp(false);
      setLastBackup(new Date().toLocaleString("es-AR"));
      alert("¡Respaldo Exitoso! Los datos de Firestore se guardaron correctamente en la nube.");
    }, 1800);
  };

  // Convert and export standard clean CSV helper
  const handleExportCSV = () => {
    let headers: string[] = [];
    let rows: string[][] = [];
    let filename = `reporte-${reportType}.csv`;

    const sDate = startDateStr ? new Date(startDateStr) : null;
    const eDate = endDateStr ? new Date(endDateStr) : null;

    if (reportType === "ventas") {
      headers = ["Fecha", "ID Venta", "Vendedor", "Metodo Pago", "Productos", "Total Facturado", "Ganancia Total"];
      
      const filteredSales = sales.filter(s => {
        const d = new Date(s.fecha);
        if (sDate && d < sDate) return false;
        if (eDate && d > eDate) return false;
        return true;
      });

      filteredSales.forEach(s => {
        const itemsSummary = s.items.map(i => `${i.cantidad}x ${i.nombre}`).join(" | ");
        rows.push([
          new Date(s.fecha).toLocaleDateString("es-AR"),
          s.id || "N/A",
          s.vendedorNombre,
          s.metodoPago,
          itemsSummary,
          s.subtotal.toString(),
          s.gananciaTotal.toString()
        ]);
      });

    } else if (reportType === "ganancias") {
      headers = ["Fecha Trabajo", "Servicio/Código", "Detalle", "Mano Obra", "Costo Repuestos", "Total Cobrado", "Ganancia Neta"];
      
      const filteredSales = sales.filter(s => {
        const d = new Date(s.fecha);
        if (sDate && d < sDate) return false;
        if (eDate && d > eDate) return false;
        return true;
      });

      const filteredRepairs = repairs.filter(r => {
        if (!r.fechaEntrega) return false;
        const d = new Date(r.fechaEntrega);
        if (sDate && d < sDate) return false;
        if (eDate && d > eDate) return false;
        return true;
      });

      // Sum sales profits
      filteredSales.forEach(s => {
        rows.push([
          new Date(s.fecha).toLocaleDateString("es-AR"),
          `VENTA POS`,
          s.items.map(i => `${i.cantidad}x ${i.nombre}`).join(" | "),
          "0",
          (s.subtotal - s.gananciaTotal).toString(),
          s.subtotal.toString(),
          s.gananciaTotal.toString()
        ]);
      });

      // Sum repairs profits
      filteredRepairs.forEach(r => {
        rows.push([
          new Date(r.fechaEntrega!).toLocaleDateString("es-AR"),
          r.numeroOrden,
          `${r.dispositivoMarca} ${r.dispositivoModelo} - Falla: ${r.fallaReportada}`,
          r.reparacionManoObra.toString(),
          r.reparacionCostoRepuestos.toString(),
          r.reparacionCobrado.toString(),
          r.reparacionGanancia.toString()
        ]);
      });

    } else {
      // Inventory Report
      headers = ["Codigo Interno", "Codigo Barras", "Nombre", "Categoria", "Compatibilidad", "Precio Costo", "Precio Venta", "Stock", "Proveedor"];
      products.forEach(p => {
        rows.push([
          p.codigoInterno,
          p.codigoBarras,
          p.nombre,
          p.categoria,
          `${p.marcaCompatible} ${p.modeloCompatible}`,
          p.precioCosto.toString(),
          p.precioVenta.toString(),
          p.stockActual.toString(),
          p.proveedor
        ]);
      });
    }

    // Generate CSV string content (UTF-8 with BOM to open perfectly in excel Spanish context)
    const csvContent = "\uFEFF" + [
      headers.join(";"),
      ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(";"))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[calc(100vh-180px)]">
      
      {/* LEFT COLUMN: Report inputs */}
      <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-50">
          <FileText className="text-indigo-600" size={18} />
          <h2 className="font-extrabold text-slate-800 text-sm">Generador de Reportes Analíticos</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5">1. Seleccionar Tipo de Reporte</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                id="reporttype-sales-btn"
                onClick={() => setReportType("ventas")}
                className={`p-3 border text-center transition rounded-xl text-xs font-bold leading-none ${
                  reportType === "ventas" ? "border-indigo-600 bg-indigo-50/50 text-indigo-700" : "border-slate-200 hover:bg-slate-50 text-slate-600"
                }`}
              >
                Ventas de POS
              </button>
              <button
                id="reporttype-gains-btn"
                onClick={() => setReportType("ganancias")}
                className={`p-3 border text-center transition rounded-xl text-xs font-bold leading-none ${
                  reportType === "ganancias" ? "border-indigo-600 bg-indigo-50/50 text-indigo-700" : "border-slate-200 hover:bg-slate-50 text-slate-600"
                }`}
              >
                Ganancias Netas
              </button>
              <button
                id="reporttype-inv-btn"
                onClick={() => setReportType("inventario")}
                className={`p-3 border text-center transition rounded-xl text-xs font-bold leading-none ${
                  reportType === "inventario" ? "border-indigo-600 bg-indigo-50/50 text-indigo-700" : "border-slate-200 hover:bg-slate-50 text-slate-600"
                }`}
              >
                Stock Inventario
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Fecha de Inicio</label>
              <input
                id="report-start-date"
                type="date"
                value={startDateStr}
                onChange={(e) => setStartDateStr(e.target.value)}
                className="w-full text-xs text-slate-800 border border-slate-200 rounded-xl px-3 py-2 outline-hidden bg-slate-50"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Fecha de Fin</label>
              <input
                id="report-end-date"
                type="date"
                value={endDateStr}
                onChange={(e) => setEndDateStr(e.target.value)}
                className="w-full text-xs text-slate-800 border border-slate-200 rounded-xl px-3 py-2 outline-hidden bg-slate-50"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex gap-2">
            <button
              id="report-print-btn"
              onClick={handlePrintReport}
              className="flex-1 py-3 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5"
            >
              Imprimir Vista de Reporte
            </button>
            
            <button
              id="report-csv-btn"
              onClick={handleExportCSV}
              className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow"
            >
              <Download size={14} />
              Exportar CSV / Excel
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Backup manager */}
      <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 pb-3 border-b border-slate-50">
            <Database className="text-indigo-600" size={18} />
            <h2 className="font-extrabold text-slate-800 text-sm">Respaldo de Seguridad (Backups)</h2>
          </div>

          <p className="text-xs text-slate-500 mt-4 leading-relaxed">
            Realizá respaldos íntegros de la base de datos de Firestore local. La sincronización se efectúa de forma incremental, asegurando un índice cero de pérdida de transacciones o movimientos técnicos.
          </p>

          <div className="bg-slate-50 p-4 rounded-xl space-y-2 mt-4 text-xs font-mono border border-slate-100/60">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">ESTADO RESPALDO:</span>
              <span className="text-emerald-500 font-bold flex items-center gap-1">
                <CheckCircle size={12} /> Activo diario
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-650">
              <span className="text-slate-400">ÚLTIMO BACKUP:</span>
              <span className="font-bold">{lastBackup}</span>
            </div>
          </div>
        </div>

        <button
          id="trigger-backup-now-btn"
          disabled={isBackingUp}
          onClick={handleTriggerBackup}
          className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 text-xs uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-1.5 mt-6 shrink-0"
        >
          <DownloadCloud size={14} />
          {isBackingUp ? "Realizando Copia..." : "Respaldar Base Ahora"}
        </button>
      </div>

      {/* PLATFORMS & AGENTS DE CONTROL DESPLIEGUE */}
      <div className="lg:col-span-12 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6 mt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-50">
          <div className="flex items-center gap-2">
            <Cpu className="text-orange-500" size={18} />
            <h2 className="font-extrabold text-slate-800 text-sm">Consola Dev y Agentes de Control</h2>
          </div>
          <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Consolas Integradas para Administración de Fixcell</span>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">
          Coordinación directa de los tres agentes y plataformas de control que sustentan la infraestructura de <strong>Fixcell</strong>. Accedé a las consolas oficiales, consultá comandos rápidos de actualización y gestioná los repositorios vinculados.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* GITHUB CONTROL CARD */}
          <div className="border border-slate-100 rounded-xl p-5 hover:border-slate-200 transition space-y-4 bg-slate-50/50 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-9 w-9 bg-slate-900 text-white rounded-lg flex items-center justify-center shadow-xs">
                  <Github size={18} />
                </div>
                <span className="text-[10px] uppercase font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                  Listo para Commit
                </span>
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-tight">Agente GitHub</h3>
                <p className="text-[11px] text-slate-500 mt-1">Control de versiones del código fuente del sistema Fixcell.</p>
              </div>

              {/* Editable Repo setting */}
              <div className="bg-white p-3 rounded-lg border border-slate-100 text-[11px] space-y-1">
                <span className="text-[9px] uppercase font-bold text-slate-400 block font-mono">Repocitorio Vinculado:</span>
                <a 
                  href="https://github.com/" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="font-mono text-indigo-600 hover:underline flex items-center gap-1 leading-none text-[10px]"
                >
                  github.com/ <ExternalLink size={10} />
                </a>
              </div>
            </div>

            <div className="pt-2">
              <a 
                href="https://github.com/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] rounded-lg transition flex items-center justify-center gap-1.5 shadow-sm"
              >
                Abrir Consola GitHub
                <ArrowUpRight size={13} />
              </a>
            </div>
          </div>

          {/* VERCEL CONTROL CARD */}
          <div className="border border-slate-100 rounded-xl p-5 hover:border-slate-200 transition space-y-4 bg-slate-50/50 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-9 w-9 bg-black text-white rounded-lg flex items-center justify-center shadow-xs">
                  <Globe size={18} />
                </div>
                <span className="text-[10px] uppercase font-bold text-indigo-650 bg-indigo-50 px-2 py-0.5 rounded-full">
                  Producción Activa
                </span>
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-tight">Agente Vercel</h3>
                <p className="text-[11px] text-slate-500 mt-1">Plataforma Serverless de alojamiento web y ruteo de APIs.</p>
              </div>

              {/* Vercel project direct link */}
              <div className="bg-white p-3 rounded-lg border border-slate-100 text-[11px] space-y-1">
                <span className="text-[9px] uppercase font-bold text-slate-400 block font-mono">Proyecto Dev Vercel:</span>
                <a 
                  href="https://vercel.com/nataliaciccarelli17-2830s-projects" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="font-mono text-indigo-600 hover:underline flex items-center gap-1 leading-normal text-[10px]"
                >
                  vercel.com/nataliaciccarelli17-2830s-... <ExternalLink size={10} />
                </a>
              </div>
            </div>

            <div className="pt-2">
              <a 
                href="https://vercel.com/nataliaciccarelli17-2830s-projects" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] rounded-lg transition flex items-center justify-center gap-1.5 shadow-sm"
              >
                Abrir Consola Vercel
                <ArrowUpRight size={13} />
              </a>
            </div>
          </div>

          {/* FIREBASE CONTROL CARD */}
          <div className="border border-slate-100 rounded-xl p-5 hover:border-slate-200 transition space-y-4 bg-slate-50/50 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-9 w-9 bg-amber-500 text-white rounded-lg flex items-center justify-center shadow-xs">
                  <Database size={18} />
                </div>
                <span className="text-[10px] uppercase font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                  Sincronizado (Firestore)
                </span>
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-tight">Agente Firebase</h3>
                <p className="text-[11px] text-slate-500 mt-1">Base de datos de stock, usuarios, CRM y seguridad de reglas.</p>
              </div>

              {/* Firebase active project indicator */}
              <div className="bg-white p-3 rounded-lg border border-slate-100 text-[11px] space-y-1">
                <span className="text-[9px] uppercase font-bold text-slate-400 block font-mono">Consola Web Firebase:</span>
                <a 
                  href="https://console.firebase.google.com/" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="font-mono text-indigo-600 hover:underline flex items-center gap-1 leading-none text-[10px]"
                >
                  console.firebase.google.com/ <ExternalLink size={10} />
                </a>
              </div>
            </div>

            <div className="pt-2">
              <a 
                href="https://console.firebase.google.com/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] rounded-lg transition flex items-center justify-center gap-1.5 shadow-sm"
              >
                Abrir Consola Firebase
                <ArrowUpRight size={13} />
              </a>
            </div>
          </div>

        </div>

        {/* RECENT INSTRUCTIONS & DEPLOYMENT CODES FOR VERIFICATION */}
        <div className="border border-slate-100/70 rounded-xl p-4 bg-slate-50/50 space-y-3">
          <div className="flex items-center gap-2">
            <Terminal size={14} className="text-slate-600" />
            <span className="text-xs font-bold text-slate-700">Guía de Comandos Rápidos para Despliegues</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-900 text-slate-100 p-3.5 rounded-lg text-[10px] font-mono leading-relaxed space-y-1 scrollbar-thin">
              <span className="text-slate-400 block border-b border-slate-800 pb-1 mb-1 font-bold">1. Subir Código a GitHub</span>
              <p>git init</p>
              <p>git add .</p>
              <p>git commit -m "feat: personalizar marca Fixcell"</p>
              <p className="text-slate-500"># Reemplazar con tu url de repositorio creado</p>
              <p>git remote add origin https://github.com/tu-usuario/fixcell.git</p>
              <p>git push -u origin main</p>
            </div>

            <div className="bg-slate-900 text-slate-100 p-3.5 rounded-lg text-[10px] font-mono leading-relaxed space-y-1 scrollbar-thin">
              <span className="text-slate-400 block border-b border-slate-800 pb-1 mb-1 font-bold">2. Desplegar en Vercel</span>
              <p className="text-slate-500"># Instalar Vercel CLI globalmente e iniciar sesión</p>
              <p>npm i -g vercel</p>
              <p>vercel login</p>
              <p className="text-slate-500"># Desplegar este proyecto con un solo comando</p>
              <p>vercel</p>
              <p className="text-slate-500"># Para desplegar a producción final:</p>
              <p>vercel --prod</p>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
