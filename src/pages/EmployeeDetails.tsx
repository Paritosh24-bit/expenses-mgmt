import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { 
  ArrowLeft, Calendar, FileText, User, Mail, DollarSign, 
  BarChart2, RefreshCw, AlertTriangle, ChevronRight, Archive, CheckCircle, Info, Trash2, Download
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import * as XLSX from "xlsx";

export const EmployeeDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { sessionToken } = useAuth();
  
  // Data State
  const [profile, setProfile] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [archives, setArchives] = useState<any[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Confirmation and alert overlays
  const [showDeleteProfileModal, setShowDeleteProfileModal] = useState(false);
  const [deleteExpenseConfirmId, setDeleteExpenseConfirmId] = useState<string | null>(null);
  const [infoAlert, setInfoAlert] = useState<string | null>(null);

  // Archive and Reset system modal toggles
  const [showResetModal, setShowResetModal] = useState(false);
  const [isResetPending, setIsResetPending] = useState(false);
  const [resetName, setResetName] = useState("");
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);

  // Admin dynamic approval review states
  const [reviewItem, setReviewItem] = useState<any | null>(null);
  const [adminRemarks, setAdminRemarks] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  // Admin Approval / Rejection handler via API endpoint
  const handleAdminProcessClaim = async (statusArg: "approved" | "rejected") => {
    if (!reviewItem) return;
    setSubmittingReview(true);
    setErrorMsg(null);
    setResetSuccess(null);

    try {
      const res = await fetch("/api/admin/process-claim", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          id: reviewItem.id,
          statusArg,
          remarks: adminRemarks.trim() || ""
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error ${res.status}`);
      }

      setResetSuccess(`Claim for ₹${parseFloat(reviewItem.amount || 0).toLocaleString()} successfully marked as ${statusArg} by Admin.`);
      setReviewItem(null);
      setAdminRemarks("");
      fetchEmployeeData();

    } catch (err: any) {
      setErrorMsg("Failed to process claims: " + err.message);
    } finally {
      setSubmittingReview(false);
    }
  };

  const getHeaders = () => ({
    "Content-Type": "application/json",
    "Authorization": `Bearer ${sessionToken}`
  });

  const handleDeleteEmployee = async () => {
    if (!profile || !id) return;
    
    setIsLoading(true);
    setShowDeleteProfileModal(false);
    try {
      const res = await fetch(`/api/admin/delete-employee/${id}`, {
        method: "DELETE",
        headers: getHeaders()
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete employee account.");
      }
      
      setInfoAlert(`Employee "${profile.name}" has been permanently purged from the registry.`);
      setTimeout(() => {
        navigate("/admin-dashboard");
      }, 2500);
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred during deletion.");
      setIsLoading(false);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    setDeleteExpenseConfirmId(expenseId);
  };

  const confirmDeleteExpense = async () => {
    if (!deleteExpenseConfirmId) return;
    
    try {
      const { error } = await supabase
        .from("expenses")
        .delete()
        .eq("id", deleteExpenseConfirmId);
        
      if (error) throw error;
      
      setDeleteExpenseConfirmId(null);
      await fetchEmployeeData();
    } catch (err: any) {
      setErrorMsg("Failed to delete record: " + err.message);
      setDeleteExpenseConfirmId(null);
    }
  };

  const handleExportEmployeeExpenses = () => {
    if (expenses.length === 0) {
      alert("No expense records found for this employee to export.");
      return;
    }

    const rows = expenses.map((item) => {
      return {
        "Employee Name": profile?.name || "Employee",
        "Employee Email": profile?.email || "",
        "Expense Date": item.expense_date,
        "Expense Type": item.expense_type,
        "Custom Type": item.custom_type || "",
        "Amount (INR)": parseFloat(item.amount || 0),
        "Expense Nature": item.expense_nature || "Reimbursement",
        "GST Selection": item.gst_type || "GST Bill",
        "Payment Terms": item.payment_term || "Immediate",
        "Custom Payment Term Details": item.custom_payment_term || "",
        "Workflow Status": item.workflow_status || "Pending Accounts Approval",
        "Accounts Status": item.accounts_status || "pending",
        "Accounts Remarks": item.accounts_remarks || "",
        "Accounts Approved At": item.accounts_approved_at ? new Date(item.accounts_approved_at).toLocaleString() : "",
        "Admin Status": item.admin_status || "pending",
        "Admin Remarks": item.admin_remarks || "",
        "Admin Approved At": item.admin_approved_at ? new Date(item.admin_approved_at).toLocaleString() : "",
        "Notes": item.notes || "",
        "Proof URL Link": item.proof_url || "",
        "Archive Cycle ID": item.archive_id || "",
        "Is Archived": item.is_archived ? "Yes" : "No",
        "Created At": new Date(item.created_at).toLocaleString()
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Employee Expenses");
    const today = new Date().toISOString().split("T")[0];
    const sanitizedName = (profile?.name || "employee").toLowerCase().replace(/\s+/g, "-");
    XLSX.writeFile(workbook, `${sanitizedName}-expenses-${today}.xlsx`);
  };

  const fetchEmployeeData = async () => {
    if (!id) return;
    setIsLoading(true);
    setErrorMsg(null);

    try {
      // 1. Fetch Profile
      const { data: prof, error: profErr } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", id)
        .single();

      if (profErr) throw new Error("Profile not loaded: " + profErr.message);
      setProfile(prof);

      // 2. Fetch Expenses (only those approved by Accounts head)
      const { data: expList, error: expErr } = await supabase
        .from("expenses")
        .select("*")
        .eq("employee_id", id)
        .eq("accounts_status", "approved")
        .order("created_at", { ascending: false });

      if (expErr) throw new Error("Expenses query failed: " + expErr.message);
      setExpenses(expList || []);

      // 3. Fetch Archives
      const { data: archList, error: archErr } = await supabase
        .from("expense_archives")
        .select("*")
        .eq("employee_id", id)
        .order("created_at", { ascending: false });

      if (archErr) throw new Error("Archives query failed: " + archErr.message);
      setArchives(archList || []);

      // Auto-populate Reset month name
      const now = new Date();
      const currentMonthText = now.toLocaleString("default", { month: "long" }) + " " + now.getFullYear();
      setResetName(currentMonthText);

    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred retrieving details.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployeeData();
  }, [id]);

  // Aggregate stats from matching expense rows
  const currentMonthTotal = Math.round(
    expenses
      .filter((e) => {
        if (!e.expense_date) return false;
        const today = new Date();
        const yr = today.getFullYear();
        const mo = String(today.getMonth() + 1).padStart(2, "0");
        return e.expense_date.startsWith(`${yr}-${mo}`);
      })
      .reduce((sum, e) => sum + parseFloat(e.amount || 0), 0) * 100
  ) / 100;

  const activeTotal = Math.round(
    expenses
      .filter((e) => !e.is_archived)
      .reduce((sum, e) => sum + parseFloat(e.amount || 0), 0) * 100
  ) / 100;

  const archivedExpensesTotal = Math.round(
    expenses
      .filter((e) => e.is_archived)
      .reduce((sum, e) => sum + parseFloat(e.amount || 0), 0) * 100
  ) / 100;

  // Calculated Lifetime total (active + archived)
  const lifetimeTotal = Math.round((activeTotal + archivedExpensesTotal) * 100) / 100;

  const latestClaimDate = expenses.length > 0
    ? expenses[0].expense_date
    : "—";

  // Handle Archive and Reset operation logic:
  const handleArchiveAndReset = async () => {
    if (!profile || !id) return;
    setIsResetPending(true);
    setResetSuccess(null);

    try {
      // Step 1: Filter out active (unarchived) expenses
      const activeRows = expenses.filter(e => !e.is_archived);
      
      if (activeRows.length === 0) {
        throw new Error("This employee does not have any active, unarchived expense entries at this time. Nothing to archive.");
      }

      const activeAmountSum = Math.round(activeRows.reduce((s, e) => s + parseFloat(e.amount || 0), 0) * 100) / 100;
      const now = new Date();
      const archiveMonthValue = now.getMonth() + 1; // 1-12
      const archiveYearValue = now.getFullYear();

      // Step 2: Create archive database record
      const archiveInsertPayload = {
        employee_id: id,
        archive_month: archiveMonthValue,
        archive_year: archiveYearValue,
        archive_name: resetName.trim() || `${now.toLocaleString("default", { month: "long" })} ${archiveYearValue}`,
        total_amount: activeAmountSum,
        created_by: (await supabase.auth.getUser()).data.user?.id || null
      };

      const { data: newArchive, error: archError } = await supabase
        .from("expense_archives")
        .insert(archiveInsertPayload)
        .select()
        .single();

      if (archError) throw new Error("Could not initialize archive table slot: " + archError.message);

      // Step 3: Update and secure active items
      const activeIds = activeRows.map(e => e.id);
      
      const { error: updateError } = await supabase
        .from("expenses")
        .update({
          is_archived: true,
          archive_id: newArchive.id
        })
        .in("id", activeIds);

      if (updateError) {
        // Rollback attempt: remove archive slot if update fails
        await supabase.from("expense_archives").delete().eq("id", newArchive.id);
        throw new Error("Could not assign categories to new archive key: " + updateError.message);
      }

      setResetSuccess(`Archive '${archiveInsertPayload.archive_name}' containing ₹${activeAmountSum.toLocaleString("en-IN")} was created! Active totals are reset to zero.`);
      setShowResetModal(false);
      
      // Refresh component lists
      await fetchEmployeeData();

    } catch (err: any) {
      alert(err.message || "Archive trigger failed.");
    } finally {
      setIsResetPending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-20 text-center">
        <svg className="animate-spin h-8 w-8 text-slate-950 mx-auto" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span className="text-xs text-slate-400 mt-2 block font-extrabold tracking-widest uppercase">Fetching Profile details...</span>
      </div>
    );
  }

  if (errorMsg || !profile) {
    return (
      <div className="max-w-3xl mx-auto py-20 px-4 space-y-6">
        <div className="bg-red-50 text-red-800 p-8 rounded-2xl border border-red-150 text-center">
          <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold">Failed to load Employee File</h2>
          <p className="text-xs text-red-700 mt-1">{errorMsg || "The selected profile does not exist in the database profiles directory."}</p>
          <Link to="/admin-dashboard" className="inline-block mt-4 bg-red-800 hover:bg-red-900 text-white text-xs font-bold px-4 py-2 rounded-lg">
            Return to Dashboard
          </Link>
        </div>

        {errorMsg && (errorMsg.toLowerCase().includes("column") || errorMsg.toLowerCase().includes("cache") || errorMsg.toLowerCase().includes("relation") || errorMsg.toLowerCase().includes("constraint")) && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-left">
            <h3 className="text-xs font-black text-amber-850 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
              <AlertTriangle className="w-4.5 h-4.5 text-amber-500 shrink-0" />
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
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      
      {/* Upper Navigation Back Row */}
      <div className="mb-6 flex justify-between items-center">
        <Link
          to="/admin-dashboard"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Directory
        </Link>
        <span className="text-xs text-slate-400 font-bold select-none uppercase tracking-wider">
          Admin Area <ChevronRight className="inline w-3 h-3" /> Employee Profiles
        </span>
      </div>

      {/* Success notifier bar */}
      {resetSuccess && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-150 text-emerald-800 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-bold">Reset Confirmation Complete</p>
            <p className="text-xs text-emerald-700 mt-0.5">{resetSuccess}</p>
          </div>
        </div>
      )}

      {/* Profile Header Detail Block */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-slate-950 flex items-center justify-center text-white text-2xl font-black select-none">
            {profile.name ? profile.name.slice(0, 2).toUpperCase() : <User />}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              {profile.name}
              <span className="text-xs px-2.5 py-0.5 font-bold uppercase tracking-wider rounded bg-zinc-100 text-slate-600">
                {profile.role}
              </span>
            </h1>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs font-semibold text-slate-400 mt-1">
              <span className="inline-flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> {profile.email}</span>
              <span className="hidden sm:inline text-slate-300">•</span>
              <span>Registered on {new Date(profile.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {/* Administration quick actions row */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleExportEmployeeExpenses}
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-5 py-3 rounded-lg shadow-sm transition inline-flex items-center gap-2"
            title="Download employee's expense ledger"
          >
            <Download className="w-4 h-4" />
            Export Employee Ledger (.XLSX)
          </button>

          <button
            onClick={() => setShowResetModal(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-3 rounded-lg shadow-sm transition inline-flex items-center gap-2"
          >
            <Archive className="w-4 h-4" />
            Archive & Reset Active Totals
          </button>
          
          <button
            onClick={() => setShowDeleteProfileModal(true)}
            className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-5 py-3 rounded-lg shadow-sm transition inline-flex items-center gap-2"
            title="Permanently erase employee and all their logs from database"
          >
            <Trash2 className="w-4 h-4" />
            Delete Employee Account
          </button>
        </div>
      </div>

      {/* Numerical Stats Dashboard Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        
        {/* Stat 1: Expenses for This Month */}
        <div className="bg-slate-950 text-white rounded-2xl p-5 border border-slate-800 shadow-md">
          <span className="text-xs text-slate-300 font-bold uppercase tracking-wider block">Expenses for This Month</span>
          <span className="text-2xl sm:text-3xl font-black font-mono mt-2 block">
            ₹{currentMonthTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </span>
          <span className="text-[11px] text-slate-400 font-semibold block mt-2">Active + archived inside current month</span>
        </div>

        {/* Stat 2: Lifetime Cumulative Total */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Lifetime Cumulative</span>
          <span className="text-2xl sm:text-3xl font-black font-mono mt-2 block text-slate-900">
            ₹{lifetimeTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </span>
          <span className="text-[11px] text-emerald-600 block mt-2 font-bold">Accumulated till date</span>
        </div>

        {/* Stat 3: Latest Claim Date */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Latest Claim Date</span>
          </div>
          <span className="text-xl sm:text-2xl font-black block mt-2.5 text-slate-800 font-mono">
            {latestClaimDate}
          </span>
          <span className="text-[11px] text-slate-400 block mt-2 font-semibold">User last active entry date</span>
        </div>

      </div>

      {/* Two-Column split details layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* COLUMN 1 & 2: Active & Archived Expenses List Log */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-150 flex items-center justify-between">
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-700 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-slate-400" />
                Claims Registry Activity Log
              </h2>
              <span className="text-xs px-2.5 py-0.5 font-bold rounded-full bg-slate-200 text-slate-700">{expenses.length} records</span>
            </div>

            {expenses.length === 0 ? (
              <div className="p-16 text-center text-slate-450">
                <Info className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">No claims entered yet</h4>
                <p className="text-xs text-slate-400">Claims submitted by the employee will appear immediately inside this activity registry log.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left font-sans text-xs divide-y divide-slate-150 text-slate-700">
                  <thead className="bg-slate-50 font-bold uppercase text-[10px] text-slate-500 tracking-wider">
                    <tr>
                      <th className="px-6 py-3.5">Bill Date</th>
                      <th className="px-6 py-3.5">Category</th>
                      <th className="px-6 py-3.5">Amount (INR)</th>
                      <th className="px-6 py-3.5">Log Status</th>
                      <th className="px-6 py-3.5">Proof</th>
                      <th className="px-6 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150">
                    {expenses.map((exp) => (
                      <tr key={exp.id} className="hover:bg-slate-50/50 transition-colors">
                        
                        <td className="px-6 py-4 font-mono font-bold text-slate-800">{exp.expense_date}</td>
                        
                        <td className="px-6 py-4 font-semibold">
                          <span className="block text-slate-800 font-bold">{exp.expense_type}</span>
                          {exp.custom_type && <span className="text-[10px] text-slate-400 italic font-medium">({exp.custom_type})</span>}
                          
                          {/* Metadata tags */}
                          <div className="flex flex-wrap gap-1 mt-1 font-sans text-[8.5px]">
                            {exp.expense_nature && (
                              <span className="bg-slate-100 text-slate-650 px-1 py-0.5 rounded font-bold uppercase tracking-wider">
                                {exp.expense_nature}
                              </span>
                            )}
                            {exp.gst_type && (
                              <span className="bg-slate-100 text-slate-650 px-1 py-0.5 rounded font-bold uppercase tracking-wider">
                                {exp.gst_type}
                              </span>
                            )}
                            {exp.payment_term && (
                              <span className="bg-indigo-50 text-indigo-700 px-1 py-0.5 rounded font-bold uppercase tracking-wider">
                                {exp.payment_term === "Custom" ? `Pay Term: ${exp.custom_payment_term}` : `Pay Term: ${exp.payment_term}`}
                              </span>
                            )}
                          </div>
                        </td>
                        
                        <td className="px-6 py-4 font-extrabold text-slate-950 font-mono">
                          ₹{parseFloat(exp.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1 items-start font-sans">
                            {(!exp.workflow_status || exp.workflow_status === "Pending Accounts Approval") && (
                              <span className="inline-flex px-1.5 py-0.5 rounded text-[8px] uppercase font-bold bg-amber-50 text-amber-805 border border-amber-100 tracking-wide">
                                Pending Accounts Approval
                              </span>
                            )}
                            {exp.workflow_status === "Approved by Accounts" && (
                              <span className="inline-flex px-1.5 py-0.5 rounded text-[8px] uppercase font-bold bg-emerald-50 text-emerald-800 border border-emerald-100 tracking-wide">
                                Approved by Accounts
                              </span>
                            )}
                            {exp.workflow_status === "Rejected by Accounts" && (
                              <span className="inline-flex px-1.5 py-0.5 rounded text-[8px] uppercase font-bold bg-red-100 text-red-800 border border-red-200 tracking-wide">
                                Rejected by Accounts
                              </span>
                            )}
                            {exp.workflow_status === "Approved by Admin" && (
                              <span className="inline-flex px-1.5 py-0.5 rounded text-[8px] uppercase font-bold bg-emerald-50 text-emerald-808 border border-emerald-100 tracking-wide">
                                Approved by Admin
                              </span>
                            )}
                            {exp.workflow_status === "Rejected by Admin" && (
                              <span className="inline-flex px-1.5 py-0.5 rounded text-[8px] uppercase font-bold bg-rose-50 text-rose-805 border border-rose-105 tracking-wide">
                                Rejected by Admin
                              </span>
                            )}

                            {/* Remarks */}
                            {exp.accounts_remarks && (
                              <div className="text-[9px] text-slate-500 font-medium leading-normal mt-0.5">
                                <span className="font-bold text-slate-750">Accounts Notes:</span> "{exp.accounts_remarks}"
                              </div>
                            )}
                            {exp.admin_remarks && (
                              <div className="text-[9px] text-slate-500 font-medium leading-normal">
                                <span className="font-bold text-slate-750">Admin Notes:</span> "{exp.admin_remarks}"
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          {exp.proof_url ? (
                            <a
                              href={exp.proof_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center text-[10px] gap-1 font-bold text-indigo-700 hover:underline"
                            >
                              Open file
                            </a>
                          ) : (
                            <span className="text-slate-400">None</span>
                          )}
                        </td>

                        <td className="px-6 py-4 text-right">
                          <div className="flex flex-col gap-1.5 items-end font-sans">
                            {exp.workflow_status === "Pending Accounts Approval" && (
                              <span className="text-[9px] text-slate-450 font-bold italic select-none">Awaiting Accounts</span>
                            )}

                            {exp.workflow_status && exp.workflow_status === "Rejected by Accounts" && (
                              <span className="text-[9px] text-red-500 font-bold italic select-none font-sans">Accounts Rejected</span>
                            )}
                            {exp.workflow_status === "Rejected by Admin" && (
                              <span className="text-[9px] text-red-500 font-bold italic select-none font-sans">Admin Rejected</span>
                            )}
                            {(exp.workflow_status === "Approved by Admin" || exp.workflow_status === "Approved by Accounts") && (
                              <span className="text-[9px] text-emerald-600 font-bold italic select-none font-sans">Cleared</span>
                            )}

                            <button
                              onClick={() => handleDeleteExpense(exp.id)}
                              className="inline-flex items-center gap-1 text-rose-500 hover:text-rose-700 font-bold text-[9px] uppercase transition"
                              title="Delete this record"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                              Delete
                            </button>
                          </div>
                        </td>

                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

          </div>
        </div>

        {/* COLUMN 3: Archived Months Card Deck */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-700 mb-4 flex items-center gap-1.5 pb-3 border-b border-slate-100">
              <Archive className="w-4 h-4 text-slate-500" />
              Archived Monthly Runs
            </h2>

            {archives.length === 0 ? (
              <div className="text-center py-10 text-slate-400">
                <Info className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-700">No active cycles archived.</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Use the "Archive & Reset" operation button to create the first monthly runtime cycle snapshot.</p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {archives.map((arch) => (
                  <Link
                    key={arch.id}
                    to={`/admin/archive/${arch.id}`}
                    className="block group p-4 border border-slate-250 hover:border-slate-800 rounded-xl hover:bg-slate-50/50 transition-all shadow-2xs"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-xs font-extrabold text-slate-900 group-hover:text-amber-700 transition">
                          {arch.archive_name}
                        </h4>
                        <span className="text-[10px] text-slate-450 font-medium block mt-1">
                          Calculated: {new Date(arch.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <span className="text-xs font-extrabold font-mono text-slate-950">
                        ₹{parseFloat(arch.total_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}

          </div>
        </div>

      </div>

      {/* CONFIRMATION OVERLAY MODAL */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            <div className="bg-rose-50 border-b border-rose-100 p-6 flex gap-4">
              <div className="h-10 w-10 shrink-0 rounded-full bg-rose-100 flex items-center justify-center text-rose-700">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-rose-950 uppercase tracking-tight">
                  Archive and reset active claim balance?
                </h3>
                <p className="text-xs text-rose-800 font-semibold mt-1">
                  Once executed, the running claim balance resets to zero for starting a fresh month tracking period.
                </p>
              </div>
            </div>

            {/* Modal fields / inputs */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Assigned Cycle/Monthly Run Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. June 2026"
                  value={resetName}
                  onChange={(e) => setResetName(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-250 rounded bg-slate-50 focus:bg-white"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-lg text-[10px] text-slate-450 border border-slate-150 font-medium leading-relaxed">
                ✔ Active total of <strong>₹{activeTotal.toLocaleString("en-IN")}</strong> is copied onto a permanent monthly archive card.<br/>
                ✔ All individual bill logs and uploaded PDF attachments remain stored permanently to satisfy company policies.<br/>
                ✔ Active running total becomes ₹0 for the employee to start fresh.
              </div>
            </div>

            {/* Navigation buttons */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3.5">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-950 transition"
              >
                Cancel
              </button>
              
              <button
                type="button"
                onClick={handleArchiveAndReset}
                disabled={isResetPending}
                className="inline-flex items-center gap-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs px-4 py-2.5 rounded shadow-xs"
              >
                {isResetPending ? "Executing archive..." : "Confirm Reset"}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* CONFIRM DELETE PROFILE OVERLAY */}
      {showDeleteProfileModal && profile && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-sm w-full rounded-2xl border border-slate-205 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            <div className="p-6 bg-rose-50 border-b border-rose-100 flex gap-4">
              <div className="h-10 w-10 shrink-0 rounded-full bg-rose-100 flex items-center justify-center text-rose-700">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-black text-rose-950 uppercase tracking-tight">
                  Confirm Permanent Purge?
                </h3>
                <p className="text-[11px] text-rose-800 mt-1 font-semibold">
                  {profile.name} ({profile.email})
                </p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-500 leading-relaxed">
                This will destroy their login credentials, all active monthly claims, receipts, and archived records.
              </p>
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg text-[10px] text-rose-900 font-semibold leading-relaxed">
                🚨 WARNING: This action is immediate, permanent, and absolutely irreversible. All records belonging to this employee will be deleted.
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-150 flex justify-end gap-3 font-semibold">
              <button
                onClick={() => setShowDeleteProfileModal(false)}
                className="px-4 py-2 text-xs text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteEmployee}
                disabled={isLoading}
                className="bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs px-4 py-2 rounded-lg transition shadow-xs"
              >
                {isLoading ? "Purging..." : "Confirm Purge"}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* CONFIRM DELETE INDIVIDUAL EXPENSE OVERLAY */}
      {deleteExpenseConfirmId && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-sm w-full rounded-2xl border border-slate-205 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            <div className="p-6 bg-amber-50 border-b border-amber-100 flex gap-4">
              <div className="h-10 w-10 shrink-0 rounded-full bg-amber-100 flex items-center justify-center text-amber-700">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-black text-amber-950 uppercase tracking-tight">
                  Erase Individual Expense Claim?
                </h3>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-500 leading-relaxed">
                Are you sure you want to permanently delete this individual expense record? This action is immediate and cannot be undone.
              </p>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-150 flex justify-end gap-3 font-semibold">
              <button
                onClick={() => setDeleteExpenseConfirmId(null)}
                className="px-4 py-2 text-xs text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteExpense}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-4 py-2 rounded-lg transition shadow-xs"
              >
                Confirm Delete
              </button>
            </div>

          </div>
        </div>
      )}

      {/* INFO ALERT DIALOG */}
      {infoAlert && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-sm w-full rounded-2xl border border-slate-205 shadow-2xl overflow-hidden p-6 text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="mx-auto h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-4">
              <CheckCircle className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 mb-2">Purge Successful</h3>
            <p className="text-xs text-slate-500 mb-6">{infoAlert}</p>
            <p className="text-[10px] text-slate-400 font-mono animate-pulse">Redirecting back to admin registry summary panel...</p>
          </div>
        </div>
      )}

      {/* ADMIN FINAL DECISION MODAL */}
      {reviewItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            <div className="p-6 bg-slate-50 border-b border-slate-150 flex justify-between items-start">
              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">
                  Admin Final Verdict
                </h3>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                  Ref: claim ID #{reviewItem.id.substring(0, 8)}
                </p>
              </div>
              <button
                onClick={() => { setReviewItem(null); setAdminRemarks(""); }}
                className="text-slate-405 hover:text-slate-700 font-bold text-xs"
              >
                ✕ Close
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Claim Specifications Grid */}
              <div className="grid grid-cols-2 gap-3.5 bg-slate-50 border border-slate-150 p-4 rounded-xl text-left">
                <div>
                  <span className="block text-[8px] font-black uppercase text-slate-400 tracking-wider">Expense Nature</span>
                  <span className="text-xs font-bold text-slate-805">{reviewItem.expense_nature || "Reimbursement"}</span>
                </div>
                <div>
                  <span className="block text-[8px] font-black uppercase text-slate-400 tracking-wider">GST Declaration</span>
                  <span className="text-xs font-bold text-slate-805">{reviewItem.gst_type || "No GST Bill"}</span>
                </div>
                <div>
                  <span className="block text-[8px] font-black uppercase text-slate-400 tracking-wider">Payment Terms</span>
                  <span className="text-xs font-bold text-indigo-700 uppercase">
                    {reviewItem.payment_term === "Custom" ? reviewItem.custom_payment_term : reviewItem.payment_term}
                  </span>
                </div>
                <div>
                  <span className="block text-[8px] font-black uppercase text-slate-400 tracking-wider">Amount Claimed</span>
                  <span className="text-xs font-extrabold text-slate-900 font-mono">
                    ₹{parseFloat(reviewItem.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="col-span-2 border-t border-slate-150 pt-2.5">
                  <span className="block text-[8px] font-black uppercase text-slate-400 tracking-wider">Expense Type / Item description</span>
                  <span className="text-xs font-semibold text-slate-800">
                    {reviewItem.expense_type} {reviewItem.custom_type ? `(${reviewItem.custom_type})` : ""}
                  </span>
                </div>
                {reviewItem.notes && (
                  <div className="col-span-2">
                    <span className="block text-[8px] font-black uppercase text-slate-400 tracking-wider">Employee Note Description</span>
                    <p className="text-xs text-slate-550 leading-relaxed font-sans mt-0.5">"{reviewItem.notes}"</p>
                  </div>
                )}
              </div>

              {/* Accounts review step context */}
              <div className="p-4 bg-indigo-50/40 border border-indigo-100 rounded-xl text-left font-sans">
                <span className="block text-[8.5px] font-black uppercase text-indigo-600 tracking-widest mb-1">
                  Accounts Department Stage Passed
                </span>
                <div className="text-[11px] text-slate-700 leading-normal space-y-1">
                  <p>✔ <strong className="text-slate-850">Accounts status:</strong> Approved</p>
                  {reviewItem.accounts_remarks && (
                    <p>✔ <strong className="text-slate-855">Accounts remarks:</strong> "{reviewItem.accounts_remarks}"</p>
                  )}
                  {reviewItem.accounts_approved_at && (
                    <p className="text-[9.5px] text-slate-400 font-mono">
                      Timestamp: {new Date(reviewItem.accounts_approved_at).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>

              {/* Admin feedback notes input */}
              <div className="space-y-1 text-left">
                <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider">
                  Admin Final remarks & Feedback Notes
                </label>
                <textarea
                  className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-250 rounded-xl focus:bg-white min-h-[80px]"
                  placeholder="Record mandatory rationale, approval context, or rejection causes for the employee..."
                  value={adminRemarks}
                  onChange={(e) => setAdminRemarks(e.target.value)}
                  maxLength={400}
                />
              </div>
            </div>

            {/* Verdict footer actions */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-150 flex justify-between gap-3 font-semibold">
              <button
                onClick={() => { setReviewItem(null); setAdminRemarks(""); }}
                type="button"
                className="px-4 py-2 text-xs text-slate-650 hover:text-slate-900"
              >
                Cancel
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleAdminProcessClaim("rejected")}
                  disabled={submittingReview}
                  className="bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs px-4 py-2.5 rounded-lg shadow-sm transition"
                >
                  Reject Claim
                </button>
                <button
                  type="button"
                  onClick={() => handleAdminProcessClaim("approved")}
                  disabled={submittingReview}
                  className="bg-emerald-650 hover:bg-emerald-750 disabled:opacity-50 text-white font-bold text-xs px-4 py-2.5 rounded-lg shadow-sm transition"
                >
                  {submittingReview ? "Processing..." : "Approve Claim"}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
