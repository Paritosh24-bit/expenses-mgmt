import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { 
  ArrowLeft, Search, Filter, Calendar, FileText, ExternalLink, 
  ChevronLeft, ChevronRight, Eye, RefreshCw, Layers 
} from "lucide-react";
import { motion } from "motion/react";

const EXPENSE_TYPES = [
  "All Categories",
  "Food",
  "Petrol",
  "Travel",
  "Accommodation",
  "Office Supplies",
  "Medical",
  "Internet",
  "Subscription",
  "Society Maintenance",
  "Electricity",
  "Vendor",
  "Other"
];

const MONTHS = [
  { value: "all", label: "All Months" },
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" }
];

export const History: React.FC = () => {
  const { user } = useAuth();
  
  // Data State
  const [expenses, setExpenses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters State
  const [searchPhrase, setSearchPhrase] = useState("");
  const [selectedType, setSelectedType] = useState("All Categories");
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Load records
  const fetchMyHistory = async () => {
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
      setErrorMsg("Failed to query histories: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMyHistory();
  }, [user]);

  // Handle local Client-Side Filtration
  const filteredRecords = expenses.filter((record) => {
    // 1. Text Search query (matches notes, custom category, or main category)
    if (searchPhrase.trim()) {
      const q = searchPhrase.toLowerCase();
      const matchType = (record.expense_type || "").toLowerCase().includes(q);
      const matchCustom = (record.custom_type || "").toLowerCase().includes(q);
      const matchNotes = (record.notes || "").toLowerCase().includes(q);
      if (!matchType && !matchCustom && !matchNotes) return false;
    }

    // 2. Main Category Type Dropdown Filter
    if (selectedType !== "All Categories") {
      if (record.expense_type !== selectedType) return false;
    }

    // 3. Month Filter parsing (YYYY-MM-DD)
    if (selectedMonth !== "all") {
      const recordMonth = record.expense_date ? record.expense_date.split("-")[1] : "";
      if (recordMonth !== selectedMonth) return false;
    }

    // 4. Custom Date Range Filters
    if (startDate) {
      if (record.expense_date < startDate) return false;
    }
    if (endDate) {
      if (record.expense_date > endDate) return false;
    }

    return true;
  });

  // Calculate pagination windows
  const totalItems = filteredRecords.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedRecords = filteredRecords.slice(startIndex, startIndex + itemsPerPage);

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  // Reset page when queries change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchPhrase, selectedType, selectedMonth, startDate, endDate]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      
      {/* Upper Navigation Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link
            to="/employee-dashboard"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <h1 className="text-2xl font-sans font-extrabold text-slate-900 mt-2 tracking-tight">
            Historical Claims Register
          </h1>
          <p className="text-sm text-slate-400 font-medium">Verify or filter the status of all your submitted reimbursement requests.</p>
        </div>

        <button
          onClick={fetchMyHistory}
          disabled={isLoading}
          className="inline-flex max-w-fit items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 px-3 py-2 rounded-lg"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading && "animate-spin"}`} />
          Sync Records
        </button>
      </div>

      {/* Database Error view */}
      {errorMsg && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 text-red-700 text-sm font-semibold border border-red-100 flex items-center gap-3">
          <span>⚠️ {errorMsg}</span>
          <button onClick={fetchMyHistory} className="ml-auto underline">Retry</button>
        </div>
      )}

      {/* Advanced Filtration Bento Box */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs mb-8 space-y-4">
        
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-widest pb-3 border-b border-slate-150">
          <Filter className="w-4 h-4 text-slate-500" />
          Filter directory settings
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          
          {/* Filter Option 1: SearchPhrase */}
          <div className="md:col-span-2">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Search Notes / Categories</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="type letters..."
                value={searchPhrase}
                onChange={(e) => setSearchPhrase(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50/50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-slate-950"
              />
            </div>
          </div>

          {/* Filter Option 2: Category Type */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Main Category</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full text-xs py-2 px-2 border border-slate-200 rounded-lg bg-slate-50/50 focus:bg-white"
            >
              {EXPENSE_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          {/* Filter Option 3: Month selector */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Month of Year</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full text-xs py-2 px-2 border border-slate-200 rounded-lg bg-slate-50/50 focus:bg-white"
            >
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* Filter Option 4: Custom Date range Start & End */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Date Span</label>
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-[10px] py-1 px-1.5 border border-slate-200 rounded bg-slate-50/50"
                title="Start search limit"
              />
              <span className="text-slate-400 text-xs font-semibold">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full text-[10px] py-1 px-1.5 border border-slate-200 rounded bg-slate-50/50"
                title="End search limit"
              />
            </div>
          </div>

        </div>

        {/* Clear filters utility banner */}
        {(searchPhrase || selectedType !== "All Categories" || selectedMonth !== "all" || startDate || endDate) && (
          <div className="pt-2 text-right">
            <button
              onClick={() => {
                setSearchPhrase("");
                setSelectedType("All Categories");
                setSelectedMonth("all");
                setStartDate("");
                setEndDate("");
              }}
              className="text-[10px] font-bold text-slate-500 hover:text-slate-900 border-b border-slate-300"
            >
              Clear Active Filters
            </button>
          </div>
        )}
      </div>

      {/* Claims Display Registry Grid */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-16 text-center">
            <svg className="animate-spin h-8 w-8 text-slate-950 mx-auto" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-xs text-slate-400 uppercase tracking-widest font-bold mt-2.5 block">Loading claim history profiles...</span>
          </div>
        ) : paginatedRecords.length === 0 ? (
          <div className="p-16 text-center text-slate-400">
            <Layers className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h4 className="font-bold text-slate-800 text-sm">No expenses located.</h4>
            <p className="text-xs text-slate-400 mt-1">If there are active criteria filters configured, clear them, or select a new expense Claim Form.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left divide-y divide-slate-150 text-xs text-slate-700">
              <thead className="bg-slate-50 font-bold uppercase text-[10px] text-slate-500 tracking-wider">
                <tr>
                  <th className="px-6 py-4">Claim Date</th>
                  <th className="px-6 py-4">Expense Type</th>
                  <th className="px-6 py-4">Custom Label</th>
                  <th className="px-6 py-4">Amount (INR)</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Attached Proof</th>
                  <th className="px-6 py-4">Created Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150">
                {paginatedRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50/50 transition-colors">
                    
                    {/* Expense Date */}
                    <td className="px-6 py-4 font-bold text-slate-800 font-mono">
                      {record.expense_date}
                    </td>

                    {/* Expense Category type */}
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md font-semibold bg-slate-100 text-slate-700">
                        {record.expense_type}
                      </span>
                      {record.custom_type && <span className="text-[10px] text-slate-400 block italic">({record.custom_type})</span>}
                      
                      {/* Metadata label list */}
                      <div className="flex flex-wrap gap-1 mt-1">
                        {record.expense_nature && (
                          <span className="bg-slate-100 text-slate-600 px-1 py-0.5 text-[8.5px] rounded font-medium">
                            {record.expense_nature}
                          </span>
                        )}
                        {record.gst_type && (
                          <span className="bg-slate-105 text-slate-600 px-1 py-0.5 text-[8.5px] rounded font-medium">
                            {record.gst_type}
                          </span>
                        )}
                        {record.payment_term && (
                          <span className="bg-indigo-50 text-indigo-700 px-1 py-0.5 text-[8.5px] rounded font-medium">
                            {record.payment_term === "Custom" ? `Pay Term: ${record.custom_payment_term}` : `Pay Term: ${record.payment_term}`}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Custom label specification */}
                    <td className="px-6 py-4 font-semibold text-slate-500 italic">
                      {record.custom_type || "N/A"}
                    </td>

                    {/* Amount value */}
                    <td className="px-6 py-4 font-extrabold text-slate-950 font-mono">
                      ₹{parseFloat(record.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    {/* Status calculation */}
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 items-start">
                        {(!record.workflow_status || record.workflow_status === "Pending Accounts Approval") && (
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[8.5px] uppercase font-bold bg-amber-50 text-amber-800 border border-amber-100">
                            Pending Accounts
                          </span>
                        )}
                        {record.workflow_status === "Approved by Accounts" && (
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[8.5px] uppercase font-bold bg-indigo-50 text-indigo-800 border border-indigo-100">
                            Approved by Accounts
                          </span>
                        )}
                        {record.workflow_status === "Rejected by Accounts" && (
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[8.5px] uppercase font-bold bg-red-100 text-red-800 border border-red-200">
                            Rejected by Accounts
                          </span>
                        )}
                        {record.workflow_status === "Approved by Admin" && (
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[8.5px] uppercase font-bold bg-emerald-50 text-emerald-800 border border-emerald-100">
                            Approved by Admin
                          </span>
                        )}
                        {record.workflow_status === "Rejected by Admin" && (
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[8.5px] uppercase font-bold bg-rose-50 text-rose-805 border border-rose-100">
                            Rejected by Admin
                          </span>
                        )}

                        {/* Remarks details */}
                        {record.accounts_remarks && (
                          <div className="text-[9px] text-slate-505 font-medium leading-tight mt-0.5">
                            <span className="font-bold text-slate-700">Accounts:</span> {record.accounts_remarks}
                          </div>
                        )}
                        {record.admin_remarks && (
                          <div className="text-[9px] text-slate-505 font-medium leading-tight">
                            <span className="font-bold text-slate-700">Admin:</span> {record.admin_remarks}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Attachment receipt retrieval */}
                    <td className="px-6 py-4">
                      {record.proof_url ? (
                        <a
                          href={record.proof_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-bold text-slate-900 border border-slate-200 hover:border-slate-900 bg-white hover:bg-slate-50 px-2 py-1 rounded transition"
                          title="View proof receipt file"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          View Proof
                          <ExternalLink className="w-3 h-3 text-slate-400" />
                        </a>
                      ) : (
                        <span className="text-slate-400 font-medium">None Attached</span>
                      )}
                    </td>

                    {/* Database confirmation timestamp */}
                    <td className="px-6 py-4 font-mono text-slate-400">
                      {new Date(record.created_at).toLocaleDateString()}
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination Line controls */}
            <div className="p-5 border-t border-slate-150 flex items-center justify-between text-xs bg-slate-50/50">
              <span className="font-semibold text-slate-500">
                Displaying <strong>{startIndex + 1}-{Math.min(startIndex + itemsPerPage, totalItems)}</strong> of <strong>{totalItems}</strong> entries
              </span>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrevPage}
                  disabled={currentPage === 1}
                  className="p-1.5 border border-slate-250 bg-white hover:bg-slate-50 rounded-lg text-slate-600 disabled:opacity-30"
                  title="Previous register list"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-bold text-slate-800">
                  Page {currentPage} / {totalPages}
                </span>
                <button
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages}
                  className="p-1.5 border border-slate-250 bg-white hover:bg-slate-50 rounded-lg text-slate-600 disabled:opacity-30"
                  title="Next register list"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

          </div>
        )}
      </div>

    </div>
  );
};
