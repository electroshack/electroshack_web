import React, { useState, useEffect, useCallback, useLayoutEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { LayoutDashboard, Receipt, Package, MessageSquare, LogOut, Menu, X, ChevronRight, Users, ShoppingCart, BarChart3, Camera } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import logo from "../assets/hero_logo2.png";
import API from "../api";
import BarcodeScannerModal from "./BarcodeScannerModal";

/** Multiple codes from one scan (newlines) or comma/semicolon-separated; single token kept whole */
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

const SCAN_BTN_MIN = 48;

export default function AdminLayout({ children, title }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanBtnPx, setScanBtnPx] = useState(96);
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const asideInnerRef = useRef(null);
  const navRef = useRef(null);
  const navListEndRef = useRef(null);
  const userSectionRef = useRef(null);

  useLayoutEffect(() => {
    const measure = () => {
      const navEl = navRef.current;
      const sentEl = navListEndRef.current;
      const userEl = userSectionRef.current;
      if (!navEl || !sentEl || !userEl) return;
      const nr = navEl.getBoundingClientRect();
      const sr = sentEl.getBoundingClientRect();
      const ur = userEl.getBoundingClientRect();
      const lastItemBottom = Math.min(sr.bottom, nr.bottom);
      const gapPx = Math.max(0, ur.top - lastItemBottom);
      const asideW = navEl.closest("aside")?.getBoundingClientRect().width ?? 240;
      const diameter = Math.min(Math.max(SCAN_BTN_MIN, gapPx * 0.8), asideW * 0.92);
      setScanBtnPx(Math.round(diameter));
    };

    measure();
    const el = asideInnerRef.current;
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (el && ro) ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
      if (el && ro) ro.disconnect();
    };
  }, [user?.role, location.pathname, sidebarOpen]);

  const onBarcodeDetected = useCallback(
    async (code) => {
      const raw = String(code || "").trim();
      if (!raw) return;
      const lines = linesFromScanBlob(raw);
      const blob = lines.join("\n") || raw;
      let parsed = { imei: "", serial: "", imei2: "" };
      try {
        const { data } = await API.post("/inventory/parse-sticker", { blob });
        parsed = data || parsed;
      } catch {
        /* parse optional */
      }
      for (const line of lines.length ? lines : [raw]) {
        try {
          const { data } = await API.get(`/inventory/by-barcode/${encodeURIComponent(line)}`);
          navigate(`/admin/inventory/${data._id}`);
          toast.success("Opened inventory item");
          return;
        } catch (e) {
          if (e.response?.status !== 404) {
            toast.error("Could not look up code.");
            return;
          }
        }
      }
      const hints = [];
      for (const line of lines.length ? lines : [raw]) {
        try {
          const { data: hint } = await API.get(`/inventory/external-hint/${encodeURIComponent(line)}`);
          if (hint?.found) hints.push(hint);
        } catch {
          /* skip line */
        }
      }
      const primaryLine = lines.find((l) => {
        const d = l.replace(/\D/g, "");
        return d.length !== 15;
      }) || lines[0] || raw;

      const q = new URLSearchParams();
      if (primaryLine) q.set("code", primaryLine);
      if (parsed.imei) q.set("imei", parsed.imei);
      if (parsed.serial) q.set("serial", parsed.serial);

      const firstHint = hints[0];
      if (firstHint && (firstHint.displayName || firstHint.title)) {
        const line = firstHint.modelLabel
          ? `${firstHint.modelLabel}${
              firstHint.brand &&
              !String(firstHint.displayName || "")
                .toLowerCase()
                .includes(String(firstHint.brand).toLowerCase())
                ? ` · ${firstHint.brand}`
                : ""
            }`
          : firstHint.displayName || firstHint.title;
        const cond = firstHint.suggestedCondition ? ` · ${firstHint.suggestedCondition}` : "";
        const src = firstHint.source?.includes("imei") ? "Device hint" : "Catalog";
        toast.success(`${src}: ${line}${cond} — review & save`);
      } else if (parsed.imei || parsed.serial) {
        toast.success("Pulled IMEI/serial from scan — review & save");
      } else if (hints.length === 0) {
        toast.success("New item — finish details and save");
      }

      navigate({
        pathname: "/admin/inventory/new",
        search: `?${q.toString()}`,
        state: { inventoryHints: hints, parsedSticker: parsed, scanLines: lines.length ? lines : [raw] },
      });
    },
    [navigate]
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

  return (
    <div className="min-h-screen bg-gray-50 flex items-start">
      {/* Sidebar: viewport-height on desktop so footer (camera, user) stays visible; long pages scroll nav only */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-60 shrink-0 overflow-visible bg-dark-900 transition-transform lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div ref={asideInnerRef} className="flex flex-col h-full min-h-0 overflow-x-visible overflow-y-visible">
          <div className="flex items-center justify-between p-4 border-b border-dark-800">
            <Link to="/admin">
              <img src={logo} alt="Electroshack" className="h-12 w-auto" />
            </Link>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-gray-400 hover:text-white">
              <X size={20} />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            <nav ref={navRef} className="shrink-0 space-y-1 p-3" aria-label="Admin">
              {baseNavItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive(item.to)
                      ? "bg-primary-500/10 text-primary-400"
                      : "text-gray-400 hover:text-white hover:bg-dark-800"
                  }`}
                >
                  <item.icon size={18} />
                  {item.label}
                </Link>
              ))}
              {user?.role === "superadmin" && (
                <Link
                  to="/admin/users"
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive("/admin/users")
                      ? "bg-primary-500/10 text-primary-400"
                      : "text-gray-400 hover:text-white hover:bg-dark-800"
                  }`}
                >
                  <Users size={18} />
                  Admins
                </Link>
              )}
              {/* Measure from end of nav list to user block (includes empty space below links inside nav) */}
              <div ref={navListEndRef} className="h-0 w-full shrink-0" aria-hidden />
            </nav>

            <div className="es-admin-scan-slot relative flex min-h-0 min-w-0 flex-1 flex-col overflow-visible">
              <div className="flex min-h-0 w-full flex-1 items-center justify-center px-3 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setScanOpen(true);
                    setSidebarOpen(false);
                  }}
                  title="Scan label, barcode, or IMEI"
                  style={{ width: scanBtnPx, height: scanBtnPx }}
                  className="es-admin-scan-wrap relative flex shrink-0 items-center justify-center overflow-visible rounded-full bg-[#0c0f14] ring-1 ring-white/[0.12] shadow-[0_1px_0_0_rgba(255,255,255,0.06)_inset,0_8px_20px_rgba(0,0,0,0.45)] hover:ring-white/20 active:shadow-[inset_0_3px_12px_rgba(0,0,0,0.65)] active:ring-white/10 transition-[box-shadow,ring-color] duration-150"
                >
                  <span className="es-admin-scan-rings" aria-hidden>
                    <span className="es-admin-scan-burst-ring es-admin-scan-burst-ring--1" />
                    <span className="es-admin-scan-burst-ring es-admin-scan-burst-ring--2" />
                    <span className="es-admin-scan-burst-ring es-admin-scan-burst-ring--3" />
                  </span>
                  <Camera
                    size={Math.max(22, Math.round(scanBtnPx * 0.34))}
                    strokeWidth={2}
                    className="relative z-[2] text-gray-100"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  />
                </button>
              </div>
              <span className="shrink-0 px-1 pb-3 text-center text-[10px] leading-tight tracking-wide text-gray-500">Scan</span>
            </div>
          </div>

          <div ref={userSectionRef} className="p-3 border-t border-dark-800">
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
              className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-red-400 hover:bg-dark-800 transition-colors"
            >
              <LogOut size={18} />
              Sign Out
            </button>
            <Link
              to="/"
              className="flex items-center gap-3 w-full px-3 py-2 mt-1 rounded-lg text-sm text-gray-500 hover:text-gray-300 hover:bg-dark-800 transition-colors"
            >
              <ChevronRight size={18} />
              View Store
            </Link>
          </div>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main: offset on lg so fixed sidebar doesn’t cover content; min-h-0 for scroll */}
      <div className="flex w-0 min-h-0 flex-1 flex-col min-w-0 lg:ml-60">
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-4 sticky top-0 z-30">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-gray-600 hover:text-gray-900">
            <Menu size={22} />
          </button>
          <h1 className="text-lg font-semibold text-dark-900">{title}</h1>
        </header>
        <main className="flex-1 min-h-0 p-4 sm:p-6 overflow-auto">
          {children}
        </main>
      </div>
      <BarcodeScannerModal open={scanOpen} onClose={() => setScanOpen(false)} onDetected={onBarcodeDetected} />
    </div>
  );
}
