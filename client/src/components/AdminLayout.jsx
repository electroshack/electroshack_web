import React, { useState, useEffect, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { LayoutDashboard, Receipt, Package, MessageSquare, LogOut, Menu, X, ChevronRight, Users, ShoppingCart, BarChart3 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCheckoutBasket } from "../context/CheckoutBasketContext";
import logo from "../assets/hero_logo2.png";
import API from "../api";
import BarcodeScannerModal from "./BarcodeScannerModal";
import ScanBarcodeIcon from "./ScanBarcodeIcon";

function linesFromScanBlob(raw) {
  const s = String(raw || "").trim();
  if (!s) return [];
  const byNl = s.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  if (byNl.length > 1) return [...new Set(byNl)];
  if (/[,;]/.test(s)) return [...new Set(s.split(/[,;]+/).map((x) => x.trim()).filter(Boolean))];
  return [s];
}

const baseNavItems = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/receipts", label: "Receipts", icon: Receipt },
  { to: "/admin/inventory", label: "Inventory", icon: Package },
  { to: "/admin/grocery-list", label: "Grocery list", icon: ShoppingCart },
  { to: "/admin/metrics", label: "Metrics", icon: BarChart3 },
  { to: "/admin/messages", label: "Messages", icon: MessageSquare },
];

export default function AdminLayout({ children, title }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const { user, logout } = useAuth();
  const { addItem } = useCheckoutBasket();
  const location = useLocation();
  const navigate = useNavigate();

  const onBarcodeDetected = useCallback(
    async (code) => {
      const raw = String(code || "").trim();
      if (!raw) return;
      const lines = linesFromScanBlob(raw);
      for (const line of lines.length ? lines : [raw]) {
        try {
          const { data } = await API.get(`/inventory/by-barcode/${encodeURIComponent(line)}`);
          const added = await addItem(data, 1);
          if (!added) return;
          if (!location.pathname.startsWith("/admin/inventory") || location.pathname.split("/").length > 3) {
            navigate("/admin/inventory");
          }
          return;
        } catch (e) {
          if (e.response?.status !== 404) {
            toast.error("Could not look up code.");
            return;
          }
        }
      }
      const primary = lines[0] || raw;
      const q = new URLSearchParams();
      q.set("code", primary);
      toast.success("New barcode — add it to inventory.");
      navigate({ pathname: "/admin/inventory/new", search: `?${q.toString()}` });
    },
    [addItem, location.pathname, navigate]
  );

  useEffect(() => {
    const open = () => setScanOpen(true);
    window.addEventListener("es-open-barcode-scan", open);
    return () => window.removeEventListener("es-open-barcode-scan", open);
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const isActive = (path) => {
    if (path === "/admin") return location.pathname === "/admin";
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const navCls = (active) =>
    `flex items-center gap-3 px-3 py-2 rounded-sm text-sm font-medium transition-colors ${
      active ? "bg-primary-500/10 text-primary-400" : "text-gray-400 hover:text-white hover:bg-dark-800"
    }`;

  return (
    <div className="min-h-screen bg-gray-50 flex items-start">
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-60 shrink-0 bg-dark-900 transition-transform lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex flex-col h-full min-h-0">
          <div className="flex items-center justify-between p-4 border-b border-dark-800">
            <Link to="/admin">
              <img src={logo} alt="Electroshack" className="h-12 w-auto" />
            </Link>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-gray-400 hover:text-white">
              <X size={20} />
            </button>
          </div>

          <nav className="flex-1 space-y-1 p-3 overflow-y-auto" aria-label="Admin">
            {baseNavItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={navCls(isActive(item.to))}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            ))}
            {user?.role === "superadmin" && (
              <Link
                to="/admin/users"
                onClick={() => setSidebarOpen(false)}
                className={navCls(isActive("/admin/users"))}
              >
                <Users size={18} />
                Admins
              </Link>
            )}
            <button
              type="button"
              onClick={() => {
                setScanOpen(true);
                setSidebarOpen(false);
              }}
              className={`${navCls(false)} w-full text-left`}
            >
              <ScanBarcodeIcon size={24} />
              Scan
            </button>
          </nav>

          <div className="p-3 border-t border-dark-800">
            <div className="flex items-center gap-3 px-3 py-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white text-xs font-bold">
                {user?.username?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-medium truncate">{user?.username}</p>
                <p className="text-xs text-gray-500">{user?.role}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-3 py-2 rounded-sm text-sm text-gray-400 hover:text-red-400 hover:bg-dark-800 transition-colors"
            >
              <LogOut size={18} />
              Sign Out
            </button>
            <Link
              to="/"
              className="flex items-center gap-3 w-full px-3 py-2 mt-1 rounded-sm text-sm text-gray-500 hover:text-gray-300 hover:bg-dark-800 transition-colors"
            >
              <ChevronRight size={18} />
              View Store
            </Link>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="flex w-0 min-h-0 flex-1 flex-col min-w-0 lg:ml-60">
        <header className="bg-white border-b border-gray-200 px-3 py-2 flex items-center gap-3 sticky top-0 z-30">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-gray-600 hover:text-gray-900">
            <Menu size={22} />
          </button>
          <h1 className="text-lg font-semibold text-dark-900">{title}</h1>
        </header>
        <main className="flex-1 min-h-0 p-3 overflow-auto">
          {children}
        </main>
      </div>
      <BarcodeScannerModal open={scanOpen} onClose={() => setScanOpen(false)} onDetected={onBarcodeDetected} />
    </div>
  );
}
