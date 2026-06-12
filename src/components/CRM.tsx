import React, { useState } from "react";
import { 
  User, 
  Search, 
  Sparkles, 
  Calendar, 
  DollarSign, 
  ShoppingBag, 
  Wrench, 
  ArrowUpRight,
  ShieldCheck,
  Plus
} from "lucide-react";
import { doc, setDoc, collection } from "firebase/firestore";
import { db } from "../firebase";
import { ClientCrm, Sale, RepairOrder, UserProfile } from "../types";

interface CRMProps {
  userProfile: UserProfile;
  clients: ClientCrm[];
  sales: Sale[];
  repairs: RepairOrder[];
  onRefreshData: () => void;
}

export default function CRM({ userProfile, clients, sales, repairs, onRefreshData }: CRMProps) {
  
  // Search state
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClient, setSelectedClient] = useState<ClientCrm | null>(null);

  // New Client Form
  const [showAddModal, setShowAddModal] = useState(false);
  const [formDni, setFormDni] = useState("");
  const [formNombre, setFormNombre] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formTelefono, setFormTelefono] = useState("");
  const [formDireccion, setFormDireccion] = useState("");

  const handleAddNewClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDni.trim() || !formNombre.trim()) {
      alert("Por favor complete DNI y Nombre.");
      return;
    }

    try {
      const today = new Date().toISOString();
      const clientRef = doc(collection(db, "clientes_crm"));
      
      const pld: ClientCrm = {
        id: clientRef.id,
        dni: formDni.trim(),
        nombre: formNombre.trim(),
        email: formEmail.trim(),
        telefono: formTelefono.trim(),
        direccion: formDireccion.trim(),
        ultimaVisita: today,
        comprasCount: 0,
        reparacionesCount: 0,
        montoGastadoTotal: 0,
        isVip: false
      };

      await setDoc(clientRef, pld);
      
      setFormDni("");
      setFormNombre("");
      setFormEmail("");
      setFormTelefono("");
      setFormDireccion("");
      setShowAddModal(false);
      onRefreshData();
      alert("Cliente registrado con éxito en el CRM.");
    } catch (err) {
      console.error(err);
    }
  };

  // Math calculation filters
  const filteredClients = clients.filter(c => 
    c.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.dni.includes(searchTerm) ||
    c.telefono.includes(searchTerm)
  );

  // Find Sales & Repairs for selected client
  const clientSales = selectedClient 
    ? sales.filter(s => s.clienteDni === selectedClient.dni) 
    : [];
    
  const clientRepairs = selectedClient 
    ? repairs.filter(r => r.clienteDni === selectedClient.dni) 
    : [];

  const formatMoney = (val: number) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 0
    }).format(val);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[calc(100vh-180px)]">
      
      {/* LEFT COLUMN: Client lists */}
      <div className="lg:col-span-5 flex flex-col gap-4">
        
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              id="crm-sidebar-search"
              type="text"
              placeholder="Buscar cliente por DNI o Nombre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-slate-700 placeholder:text-slate-400 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs outline-hidden"
            />
          </div>
          
          <button
            id="open-crm-add-modal"
            onClick={() => setShowAddModal(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold p-2.5 rounded-lg text-xs leading-none transition"
          >
            <Plus size={14} />
          </button>
        </div>

        {/* Clients Directory */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
          {filteredClients.length === 0 ? (
            <p className="p-8 text-center text-slate-400 text-xs">No hay clientes emparejados.</p>
          ) : (
            filteredClients.map(c => {
              const isSelected = selectedClient?.id === c.id;
              return (
                <button
                  key={c.id}
                  id={`crm-client-item-${c.id}`}
                  onClick={() => setSelectedClient(c)}
                  className={`w-full p-4 text-left transition flex items-center justify-between border-l-4 leading-normal ${
                    isSelected 
                      ? "bg-slate-50 border-indigo-600 border-l-4" 
                      : "hover:bg-slate-50 border-transparent"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-extrabold text-slate-900 text-xs uppercase">{c.nombre}</span>
                      {c.isVip && (
                        <span className="text-[9px] uppercase font-bold bg-amber-400 text-slate-950 px-1.5 rounded-full flex items-center gap-0.5">
                          <Sparkles size={8} /> VIP
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400">DNI: {c.dni} • Cel: {c.telefono || "S/N"}</div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-slate-900 font-extrabold font-mono text-xs">{formatMoney(c.montoGastadoTotal)}</div>
                    <span className="text-[9px] text-slate-400 font-semibold block mt-0.5">Último: {new Date(c.ultimaVisita).toLocaleDateString("es-AR")}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>

      </div>

      {/* RIGHT COLUMN: Active Client history inspect */}
      <div className="lg:col-span-7">
        {selectedClient ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
            
            {/* Header cards */}
            <div className="flex justify-between items-start border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-md font-black text-slate-800 uppercase flex items-center gap-1.5">
                  <User className="text-indigo-600" size={18} />
                  {selectedClient.nombre}
                </h2>
                <p className="text-xs text-slate-400 mt-1 uppercase">DNI: {selectedClient.dni} • email: {selectedClient.email || "no registrado"}</p>
              </div>

              {selectedClient.isVip && (
                <span className="bg-amber-50 border border-amber-200 text-amber-700 font-bold px-3 py-1 rounded-xl text-[10px] flex items-center gap-1">
                  ★ CLIENTE VIP CONSOLIDADO
                </span>
              )}
            </div>

            {/* Quick calculations metrics */}
            <div className="grid grid-cols-3 gap-2.5 text-xs font-mono">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100/60">
                <div className="text-[9px] uppercase font-bold text-slate-400 mb-1 flex items-center gap-1">
                  <ShoppingBag size={11} className="text-slate-400" />
                  Compras POS
                </div>
                <div className="font-extrabold text-slate-800 text-sm">{clientSales.length} u</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100/60">
                <div className="text-[9px] uppercase font-bold text-slate-400 mb-1 flex items-center gap-1">
                  <Wrench size={11} className="text-slate-400" />
                  Servicios reparaciones
                </div>
                <div className="font-extrabold text-slate-800 text-sm">{clientRepairs.length} u</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100/60">
                <div className="text-[9px] uppercase font-bold text-slate-400 mb-1 flex items-center gap-1">
                  <DollarSign size={11} className="text-slate-400" />
                  Monto Estimado
                </div>
                <div className="font-extrabold text-emerald-600 text-sm">{formatMoney(selectedClient.montoGastadoTotal)}</div>
              </div>
            </div>

            {/* Purchases log */}
            <div className="space-y-3.5">
              <h3 className="font-bold text-xs uppercase text-slate-450 tracking-wider">Historial de Compras de Accesorios</h3>
              
              {clientSales.length === 0 ? (
                <p className="text-[11px] text-slate-400 italic">Este cliente no registra compras POS todavía.</p>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {clientSales.map((s) => (
                    <div key={s.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex justify-between items-center text-xs">
                      <div>
                        <div className="font-bold text-slate-800">Orden {s.id?.slice(-6).toUpperCase()}</div>
                        <div className="text-[10px] text-slate-400">{new Date(s.fecha).toLocaleString("es-AR")}</div>
                        <div className="text-[10px] font-semibold text-indigo-600 mt-1">
                          {s.items.map(i => `${i.cantidad}x ${i.nombre}`).join(", ")}
                        </div>
                      </div>
                      <div className="text-right font-extrabold text-slate-900">
                        {formatMoney(s.subtotal)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Repair log */}
            <div className="space-y-3.5 border-t border-slate-100 pt-4">
              <h3 className="font-bold text-xs uppercase text-slate-450 tracking-wider">Historial de Servicio Técnico</h3>
              
              {clientRepairs.length === 0 ? (
                <p className="text-[11px] text-slate-400 italic">Este cliente no registra reparaciones en el taller.</p>
              ) : (
                <div className="space-y-2 max-h-45 overflow-y-auto">
                  {clientRepairs.map((r) => (
                    <div key={r.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex justify-between items-center text-xs">
                      <div>
                        <div className="font-bold text-slate-800">{r.numeroOrden} • {r.dispositivoMarca} {r.dispositivoModelo}</div>
                        <div className="text-[10px] text-slate-400">Ingreso: {new Date(r.fechaIngreso).toLocaleDateString("es-AR")}</div>
                        <div className="text-[10px] text-slate-500 mt-1 font-semibold block uppercase">Estado: {r.estado}</div>
                      </div>
                      <div className="text-right font-extrabold text-slate-900">
                        {formatMoney(r.reparacionCobrado)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        ) : (
          <div className="bg-slate-50 border border-dashed border-slate-250 p-12 text-center text-slate-400 rounded-2xl flex flex-col items-center justify-center min-h-[400px]">
            <User className="text-slate-300 stroke-[1.25] mb-2" size={40} />
            <span className="text-sm font-semibold text-slate-600">Seleccioná un cliente del CRM unificado</span>
            <span className="text-[11px] text-slate-400 mt-1 max-w-xs leading-relaxed">Podrás visualizar toda su ficha de compras, reparaciones de taller, fidelidad y facturación histórica acumulada.</span>
          </div>
        )}
      </div>

      {/* CRM registration modal */}
      {showAddModal && (
        <div className="form-add-crm-modal fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md border border-slate-150 shadow-2xl relative">
            <h3 className="text-md font-bold text-slate-800">Registrar Nuevo Cliente Frecuente</h3>

            <form onSubmit={handleAddNewClient} className="mt-4 space-y-3">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">DNI del Cliente *</label>
                <input
                  id="crm-dni-modal-input"
                  type="text"
                  placeholder="Ej. 34123456"
                  value={formDni}
                  onChange={(e) => setFormDni(e.target.value)}
                  className="w-full text-xs text-slate-800 border border-slate-200 rounded-xl px-3 py-2 outline-hidden"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Nombre Completo *</label>
                <input
                  id="crm-name-modal-input"
                  type="text"
                  placeholder="Ej. Martín Palermo"
                  value={formNombre}
                  onChange={(e) => setFormNombre(e.target.value)}
                  className="w-full text-xs text-slate-800 border border-slate-200 rounded-xl px-3 py-2 outline-hidden"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Teléfono Móvil</label>
                <input
                  id="crm-phone-modal-input"
                  type="text"
                  placeholder="Ej. 1150009999"
                  value={formTelefono}
                  onChange={(e) => setFormTelefono(e.target.value)}
                  className="w-full text-xs text-slate-800 border border-slate-200 rounded-xl px-3 py-2 outline-hidden"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Email</label>
                <input
                  id="crm-email-modal-input"
                  type="email"
                  placeholder="Ej. martin@gols.com"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full text-xs text-slate-800 border border-slate-200 rounded-xl px-3 py-2 outline-hidden"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Dirección</label>
                <input
                  id="crm-address-modal-input"
                  type="text"
                  placeholder="Ej. La Boca, CABA"
                  value={formDireccion}
                  onChange={(e) => setFormDireccion(e.target.value)}
                  className="w-full text-xs text-slate-800 border border-slate-200 rounded-xl px-3 py-2 outline-hidden"
                />
              </div>

              <div className="flex gap-2 pt-3 border-t border-slate-100">
                <button
                  id="cancel-crm-modal-btn"
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2 bg-slate-100 text-slate-500 font-bold rounded-xl text-xs hover:bg-slate-200 transition"
                >
                  Cancelar
                </button>
                <button
                  id="submit-crm-modal-btn"
                  type="submit"
                  className="flex-1 py-1 px-5 bg-indigo-600 text-white font-bold rounded-xl text-xs hover:bg-indigo-505 transition"
                >
                  Crear Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
