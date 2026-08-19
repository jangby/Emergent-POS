import "./App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { BrandingProvider } from "./context/BrandingContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import POS from "./pages/POS";
import Inventory from "./pages/Inventory";
import Transactions from "./pages/Transactions";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import RestockAI from "./pages/RestockAI";
import WhatsAppOrder from "./pages/WhatsAppOrder";
import OnlineOrders from "./pages/OnlineOrders";
import Shifts from "./pages/Shifts";
import Promotions from "./pages/Promotions";
import BarcodePrint from "./pages/BarcodePrint";
import Customers from "./pages/Customers";
import Expenses from "./pages/Expenses";
import Bundles from "./pages/Bundles";
import Staff from "./pages/Staff";
import OfflineIndicator from "./components/OfflineIndicator";
import InstallBanner from "./components/InstallPWA";
import { Toaster } from "./components/ui/sonner";

// Wrapper for owner-only pages: cashiers are auto-redirected to POS.
const Owner = ({ children }) => (
  <ProtectedRoute ownerOnly>
    <Layout>{children}</Layout>
  </ProtectedRoute>
);
const Any = ({ children }) => (
  <ProtectedRoute>
    <Layout>{children}</Layout>
  </ProtectedRoute>
);

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrandingProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              {/* Cashier + Owner */}
              <Route path="/" element={<Any><POS /></Any>} />
              <Route path="/shifts" element={<Any><Shifts /></Any>} />
              <Route path="/transactions" element={<Any><Transactions /></Any>} />
              {/* Owner only */}
              <Route path="/inventory" element={<Owner><Inventory /></Owner>} />
              <Route path="/restock" element={<Owner><RestockAI /></Owner>} />
              <Route path="/wa-orders" element={<Owner><WhatsAppOrder /></Owner>} />
              <Route path="/online-orders" element={<Owner><OnlineOrders /></Owner>} />
              <Route path="/promotions" element={<Owner><Promotions /></Owner>} />
              <Route path="/barcodes" element={<Owner><BarcodePrint /></Owner>} />
              <Route path="/customers" element={<Owner><Customers /></Owner>} />
              <Route path="/expenses" element={<Owner><Expenses /></Owner>} />
              <Route path="/bundles" element={<Owner><Bundles /></Owner>} />
              <Route path="/analytics" element={<Owner><Analytics /></Owner>} />
              <Route path="/settings" element={<Owner><Settings /></Owner>} />
              <Route path="/staff" element={<Owner><Staff /></Owner>} />
            </Routes>
            <OfflineIndicator />
            <InstallBanner />
            <Toaster position="top-right" richColors />
          </BrowserRouter>
        </BrandingProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
