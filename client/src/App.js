import React from "react";
import { BrowserRouter as Router, Route, Routes, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import Contact from "./pages/Contact";
import Services from "./pages/Services";
import Shop from "./pages/Shop";
import TicketLookup from "./pages/TicketLookup";
import Login from "./pages/Login";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminReceipts from "./pages/admin/Receipts";
import AdminReceiptForm from "./pages/admin/ReceiptForm";
import AdminInventory from "./pages/admin/Inventory";
import AdminInventoryForm from "./pages/admin/InventoryForm";
import AdminMessages from "./pages/admin/Messages";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminGroceryList from "./pages/admin/GroceryList";
import AdminMetrics from "./pages/admin/Metrics";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500" />
      </div>
    );
  }
  return user ? children : <Navigate to="/login" />;
}

function SuperAdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" />;
  if (user.role !== "superadmin") return <Navigate to="/admin" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<><Navbar /><Home /><Footer /></>} />
      <Route path="/services" element={<><Navbar /><Services /><Footer /></>} />
      <Route path="/contact" element={<><Navbar /><Contact /><Footer /></>} />
      <Route path="/shop" element={<><Navbar /><Shop /><Footer /></>} />
      <Route path="/ticket" element={<><Navbar /><TicketLookup /><Footer /></>} />
      <Route path="/login" element={<Login />} />

      <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/receipts" element={<ProtectedRoute><AdminReceipts /></ProtectedRoute>} />
      <Route path="/admin/receipts/new" element={<ProtectedRoute><AdminReceiptForm /></ProtectedRoute>} />
      <Route path="/admin/receipts/legacy/new" element={<ProtectedRoute><AdminReceiptForm /></ProtectedRoute>} />
      <Route path="/admin/receipts/:id" element={<ProtectedRoute><AdminReceiptForm /></ProtectedRoute>} />
      <Route path="/admin/inventory" element={<ProtectedRoute><AdminInventory /></ProtectedRoute>} />
      <Route path="/admin/inventory/new" element={<ProtectedRoute><AdminInventoryForm /></ProtectedRoute>} />
      <Route path="/admin/inventory/:id" element={<ProtectedRoute><AdminInventoryForm /></ProtectedRoute>} />
      <Route path="/admin/grocery-list" element={<ProtectedRoute><AdminGroceryList /></ProtectedRoute>} />
      <Route path="/admin/metrics" element={<ProtectedRoute><AdminMetrics /></ProtectedRoute>} />
      <Route path="/admin/messages" element={<ProtectedRoute><AdminMessages /></ProtectedRoute>} />
      <Route path="/admin/users" element={<SuperAdminRoute><AdminUsers /></SuperAdminRoute>} />

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Toaster position="top-right" />
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;
