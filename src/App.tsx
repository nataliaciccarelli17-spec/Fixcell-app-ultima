import React, { useState, useEffect } from "react";
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut,
  User 
} from "firebase/auth";
import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  getDoc,
  query,
  limit
} from "firebase/firestore";
import { 
  Smartphone, 
  Wrench, 
  LayoutDashboard, 
  ShoppingCart, 
  FolderLock, 
  UserCheck, 
  FileSpreadsheet, 
  LogOut, 
  Moon, 
  Sun,
  UserCircle2,
  RefreshCcw,
  Wifi,
  WifiOff,
  Scale
} from "lucide-react";

import { auth, db, googleProvider, loginWithGoogle, logoutUser } from "./firebase";
import { UserProfile, UserRole, Product, Sale, RepairOrder, ClientCrm } from "./types";

// Modular Components
import Dashboard from "./components/Dashboard";
import POS from "./components/POS";
import Inventory from "./components/Inventory";
import Repairs from "./components/Repairs";
import CRM from "./components/CRM";
import ReportsAndBackup from "./components/ReportsAndBackup";
import Accounting from "./components/Accounting";

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [appReady, setAppReady] = useState(false);
  const [activeTab, setActiveTab] = useState<"dashboard" | "pos" | "inventory" | "repairs" | "crm" | "reports" | "accounting">("dashboard");
  const [darkMode, setDarkMode] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Firestore DB states
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [repairs, setRepairs] = useState<RepairOrder[]>([]);
  const [clients, setClients] = useState<ClientCrm[]>([]);

  // Track network connectivity
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Set up Firebase Auth state observer
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        
        // Sincronizar o registrar perfil de usuario en /usuarios/{uid}
        const userDocRef = doc(db, "usuarios", user.uid);
        try {
          const snapshot = await getDoc(userDocRef);
          
          let role = UserRole.EMPLOYEE;
          // Designate specified user email as root Administrator
          if (user.email === "nataliaciccarelli17@gmail.com" || user.email === "admin@celustock.com") {
            role = UserRole.ADMIN;
          }

          if (!snapshot.exists()) {
            const profile: UserProfile = {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              photoURL: user.photoURL,
              role: role,
              createdAt: new Date().toISOString()
            };
            await setDoc(userDocRef, profile);
            setUserProfile(profile);
          } else {
            setUserProfile(snapshot.data() as UserProfile);
          }
        } catch (err) {
          console.error("No se pudo obtener el perfil de Firestore. Usando emulador local de rol.", err);
          // Fallback robusto para poder utilizar la aplicación aun con problemas de reglas
          setUserProfile({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            role: user.email === "nataliaciccarelli17@gmail.com" ? UserRole.ADMIN : UserRole.EMPLOYEE
          });
        }
      } else {
        setCurrentUser(null);
        setUserProfile(null);
      }
      setAppReady(true);
    });

    return () => unsubscribe();
  }, []);

  // Real-time synchronization of all Firestore Collections (Section 11)
  useEffect(() => {
    if (!currentUser) return;

    // 1. Products Catalyst listener
    const unsubProducts = onSnapshot(collection(db, "productos"), (snapshot) => {
      const items: Product[] = [];
      snapshot.forEach(doc => {
        items.push({ ...(doc.data() as Product), id: doc.id });
      });
      setProducts(items);
    }, (err) => console.warn("Rules limited products read: ", err));

    // 2. Sales Catalyst listener
    const unsubSales = onSnapshot(collection(db, "ventas"), (snapshot) => {
      const items: Sale[] = [];
      snapshot.forEach(doc => {
        items.push({ ...(doc.data() as Sale), id: doc.id });
      });
      // Sort chronologically newer first
      items.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
      setSales(items);
    }, (err) => console.warn("Rules limited sales read: ", err));

    // 3. Repairs Catalyst listener
    const unsubRepairs = onSnapshot(collection(db, "reparaciones"), (snapshot) => {
      const items: RepairOrder[] = [];
      snapshot.forEach(doc => {
        items.push({ ...(doc.data() as RepairOrder), id: doc.id });
      });
      items.sort((a, b) => new Date(b.fechaIngreso).getTime() - new Date(a.fechaIngreso).getTime());
      setRepairs(items);
    }, (err) => console.warn("Rules limited repairs read: ", err));

    // 4. CRM clients Catalyst listener
    const unsubClients = onSnapshot(collection(db, "clientes_crm"), (snapshot) => {
      const items: ClientCrm[] = [];
      snapshot.forEach(doc => {
        items.push({ ...(doc.data() as ClientCrm), id: doc.id });
      });
      items.sort((a, b) => b.montoGastadoTotal - a.montoGastadoTotal);
      setClients(items);
    }, (err) => console.warn("Rules limited clients read: ", err));

    return () => {
      unsubProducts();
      unsubSales();
      unsubRepairs();
      unsubClients();
    };
  }, [currentUser]);

  // Seeding initial inventory fallback mock if DB is empty to prevent blank experience (as requested by anti-mock up rules)
  const handleSeedDemostrationProducts = async () => {
    if (!currentUser) return;
    try {
      const samples: Omit<Product, "id">[] = [
        {
          codigoInterno: "ACC-101",
          codigoBarras: "1001",
          nombre: "Funda Ringke Fusion-X S24 Ultra",
          categoria: "Fundas",
          marca: "Ringke",
          descripcion: "Protección militar reforzada para samsung",
          precioCosto: 4000,
          precioVenta: 12000,
          stockActual: 10,
          stockMinimo: 2,
          proveedor: "Ringke Argentina",
          fechaIngreso: new Date().toISOString(),
          marcaCompatible: "Samsung",
          modeloCompatible: "S24 Ultra",
          color: "Negro",
          tipoAccesorio: "Fundas"
        },
        {
          codigoInterno: "ACC-102",
          codigoBarras: "1002",
          nombre: "Cable USB-C a USB-C de 2 Metros Anker",
          categoria: "Cables USB",
          marca: "Anker",
          descripcion: "Carga rápida para motorola y iphone de 60W",
          precioCosto: 1500,
          precioVenta: 4500,
          stockActual: 15,
          stockMinimo: 3,
          proveedor: "Anker Mayoristas",
          fechaIngreso: new Date().toISOString(),
          marcaCompatible: "Universal",
          modeloCompatible: "USB-C",
          color: "Blanco",
          tipoAccesorio: "Cables USB"
        },
        {
          codigoInterno: "ACC-103",
          codigoBarras: "1003",
          nombre: "Vidrio Templado iPhone 15 Pro",
          categoria: "Vidrios templados",
          marca: "Gorilla Glass",
          descripcion: "Máxima dureza 9H compatible con fundas",
          precioCosto: 800,
          precioVenta: 3500,
          stockActual: 1,
          stockMinimo: 2, // Low stock on startup to show low stock widget immediately!
          proveedor: "Vidrios Express",
          fechaIngreso: new Date().toISOString(),
          marcaCompatible: "iPhone",
          modeloCompatible: "15 Pro",
          color: "Transparente",
          tipoAccesorio: "Vidrios templados"
        },
        {
          codigoInterno: "REP-901",
          codigoBarras: "1004",
          nombre: "Módulo Display Touch Samsung Galaxy A15",
          categoria: "Repuestos",
          marca: "Samsung Original",
          descripcion: "Módulo de repuesto oled para reparación de pantalla Samsung",
          precioCosto: 30000,
          precioVenta: 40000,
          stockActual: 5,
          stockMinimo: 1,
          proveedor: "Repuestos Genuinos",
          fechaIngreso: new Date().toISOString(),
          marcaCompatible: "Samsung",
          modeloCompatible: "A15",
          color: "Negro",
          tipoAccesorio: "Repuestos"
        }
      ];

      for (const item of samples) {
        const docRef = doc(collection(db, "productos"));
        await setDoc(docRef, { ...item, id: docRef.id });
      }
      alert("¡Catálogo inicial sugerido cargado correctamente!");
    } catch (err) {
      console.error(err);
    }
  };

  // Toggle roles simulator to allow testing both admin and employee flows
  const toggleSimulationRole = () => {
    if (!userProfile) return;
    const nextRole = userProfile.role === UserRole.ADMIN ? UserRole.EMPLOYEE : UserRole.ADMIN;
    setUserProfile({
      ...userProfile,
      role: nextRole
    });
  };

  if (!appReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center text-slate-500">
        <RefreshCcw className="animate-spin text-indigo-600 mb-3" size={36} />
        <p className="text-sm font-semibold">Cargando base segura de stock...</p>
      </div>
    );
  }

  // LOGIN INTERFACE PORTAL FOR NEW VISITORS (With Google Sign-In as per spec 10)
  if (!currentUser || !userProfile) {
    return (
      <div className={`min-h-screen flex flex-col justify-center items-center p-6 transition-colors duration-300 ${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'}`}>
        
        {/* Floating configuration alerts */}
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2.5 rounded-xl border border-slate-200 shadow-xs bg-white text-slate-600 hover:bg-slate-50"
          >
            {darkMode ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-xl max-w-sm w-full text-center space-y-6 animate-fade-in relative">
          
          <div className="h-14 w-14 bg-orange-50 text-orange-500 rounded-2xl flex items-center justify-center mx-auto scale-110">
            <Smartphone size={32} className="stroke-[1.5]" />
          </div>

          <div className="space-y-1.5">
            <h1 className="text-2xl font-black italic tracking-wide uppercase leading-none select-none">
              <span className="text-orange-500">FIX</span><span className="text-slate-400">CELL</span>
            </h1>
            <p className="text-xs text-slate-400">Sistema POS y centro técnico de reparaciones.</p>
          </div>

          <p className="text-xs text-slate-500 leading-normal">
            Administrá stock en tiempo real, registrá ventas con lectores de barra y realizá el seguimiento de dispositivos móviles en taller.
          </p>

          <button
            id="google-signin-btn"
            onClick={loginWithGoogle}
            className="w-full flex items-center justify-center gap-2 px-5 py-3.5 border border-slate-200 hover:border-slate-350 bg-white hover:bg-slate-50 text-slate-700 font-extrabold text-xs uppercase tracking-wider rounded-xl transition shadow active:scale-98"
          >
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Ingresar con Google
          </button>

          <div className="text-[10px] text-slate-400 mt-2">
            Desarrollado para comercios de accesorios de celulares.
          </div>
        </div>
      </div>
    );
  }

  // PRIMARY LOGGED IN INTERFACE
  return (
    <div className={`min-h-screen transition-colors duration-300 flex flex-col ${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'}`}>
      
      {/* 1. Header Area bar */}
      <header className="bg-white border-b border-slate-150 sticky top-0 z-40 px-6 py-4 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Logo brand */}
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 bg-orange-500 text-white rounded-xl flex items-center justify-center font-bold">
              <Smartphone size={18} />
            </div>
            <div>
              <div className="text-base font-black italic tracking-wide uppercase select-none leading-none">
                <span className="text-orange-500">FIX</span><span className="text-slate-500">CELL</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 leading-none">Accesorios & Reparaciones</div>
            </div>
            
            {/* Online status indicator */}
            <div className="ml-2">
              {isOnline ? (
                <span className="text-[9px] uppercase font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Wifi size={10} /> Online
                </span>
              ) : (
                <span className="text-[9px] uppercase font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <WifiOff size={10} /> Offline mode
                </span>
              )}
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="flex flex-wrap items-center gap-1.5 md:gap-2 text-xs">
            <button
              id="nav-tab-dashboard"
              onClick={() => setActiveTab("dashboard")}
              className={`px-3 py-2 rounded-xl transition font-extrabold flex items-center gap-1 ${
                activeTab === "dashboard" ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <LayoutDashboard size={14} />
              Panel
            </button>
            
            <button
              id="nav-tab-pos"
              onClick={() => setActiveTab("pos")}
              className={`px-3 py-2 rounded-xl transition font-extrabold flex items-center gap-1 ${
                activeTab === "pos" ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <ShoppingCart size={14} />
              Ventas
            </button>
            
            <button
              id="nav-tab-inventory"
              onClick={() => setActiveTab("inventory")}
              className={`px-3 py-2 rounded-xl transition font-extrabold flex items-center gap-1 ${
                activeTab === "inventory" ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <FolderLock size={14} />
              Inventario
            </button>
            
            <button
              id="nav-tab-repairs"
              onClick={() => setActiveTab("repairs")}
              className={`px-3 py-2 rounded-xl transition font-extrabold flex items-center gap-1 ${
                activeTab === "repairs" ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Wrench size={14} />
              Servicios
            </button>
            
            <button
              id="nav-tab-crm"
              onClick={() => setActiveTab("crm")}
              className={`px-3 py-2 rounded-xl transition font-extrabold flex items-center gap-1 ${
                activeTab === "crm" ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <UserCircle2 size={14} />
              CRM Clientes
            </button>
            
            <button
              id="nav-tab-reports"
              onClick={() => setActiveTab("reports")}
              className={`px-3 py-2 rounded-xl transition font-extrabold flex items-center gap-1 ${
                activeTab === "reports" ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <FileSpreadsheet size={14} />
              Reportes
            </button>

            <button
              id="nav-tab-accounting"
              onClick={() => setActiveTab("accounting")}
              className={`px-3 py-2 rounded-xl transition font-extrabold flex items-center gap-1 ${
                activeTab === "accounting" ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Scale size={14} />
              Contabilidad
            </button>
          </nav>

          {/* Quick roles switcher and sign out */}
          <div className="flex items-center gap-3 self-end md:self-auto border-t border-slate-100 md:border-t-0 pt-3 md:pt-0">
            
            {/* Role quick toggler for diagnostic testing in Sandbox */}
            <button
              id="sandbox-swap-role-btn"
              onClick={toggleSimulationRole}
              className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg px-2.5 py-1.5 transition"
              title="Cambiar entre Administrador y Empleado para probar permisos"
            >
              Permisos: {userProfile.role}
            </button>

            {/* Dark mode switcher */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-1 px-2 text-slate-500 hover:text-slate-700"
            >
              {darkMode ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            {/* User credentials */}
            <div className="flex items-center gap-1.5">
              {userProfile.photoURL ? (
                <img src={userProfile.photoURL} alt="avatar" className="h-6 w-6 rounded-full" />
              ) : (
                <UserCheck size={18} className="text-slate-400" />
              )}
            </div>

            {/* Sign out */}
            <button
              id="logout-btn"
              onClick={logoutUser}
              className="text-slate-450 hover:text-slate-700 p-1.5 rounded-lg border border-slate-100 hover:bg-slate-50 transition"
              title="Cerrar sesion"
            >
              <LogOut size={14} />
            </button>
          </div>

        </div>
      </header>

      {/* 2. Main content container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8">
        
        {/* Helper Banner to populate initial Catalog if user database is fresh */}
        {products.length === 0 && (
          <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 mb-6 animate-fade-in text-xs text-indigo-900 leading-normal">
            <div>
              <span className="font-bold">¡Bienvenido! Tu base de datos de productos se encuentra vacía.</span> Pasemos a registrar algunos accesorios o podés autocompletar el catálogo para una prueba instantánea.
            </div>
            <button
              id="seed-demo-db-btn"
              onClick={handleSeedDemostrationProducts}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 font-bold text-white rounded-xl text-[11px] uppercase transition shadow-xs whitespace-nowrap"
            >
              Cargar Catálogo Inicial
            </button>
          </div>
        )}

        {/* View switching panel wrapper router */}
        <div className="animate-fade-in">
          {activeTab === "dashboard" && (
            <Dashboard 
              userProfile={userProfile}
              products={products}
              sales={sales}
              repairs={repairs}
            />
          )}

          {activeTab === "pos" && (
            <POS 
              userProfile={userProfile}
              products={products}
              clients={clients}
              onRefreshData={() => {}}
            />
          )}

          {activeTab === "inventory" && (
            <Inventory 
              userProfile={userProfile}
              products={products}
              onRefreshData={() => {}}
            />
          )}

          {activeTab === "repairs" && (
            <Repairs 
              userProfile={userProfile}
              repairs={repairs}
              products={products}
              onRefreshData={() => {}}
            />
          )}

          {activeTab === "crm" && (
            <CRM 
              userProfile={userProfile}
              clients={clients}
              sales={sales}
              repairs={repairs}
              onRefreshData={() => {}}
            />
          )}

          {activeTab === "reports" && (
            <ReportsAndBackup 
              products={products}
              sales={sales}
              repairs={repairs}
            />
          )}

          {activeTab === "accounting" && (
            <Accounting />
          )}
        </div>

      </main>

      {/* 3. Footer branding copyright */}
      <footer className="py-6 border-t border-slate-150 bg-white text-center text-slate-400 text-[10px]">
        <div className="max-w-7xl mx-auto px-6">
          <span>&copy; {new Date().getFullYear()} <span className="font-bold italic text-orange-500">FIX</span><span className="font-bold italic text-slate-500">CELL</span> - Todos los derechos reservados. Sincronizado periódicamente vía Firestore Enterprise con Seguridad ABAC.</span>
        </div>
      </footer>

    </div>
  );
}
