import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { 
  ArrowLeft, FileText, Calendar, DollarSign, Edit3, Image, 
  UploadCloud, AlertCircle, CheckCircle2, ChevronRight, Info 
} from "lucide-react";
import { motion } from "motion/react";

const EXPENSE_TYPES = [
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

export const AddExpense: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  // Form Inputs
  const [expenseType, setExpenseType] = useState("Food");
  const [customType, setCustomType] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  
  // New workflow metadata inputs
  const [expenseNature, setExpenseNature] = useState("Reimbursement");
  const [gstType, setGstType] = useState("GST Bill");
  const [paymentTerm, setPaymentTerm] = useState("Immediate");
  const [customPaymentTerm, setCustomPaymentTerm] = useState("");
  
  // File Upload states
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  // Status states
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // File choice trigger
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    if (!e.target.files || e.target.files.length === 0) {
      setFile(null);
      setPreviewUrl(null);
      return;
    }

    const selectedFile = e.target.files[0];
    
    // Size check: limit to 10 MB
    if (selectedFile.size > 10 * 1024 * 1024) {
      setErrorMsg("File is too large. Maximum accepted file size is 10 MB.");
      return;
    }

    // Type check
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "application/pdf"];
    if (!validTypes.includes(selectedFile.type)) {
      setErrorMsg("Invalid file type. Only JPG, JPEG, PNG, or PDF format are accepted.");
      return;
    }

    setFile(selectedFile);

    // Create file preview
    if (selectedFile.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
    } else {
      setPreviewUrl(null); // PDF preview placeholder
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const numericAmount = Math.round(parseFloat(amount) * 100) / 100;
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setErrorMsg("Amount must be a numeric value greater than zero.");
      setIsLoading(false);
      return;
    }

    if (expenseType === "Other" && !customType.trim()) {
      setErrorMsg("Please specify the custom expense category.");
      setIsLoading(false);
      return;
    }

    if (paymentTerm === "Custom" && !customPaymentTerm.trim()) {
      setErrorMsg("Please specify the custom payment term description.");
      setIsLoading(false);
      return;
    }

    try {
      if (!user) throw new Error("Could not find authenticated session. Please log in again.");

      // Calculate temporary expense ID to match storage layout specifications
      const tempExpenseId = crypto.randomUUID();
      let proofUrl = "";

      // Document Upload procedure
      if (file) {
        setUploadProgress(20);
        const fileNameSanitized = file.name.replace(/[^a-zA-Z0-9.]/g, "_");
        const uploadPath = `${user.id}/${tempExpenseId}/${fileNameSanitized}`;

        setUploadProgress(50);
        
        const { error: uploadError } = await supabase.storage
          .from("proofs")
          .upload(uploadPath, file, { cacheControl: "3600", upsert: false });

        if (uploadError) {
          console.warn("Storage upload failed. Please verify that the 'proofs' bucket exists in your Supabase backend:", uploadError.message);
          throw new Error(`Failed to upload file proof attachment: ${uploadError.message}. Ensure the 'proofs' storage bucket exists.`);
        }

        setUploadProgress(85);

        const { data: { publicUrl: resolvedUrl } } = supabase.storage
          .from("proofs")
          .getPublicUrl(uploadPath);

        proofUrl = resolvedUrl;
        setUploadProgress(100);
      }

      const isAccountsUser = profile?.role === "accounts";
      const timestamp = new Date().toISOString();

      // Initial approval history
      const initialHistory = [{
        role: isAccountsUser ? "accounts" : "employee",
        action: "create",
        actor_id: user.id,
        actor_name: profile?.name || user.email || "Employee",
        timestamp,
        remarks: isAccountsUser ? "Claim entered by Accounts Head (Elevated directly to Admin)" : "Claim submitted"
      }];

      // Record insertion
      const expenseObj = {
        id: tempExpenseId,
        employee_id: user.id,
        expense_type: expenseType,
        custom_type: expenseType === "Other" ? customType : null,
        amount: numericAmount,
        expense_date: expenseDate,
        notes: notes ? notes : null,
        proof_url: proofUrl ? proofUrl : null,
        is_archived: false,
        archive_id: null,
        
        // New workflow properties
        workflow_status: isAccountsUser ? "Approved by Accounts" : "Pending Accounts Approval",
        accounts_status: isAccountsUser ? "approved" : "pending",
        accounts_approved_by: isAccountsUser ? user.id : null,
        accounts_approved_at: isAccountsUser ? timestamp : null,
        accounts_remarks: isAccountsUser ? "Claim entered by Accounts Head" : null,
        admin_status: "pending",
        admin_approved_by: null,
        admin_approved_at: null,
        admin_remarks: null,
        approval_history: initialHistory,
        
        // Metadata inputs
        expense_nature: expenseNature,
        gst_type: gstType,
        payment_term: paymentTerm,
        custom_payment_term: paymentTerm === "Custom" ? customPaymentTerm : null
      };

      // Secure submission via REST API endpoint to trigger automatic workflows and logging
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || "";

      const res = await fetch("/api/expenses/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(expenseObj)
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to submit expense claim (Server status: ${res.status})`);
      }

      // Clean form inputs
      setExpenseType("Food");
      setCustomType("");
      setAmount("");
      setNotes("");
      setExpenseNature("Reimbursement");
      setGstType("GST Bill");
      setPaymentTerm("Immediate");
      setCustomPaymentTerm("");
      setFile(null);
      setPreviewUrl(null);
      setUploadProgress(null);

      setSuccessMsg("Expense record has been registered successfully!");
      
      // Navigate to overview shortly
      setTimeout(() => {
        navigate("/employee-dashboard");
      }, 1500);

    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred inserting the record into the database.");
      setUploadProgress(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      
      {/* Navigation Line */}
      <div className="mb-6 flex justify-between items-center">
        <Link
          to="/employee-dashboard"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
        <span className="text-xs text-slate-400 font-medium select-none">
          Employee Portal <ChevronRight className="inline w-3 h-3" /> Add Expense
        </span>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
        
        {/* Color Block Heading */}
        <div className="bg-slate-950 p-6 sm:p-8 text-white">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            Register Claim Request
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            Fill out form details and upload the associated PDF/Image receipts for records synchronization.
          </p>
        </div>

        {/* Content Form Body */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
          
          {/* Status Message banners */}
          {successMsg && (
            <div className="flex items-start gap-2.5 p-4 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-100 mb-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Transaction Confirmed</p>
                <p className="text-xs text-emerald-700 mt-0.5">{successMsg}</p>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="flex items-start gap-2.5 p-4 rounded-xl bg-red-50 text-red-800 border border-red-100 mb-2">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Execution Prevented</p>
                <p className="text-xs text-red-700 mt-0.5">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Form Layout Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Field 1: Category */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Expense Category <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={expenseType}
                  onChange={(e) => setExpenseType(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-slate-950 transition-colors"
                >
                  {EXPENSE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Sub Field: Custom Category description if Other */}
            {expenseType === "Other" && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="col-span-1"
              >
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Describe Custom Category <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Courier services"
                  value={customType}
                  onChange={(e) => setCustomType(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-slate-950"
                />
              </motion.div>
            )}

            {/* Field 2: Date Picker */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Claim Date <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-xs tracking-wide bg-slate-50 focus:bg-white focus:ring-2 focus:ring-slate-950"
                />
              </div>
            </div>

            {/* Field 3: Numeric Amount */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Value Amount (INR ₹) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 font-bold">
                  ₹
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full pl-8 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-slate-950"
                />
              </div>
            </div>

            {/* New: Expense Nature Dropdown */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Expense Nature <span className="text-red-500">*</span>
              </label>
              <select
                value={expenseNature}
                onChange={(e) => setExpenseNature(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-slate-950 transition-colors"
              >
                <option value="Reimbursement">Reimbursement</option>
                <option value="Vendor Payment">Vendor Payment</option>
                <option value="Purchase">Purchase</option>
              </select>
            </div>

            {/* New: GST Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                GST Selection <span className="text-red-500">*</span>
              </label>
              <select
                value={gstType}
                onChange={(e) => setGstType(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-slate-950 transition-colors"
              >
                <option value="GST Bill">GST Bill</option>
                <option value="Non-GST Bill">Non-GST Bill</option>
              </select>
            </div>

            {/* New: Payment Terms */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Payment Terms <span className="text-red-500">*</span>
              </label>
              <select
                value={paymentTerm}
                onChange={(e) => setPaymentTerm(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-slate-950 transition-colors"
              >
                <option value="Pay Today">Pay Today</option>
                <option value="Within 3 Days">Within 3 Days</option>
                <option value="Within 7 Days">Within 7 Days</option>
                <option value="End of Week">End of Week</option>
                <option value="Month End">Month End</option>
                <option value="Immediate">Immediate</option>
                <option value="Custom">Custom</option>
              </select>
            </div>

            {/* CONDITIONAL: Custom Payment Terms */}
            {paymentTerm === "Custom" && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="col-span-1"
              >
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Describe Custom Terms <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 50% advance, 50% on receipt"
                  value={customPaymentTerm}
                  onChange={(e) => setCustomPaymentTerm(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-slate-950"
                />
              </motion.div>
            )}

            {/* Field 4: Text Notes (Span whole block) */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Contextual Notes & Descriptions
              </label>
              <textarea
                rows={3}
                placeholder="Include details about client, project names, or details justifying this claim..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-slate-950"
              />
            </div>

            {/* Field 5: Attachment proof upload area */}
            <div className="md:col-span-2 border-2 border-dashed border-slate-200 hover:border-slate-400 bg-slate-50/50 rounded-xl p-6 transition-all">
              <label className="block text-center text-xs font-bold text-slate-700 uppercase tracking-wider mb-4">
                Upload Document Proof (Optional)
              </label>

              <div className="flex flex-col items-center justify-center">
                <UploadCloud className="w-10 h-10 text-slate-400 mb-2" />
                <span className="text-xs font-semibold text-slate-600 block">Drag & Drop or browse files</span>
                <span className="text-[10px] text-slate-400 mt-1">Acceptable forms: JPG, JPEG, PNG, or PDF file (Max 10 MB)</span>
                
                <input
                  type="file"
                  id="file-attachment"
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label
                  htmlFor="file-attachment"
                  className="mt-4 px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 rounded-lg text-xs font-bold cursor-pointer transition shadow-xs"
                >
                  Choose Document Proof
                </label>
              </div>

              {/* Upload Status monitor */}
              {file && (
                <div className="mt-6 p-4 bg-white rounded-lg border border-slate-150 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-slate-100 p-2 rounded-lg text-slate-700">
                      {file.type === "application/pdf" ? <FileText className="w-5 h-5" /> : <Image className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800 break-all">{file.name}</p>
                      <p className="text-[10px] text-slate-400">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                    </div>
                  </div>

                  {previewUrl && (
                    <div className="h-14 w-14 shrink-0 rounded-lg border border-slate-150 overflow-hidden bg-slate-50">
                      <img src={previewUrl} alt="Thumbnail Receipt attachment" className="h-full w-full object-cover" />
                    </div>
                  )}
                </div>
              )}

              {/* Progress Bar indicator */}
              {uploadProgress !== null && (
                <div className="mt-4">
                  <div className="flex justify-between items-center text-[10px] uppercase font-bold text-slate-500 mb-1">
                    <span>Uploading attachment receipt...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-slate-900 h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                  </div>
                </div>
              )}
            </div>

          </div>

          <div className="flex gap-4 pt-6 border-t border-slate-100 justify-end">
            <Link
              to="/employee-dashboard"
              className="px-5 py-2.5 border border-slate-200 hover:bg-slate-50 rounded-lg text-sm font-semibold text-slate-700 transition"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center gap-2 bg-slate-950 hover:bg-slate-900 text-white font-bold text-sm px-6 py-2.5 rounded-lg shadow-md transition disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Syncing Claim Data...
                </>
              ) : (
                "Publish Claim Request"
              )}
            </button>
          </div>

        </form>

        <div className="bg-slate-50 p-4 border-t border-slate-100 flex items-start gap-2.5 text-[11px] text-slate-400">
          <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed font-semibold">
            By submitting, you represent that the claims are true corporate expense records. All digital uploads such as PNG, JPG, and PDFs remain stored permanently to satisfy auditing guidelines.
          </p>
        </div>

      </div>
    </div>
  );
};
