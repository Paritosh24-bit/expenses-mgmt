import React from "react";
import { useAuth } from "../context/AuthContext";
import { Link, useLocation } from "react-router-dom";
import { LogOut, User, Shield, Briefcase, Plus, FileText, ClipboardList } from "lucide-react";
import { CompanyLogo } from "./CompanyLogo";

export const Navbar: React.FC = () => {
  const { profile, signOut } = useAuth();
  const location = useLocation();

  const isCurrent = (path: string) => location.pathname === path;

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo Brand area */}
          <div className="flex items-center gap-6">
            <div className="flex-shrink-0 flex items-center">
              <CompanyLogo variant="horizontal" iconSize={38} />
            </div>

            {/* Dynamic Navigation Links based on role */}
            <div className="hidden md:flex items-center gap-1.5 border-l border-slate-200 pl-6 h-8">
              {profile?.role === "employee" && (
                <>
                  <Link
                    to="/employee-dashboard"
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      isCurrent("/employee-dashboard") ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    My Dashboard
                  </Link>
                  <Link
                    to="/employee/add-expense"
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1 ${
                      isCurrent("/employee/add-expense") ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    <Plus className="w-3 h-3" /> Add Claim
                  </Link>
                  <Link
                    to="/employee/history"
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      isCurrent("/employee/history") ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    History
                  </Link>
                </>
              )}

              {profile?.role === "accounts" && (
                <>
                  <Link
                    to="/accounts-dashboard"
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                      isCurrent("/accounts-dashboard") ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    <ClipboardList className="w-3.5 h-3.5" />
                    Audit Ledger
                  </Link>
                  <Link
                    to="/employee-dashboard"
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                      isCurrent("/employee-dashboard") ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    My Personal Claims
                  </Link>
                  <Link
                    to="/employee/add-expense"
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1 ${
                      isCurrent("/employee/add-expense") ? "bg-white border border-slate-200 shadow-2xs text-slate-700 hover:bg-slate-50" : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    <Plus className="w-3 h-3" /> Create Claim
                  </Link>
                </>
              )}

              {profile?.role === "admin" && (
                <Link
                  to="/admin-dashboard"
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    isCurrent("/admin-dashboard") ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  Admin Console
                </Link>
              )}
            </div>
          </div>

          {/* User Info & Actions */}
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end">
              <span id="nav-user-name" className="text-sm font-semibold text-slate-800">
                {profile?.name || "Active Session"}
              </span>
              <span id="nav-user-role" className="inline-flex items-center gap-1 mt-0.5 text-xs font-medium px-2 py-0.5 rounded-full capitalize bg-slate-100 text-slate-800 font-sans">
                {profile?.role === "admin" ? (
                  <Shield className="w-3 h-3 text-indigo-600" />
                ) : profile?.role === "accounts" ? (
                  <Briefcase className="w-3 h-3 text-slate-900" />
                ) : (
                  <Briefcase className="w-3 h-3 text-slate-600" />
                )}
                {profile?.role === "accounts" ? "Accounts Dept" : profile?.role}
              </span>
            </div>

            {/* Profile Avatar Emblem */}
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-950 text-white font-bold select-none text-sm">
              {profile?.name ? profile.name.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
            </div>

            <button
              onClick={signOut}
              className="inline-flex items-center gap-2 px-3  py-2 sm:px-4 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-sm font-medium transition-colors"
              title="Logout session"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};
