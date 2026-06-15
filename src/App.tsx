import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { GuestRoute, AdminRoute, EmployeeRoute, AccountsRoute } from "./components/RouteGuards";
import { Navbar } from "./components/Navbar";

// Page Views
import { Login } from "./pages/Login";
import { ForgotPassword } from "./pages/ForgotPassword";
import { ResetPassword } from "./pages/ResetPassword";
import { AdminDashboard } from "./pages/AdminDashboard";
import { AccountsDashboard } from "./pages/AccountsDashboard";
import { EmployeeDashboard } from "./pages/EmployeeDashboard";
import { AddExpense } from "./pages/AddExpense";
import { History } from "./pages/History";
import { EmployeeDetails } from "./pages/EmployeeDetails";
import { ArchiveDetails } from "./pages/ArchiveDetails";

// Layout wrapper for authenticated pages, ensuring Navbar is permanently visible
const AuthenticatedLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main id="authenticated-content-wrapper">
        {children}
      </main>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Guest Only Routes: Accessible strictly when not logged in */}
          <Route element={<GuestRoute />}>
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
          </Route>

          {/* Admin Protected Routes: Restricts access to administrator roles only */}
          <Route element={<AdminRoute />}>
            <Route 
              path="/admin-dashboard" 
              element={
                <AuthenticatedLayout>
                  <AdminDashboard />
                </AuthenticatedLayout>
              } 
            />
            <Route 
              path="/admin/employee/:id" 
              element={
                <AuthenticatedLayout>
                  <EmployeeDetails />
                </AuthenticatedLayout>
              } 
            />
            <Route 
              path="/admin/archive/:id" 
              element={
                <AuthenticatedLayout>
                  <ArchiveDetails />
                </AuthenticatedLayout>
              } 
            />
          </Route>

          {/* Accounts Department Protected Routes */}
          <Route element={<AccountsRoute />}>
            <Route 
              path="/accounts-dashboard" 
              element={
                <AuthenticatedLayout>
                  <AccountsDashboard />
                </AuthenticatedLayout>
              } 
            />
          </Route>

          {/* Employee Protected Routes: Restricts access to employee roles only */}
          <Route element={<EmployeeRoute />}>
            <Route 
              path="/employee-dashboard" 
              element={
                <AuthenticatedLayout>
                  <EmployeeDashboard />
                </AuthenticatedLayout>
              } 
            />
            <Route 
              path="/employee/add-expense" 
              element={
                <AuthenticatedLayout>
                  <AddExpense />
                </AuthenticatedLayout>
              } 
            />
            <Route 
              path="/employee/history" 
              element={
                <AuthenticatedLayout>
                  <History />
                </AuthenticatedLayout>
              } 
            />
          </Route>

          {/* Root Fallback Redirection */}
          <Route 
            path="/" 
            element={<Navigate to="/login" replace />} 
          />
          
          {/* Wildcard Fallback */}
          <Route 
            path="*" 
            element={<Navigate to="/login" replace />} 
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
