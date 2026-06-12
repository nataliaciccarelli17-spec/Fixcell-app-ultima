import React, { useState, useEffect, useRef } from "react";
import { 
  Scan, 
  ShoppingCart, 
  User, 
  Plus, 
  Minus, 
  Trash2, 
  CreditCard, 
  Wallet, 
  CheckCircle, 
  Search,
  DollarSign,
  Briefcase
} from "lucide-react";
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  addDoc,
  updateDoc, 
  query, 
  where 
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { Product, SaleItem, Sale, StockMovement, StockMovementType, ClientCrm, UserProfile } from "../types";
import Scanner from "./Scanner";

interface POSProps {
  userProfile: UserProfile;
  products: Product[];
  clients: ClientCrm[];
  onRefreshData: () => void;
}

export default function POS({ userProfile, products, clients, onRefreshData }: POSProps) {
  // POS States
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedClient, setSelectedClient] = useState<ClientCrm | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<Sale["metodoPago"]>("Efectivo");
  
  // Search state
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const [fastClientDni, setFastClientDni] = useState<string>("");
  const [fastClientNombre, setFastClientNombre] = useState<string>("");
  const [isAddingNewClient, setIsAddingNewClient] = useState<boolean>(false);
  
  // Checking states
  const [isCheckingOut, setIsCheckingOut] = useState<boolean>(false);
  const [successSale, setSuccessSale] = useState<Sale | null>(null);

  // Hidden scanner input helper for direct scanner focus
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Keep focus on searchable field for easy scans
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, []);

  // Add product to cart helper
  const addToCart = (product: Product) => {
    if (product.stockActual <= 0) {
      alert(`¡Alerta! ${product.nombre} no tiene stock disponible.`);
      return;
    }
    
    setCart(prevCart => {
      const existing = prevCart.find(item => item.productId === product.id);
      if (existing) {
        if (existing.cantidad >= product.stockActual) {
          alert(`No hay suficiente stock físico de ${product.nombre} (Stock actual: ${product.stockActual})`);
          return prevCart;
        }
        return prevCart.map(item => 
          item.productId === product.id 
            ? { ...item, cantidad: item.cantidad + 1, subtotal: (item.cantidad + 1) * item.precioVenta }
            : item
        );
      } else {
        return [...prevCart, {
          productId: product.id || "",
          nombre: product.nombre,
          precioVenta: product.precioVenta,
          precioCosto: product.precioCosto,
          cantidad: 1,
          subtotal: product.precioVenta
        }];
      }
    });

    setSearchQuery("");
  };

  // Search trigger by exact barcode scan or partial terms
  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    // Search exact barcode
    const matchByBarcode = products.find(p => p.codigoBarras.trim() === searchQuery.trim());
    if (matchByBarcode) {
      addToCart(matchByBarcode);
      return;
    }

    // Search internal code
    const matchByInternal = products.find(p => p.codigoInterno.toLowerCase() === searchQuery.toLowerCase());
    if (matchByInternal) {
      addToCart(matchByInternal);
      return;
    }

    // If search text length is large, notify matching multiple options or add closest match
    const multipleMatches = products.filter(p => 
      p.nombre.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.marcaCompatible.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.modeloCompatible.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (multipleMatches.length === 1) {
      addToCart(multipleMatches[0]);
    } else if (multipleMatches.length > 1) {
      // Multiple options matching, user will pick from the search list results below the input
    } else {
      alert("No se encontró ningún producto con ese código o término.");
    }
  };

  // Adjust Cart qty
  const updateQty = (productId: string, delta: number) => {
    const item = cart.find(i => i.productId === productId);
    if (!item) return;

    const product = products.find(p => p.id === productId);
    if (!product) return;

    const newQty = item.cantidad + delta;
    if (newQty <= 0) {
      setCart(prev => prev.filter(i => i.productId !== productId));
      return;
    }

    if (newQty > product.stockActual) {
      alert(`No podés agregar más de ${product.stockActual} unidades (Límite en inventario)`);
      return;
    }

    setCart(prev => prev.map(i => 
      i.productId === productId 
        ? { ...i, cantidad: newQty, subtotal: newQty * i.precioVenta }
        : i
    ));
  };

  // Remove totally
  const removeItem = (productId: string) => {
    setCart(prev => prev.filter(i => i.productId !== productId));
  };

  const handleScanSuccess = (barcode: string) => {
    setIsScannerOpen(false);
    const matched = products.find(p => p.codigoBarras === barcode);
    if (matched) {
      addToCart(matched);
    } else {
      alert(`Código escaneado: "${barcode}". No coincide con ningún accesorio cargado.`);
    }
  };

  // Register fast client CRM
  const handleCreateFastClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fastClientDni.trim() || !fastClientNombre.trim()) {
      alert("Faltan completar el DNI y el Nombre del cliente.");
      return;
    }

    try {
      const existingClient = clients.find(c => c.dni.trim() === fastClientDni.trim());
      if (existingClient) {
        setSelectedClient(existingClient);
        setIsAddingNewClient(false);
        return;
      }

      const path = "clientes_crm";
      const newClientRef = doc(collection(db, path));
      const clientPayload: ClientCrm = {
        id: newClientRef.id,
        dni: fastClientDni.trim(),
        nombre: fastClientNombre.trim(),
        email: "",
        telefono: "",
        direccion: "",
        ultimaVisita: new Date().toISOString(),
        comprasCount: 0,
        reparacionesCount: 0,
        montoGastadoTotal: 0,
        isVip: false
      };

      await setDoc(newClientRef, clientPayload);
      clients.push(clientPayload); // local update
      setSelectedClient(clientPayload);
      setIsAddingNewClient(false);
      setFastClientDni("");
      setFastClientNombre("");
      onRefreshData();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "clientes_crm");
    }
  };

  // Complete Venta checkout
  const handleCheckout = async () => {
    if (cart.length === 0) {
      alert("El carrito está vacío. Escanee un producto.");
      return;
    }

    setIsCheckingOut(true);
    try {
      const today = new Date().toISOString();
      const subtotal = cart.reduce((acc, curr) => acc + curr.subtotal, 0);
      
      // Calculate gains = Venta - Costo
      const costTotal = cart.reduce((acc, curr) => acc + (curr.precioCosto * curr.cantidad), 0);
      const gananciaTotal = subtotal - costTotal;

      const salePayload: Sale = {
        fecha: today,
        vendedorUid: userProfile.uid,
        vendedorNombre: userProfile.displayName || userProfile.email || "Empleado",
        metodoPago: paymentMethod,
        subtotal,
        gananciaTotal,
        items: cart,
        clienteDni: selectedClient ? selectedClient.dni : ""
      };

      // 1. Save Venta in Firestore
      const saleRef = doc(collection(db, "ventas"));
      await setDoc(saleRef, { ...salePayload, id: saleRef.id });

      // 2. Reduce Stock and Log Movements
      for (const cartItem of cart) {
        const product = products.find(p => p.id === cartItem.productId);
        if (product) {
          const newStock = Math.max(0, product.stockActual - cartItem.cantidad);
          
          // Update product stock
          await updateDoc(doc(db, "productos", product.id!), {
            stockActual: newStock
          });

          // Log movement
          const movementRef = doc(collection(db, "movimientos_stock"));
          const movementPayload: StockMovement = {
            id: movementRef.id,
            productId: product.id!,
            productName: product.nombre,
            cantidad: -cartItem.cantidad,
            tipo: StockMovementType.SALE,
            fecha: today,
            usuario: userProfile.displayName || userProfile.email || "Empleado",
            notas: `Venta registrada en POS (ID Venta: ${saleRef.id})`
          };
          await setDoc(movementRef, movementPayload);
        }
      }

      // 3. Update Client profile CRM stats if attached
      if (selectedClient && selectedClient.id) {
        const updatedSpent = selectedClient.montoGastadoTotal + subtotal;
        const updatedCount = selectedClient.comprasCount + 1;
        // Client fits VIP status if spent > $60.000 or has more than 5 purchases
        const meetsVip = updatedSpent >= 60000 || updatedCount >= 5;

        await updateDoc(doc(db, "clientes_crm", selectedClient.id), {
          montoGastadoTotal: updatedSpent,
          comprasCount: updatedCount,
          ultimaVisita: today,
          isVip: meetsVip
        });
      }

      setSuccessSale({ ...salePayload, id: saleRef.id });
      setCart([]);
      setSelectedClient(null);
      onRefreshData();
    } catch (err) {
      console.error(err);
      alert("Error procesando la venta en la base de datos.");
    } finally {
      setIsCheckingOut(false);
    }
  };

  // Math totals calculation
  const cartTotal = cart.reduce((acc, curr) => acc + curr.subtotal, 0);
  const cartGains = cart.reduce((acc, curr) => acc + ((curr.precioVenta - curr.precioCosto) * curr.cantidad), 0);

  // Formatter Currency
  const formatMoney = (value: number) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 0
    }).format(value);
  };

  // Filter products by typed search helper list
  const matchingDropdownOptions = searchQuery.trim()
    ? products.filter(p => 
        p.nombre.toLowerCase().includes(searchQuery.toLowerCase()) || 
        p.codigoBarras.includes(searchQuery) ||
        p.marcaCompatible.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.modeloCompatible.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 5)
    : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[calc(100vh-180px)]">
      
      {/* LEFT COLUMN: Search & Products picking */}
      <div className="lg:col-span-12 xl:col-span-8 flex flex-col gap-5">
        
        {/* Search Bar / Real-Time scanning input */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                id="pos-search-input"
                ref={barcodeInputRef}
                type="text"
                placeholder="Escribí el nombre del accesorio o escaneá con pistola lectora USB..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-slate-800 placeholder:text-slate-400 focus:placeholder:text-slate-300 border border-slate-200 focus:border-indigo-500 rounded-xl pl-11 pr-4 py-3 outline-hidden transition text-sm"
              />
            </div>
            
            <button
              id="barcode-scanner-launcher-btn"
              type="button"
              onClick={() => setIsScannerOpen(true)}
              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-bold p-3 rounded-xl transition flex items-center justify-center gap-1.5"
              title="Escanear con cámara del celular"
            >
              <Scan size={20} />
              <span className="hidden sm:inline text-xs">Cámara</span>
            </button>
            <button
              id="pos-search-btn"
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-3 rounded-xl transition text-sm flex items-center gap-1"
            >
              Agregar
            </button>
          </form>

          {/* Real-time search dropdown suggestions */}
          {matchingDropdownOptions.length > 0 && (
            <div className="mt-3 border border-slate-100 rounded-xl divide-slate-100 divide-y overflow-hidden shadow-lg bg-white">
              {matchingDropdownOptions.map(p => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className="w-full p-3.5 text-left hover:bg-slate-50 flex justify-between items-center transition"
                >
                  <div>
                    <div className="font-bold text-slate-800 text-sm">{p.nombre}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Comp: <span className="font-semibold text-slate-600">{p.marcaCompatible} {p.modeloCompatible}</span> • Color: {p.color} • Barras: {p.codigoBarras}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-extrabold text-slate-900 text-sm">{formatMoney(p.precioVenta)}</span>
                    <div className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-full mt-1 table ml-auto ${p.stockActual <= p.stockMinimo ? 'bg-rose-50 text-rose-500' : 'bg-slate-100 text-slate-500'}`}>
                      Stock: {p.stockActual}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Cart items list */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex-1 flex flex-col min-h-[350px]">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="text-indigo-600" size={20} />
              <h2 className="font-bold text-slate-800 tracking-tight">Detalle del Pedido</h2>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full">
              {cart.reduce((a, c) => a + c.cantidad, 0)} items
            </span>
          </div>

          {cart.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8">
              <ShoppingCart size={48} className="stroke-[1.2] mb-3 text-slate-300" />
              <p className="text-sm font-semibold">El carrito está listo esperando productos</p>
              <p className="text-[11px] text-slate-400 mt-1 max-w-xs text-center">Escanee accesorios con la pistola de barras o use el buscador superior buscando por 'Funda', 'Cargador', etc.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 overflow-y-auto max-h-[420px] flex-1">
              {cart.map((item) => (
                <div key={item.productId} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition duration-150">
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-800 text-sm uppercase">{item.nombre}</h4>
                    <span className="text-xs text-slate-500 mt-1 block">Precio Unitario: {formatMoney(item.precioVenta)}</span>
                  </div>

                  <div className="flex items-center justify-between sm:justify-start gap-4 shrink-0">
                    {/* Qty Adjustment */}
                    <div className="flex items-center gap-1.5 border border-slate-200 rounded-lg p-0.5 bg-slate-50">
                      <button
                        onClick={() => updateQty(item.productId, -1)}
                        className="p-1 hover:bg-white rounded text-slate-500 hover:text-slate-700 transition"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="font-bold font-mono text-xs w-6 text-center text-slate-800">{item.cantidad}</span>
                      <button
                        onClick={() => updateQty(item.productId, 1)}
                        className="p-1 hover:bg-white rounded text-slate-500 hover:text-slate-700 transition"
                      >
                        <Plus size={14} />
                      </button>
                    </div>

                    {/* Subtotal */}
                    <div className="w-24 text-right font-extrabold text-slate-900 text-sm">
                      {formatMoney(item.subtotal)}
                    </div>

                    {/* Trash Delete */}
                    <button
                      onClick={() => removeItem(item.productId)}
                      className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Instant checkout feedback */}
          {cart.length > 0 && (
            <div className="p-5 bg-slate-50/80 border-t border-slate-100 rounded-b-2xl">
              <div className="flex justify-between items-center text-xs font-bold text-slate-500 mb-1">
                <span>Costo Acumulado:</span>
                <span>{formatMoney(cart.reduce((a, c) => a + (c.precioCosto * c.cantidad), 0))}</span>
              </div>
              <div className="flex justify-between items-center text-xs font-bold text-emerald-600">
                <span>Rendimiento Estimado:</span>
                <span>+ {formatMoney(cartGains)} ({((cartGains / (cartTotal || 1)) * 100).toFixed(0)}% margen)</span>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* RIGHT COLUMN: Client Attachment & Payment Methods */}
      <div className="lg:col-span-12 xl:col-span-4 flex flex-col gap-5">
        
        {/* CRM Client attachment */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-50">
            <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5 leading-none">
              <User className="text-indigo-600" size={16} />
              Asociar Cliente CRM
            </h3>
            {!selectedClient && (
              <button
                id="toggle-fast-client-form-btn"
                onClick={() => setIsAddingNewClient(!isAddingNewClient)}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-500 active:scale-95 transition"
              >
                {isAddingNewClient ? "Buscar existente" : "+ Rápido"}
              </button>
            )}
          </div>

          {/* Form Create Fast Client */}
          {isAddingNewClient ? (
            <form onSubmit={handleCreateFastClient} className="space-y-3.5">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">DNI del Cliente *</label>
                <input
                  id="fast-client-dni-input"
                  type="text"
                  placeholder="Ej. 35123456"
                  value={fastClientDni}
                  onChange={(e) => setFastClientDni(e.target.value)}
                  className="w-full text-xs text-slate-800 placeholder:text-slate-400 border border-slate-200 rounded-xl px-3 py-2 outline-hidden"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Nombre Completo *</label>
                <input
                  id="fast-client-name-input"
                  type="text"
                  placeholder="Ej. Juan Pérez"
                  value={fastClientNombre}
                  onChange={(e) => setFastClientNombre(e.target.value)}
                  className="w-full text-xs text-slate-800 placeholder:text-slate-400 border border-slate-200 rounded-xl px-3 py-2 outline-hidden"
                  required
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  id="cancel-fast-client-btn"
                  type="button"
                  onClick={() => setIsAddingNewClient(false)}
                  className="flex-1 font-semibold text-slate-500 bg-slate-100 hover:bg-slate-200 transition text-[11px] py-1.5 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  id="submit-fast-client-btn"
                  type="submit"
                  className="flex-1 font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition text-[11px] py-1.5 rounded-lg"
                >
                  Crear y Asociar
                </button>
              </div>
            </form>
          ) : selectedClient ? (
            <div className="flex items-center justify-between p-3 bg-indigo-50/80 border border-indigo-100 rounded-xl">
              <div>
                <div className="font-extrabold text-sm text-indigo-900 uppercase">{selectedClient.nombre}</div>
                <div className="text-[11px] text-indigo-700 mt-0.5">DNI: {selectedClient.dni}</div>
                {selectedClient.isVip && (
                  <span className="inline-block mt-1 text-[9px] uppercase font-black bg-amber-500 text-white px-1.5 py-0.5 rounded">
                    ★ Cliente VIP
                  </span>
                )}
              </div>
              <button
                id="detach-client-btn"
                onClick={() => setSelectedClient(null)}
                className="text-[11px] font-black uppercase text-indigo-600 hover:text-rose-600 transition"
              >
                Quitar
              </button>
            </div>
          ) : (
            <div>
              <div className="relative mb-2">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  id="crm-search-input"
                  type="text"
                  placeholder="Escribí DNI para buscar..."
                  onChange={(e) => {
                    const match = clients.find(c => c.dni.includes(e.target.value));
                    if (match && e.target.value.length >= 4) {
                      setSelectedClient(match);
                      e.target.value = "";
                    }
                  }}
                  className="w-full text-xs text-slate-800 placeholder:text-slate-400 border border-slate-200 rounded-xl px-3 py-2 outline-hidden"
                />
              </div>
              <p className="text-[10px] text-slate-400">Si el cliente ya compró, podés escanear o escribir su DNI para sumar puntos.</p>
            </div>
          )}
        </div>

        {/* Payment Methods selector */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-4">
          <h3 className="font-extrabold text-slate-800 text-sm border-b border-slate-50 pb-2">
            Método de Pago
          </h3>

          <div className="grid grid-cols-2 gap-2">
            {(["Efectivo", "Débito", "Crédito", "Transferencia", "Mercado Pago"] as const).map(m => {
              const isSelected = paymentMethod === m;
              return (
                <button
                  key={m}
                  id={`paymethod-${m.replace(" ", "-").toLowerCase()}`}
                  onClick={() => setPaymentMethod(m)}
                  className={`p-3 rounded-xl border text-center transition flex flex-col items-center justify-center gap-1.5 active:scale-95 ${
                    isSelected 
                      ? "border-indigo-600 bg-indigo-50/50 text-indigo-700 font-bold" 
                      : "border-slate-200 hover:border-slate-300 text-slate-600 text-xs font-semibold"
                  }`}
                >
                  {m === "Efectivo" && <DollarSign size={16} />}
                  {(m === "Débito" || m === "Crédito") && <CreditCard size={16} />}
                  {m === "Transferencia" && <Briefcase size={16} />}
                  {m === "Mercado Pago" && <Wallet size={16} />}
                  <span className="text-[11px] whitespace-nowrap">{m}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Calculation billing total */}
        <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl flex flex-col gap-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs text-slate-400 font-bold">
              <span>SUBTOTAL</span>
              <span>{formatMoney(cartTotal)}</span>
            </div>
            <div className="flex justify-between items-center text-xs text-slate-400 font-bold">
              <span>DESCUENTO / IMPUESTO</span>
              <span>$0</span>
            </div>
            <div className="pt-2.5 border-t border-slate-800 flex justify-between items-center">
              <span className="text-xs uppercase font-extrabold text-indigo-300">Total a Cobrar</span>
              <span className="text-2xl font-black font-mono tracking-tight text-white">{formatMoney(cartTotal)}</span>
            </div>
          </div>

          <button
            id="checkout-finalize-btn"
            disabled={cart.length === 0 || isCheckingOut}
            onClick={handleCheckout}
            className="w-full bg-emerald-500 hover:bg-emerald-400 active:scale-98 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-black text-xs uppercase tracking-wider py-4 rounded-xl transition duration-200"
          >
            {isCheckingOut ? "Registrando Venta..." : "Finalizar y Cobrar"}
          </button>
        </div>

      </div>

      {/* Camera Barcode scanner popup */}
      {isScannerOpen && (
        <Scanner
          onScan={handleScanSuccess}
          onClose={() => setIsScannerOpen(false)}
          title="Scanear Accesorio"
        />
      )}

      {/* Success checkout popup receipt */}
      {successSale && (
        <div className="uuid-success-modal fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm text-center relative shadow-2xl border border-slate-100 animate-slide-up">
            <div className="h-14 w-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600 mb-4 scale-110">
              <CheckCircle size={32} />
            </div>
            
            <h3 className="text-lg font-black text-slate-800">¡Venta Exitosa!</h3>
            <p className="text-xs text-slate-400 mt-1">La transacción se guardó correctamente en Firebase y actualizó el stock.</p>

            {/* Simulated mini ticket */}
            <div className="border border-slate-100 bg-slate-50 rounded-xl p-4 my-4 text-left font-mono text-xs text-slate-700">
              <div className="text-center font-bold border-b border-dashed border-slate-200 pb-2 mb-2 uppercase text-[10px]">
                Comprobante de Venta
              </div>
              <div className="space-y-1">
                <div>ORDEN: <span className="font-bold">{successSale.id?.slice(-8).toUpperCase()}</span></div>
                <div>FECHA: {new Date(successSale.fecha).toLocaleDateString("es-AR")}</div>
                <div>VENDEDOR: {successSale.vendedorNombre}</div>
                <div>CLIENTE: {successSale.clienteDni || "Consumidor Final"}</div>
                <div>PAGO: {successSale.metodoPago}</div>
              </div>
              <div className="border-t border-dashed border-slate-250 py-2 my-2 space-y-1">
                {successSale.items.map((i, idx) => (
                  <div key={idx} className="flex justify-between uppercase text-[11px]">
                    <span>{i.cantidad}x {i.nombre.slice(0, 16)}</span>
                    <span>{formatMoney(i.subtotal)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between font-extrabold text-sm border-t border-dashed border-slate-200 pt-2 text-slate-900">
                <span>TOTAL:</span>
                <span>{formatMoney(successSale.subtotal)}</span>
              </div>
            </div>

            <button
              id="close-success-sale-modal-btn"
              onClick={() => setSuccessSale(null)}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl text-sm transition"
            >
              Comenzar Nueva Venta
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
