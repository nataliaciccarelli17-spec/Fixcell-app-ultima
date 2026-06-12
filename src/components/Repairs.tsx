import React, { useState, useRef, useEffect } from "react";
import { 
  Plus, 
  Wrench, 
  User, 
  Smartphone, 
  Clipboard, 
  ShieldAlert, 
  MessageSquare, 
  Activity, 
  CheckCircle,
  FileText,
  Trash2,
  Calendar,
  DollarSign,
  Camera,
  Layers,
  Search,
  Share2
} from "lucide-react";
import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  addDoc 
} from "firebase/firestore";
import { db } from "../firebase";
import { RepairOrder, RepairStatus, Product, StockMovement, StockMovementType, UserProfile, RepairPart, RepairStateLog } from "../types";

interface RepairsProps {
  userProfile: UserProfile;
  repairs: RepairOrder[];
  products: Product[];
  onRefreshData: () => void;
}

export default function Repairs({ userProfile, repairs, products, onRefreshData }: RepairsProps) {
  // Navigation internal tab
  const [activeSubTab, setActiveSubTab] = useState<"dashboard" | "new_order" | "list" | "tracker">("dashboard");

  // Selection/Filters
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [searchText, setSearchText] = useState<string>("");
  const [selectedRepair, setSelectedRepair] = useState<RepairOrder | null>(null);

  // Budgets creation
  const [selectedPartProduct, setSelectedPartProduct] = useState<Product | null>(null);
  const [partQty, setPartQty] = useState<number>(1);
  const [customLaborCost, setCustomLaborCost] = useState<number>(0);
  const [customTax, setCustomTax] = useState<number>(0);

  // Signature canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  // Public order search
  const [trackQuery, setTrackQuery] = useState("");
  const [trackedOrder, setTrackedOrder] = useState<RepairOrder | null>(null);

  // New repair form state
  const [formClientNombre, setFormClientNombre] = useState("");
  const [formClientDni, setFormClientDni] = useState("");
  const [formClientTelefono, setFormClientTelefono] = useState("");
  const [formClientEmail, setFormClientEmail] = useState("");
  const [formClientDireccion, setFormClientDireccion] = useState("");
  
  const [formDeviceMarca, setFormDeviceMarca] = useState("");
  const [formDeviceModelo, setFormDeviceModelo] = useState("");
  const [formDeviceImei, setFormDeviceImei] = useState("");
  const [formDeviceColor, setFormDeviceColor] = useState("");
  const [formDeviceSerial, setFormDeviceSerial] = useState("");
  const [formDevicePassword, setFormDevicePassword] = useState("");
  
  const [formEstadoFisico, setFormEstadoFisico] = useState("");
  const [formFallaReportada, setFormFallaReportada] = useState("");
  const [formFotoUrl, setFormFotoUrl] = useState(""); // base64 representation placeholder

  // States list
  const allStates = Object.values(RepairStatus);

  // Base currency format helper
  const formatMoney = (val: number) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 0
    }).format(val);
  };

  // Setup canvas drawing logic
  useEffect(() => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.strokeStyle = "#1e293b";
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
      }
    }
  }, [selectedRepair]);

  // Start Drawing signature
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    
    // Get mouse/touch relative coordinates
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  // Create new repair order
  const handleCreateOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formClientNombre.trim() || !formDeviceMarca.trim() || !formDeviceModelo.trim()) {
      alert("Completar Nombre, Marca y Modelo son obligatorios.");
      return;
    }

    try {
      const today = new Date().toISOString();
      // Generate standard order number increment
      const orderNumber = `OT-${1000 + repairs.length + 1}`;

      const repairPayload: RepairOrder = {
        numeroOrden: orderNumber,
        estado: RepairStatus.RECEIVED,
        fechaIngreso: today,
        tecnicoAsignado: userProfile.displayName || "Recepcionista",
        
        clienteNombre: formClientNombre.trim(),
        clienteDni: formClientDni.trim(),
        clienteTelefono: formClientTelefono.trim(),
        clienteEmail: formClientEmail.trim(),
        clienteDireccion: formClientDireccion.trim(),
        
        dispositivoMarca: formDeviceMarca.trim(),
        dispositivoModelo: formDeviceModelo.trim(),
        dispositivoImei: formDeviceImei.trim(),
        dispositivoColor: formDeviceColor.trim(),
        dispositivoSerial: formDeviceSerial.trim(),
        dispositivoPassword: formDevicePassword.trim(),
        
        estadoFisico: formEstadoFisico,
        fallaReportada: formFallaReportada,
        fotoUrl: formFotoUrl || "✨", // default simulation photo asset
        
        reparacionCostoRepuestos: 0,
        reparacionManoObra: 0,
        reparacionCobrado: 0,
        reparacionGanancia: 0,
        
        repuestosUtilizados: [],
        historialEstados: [
          {
            estado: RepairStatus.RECEIVED,
            fecha: today,
            usuario: userProfile.displayName || "Soporte",
            comentario: "Equipo ingresado al taller para diagnóstico."
          }
        ]
      };

      const newRef = doc(collection(db, "reparaciones"));
      await setDoc(newRef, { ...repairPayload, id: newRef.id });

      // Clean check-in fields
      setFormClientNombre("");
      setFormClientDni("");
      setFormClientTelefono("");
      setFormClientEmail("");
      setFormClientDireccion("");
      setFormDeviceMarca("");
      setFormDeviceModelo("");
      setFormDeviceImei("");
      setFormDeviceColor("");
      setFormDeviceSerial("");
      setFormDevicePassword("");
      setFormEstadoFisico("");
      setFormFallaReportada("");
      setFormFotoUrl("");

      setActiveSubTab("list");
      onRefreshData();
    } catch (e) {
      console.error(e);
      alert("Error registrando órden de servicio.");
    }
  };

  // Add Part used from stock to the budget
  const handleAddPartToBudget = async () => {
    if (!selectedRepair || !selectedPartProduct) return;
    if (selectedPartProduct.stockActual < partQty) {
      alert(`No hay stock suficiente de ${selectedPartProduct.nombre} (Dispo: ${selectedPartProduct.stockActual})`);
      return;
    }

    try {
      const today = new Date().toISOString();
      const updatedParts = [...(selectedRepair.repuestosUtilizados || [])];
      
      const newPart: RepairPart = {
        productId: selectedPartProduct.id!,
        nombre: selectedPartProduct.nombre,
        cantidad: partQty,
        precioCosto: selectedPartProduct.precioCosto,
        precioCobrabilidad: selectedPartProduct.precioVenta
      };
      
      updatedParts.push(newPart);

      // Automated stock reduction on parent product
      const nextStock = Math.max(0, selectedPartProduct.stockActual - partQty);
      await updateDoc(doc(db, "productos", selectedPartProduct.id!), {
        stockActual: nextStock
      });

      // Log Stock movement
      const movementRef = doc(collection(db, "movimientos_stock"));
      await setDoc(movementRef, {
        id: movementRef.id,
        productId: selectedPartProduct.id!,
        productName: selectedPartProduct.nombre,
        cantidad: -partQty,
        tipo: StockMovementType.REPAIR,
        fecha: today,
        usuario: userProfile.displayName || "Técnico",
        notas: `Consumido para Orden de Servicio Técnico [Orden: ${selectedRepair.numeroOrden}]`
      });

      // Recalculate cost
      const newPartsCost = updatedParts.reduce((acc, p) => acc + (p.precioCobrabilidad * p.cantidad), 0);
      const partsTotalCostOnly = updatedParts.reduce((acc, p) => acc + (p.precioCosto * p.cantidad), 0);
      
      const cobradoTotal = newPartsCost + customLaborCost + customTax;
      const gananciaTotal = cobradoTotal - partsTotalCostOnly - customLaborCost;

      await updateDoc(doc(db, "reparaciones", selectedRepair.id!), {
        repuestosUtilizados: updatedParts,
        reparacionCostoRepuestos: newPartsCost,
        reparacionCobrado: cobradoTotal,
        reparacionGanancia: gananciaTotal
      });

      const updatedSelected = {
        ...selectedRepair,
        repuestosUtilizados: updatedParts,
        reparacionCostoRepuestos: newPartsCost,
        reparacionCobrado: cobradoTotal,
        reparacionGanancia: gananciaTotal
      };
      setSelectedRepair(updatedSelected);
      setSelectedPartProduct(null);
      setPartQty(1);
      onRefreshData();
    } catch (e) {
      console.error(e);
      alert("Error agregando repuesto.");
    }
  };

  // Adjust labor or tax values
  const handleUpdateFinance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRepair) return;

    try {
      const partsTotalCostOnly = (selectedRepair.repuestosUtilizados || []).reduce((acc, p) => acc + (p.precioCosto * p.cantidad), 0);
      
      const cobradoTotal = selectedRepair.reparacionCostoRepuestos + Number(customLaborCost) + Number(customTax);
      const gananciaTotal = cobradoTotal - partsTotalCostOnly - Number(customLaborCost);

      await updateDoc(doc(db, "reparaciones", selectedRepair.id!), {
        reparacionManoObra: Number(customLaborCost),
        reparacionCobrado: cobradoTotal,
        reparacionGanancia: gananciaTotal
      });

      setSelectedRepair({
        ...selectedRepair,
        reparacionManoObra: Number(customLaborCost),
        reparacionCobrado: cobradoTotal,
        reparacionGanancia: gananciaTotal
      });
      onRefreshData();
      alert("Valores financieros actualizados con éxito.");
    } catch (err) {
      console.error(err);
    }
  };

  // Change Repair Status
  const handleStatusUpdate = async (newStatus: RepairStatus, comment: string) => {
    if (!selectedRepair) return;

    try {
      const today = new Date().toISOString();
      const updatedLogs = [...(selectedRepair.historialEstados || [])];
      
      const newLog: RepairStateLog = {
        estado: newStatus,
        fecha: today,
        usuario: userProfile.displayName || "Soporte",
        comentario: comment || `Estado cambiado a ${newStatus}`
      };

      updatedLogs.push(newLog);

      const updateData: any = {
        estado: newStatus,
        historialEstados: updatedLogs
      };

      // Set finish date on delivered Or ready
      if (newStatus === RepairStatus.DELIVERED || newStatus === RepairStatus.REPAIRED) {
        updateData.fechaEntrega = today;
      }

      await updateDoc(doc(db, "reparaciones", selectedRepair.id!), updateData);
      
      setSelectedRepair({
        ...selectedRepair,
        estado: newStatus,
        historialEstados: updatedLogs,
        fechaEntrega: updateData.fechaEntrega || selectedRepair.fechaEntrega
      });
      onRefreshData();
    } catch (e) {
      console.error(e);
    }
  };

  // Final delivery check with hand-drawn signature
  const handleDeliverAndSign = async () => {
    if (!selectedRepair || !hasSignature) return;

    try {
      const canvas = canvasRef.current;
      const signatureUrl = canvas ? canvas.toDataURL() : "";
      const today = new Date().toISOString();

      await updateDoc(doc(db, "reparaciones", selectedRepair.id!), {
        estado: RepairStatus.DELIVERED,
        firmaDigital: signatureUrl,
        fechaEntrega: today
      });

      // Also trigger state log
      handleStatusUpdate(RepairStatus.DELIVERED, "Entrega del dispositivo firmada digitalmente por el cliente.");
      alert("Entrega registrada con éxito. Dispositivo retirado.");
    } catch (err) {
      console.error(err);
    }
  };

  // Generate WhatsApp Notification Template links as per Section 11
  const getWhatsAppSharingLink = (order: RepairOrder) => {
    let text = "";
    const cleanPhone = order.clienteTelefono.replace(/[^0-9]/g, "");

    switch (order.estado) {
      case RepairStatus.RECEIVED:
        text = `Hola ${order.clienteNombre}, te informamos de FIXCELL que ingresamos tu equipo ${order.dispositivoMarca} ${order.dispositivoModelo} para diagnóstico de servicio técnico. Podés seguir el progreso con la orden ${order.numeroOrden}. ¡Gracias por confiar en nosotros!`;
        break;
      case RepairStatus.QUOTE_SENT:
        text = `Hola ${order.clienteNombre}, tenemos listo el presupuesto para tu equipo ${order.dispositivoMarca} ${order.dispositivoModelo}. El total es de ${formatMoney(order.reparacionCobrado)}. Aguardamos tu confirmación para proceder con el trabajo.`;
        break;
      case RepairStatus.REPAIRED:
      case RepairStatus.READY_TO_COLLECT:
        text = `¡Buenas noticias, ${order.clienteNombre}! Tu equipo ${order.dispositivoMarca} ${order.dispositivoModelo} ya se encuentra REPARADO y listo para retirar de nuestro local. Valor total: ${formatMoney(order.reparacionCobrado)}. ¡Te esperamos!`;
        break;
      default:
        text = `Hola ${order.clienteNombre}, tu equipo ${order.dispositivoMarca} ${order.dispositivoModelo} se encuentra en estado de reparación: "${order.estado}".`;
    }

    return `https://wa.me/${cleanPhone ? '54' + cleanPhone : ''}?text=${encodeURIComponent(text)}`;
  };

  // Public portal client tracking query finder
  const handlePortalTrackQuery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackQuery.trim()) return;

    const match = repairs.find(r => 
      r.numeroOrden.toLowerCase() === trackQuery.toLowerCase().trim() ||
      r.clienteDni.toLowerCase() === trackQuery.toLowerCase().trim()
    );

    if (match) {
      setTrackedOrder(match);
    } else {
      setTrackedOrder(null);
      alert("No se encontró ningún trabajo técnico activo asociado a este número u DNI.");
    }
  };

  // Filters repairs list
  const filteredRepairs = repairs.filter(r => {
    const matchesStatus = statusFilter === "All" || r.estado === statusFilter;
    const matchesSearch = 
      r.clienteNombre.toLowerCase().includes(searchText.toLowerCase()) ||
      r.clienteDni.includes(searchText) ||
      r.numeroOrden.toLowerCase().includes(searchText.toLowerCase()) ||
      r.dispositivoModelo.toLowerCase().includes(searchText.toLowerCase());

    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      
      {/* Sub Tabs navigation rail */}
      <div className="flex border-b border-slate-200">
        <button
          id="repairs-tab-dashboard"
          onClick={() => setActiveSubTab("dashboard")}
          className={`px-5 py-3 text-xs font-bold transition border-b-2 leading-none flex items-center gap-1.5 ${
            activeSubTab === "dashboard" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Activity size={14} />
          Panel Técnico
        </button>
        <button
          id="repairs-tab-new-order"
          onClick={() => setActiveSubTab("new_order")}
          className={`px-5 py-3 text-xs font-bold transition border-b-2 leading-none flex items-center gap-1.5 ${
            activeSubTab === "new_order" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Plus size={14} />
          Ingresar Equipo
        </button>
        <button
          id="repairs-tab-list"
          onClick={() => setActiveSubTab("list")}
          className={`px-5 py-3 text-xs font-bold transition border-b-2 leading-none flex items-center gap-1.5 ${
            activeSubTab === "list" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Clipboard size={14} />
          Órdenes de Trabajo ({repairs.length})
        </button>
        <button
          id="repairs-tab-portal"
          onClick={() => setActiveSubTab("tracker")}
          className={`px-5 py-3 text-xs font-bold transition border-b-2 leading-none flex items-center gap-1.5 ${
            activeSubTab === "tracker" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Search size={14} />
          Portal Cliente (Autoconsulta)
        </button>
      </div>

      {/* RENDER ACTIVE TUB-TABS */}

      {/* 1. Dashboard panel */}
      {activeSubTab === "dashboard" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Equipos Ingresados</div>
              <div className="text-2xl font-black text-slate-900 mt-1 font-mono">
                {repairs.filter(r => new Date(r.fechaIngreso).toDateString() === new Date().toDateString()).length}
                <span className="text-[11px] text-indigo-600 font-semibold uppercase ml-1.5 block sm:inline">Hoy</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Reparaciones Pendientes</div>
              <div className="text-2xl font-black text-amber-500 mt-1 font-mono">
                {repairs.filter(r => r.estado !== RepairStatus.DELIVERED && r.estado !== RepairStatus.CANCELLED).length}
                <span className="text-[10px] text-slate-400 font-normal ml-1">activos</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Listos para Retirar</div>
              <div className="text-2xl font-black text-emerald-500 mt-1 font-mono">
                {repairs.filter(r => r.estado === RepairStatus.REPAIRED || r.estado === RepairStatus.READY_TO_COLLECT).length}
                <span className="text-[10px] text-slate-400 font-normal ml-1">esperando</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Ganancias Servicio Técnico</div>
              <div className="text-2xl font-black text-slate-900 mt-1 font-mono">
                {formatMoney(repairs.filter(r => r.estado === RepairStatus.DELIVERED).reduce((acc, r) => acc + (r.reparacionGanancia || 0), 0))}
              </div>
            </div>

          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left box: recent repairs status */}
            <div className="lg:col-span-8 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <h3 className="font-extrabold text-slate-800 text-sm mb-4">Servicios Técnicos Activos en Taller</h3>
              <div className="space-y-3">
                {repairs.length === 0 ? (
                  <p className="p-4 text-center text-slate-400 text-xs">No hay reparaciones en ejecución.</p>
                ) : (
                  repairs.slice(0, 5).map(r => (
                    <div key={r.id} className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-800 text-xs">{r.numeroOrden}</span>
                          <span className="text-[10px] text-slate-400">• DNI: {r.clienteDni}</span>
                        </div>
                        <div className="font-bold uppercase text-slate-900 text-xs">{r.dispositivoMarca} {r.dispositivoModelo}</div>
                        <div className="text-[10px] text-slate-500">falla: {r.fallaReportada.slice(0, 32)}...</div>
                      </div>

                      <div className="text-right">
                        <span className={`inline-block text-[10px] uppercase font-bold px-2.5 py-1 rounded-full ${
                          r.estado === RepairStatus.READY_TO_COLLECT || r.estado === RepairStatus.REPAIRED
                            ? "bg-emerald-50 text-emerald-600"
                            : r.estado === RepairStatus.IN_REPAIR
                            ? "bg-indigo-50 text-indigo-600"
                            : "bg-amber-50 text-amber-600"
                        }`}>
                          {r.estado}
                        </span>
                        <div className="text-slate-900 font-extrabold font-mono text-xs mt-1">{formatMoney(r.reparacionCobrado)}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right box: checklist tracker */}
            <div className="lg:col-span-4 bg-gradient-to-br from-indigo-900 to-slate-950 text-white p-6 rounded-2xl shadow-xl flex flex-col justify-between">
              <div>
                <Wrench size={36} className="text-indigo-400 stroke-[1.25] mb-3" />
                <h3 className="font-black text-md">Control de Garantía y Retornos</h3>
                <p className="text-xs text-indigo-200 mt-2 leading-relaxed">
                  Todos los repuestos colocados y órdenes retiradas cuentan con alarma visible en caso de garantías vencidas o solicitudes de servicio.
                </p>
              </div>

              <div className="space-y-2 mt-4 pt-4 border-t border-indigo-950/40 text-xs text-indigo-100">
                <div className="flex justify-between">
                  <span>Repuestos en Stock:</span>
                  <span className="font-bold underline">{products.filter(p => p.categoria === "Repuestos").length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Equipos entregados:</span>
                  <span className="font-bold text-emerald-400 font-mono">{repairs.filter(r => r.estado === RepairStatus.DELIVERED).length} u</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 2. Check-in new Repair order Form */}
      {activeSubTab === "new_order" && (
        <form onSubmit={handleCreateOrderSubmit} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Clipboard className="text-indigo-600" size={18} />
            <h2 className="font-extrabold text-slate-800 text-sm">Formulario de Ingreso de Dispositivos</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Section A: Customer Details */}
            <div className="space-y-4">
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider text-indigo-600 border-b border-indigo-50 pb-1">1. Datos del Cliente</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Nombre y Apellido *</label>
                  <input
                    id="repair-form-client-name"
                    type="text"
                    placeholder="Ej. Carlos Bilardo"
                    value={formClientNombre}
                    onChange={(e) => setFormClientNombre(e.target.value)}
                    className="w-full text-xs text-slate-800 border border-slate-200 rounded-xl px-3 py-2 outline-hidden"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">DNI / Documento *</label>
                  <input
                    id="repair-form-client-dni"
                    type="text"
                    placeholder="Ej. 12345678"
                    value={formClientDni}
                    onChange={(e) => setFormClientDni(e.target.value)}
                    className="w-full text-xs text-slate-800 border border-slate-200 rounded-xl px-3 py-2 outline-hidden"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Celular de Contacto *</label>
                  <input
                    id="repair-form-client-phone"
                    type="text"
                    placeholder="Ej. 1162345678"
                    value={formClientTelefono}
                    onChange={(e) => setFormClientTelefono(e.target.value)}
                    className="w-full text-xs text-slate-800 border border-slate-200 rounded-xl px-3 py-2 outline-hidden"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Correo Electrónico</label>
                  <input
                    id="repair-form-client-email"
                    type="email"
                    placeholder="Ej. doctor@bilardo.com"
                    value={formClientEmail}
                    onChange={(e) => setFormClientEmail(e.target.value)}
                    className="w-full text-xs text-slate-800 border border-slate-200 rounded-xl px-3 py-2 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Dirección Física</label>
                  <input
                    id="repair-form-client-address"
                    type="text"
                    placeholder="Ej. Caballito, CABA"
                    value={formClientDireccion}
                    onChange={(e) => setFormClientDireccion(e.target.value)}
                    className="w-full text-xs text-slate-800 border border-slate-200 rounded-xl px-3 py-2 outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* Section B: Device Specifications */}
            <div className="space-y-4">
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider text-indigo-600 border-b border-indigo-50 pb-1">2. Datos del Dispositivo</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Marca *</label>
                  <input
                    id="repair-form-device-brand"
                    type="text"
                    placeholder="Ej. Motorola"
                    value={formDeviceMarca}
                    onChange={(e) => setFormDeviceMarca(e.target.value)}
                    className="w-full text-xs text-slate-800 border border-slate-200 rounded-xl px-3 py-2 outline-hidden"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Modelo *</label>
                  <input
                    id="repair-form-device-model"
                    type="text"
                    placeholder="Ej. Edge 50 Pro"
                    value={formDeviceModelo}
                    onChange={(e) => setFormDeviceModelo(e.target.value)}
                    className="w-full text-xs text-slate-800 border border-slate-200 rounded-xl px-3 py-2 outline-hidden"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Código IMEI (Opcional)</label>
                  <input
                    id="repair-form-device-imei"
                    type="text"
                    placeholder="IMEI del equipo"
                    value={formDeviceImei}
                    onChange={(e) => setFormDeviceImei(e.target.value)}
                    className="w-full text-xs text-slate-800 border border-slate-200 rounded-xl px-3 py-2 outline-hidden font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Color del Equipo</label>
                  <input
                    id="repair-form-device-color"
                    type="text"
                    placeholder="Ej. Blanco"
                    value={formDeviceColor}
                    onChange={(e) => setFormDeviceColor(e.target.value)}
                    className="w-full text-xs text-slate-800 border border-slate-200 rounded-xl px-3 py-2 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Patrón / Contraseña</label>
                  <input
                    id="repair-form-device-pw"
                    type="text"
                    placeholder="Patrón o PIN numérico"
                    value={formDevicePassword}
                    onChange={(e) => setFormDevicePassword(e.target.value)}
                    className="w-full text-xs text-slate-800 border border-slate-200 rounded-xl px-3 py-2 outline-hidden"
                  />
                </div>
              </div>
            </div>

          </div>

          {/* Section C: Inspection Diagnoses and photographs simulation */}
          <div className="pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Detalle de Falla Reportada *</label>
              <textarea
                id="repair-form-reported-flaw"
                placeholder="Ej. El teléfono se cayó en el agua y la pantalla se apaga sola o parpadea en color verde."
                value={formFallaReportada}
                onChange={(e) => setFormFallaReportada(e.target.value)}
                className="w-full text-xs text-slate-800 border border-slate-200 rounded-xl px-3 py-2 outline-hidden h-24"
                required
              />
            </div>
            
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Observaciones / Estado Estético Inicial</label>
              <textarea
                id="repair-form-physical-state"
                placeholder="Ej. Vidrio trasero rajado. Marcas de caídas en el marco lateral."
                value={formEstadoFisico}
                onChange={(e) => setFormEstadoFisico(e.target.value)}
                className="w-full text-xs text-slate-800 border border-slate-200 rounded-xl px-3 py-2 outline-hidden h-24"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-4 justify-end border-t border-slate-100">
            <button
              id="reset-new-order-form-btn"
              type="reset"
              onClick={() => setActiveSubTab("dashboard")}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-xs transition"
            >
              Cancelar
            </button>
            <button
              id="submit-new-order-btn"
              type="submit"
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl text-xs transition shadow-md"
            >
              Confirmar Ingreso y Generar Orden
            </button>
          </div>
        </form>
      )}

      {/* 3. Repairs list and Work orders details */}
      {activeSubTab === "list" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left panel: search and listing */}
          <div className="lg:col-span-5 space-y-4">
            
            {/* Quick search */}
            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex gap-2">
              <input
                id="repairs-search-list-input"
                type="text"
                placeholder="Buscar por DNI, Orden o Modelo..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="flex-1 text-slate-700 placeholder:text-slate-400 border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-hidden"
              />
              <select
                id="repairs-status-select-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs text-slate-600 border border-slate-200 rounded-lg px-2 bg-slate-50 outline-hidden font-bold"
              >
                <option value="All">Todos</option>
                {allStates.map(st => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
              {filteredRepairs.length === 0 ? (
                <p className="p-8 text-center text-slate-400 text-xs font-semibold">No se encontraron órdenes coincidentes.</p>
              ) : (
                filteredRepairs.map((r) => {
                  const isSelected = selectedRepair?.id === r.id;
                  return (
                    <button
                      key={r.id}
                      id={`repair-item-btn-${r.id}`}
                      onClick={() => {
                        setSelectedRepair(r);
                        setCustomLaborCost(r.reparacionManoObra || 0);
                        setCustomTax(0);
                      }}
                      className={`w-full p-4 text-left transition flex items-center justify-between border-l-4 leading-normal ${
                        isSelected 
                          ? "bg-slate-50 border-indigo-600 border-l-4" 
                          : "hover:bg-slate-50 border-transparent"
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900 text-xs">{r.numeroOrden}</span>
                          <span className="text-[10px] text-slate-450">{new Date(r.fechaIngreso).toLocaleDateString("es-AR")}</span>
                        </div>
                        <div className="font-bold text-slate-800 text-xs uppercase">{r.clienteNombre}</div>
                        <div className="text-[10px] text-slate-500 uppercase">{r.dispositivoMarca} {r.dispositivoModelo}</div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          r.estado === RepairStatus.DELIVERED
                            ? "bg-slate-100 text-slate-650"
                            : r.estado === RepairStatus.READY_TO_COLLECT
                            ? "bg-emerald-50 text-emerald-600"
                            : "bg-indigo-50 text-indigo-600"
                        }`}>
                          {r.estado}
                        </span>
                        <div className="font-extrabold text-slate-900 font-mono text-xs mt-1.5">{formatMoney(r.reparacionCobrado)}</div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

          </div>

          {/* Right panel: Detail, Budgets and actions */}
          <div className="lg:col-span-7">
            {selectedRepair ? (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden p-6 space-y-6">
                
                {/* Order header */}
                <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-md font-black text-slate-800">{selectedRepair.numeroOrden}</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        selectedRepair.estado === RepairStatus.DELIVERED ? "bg-slate-100 text-slate-600" : "bg-indigo-50 text-indigo-700"
                      }`}>
                        {selectedRepair.estado}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">Ingresado {new Date(selectedRepair.fechaIngreso).toLocaleString("es-AR")}</p>
                  </div>

                  {/* WhatsApp notificator quick trigger */}
                  <a
                    id="whastapp-notification-quick-link"
                    href={getWhatsAppSharingLink(selectedRepair)}
                    target="_blank"
                    referrerPolicy="no-referrer"
                    className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl transition flex items-center gap-1 text-[11px] font-bold"
                  >
                    <Share2 size={14} />
                    Cambio de estado
                  </a>
                </div>

                {/* Sub row with Client and Device information */}
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl text-xs">
                  <div>
                    <h4 className="font-bold text-slate-800 uppercase text-[10px] tracking-wider mb-1">Cliente</h4>
                    <p className="font-bold text-slate-900 leading-normal uppercase">{selectedRepair.clienteNombre}</p>
                    <p className="mt-0.5 text-slate-500">DNI: {selectedRepair.clienteDni}</p>
                    <p className="text-slate-500">Cel: {selectedRepair.clienteTelefono}</p>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 uppercase text-[10px] tracking-wider mb-1">Dispositivo</h4>
                    <p className="font-bold text-slate-900 leading-normal uppercase">{selectedRepair.dispositivoMarca} {selectedRepair.dispositivoModelo}</p>
                    <p className="mt-0.5 text-slate-500 font-mono">IME/S: {selectedRepair.dispositivoImei || "No cargado"}</p>
                    <p className="text-slate-500">Color: {selectedRepair.dispositivoColor || "Sin especificar"}</p>
                    {selectedRepair.dispositivoPassword && (
                      <p className="text-indigo-600 font-bold mt-1">Clave: {selectedRepair.dispositivoPassword}</p>
                    )}
                  </div>
                </div>

                {/* Status transitions slider */}
                <div className="space-y-2">
                  <h4 className="font-bold text-xs uppercase text-slate-400 font-bold tracking-wider">Flujo de Reparaciones (Actualizar Estado)</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {allStates.map(st => {
                      const isCurrent = selectedRepair.estado === st;
                      return (
                        <button
                          key={st}
                          id={`update-status-btn-${st.toLowerCase().replace(/ /g, "-")}`}
                          onClick={() => {
                            const comment = window.prompt(`Ingresá un comentario para el historial técnico de la reparación:`, `Estado modificado a ${st}`);
                            if (comment !== null) {
                              handleStatusUpdate(st, comment);
                            }
                          }}
                          className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition border flex items-center ${
                            isCurrent 
                              ? "bg-slate-900 border-slate-900 text-white" 
                              : "bg-white hover:bg-slate-50 border-slate-200 text-slate-600"
                          }`}
                        >
                          {st}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Diagnostic and budget details */}
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <h3 className="font-bold text-indigo-900 text-xs uppercase tracking-widest leading-none">Presupuesto y Repuestos Utilizados</h3>
                  
                  {/* Select repair part from catalog */}
                  <div className="flex gap-2">
                    <select
                      id="budget-part-select"
                      onChange={(e) => {
                        const prod = products.find(p => p.id === e.target.value);
                        setSelectedPartProduct(prod || null);
                      }}
                      className="flex-1 text-xs text-slate-800 border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 outline-hidden"
                    >
                      <option value="">Seleccionar repuesto o accesopio del stock...</option>
                      {products.filter(p => p.categoria === "Repuestos" || p.categoria === "Vidrios templados").map(p => (
                        <option key={p.id} value={p.id}>
                          {p.nombre} (Stock: {p.stockActual} u | Precio Venta: {formatMoney(p.precioVenta)})
                        </option>
                      ))}
                    </select>

                    <button
                      id="add-part-budget-btn"
                      disabled={!selectedPartProduct}
                      onClick={handleAddPartToBudget}
                      className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg text-xs hover:bg-indigo-500 disabled:bg-slate-100 disabled:text-slate-400 transition"
                    >
                      Añadir
                    </button>
                  </div>

                  {/* Registered parts used list */}
                  <div className="space-y-2">
                    {(selectedRepair.repuestosUtilizados && selectedRepair.repuestosUtilizados.length > 0) ? (
                      selectedRepair.repuestosUtilizados.map((part, index) => (
                        <div key={index} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg text-xs font-mono">
                          <span>{part.cantidad}x {part.nombre}</span>
                          <span className="font-bold">{formatMoney(part.precioCobrabilidad)}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-[11px] text-slate-400 italic">No se agregaron repuestos a esta orden todavía.</p>
                    )}
                  </div>

                  {/* Adjust Costs */}
                  <form onSubmit={handleUpdateFinance} className="grid grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl items-end text-xs">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Mano de Obra ($)</label>
                      <input
                        id="update-labor-input"
                        type="number"
                        value={customLaborCost}
                        onChange={(e) => setCustomLaborCost(Number(e.target.value))}
                        className="w-full border border-slate-200 rounded px-2.5 py-1 bg-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Impuestos / Gastos ($)</label>
                      <input
                        id="update-tax-input"
                        type="number"
                        value={customTax}
                        onChange={(e) => setCustomTax(Number(e.target.value))}
                        className="w-full border border-slate-200 rounded px-2.5 py-1 bg-white font-mono"
                      />
                    </div>
                    <button
                      id="save-budget-finance-btn"
                      type="submit"
                      className="py-1.5 bg-slate-900 text-white font-bold rounded transition text-xs leading-none hover:bg-slate-800"
                    >
                      Guardar
                    </button>
                  </form>
                </div>

                {/* Earnings Summary */}
                <div className="bg-slate-900 text-white p-5 rounded-xl flex justify-between items-center text-xs font-mono">
                  <div>
                    <div>COSTO REPUESTOS: {formatMoney(selectedRepair.reparacionCostoRepuestos || 0)}</div>
                    <div className="mt-0.5">MANO DE OBRA: {formatMoney(selectedRepair.reparacionManoObra || 0)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-emerald-400 font-extrabold text-sm uppercase">Ganancia Técnica: + {formatMoney(selectedRepair.reparacionGanancia || 0)}</div>
                    <div className="text-slate-400 font-extrabold text-base tracking-tight mt-1">Cobrado: {formatMoney(selectedRepair.reparacionCobrado || 0)}</div>
                  </div>
                </div>

                {/* Signature Delivery Tablet Section (Section 8) */}
                {selectedRepair.estado === RepairStatus.REPAIRED || selectedRepair.estado === RepairStatus.READY_TO_COLLECT ? (
                  <div className="border border-indigo-100 bg-indigo-50/50 p-5 rounded-2xl space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="font-extrabold text-xs uppercase text-slate-800 leading-none">Terminar Entrega y Firma Digital</h4>
                      <button
                        id="clear-signature-btn"
                        onClick={clearSignature}
                        className="text-[10px] font-bold uppercase text-indigo-600 hover:text-indigo-500"
                      >
                        Limpiar Firma
                      </button>
                    </div>

                    <canvas
                      ref={canvasRef}
                      width={400}
                      height={120}
                      className="w-full h-28 bg-white border border-slate-250 rounded-lg cursor-crosshair shadow-inner"
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                    />

                    <p className="text-[10px] text-slate-400 uppercase text-center leading-normal">Solicite al cliente firmar con el dedo sobre la tableta para emitir el comprobante.</p>

                    <button
                      id="deliver-signature-confirm-btn"
                      disabled={!hasSignature}
                      onClick={handleDeliverAndSign}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-200 disabled:text-slate-400 text-white font-extrabold py-3 rounded-xl text-xs uppercase tracking-wider transition"
                    >
                      Confirmar Entrega Guardando Firma
                    </button>
                  </div>
                ) : selectedRepair.firmaDigital ? (
                  <div className="border border-slate-100 p-4 rounded-xl bg-slate-50 space-y-2 text-xs">
                    <h4 className="font-bold text-[10px] uppercase text-slate-500 tracking-wide">Firma de Entrega Conformidad</h4>
                    <img 
                      src={selectedRepair.firmaDigital} 
                      alt="Firma del cliente" 
                      className="h-14 object-contain border border-slate-200 rounded bg-white p-1"
                    />
                    <div className="text-[10px] text-slate-400">Equipo retirado bajo conformidad del taller técnico.</div>
                  </div>
                ) : null}

                {/* History Logs */}
                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <h4 className="font-extrabold text-xs uppercase text-slate-400 tracking-wider">Historial Técnico</h4>
                  <div className="space-y-2.5 max-h-40 overflow-y-auto pr-1">
                    {selectedRepair.historialEstados && selectedRepair.historialEstados.map((log, idx) => (
                      <div key={idx} className="bg-slate-50 p-3 rounded-lg text-xs leading-normal">
                        <div className="flex justify-between font-bold text-slate-800">
                          <span className="uppercase">{log.estado}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{new Date(log.fecha).toLocaleString("es-AR")}</span>
                        </div>
                        <p className="text-slate-650 mt-1">{log.comentario}</p>
                        <span className="text-[9px] text-slate-400 uppercase mt-1 block">Técnico: {log.usuario}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            ) : (
              <div className="bg-slate-50 border border-dashed border-slate-200 p-12 text-center text-slate-400 rounded-2xl flex flex-col items-center justify-center min-h-[400px]">
                <Wrench className="text-slate-300 stroke-[1.25] mb-2" size={40} />
                <span className="text-sm font-semibold text-slate-600">Seleccioná una órden para ver los detalles técnicos</span>
                <span className="text-[11px] text-slate-400 mt-1 max-w-xs leading-relaxed">Podrás modificar estados, presupuestos, asociar repuestos deducidos de stock en tiempo real, e imprimir comprobantes.</span>
              </div>
            )}
          </div>

        </div>
      )}

      {/* 4. Tracking public center portal for clients */}
      {activeSubTab === "tracker" && (
        <div className="bg-slate-900 text-white rounded-3xl p-8 max-w-xl mx-auto shadow-2xl relative overflow-hidden">
          <div className="absolute right-0 top-0 h-40 w-40 bg-indigo-500/10 rounded-full blur-3xl" />
          
          <div className="text-center space-y-2 mb-6">
            <h2 className="text-xl font-black tracking-tight">Seguimiento de Reparaciones</h2>
            <p className="text-xs text-slate-400 leading-relaxed">Consultá el estado estimado de tu celular en tiempo real utilizando tu DNI o Número de Órden (sin llamadas).</p>
          </div>

          <form onSubmit={handlePortalTrackQuery} className="flex gap-2">
            <input
              id="tracker-portal-query-input"
              type="text"
              placeholder="Ej. OT-1001 o DNI del cliente..."
              value={trackQuery}
              onChange={(e) => setTrackQuery(e.target.value)}
              className="flex-1 bg-slate-800 border border-slate-700 focus:border-indigo-500 rounded-xl px-4 py-2 text-sm text-white placeholder:text-slate-500 font-mono outline-hidden tracking-widest transition"
            />
            <button
              id="tracker-submit-btn"
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-2 rounded-xl text-xs transition"
            >
              Buscar
            </button>
          </form>

          {/* Render result search panel */}
          {trackedOrder ? (
            <div className="mt-6 border border-slate-800 bg-slate-950/80 p-6 rounded-2xl space-y-4 animate-slide-up text-xs">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Dispositivo</span>
                  <div className="text-base font-extrabold uppercase mt-0.5 text-white">{trackedOrder.dispositivoMarca} {trackedOrder.dispositivoModelo}</div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Estado Actual</span>
                  <div className="mt-0.5 font-bold uppercase text-emerald-400 text-sm">{trackedOrder.estado}</div>
                </div>
              </div>

              <div className="border-t border-slate-800 pt-3 flex justify-between">
                <div>ORDEN: <span className="font-mono text-indigo-300 font-bold">{trackedOrder.numeroOrden}</span></div>
                <div>Estimado / Retiro: <span className="text-indigo-200">{trackedOrder.fechaEntrega ? new Date(trackedOrder.fechaEntrega).toLocaleDateString("es-AR") : "En diagnóstico continuo"}</span></div>
              </div>

              {/* Steps status timeline visually */}
              <div className="border-t border-slate-800 pt-4 space-y-2">
                <span className="text-[10px] uppercase text-slate-400 font-bold tracking-widest">Registros de Avance Técnico:</span>
                <div className="space-y-2 max-h-32 overflow-y-auto pr-1 text-[11px] text-slate-300">
                  {trackedOrder.historialEstados && trackedOrder.historialEstados.map((log, idx) => (
                    <div key={idx} className="bg-slate-900 p-2.5 rounded-lg border border-slate-800/40 leading-normal">
                      <div className="flex justify-between font-bold text-slate-200 text-[10px]">
                        <span>{log.estado}</span>
                        <span>{new Date(log.fecha).toLocaleDateString("es-AR")}</span>
                      </div>
                      <p className="mt-1 text-slate-400 leading-normal">{log.comentario}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-slate-800 pt-3 text-center text-[10px] text-slate-400">
                Garantía Otorgada: <span className="text-emerald-400 font-bold">90 Días sobre Trabajo de Reparación</span>
              </div>
            </div>
          ) : (
            trackQuery && (
              <div className="mt-6 text-center text-xs text-rose-400 p-4 border border-dashed border-rose-950/40 rounded-xl bg-rose-950/10">
                Ingresá un código válido de orden técnica o DNI para reflejar estado del dispositivo.
              </div>
            )
          )}
        </div>
      )}

    </div>
  );
}
