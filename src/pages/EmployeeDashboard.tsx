import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { 
  PlusCircle, History, Calendar, FileText, TrendingUp, AlertCircle, 
  DollarSign, Clock, LayoutGrid, CheckCircle2, ArrowRight, ExternalLink, RefreshCw 
} from "lucide-react";
import { motion } from "motion/react";
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  CartesianGrid 
} from "recharts";

export const EmployeeDashboard: React.FC = () => {
  const { user } = useAuth();
  
  // Data state
  const [expenses, setExpenses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchMyExpenses = async () => {
    if (!user) return;
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("employee_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setExpenses(data || []);
    } catch (err: any) {
      setErrorMsg("Failed to synchronize your claims records: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMyExpenses();
  }, [user]);

  // Aggregation Calculations (strictly counting only status-approved by Accounts Head):
  // 1. Current Month Expense Total
  const currentMonthExpenseTotal = Math.round(
    expenses
      .filter((e) => {
        if (!e.expense_date) return false;
        if (e.accounts_status !== "approved") return false;
        const today = new Date();
        const yr = today.getFullYear();
        const mo = String(today.getMonth() + 1).padStart(2, "0");
        return e.expense_date.startsWith(`${yr}-${mo}`);
      })
      .reduce((sum, e) => sum + parseFloat(e.amount || 0), 0) * 100
  ) / 100;

  // 2. Lifetime Accumulated Total
  const lifetimeTotal = Math.round(
    expenses
      .filter((e) => e.accounts_status === "approved")
      .reduce((sum, e) => sum + parseFloat(e.amount || 0), 0) * 100
  ) / 100;

  // 3. Last Expense Date
  const lastExpenseDate = expenses.length > 0 
    ? expenses[0].expense_date 
    : "—";

  // Recent 10 items
  const recent10Expenses = expenses.slice(0, 10);

  // Daily Chart feed: recent 5 items aggregated
  const chartData = expenses
    .slice(0, 7)
    .reverse()
    .map((item) => ({
      date: item.expense_date ? item.expense_date.slice(5) : "Claim", // MM-DD
      "Billing Amount": parseFloat(item.amount || 0)
    }));

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">

        {/* Dashboard Landing Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-8">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Logged in Employee Workspace</span>
            <h1 className="text-2xl sm:text-3xl font-sans font-extrabold text-slate-905 tracking-tight mt-1">
              Welcome to Your Expense portal
            </h1>
            <p className="text-sm text-slate-400 font-semibold mt-1">
              Submit, track, and synchronize all your corporate claims dynamically with standard Supabase vaults.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/employee/add-expense"
              className="inline-flex items-center gap-2 bg-slate-950 hover:bg-slate-900 text-white rounded-lg px-4.5 py-2.5 text-xs font-bold shadow-md transition"
            >
              <PlusCircle className="w-4 h-4" />
              Register New Claim
            </Link>

            <Link
              to="/employee/history"
              className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg px-4 py-2.5 text-xs font-bold shadow-2xs transition"
            >
              <History className="w-4 h-4" />
              Claims History
            </Link>

            <button
              onClick={fetchMyExpenses}
              disabled={isLoading}
              className="p-2.5 bg-white border border-slate-250 hover:bg-slate-50 rounded-lg text-slate-700 shadow-2xs"
              title="Refresh database records"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading && "animate-spin"}`} />
            </button>
          </div>
        </div>

        {/* Sync Errors warning */}
        {errorMsg && (
          <div className="space-y-4 mb-6">
            <div className="p-4 rounded-xl bg-red-50 border border-red-150 text-red-800 text-xs font-semibold flex items-center justify-between">
              <span>⚠️ {errorMsg}</span>
              <button onClick={fetchMyExpenses} className="underline font-bold">Retry Sync</button>
            </div>

            {(errorMsg.toLowerCase().includes("column") || errorMsg.toLowerCase().includes("cache") || errorMsg.toLowerCase().includes("relation") || errorMsg.toLowerCase().includes("constraint")) && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-left">
                <h3 className="text-xs font-black text-amber-850 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                  <AlertCircle className="w-4.5 h-4.5 text-amber-700" />
                  Supabase SQL Schema Alignment Recommended
                </h3>
                <p className="text-xs text-amber-800 leading-relaxed mb-3">
                  The database reports a schema mismatch on your remote Supabase instance (likely because your <code>expenses</code> table does not have the newer workflow columns or category checks).
                  To fix this, go to your <strong>Supabase Project &gt; SQL Editor</strong>, paste this snippet, and click <strong>Run</strong>:
                </p>
                <pre className="bg-slate-900 text-slate-100 text-[10px] font-mono p-4 rounded-lg overflow-x-auto select-all max-h-48 leading-relaxed">
{`ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS workflow_status TEXT NOT NULL DEFAULT 'Pending Accounts Approval',
ADD COLUMN IF NOT EXISTS accounts_status TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS accounts_approved_by UUID REFERENCES public.user_profiles(user_id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS accounts_approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS accounts_remarks TEXT,
ADD COLUMN IF NOT EXISTS admin_status TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS admin_approved_by UUID REFERENCES public.user_profiles(user_id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS admin_approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS admin_remarks TEXT,
ADD COLUMN IF NOT EXISTS approval_history JSONB NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS expense_nature TEXT DEFAULT 'Reimbursement',
ADD COLUMN IF NOT EXISTS gst_type TEXT DEFAULT 'Non-GST Bill',
ADD COLUMN IF NOT EXISTS payment_term TEXT DEFAULT 'Immediate',
ADD COLUMN IF NOT EXISTS custom_payment_term TEXT;

ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS created_by UUID;

-- Update Category Check Constraint
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_expense_type_check;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_expense_type_check 
CHECK (expense_type IN ('Food', 'Petrol', 'Travel', 'Accommodation', 'Office Supplies', 'Medical', 'Internet', 'Subscription', 'Society Maintenance', 'Electricity', 'Vendor', 'Other'));

-- Refresh cache
NOTIFY pgrst, 'reload schema';`}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Dashboard exactly 3 key metrics cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          
          {/* Card 1: Current Month Spend */}
          <div className="bg-slate-950 p-5 rounded-2xl text-white shadow-md border border-slate-800 hover:scale-[1.01] transition-transform duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-300 font-bold uppercase tracking-wider block">Expenses for This Month</span>
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
            </div>
            <span className="text-2xl sm:text-3xl font-black font-mono block mt-2 text-white">
              ₹{currentMonthExpenseTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[11px] text-slate-400 block mt-2 font-medium">Accumulated during this calendar month</span>
          </div>

          {/* Card 2: Lifetime Total */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:scale-[1.01] transition-transform duration-200">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Lifetime Total</span>
            <span className="text-2xl sm:text-3xl font-black font-mono block mt-2 text-slate-900">
              ₹{lifetimeTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[11px] text-emerald-600 block mt-2 font-bold">All-time corporate claim log</span>
          </div>

          {/* Card 3: Latest Claim Date */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:scale-[1.01] transition-transform duration-200">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Latest Claim Date</span>
            </div>
            <span className="text-xl sm:text-2xl font-black block mt-2.5 text-slate-800 font-mono">
              {lastExpenseDate}
            </span>
            <span className="text-[11px] text-slate-405 block mt-2 font-medium">Most recent registered entry date</span>
          </div>

        </div>

        {/* Bento Split layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Column 1 & 2: Recent 10 claims list Table */}
          <div className="lg:col-span-2 space-y-6">
            
            <div className="bg-white rounded-2xl border border-slate-205 shadow-xs overflow-hidden">
              
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-150 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-700">Recent Claim Slip Registry (Latest 10)</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Summary ledger of recent expenses registered.</p>
                </div>
                <Link
                  to="/employee/history"
                  className="text-xs font-bold text-slate-500 hover:text-slate-900 inline-flex items-center gap-1.5"
                >
                  View History Registry <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {isLoading ? (
                <div className="p-16 text-center">
                  <svg className="animate-spin h-6 w-6 text-slate-950 mx-auto" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
              ) : recent10Expenses.length === 0 ? (
                <div className="p-16 text-center text-slate-400">
                  <LayoutGrid className="w-10 h-10 text-slate-350 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-700">No expenses recorded yet.</p>
                  <p className="text-[10px] text-slate-450 mt-0.5">Click "Register New Claim" above to begin your first submission.</p>
                </div>
              ) : (
                <div className="overflow-x-auto text-xs">
                  <table className="min-w-full text-left divide-y divide-slate-150 text-slate-700">
                    <thead className="bg-slate-50/50 font-bold uppercase text-[10px] text-slate-500 tracking-wider">
                      <tr>
                        <th className="px-6 py-3.5">Claim Date</th>
                        <th className="px-6 py-3.5">Expense Category</th>
                        <th className="px-6 py-3.5">Amount (INR)</th>
                        <th className="px-6 py-3.5">Sync Status</th>
                        <th className="px-6 py-3.5">Proof File</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150">
                      {recent10Expenses.map((exp) => (
                        <tr key={exp.id} className="hover:bg-slate-50/20 transition-colors">
                          
                          {/* Date */}
                          <td className="px-6 py-3.5 font-bold font-mono text-slate-800">
                            {exp.expense_date}
                          </td>

                          {/* Category Type */}
                          <td className="px-6 py-3.5">
                            <span className="block font-semibold text-slate-700">{exp.expense_type}</span>
                            {exp.custom_type && <span className="text-[9px] text-slate-400 italic block font-medium">({exp.custom_type})</span>}
                            
                            {/* Metadata list */}
                            <div className="flex flex-wrap gap-1 mt-1">
                              {exp.expense_nature && (
                                <span className="bg-slate-100 text-slate-700 px-1 py-0.5 text-[8px] rounded font-medium">
                                  {exp.expense_nature}
                                </span>
                              )}
                              {exp.gst_type && (
                                <span className="bg-slate-100 text-slate-750 px-1 py-0.5 text-[8px] rounded font-medium">
                                  {exp.gst_type}
                                </span>
                              )}
                              {exp.payment_term && (
                                <span className="bg-indigo-50 text-indigo-700 px-1 py-0.5 text-[8px] rounded font-medium">
                                  {exp.payment_term === "Custom" ? `Pay Term: ${exp.custom_payment_term}` : `Pay Term: ${exp.payment_term}`}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Amount */}
                          <td className="px-6 py-3.5 font-extrabold text-slate-900 font-mono">
                            ₹{parseFloat(exp.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>

                          {/* Approval / Workflow Status */}
                          <td className="px-6 py-3.5">
                            <div className="flex flex-col gap-1 items-start">
                              {(!exp.workflow_status || exp.workflow_status === "Pending Accounts Approval") && (
                                <span className="inline-flex px-1.5 py-0.5 rounded text-[8px] uppercase font-bold bg-amber-50 text-amber-800 border border-amber-100">
                                  Pending Accounts
                                </span>
                              )}
                              {exp.workflow_status === "Approved by Accounts" && (
                                <span className="inline-flex px-1.5 py-0.5 rounded text-[8px] uppercase font-bold bg-indigo-50 text-indigo-800 border border-indigo-100">
                                  Approved by Accounts
                                </span>
                              )}
                              {exp.workflow_status === "Rejected by Accounts" && (
                                <span className="inline-flex px-1.5 py-0.5 rounded text-[8px] uppercase font-bold bg-red-100 text-red-800 border border-red-200">
                                  Rejected by Accounts
                                </span>
                              )}
                              {exp.workflow_status === "Approved by Admin" && (
                                <span className="inline-flex px-1.5 py-0.5 rounded text-[8px] uppercase font-bold bg-emerald-50 text-emerald-800 border border-emerald-100">
                                  Approved by Admin
                                </span>
                              )}
                              {exp.workflow_status === "Rejected by Admin" && (
                                <span className="inline-flex px-1.5 py-0.5 rounded text-[8px] uppercase font-bold bg-rose-50 text-rose-805 border border-rose-100">
                                  Rejected by Admin
                                </span>
                              )}

                              {/* Remarks */}
                              {exp.accounts_remarks && (
                                <div className="text-[9px] text-slate-500 font-medium leading-tight">
                                  <span className="font-bold text-slate-700">Accounts:</span> {exp.accounts_remarks}
                                </div>
                              )}
                              {exp.admin_remarks && (
                                <div className="text-[9px] text-slate-500 font-medium leading-tight">
                                  <span className="font-bold text-slate-700">Admin:</span> {exp.admin_remarks}
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Download Link */}
                          <td className="px-6 py-3.5">
                            {exp.proof_url ? (
                              <a
                                href={exp.proof_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center text-[10px] font-bold text-indigo-700 hover:underline gap-1"
                              >
                                View File
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            ) : (
                              <span className="text-slate-400">None</span>
                            )}
                          </td>

                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

            </div>

          </div>

          {/* Column 3: Charts and Guidance info */}
          <div className="space-y-6">

            {/* Area Chart: claim values dynamic trend lines */}
            <div className="bg-white p-5 border border-slate-205 rounded-2xl shadow-xs">
              <h4 className="text-xs font-black uppercase tracking-widest text-slate-755 mb-4 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <TrendingUp className="w-4 h-4 text-slate-400" />
                Latest Claims Dynamic
              </h4>

              {chartData.length === 0 ? (
                <div className="h-44 flex items-center justify-center text-xs text-slate-400 font-semibold text-center">
                  Register at least one claim to load statistical trend lines.
                </div>
              ) : (
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="billingGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0f172a" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#0f172a" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} />
                      <YAxis stroke="#94a3b8" fontSize={10} />
                      <Tooltip formatter={(value: any) => `₹${parseFloat(value).toLocaleString("en-IN")}`} />
                      <Area type="monotone" dataKey="Billing Amount" stroke="#0f172a" strokeWidth={2.5} fillOpacity={1} fill="url(#billingGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Quick help guides */}
            <div className="bg-slate-900 rounded-2xl p-5 text-white shadow-xs">
              <h4 className="text-xs font-bold text-amber-400 tracking-wider uppercase mb-1">Audit Policy Guidelines</h4>
              <p className="text-[11px] text-slate-350 leading-relaxed mt-2 font-medium">
                1. Make sure to choose the correct category dropdown item.<br/>
                2. When "Other" is chosen, specify custom labels description.<br/>
                3. Keep original copies of receipts; physical proofs might still be audited.<br/>
                4. Archived claims represent historical lock points configured by Admins during monthly payroll checks.
              </p>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
