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
import OfflineIndicator from "./components/OfflineIndicator";
import InstallBanner from "./components/InstallPWA";
import { Toaster } from "./components/ui/sonner";

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrandingProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<ProtectedRoute><Layout><POS /></Layout></ProtectedRoute>} />
              <Route path="/inventory" element={<ProtectedRoute><Layout><Inventory /></Layout></ProtectedRoute>} />
              <Route path="/restock" element={<ProtectedRoute><Layout><RestockAI /></Layout></ProtectedRoute>} />
              <Route path="/wa-orders" element={<ProtectedRoute><Layout><WhatsAppOrder /></Layout></ProtectedRoute>} />
              <Route path="/online-orders" element={<ProtectedRoute><Layout><OnlineOrders /></Layout></ProtectedRoute>} />
              <Route path="/shifts" element={<ProtectedRoute><Layout><Shifts /></Layout></ProtectedRoute>} />
              <Route path="/promotions" element={<ProtectedRoute><Layout><Promotions /></Layout></ProtectedRoute>} />
              <Route path="/barcodes" element={<ProtectedRoute><Layout><BarcodePrint /></Layout></ProtectedRoute>} />
              <Route path="/customers" element={<ProtectedRoute><Layout><Customers /></Layout></ProtectedRoute>} />
              <Route path="/expenses" element={<ProtectedRoute><Layout><Expenses /></Layout></ProtectedRoute>} />
              <Route path="/bundles" element={<ProtectedRoute><Layout><Bundles /></Layout></ProtectedRoute>} />
              <Route path="/transactions" element={<ProtectedRoute><Layout><Transactions /></Layout></ProtectedRoute>} />
              <Route path="/analytics" element={<ProtectedRoute><Layout><Analytics /></Layout></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Layout><Settings /></Layout></ProtectedRoute>} />
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
