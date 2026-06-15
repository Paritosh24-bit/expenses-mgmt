import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { 
  Briefcase, CheckCircle2, XCircle, AlertCircle, Search, Filter, 
  ExternalLink, FileText, Send, Clock, DollarSign, ListFilter, User
} from "lucide-react";

export const AccountsDashboard: React.FC = () => {
  const { user, profile, sessionToken } = useAuth();
  
  // Backing records
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Search/Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [natureFilter, setNatureFilter] = useState("all"); // all, Reimbursement, Vendor Payment, Purchase
  const [typeFilter, setTypeFilter] = useState("all"); // pending, approved, rejected

  // Active reviewing modal
  const [reviewItem, setReviewItem] = useState<any | null>(null);
  const [remarks, setRemarks] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  // Load claims data via server-side API proxy (which uses service_role client to successfully bypass RLS)
  const loadAccountsData = async () => {
    if (!sessionToken) {
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      // Fetch all claims sorted by creation time descending (newest first)
      const expsRes = await fetch("/api/accounts/expenses", {
        headers: {
          Authorization: `Bearer ${sessionToken}`
        }
      });
      if (!expsRes.ok) {
        const errJson = await expsRes.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP error ${expsRes.status}`);
      }
      const exps = await expsRes.json();

      // Fetch all user profiles for client-side joining
      const profsRes = await fetch("/api/accounts/user-profiles", {
        headers: {
          Authorization: `Bearer ${sessionToken}`
        }
      });
      if (!profsRes.ok) {
        const errJson = await profsRes.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP error ${profsRes.status}`);
      }
      const profs = await profsRes.json();

      // Map profiles to their respective expenses in memory
      const joinedData = (exps || []).map((item: any) => {
        const matchingProfile = (profs || []).find((p: any) => p.user_id === item.employee_id);
        return {
          ...item,
          user_profiles: matchingProfile || null
        };
      });

      setExpenses(joinedData);
    } catch (err: any) {
      setErrorMsg("Failed to synchronize Accounts ledger: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sessionToken) {
      loadAccountsData();
    }
  }, [sessionToken]);

  // Update Status action via secure server-side API proxy
  const handleProcessClaim = async (statusArg: "approved" | "rejected") => {
    if (!reviewItem) return;
    setSubmittingReview(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (!user || !profile || !sessionToken) {
        throw new Error("No active credentials identified. Please authenticate.");
      }

      const res = await fetch("/api/accounts/process-claim", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          id: reviewItem.id,
          statusArg,
          remarks
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP error ${res.status}`);
      }

      setSuccessMsg(`Claim record for ${reviewItem.user_profiles?.name || "Employee"} has been successfully marked as ${statusArg}.`);
      setReviewItem(null);
      setRemarks("");
      loadAccountsData();

      // Clear banner shortly
      setTimeout(() => {
        setSuccessMsg(null);
      }, 3000);

    } catch (err: any) {
      setErrorMsg("Failed to finalize claim processing: " + err.message);
    } finally {
      setSubmittingReview(false);
    }
  };

  // Metric aggregates
  const pendingCount = expenses.filter(e => e.workflow_status === "Pending Accounts Approval").length;
  const pendingAmount = expenses
    .filter(e => e.workflow_status === "Pending Accounts Approval")
    .reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);

  const processedCount = expenses.filter(e => e.accounts_status !== "pending").length;

  // Filter application
  const filteredExpenses = expenses.filter(item => {
    // 1. Search Query selection
    const empName = (item.user_profiles?.name || "").toLowerCase();
    const empEmail = (item.user_profiles?.email || "").toLowerCase();
    const typeLabel = (item.expense_type || "").toLowerCase();
    const notesLabel = (item.notes || "").toLowerCase();
    const matchesSearch = 
      empName.includes(searchQuery.toLowerCase()) || 
      empEmail.includes(searchQuery.toLowerCase()) ||
      typeLabel.includes(searchQuery.toLowerCase()) ||
      notesLabel.includes(searchQuery.toLowerCase());

    // 2. Nature constraint selection
    const matchesNature = natureFilter === "all" || item.expense_nature === natureFilter;

    // 3. Workflow status constraint selection
    let matchesType = true;
    if (typeFilter === "pending") {
      matchesType = item.workflow_status === "Pending Accounts Approval";
    } else if (typeFilter === "processed") {
      matchesType = item.accounts_status !== "pending";
    }

    return matchesSearch && matchesNature && matchesType;
  });

  // Sort claims according to precise request:
  // "the main listing should be on the basis of most recent claim, the emps with most recent claims shd be placed at the top in dec order of expense claim and the ones who have no claim or has past claims (approved/rejected/processed) shd be placed after all the new claims"
  const sortedExpenses = [...filteredExpenses].sort((a, b) => {
    const isPendingA = a.workflow_status === "Pending Accounts Approval";
    const isPendingB = b.workflow_status === "Pending Accounts Approval";

    if (isPendingA !== isPendingB) {
      return isPendingA ? -1 : 1;
    }

    const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return timeB - timeA;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 font-sans">
      
      {/* Upper Welcome and Branding Area */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <span className="text-xs font-black uppercase tracking-widest text-[#4f46e5]">Accounts Operations Portal</span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
            Accounts Review Desk
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Evaluate, validate, and sanction submitted employee corporate expense claims prior to final Admin clearance.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Link
            to="/employee/add-expense"
            className="px-4 py-2 text-xs font-bold bg-[#4f46e5] text-white hover:bg-opacity-90 rounded-lg shadow-sm transition"
          >
            + File My Expense
          </Link>
          <button 
            onClick={loadAccountsData}
            className="px-4 py-2 text-xs font-bold border border-slate-200 hover:border-slate-800 bg-white hover:bg-slate-50 text-slate-700 rounded-lg shadow-xs transition"
          >
            Refresh Desk Ledger
          </button>
        </div>
      </div>

      {/* Overview stats layout */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        
        {/* Metric Card 1: Queued Count */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Queued For Audit</span>
            <span className="text-3xl font-black text-slate-900 mt-1 block">{pendingCount}</span>
            <span className="text-xs text-amber-600 font-semibold mt-1 inline-flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> Awaiting Evaluation
            </span>
          </div>
          <div className="p-4 rounded-xl bg-amber-50 text-amber-600">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Metric Card 2: Queued Amount */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Accounts Pending Volume</span>
            <span className="text-2xl sm:text-3xl font-black text-slate-900 mt-1 block">
              ₹{pendingAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-[#4f46e5] font-semibold mt-1 inline-flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5" /> Valuation Total
            </span>
          </div>
          <div className="p-4 rounded-xl bg-indigo-50 text-[#4f46e5]">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        {/* Metric Card 3: Processed Count */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Accounts Audited Lifetime</span>
            <span className="text-3xl font-black text-slate-900 mt-1 block">{processedCount}</span>
            <span className="text-xs text-emerald-600 font-semibold mt-1 inline-flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Total Audits Settled
            </span>
          </div>
          <div className="p-4 rounded-xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

      </div>

      {/* Success/Error Feed Banners */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-100 mb-6 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-slate-900">Desk Ledger Altered</h4>
            <p className="text-xs text-slate-600 mt-1">{successMsg}</p>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="space-y-4 mb-6">
          <div className="p-4 rounded-xl bg-red-50 text-red-800 border border-red-100 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-slate-900">Transaction Failed</h4>
              <p className="text-xs text-slate-600 mt-1">{errorMsg}</p>
            </div>
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

      {/* Filters and searching container toolbar */}
      <div className="bg-white p-4 border border-slate-200 rounded-xl mb-6 shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between">
        
        {/* Search Input bar */}
        <div className="w-full md:w-96 relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder="Search employee, category, descriptions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-950 transition-colors"
          />
        </div>

        {/* Option Filters dropdown selectors */}
        <div className="w-full md:w-auto flex flex-wrap sm:flex-nowrap gap-3 items-center">
          
          <div className="flex items-center gap-1.5">
            <ListFilter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={natureFilter}
              onChange={(e) => setNatureFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700"
            >
              <option value="all">All Natures</option>
              <option value="Reimbursement">Reimbursement</option>
              <option value="Vendor Payment">Vendor Payment</option>
              <option value="Purchase">Purchase</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700"
            >
              <option value="pending">Show Pending Audit</option>
              <option value="processed">Show Audited Claims</option>
              <option value="all">Show All Records</option>
            </select>
          </div>

        </div>

      </div>

      {/* Main Ledger Claims List Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-12">
        <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
          <span className="text-xs font-bold text-slate-800"> desk audit lines ({sortedExpenses.length} entries matches)</span>
          <span className="text-[10px] text-slate-400 font-bold uppercase font-mono bg-slate-200 px-2.5 py-1 rounded-md">Ledger state sync: LIVE</span>
        </div>

        {loading ? (
          <div className="p-20 text-center flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#4f46e5]"></div>
            <span className="text-xs font-semibold text-slate-500 mt-4">Querying database transaction logs...</span>
          </div>
        ) : sortedExpenses.length === 0 ? (
          <div className="p-8 sm:p-16 text-center text-slate-500 space-y-6">
            <div className="max-w-md mx-auto">
              <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h4 className="font-bold text-slate-800 text-sm">No claims positioned here.</h4>
              <p className="text-xs text-slate-500 mt-1">There are currently no ledger claims queued for your filters or queries actions.</p>
            </div>

            <div className="max-w-2xl mx-auto bg-amber-50/70 border border-amber-200/80 rounded-2xl p-6 text-left shadow-xs">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                    First-time Setup: Why is this ledger empty?
                  </h4>
                  <p className="text-xs text-amber-800 mt-1.5 leading-relaxed">
                    If you have submitted claims from employee account(s) but they do not show up under <strong>accounts@comp.com</strong>, this is due to a recursive Row-Level Security (RLS) loop on the <code>user_profiles</code> table inside your Supabase project. 
                  </p>
                  <p className="text-xs text-slate-700 mt-2 font-medium">
                    To solve this, copy and run the following script in your <strong>Supabase Dashboard &gt; SQL Editor</strong> to fix and unlock the ledger instantly:
                  </p>

                  <pre className="bg-slate-900 text-slate-100 text-[10.5px] font-mono p-4 rounded-xl overflow-x-auto select-all max-h-48 leading-relaxed mt-3 block border border-slate-800">
{`-- 1. Correct recursive RLS loop on user_profiles
DROP POLICY IF EXISTS "Admins and Accounts can select profiles" ON public.user_profiles;
CREATE POLICY "Admins and Accounts can select profiles" 
ON public.user_profiles FOR SELECT TO authenticated
USING (true);

-- 2. Notify PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';`}
                  </pre>
                  
                  <div className="mt-4 flex flex-col gap-1 text-[11px] text-amber-905 font-medium">
                    <p>💡 <strong>Note:</strong> Once you execute this, simply refresh this page. All employee claims waiting for approval will display right away!</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto text-xs">
            <table className="min-w-full text-left divide-y divide-slate-150 text-slate-700">
              <thead className="bg-slate-50/50 font-bold uppercase text-[10px] text-slate-550 tracking-wider">
                <tr>
                  <th className="px-6 py-4">Employee Details</th>
                  <th className="px-6 py-4">Claim Date</th>
                  <th className="px-6 py-4">Nature & Category</th>
                  <th className="px-6 py-4">Billing Proof</th>
                  <th className="px-6 py-4">Amount (INR)</th>
                  <th className="px-6 py-4">Status & Remarks</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150">
                {sortedExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/20 transition-all font-sans">
                    
                    {/* Employee Profile info */}
                    <td className="px-6 py-4">
                      <div className="flex gap-2 items-center">
                        <div className="w-8 h-8 rounded-full bg-slate-950 text-white font-bold flex items-center justify-center select-none text-xs">
                          {exp.user_profiles?.name ? exp.user_profiles.name.charAt(0).toUpperCase() : <User className="w-3.5 h-3.5" />}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">{exp.user_profiles?.name || "Corporate Employee"}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{exp.user_profiles?.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Claim Date */}
                    <td className="px-6 py-4 font-bold text-slate-800 font-mono">
                      {exp.expense_date}
                    </td>

                    {/* Nature and type */}
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="font-bold font-sans text-slate-800">{exp.expense_type}</span>
                        {exp.custom_type && <span className="text-[9px] text-slate-400 italic font-medium mt-[-2px]">({exp.custom_type})</span>}
                        
                        {/* Tags representation */}
                        <div className="flex flex-wrap gap-1 mt-1">
                          {exp.expense_nature && (
                            <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded text-[8.5px] font-bold">
                              {exp.expense_nature}
                            </span>
                          )}
                          {exp.gst_type && (
                            <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[8.5px] font-bold">
                              {exp.gst_type}
                            </span>
                          )}
                          {exp.payment_term && (
                            <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded text-[8.5px] font-bold">
                              {exp.payment_term === "Custom" ? `Pay custom: ${exp.custom_payment_term}` : `Pay term: ${exp.payment_term}`}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Proof retrieval */}
                    <td className="px-6 py-4">
                      {exp.proof_url ? (
                        <a
                          href={exp.proof_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-[10px] font-black text-[#4f46e5] hover:underline gap-1 select-none"
                        >
                          View Bill Proof
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      ) : (
                        <span className="text-slate-401 select-none text-[10px] font-semibold">No Attachments</span>
                      )}
                    </td>

                    {/* Val amount */}
                    <td className="px-6 py-4 font-extrabold text-slate-900 font-mono text-sm">
                      ₹{parseFloat(exp.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>

                    {/* Workflow badge cell */}
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 items-start">
                        {(!exp.workflow_status || exp.workflow_status === "Pending Accounts Approval") && (
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[8px] uppercase font-bold bg-amber-50 text-amber-805 border border-amber-100">
                            Pending Accounts Verification
                          </span>
                        )}
                        {exp.workflow_status === "Approved by Accounts" && (
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[8px] uppercase font-bold bg-indigo-50 text-indigo-800 border border-indigo-150">
                            Approved by Accounts (Queued for admin)
                          </span>
                        )}
                        {exp.workflow_status === "Rejected by Accounts" && (
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[8px] uppercase font-bold bg-red-100 text-red-800 border border-red-200">
                            Rejected by Accounts
                          </span>
                        )}
                        {exp.workflow_status === "Approved by Admin" && (
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[8px] uppercase font-bold bg-emerald-50 text-emerald-808 border border-emerald-100">
                            Admin Approved
                          </span>
                        )}
                        {exp.workflow_status === "Rejected by Admin" && (
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[8px] uppercase font-bold bg-rose-50 text-rose-805 border border-rose-100">
                            Admin Rejected
                          </span>
                        )}

                        {exp.accounts_remarks && (
                          <p className="text-[9px] text-slate-500 font-medium leading-none mt-1">
                            <span className="font-bold text-slate-700">Accounts Remarks:</span> "{exp.accounts_remarks}"
                          </p>
                        )}
                        {exp.admin_remarks && (
                          <p className="text-[9px] text-slate-505 font-medium leading-none">
                            <span className="font-bold text-slate-700">Admin Remarks:</span> "{exp.admin_remarks}"
                          </p>
                        )}
                      </div>
                    </td>

                    {/* Controls alignment */}
                    <td className="px-6 py-4 text-right">
                      {exp.workflow_status === "Pending Accounts Approval" ? (
                        <button
                          onClick={() => setReviewItem(exp)}
                          className="inline-flex items-center gap-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-950 text-white font-bold px-3 py-1.5 rounded-lg hover:shadow-xs transition select-none text-[10px]"
                        >
                          Verify Claim
                          <Send className="w-3 h-3" />
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-bold select-none italic">Audit Closed</span>
                      )}
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Review overlay modal popup */}
      {reviewItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden border border-slate-205 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            
            <div className="bg-slate-950 p-6 text-white">
              <h3 className="text-lg font-bold tracking-tight">Audit and Verify Claim Segment</h3>
              <p className="text-xs text-slate-350 mt-1">
                Submitted by {reviewItem.user_profiles?.name || "Employee"} on {reviewItem.expense_date}
              </p>
            </div>

            <div className="p-6 space-y-4">
              
              {/* Context Summary card */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Expense Category:</span>
                  <span className="font-bold text-slate-800">{reviewItem.expense_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Valuation Amount:</span>
                  <span className="font-extrabold text-slate-900">₹{parseFloat(reviewItem.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">GST Classification:</span>
                  <span className="font-semibold text-slate-700">{reviewItem.gst_type || "Non-GST"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Payment Terms:</span>
                  <span className="font-semibold text-slate-700">
                    {reviewItem.payment_term === "Custom" ? `Custom: ${reviewItem.custom_payment_term}` : reviewItem.payment_term}
                  </span>
                </div>
                {reviewItem.notes && (
                  <div className="pt-2 border-t border-slate-200 text-slate-600 mt-1 font-sans">
                    <span className="font-bold block text-slate-750">Employee Notes:</span>
                    <p className="mt-0.5">{reviewItem.notes}</p>
                  </div>
                )}
              </div>

              {/* Remarks Text input area */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Auditor Remarks / Audit Notes
                </label>
                <textarea
                  rows={3}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Insert remarks detailing approve/reject explanations (e.g., receipt verified, amount matches bill, or missing receipt error detail)..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-950 font-sans"
                />
              </div>

            </div>

            {/* Modal actions */}
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex flex-wrap gap-3 justify-end items-center">
              <button
                type="button"
                onClick={() => {
                  setReviewItem(null);
                  setRemarks("");
                }}
                disabled={submittingReview}
                className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-700"
              >
                Go Back
              </button>

              <button
                type="button"
                onClick={() => handleProcessClaim("rejected")}
                disabled={submittingReview}
                className="inline-flex items-center gap-1.5 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded-lg text-xs font-bold px-4 py-2 hover:shadow-xs transition"
              >
                <XCircle className="w-3.5 h-3.5" />
                Reject Claim
              </button>

              <button
                type="button"
                onClick={() => handleProcessClaim("approved")}
                disabled={submittingReview}
                className="inline-flex items-center gap-1.5 bg-slate-950 hover:bg-slate-900 text-white rounded-lg text-xs font-bold px-4 py-2 shadow-md transition"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Approve & Forward to Admin
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
