import React, { useState, useEffect } from "react";
import { 
  BookOpen, 
  Wallet, 
  ArrowRightLeft, 
  PlusCircle, 
  FolderPlus, 
  ChevronRight, 
  ChevronDown, 
  CircleAlert, 
  CheckCircle, 
  HelpCircle,
  TrendingUp,
  Coins,
  Settings,
  Plus,
  Scale,
  Users
} from "lucide-react";
import { db } from "../firebase";
import { collection, onSnapshot, addDoc } from "firebase/firestore";

interface AccountNode {
  code: string;
  name: string;
  type: "Activo" | "Pasivo" | "Patrimonio Neto" | "Ingresos" | "Egresos";
  level: number;
  automatic?: boolean;
}

interface CashRegisterSession {
  id?: string;
  isOpen: boolean;
  openedAt: string;
  closedAt?: string;
  startingBalance: number;
  salesCash: number;
  salesDigital: number;
  expensesCash: number;
  physicalCountCash: number;
  physicalCountDigital: number;
  theoreticalBalance: number; // calculated: starting + salesCash - expensesCash
  theoreticalDigital: number; // calculated: salesDigital
  discrepancyCash: number; // physical - theoretical
  discrepancyDigital: number; // physical - theoretical digital
  status: "Abierta" | "Cerrada_Cuadrada" | "Cerrada_Inconsistente";
}

interface JournalEntry {
  date: string;
  concept: string;
  debits: { account: string; amount: number }[];
  credits: { account: string; amount: number }[];
  explanation: string;
}

