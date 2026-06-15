export type UserRole = "admin" | "employee" | "accounts";

export interface UserProfile {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface ApprovalHistoryItem {
  role: string;
  action: string;
  actor_id: string;
  actor_name: string;
  timestamp: string;
  remarks?: string;
}

export interface Expense {
  id: string;
  employee_id: string;
  expense_type: string;
  custom_type?: string;
  amount: number;
  expense_date: string;
  notes?: string;
  proof_url?: string;
  is_archived: boolean;
  archive_id?: string;
  created_at: string;
  updated_at: string;
  
  // Workflow fields
  workflow_status: "Pending Accounts Approval" | "Approved by Accounts" | "Rejected by Accounts" | "Approved by Admin" | "Rejected by Admin";
  accounts_status: "pending" | "approved" | "rejected";
  accounts_approved_by?: string;
  accounts_approved_at?: string;
  accounts_remarks?: string;
  
  admin_status: "pending" | "approved" | "rejected";
  admin_approved_by?: string;
  admin_approved_at?: string;
  admin_remarks?: string;
  
  approval_history: ApprovalHistoryItem[];
  
  // Meta inputs
  expense_nature: "Reimbursement" | "Vendor Payment" | "Purchase";
  gst_type: "GST Bill" | "Non-GST Bill";
  payment_term: 'Pay Today' | 'Within 3 Days' | 'Within 7 Days' | 'End of Week' | 'Month End' | 'Immediate' | 'Custom';
  custom_payment_term?: string;
}

export interface AuthContextType {
  user: any | null; // Supabase user info
  profile: UserProfile | null;
  isLoading: boolean;
  sessionToken: string | null;
  needsBootstrap: boolean;
  refreshProfile: () => Promise<void>;
  checkBootstrapStatus: () => Promise<void>;
  signOut: () => Promise<void>;
}
