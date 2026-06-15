import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Route protection for Admin users only.
 */
export const AdminRoute: React.FC = () => {
  const { user, profile, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  if (!user || !profile) {
    return <Navigate to="/login" replace />;
  }

  if (profile.role !== "admin") {
    // If authenticated employee tries to enter admin area, redirect to employee board
    return <Navigate to="/employee-dashboard" replace />;
  }

  return <Outlet />;
};

/**
 * Route protection for Accounts users only.
 */
export const AccountsRoute: React.FC = () => {
  const { user, profile, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  if (!user || !profile) {
    return <Navigate to="/login" replace />;
  }

  if (profile.role !== "accounts") {
    // If not accounts role, redirect appropriately
    if (profile.role === "admin") {
      return <Navigate to="/admin-dashboard" replace />;
    } else {
      return <Navigate to="/employee-dashboard" replace />;
    }
  }

  return <Outlet />;
};

/**
 * Route protection for Employee users only.
 */
export const EmployeeRoute: React.FC = () => {
  const { user, profile, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  if (!user || !profile) {
    return <Navigate to="/login" replace />;
  }

  if (profile.role !== "employee" && profile.role !== "accounts") {
    // If authenticated admin/accounts tries to enter employee area, redirect appropriately
    if (profile.role === "admin") {
      return <Navigate to="/admin-dashboard" replace />;
    } else {
      return <Navigate to="/accounts-dashboard" replace />;
    }
  }

  return <Outlet />;
};

/**
 * Route protection for unauthenticated Guest pages (like login/forgot password).
 * Redirects active sessions into their respective role dashboards.
 */
export const GuestRoute: React.FC = () => {
  const { user, profile, isLoading, needsBootstrap } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  if (needsBootstrap) {
    // If system needs bootstrapping, let them continue or we handle it in login/signup page bypass
    return <Outlet />;
  }

  if (user && profile) {
    if (profile.role === "admin") {
      return <Navigate to="/admin-dashboard" replace />;
    } else if (profile.role === "accounts") {
      return <Navigate to="/accounts-dashboard" replace />;
    } else {
      return <Navigate to="/employee-dashboard" replace />;
    }
  }

  return <Outlet />;
};
