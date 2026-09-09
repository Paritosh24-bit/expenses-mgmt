import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { 
  ArrowLeft, FileText, Calendar, DollarSign, Edit3, Image, 
  UploadCloud, AlertCircle, CheckCircle2, ChevronRight, Info,
  Utensils, Coffee, Minus, Plus, Car, MapPin, X
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

  // Mileage / Petrol states
  const [isMileageValid, setIsMileageValid] = useState(false);
  const [mileageDetails, setMileageDetails] = useState("");
  const [fromLocation, setFromLocation] = useState("");
  const [toLocation, setToLocation] = useState("");
  const [vehicleType, setVehicleType] = useState<"2 Wheeler" | "4 Wheeler" | "">("");
  const [distanceKm, setDistanceKm] = useState("");

  // Food allowance states
  const [mealType, setMealType] = useState<"Breakfast" | "Lunch" | "Dinner" | "">("");
  const [numIndividuals, setNumIndividuals] = useState<number>(1);
  const [individualNames, setIndividualNames] = useState<string[]>([""]);
  const [actualBillAmount, setActualBillAmount] = useState<string>("");
  const [foodDetails, setFoodDetails] = useState<string>("");
  const [isFoodValid, setIsFoodValid] = useState<boolean>(false);

  // Modal visibility states
  const [showPetrolModal, setShowPetrolModal] = useState(false);
  const [showFoodModal, setShowFoodModal] = useState(false);

  const individualNamesStr = individualNames.join(",");

  // Synchronize Petrol calculation whenever inputs change
  React.useEffect(() => {
    if (expenseType !== "Petrol") return;

    const km = parseFloat(distanceKm);
    const rate = vehicleType === "2 Wheeler" ? 3.25 : (vehicleType === "4 Wheeler" ? 8.50 : 0);
    const isValid = fromLocation.trim() !== "" && toLocation.trim() !== "" && vehicleType !== "" && !isNaN(km) && km > 0;

    setIsMileageValid(isValid);

    if (isValid) {
      const total = km * rate;
      setAmount(total.toFixed(2));

      const detailsStr = `[Petrol/Mileage details]\n- Route: ${fromLocation.trim()} to ${toLocation.trim()}\n- Vehicle: ${vehicleType} (₹${rate}/km)\n- Distance: ${km.toFixed(2)} km\n- Approved Reimbursement: ₹${total.toFixed(2)}`;
      setMileageDetails(detailsStr);
    } else {
      setAmount("");
      setMileageDetails("");
    }
  }, [expenseType, fromLocation, toLocation, vehicleType, distanceKm]);

  // Synchronize Food calculation whenever inputs change
  React.useEffect(() => {
    if (expenseType !== "Food") return;

    const rate = mealType === "Breakfast" ? 80 : (mealType === "Lunch" || mealType === "Dinner" ? 200 : 0);
    const billAmt = parseFloat(actualBillAmount);
    
    const namesFilled = individualNames.every(name => name && name.trim().length > 0);
    const isValid = mealType !== "" && numIndividuals >= 1 && namesFilled && !isNaN(billAmt) && billAmt > 0;

    setIsFoodValid(isValid);

    if (isValid) {
      const allowanceLimit = rate * numIndividuals;
      const finalAmt = Math.min(allowanceLimit, billAmt);
      setAmount(finalAmt.toFixed(2));

      const detailsStr = `[Food Allowance details]\n- Meal Type: ${mealType} (₹${rate}/person)\n- Individuals (${numIndividuals}): ${individualNames.map(n => n.trim()).join(", ")}\n- Eligibility Allowance Limit: ₹${allowanceLimit.toFixed(2)}\n- Actual Bill Amount: ₹${billAmt.toFixed(2)}\n- Approved Reimbursement: ₹${finalAmt.toFixed(2)} (Min of allowance limit and actual bill)`;
      setFoodDetails(detailsStr);
    } else {
      setAmount("");
      setFoodDetails("");
    }
  }, [expenseType, mealType, numIndividuals, individualNamesStr, actualBillAmount]);

  const handleNumIndividualsChange = (val: number) => {
    const nextVal = Math.max(1, isNaN(val) ? 1 : val);
    setNumIndividuals(nextVal);
    
    // Adjust individualNames array size
    setIndividualNames(prev => {
      const copy = [...prev];
      if (nextVal > copy.length) {
        while (copy.length < nextVal) {
          copy.push("");
        }
      } else if (nextVal < copy.length) {
        copy.splice(nextVal);
      }
      return copy;
    });
  };


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

    if (expenseType === "Food" && !file) {
      setErrorMsg("Please upload the food bill receipt to register this claim.");
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

      // Combine manual notes with structured mileage details if category is Petrol or Food details if category is Food
      let finalNotes = notes ? notes : null;
      if (expenseType === "Petrol" && mileageDetails) {
        finalNotes = notes ? `${notes}\n\n${mileageDetails}` : mileageDetails;
      } else if (expenseType === "Food" && foodDetails) {
        finalNotes = notes ? `${notes}\n\n${foodDetails}` : foodDetails;
      }

      // Record insertion
      const expenseObj = {
        id: tempExpenseId,
        employee_id: user.id,
        expense_type: expenseType,
        custom_type: expenseType === "Other" ? customType : null,
        amount: numericAmount,
        expense_date: expenseDate,
        notes: finalNotes,
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
        custom_payment_term: paymentTerm === "Custom" ? customPaymentTerm : null,

        // Petrol Details
        from_location: expenseType === "Petrol" ? fromLocation : null,
        to_location: expenseType === "Petrol" ? toLocation : null,
        distance_km: expenseType === "Petrol" ? parseFloat(distanceKm) : null,
        vehicle_type: expenseType === "Petrol" ? vehicleType : null,

        // Food Details
        meal_type: expenseType === "Food" ? mealType : null,
        num_individuals: expenseType === "Food" ? numIndividuals : null,
        individual_names: expenseType === "Food" ? individualNames.join(", ") : null,
        actual_bill_amount: expenseType === "Food" ? parseFloat(actualBillAmount) : null
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
      setIsMileageValid(false);
      setMileageDetails("");
      setFromLocation("");
      setToLocation("");
      setVehicleType("");
      setDistanceKm("");

      // Clear Food states
      setMealType("");
      setNumIndividuals(1);
      setIndividualNames([""]);
      setActualBillAmount("");
      setFoodDetails("");
      setIsFoodValid(false);

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
                  onChange={(e) => {
                    const nextVal = e.target.value;
                    setExpenseType(nextVal);
                    // Clear Amount and reset validation
                    setAmount("");
                    setIsMileageValid(false);
                    setMileageDetails("");
                    setFromLocation("");
                    setToLocation("");
                    setVehicleType("");
                    setDistanceKm("");
                    
                    // Reset Food states
                    setMealType("");
                    setNumIndividuals(1);
                    setIndividualNames([""]);
                    setActualBillAmount("");
                    setFoodDetails("");
                    setIsFoodValid(false);

                    if (nextVal === "Petrol") {
                      setShowPetrolModal(true);
                    } else if (nextVal === "Food") {
                      setShowFoodModal(true);
                    }
                  }}
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
                  readOnly={expenseType === "Petrol" || expenseType === "Food"}
                  placeholder={
                    expenseType === "Petrol" 
                      ? "Click Calculate Mileage..." 
                      : expenseType === "Food" 
                        ? "Calculated automatically..." 
                        : "0.00"
                  }
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={`w-full pl-8 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-slate-950 ${
                    expenseType === "Petrol" || expenseType === "Food"
                      ? "bg-slate-100 cursor-not-allowed text-slate-500 font-semibold"
                      : ""
                  }`}
                />
              </div>
              {expenseType === "Petrol" && (
                <div className="mt-1.5 bg-slate-50 border border-slate-200/60 rounded-lg p-2.5">
                  <span className="text-[10px] text-indigo-650 font-black flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-indigo-650 shrink-0" />
                    {amount ? `✓ Amount ₹${amount} automatically set via Petrol/Mileage Calculator` : "⚠ Fill out the Petrol/Mileage Calculator below."}
                  </span>
                </div>
              )}
              {expenseType === "Food" && (
                <div className="mt-1.5 bg-slate-50 border border-slate-200/60 rounded-lg p-2.5">
                  <span className="text-[10px] text-indigo-650 font-black flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-indigo-650 shrink-0" />
                    {amount ? `✓ Amount ₹${amount} automatically set via Food Allowance calculator` : "⚠ Fill out the Guided Food Allowance Calculator below."}
                  </span>
                </div>
              )}
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

            {/* CONDITIONAL: Petrol/Mileage Summary Card */}
            {expenseType === "Petrol" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="md:col-span-2 bg-slate-50 border border-slate-200 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
              >
                <div className="flex items-start gap-3">
                  <div className="bg-indigo-50 text-indigo-600 p-3 rounded-xl mt-0.5">
                    <Car className="w-6 h-6 text-indigo-650" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">Petrol / Mileage Details</h3>
                    {isMileageValid ? (
                      <div className="text-xs text-slate-600 mt-1 space-y-1">
                        <p>✓ Route: <strong className="text-slate-800">{fromLocation}</strong> to <strong className="text-slate-800">{toLocation}</strong></p>
                        <p>✓ Distance: <strong className="text-indigo-650">{distanceKm} km</strong> ({vehicleType})</p>
                        <p>✓ Approved Reimbursement: <strong className="text-indigo-650 font-extrabold">₹{amount}</strong></p>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 mt-1 font-semibold text-rose-500">
                        ⚠ No route or mileage details entered. Please open the configurator.
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPetrolModal(true)}
                  className="shrink-0 px-4 py-2.5 bg-slate-900 hover:bg-slate-850 text-white rounded-lg text-xs font-black transition cursor-pointer self-start sm:self-center"
                >
                  {isMileageValid ? "Edit Petrol Details" : "Configure Petrol Details"}
                </button>
              </motion.div>
            )}

            {/* CONDITIONAL: Guided Food Allowance Summary Card */}
            {expenseType === "Food" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="md:col-span-2 bg-slate-50 border border-slate-200 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
              >
                <div className="flex items-start gap-3">
                  <div className="bg-emerald-50 text-emerald-600 p-3 rounded-xl mt-0.5">
                    <Utensils className="w-6 h-6 text-emerald-650" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">Guided Food Allowance Details</h3>
                    {isFoodValid ? (
                      <div className="text-xs text-slate-600 mt-1 space-y-1">
                        <p>✓ Meal Category: <strong className="text-slate-800">{mealType}</strong></p>
                        <p>✓ Individuals: <strong className="text-slate-850">{numIndividuals} pax</strong> ({individualNames.filter(Boolean).join(", ")})</p>
                        <p>✓ Actual Bill: <strong className="text-slate-850">₹{parseFloat(actualBillAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong></p>
                        <p>✓ Approved Amount: <strong className="text-emerald-600 font-extrabold">₹{amount}</strong></p>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 mt-1 font-semibold text-rose-500">
                        ⚠ No meal type or bill details entered. Please open the configurator.
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFoodModal(true)}
                  className="shrink-0 px-4 py-2.5 bg-slate-900 hover:bg-slate-850 text-white rounded-lg text-xs font-black transition cursor-pointer self-start sm:self-center"
                >
                  {isFoodValid ? "Edit Food Details" : "Configure Food Details"}
                </button>
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
              disabled={
                isLoading || 
                (expenseType === "Petrol" && !isMileageValid) || 
                (expenseType === "Food" && !isFoodValid)
              }
              className="inline-flex items-center gap-2 bg-slate-950 hover:bg-slate-900 text-white font-bold text-sm px-6 py-2.5 rounded-lg shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed"
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

      {/* Pop-up Modals for Petrol and Food Allowance details */}
      {showPetrolModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-150 bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="bg-indigo-50 text-indigo-600 p-2 rounded-xl">
                  <Car className="w-5 h-5 text-indigo-650" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800">Petrol / Mileage Configurator</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                    Fixed Rates: 2 Wheeler (₹3.25/km) • 4 Wheeler (₹8.50/km)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPetrolModal(false)}
                className="text-slate-400 hover:text-slate-650 p-1.5 rounded-lg hover:bg-slate-150/80 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 overflow-y-auto">
              {/* Step 1: Select Vehicle Type */}
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  Step 1: Select Vehicle Type <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { type: "2 Wheeler", label: "2 Wheeler (₹3.25/km)", rate: 3.25 },
                    { type: "4 Wheeler", label: "4 Wheeler (₹8.50/km)", rate: 8.50 },
                  ].map((vehicle) => {
                    const isSelected = vehicleType === vehicle.type;
                    return (
                      <button
                        key={vehicle.type}
                        type="button"
                        onClick={() => setVehicleType(vehicle.type as any)}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all cursor-pointer ${
                          isSelected
                            ? "bg-slate-900 border-slate-900 text-white shadow-xs"
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-55"
                        }`}
                      >
                        <Car className={`w-4 h-4 mb-1 ${isSelected ? "text-white" : "text-slate-400"}`} />
                        <span className="text-[11px] font-bold">{vehicle.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {vehicleType && (
                <>
                  {/* Step 2 & 3: Route Locations */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                        Step 2: Traveling From Location <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                          <MapPin className="w-3.5 h-3.5" />
                        </span>
                        <input
                          type="text"
                          required
                          placeholder="Starting point city or address..."
                          value={fromLocation}
                          onChange={(e) => setFromLocation(e.target.value)}
                          className="w-full pl-8 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-755 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-950 h-9"
                          autoComplete="off"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                        Step 3: Traveling To Location <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                          <MapPin className="w-3.5 h-3.5" />
                        </span>
                        <input
                          type="text"
                          required
                          placeholder="Ending point city or address..."
                          value={toLocation}
                          onChange={(e) => setToLocation(e.target.value)}
                          className="w-full pl-8 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-755 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-950 h-9"
                          autoComplete="off"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Step 4: Distance input in KM */}
                  <div className="space-y-2 pt-1 max-w-xs">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                      Step 4: Traveling Distance (Kilometers) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 font-bold text-[10px] pointer-events-none font-mono">
                        KM
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        placeholder="e.g. 12.5"
                        value={distanceKm}
                        onChange={(e) => setDistanceKm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-755 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-950 h-9"
                      />
                    </div>
                  </div>

                  {/* Cost Calculations */}
                  {isMileageValid && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-2 space-y-2">
                      <div className="flex items-center gap-1.5">
                        <Info className="w-4 h-4 text-slate-500 shrink-0" />
                        <span className="text-[11px] font-bold text-slate-700">Mileage Reimbursement Calculation</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-[10.5px] font-sans">
                        <div>
                          <span className="block text-[8.5px] text-slate-400 font-bold uppercase tracking-wider">Vehicle Selected</span>
                          <span className="font-bold text-slate-700">{vehicleType}</span>
                        </div>
                        <div>
                          <span className="block text-[8.5px] text-slate-400 font-bold uppercase tracking-wider">Fixed Rate / KM</span>
                          <span className="font-bold text-slate-700">₹{(vehicleType === "2 Wheeler" ? 3.25 : 8.50).toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="block text-[8.5px] text-slate-400 font-bold uppercase tracking-wider">Distance Entered</span>
                          <span className="font-bold text-slate-700">{parseFloat(distanceKm).toFixed(2)} km</span>
                        </div>
                        <div>
                          <span className="block text-[8.5px] text-slate-400 font-bold uppercase tracking-wider">Total Approved Amount</span>
                          <span className="font-black text-indigo-650 font-extrabold">
                            ₹{(parseFloat(distanceKm) * (vehicleType === "2 Wheeler" ? 3.25 : 8.50)).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-150 bg-slate-50">
              <button
                type="button"
                onClick={() => {
                  setShowPetrolModal(false);
                }}
                className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-650 rounded-lg transition cursor-pointer"
              >
                Close & Keep
              </button>
              <button
                type="button"
                disabled={!isMileageValid}
                onClick={() => setShowPetrolModal(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-black rounded-lg transition flex items-center gap-1.5 cursor-pointer"
              >
                ✓ Confirm Details
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {showFoodModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-150 bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="bg-emerald-50 text-emerald-600 p-2 rounded-xl">
                  <Utensils className="w-5 h-5 text-emerald-650" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800">Guided Food Allowance Configurator</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                    Allowances: Breakfast (₹80) • Lunch (₹200) • Dinner (₹200)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowFoodModal(false)}
                className="text-slate-400 hover:text-slate-650 p-1.5 rounded-lg hover:bg-slate-150/80 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 overflow-y-auto">
              {/* Step 1: Select Meal Type */}
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  Step 1: Select Meal Type <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { type: "Breakfast", rate: 80, label: "Breakfast (₹80)", icon: Coffee },
                    { type: "Lunch", rate: 200, label: "Lunch (₹200)", icon: Utensils },
                    { type: "Dinner", rate: 200, label: "Dinner (₹200)", icon: Utensils },
                  ].map((meal) => {
                    const MealIcon = meal.icon;
                    const isSelected = mealType === meal.type;
                    return (
                      <button
                        key={meal.type}
                        type="button"
                        onClick={() => setMealType(meal.type as any)}
                        className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                          isSelected
                            ? "bg-slate-900 border-slate-900 text-white shadow-xs"
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-55"
                        }`}
                      >
                        <MealIcon className={`w-4 h-4 mb-1 ${isSelected ? "text-white" : "text-slate-400"}`} />
                        <span className="text-[10px] font-bold">{meal.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {mealType && (
                <>
                  {/* Step 2 & 3: Number of Individuals & Actual Bill Amount */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                        Step 2: Number of Individuals <span className="text-red-500">*</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleNumIndividualsChange(numIndividuals - 1)}
                          disabled={numIndividuals <= 1}
                          className="w-9 h-9 flex items-center justify-center border border-slate-200 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-600 font-bold transition disabled:opacity-50"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <input
                          type="number"
                          min="1"
                          required
                          value={numIndividuals}
                          onChange={(e) => handleNumIndividualsChange(parseInt(e.target.value))}
                          className="w-14 h-9 text-center border border-slate-200 bg-slate-50 rounded-xl text-xs font-bold text-slate-700 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-950"
                        />
                        <button
                          type="button"
                          onClick={() => handleNumIndividualsChange(numIndividuals + 1)}
                          className="w-9 h-9 flex items-center justify-center border border-slate-200 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-600 font-bold transition"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                        Step 3: Actual Bill Amount (₹) <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 font-bold text-xs pointer-events-none">
                          ₹
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          required
                          placeholder="Enter exact bill..."
                          value={actualBillAmount}
                          onChange={(e) => setActualBillAmount(e.target.value)}
                          className="w-full pl-7 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-755 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-950 h-9"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Step 4: Individual Names list */}
                  <div className="space-y-2 pt-1">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                      Step 4: Names of Individuals <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[140px] overflow-y-auto p-0.5 border border-slate-100 rounded-lg bg-slate-50/50">
                      {individualNames.map((name, index) => (
                        <div key={index} className="relative">
                          <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-[9px] font-bold text-slate-400 select-none pointer-events-none">
                            {index + 1}.
                          </span>
                          <input
                            type="text"
                            required
                            placeholder={`Individual ${index + 1} name`}
                            value={name}
                            onChange={(e) => {
                              const newNames = [...individualNames];
                              newNames[index] = e.target.value;
                              setIndividualNames(newNames);
                            }}
                            className="w-full pl-7 pr-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-[11px] font-semibold text-slate-750 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-slate-950 h-8"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Calculated Summary */}
                  {isFoodValid && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-2 space-y-2.5">
                      <div className="flex items-center gap-1.5">
                        <Info className="w-4 h-4 text-slate-500 shrink-0" />
                        <span className="text-[11px] font-bold text-slate-700">Calculated Food Summary</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10.5px] font-sans">
                        <div>
                          <span className="block text-[8.5px] text-slate-400 font-bold uppercase tracking-wider">Meal Rate Limit</span>
                          <span className="font-bold text-slate-700">₹{(mealType === "Breakfast" ? 80 : 200).toFixed(2)}/person</span>
                        </div>
                        <div>
                          <span className="block text-[8.5px] text-slate-400 font-bold uppercase tracking-wider">Total Limit</span>
                          <span className="font-bold text-slate-700">₹{((mealType === "Breakfast" ? 80 : 200) * numIndividuals).toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="block text-[8.5px] text-slate-400 font-bold uppercase tracking-wider">Your Bill Amount</span>
                          <span className="font-bold text-slate-700">₹{parseFloat(actualBillAmount).toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="block text-[8.5px] text-slate-400 font-bold uppercase tracking-wider">Approved Amount</span>
                          <span className="font-black text-emerald-600 font-extrabold">
                            ₹{Math.min((mealType === "Breakfast" ? 80 : 200) * numIndividuals, parseFloat(actualBillAmount)).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {parseFloat(actualBillAmount) > (mealType === "Breakfast" ? 80 : 200) * numIndividuals && (
                        <div className="bg-amber-50 border border-amber-100 rounded-lg p-2 text-[9.5px] text-amber-850 flex items-start gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
                          <p className="font-medium leading-relaxed">
                            Note: Exceeds the max food allowance of ₹{((mealType === "Breakfast" ? 80 : 200) * numIndividuals).toFixed(2)}. Reimbursement is automatically capped at the threshold.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-150 bg-slate-50">
              <button
                type="button"
                onClick={() => {
                  setShowFoodModal(false);
                }}
                className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-650 rounded-lg transition cursor-pointer"
              >
                Close & Keep
              </button>
              <button
                type="button"
                disabled={!isFoodValid}
                onClick={() => setShowFoodModal(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-black rounded-lg transition flex items-center gap-1.5 cursor-pointer"
              >
                ✓ Confirm Details
              </button>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
};
