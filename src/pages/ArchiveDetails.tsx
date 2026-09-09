import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { 
  ArrowLeft, Calendar, FileText, DollarSign, Archive, BarChart, 
  ChevronRight, RefreshCw, AlertTriangle, User 
} from "lucide-react";

export const ArchiveDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  // Page States
  const [archive, setArchive] = useState<any>(null);
  const [employee, setEmployee] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchArchiveData = async () => {
    if (!id) return;
    setIsLoading(true);
    setErrorMsg(null);

    try {
      // 1. Fetch Archive Record
      const { data: arch, error: archError } = await supabase
        .from("expense_archives")
        .select("*")
        .eq("id", id)
        .single();

      if (archError) throw new Error("Archive record failed to query: " + archError.message);
      setArchive(arch);

      // 2. Fetch Employee Profile
      if (arch && arch.employee_id) {
        const { data: prof, error: profError } = await supabase
          .from("user_profiles")
          .select("*")
          .eq("user_id", arch.employee_id)
          .single();

        if (profError) {
          console.warn("Could not retrieve employee profile info direct:", profError.message);
        } else {
          setEmployee(prof);
        }
      }

      // 3. Fetch Expenses belonging to this Archive ID
      const { data: list, error: listError } = await supabase
        .from("expenses")
        .select("*")
        .eq("archive_id", id)
        .order("expense_date", { ascending: false });

      if (listError) throw new Error("Failed retrieving associated expense log rows : " + listError.message);
      setExpenses(list || []);

    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred retrieving archive information.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchArchiveData();
  }, [id]);

  // Category aggregate calculation:
  const categoriesMap: { [key: string]: number } = {};
  expenses.forEach((item) => {
    const cat = item.expense_type || "Other";
    const amt = parseFloat(item.amount || 0);
    categoriesMap[cat] = (categoriesMap[cat] || 0) + amt;
  });

  if (isLoading) {
    return (
      <div className="p-20 text-center">
        <svg className="animate-spin h-8 w-8 text-slate-950 mx-auto" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span className="text-xs text-slate-400 mt-2 block font-extrabold tracking-widest uppercase">Fetching Archive data...</span>
      </div>
    );
  }

  if (errorMsg || !archive) {
    return (
      <div className="max-w-xl mx-auto py-20 px-4 text-center">
        <div className="bg-red-50 text-red-800 p-8 rounded-2xl border border-red-150">
          <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h2 className="text-md font-bold">Failed to load archived ledger file</h2>
          <p className="text-xs text-red-700 mt-1">{errorMsg || "The selected archive record does not exist in the archives index database."}</p>
          <button onClick={() => window.history.back()} className="inline-block mt-4 bg-red-800 text-white text-xs font-bold px-4 py-2 rounded-lg">
            Back Previous
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      
      {/* Upper Navigation line */}
      <div className="mb-6 flex justify-between items-center">
        <button
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Employee Details
        </button>
        <span className="text-xs text-slate-400 font-bold select-none uppercase tracking-wider">
          Admin Portal <ChevronRight className="inline w-3 h-3" /> Archives Viewer
        </span>
      </div>

      {/* Main Core Detail Headers */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center">
            <Archive className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-black text-amber-800 bg-amber-50 px-2 py-0.5 rounded">Archived Run Snapshot</span>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
              {archive.archive_name}
            </h1>
            <p className="text-xs font-semibold text-slate-400 mt-1">
              Archived on {new Date(archive.created_at).toLocaleDateString()} for employee {employee?.name || "Marcus Vance"} ({employee?.email || "marcus@company.com"})
            </p>
          </div>
        </div>

        {/* Big Ledger snapshot amount */}
        <div className="bg-slate-50/50 p-4 border border-slate-150 rounded-xl text-right">
          <span className="text-[10px] text-slate-400 uppercase tracking-widest block font-bold">Total Archived Value</span>
          <span className="text-xl sm:text-2xl font-black font-mono text-slate-950 mt-1 block">
            ₹{parseFloat(archive.total_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Category Wise Splits Metrics */}
      <h2 className="text-xs font-black uppercase tracking-widest text-slate-700 mb-4 flex items-center gap-1.5">
        <BarChart className="w-4 h-4 text-slate-400" />
        Category Claim Splits
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {Object.keys(categoriesMap).length === 0 ? (
          <div className="col-span-full text-xs text-slate-400 bg-white p-4 border rounded text-center">No categories mapped.</div>
        ) : (
          Object.entries(categoriesMap).map(([category, sumVal]) => (
            <div key={category} className="bg-white border border-slate-200 shadow-2xs rounded-xl p-4">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">{category}</span>
              <span className="text-base font-black font-mono mt-1 block text-slate-900">
                ₹{sumVal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
              <span className="text-[9px] text-slate-400 block mt-1 font-semibold">
                {((sumVal / parseFloat(archive.total_amount || 1)) * 100).toFixed(0)}% contribution
              </span>
            </div>
          ))
        )}
      </div>

      {/* Main Archived Ledger Activity Log Grid */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-150">
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-700">
            Archived Itemized Expenses Ledger ({expenses.length} claims logs)
          </h2>
        </div>

        {expenses.length === 0 ? (
          <div className="p-16 text-center text-slate-400">
            <FileText className="w-10 h-10 text-slate-200 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-700">No active itemized receipts stored for this specific snapshot.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs divide-y divide-slate-150 text-slate-700">
              <thead className="bg-slate-50 font-bold uppercase text-[10px] text-slate-500 tracking-wider">
                <tr>
                  <th className="px-6 py-4">Expense Date</th>
                  <th className="px-6 py-4">Expense Type</th>
                  <th className="px-6 py-4">Custom Category</th>
                  <th className="px-6 py-4">Amount (INR)</th>
                  <th className="px-6 py-4">Proof receipt</th>
                  <th className="px-6 py-4">Created Date</th>
                  <th className="px-6 py-4">Context Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150">
                {expenses.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    
                    {/* Expense Date */}
                    <td className="px-6 py-4 font-mono font-bold text-slate-800">
                      {item.expense_date}
                    </td>

                    {/* Expense Category type */}
                    <td className="px-6 py-4">
                      <span className="px-2 py-0.5 rounded font-bold uppercase text-[9px] bg-slate-100 text-slate-700">
                        {item.expense_type}
                      </span>
                    </td>

                    {/* Custom description */}
                    <td className="px-6 py-4 font-semibold text-slate-500 italic">
                      {item.custom_type || "N/A"}
                    </td>

                    {/* Amount */}
                    <td className="px-6 py-4 font-extrabold text-slate-950 font-mono">
                      ₹{parseFloat(item.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>

                    {/* proof url attachment file */}
                    <td className="px-6 py-4">
                      {item.proof_url ? (
                        <a
                          href={item.proof_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-[10px] font-bold text-indigo-700 hover:underline"
                        >
                          View receipt proof
                        </a>
                      ) : (
                        <span className="text-slate-400 font-medium">None</span>
                      )}
                    </td>

                    {/* Created Date */}
                    <td className="px-6 py-4 font-mono text-slate-400">
                      {new Date(item.created_at).toLocaleDateString()}
                    </td>

                    {/* Context Notes */}
                    <td className="px-6 py-4 max-w-sm font-medium text-slate-500 truncate" title={item.notes || ""}>
                      {item.notes || "—"}
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};
