import React, { useState } from "react";
import { 
  Plus, 
  Edit, 
  Trash2, 
  AlertTriangle, 
  Search, 
  ArrowUpRight, 
  ArrowDownRight, 
  SlidersHorizontal,
  Bookmark,
  Smartphone,
  Eye,
  RefreshCw,
  Printer
} from "lucide-react";
import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  addDoc 
} from "firebase/firestore";
import { db } from "../firebase";
import { Product, StockMovement, StockMovementType, UserProfile, UserRole } from "../types";
import BarcodeGenerator from "./BarcodeGenerator";

interface InventoryProps {
  userProfile: UserProfile;
  products: Product[];
  onRefreshData: () => void;
}

export default function Inventory({ userProfile, products, onRefreshData }: InventoryProps) {
  const isAdmin = userProfile.role === UserRole.ADMIN;

  // Search/Filters
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [onlyLowStock, setOnlyLowStock] = useState<boolean>(false);

  // Modal active flags
  const [showFormModal, setShowFormModal] = useState<boolean>(false);
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState<boolean>(false);
  const [productForAdjustment, setProductForAdjustment] = useState<Product | null>(null);
  const [adjustmentQty, setAdjustmentQty] = useState<number>(0);
  const [adjustmentNotes, setAdjustmentNotes] = useState<string>("Ajuste manual de control");
  
  // Barcode printed sticker
  const [selectedBarcodeProduct, setSelectedBarcodeProduct] = useState<Product | null>(null);

  // Product Form states
  const [formCodigoInterno, setFormCodigoInterno] = useState("");
  const [formCodigoBarras, setFormCodigoBarras] = useState("");
  const [formNombre, setFormNombre] = useState("");
  const [formCategoria, setFormCategoria] = useState("Fundas");
  const [formMarca, setFormMarca] = useState("");
  const [formDescripcion, setFormDescripcion] = useState("");
  const [formPrecioCosto, setFormPrecioCosto] = useState<number>(0);
  const [formPrecioVenta, setFormPrecioVenta] = useState<number>(0);
  const [formStockActual, setFormStockActual] = useState<number>(0);
  const [formStockMinimo, setFormStockMinimo] = useState<number>(2);
  const [formProveedor, setFormProveedor] = useState("");
  const [formMarcaCompatible, setFormMarcaCompatible] = useState("");
  const [formModeloCompatible, setFormModeloCompatible] = useState("");
  const [formColor, setFormColor] = useState("");

  // Categories helper
  const categoriesList = ["Fundas", "Vidrios templados", "Cables USB", "Cargadores", "Auriculares", "Power Banks", "Parlantes Bluetooth", "Repuestos"];

  // Open insert/edit modal helper
  const openProductForm = (product: Product | null = null) => {
    if (product) {
      setCurrentProduct(product);
      setFormCodigoInterno(product.codigoInterno || "");
      setFormCodigoBarras(product.codigoBarras || "");
      setFormNombre(product.nombre || "");
      setFormCategoria(product.categoria || "Fundas");
      setFormMarca(product.marca || "");
      setFormDescripcion(product.descripcion || "");
      setFormPrecioCosto(product.precioCosto || 0);
      setFormPrecioVenta(product.precioVenta || 0);
      setFormStockActual(product.stockActual || 0);
      setFormStockMinimo(product.stockMinimo || 2);
      setFormProveedor(product.proveedor || "");
      setFormMarcaCompatible(product.marcaCompatible || "");
      setFormModeloCompatible(product.modeloCompatible || "");
      setFormColor(product.color || "");
    } else {
      setCurrentProduct(null);
      // Auto-generate high density unique barcode for newly registers
      const numCode = Math.floor(100000000000 + Math.random() * 900000000000).toString();
      setFormCodigoInterno(`ACC-${products.length + 101}`);
      setFormCodigoBarras(numCode);
      setFormNombre("");
      setFormCategoria("Fundas");
      setFormMarca("");
      setFormDescripcion("");
      setFormPrecioCosto(0);
      setFormPrecioVenta(0);
      setFormStockActual(0);
      setFormStockMinimo(2);
      setFormProveedor("");
      setFormMarcaCompatible("");
      setFormModeloCompatible("");
      setFormColor("");
    }
    setShowFormModal(true);
  };

  // Submit product create/update
  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCodigoBarras.trim() || !formNombre.trim()) {
      alert("Faltan completar campos obligatorios.");
      return;
    }

    try {
      const today = new Date().toISOString();
      const productPayload: Omit<Product, "id"> = {
        codigoInterno: formCodigoInterno,
        codigoBarras: formCodigoBarras.trim(),
        nombre: formNombre.trim(),
        categoria: formCategoria,
        marca: formMarca.trim(),
        descripcion: formDescripcion,
        precioCosto: Number(formPrecioCosto),
        precioVenta: Number(formPrecioVenta),
        stockActual: Number(formStockActual),
        stockMinimo: Number(formStockMinimo),
        proveedor: formProveedor,
        fechaIngreso: currentProduct ? currentProduct.fechaIngreso : today,
        marcaCompatible: formMarcaCompatible,
        modeloCompatible: formModeloCompatible,
        color: formColor,
        tipoAccesorio: formCategoria
      };

      if (currentProduct && currentProduct.id) {
        // Update product document
        await updateDoc(doc(db, "productos", currentProduct.id), productPayload as any);
      } else {
        // Create new product doc
        const newRef = doc(collection(db, "productos"));
        await setDoc(newRef, { ...productPayload, id: newRef.id });
      }

      setShowFormModal(false);
      onRefreshData();
    } catch (err) {
      console.error(err);
      alert("Error guardando el accesorio en Firestore.");
    }
  };

  // Delete product helper
  const handleDeleteProduct = async (id: string) => {
    if (!isAdmin) {
      alert("Solo el Administrador puede eliminar productos de inventario.");
      return;
    }

    if (window.confirm("¿Estás seguro de que querés eliminar permanentemente este producto del inventario?")) {
      try {
        await deleteDoc(doc(db, "productos", id));
        onRefreshData();
      } catch (err) {
        console.error(err);
        alert("Error eliminando producto.");
      }
    }
  };

  // Trigger manual stock adjustments
  const openAdjustmentModal = (product: Product) => {
    setProductForAdjustment(product);
    setAdjustmentQty(0);
    setAdjustmentNotes("Ajuste manual de control");
    setShowAdjustmentModal(true);
  };

  const handleAdjustmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForAdjustment || adjustmentQty === 0) return;

    try {
      const today = new Date().toISOString();
      const newStock = Math.max(0, productForAdjustment.stockActual + adjustmentQty);

      // 1. Update stock
      await updateDoc(doc(db, "productos", productForAdjustment.id!), {
        stockActual: newStock
      });

      // 2. Log movement stock
      const movementRef = doc(collection(db, "movimientos_stock"));
      const movementPayload: StockMovement = {
        id: movementRef.id,
        productId: productForAdjustment.id!,
        productName: productForAdjustment.nombre,
        cantidad: adjustmentQty,
        tipo: adjustmentQty > 0 ? StockMovementType.ENTRY : StockMovementType.ADJUSTMENT,
        fecha: today,
        usuario: userProfile.displayName || userProfile.email || "Empleado",
        notas: adjustmentNotes
      };
      await setDoc(movementRef, movementPayload);

      setShowAdjustmentModal(false);
      onRefreshData();
    } catch (err) {
      console.error(err);
      alert("Error registrando ajuste.");
    }
  };

  // Filter logic
  const filteredProducts = products.filter(p => {
    const matchesSearch = 
      p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.codigoBarras.includes(searchTerm) ||
      p.codigoInterno.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.marcaCompatible.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.modeloCompatible.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = selectedCategory === "All" || p.categoria === selectedCategory;
    const matchesLowStock = !onlyLowStock || p.stockActual <= p.stockMinimo;

    return matchesSearch && matchesCategory && matchesLowStock;
  });

  // Calculate sum counts
  const totalItemsCount = products.reduce((acc, p) => acc + p.stockActual, 0);
  const totalCostValuation = products.reduce((acc, p) => acc + (p.precioCosto * p.stockActual), 0);
  const totalSaleValuation = products.reduce((acc, p) => acc + (p.precioVenta * p.stockActual), 0);

  // Formatter money
  const formatMoney = (val: number) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 0
    }).format(val);
  };

  return (
    <div className="space-y-6">
      
      {/* Top action header and general inventories valuation stats */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-800 tracking-tight">Catálogo de Productos y Repuestos</h1>
          <p className="text-xs text-slate-500 mt-1">Controlá, imprimí etiquetas y ajustá existencias de accesorios.</p>
        </div>

        {isAdmin && (
          <button
            id="register-new-product-btn"
            onClick={() => openProductForm()}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2.5 rounded-xl transition shadow-md hover:shadow-lg active:scale-95 text-xs flex items-center gap-1.5"
          >
            <Plus size={16} />
            Registrar Producto
          </button>
        )}
      </div>

      {/* Stock Value cards block */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Unidades en Stock</div>
          <div className="text-2xl font-black text-slate-900 mt-1 font-mono">{totalItemsCount} <span className="text-xs text-slate-400 font-normal">items</span></div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Valor de Costo en Depósito</div>
          <div className="text-2xl font-black text-slate-900 mt-1 font-mono">{formatMoney(totalCostValuation)}</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Valor Estimado de Venta</div>
          <div className="text-2xl font-black text-emerald-600 mt-1 font-mono">{formatMoney(totalSaleValuation)}</div>
        </div>
      </div>

      {/* Filtering area */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between">
        
        {/* Search Input text fields */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            id="inventory-search-query-input"
            type="text"
            placeholder="Buscar por nombre, compatible, barras..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-slate-700 placeholder:text-slate-400 border border-slate-200 focus:border-indigo-500 rounded-xl pl-9 pr-3 py-2 outline-hidden transition text-xs"
          />
        </div>

        {/* Categories filters */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <select
            id="inventory-category-select-filter"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="text-xs text-slate-700 border border-slate-200 rounded-xl px-3 py-2 outline-hidden bg-slate-50 font-semibold"
          >
            <option value="All">Todas las Categorías</option>
            {categoriesList.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* Low stock checkbox action */}
          <button
            id="filter-low-stock-btn"
            onClick={() => setOnlyLowStock(!onlyLowStock)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border transition flex items-center gap-1 ${
              onlyLowStock 
                ? "bg-rose-50 border-rose-200 text-rose-600 font-bold" 
                : "border-slate-250 bg-white hover:bg-slate-50 text-slate-600"
            }`}
          >
            <AlertTriangle size={14} />
            Stock Bajo ({products.filter(p => p.stockActual <= p.stockMinimo).length})
          </button>
        </div>

      </div>

      {/* Stock list table Grid row */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100 text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                <th className="p-4 pl-6">Accesorio</th>
                <th className="p-4">Compatibilidad</th>
                <th className="p-4">Código / Barras</th>
                <th className="p-4">Costo</th>
                <th className="p-4">Venta</th>
                <th className="p-4">Existencia</th>
                <th className="p-4 text-center pr-6">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 leading-normal">
                    No se encontraron productos coincidentes en el inventario.
                  </td>
                </tr>
              ) : (
                filteredProducts.map(p => {
                  const isLow = p.stockActual <= p.stockMinimo;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/40 transition">
                      
                      {/* Name / Description */}
                      <td className="p-4 pl-6">
                        <div className="font-extrabold text-slate-900 uppercase">{p.nombre}</div>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-1">
                          <span className="bg-slate-100 px-2 py-0.5 rounded-full font-semibold">{p.categoria}</span>
                          {p.color && <span className="bg-slate-100 px-2 py-0.5 rounded-full">Color: {p.color}</span>}
                        </div>
                      </td>

                      {/* Brand Compatibility */}
                      <td className="p-4">
                        {p.marcaCompatible ? (
                          <div className="flex items-center gap-1 text-slate-600">
                            <Smartphone size={13} className="text-slate-400 shrink-0" />
                            <span>{p.marcaCompatible} {p.modeloCompatible}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-mono">-</span>
                        )}
                      </td>

                      {/* Codes / Scanning */}
                      <td className="p-4 font-mono text-[11px] text-slate-500">
                        <div>INT: {p.codigoInterno}</div>
                        <div className="text-slate-400 mt-0.5">EAN: {p.codigoBarras}</div>
                      </td>

                      {/* Cost */}
                      <td className="p-4 font-bold text-slate-650">
                        {isAdmin ? formatMoney(p.precioCosto) : "• • • •"}
                      </td>

                      {/* Sale */}
                      <td className="p-4 font-extrabold text-slate-900">
                        {formatMoney(p.precioVenta)}
                      </td>

                      {/* Stock units count */}
                      <td className="p-4 font-semibold">
                        <div className="flex items-center gap-1.5">
                          <span className={`font-mono text-sm font-black ${isLow ? 'text-rose-500' : 'text-slate-800'}`}>
                            {p.stockActual}
                          </span>
                          {isLow && (
                            <span className="p-1 bg-rose-50 rounded text-rose-500" title="Stock por debajo o igual al mínimo">
                              <AlertTriangle size={12} />
                            </span>
                          )}
                        </div>
                        <div className="text-[9px] text-slate-400 mt-0.5">mín: {p.stockMinimo} u</div>
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-center pr-6">
                        <div className="flex items-center justify-center gap-1.5">
                          
                          {/* Label preview triggers */}
                          <button
                            id={`print-layout-action-btn-${p.id}`}
                            onClick={() => setSelectedBarcodeProduct(p)}
                            className="p-1.5 text-slate-500 hover:text-slate-850 hover:bg-slate-100 rounded-lg transition"
                            title="Ver / Imprimir Etiqueta"
                          >
                            <Printer size={15} />
                          </button>

                          {/* Adjust physical counts */}
                          <button
                            id={`manual-adjustment-action-btn-${p.id}`}
                            onClick={() => openAdjustmentModal(p)}
                            className="p-1.5 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition"
                            title="Ingreso de mercadería / Ajuste"
                          >
                            <RefreshCw size={15} />
                          </button>

                          {/* Edit Details */}
                          {isAdmin && (
                            <button
                              id={`edit-product-action-btn-${p.id}`}
                              onClick={() => openProductForm(p)}
                              className="p-1.5 text-sky-600 hover:text-sky-700 hover:bg-sky-50 rounded-lg transition"
                              title="Editar de producto"
                            >
                              <Edit size={15} />
                            </button>
                          )}

                          {/* Delete Item */}
                          {isAdmin && (
                            <button
                              id={`delete-product-action-btn-${p.id}`}
                              onClick={() => handleDeleteProduct(p.id!)}
                              className="p-1.5 text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                              title="Borrar accesorio"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}

                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Barcode labels generator dialog backdrop rendering */}
      {selectedBarcodeProduct && (
        <div className="barcode-render-modal fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm border border-slate-150 shadow-2xl relative">
            <h3 className="font-extrabold text-slate-800 text-sm mb-4">Etiqueta de Accesorios para Celulares</h3>
            
            <BarcodeGenerator 
              barcode={selectedBarcodeProduct.codigoBarras}
              name={`${selectedBarcodeProduct.nombre} (${selectedBarcodeProduct.marcaCompatible} ${selectedBarcodeProduct.modeloCompatible})`.slice(0, 36)}
              price={selectedBarcodeProduct.precioVenta}
            />

            <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end">
              <button
                id="close-barcode-modal-btn"
                onClick={() => setSelectedBarcodeProduct(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition"
              >
                Cerrar Ventana
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual stock entries / Adjustment dialog */}
      {showAdjustmentModal && productForAdjustment && (
        <div className="adjustment-stock-modal fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md border border-slate-150 shadow-2xl relative">
            <h3 className="text-md font-bold text-slate-800">Ajuste Manual de Existencias</h3>
            <p className="text-xs text-slate-400 mt-1 uppercase font-bold">{productForAdjustment.nombre}</p>

            <form onSubmit={handleAdjustmentSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Cantidad a Cambiar</label>
                <div className="flex items-center gap-1.5">
                  <input
                    id="adjustment-qty-input"
                    type="number"
                    placeholder="Ej. +10 o -5"
                    onChange={(e) => setAdjustmentQty(Number(e.target.value))}
                    className="w-full text-xs text-slate-820 border border-slate-200 rounded-xl px-3 py-2 outline-hidden"
                    required
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Colocá un número positivo para SUMAR ingresos de mercadería, o negativo para DESCONTAR roturas/pérdidas.</p>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Notas / Justificación</label>
                <textarea
                  id="adjustment-notes-input"
                  placeholder="Detallá el motivo..."
                  value={adjustmentNotes}
                  onChange={(e) => setAdjustmentNotes(e.target.value)}
                  className="w-full text-xs text-slate-820 border border-slate-200 rounded-xl px-3 py-2 outline-hidden h-20"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-105">
                <button
                  id="cancel-adjustment-btn"
                  type="button"
                  onClick={() => setShowAdjustmentModal(false)}
                  className="flex-1 py-2 bg-slate-100 text-slate-500 font-bold rounded-xl text-xs hover:bg-slate-200 transition"
                >
                  Cancelar
                </button>
                <button
                  id="submit-adjustment-btn"
                  type="submit"
                  className="flex-1 py-2 bg-indigo-600 text-white font-bold rounded-xl text-xs hover:bg-indigo-500 transition"
                >
                  Guardar Movimiento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Product Insert/Edit Form sliding bottom modal */}
      {showFormModal && (
        <div className="product-form-modal fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-3xl p-6 w-full max-w-2xl border border-slate-150 shadow-2xl relative my-8">
            <h3 className="text-md font-extrabold text-slate-800 tracking-tight pb-3 border-b border-slate-100">
              {currentProduct ? "Modificar Ficha de Producto" : "Registrar Nuevo Accesorio / Repuesto"}
            </h3>

            <form onSubmit={handleProductSubmit} className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Product generic Name */}
              <div className="md:col-span-2">
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Nombre Comercial *</label>
                <input
                  id="product-form-name"
                  type="text"
                  placeholder="Ej. Funda Ringke Fusion-X"
                  value={formNombre}
                  onChange={(e) => setFormNombre(e.target.value)}
                  className="w-full text-xs text-slate-800 border border-slate-200 rounded-xl px-3 py-2 outline-hidden focus:border-indigo-500"
                  required
                />
              </div>

              {/* Codes */}
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Código Interno</label>
                <input
                  id="product-form-internal-code"
                  type="text"
                  placeholder="Ej. ACC-204"
                  value={formCodigoInterno}
                  onChange={(e) => setFormCodigoInterno(e.target.value)}
                  className="w-full text-xs text-slate-800 border border-slate-200 rounded-xl px-3 py-2 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Código de Barras *</label>
                <input
                  id="product-form-barcode"
                  type="text"
                  placeholder="Ej. 779123456789"
                  value={formCodigoBarras}
                  onChange={(e) => setFormCodigoBarras(e.target.value)}
                  className="w-full text-xs text-slate-800 border border-slate-200 rounded-xl px-3 py-2 outline-hidden font-mono"
                  required
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Categoría</label>
                <select
                  id="product-form-category"
                  value={formCategoria}
                  onChange={(e) => setFormCategoria(e.target.value)}
                  className="w-full text-xs text-slate-800 border border-slate-200 rounded-xl px-3 py-2 outline-hidden bg-slate-50"
                >
                  {categoriesList.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Brand */}
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Marca del Fabricante</label>
                <input
                  id="product-form-brand"
                  type="text"
                  placeholder="Ej. Spigen"
                  value={formMarca}
                  onChange={(e) => setFormMarca(e.target.value)}
                  className="w-full text-xs text-slate-800 border border-slate-200 rounded-xl px-3 py-2 outline-hidden"
                />
              </div>

              {/* Compatibility Mobile Device specialized fields as per Section 12 */}
              <div className="md:col-span-2 border-t border-b border-dashed border-slate-150 py-3 my-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-indigo-600 mb-1">Marca de Celular Compatible</label>
                  <input
                    id="product-form-compatible-brand"
                    type="text"
                    placeholder="Samsung, iPhone, Motorola"
                    value={formMarcaCompatible}
                    onChange={(e) => setFormMarcaCompatible(e.target.value)}
                    className="w-full text-xs text-slate-800 border border-slate-200 rounded-xl px-3 py-2 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-indigo-600 mb-1">Modelo Compatible</label>
                  <input
                    id="product-form-compatible-model"
                    type="text"
                    placeholder="A15, S24, Moto G54"
                    value={formModeloCompatible}
                    onChange={(e) => setFormModeloCompatible(e.target.value)}
                    className="w-full text-xs text-slate-800 border border-slate-200 rounded-xl px-3 py-2 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-indigo-600 mb-1">Color del Accesorio</label>
                  <input
                    id="product-form-color"
                    type="text"
                    placeholder="Negro, Transparente"
                    value={formColor}
                    onChange={(e) => setFormColor(e.target.value)}
                    className="w-full text-xs text-slate-800 border border-slate-200 rounded-xl px-3 py-2 outline-hidden"
                  />
                </div>
              </div>

              {/* Financial values */}
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Costo ($ ARS)</label>
                <input
                  id="product-form-cost-price"
                  type="number"
                  placeholder="5000"
                  value={formPrecioCosto}
                  onChange={(e) => setFormPrecioCosto(Number(e.target.value))}
                  className="w-full text-xs text-slate-800 border border-slate-200 rounded-xl px-3 py-2 outline-hidden"
                  disabled={!isAdmin} // Non admin are forbidden from writing costs as per Section 8
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Precio Venta ($ ARS)</label>
                <input
                  id="product-form-sale-price"
                  type="number"
                  placeholder="10000"
                  value={formPrecioVenta}
                  onChange={(e) => setFormPrecioVenta(Number(e.target.value))}
                  className="w-full text-xs text-slate-800 border border-slate-200 rounded-xl px-3 py-2 outline-hidden"
                />
              </div>

              {/* Quantities */}
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Stock Inicial</label>
                <input
                  id="product-form-initial-stock"
                  type="number"
                  placeholder="0"
                  value={formStockActual}
                  onChange={(e) => setFormStockActual(Number(e.target.value))}
                  className="w-full text-xs text-slate-800 border border-slate-200 rounded-xl px-3 py-2 outline-hidden"
                  disabled={currentProduct !== null} // Adjustments modal must handle manual changes latter
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Alerta Stock Mínimo</label>
                <input
                  id="product-form-min-stock"
                  type="number"
                  placeholder="2"
                  value={formStockMinimo}
                  onChange={(e) => setFormStockMinimo(Number(e.target.value))}
                  className="w-full text-xs text-slate-800 border border-slate-200 rounded-xl px-3 py-2 outline-hidden"
                />
              </div>

              {/* Suppler */}
              <div className="md:col-span-2">
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Proveedor / Mayorista</label>
                <input
                  id="product-form-supplier"
                  type="text"
                  placeholder="Ej. Distribuidora Celulares S.A."
                  value={formProveedor}
                  onChange={(e) => setFormProveedor(e.target.value)}
                  className="w-full text-xs text-slate-800 border border-slate-200 rounded-xl px-3 py-2 outline-hidden"
                />
              </div>

              {/* Description */}
              <div className="md:col-span-2">
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Características / Notas adicional</label>
                <textarea
                  id="product-form-description"
                  placeholder="Compatibilidad con carga inalámbrica, etc."
                  value={formDescripcion}
                  onChange={(e) => setFormDescripcion(e.target.value)}
                  className="w-full text-xs text-slate-800 border border-slate-200 rounded-xl px-3 py-2 outline-hidden h-20"
                />
              </div>

              {/* Actions submit */}
              <div className="md:col-span-2 flex gap-2 pt-4 border-t border-slate-100 justify-end">
                <button
                  id="cancel-product-form-btn"
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-500 font-bold rounded-xl text-xs hover:bg-slate-200 transition"
                >
                  Cancelar
                </button>
                <button
                  id="submit-product-form-btn"
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl text-xs hover:bg-indigo-500 transition shadow"
                >
                  Guardar Accesorio
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
