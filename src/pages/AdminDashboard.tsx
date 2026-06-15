import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { UserProfile } from "../types";
import { 
  UserPlus, Search, ShieldAlert, Check, X, Trash2, KeyRound, 
  BarChart3, RefreshCw, AlertCircle, Plus, Eye, UserX, AlertTriangle, 
  Users, DollarSign, Download, Archive, ArrowRight, Table, Layers, Grid, Calendar, Clock 
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, LineChart, Line, CartesianGrid 
} from "recharts";
import * as XLSX from "xlsx";

const CATEGORY_COLORS = [
  "#4f46e5", // Indigo
  "#10b981", // Emerald Green
  "#0ea5e9", // Sky Blue
  "#f59e0b", // Amber Yellow
  "#8b5cf6", // Violet
  "#14b8a6", // Teal
  "#f43f5e", // Rose
  "#ec4899", // Pink
  "#f97316", // Orange
  "#64748b"  // Slate
];

export const AdminDashboard: React.FC = () => {
  const { sessionToken, profile } = useAuth();
  
  // Data States
  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [allExpenses, setAllExpenses] = useState<any[]>([]);
  const [archives, setArchives] = useState<any[]>([]);
  const [trackTab, setTrackTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [trackSearch, setTrackSearch] = useState("");
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Search and Filtraion states
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("All Categories");
  const [filterMonth, setFilterMonth] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all"); // all, active, archived

  // Create Form States
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("employee"); // employee, accounts, admin
  const [roleFilterTab, setRoleFilterTab] = useState("all"); // all, employee, accounts, admin

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Active / Archive reset modal state
  const [resetConfirmEmployee, setResetConfirmEmployee] = useState<any | null>(null);
  const [resetName, setResetName] = useState("");

  // Reset All modal states
  const [showResetAllModal, setShowResetAllModal] = useState(false);
  const [resetAllName, setResetAllName] = useState("");
  const [resetAllPending, setResetAllPending] = useState(false);

  // Confirmation states
  const [deleteConfirmEmployee, setDeleteConfirmEmployee] = useState<UserProfile | null>(null);
  const [reseedConfirm, setReseedConfirm] = useState(false);

  // Fetch all tables
  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch user profiles
      const { data: profs, error: profsErr } = await supabase
        .from("user_profiles")
        .select("*")
        .order("name", { ascending: true });

      if (profsErr) throw new Error(profsErr.message);
      setEmployees(profs || []);

      // 2. Fetch ALL expenses for general tracking & specific approved ones
      const { data: allExps, error: expsErr } = await supabase
        .from("expenses")
        .select("*")
        .order("created_at", { ascending: false });

      if (expsErr) throw new Error(expsErr.message);
      setAllExpenses(allExps || []);
      setExpenses((allExps || []).filter(e => e.accounts_status === "approved"));

      // 3. Fetch archives
      const { data: archs, error: archsErr } = await supabase
        .from("expense_archives")
        .select("*")
        .order("created_at", { ascending: false });

      if (archsErr) throw new Error(archsErr.message);
      setArchives(archs || []);

    } catch (err: any) {
      setError("Failed to synchronize system records: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Helper request header generator
  const getHeaders = () => ({
    "Content-Type": "application/json",
    "Authorization": `Bearer ${sessionToken}`
  });

  // Action Success Banner helper
  const triggerSuccessMsg = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 5000);
  };

  // Create Employee Integration via API Server proxy
  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setActionLoading(true);

    if (!newName || !newEmail || !newPassword) {
      setError("Please fill out all add employee form questions.");
      setActionLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      setActionLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/admin/create-employee", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          name: newName,
          email: newEmail,
          password: newPassword,
          role: newRole,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create user account.");
      }

      setIsAddOpen(false);
      setNewName("");
      setNewEmail("");
      setNewPassword("");
      setNewRole("employee");
      triggerSuccessMsg(`Account for "${data.profile.name}" with role "${data.profile.role}" has been created successfully.`);
      await loadDashboardData();
    } catch (err: any) {
      setError(err.message || "An error occurred creating account.");
    } finally {
      setActionLoading(false);
    }
  };

  // Trigger Reset Operation
  const triggerResetFlow = (emp: any) => {
    setResetConfirmEmployee(emp);
    const now = new Date();
    setResetName(`${now.toLocaleString("default", { month: "long" })} ${now.getFullYear()}`);
  };

  const handleConfirmReset = async () => {
    if (!resetConfirmEmployee) return;
    setActionLoading(true);
    setError(null);

    try {
      const empId = resetConfirmEmployee.user_id;
      const employeeExpenses = expenses.filter(e => e.employee_id === empId && !e.is_archived);
      
      if (employeeExpenses.length === 0) {
        throw new Error("This employee has no active unarchived expenses to reset and archive.");
      }

      const activeSumVal = employeeExpenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
      const now = new Date();
      const currentMonthVal = now.getMonth() + 1;
      const currentYearVal = now.getFullYear();

      // Step 2: Create archive database record
      const archivePayload = {
        employee_id: empId,
        archive_month: currentMonthVal,
        archive_year: currentYearVal,
        archive_name: resetName.trim() || `${now.toLocaleString("default", { month: "long" })} ${currentYearVal}`,
        total_amount: activeSumVal,
        created_by: (await supabase.auth.getUser()).data.user?.id || null
      };

      const { data: newArch, error: archError } = await supabase
        .from("expense_archives")
        .insert(archivePayload)
        .select()
        .single();

      if (archError) throw new Error("Could not initialize archive: " + archError.message);

      // Step 3: Update and secure active items
      const activeIds = employeeExpenses.map(e => e.id);
      const { error: updateError } = await supabase
        .from("expenses")
        .update({ is_archived: true, archive_id: newArch.id })
        .in("id", activeIds);

      if (updateError) {
        await supabase.from("expense_archives").delete().eq("id", newArch.id);
        throw new Error("Could not update expenses: " + updateError.message);
      }

      setResetConfirmEmployee(null);
      triggerSuccessMsg(`Archived run '${archivePayload.archive_name}' saved. Total reset accomplished!`);
      await loadDashboardData();

    } catch (err: any) {
      alert(err.message || "Failed to reset.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkResetAll = async () => {
    if (!sessionToken) return;
    setResetAllPending(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch("/api/admin/archive-reset-all", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          archiveName: resetAllName
        })
      });

      const responseData = await res.json();
      if (!res.ok) {
        throw new Error(responseData.error || `HTTP error ${res.status}`);
      }

      triggerSuccessMsg(`Bulk Reset Completed: '${responseData.archiveName}' created! All employee totals are archived and set to zero value.`);
      setShowResetAllModal(false);
      setResetAllName("");
      await loadDashboardData();
    } catch (err: any) {
      setError("Bulk reset operation failed: " + err.message);
    } finally {
      setResetAllPending(false);
    }
  };

  // Excel Excel report exporter using xlsx
  const handleExportAll = async () => {
    try {
      // Fetch ALL corporate expense claims from the system for the report
      const { data: allClaims, error: allExpsErr } = await supabase
        .from("expenses")
        .select("*")
        .order("created_at", { ascending: false });

      if (allExpsErr) throw new Error(allExpsErr.message);

      if (!allClaims || allClaims.length === 0) {
        alert("No corporate expense records found in the database to export.");
        return;
      }

      const rows = allClaims.map((item) => {
        const emp = employees.find(e => e.user_id === item.employee_id);
        const arch = archives.find(a => a.id === item.archive_id);
        const accountsApprover = employees.find(e => e.user_id === item.accounts_approved_by);
        const adminApprover = employees.find(e => e.user_id === item.admin_approved_by);

        return {
          "Employee Name": emp?.name || "Employee",
          "Employee Email": emp?.email || "",
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
          "Accounts Auditor Name": accountsApprover?.name || item.accounts_approved_by || "",
          "Accounts Approved At": item.accounts_approved_at ? new Date(item.accounts_approved_at).toLocaleString() : "",
          "Accounts Remarks": item.accounts_remarks || "",
          "Admin Status": item.admin_status || "pending",
          "Admin Auditor Name": adminApprover?.name || item.admin_approved_by || "",
          "Admin Approved At": item.admin_approved_at ? new Date(item.admin_approved_at).toLocaleString() : "",
          "Admin Remarks": item.admin_remarks || "",
          "Notes": item.notes || "",
          "Proof URL Link": item.proof_url || "",
          "Archive Cycle Month": arch ? arch.archive_name : "",
          "Created At": new Date(item.created_at).toLocaleString()
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "All Employees Expenses");
      const today = new Date().toISOString().split("T")[0];
      XLSX.writeFile(workbook, `all-employees-expenses-report-${today}.xlsx`);
    } catch (err: any) {
      alert("Failed to export consolidated report: " + err.message);
    }
  };

  // Excel Staff list summary statistics report exporter
  const handleExportStaff = () => {
    if (employees.length === 0) {
      alert("No staff members located to export.");
      return;
    }

    const rows = employees.map((emp) => {
      // Inline stats calculation to avoid any function lookup hoisting lag
      const empExps = expenses.filter(e => e.employee_id === emp.user_id);
      
      const activeTotal = Math.round(
        empExps.filter(e => !e.is_archived).reduce((s, e) => s + parseFloat(e.amount || 0), 0) * 100
      ) / 100;

      const monthTotal = Math.round(
        empExps
          .filter(e => {
            if (!e.expense_date) return false;
            const today = new Date();
            const year = today.getFullYear();
            const monthStr = String(today.getMonth() + 1).padStart(2, "0");
            return e.expense_date.startsWith(`${year}-${monthStr}`);
          })
          .reduce((s, e) => s + parseFloat(e.amount || 0), 0) * 100
      ) / 100;

      const lifetime = Math.round(
        empExps.reduce((s, e) => s + parseFloat(e.amount || 0), 0) * 100
      ) / 100;
      
      const dates = empExps.map(e => e.expense_date).filter(Boolean);
      const lastDate = dates.length > 0 ? dates.sort().reverse()[0] : "—";

      return {
        "Employee Name": emp.name,
        "Employee Email": emp.email,
        "Is Active Status": emp.is_active ? "Active" : "Deactivated",
        "Current Month Spend (INR)": monthTotal,
        "Lifetime Total Spend (INR)": lifetime,
        "Active Balance (INR)": activeTotal,
        "Last Claim Date filed": lastDate,
        "Registry Creation Date": emp.created_at ? new Date(emp.created_at).toLocaleDateString() : ""
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Staff Registry Stats");
    const today = new Date().toISOString().split("T")[0];
    XLSX.writeFile(workbook, `staff-expense-registry-${today}.xlsx`);
  };

  const [isReseedPending, setIsReseedPending] = useState(false);
  
  const handleReseedRegistry = async () => {
    setIsReseedPending(true);
    setSuccessMsg(null);
    setError(null);
    setReseedConfirm(false);

    try {
      const res = await fetch("/api/admin/reseed-employees", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionToken}`
        }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to reseed database.");
      }

      setSuccessMsg(data.message);
      await loadDashboardData();
    } catch (err: any) {
      setError(err.message || "An error occurred during reseeding.");
    } finally {
      setIsReseedPending(false);
    }
  };

  const handleDeleteEmployee = async (emp: UserProfile) => {
    setActionLoading(true);
    setSuccessMsg(null);
    setError(null);
    setDeleteConfirmEmployee(null);

    try {
      const res = await fetch(`/api/admin/delete-employee/${emp.user_id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionToken}`
        }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete employee account.");
      }

      setSuccessMsg(`Permanently deleted employee: ${emp.name}`);
      await loadDashboardData();
    } catch (err: any) {
      setError(err.message || "An error occurred during deletion.");
    } finally {
      setActionLoading(false);
    }
  };

  // Analytics Math Calculations
  const totalEmployeesCount = employees.filter(e => e.role === "employee").length;
  const activeExpenseAmount = Math.round(
    expenses.filter(e => !e.is_archived).reduce((s, e) => s + parseFloat(e.amount || 0), 0) * 100
  ) / 100;
  const archivedExpenseAmount = Math.round(
    expenses.filter(e => e.is_archived).reduce((s, e) => s + parseFloat(e.amount || 0), 0) * 100
  ) / 100;
  const totalExpenseRecordsCount = expenses.length;

  const currentMonthExpAmt = Math.round(
    expenses
      .filter(e => {
        if (!e.expense_date) return false;
        const today = new Date();
        const year = today.getFullYear();
        const monthStr = String(today.getMonth() + 1).padStart(2, "0");
        return e.expense_date.startsWith(`${year}-${monthStr}`);
      })
      .reduce((s, e) => s + parseFloat(e.amount || 0), 0) * 100
  ) / 100;

  const numArchivesCreated = archives.length;

  // New exact simplified indicators requested by user
  const lifetimeTotalAcrossAll = Math.round(
    expenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0) * 100
  ) / 100;
  const absoluteLatestClaimDate = expenses.length > 0 ? expenses[0].expense_date : "—";

  // Pie Chart: Category breakdown
  const categoryMap: { [key: string]: number } = {};
  expenses.forEach((e) => {
    const t = e.expense_type || "Other";
    categoryMap[t] = (categoryMap[t] || 0) + parseFloat(e.amount || 0);
  });

  const categoryBreakdownData = Object.entries(categoryMap).map(([name, value], idx) => ({
    name,
    value,
    color: CATEGORY_COLORS[idx % CATEGORY_COLORS.length]
  }));

  // Line Chart: Monthly Spend trends in 2026
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthlySpendMap: { [key: string]: number } = {};
  expenses.forEach((e) => {
    if (!e.expense_date) return;
    const parts = e.expense_date.split("-"); // YYYY-MM-DD => [YYYY, MM, DD]
    if (parts.length >= 2) {
      const idx = parseInt(parts[1]) - 1;
      const key = monthNames[idx] || "Claims";
      monthlySpendMap[key] = (monthlySpendMap[key] || 0) + parseFloat(e.amount || 0);
    }
  });

  const monthlySpendData = monthNames.map((month) => ({
    month,
    "Spent Total": monthlySpendMap[month] || 0
  }));

  // Bar Chart: Active vs Archived Expenses
  const activeVsArchivedData = [
    { name: "Claims Distribution", "Active Claims": activeExpenseAmount, "Archived Claims": archivedExpenseAmount }
  ];

  // Employee/User Table Filtration with role tabs support
  const filteredEmployeesList = employees
    .filter(emp => {
      if (roleFilterTab === "all") {
        return emp.role !== "admin";
      }
      if (roleFilterTab !== "all" && emp.role !== roleFilterTab) {
        return false;
      }
      return true;
    })
    .filter(emp => {
      // Search Box filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = (emp.name || "").toLowerCase().includes(q);
        const matchEmail = (emp.email || "").toLowerCase().includes(q);
        const matchRole = (emp.role || "").toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchRole) return false;
      }
      return true;
    });

  // Precise sorting according to requirement:
  // 1. Employees with most recent claims at the top in descending order of claim creations.
  // 2. Employees with no claims or past claims placed after the ones with new claims.
  const getEmployeeClaimSortingStatus = (empId: string) => {
    const empExps = expenses.filter(e => e.employee_id === empId);
    
    // Check for "new claims" (defined as active, unarchived claims)
    const activeExps = empExps.filter(e => !e.is_archived);
    if (activeExps.length > 0) {
      const times = activeExps.map(e => e.created_at ? new Date(e.created_at).getTime() : 0);
      return {
        group: 1, // Active / new claims
        time: Math.max(...times, 0)
      };
    }
    
    // Check for "past claims" (defined as archived claims)
    const archivedExps = empExps.filter(e => e.is_archived);
    if (archivedExps.length > 0) {
      const times = archivedExps.map(e => e.created_at ? new Date(e.created_at).getTime() : 0);
      return {
        group: 2, // Past claims
        time: Math.max(...times, 0)
      };
    }
    
    // No claims at all
    return {
      group: 3, // No claims
      time: 0
    };
  };

  const sortedAndFilteredEmployeesList = [...filteredEmployeesList].sort((a, b) => {
    const statA = getEmployeeClaimSortingStatus(a.user_id);
    const statB = getEmployeeClaimSortingStatus(b.user_id);
    
    // Group 1 (New claims) first, then Group 2 (Past claims), then Group 3 (No claims)
    if (statA.group !== statB.group) {
      return statA.group - statB.group;
    }
    
    // Descending order of the claim time within group
    if (statA.time !== statB.time) {
      return statB.time - statA.time;
    }
    
    // Alphabetical fallback
    return (a.name || "").localeCompare(b.name || "");
  });

  // Calculate table records statistics per employee reactively
  const getEmployeeStats = (empUserId: string) => {
    const empExps = expenses.filter(e => e.employee_id === empUserId);
    const activeTotal = Math.round(
      empExps.filter(e => !e.is_archived).reduce((s, e) => s + parseFloat(e.amount || 0), 0) * 100
    ) / 100;
    
    // Current month spend for this specific employee
    const monthTotal = Math.round(
      empExps
        .filter(e => {
          if (!e.expense_date) return false;
          const today = new Date();
          const year = today.getFullYear();
          const monthStr = String(today.getMonth() + 1).padStart(2, "0");
          return e.expense_date.startsWith(`${year}-${monthStr}`);
        })
        .reduce((s, e) => s + parseFloat(e.amount || 0), 0) * 105
    ) / 105;

    const lifetime = Math.round(
      empExps.reduce((s, e) => s + parseFloat(e.amount || 0), 0) * 100
    ) / 100;
    
    // Last claim date
    const dates = empExps.map(e => e.expense_date).filter(Boolean);
    const lastDate = dates.length > 0 ? dates.sort().reverse()[0] : "—";

    return { activeTotal, monthTotal, lifetime, lastDate };
  };

  // Pagination bounds computation
  const totalEmployeesMatched = sortedAndFilteredEmployeesList.length;
  const totalPages = Math.ceil(totalEmployeesMatched / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedEmployees = sortedAndFilteredEmployeesList.slice(startIndex, startIndex + itemsPerPage);

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };
  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  // Filter of claims for activity tracking
  const trackedClaims = allExpenses.filter((item) => {
    // 1. Tab selection
    let matchesTab = false;
    if (trackTab === "pending") {
      matchesTab = item.accounts_status === "pending";
    } else if (trackTab === "approved") {
      matchesTab = item.accounts_status === "approved";
    } else if (trackTab === "rejected") {
      matchesTab = item.accounts_status === "rejected";
    }

    if (!matchesTab) return false;

    // 2. Search filtering
    const profileObj = employees.find(emp => emp.user_id === item.employee_id);
    const nameStr = (profileObj?.name || "").toLowerCase();
    const emailStr = (profileObj?.email || "").toLowerCase();
    const notesStr = (item.notes || "").toLowerCase();
    const catStr = (item.expense_type || "").toLowerCase();
    const customCatStr = (item.custom_type || "").toLowerCase();
    const amountStr = (item.amount || "").toString();

    const q = trackSearch.trim().toLowerCase();
    if (!q) return true;

    return (
      nameStr.includes(q) ||
      emailStr.includes(q) ||
      notesStr.includes(q) ||
      catStr.includes(q) ||
      customCatStr.includes(q) ||
      amountStr.includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        
        {/* Alerts container banner */}
        <AnimatePresence>
          {successMsg && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 p-4 rounded-xl bg-slate-900 border border-slate-800 text-white flex items-center gap-3 shadow-lg"
            >
              <Check className="w-5 h-5 text-emerald-400 shrink-0" />
              <div className="text-sm font-medium">{successMsg}</div>
            </motion.div>
          )}

          {error && (
            <div className="space-y-4 mb-6">
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-center gap-3 shadow-sm"
              >
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                <div className="text-sm font-semibold">{error}</div>
                <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-700 font-bold text-xs">Dismiss</button>
              </motion.div>

              {(error.toLowerCase().includes("column") || error.toLowerCase().includes("cache") || error.toLowerCase().includes("relation") || error.toLowerCase().includes("constraint")) && (
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
        </AnimatePresence>

        {/* Console title line and overall actions */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-sans font-extrabold text-slate-900 tracking-tight">
              Expense Operations Control Center
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 font-semibold">
              Corporate audit dashboard monitoring spending trends, claims, employee directories, and monthly exports.
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                const now = new Date();
                setResetAllName(`Reset All - ${now.toLocaleString("default", { month: "long" })} ${now.getFullYear()}`);
                setShowResetAllModal(true);
              }}
              className="inline-flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg px-4 py-2.5 text-xs font-bold shadow-sm transition cursor-pointer"
              title="Archive active expenses across ALL employees and set all running totals to zero"
            >
              <Archive className="w-4 h-4" />
              Archive & Reset All
            </button>

            <button
              onClick={handleExportAll}
              className="inline-flex items-center gap-2 bg-emerald-650 hover:bg-emerald-755 text-white rounded-lg px-4 py-2.5 text-xs font-bold shadow-sm transition"
              title="Download claims.xlsx dataset"
            >
              <Download className="w-4 h-4" />
              Export Excel (.XLSX)
            </button>

            <button
              id="add-employee-button"
              onClick={() => setIsAddOpen(!isAddOpen)}
              className="inline-flex items-center gap-2 bg-slate-950 hover:bg-slate-900 text-white rounded-lg px-4 py-2.5 text-xs font-bold shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              Add Staff / Admin / Accounts
            </button>

            <button
              onClick={loadDashboardData}
              disabled={loading}
              className="p-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg shadow-2xs"
              title="Refresh database records"
            >
              <RefreshCw className={`w-4 h-4 ${loading && 'animate-spin'}`} />
            </button>
          </div>
        </div>

        {/* Dynamic add new employee drawer if active */}
        <AnimatePresence>
          {isAddOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-8"
            >
              <div id="add-employee-form" className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-4">
                  <UserPlus className="w-5 h-5 text-slate-800" />
                  Configure Fresh System Credentials and Profiles
                </h2>
                
                <form onSubmit={handleCreateEmployee} className="grid grid-cols-1 md:grid-cols-4 gap-5 items-end">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Name of User
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Johnathan Smith"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded text-xs bg-slate-50 focus:bg-white focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="john@company.com"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded text-xs bg-slate-50 focus:bg-white focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      System Role
                    </label>
                    <select
                      value={newRole}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNewRole(val);
                        if (val === "admin") {
                          setNewPassword("123456");
                        }
                      }}
                      className="w-full px-3 py-2 border border-slate-200 rounded text-xs bg-slate-50 focus:bg-white focus:outline-hidden"
                    >
                      <option value="employee">Corporate Employee Staff</option>
                      <option value="accounts">Accounts Head Auditor</option>
                      <option value="admin">System Administrator</option>
                    </select>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Password (6+ chars)
                      </label>
                      {newRole === "admin" && (
                        <span className="text-[9px] text-indigo-600 font-bold bg-indigo-50 px-1.5 rounded">Enforced: 123456</span>
                      )}
                    </div>
                    <input
                      type="password"
                      required
                      disabled={newRole === "admin"}
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded text-xs bg-slate-50 focus:bg-white disabled:opacity-75 disabled:bg-indigo-50/30"
                    />
                  </div>

                  <div className="md:col-span-4 flex justify-end gap-3 mt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddOpen(false);
                        setNewRole("employee");
                        setNewPassword("");
                      }}
                      className="px-4 py-2 border border-slate-200 text-slate-700 rounded text-xs font-semibold hover:bg-slate-50"
                    >
                      Close Form
                    </button>
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="bg-slate-950 hover:bg-slate-900 text-white rounded px-5 py-2 text-xs font-bold disabled:opacity-50"
                    >
                      {actionLoading ? "Registering..." : "Publish Access"}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Employee Summary Table FIRST */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden mb-8">
          
          <div className="p-6 border-b border-slate-150 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-sans font-black uppercase tracking-widest text-slate-700 flex items-center gap-2">
                <Table className="w-5 h-5 text-slate-400" />
                Users & System Profiles Directory
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Summary values, history counts, lifetime claim totals, and easy reset triggers.</p>
            </div>

            {/* Quick actions box: download all + staff search */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
              <button
                onClick={handleExportStaff}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-lg shadow-sm transition inline-flex items-center justify-center gap-2 whitespace-nowrap"
                title="Download data of all employees at once in a single spreadsheet"
              >
                <Download className="w-4 h-4" />
                Download staff Record
              </button>

              <div className="relative max-w-sm w-full">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                  <Search className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name, email, role..."
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-slate-950 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Role filter tabs */}
          <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/20 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => { setRoleFilterTab("all"); setCurrentPage(1); }}
                className={`px-3 py-1 rounded-md font-bold text-[11px] transition cursor-pointer ${
                  roleFilterTab === "all" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                All Roles
              </button>
              <button
                type="button"
                onClick={() => { setRoleFilterTab("employee"); setCurrentPage(1); }}
                className={`px-3 py-1 rounded-md font-bold text-[11px] transition cursor-pointer ${
                  roleFilterTab === "employee" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Employees ({employees.filter(e => e.role === "employee").length})
              </button>
              <button
                type="button"
                onClick={() => { setRoleFilterTab("accounts"); setCurrentPage(1); }}
                className={`px-3 py-1 rounded-md font-bold text-[11px] transition cursor-pointer ${
                  roleFilterTab === "accounts" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Accounts Heads ({employees.filter(e => e.role === "accounts").length})
              </button>
              <button
                type="button"
                onClick={() => { setRoleFilterTab("admin"); setCurrentPage(1); }}
                className={`px-3 py-1 rounded-md font-bold text-[11px] transition cursor-pointer ${
                  roleFilterTab === "admin" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Admins ({employees.filter(e => e.role === "admin").length})
              </button>
            </div>

            <div className="text-[11px] text-slate-400 font-semibold font-mono">
              Sorting: Most Recent Claim Prioritized at Top
            </div>
          </div>

          {loading ? (
            <div className="p-16 text-center">
              <svg className="animate-spin h-8 w-8 text-slate-950 mx-auto" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          ) : paginatedEmployees.length === 0 ? (
            <div className="p-16 text-center text-slate-400">
              <Layers className="w-10 h-10 text-slate-200 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-700">No matching user accounts located.</p>
              <p className="text-[10px] text-slate-450 font-semibold">Accounts meeting your selection will show up here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs divide-y divide-slate-150 text-slate-700">
                <thead className="bg-slate-50 font-bold uppercase text-[10px] text-slate-500 tracking-wider">
                  <tr>
                    <th className="px-6 py-4">User Profile & Identity</th>
                    <th className="px-6 py-4">This Month spend</th>
                    <th className="px-6 py-4">Lifetime Total</th>
                    <th className="px-6 py-4">Last Claim Date</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150">
                  {paginatedEmployees.map((emp) => {
                    const isClaimant = emp.role === "employee" || emp.role === "accounts";
                    const isSelf = emp.user_id === profile?.user_id;
                    const stats = getEmployeeStats(emp.user_id);
                    return (
                      <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                        
                        {/* Name & Mail */}
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1 items-start">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900">{emp.name}</span>
                              {isSelf && (
                                <span className="bg-slate-900 text-white uppercase text-[8px] font-bold px-1.5 py-0.5 rounded-sm">Self</span>
                              )}
                            </div>
                            <div className="text-[10px] font-mono text-slate-400">{emp.email}</div>
                            
                            {/* Role Badge */}
                            <div>
                              {emp.role === "admin" && (
                                <span className="inline-block px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-100">Administrator</span>
                              )}
                              {emp.role === "accounts" && (
                                <span className="inline-block px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-100">Accounts Head</span>
                              )}
                              {emp.role === "employee" && (
                                <span className="inline-block px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-100">Employee Staff</span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Current Month's Spend */}
                        <td className="px-6 py-4 font-mono font-extrabold text-slate-900">
                          {isClaimant ? (
                            `₹${stats.monthTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                          ) : (
                            <span className="text-slate-300 italic font-semibold">—</span>
                          )}
                        </td>

                        {/* Total Lifetime Expense */}
                        <td className="px-6 py-4 font-mono font-black text-indigo-950">
                          {isClaimant ? (
                            `₹${stats.lifetime.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                          ) : (
                            <span className="text-slate-300 italic font-semibold">—</span>
                          )}
                        </td>

                        {/* Last claim date */}
                        <td className="px-6 py-4 font-mono text-slate-400 font-semibold">
                          {isClaimant ? stats.lastDate : <span className="text-slate-300 italic font-normal">—</span>}
                        </td>

                        {/* Row action routes */}
                        <td className="px-6 py-4 text-right">
                          <div className="inline-flex gap-2 justify-end">
                            {isClaimant && (
                              <>
                                <Link
                                  to={`/admin/employee/${emp.user_id}`}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-205 rounded bg-white hover:bg-slate-50 font-bold text-[10px] uppercase text-slate-705 transition shadow-2xs"
                                  title="Inspect staff sheet and archives"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  View Details
                                </Link>
                                
                                <button
                                  onClick={() => triggerResetFlow(emp)}
                                  disabled={stats.activeTotal <= 0}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-amber-505 hover:bg-amber-600 disabled:opacity-40 text-white font-bold text-[10px] uppercase transition shadow-2xs"
                                  title="Archive staff month claims register"
                                >
                                  <Archive className="w-3.5 h-3.5" />
                                  Reset
                                </button>
                              </>
                            )}

                            {!isSelf ? (
                              <button
                                onClick={() => setDeleteConfirmEmployee(emp)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] uppercase transition shadow-2xs"
                                title="Permanently Delete and Purge all records from Auth & Db"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete
                              </button>
                            ) : (
                              <span className="inline-block text-[10px] px-2.5 py-1 text-slate-400 font-bold bg-slate-50 rounded-md select-none border border-slate-200">Protected</span>
                            )}
                          </div>
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Table pagination controller */}
              <div className="p-4 bg-slate-50/50 border-t border-slate-150 flex items-center justify-between text-xs text-slate-500 font-semibold select-none">
                <span>
                  Showing <strong>{startIndex + 1}-{Math.min(startIndex + itemsPerPage, totalEmployeesMatched)}</strong> of <strong>{totalEmployeesMatched}</strong> user entries
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrevPage}
                    disabled={currentPage === 1}
                    className="p-1.5 border border-slate-200 bg-white hover:bg-slate-50 rounded disabled:opacity-30"
                  >
                    Prev
                  </button>
                  <span className="font-bold text-slate-850">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages}
                    className="p-1.5 border border-slate-200 bg-white hover:bg-slate-50 rounded disabled:opacity-30"
                  >
                    Next
                  </button>
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Track Workspace Activities Section */}
        <div id="track-activities-section" className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden mb-8">
          <div className="p-6 border-b border-slate-150 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-sans font-black uppercase tracking-widest text-slate-700 flex items-center gap-2">
                <Layers className="w-5 h-5 text-slate-400" />
                Track Activities & Workspace Claims
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Observe live claim audits at accounts desk, trace accepted or rejected claims, and inspect submission details.
              </p>
            </div>

            {/* Local tracking search and indicators */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
              <div className="relative max-w-sm w-full">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                  <Search className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  value={trackSearch}
                  onChange={(e) => setTrackSearch(e.target.value)}
                  placeholder="Filter claims by applicant, note, amount..."
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-slate-950 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Tab selector for Accounts Desk Stage */}
          <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/10 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-1.5 bg-slate-105 p-1 rounded-lg bg-slate-100">
              <button
                type="button"
                onClick={() => setTrackTab("pending")}
                className={`px-3 py-1 rounded-md font-bold text-[11px] transition flex items-center gap-1.5 cursor-pointer ${
                  trackTab === "pending" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Pending at Accounts ({allExpenses.filter(e => e.accounts_status === "pending").length})
              </button>
              <button
                type="button"
                onClick={() => setTrackTab("approved")}
                className={`px-3 py-1 rounded-md font-bold text-[11px] transition flex items-center gap-1.5 cursor-pointer ${
                  trackTab === "approved" ? "bg-white text-emerald-700 shadow-xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Approved Claims ({allExpenses.filter(e => e.accounts_status === "approved").length})
              </button>
              <button
                type="button"
                onClick={() => setTrackTab("rejected")}
                className={`px-3 py-1 rounded-md font-bold text-[11px] transition flex items-center gap-1.5 cursor-pointer ${
                  trackTab === "rejected" ? "bg-white text-rose-700 shadow-xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Rejected Claims ({allExpenses.filter(e => e.accounts_status === "rejected").length})
              </button>
            </div>

            <div className="text-[11px] text-slate-400 font-semibold font-mono">
              Real-time synchronization active
            </div>
          </div>

          {/* Track Table / Details block */}
          {loading ? (
            <div className="p-16 text-center">
              <svg className="animate-spin h-8 w-8 text-slate-950 mx-auto" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          ) : trackedClaims.length === 0 ? (
            <div className="p-12 text-center text-slate-400 border-b border-slate-150">
              <Layers className="w-10 h-10 text-slate-200 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-700">No matching activities found underneath this category.</p>
              <p className="text-[10px] text-slate-400 font-semibold">Workspace activities will auto-populate as employees submit their claims.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs divide-y divide-slate-150 text-slate-700">
                <thead className="bg-slate-50 font-bold uppercase text-[10px] text-slate-500 tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Employee Claimant</th>
                    <th className="px-6 py-4">Claim Details & Nature</th>
                    <th className="px-6 py-4">Notes & Description</th>
                    <th className="px-6 py-4">Financial Amount</th>
                    <th className="px-6 py-4">Audit & Progress Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150">
                  {trackedClaims.map((item) => {
                    const prof = employees.find(e => e.user_id === item.employee_id);
                    const isSelf = prof?.user_id === profile?.user_id;
                    const accountsAuditor = employees.find(e => e.user_id === item.accounts_approved_by);
                    
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors align-top">
                        {/* Claimant info */}
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <span className="font-bold text-slate-900 flex items-center gap-1.5">
                              {prof?.name || "System User"}
                              {isSelf && (
                                <span className="bg-slate-900 text-white uppercase text-[8px] font-bold px-1 rounded-xs">Self</span>
                              )}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">{prof?.email || item.employee_id}</span>
                            <span className="text-[9px] text-slate-400 font-bold font-mono uppercase bg-slate-101 bg-slate-100 px-1 py-0.5 rounded-sm w-fit mt-1">
                              {prof?.role === "accounts" ? "Accounts Head" : "Employee"}
                            </span>
                          </div>
                        </td>

                        {/* Claim Details */}
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1 items-start">
                            <span className="bg-indigo-50 text-indigo-700 font-bold px-1.5 py-0.5 rounded-sm text-[10px] uppercase border border-indigo-100">
                              {item.expense_type === "Other" ? (item.custom_type || "Other") : item.expense_type}
                            </span>
                            <span className="text-slate-500 font-mono text-[10px] mt-1">Submitted: {new Date(item.created_at || item.expense_date).toLocaleDateString()}</span>
                            <span className="text-[9px] font-bold text-slate-400">Nature: {item.expense_nature || "Reimbursement"}</span>
                            <span className="text-[9px] font-bold text-slate-400">Term: {item.payment_term === "Custom" ? (item.custom_payment_term || "Custom") : (item.payment_term || "Immediate")}</span>
                          </div>
                        </td>

                        {/* Notes */}
                        <td className="px-6 py-4 max-w-xs whitespace-normal">
                          <div className="flex flex-col gap-1.5">
                            <p className="text-[11px] text-slate-600 font-normal leading-relaxed">
                              {item.notes || <span className="text-slate-400 italic">No notes provided with submission</span>}
                            </p>
                            {item.proof_url ? (
                              <a
                                href={item.proof_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 w-fit cursor-pointer leading-tight border-b border-indigo-200"
                              >
                                <Eye className="w-3.5 h-3.5 shrink-0" />
                                Inspect receipt document
                              </a>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-semibold italic mt-1 inline-flex items-center gap-1">
                                No receipt attached
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Amount */}
                        <td className="px-6 py-4">
                          <span className="font-mono font-extrabold text-slate-900 text-sm">
                            ₹{parseFloat(item.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </span>
                        </td>

                        {/* Audit & workflow status info */}
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-2">
                            {/* Accounts auditor badge status */}
                            <div>
                              <span className="text-[9px] font-bold block text-slate-400 uppercase tracking-tight mb-1">Accounts desk validation</span>
                              {item.accounts_status === "pending" && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 rounded text-[9px] font-bold uppercase">
                                  <Clock className="w-3 h-3 animate-pulse" />
                                  Pending approval
                                </span>
                              )}
                              {item.accounts_status === "approved" && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded text-[9px] font-bold uppercase">
                                  <Check className="w-3 h-3" />
                                  Validated & Approved
                                </span>
                              )}
                              {item.accounts_status === "rejected" && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-100 rounded text-[9px] font-bold uppercase">
                                  <X className="w-3 h-3" />
                                  Auditor Rejected
                                </span>
                              )}
                            </div>

                            {/* Audit Remarks or info */}
                            {(item.accounts_remarks || accountsAuditor) && (
                              <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                                {accountsAuditor && (
                                  <div className="text-[9px] text-slate-500 font-bold mb-0.5">
                                    Audited By: <span className="text-slate-800">{accountsAuditor.name}</span>
                                  </div>
                                )}
                                {item.accounts_approved_at && (
                                  <div className="text-[8px] text-slate-400 font-semibold font-mono mb-1">
                                    Audited At: {new Date(item.accounts_approved_at).toLocaleString()}
                                  </div>
                                )}
                                {item.accounts_remarks && (
                                  <div className="text-[10px] text-slate-650 font-serif italic mt-0.5 leading-tight">
                                    "{item.accounts_remarks}"
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Final admin workflow stage */}
                            {item.accounts_status === "approved" && (
                              <div className="mt-1 border-t border-slate-100 pt-1.5">
                                <span className="text-[9px] font-bold block text-slate-400 uppercase tracking-tight mb-1">Workflow milestone</span>
                                <span className={`text-[9px] font-bold font-mono px-1.5 py-0.5 rounded ${
                                  item.workflow_status === "Approved by Admin" 
                                    ? "bg-indigo-50 text-indigo-700 border border-indigo-100" 
                                    : item.workflow_status === "Rejected by Admin"
                                    ? "bg-rose-50 text-rose-700 border border-rose-100"
                                    : "bg-slate-100 text-slate-600 border border-slate-200"
                                }`}>
                                  {item.workflow_status || "Pending Admin decision"}
                                </span>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Simplified exact 3 metrics admin stats grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          
          {/* Card 1: Expenses for This Month */}
          <div className="bg-slate-950 p-5 rounded-2xl text-white shadow-md border border-slate-800 hover:scale-[1.01] transition-transform duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-300 font-bold uppercase tracking-wider block font-sans">Expenses for This Month</span>
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
            </div>
            <span className="text-2xl sm:text-3xl font-black font-mono block mt-2 text-white">
              ₹{currentMonthExpAmt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[11px] text-slate-400 block mt-2 font-medium">Combined spend of all staff this month</span>
          </div>

          {/* Card 2: Lifetime Total */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:scale-[1.01] transition-transform duration-200">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block font-sans">Lifetime Total</span>
            <span className="text-2xl sm:text-3xl font-black font-mono block mt-2 text-slate-900">
              ₹{lifetimeTotalAcrossAll.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[11px] text-emerald-600 block mt-2 font-bold">All-time corporate claim cumulative</span>
          </div>

          {/* Card 3: Latest Claim Date */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:scale-[1.01] transition-transform duration-200">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block font-sans">Latest Claim Date</span>
            </div>
            <span className="text-xl sm:text-2xl font-black block mt-2.5 text-slate-800 font-mono">
              {absoluteLatestClaimDate}
            </span>
            <span className="text-[11px] text-slate-405 block mt-2 font-medium">Most recent claim entry date among staff</span>
          </div>

        </div>

        {/* Charts Section utilizing Recharts AFTER stats */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          
          {/* Chart 1: Category Breakdown Pie */}
          <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-xs">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-700 mb-4 flex items-center gap-1.5 border-b border-slate-100 pb-2 font-sans">
              <BarChart3 className="w-4 h-4 text-slate-450" />
              Category distribution
            </h4>
            
            {categoryBreakdownData.length === 0 ? (
              <div className="h-44 flex items-center justify-center text-xs text-slate-400 font-medium">No spending entries found yet</div>
            ) : (
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryBreakdownData}
                      cx="50%"
                      cy="50%"
                      innerRadius={30}
                      outerRadius={50}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {categoryBreakdownData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => `₹${parseFloat(value).toLocaleString("en-IN")}`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="mt-2 flex flex-wrap gap-2 justify-center text-[9px] font-bold text-slate-500 uppercase tracking-tight font-mono">
              {categoryBreakdownData.slice(0, 5).map((e) => (
                <span key={e.name} className="inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: e.color }}></span>
                  {e.name}
                </span>
              ))}
            </div>
          </div>

          {/* Chart 2: Monthly trend line */}
          <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-xs lg:col-span-2">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-700 mb-4 flex items-center gap-1.5 border-b border-slate-100 pb-2 font-sans">
              <RefreshCw className="w-4 h-4 text-slate-455 animate-pulse" />
              2026 Monthly spending dynamic (INR)
            </h4>

            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlySpendData}>
                  <defs>
                    <linearGradient id="colorSpent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(val) => `₹${val}`} />
                  <Tooltip formatter={(value: any) => `₹${parseFloat(value).toLocaleString("en-IN")}`} />
                  <Line type="monotone" dataKey="Spent Total" stroke="#4f46e5" strokeWidth={3.5} dot={{ r: 4, strokeWidth: 2, stroke: "#4f46e5", fill: "#ffffff" }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

      </div>

      {/* CONFIRM RESET OVERLAY WINDOW */}
      {resetConfirmEmployee && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
            
            <div className="p-6 bg-rose-50 border-b border-rose-100 flex gap-4">
              <div className="h-10 w-10 shrink-0 rounded-full bg-rose-100 flex items-center justify-center text-rose-700">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-rose-950 uppercase tracking-tight">
                  Are you sure you want to archive and reset this employee's active expenses?
                </h3>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-500 leading-relaxed">
                All expense records and proof documents will remain permanently stored.<br/>
                Only the active running total will be reset to zero. This employee starts fresh right after.
              </p>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-1">
                  Assign Archive Cycle Period Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. June 2026"
                  required
                  value={resetName}
                  onChange={(e) => setResetName(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded"
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-150 flex justify-end gap-3 font-semibold">
              <button
                onClick={() => setResetConfirmEmployee(null)}
                className="px-4 py-2 text-xs text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReset}
                disabled={actionLoading}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-4 py-2 rounded"
              >
                {actionLoading ? "Resetting..." : "Confirm Reset"}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* CONFIRM DELETE EMPLOYEE OVERLAY */}
      {deleteConfirmEmployee && (
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
                  {deleteConfirmEmployee.name}
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
                onClick={() => setDeleteConfirmEmployee(null)}
                className="px-4 py-2 text-xs text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteEmployee(deleteConfirmEmployee)}
                disabled={actionLoading}
                className="bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs px-4 py-2 rounded-lg transition shadow-xs"
              >
                {actionLoading ? "Purging..." : "Confirm Purge"}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* CONFIRM RESET ALL OVERLAY WINDOW */}
      {showResetAllModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-100">
          <div className="bg-white max-w-md w-full rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            <div className="p-6 bg-rose-50 border-b border-rose-100 flex gap-4">
              <div className="h-10 w-10 shrink-0 rounded-full bg-rose-100 flex items-center justify-center text-rose-700">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="text-left">
                <h3 className="text-sm font-black text-slate-950 uppercase tracking-tight">
                  Archive and Reset All Employee Accounts?
                </h3>
              </div>
            </div>

            <div className="p-6 space-y-4 font-sans text-left">
              <p className="text-xs text-slate-500 leading-relaxed">
                This operation consolidates all active (unarchived) expenses across <strong>ALL</strong> registered corporate employee profiles and packages them into permanent search profiles.
              </p>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[10.5px] text-amber-900 font-semibold leading-relaxed">
                ⚠️ All active running claim balances of all employees will be set to <strong>zero value</strong>. This action is irreversible. All current proof files remain safely preserved in archives.
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1.5">
                  Universal Archive Cycle Name (*Required)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Reset All June 2026"
                  required
                  value={resetAllName}
                  onChange={(e) => setResetAllName(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-250 rounded-xl focus:bg-white focus:outline-hidden"
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-150 flex justify-end gap-3 font-semibold">
              <button
                onClick={() => { setShowResetAllModal(false); setResetAllName(""); }}
                className="px-4 py-2 text-xs text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkResetAll}
                disabled={resetAllPending}
                className="bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition shadow-xs"
              >
                {resetAllPending ? "Archiving All..." : "Confirm Reset All"}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