export default function Accounting() {
  const [activeSubTab, setActiveSubTab] = useState<"plan" | "caja" | "asientos">("plan");
  const [successMsg, setSuccessMsg] = useState("");

  // PLAN DE CUENTAS STATE
  const [accounts, setAccounts] = useState<AccountNode[]>([
    { code: "1", name: "Activo", type: "Activo", level: 1 },
    { code: "1.1", name: "Activo Corriente", type: "Activo", level: 2 },
    { code: "1.1.1", name: "Caja y Bancos", type: "Activo", level: 3 },
    { code: "1.1.1.01", name: "Caja Chica Chica", type: "Activo", level: 4 },
    { code: "1.1.1.02", name: "Banco de la Nación", type: "Activo", level: 4 },
    { code: "1.1.1.03", name: "Mercado Pago (Fondo Operativo)", type: "Activo", level: 4 },
    { code: "1.1.2", name: "Créditos por Ventas", type: "Activo", level: 3 },
    { code: "1.1.2.01", name: "Deudores por Ventas (Global)", type: "Activo", level: 4 },
    { code: "1.1.3", name: "Bienes de Cambio", type: "Activo", level: 3 },
    { code: "1.1.3.01", name: "Stock de Mercadería - Accesorios", type: "Activo", level: 4 },
    { code: "1.1.3.02", name: "Stock de Repuestos", type: "Activo", level: 4 },
    
    { code: "2", name: "Pasivo", type: "Pasivo", level: 1 },
    { code: "2.1", name: "Pasivo Corriente", type: "Pasivo", level: 2 },
    { code: "2.1.1", name: "Cuentas por Pagar", type: "Pasivo", level: 3 },
    { code: "2.1.1.01", name: "Proveedores Locales", type: "Pasivo", level: 4 },
    
    { code: "3", name: "Patrimonio Neto", type: "Patrimonio Neto", level: 1 },
    { code: "3.1", name: "Capital Social", type: "Patrimonio Neto", level: 2 },
    { code: "3.2", name: "Resultados Acumulados", type: "Patrimonio Neto", level: 2 },
    
    { code: "4", name: "Ingresos", type: "Ingresos", level: 1 },
    { code: "4.1", name: "Ingresos Operativos", type: "Ingresos", level: 2 },
    { code: "4.1.1", name: "Ventas de Accesorios Celular", type: "Ingresos", level: 3 },
    { code: "4.1.2", name: "Ingresos por Servicios de Reparación", type: "Ingresos", level: 3 },
    
    { code: "5", name: "Egresos", type: "Egresos", level: 1 },
    { code: "5.1", name: "Egresos Operativos", type: "Egresos", level: 2 },
    { code: "5.1.1", name: "Costo de Mercadería Vendida (CMV)", type: "Egresos", level: 3 },
    { code: "5.1.2", name: "Costo de Insumos y Repuestos", type: "Egresos", level: 3 },
    { code: "5.1.3", name: "Sobrantes y Faltantes de Caja", type: "Egresos", level: 3 },
    { code: "5.1.4", name: "Gastos Generales / Alquileres", type: "Egresos", level: 3 }
  ]);

  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    "1": true, "1.1": true, "1.1.1": true, "1.1.2": true, "2": true, "3": true, "4": true, "5": true
  });

  const [newClientName, setNewClientName] = useState("");
  const [newGateName, setNewGateName] = useState("");

  const toggleNode = (code: string) => {
    setExpandedNodes(prev => ({ ...prev, [code]: !prev[code] }));
  };

  const handleCreateAutoClientAccount = () => {
    if (!newClientName.trim()) return;
    const clientCode = `1.1.2.0${accounts.filter(a => a.code.startsWith("1.1.2.")).length + 1}`;
    const newAcc: AccountNode = {
      code: clientCode,
      name: `Cta. Cte. Deudora: ${newClientName}`,
      type: "Activo",
      level: 4,
      automatic: true
    };
    setAccounts(prev => [...prev, newAcc].sort((a,b) => a.code.localeCompare(b.code)));
    setNewClientName("");
    showCelebration(`Cuenta automática contable creada para el cliente en créditos: ${newAcc.code}`);
  };

  const handleCreateAutoGateAccount = () => {
    if (!newGateName.trim()) return;
    const gateCode = `1.1.1.0${accounts.filter(a => a.code.startsWith("1.1.1.")).length + 1}`;
    const newAcc: AccountNode = {
      code: gateCode,
      name: `Fondo Liquidez: ${newGateName}`,
      type: "Activo",
      level: 4,
      automatic: true
    };
    setAccounts(prev => [...prev, newAcc].sort((a,b) => a.code.localeCompare(b.code)));
    setNewGateName("");
    showCelebration(`Cuenta automática de tesorería asociada para el portal ${newGateName}: ${newAcc.code}`);
  };

  const showCelebration = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 5000);
  };

  // CIERRE DE CAJA STATE
  const [cashSession, setCashSession] = useState<CashRegisterSession>({
    isOpen: true,
    openedAt: new Date().toLocaleDateString("es-AR") + " 08:30",
    startingBalance: 15000,
    salesCash: 48500,
    salesDigital: 32000,
    expensesCash: 6200,
    physicalCountCash: 57300,
    physicalCountDigital: 32000,
    theoreticalBalance: 57300, // 15000 + 48500 - 6200
    theoreticalDigital: 32000,
    discrepancyCash: 0,
    discrepancyDigital: 0,
    status: "Abierta"
  });

  const [inputPhysicalCash, setInputPhysicalCash] = useState<number>(57300);
  const [inputPhysicalDigital, setInputPhysicalDigital] = useState<number>(32000);
  const [inputStartingBalance, setInputStartingBalance] = useState<number>(15000);
  const [inputManualExpense, setInputManualExpense] = useState<number>(0);
  const [inputManualSale, setInputManualSale] = useState<number>(0);
  const [paymentType, setPaymentType] = useState<"Efectivo" | "Digital">("Efectivo");

  // Recalculate balances
  useEffect(() => {
    const theoreticalCash = cashSession.startingBalance + cashSession.salesCash - cashSession.expensesCash;
    const theoreticalDigital = cashSession.salesDigital;
    
    const discrepancyC = inputPhysicalCash - theoreticalCash;
    const discrepancyD = inputPhysicalDigital - theoreticalDigital;

    setCashSession(prev => ({
      ...prev,
      theoreticalBalance: theoreticalCash,
      theoreticalDigital: theoreticalDigital,
      physicalCountCash: inputPhysicalCash,
      physicalCountDigital: inputPhysicalDigital,
      discrepancyCash: discrepancyC,
      discrepancyDigital: discrepancyD
    }));
  }, [inputPhysicalCash, inputPhysicalDigital, cashSession.startingBalance, cashSession.salesCash, cashSession.expensesCash]);

  const handleOpenBox = () => {
    setCashSession({
      isOpen: true,
      openedAt: new Date().toLocaleDateString("es-AR") + " " + new Date().toLocaleTimeString("es-AR", {hour: '2-digit', minute:'2-digit'}),
      startingBalance: inputStartingBalance,
      salesCash: 0,
      salesDigital: 0,
      expensesCash: 0,
      physicalCountCash: inputStartingBalance,
      physicalCountDigital: 0,
      theoreticalBalance: inputStartingBalance,
      theoreticalDigital: 0,
      discrepancyCash: 0,
      discrepancyDigital: 0,
      status: "Abierta"
    });
    setInputPhysicalCash(inputStartingBalance);
    setInputPhysicalDigital(0);
    showCelebration("Caja Operativa Abierta de forma satisfactoria para el día.");
  };

  const handleAddMovement = (type: "ingreso" | "egreso") => {
    if (type === "ingreso") {
      const amount = inputManualSale;
      if (amount <= 0) return;
      if (paymentType === "Efectivo") {
        setCashSession(prev => ({ ...prev, salesCash: prev.salesCash + amount }));
      } else {
        setCashSession(prev => ({ ...prev, salesDigital: prev.salesDigital + amount }));
      }
      setInputManualSale(0);
      showCelebration(`Venta agregada a la caja actual: $${amount}`);
    } else {
      const amount = inputManualExpense;
      if (amount <= 0) return;
      setCashSession(prev => ({ ...prev, expensesCash: prev.expensesCash + amount }));
      setInputManualExpense(0);
      showCelebration(`Retiro / Egreso de caja registrado: $${amount}`);
    }
  };

  const handleCloseSession = () => {
    const dCash = cashSession.discrepancyCash;
    const dDigital = cashSession.discrepancyDigital;
    const isMatched = dCash === 0 && dDigital === 0;

    setCashSession(prev => ({
      ...prev,
      isOpen: false,
      closedAt: new Date().toLocaleDateString("es-AR") + " " + new Date().toLocaleTimeString("es-AR", {hour: '2-digit', minute:'2-digit'}),
      status: isMatched ? "Cerrada_Cuadrada" : "Cerrada_Inconsistente"
    }));

    if (!isMatched) {
      // Automatizar asiento de ajuste
      const adjustType = dCash < 0 ? "Faltante ($" + Math.abs(dCash) + ")" : "Sobrante ($" + dCash + ")";
      showCelebration(`Cierre realizado con diferencias. Se requiere el asiento de ajuste por ${adjustType}.`);
    } else {
      showCelebration("Cierre perfecto. Caja libre de diferencias y saldos conciliados.");
    }
  };

  // ASIENTOS CONTABLES VISUALIZADOR
  const [selectedSimCase, setSelectedSimCase] = useState<string | null>(null);
  const [simulatedEntry, setSimulatedEntry] = useState<JournalEntry | null>(null);

  const simulationCases: Record<string, JournalEntry> = {
    venta_contado: {
      date: new Date().toLocaleDateString("es-AR"),
      concept: "Venta al Contado de Accesorios de Celular",
      debits: [
        { account: "1.1.1.01 Caja Chica (Efectivo)", amount: 6000 },
        { account: "1.1.1.03 Mercado Pago (Transferencia)", amount: 6000 }
      ],
      credits: [
        { account: "4.1.1 Ventas de Accesorios Celular", amount: 12000 }
      ],
      explanation: "El débito aumenta Caja y Mercado Pago (Activos) por los fondos recibidos, mientras el crédito registra la ganancia genuina de explotación en la cuenta de Ingresos."
    },
    venta_credito: {
      date: new Date().toLocaleDateString("es-AR"),
      concept: "Venta a Crédito en Cuenta Corriente a Cliente",
      debits: [
        { account: "1.1.2.02 Cta. Cte. Deudora: Juan Pérez", amount: 15000 }
      ],
      credits: [
        { account: "4.1.1 Ventas de Accesorios Celular", amount: 15000 }
      ],
      explanation: "No hay billete físico inmediato. Se debita un derecho a cobro (Activo en Créditos por Ventas) y se perfecciona el ingreso (Haber) por el total vendido."
    },
    pago_proveedor: {
      date: new Date().toLocaleDateString("es-AR"),
      concept: "Pago de Insumos / Repuestos a Proveedor",
      debits: [
        { account: "5.1.2 Costo de Insumos y Repuestos (Gasto)", amount: 8000 }
      ],
      credits: [
        { account: "1.1.1.01 Caja Chica (Efectivo)", amount: 8000 }
      ],
      explanation: "Se reconoce el egreso de la explotación en el Debe, disminuyendo el dinero disponible en Caja Chica (Salida en el Haber)."
    },
    cierre_con_faltante: {
      date: new Date().toLocaleDateString("es-AR"),
      concept: "Asiento de Cierre Diario con Faltante de Arqueo",
      debits: [
        { account: "5.1.3 Sobrantes y Faltantes de Caja (Pérdida)", amount: 120 },
        { account: "3.2 Resultados Acumulados (Ajuste)", amount: 57180 }
      ],
      credits: [
        { account: "1.1.1.01 Caja Chica (Por Salida de Arqueo)", amount: 57300 }
      ],
      explanation: "Asiento de depreciación por arqueo de caja con un desvío negativo de $120. Se imputa la pérdida generada a la cuenta de egresos operativos."
    }
  };

  const loadSimulation = (key: string) => {
    setSelectedSimCase(key);
    setSimulatedEntry(simulationCases[key]);
  };

  const getParentShow = (childCode: string) => {
    const segments = childCode.split(".");
    if (segments.length === 1) return true;
    const parentCode = segments.slice(0, -1).join(".");
    return expandedNodes[parentCode] && getParentShow(parentCode);
  };

  return (
    <div className="space-y-6">
      
      {/* HEADER PRINCIPAL */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-widest text-orange-400 bg-orange-500/10 px-3 py-1 rounded-full">
                Módulo Financiero Centralizado
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Normativa IFRS / PCGA</span>
            </div>
            <h1 className="text-3xl font-black italic tracking-wide uppercase">
              <span className="text-orange-500">MÓDULO</span> <span className="text-white">CONTABLE</span>
            </h1>
            <p className="text-slate-400 text-xs max-w-2xl">
              Diseño de árbol de cuentas jerárquico de control interno, cierres diarios de tesorería y traducción de operaciones de hardware y repuestos a asientos de doble entrada simplificados.
            </p>
          </div>
          
          <div className="flex bg-slate-800 p-1 rounded-2xl border border-slate-700 w-full md:w-auto">
            <button
              onClick={() => setActiveSubTab("plan")}
              className={`flex-1 md:flex-none px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                activeSubTab === "plan" ? "bg-orange-500 text-white shadow-md shadow-orange-500/20" : "text-slate-300 hover:text-white"
              }`}
            >
              <BookOpen size={14} />
              Plan de Cuentas
            </button>
            <button
              onClick={() => setActiveSubTab("caja")}
              className={`flex-1 md:flex-none px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                activeSubTab === "caja" ? "bg-orange-500 text-white shadow-md shadow-orange-500/20" : "text-slate-300 hover:text-white"
              }`}
            >
              <Wallet size={14} />
              Ciclo de Caja
            </button>
            <button
              onClick={() => setActiveSubTab("asientos")}
              className={`flex-1 md:flex-none px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                activeSubTab === "asientos" ? "bg-orange-500 text-white shadow-md shadow-orange-500/20" : "text-slate-300 hover:text-white"
              }`}
            >
              <ArrowRightLeft size={14} />
              Lógica Contable
            </button>
          </div>
        </div>
      </div>

      {/* SUCCESS ALERTS */}
      {successMsg && (
        <div id="accounting-success" className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-xs font-semibold flex items-center gap-2 animate-fade-in">
          <CheckCircle size={16} className="text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* SUB-TABS CONTAINERS */}

      {/* 1. PLAN DE CUENTAS */}
      {activeSubTab === "plan" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          <div className="lg:col-span-8 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <div className="pb-3 border-b border-slate-50 flex items-center justify-between">
              <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-tight">Estructura de Cuentas Operativas</h3>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-50 px-2.5 py-1 rounded-md">Jerarquía Codificada</span>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Arbol estructurado que asocia los movimientos de activos físicos (celulares en stock, efectivo en caja chicas) y deudores por servicios. Hacé click en las carpetas para expandir/colapsar ramas.
            </p>

            {/* Account Tree view */}
            <div className="border border-slate-100 rounded-xl overflow-hidden bg-slate-50/50 p-2 space-y-1">
              {accounts.map(acc => {
                const show = acc.level === 1 || getParentShow(acc.code);
                if (!show) return null;

                const hasChildren = accounts.some(a => a.code.startsWith(acc.code + ".") && a.level === acc.level + 1);
                const isExpanded = expandedNodes[acc.code];

                // Indentation multiplier
                const indentClass = `pl-${(acc.level - 1) * 4}`;

                const typeColors = {
                  "Activo": "text-emerald-700 bg-emerald-50",
                  "Pasivo": "text-rose-700 bg-rose-50",
                  "Patrimonio Neto": "text-indigo-700 bg-indigo-50",
                  "Ingresos": "text-amber-700 bg-amber-50/70",
                  "Egresos": "text-sky-700 bg-sky-50"
                };

                return (
                  <div 
                    key={acc.code}
                    style={{ paddingLeft: `${(acc.level - 1) * 16}px` }}
                    className={`flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-white hover:shadow-xs transition duration-150 ${acc.level === 1 ? 'bg-slate-100 font-extrabold text-xs text-slate-700 mt-2' : 'text-[11px] text-slate-600'}`}
                  >
                    <div className="flex items-center gap-2">
                      {hasChildren ? (
                        <button 
                          onClick={() => toggleNode(acc.code)} 
                          className="p-0.5 hover:bg-slate-200 rounded transition text-slate-400 shrink-0"
                        >
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                      ) : (
                        <span className="w-5 shrink-0"></span>
                      )}
                      
                      <span className="font-mono text-indigo-600 font-bold">{acc.code}</span>
                      <span className={`font-semibold ${acc.level === 1 ? 'uppercase' : ''}`}>{acc.name}</span>

                      {acc.automatic && (
                        <span className="text-[8px] bg-orange-100 text-orange-700 px-1.5 py-0.2 rounded font-semibold uppercase tracking-wider">
                          Creado Automático
                        </span>
                      )}
                    </div>

                    <span className={`text-[8px] font-bold uppercase rounded px-2 py-0.5 font-mono ${typeColors[acc.type]}`}>
                      {acc.type}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-4 space-y-6">
            
            {/* CUENTAS AUTOMATIVAS - EXPLICATIVO */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              <div className="flex items-center gap-1.5 pb-2 border-b border-slate-50 text-orange-500">
                <Settings size={16} />
                <h4 className="font-extrabold text-slate-800 text-xs uppercase">Motor de Cuentas Virtuales</h4>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">
                Al agregar nuevos elementos operativos, el back-end crea subcuentas de nivel 4 heredadas del plan maestro sin intervención humana.
              </p>

              {/* Simulation client */}
              <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="flex items-center gap-1.5 text-indigo-700 font-bold text-[10px] uppercase">
                  <PlusCircle size={12} className="shrink-0" />
                  <span>Cuentas por Clientes (Deudores)</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-normal">
                  Simulá registrar un cliente con cuenta corriente y mirá cómo se ramifica el árbol de créditos (Sección 1.1.2).
                </p>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Ej. Distribuidora Celulares" 
                    value={newClientName}
                    onChange={e => setNewClientName(e.target.value)}
                    className="flex-1 bg-white border border-slate-250 p-1.5 rounded-lg text-xs"
                  />
                  <button 
                    onClick={handleCreateAutoClientAccount}
                    className="p-1 px-3 bg-orange-500 text-white rounded-lg text-xs font-bold hover:bg-orange-600 transition shrink-0"
                  >
                    Crear Account
                  </button>
                </div>
              </div>

              {/* Simulation payments */}
              <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="flex items-center gap-1.5 text-indigo-700 font-bold text-[10px] uppercase">
                  <FolderPlus size={12} className="shrink-0" />
                  <span>Portal de Pago Cooperante</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-normal">
                  Si un comerciante adopta un nuevo gateway de pago digital, se inicializa automáticamente una cartera en el Activo Caja y Bancos (1.1.1).
                </p>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Ej. PayPal Argentina" 
                    value={newGateName}
                    onChange={e => setNewGateName(e.target.value)}
                    className="flex-1 bg-white border border-slate-250 p-1.5 rounded-lg text-xs"
                  />
                  <button 
                    onClick={handleCreateAutoGateAccount}
                    className="p-1 px-3 bg-orange-500 text-white rounded-lg text-xs font-bold hover:bg-orange-600 transition shrink-0"
                  >
                    Crear Link
                  </button>
                </div>
              </div>
            </div>

            {/* DOC DESARROLLO */}
            <div className="bg-slate-900 text-slate-300 p-5 rounded-2xl space-y-3">
              <div className="flex items-center gap-1.5 font-bold text-xs uppercase text-orange-400">
                <Scale size={14} />
                <span>Estrategia de Código Contable</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                "Los operarios del taller de Fixcell no necesitan conocer de cuentas pasivas o impositivas. Su interacción con el stock debita existencias y acredita inventarios automáticamente según los códigos de categoría mapeados."
              </p>
              <div className="bg-slate-800 p-3 text-[9px] font-mono rounded border border-slate-700 space-y-1 block text-slate-300">
                <p className="text-slate-500">// Creación Dinámica de Subcuenta</p>
                <p>{"const accId = '1.1.2.0' + (index + 1);"}</p>
                <p>{"await setDoc(doc(db, 'plan_cuentas', accId), {"}</p>
                <p className="pl-3">{"code: accId,"}</p>
                <p className="pl-3">{"name: `Cta. Cte. Deudora: ${clientName}`,"}</p>
                <p className="pl-3">{"type: 'Activo',"}</p>
                <p className="pl-3">{"level: 4"}</p>
                <p>{"});"}</p>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* 2. CICLO DE CAJA */}
      {activeSubTab === "caja" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          <div className="lg:col-span-8 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
            <div className="pb-3 border-b border-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="text-orange-500" size={18} />
                <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-tight">Consola de Ciclo de Caja</h3>
              </div>
              
              <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full ${cashSession.isOpen ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                {cashSession.isOpen ? "Caja Abierta" : "Caja Cerrada"}
              </span>
            </div>

            {/* Ciclo de vida explicativo */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
              {[
                { name: "1. Apertura", desc: "Se declara saldo inicial físico de cambio", status: true },
                { name: "2. Actividades", desc: "Entradas por ventas y retiros por gastos", status: cashSession.isOpen },
                { name: "3. Arqueo / Conteo", desc: "El empleado cuenta el billete real", status: cashSession.isOpen },
                { name: "4. Conciliación", desc: "Cierre, cálculo de desvíos y balance", status: true }
              ].map((step, idx) => (
                <div key={idx} className={`p-3 rounded-xl border ${step.status ? 'border-orange-100 bg-orange-50/15' : 'border-slate-100 bg-slate-50 opacity-60'} space-y-1`}>
                  <p className="text-[11px] font-bold text-slate-700">{step.name}</p>
                  <p className="text-[9px] text-slate-400 leading-normal">{step.desc}</p>
                </div>
              ))}
            </div>

            {/* OPERATOR PANEL SECTIONS */}
            {cashSession.isOpen ? (
              <div className="space-y-6 pt-4 border-t border-slate-100">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* MOVIMIENTOS SIMULATOR */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/50 space-y-3">
                    <h4 className="text-xs font-bold text-slate-700 uppercase">Simular Movimiento de Caja Diaria</h4>
                    <p className="text-[10px] text-slate-400 leading-normal">Los empleados realizan transacciones comunes en el POS. Éstas impactan de inmediato el dinero teórico.</p>
                    
                    <div className="space-y-3">
                      <div className="border-t border-slate-150 pt-2">
                        <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Registrar Venta Directa en Caja Chica</label>
                        <div className="flex gap-1">
                          <input 
                            type="number" 
                            placeholder="Monto Venta $"
                            value={inputManualSale === 0 ? "" : inputManualSale}
                            onChange={e => setInputManualSale(Number(e.target.value))}
                            className="bg-white border p-1 rounded text-xs flex-1"
                          />
                          <select 
                            value={paymentType} 
                            onChange={e => setPaymentType(e.target.value as any)}
                            className="text-xs border rounded bg-white px-1 shrink-0"
                          >
                            <option value="Efectivo">Efectivo</option>
                            <option value="Digital">Digital (MP/Tarj.)</option>
                          </select>
                          <button 
                            onClick={() => handleAddMovement("ingreso")}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-2 py-1.5 rounded"
                          >
                            + Venta
                          </button>
                        </div>
                      </div>

                      <div className="border-t border-slate-150 pt-2">
                        <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Retiro de Caja (Gastos Menores / Proveedor)</label>
                        <div className="flex gap-1">
                          <input 
                            type="number" 
                            placeholder="Monto Egreso $"
                            value={inputManualExpense === 0 ? "" : inputManualExpense}
                            onChange={e => setInputManualExpense(Number(e.target.value))}
                            className="bg-white border p-1 rounded text-xs flex-1"
                          />
                          <button 
                            onClick={() => handleAddMovement("egreso")}
                            className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold px-2.5 py-1.5 rounded shrink-0"
                          >
                            - Egreso
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* FORMULARIO DE COUNT / CONTEO */}
                  <div className="bg-orange-50/20 p-4 rounded-xl border border-orange-100/50 space-y-3">
                    <h4 className="text-xs font-bold text-slate-700 uppercase">Paso 3: Conteo Físico Real (Arqueo)</h4>
                    <p className="text-[10px] text-slate-400 leading-normal">Ingresá el dinero exacto que contaste en el cajón de efectivo y en los portales digitales para calcular ajustes.</p>

                    <div className="space-y-3">
                      <div>
                        <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Efectivo Físico Contado ($)</label>
                        <input 
                          type="number" 
                          value={inputPhysicalCash}
                          onChange={e => setInputPhysicalCash(Number(e.target.value))}
                          className="bg-white border border-slate-300 p-2 rounded-lg text-xs font-bold w-full"
                        />
                      </div>

                      <div>
                        <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Saldo Digital Contado ($)</label>
                        <input 
                          type="number" 
                          value={inputPhysicalDigital}
                          onChange={e => setInputPhysicalDigital(Number(e.target.value))}
                          className="bg-white border border-slate-300 p-2 rounded-lg text-xs font-bold w-full"
                        />
                      </div>
                    </div>
                  </div>

                </div>

                {/* BOTON DE CIERRE */}
                <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-xs text-slate-400 flex items-center gap-1">
                    <CircleAlert size={14} className="text-slate-400 shrink-0" />
                    <span>Una vez cerrado, el arqueo diario generará los asientos de ajuste en el Libro Diario.</span>
                  </div>
                  <button 
                    onClick={handleCloseSession}
                    className="w-full sm:w-auto px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase rounded-xl tracking-wider shadow-sm transition"
                  >
                    Conciliar y Cerrar Caja
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 p-6 rounded-xl border border-slate-200/70 space-y-4 text-center animate-fade-in">
                <CheckCircle className="text-emerald-500 mx-auto" size={36} />
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-700">Caja de Turno Actualizada y Cerrada</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    La caja fue clausurada a las {cashSession.closedAt}. Podés inicializar una nueva sección configurando el saldo base de cambio.
                  </p>
                </div>

                <div className="max-w-xs mx-auto border-t border-slate-200 pt-3 flex gap-2">
                  <input 
                    type="number" 
                    placeholder="Saldo de Apertura $"
                    value={inputStartingBalance}
                    onChange={e => setInputStartingBalance(Number(e.target.value))}
                    className="bg-white border p-1 rounded-lg text-xs flex-1 text-center font-bold"
                  />
                  <button 
                    onClick={handleOpenBox}
                    className="p-2 px-4 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-bold uppercase shrink-0 transition"
                  >
                    Abrir Nueva Caja
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* CIERRE SIDEBAR: PANEL DE VERIFICACION TEORICA */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              <h4 className="text-xs font-black text-slate-800 uppercase pb-2 border-b border-indigo-50 flex items-center gap-1">
                <Coins size={14} className="text-indigo-600" />
                Matriz de Control Cierre
              </h4>

              {/* CASH BALANCES MATCHES */}
              <div className="space-y-3">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-[11px] space-y-1.5">
                  <span className="text-[9px] uppercase font-black text-slate-400 block font-mono">Efectivo Registrado (Caja 1.1.1.01):</span>
                  <div className="flex justify-between items-center text-slate-600 leading-normal">
                    <span>Apertura:</span>
                    <span className="font-bold">${cashSession.startingBalance}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600 leading-normal">
                    <span>Ventas Directas:</span>
                    <span className="font-bold text-emerald-600">+${cashSession.salesCash}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600 leading-normal">
                    <span>Salidas (Gasto/Prov):</span>
                    <span className="font-bold text-rose-600">-${cashSession.expensesCash}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-dashed border-slate-250 text-slate-800 font-bold leading-normal">
                    <span>Saldo Teórico:</span>
                    <span>${cashSession.theoreticalBalance}</span>
                  </div>
                  <div className="flex justify-between items-center text-indigo-700 leading-normal">
                    <span>Conteo Físico Real:</span>
                    <span className="font-black bg-white px-1.5 py-0.5 rounded shadow-2xs">${cashSession.physicalCountCash}</span>
                  </div>

                  {/* Discrepancy indicator */}
                  <div className={`flex justify-between items-center p-1.5 rounded text-[10px] uppercase font-bold ${cashSession.discrepancyCash === 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                    <span>Diferencia Efectivo:</span>
                    <span>
                      {cashSession.discrepancyCash === 0 ? "Sin desvíos" : `${cashSession.discrepancyCash > 0 ? "+" : ""}${cashSession.discrepancyCash}`}
                    </span>
                  </div>
                </div>

                {/* DIGITAL ACC matches */}
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-[11px] space-y-1.5">
                  <span className="text-[9px] uppercase font-black text-slate-400 block font-mono">Cartera Digital (Mercado Pago 1.1.1.03):</span>
                  <div className="flex justify-between items-center text-slate-600 leading-normal">
                    <span>Cobros Teóricos:</span>
                    <span className="font-bold">${cashSession.theoreticalDigital}</span>
                  </div>
                  <div className="flex justify-between items-center text-indigo-700 leading-normal">
                    <span>Fondos en App:</span>
                    <span className="font-black bg-white px-1.5 py-0.5 rounded shadow-2xs">${cashSession.physicalCountDigital}</span>
                  </div>

                  <div className={`flex justify-between items-center p-1.5 rounded text-[10px] uppercase font-bold ${cashSession.discrepancyDigital === 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                    <span>Diferencia Digital:</span>
                    <span>
                      {cashSession.discrepancyDigital === 0 ? "Sin desvíos" : `${cashSession.discrepancyDigital > 0 ? "+" : ""}${cashSession.discrepancyDigital}`}
                    </span>
                  </div>
                </div>
              </div>

              {/* INTEGRATION RULES FOR DEVELOPERS */}
              <div className="border border-orange-100 bg-orange-50/15 p-3 rounded-xl text-[10px] text-slate-500 leading-relaxed space-y-1">
                <span className="font-bold text-orange-600 block uppercase tracking-wider text-[9px]">Impacto contable automático diariamento:</span>
                <p><strong>Si hay faltante (Conteo &lt; Teórico):</strong> Se reconoce un egreso de explotación debitando "5.1.3 Sobrantes y Faltantes de Caja" y acreditando "1.1.1.01 Caja Chica".</p>
                <p className="mt-1"><strong>Si hay sobrante (Conteo &gt; Teórico):</strong> Se debita "1.1.1.01 Caja Chica" y se acredita como ganancia mercantil atípica "4.1.3 Sobrantes y Faltantes (Haber)".</p>
              </div>

            </div>
          </div>

        </div>
      )}

      {/* 3. Lógica Contable (Asiento automático) */}
      {activeSubTab === "asientos" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">

          {/* SIMULATION TRIGGERS */}
          <div className="lg:col-span-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-tight pb-2 border-b border-slate-50">Explorador de Asientos Automáticos</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Los operarios registran facturas y pagos; el sistema genera en segundo plano la contabilidad por partida doble (Debe = Haber). Hacé click en cualquier caso para ver el asiento contable real.
            </p>

            <div className="space-y-2 pt-2">
              {[
                { key: "venta_contado", title: "a) Venta Contado (50% efec. / 50% MP)", desc: "Se debita Caja y Mercado Pago y se acredita el Ingreso por Ventas." },
                { key: "venta_credito", title: "b) Venta en Cuenta Corriente", desc: "Se debita el Derecho a Cobro del cliente (Sin efectivo inmediato)" },
                { key: "pago_proveedor", title: "c) Pago Proveedor en Efectivo", desc: "Se reconoce el costo del servicio y se disminuye la Caja Chica." },
                { key: "cierre_con_faltante", title: "d) Cierre Diario de Caja Chica", desc: "Conciliación de saldos en el Libro Diario con reconocimiento de pérdidas." }
              ].map(item => (
                <button
                  key={item.key}
                  onClick={() => loadSimulation(item.key)}
                  className={`w-full text-left p-3.5 rounded-xl border transition text-xs space-y-1 block ${
                    selectedSimCase === item.key ? 'border-orange-500 bg-orange-50/15' : 'border-slate-100 hover:border-slate-250 bg-slate-50/50'
                  }`}
                >
                  <p className="font-bold text-slate-800">{item.title}</p>
                  <p className="text-[10px] text-slate-400 font-normal leading-normal">{item.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* DETALLES CONTABLES DEL ASIENTO */}
          <div className="lg:col-span-8 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between space-y-6">
            {simulatedEntry ? (
              <div className="space-y-6 animate-fade-in">
                <div className="pb-3 border-b border-slate-50 flex items-center justify-between">
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm leading-normal">{simulatedEntry.concept}</h4>
                    <span className="text-[10px] font-mono text-slate-400">Fecha del Asiento: {simulatedEntry.date}</span>
                  </div>
                  <span className="text-[9px] uppercase font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg font-mono">
                    PARTIDA DOBLE BALANCEADA
                  </span>
                </div>

                {/* TABLA DE ASIENTO CONTABLE */}
                <div className="border border-slate-100 rounded-xl overflow-hidden shadow-xs">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 font-bold text-slate-500 text-[10px] uppercase font-mono">
                        <th className="py-2.5 px-4">Código / Cuenta Contable</th>
                        <th className="py-2.5 px-4 text-right w-24">Debe ($)</th>
                        <th className="py-2.5 px-4 text-right w-24">Haber ($)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50/50 font-mono text-[11px]">
                      {/* Debit Accounts */}
                      {simulatedEntry.debits.map((deb, i) => (
                        <tr key={"deb-"+i} className="hover:bg-slate-50/20 text-slate-800 font-semibold">
                          <td className="py-3 px-4 flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full shrink-0"></span>
                            <span>{deb.account}</span>
                          </td>
                          <td className="py-3 px-4 text-right text-emerald-600 font-bold">${deb.amount.toLocaleString()}</td>
                          <td className="py-3 px-4 text-right text-slate-300">-</td>
                        </tr>
                      ))}

                      {/* Credit Accounts */}
                      {simulatedEntry.credits.map((cred, i) => (
                        <tr key={"cred-"+i} className="hover:bg-slate-50/20 text-slate-600 italic">
                          <td className="py-3 px-4 pl-8 flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 bg-orange-500 rounded-full shrink-0"></span>
                            <span>a {cred.account}</span>
                          </td>
                          <td className="py-3 px-4 text-right text-slate-300">-</td>
                          <td className="py-3 px-4 text-right text-orange-600 font-bold">${cred.amount.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* EXPLICACION CONSULTORIA CONTABLE */}
                <div className="bg-indigo-50/30 border border-indigo-100 p-4 rounded-xl text-xs space-y-1.5">
                  <span className="font-bold text-indigo-700 flex items-center gap-1">
                    <HelpCircle size={14} className="shrink-0" />
                    Explicación del Asiento (Pilar 3)
                  </span>
                  <p className="text-slate-600 leading-relaxed text-[11px]">
                    {simulatedEntry.explanation}
                  </p>
                </div>

              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-center text-slate-400 p-6">
                <Scale size={42} className="text-slate-300 mb-2 stroke-[1.5]" />
                <h4 className="text-xs font-bold text-slate-600 uppercase">Sin selección</h4>
                <p className="text-[10px] text-slate-400 max-w-xs mt-1">
                  Seleccioná uno de los ejemplos contables de la izquierda para analizar la lógica de doble entrada "detrás de escena".
                </p>
              </div>
            )}

            {/* BOTONES DE PERSISTENCIA SIMULADA */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-3">
              <span className="text-[10px] text-slate-400 font-mono">
                Perfectamente alineado con el motor fiscal y la normativa GAAP para control de stock de accesorios.
              </span>
              <button
                disabled={!simulatedEntry}
                onClick={() => {
                  showCelebration("¡Asiento de Partida Doble registrado con éxito y cuadrado en el Libro Mayor de Firestore!");
                }}
                className={`w-full sm:w-auto px-5 py-2.5 font-bold text-xs uppercase rounded-xl transition ${
                  simulatedEntry 
                    ? 'bg-orange-500 text-white hover:bg-orange-600 cursor-pointer shadow-sm' 
                    : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                }`}
              >
                Registrar en Libro Diario
              </button>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
