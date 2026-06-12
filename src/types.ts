export enum UserRole {
  ADMIN = "Administrador",
  EMPLOYEE = "Empleado",
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: UserRole;
  createdAt?: string;
}

export interface Product {
  id?: string; // Firestore Document ID
  codigoInterno: string;
  codigoBarras: string;
  nombre: string;
  categoria: string;
  marca: string;
  descripcion: string;
  precioCosto: number;
  precioVenta: number;
  stockActual: number;
  stockMinimo: number;
  proveedor: string;
  fechaIngreso: string;
  
  // Mobile accessories specific fields
  marcaCompatible: string; // e.g., Samsung, Motorola, iPhone
  modeloCompatible: string; // e.g., A15, Moto G54, iPhone 15 Pro
  color: string;
  tipoAccesorio: string; // e.g., Fundas, Vidrios templados, Cables USB, Cargadores, Auriculares, Power Banks, Parlantes Bluetooth
}

export interface SaleItem {
  productId: string;
  nombre: string;
  precioVenta: number;
  precioCosto: number;
  cantidad: number;
  subtotal: number;
}

export interface Sale {
  id?: string;
  fecha: string;
  vendedorUid: string;
  vendedorNombre: string;
  metodoPago: "Efectivo" | "Débito" | "Crédito" | "Transferencia" | "Mercado Pago";
  subtotal: number;
  gananciaTotal: number;
  items: SaleItem[];
  clienteDni?: string;
}

export enum StockMovementType {
  ENTRY = "Ingreso",
  SALE = "Venta",
  ADJUSTMENT = "Ajuste",
  REPAIR = "Servicio Técnico",
}

export interface StockMovement {
  id?: string;
  productId: string;
  productName: string;
  cantidad: number; // Positive for adds, negative for deductions
  tipo: StockMovementType;
  fecha: string;
  usuario: string; // displayName or email
  notas: string;
}

export enum RepairStatus {
  RECEIVED = "Recibido",
  DIAGNOSING = "En diagnóstico",
  QUOTE_SENT = "Presupuesto enviado",
  AWAITING_APPROVAL = "Esperando aprobación",
  IN_REPAIR = "En reparación",
  REPAIRED = "Reparado",
  READY_TO_COLLECT = "Listo para retirar",
  DELIVERED = "Entregado",
  CANCELLED = "Cancelado",
}

export interface ClientContact {
  dni: string;
  nombre: string;
  telefono: string;
  email: string;
  direccion: string;
}

export interface DeviceInfo {
  marca: string;
  modelo: string;
  imei: string;
  color: string;
  serial: string;
  password?: string;
}

export interface Quote {
  partsCost: number;
  labor: number;
  tax: number;
  total: number;
}

export interface RepairPart {
  productId: string;
  nombre: string;
  cantidad: number;
  precioCosto: number;
  precioCobrabilidad: number; // how much client was charged for it
}

export interface RepairStateLog {
  estado: RepairStatus;
  fecha: string;
  usuario: string;
  comentario: string;
}

export interface RepairOrder {
  id?: string;
  numeroOrden: string; // unique generated string e.g. OT-1001
  estado: RepairStatus;
  fechaIngreso: string;
  fechaEntrega?: string;
  tecnicoAsignado: string;
  
  // Client & Device details
  clienteNombre: string;
  clienteDni: string;
  clienteTelefono: string;
  clienteEmail: string;
  clienteDireccion: string;
  
  dispositivoMarca: string;
  dispositivoModelo: string;
  dispositivoImei: string;
  dispositivoColor: string;
  dispositivoSerial: string;
  dispositivoPassword?: string;
  
  estadoFisico: string; // e.g. "pantalla rayada"
  fallaReportada: string;
  fotoUrl?: string; // photo base64/url
  
  // financial components
  reparacionCostoRepuestos: number;
  reparacionManoObra: number;
  reparacionCobrado: number; // what they pay
  reparacionGanancia: number; // cobrado - repuestos cost - other costs
  reparacionFechaVencimientoGarantia?: string;
  
  repuestosUtilizados: RepairPart[];
  historialEstados: RepairStateLog[];
  firmaDigital?: string; // base64 ink signature
}

export interface ClientCrm {
  id?: string;
  dni: string;
  nombre: string;
  email: string;
  telefono: string;
  direccion: string;
  ultimaVisita: string;
  comprasCount: number;
  reparacionesCount: number;
  montoGastadoTotal: number;
  isVip: boolean;
}

export interface Supplier {
  id?: string;
  nombre: string;
  telefono: string;
  email: string;
  contactoPersona: string;
}
