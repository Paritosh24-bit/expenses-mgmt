import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize backend Supabase clients
const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// Guard against placeholder strings
const isUrlValid = supabaseUrl && !supabaseUrl.includes("your-project-id") && !supabaseUrl.includes("PLACEHOLDER");
const isAnonKeyValid = supabaseAnonKey && !supabaseAnonKey.includes("your-anon-public-key") && !supabaseAnonKey.includes("PLACEHOLDER");
const isServiceKeyValid = supabaseServiceKey && !supabaseServiceKey.includes("your-supabase-service-role-key") && !supabaseServiceKey.includes("PLACEHOLDER") && supabaseServiceKey.length > 40;

// Client-facing Supabase instance (for verification)
const publicSupabase = isUrlValid && isAnonKeyValid ? createClient(supabaseUrl, supabaseAnonKey) : null;

// Administrative Supabase instance (for operations with full server privileges)
const adminSupabase = isUrlValid && isServiceKeyValid 
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

// ==========================================
// RESEND ENGINE & DYNAMIC ADDR ROUTERS
// ==========================================
let resendClient: Resend | null = null;
function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey.trim() === "" || apiKey.includes("PLACEHOLDER")) {
    console.warn("⚠️ [Resend] RESEND_API_KEY is not configured or uses placeholder. Emails will be logged to console instead of dispatched.");
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

async function sendEmail({ to, subject, html }: { to: string | string[], subject: string, html: string }) {
  const from = "Sync AI Consultancy <noreply@syncaiconsultancy.com>";
  const replyTo = "paritoshbadave@gmail.com";

  const recipients = Array.isArray(to) ? to.filter(Boolean) : [to].filter(Boolean);
  if (recipients.length === 0) {
    console.warn(`⚠️ [Mail Skip] No recipient emails found for subject: "${subject}"`);
    return { success: false, error: "No recipients defined" };
  }

  console.log(`✉️ [Mail Send] From: "${from}", Reply-To: "${replyTo}", To: ${JSON.stringify(recipients)}, Subject: "${subject}"`);

  const resend = getResendClient();
  if (!resend) {
    console.log(`ℹ️ [Resend Local-Only Mode] E-mail text markup:\n${html}`);
    return { success: true, mocked: true };
  }

  try {
    const data = await resend.emails.send({
      from,
      replyTo: replyTo,
      to: recipients,
      subject,
      html
    });
    console.log(`✅ [Resend Success] Email transfer response:`, data);
    return { success: true, data };
  } catch (err: any) {
    console.error(`❌ [Resend Error] Failed to send email via client:`, err.message || err);
    return { success: false, error: err.message || err };
  }
}

// System Dynamic Lookup routers
async function getAdminEmails(): Promise<string[]> {
  if (!adminSupabase) return ["admin@aconsultancy.com"];
  try {
    const { data, error } = await adminSupabase
      .from("user_profiles")
      .select("email")
      .eq("role", "admin")
      .eq("is_active", true);

    if (error || !data) {
      console.error("❌ database inquiry error fetching Admin details:", error?.message);
      return ["admin@aconsultancy.com"];
    }

    const emails = data.map((x: any) => x.email).filter(Boolean);
    return emails.length > 0 ? emails : ["admin@aconsultancy.com"];
  } catch (e: any) {
    console.error("❌ getAdminEmails Exception:", e.message);
    return ["admin@aconsultancy.com"];
  }
}

async function getAccountsEmails(): Promise<string[]> {
  if (!adminSupabase) return ["paritoshbadave@gmail.com"];
  try {
    const { data, error } = await adminSupabase
      .from("user_profiles")
      .select("email")
      .eq("role", "accounts")
      .eq("is_active", true);

    if (error || !data) {
      console.error("❌ database inquiry error fetching Accounts heads:", error?.message);
      return ["paritoshbadave@gmail.com"];
    }

    const emails = data.map((x: any) => x.email).filter(Boolean);
    return emails.length > 0 ? emails : ["paritoshbadave@gmail.com"];
  } catch (e: any) {
    console.error("❌ getAccountsEmails Exception:", e.message);
    return ["paritoshbadave@gmail.com"];
  }
}

async function getProfileByUserId(userId: string): Promise<any | null> {
  if (!adminSupabase) return null;
  try {
    const { data, error } = await adminSupabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error) {
      console.error(`❌ Failed to fetch user profile for [${userId}]:`, error.message);
      return null;
    }
    return data;
  } catch (e: any) {
    console.error(`❌ getProfileByUserId exception for [${userId}]:`, e.message);
    return null;
  }
}

// In-memory OTP Storage for secure pass recovery
const otpStorage = new Map<string, { otp: string; expiresAt: number }>();

async function getProfileByEmail(email: string): Promise<any | null> {
  if (!adminSupabase) return null;
  try {
    const { data, error } = await adminSupabase
      .from("user_profiles")
      .select("*")
      .eq("email", email.trim().toLowerCase())
      .eq("is_active", true)
      .single();

    if (error) {
      console.error(`❌ Failed to fetch user profile for email [${email}]:`, error.message);
      return null;
    }
    return data;
  } catch (e: any) {
    console.error(`❌ getProfileByEmail exception for [${email}]:`, e.message);
    return null;
  }
}

// Auth: Dispatch OTP reset code
app.post("/api/auth/forgot-password-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Please key in your registered email address." });
    }

    const profile = await getProfileByEmail(email);
    if (!profile) {
      return res.status(404).json({ error: "No active accounts registered under this email address." });
    }

    // Generate 6 digit pin code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes from now

    otpStorage.set(email.trim().toLowerCase(), { otp, expiresAt });

    const subject = "Your Secure Password Reset OTP Verification Code";
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); text-align: center;">
        <h2 style="color: #0f172a; margin-top: 0; font-size: 22px; font-weight: bold;">Password Reset Verification</h2>
        <p style="color: #475569; font-size: 14px; line-height: 1.5; margin-bottom: 25px;">Hello ${profile.name},</p>
        <p style="color: #475569; font-size: 14px; line-height: 1.5; margin-bottom: 25px;">We received a request to override your credentials. Please input the following single-use verification code into your dashboard to authenticate the request:</p>
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; font-family: 'Courier New', monospace; font-size: 32px; font-weight: bold; padding: 15px 30px; letter-spacing: 6px; color: #0f172a; border-radius: 8px; display: inline-block; margin-bottom: 25px;">
          ${otp}
        </div>
        <p style="color: #ef4444; font-size: 12px; font-weight: 500; margin-top: 0;">This verification code is strictly valid for 10 minutes. Do not share this OTP code with anyone.</p>
      </div>
    `;

    console.log(`🔑 [OTP Dispatch] Generated OTP ${otp} for ${profile.email}`);
    await sendEmail({ to: profile.email, subject, html });

    return res.status(200).json({ success: true, message: "A secure verification code has been dispatched to your email." });
  } catch (err: any) {
    return res.status(500).json({ error: "Server error: " + err.message });
  }
});

// Auth: Verify OTP and override password
app.post("/api/auth/reset-password-otp", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: "Missing required parameters (email, otp, newPassword)." });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long." });
    }

    const key = email.trim().toLowerCase();
    const record = otpStorage.get(key);

    if (!record) {
      return res.status(400).json({ error: "No active verification requests exist for this email address. Please request a new code." });
    }

    if (record.otp !== otp.trim()) {
      return res.status(400).json({ error: "Invalid verification code. Please inspect the code and try again." });
    }

    if (Date.now() > record.expiresAt) {
      otpStorage.delete(key);
      return res.status(400).json({ error: "The verification code has expired. Please request a new code." });
    }

    const profile = await getProfileByEmail(email);
    if (!profile) {
      return res.status(404).json({ error: "User profile record was not located." });
    }

    if (!adminSupabase) {
      return res.status(500).json({ error: "Administrative database connection is unavailable." });
    }

    // Direct password update using service role
    const { error: authErr } = await adminSupabase.auth.admin.updateUserById(profile.user_id, {
      password: newPassword
    });

    if (authErr) {
      return res.status(500).json({ error: "Authentication system failed to update credentials: " + authErr.message });
    }

    otpStorage.delete(key);

    // Notify of successful reset
    const subject = "Your Password Credentials Have Been Updated Successfully";
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
        <h2 style="color: #166534; border-bottom: 2px solid #f1f5f9; padding-bottom: 12px; margin-top: 0;">Password Reset Completed 🎉</h2>
        <p style="color: #334155; font-size: 14px; line-height: 1.5;">Hello ${profile.name},</p>
        <p style="color: #334155; font-size: 14px; line-height: 1.5;">Your account password has been successfully reset using the secure OTP email verification code process. You can now log in using your new credentials.</p>
        <p style="color: #64748b; font-size: 12px; margin-top: 25px;">If you did not initiate this change, please contact your administrative or security helpdesk immediately.</p>
      </div>
    `;

    await sendEmail({ to: profile.email, subject, html }).catch((mailErr) => {
      console.error("⚠️ Failed to dispatch secure update notification:", mailErr);
    });

    return res.status(200).json({ success: true, message: "Your password has been successfully updated. Please log in with your updated credentials." });
  } catch (err: any) {
    return res.status(500).json({ error: "Server error: " + err.message });
  }
});

// Middleware to verify if the requesting user is an authenticated Admin
async function requireAdmin(req: any, res: any, next: any) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid authorization token" });
    }

    const token = authHeader.split(" ")[1];
    
    if (!publicSupabase) {
      return res.status(500).json({ error: "Database configuration error: Supabase client is not initialized. Please verify your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY inside the application environment." });
    }

    // 1. Verify token with Supabase Auth
    const { data: { user }, error: authError } = await publicSupabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: "Unauthorized: Invalid token" });
    }

    // 2. Query user_profiles to verify they are active and have 'admin' role
    // We always query using a token-based client for current user to avoid failing on Service Role placeholder issues
    const tokenClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    });

    const { data: profile, error: dbError } = await tokenClient
      .from("user_profiles")
      .select("role, is_active")
      .eq("user_id", user.id)
      .single();

    if (dbError || !profile) {
      return res.status(403).json({ error: "Forbidden: User profile not found on the server." });
    }

    if (!profile.is_active) {
      return res.status(403).json({ error: "Forbidden: Your account has been disabled" });
    }

    if (profile.role !== "admin") {
      return res.status(403).json({ error: "Forbidden: User is not an admin" });
    }

    // Attach verified user and admin metadata to the request
    req.user = user;
    next();
  } catch (err: any) {
    return res.status(500).json({ error: "Internal Server Error: " + err.message });
  }
}

// Middleware to verify if the requesting user is an authenticated Admin or Accounts Head
async function requireAccountsOrAdmin(req: any, res: any, next: any) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid authorization token" });
    }

    const token = authHeader.split(" ")[1];
    
    if (!publicSupabase) {
      return res.status(500).json({ error: "Database configuration error: Supabase client is not initialized" });
    }

    // 1. Verify token with Supabase Auth
    const { data: { user }, error: authError } = await publicSupabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: "Unauthorized: Invalid token" });
    }

    // 2. Query user_profiles to verify they are active and have 'accounts' or 'admin' role
    const tokenClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    });

    const { data: profile, error: dbError } = await tokenClient
      .from("user_profiles")
      .select("role, is_active, name")
      .eq("user_id", user.id)
      .single();

    if (dbError || !profile) {
      return res.status(403).json({ error: "Forbidden: User profile not found on the server." });
    }

    if (!profile.is_active) {
      return res.status(403).json({ error: "Forbidden: Your account has been disabled" });
    }

    if (profile.role !== "accounts" && profile.role !== "admin") {
      return res.status(403).json({ error: "Forbidden: User must be Accounts Head or Admin" });
    }

    // Attach verified user and profile metadata to the request
    req.user = user;
    req.userProfile = profile;
    next();
  } catch (err: any) {
    return res.status(500).json({ error: "Internal Server Error: " + err.message });
  }
}

// Middleware to verify if the requesting user is authenticated generally
async function requireUser(req: any, res: any, next: any) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid authorization token" });
    }

    const token = authHeader.split(" ")[1];
    
    if (!publicSupabase) {
      return res.status(500).json({ error: "Database configuration error: Supabase client is not initialized" });
    }

    const { data: { user }, error: authError } = await publicSupabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: "Unauthorized: Invalid token" });
    }

    const profile = await getProfileByUserId(user.id);
    if (!profile) {
      return res.status(403).json({ error: "Forbidden: No registered database profile found for this user." });
    }

    if (!profile.is_active) {
      return res.status(403).json({ error: "Forbidden: Your account has been disabled" });
    }

    req.user = user;
    req.userProfile = profile;
    next();
  } catch (err: any) {
    return res.status(500).json({ error: "Auth Validation Error: " + err.message });
  }
}

// Secure Endpoint for Employee/Accounts Claims Submission
app.post("/api/expenses/submit", requireUser, async (req: any, res: any) => {
  try {
    if (!adminSupabase) {
      return res.status(500).json({ error: "Supabase service role client is not initialized" });
    }

    const { 
      id, expense_type, custom_type, amount, expense_date, notes, proof_url, 
      expense_nature, gst_type, payment_term, custom_payment_term 
    } = req.body;

    if (!expense_type || amount === undefined || !expense_date) {
      return res.status(400).json({ error: "Missing required fields (expense_type, amount, expense_date)" });
    }

    const profile = req.userProfile;
    const isAccountsUser = profile.role === "accounts";
    const timestamp = new Date().toISOString();

    // Initial approval history
    const initialHistory = [{
      role: isAccountsUser ? "accounts" : "employee",
      action: "create",
      actor_id: req.user.id,
      actor_name: profile.name || req.user.email || "Employee",
      timestamp,
      remarks: isAccountsUser ? "Claim entered by Accounts Head (Elevated directly to Admin)" : "Claim submitted"
    }];

    // Determine workflow metrics based on role
    const workflow_status = isAccountsUser ? "Approved by Accounts" : "Pending Accounts Approval";
    const accounts_status = isAccountsUser ? "approved" : "pending";
    const accounts_approved_by = isAccountsUser ? req.user.id : null;
    const accounts_approved_at = isAccountsUser ? timestamp : null;
    const accounts_remarks = isAccountsUser ? "Claim entered by Accounts Head" : null;

    const expenseObj = {
      id: id || undefined,
      employee_id: req.user.id,
      expense_type,
      custom_type: expense_type === "Other" ? custom_type : null,
      amount: parseFloat(amount),
      expense_date,
      notes: notes || null,
      proof_url: proof_url || null,
      is_archived: false,
      archive_id: null,
      
      workflow_status,
      accounts_status,
      accounts_approved_by,
      accounts_approved_at,
      accounts_remarks,

      admin_status: "pending",
      admin_approved_by: null,
      admin_approved_at: null,
      admin_remarks: null,
      approval_history: initialHistory,
      
      expense_nature: expense_nature || "Reimbursement",
      gst_type: gst_type || "Non-GST Bill",
      payment_term: payment_term || "Immediate",
      custom_payment_term: payment_term === "Custom" ? custom_payment_term : null
    };

    const { data: insertedData, error: insertErr } = await adminSupabase
      .from("expenses")
      .insert(expenseObj)
      .select()
      .single();

    if (insertErr) {
      console.error("❌ Database error inserting claim:", insertErr.message);
      return res.status(500).json({ error: "Constraint or Database insert failure: " + insertErr.message });
    }

    // DISPATCH WORKFLOW EMAILS:
    const formattedAmount = Number(amount);
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const baseUrl = `${protocol}://${req.get('host')}`;
    const loginUrl = `${baseUrl}/login`;
    
    if (isAccountsUser) {
      // SPECIAL WORKFLOW: ACCOUNTS HEAD SUBMITS A CLAIM
      const admins = await getAdminEmails();
      const subject = "Expense Claim Submitted by Accounts Head - Admin Review Required";
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
          <h2 style="color: #4f46e5; border-bottom: 2px solid #f1f5f9; padding-bottom: 12px; margin-top: 0;">Expense Claim Submitted by Accounts Head</h2>
          <p style="color: #334155; font-size: 14px; line-height: 1.5;">An expense claim has been filed directly by the Accounts Head. This claim has automatically bypassed the Accounts audit state and is now routed to you for review.</p>
          <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px;">
            <tr>
              <td style="padding: 10px 0; font-weight: bold; color: #475569; width: 40%; border-bottom: 1px solid #f1f5f9;">Claimant Name:</td>
              <td style="padding: 10px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${profile.name} (Accounts Head)</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; font-weight: bold; color: #475569; border-bottom: 1px solid #f1f5f9;">Claimant Email:</td>
              <td style="padding: 10px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${profile.email}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; font-weight: bold; color: #475569; border-bottom: 1px solid #f1f5f9;">Category:</td>
              <td style="padding: 10px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${expense_type}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; font-weight: bold; color: #475569; border-bottom: 1px solid #f1f5f9;">Claim Type:</td>
              <td style="padding: 10px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${expense_nature || 'Reimbursement'}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; font-weight: bold; color: #475569; border-bottom: 1px solid #f1f5f9;">Amount:</td>
              <td style="padding: 10px 0; font-weight: bold; color: #0f172a; border-bottom: 1px solid #f1f5f9; font-size: 16px;">₹${formattedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; font-weight: bold; color: #475569; border-bottom: 1px solid #f1f5f9;">Date:</td>
              <td style="padding: 10px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${expense_date}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; font-weight: bold; color: #475569; border-bottom: 1px solid #f1f5f9;">Description:</td>
              <td style="padding: 10px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${notes || 'No description provided'}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; font-weight: bold; color: #475569; border-bottom: 1px solid #f1f5f9;">Proof / Receipt:</td>
              <td style="padding: 10px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${proof_url ? `<a href="${proof_url}" target="_blank" style="color: #4f46e5; text-decoration: underline; font-weight: bold;">View Attachment</a>` : 'No proof attached'}</td>
            </tr>
          </table>
          <div style="margin-top: 30px; text-align: center;">
            <a href="${loginUrl}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">Review in Admin Panel</a>
          </div>
        </div>
      `;
      sendEmail({ to: admins, subject, html }).catch(err => {
        console.error("⚠️ Background email dispatch failed:", err);
      });

    } else {
      // WORKFLOW 1: EMPLOYEE SUBMITS EXPENSE CLAIM
      const accounts = await getAccountsEmails();
      const subject = "New Expense Claim Submitted";
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
          <h2 style="color: #1e1b4b; border-bottom: 2px solid #f1f5f9; padding-bottom: 12px; margin-top: 0;">New Expense Claim Submitted</h2>
          <p style="color: #334155; font-size: 14px; line-height: 1.5;">A new employee expense claim has been submitted and is awaiting your accounts desk audit approval.</p>
          <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px;">
            <tr>
              <td style="padding: 10px 0; font-weight: bold; color: #475569; width: 40%; border-bottom: 1px solid #f1f5f9;">Employee Name:</td>
              <td style="padding: 10px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${profile.name}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; font-weight: bold; color: #475569; border-bottom: 1px solid #f1f5f9;">Employee Email:</td>
              <td style="padding: 10px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${profile.email}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; font-weight: bold; color: #475569; border-bottom: 1px solid #f1f5f9;">Category:</td>
              <td style="padding: 10px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${expense_type}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; font-weight: bold; color: #475569; border-bottom: 1px solid #f1f5f9;">Claim Type:</td>
              <td style="padding: 10px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${expense_nature || 'Reimbursement'}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; font-weight: bold; color: #475569; border-bottom: 1px solid #f1f5f9;">Amount:</td>
              <td style="padding: 10px 0; font-weight: bold; color: #0f172a; border-bottom: 1px solid #f1f5f9; font-size: 16px;">₹${formattedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; font-weight: bold; color: #475569; border-bottom: 1px solid #f1f5f9;">Date:</td>
              <td style="padding: 10px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${expense_date}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; font-weight: bold; color: #475569; border-bottom: 1px solid #f1f5f9;">Description:</td>
              <td style="padding: 10px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${notes || 'No description provided'}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; font-weight: bold; color: #475569; border-bottom: 1px solid #f1f5f9;">Attachment/Receipt:</td>
              <td style="padding: 10px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${proof_url ? `<a href="${proof_url}" target="_blank" style="color: #4f46e5; text-decoration: underline; font-weight: bold;">View Attachment</a>` : 'No proof attached'}</td>
            </tr>
          </table>
          <div style="margin-top: 30px; text-align: center;">
            <a href="${loginUrl}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">Go to Dashboard</a>
          </div>
        </div>
      `;
      sendEmail({ to: accounts, subject, html }).catch(err => {
        console.error("⚠️ Background email dispatch failed:", err);
      });
    }

    return res.status(200).json({ success: true, data: insertedData });
  } catch (err: any) {
    console.error("❌ Exception submitting expense claim:", err.message);
    return res.status(500).json({ error: "Server submission error: " + err.message });
  }
});

// ==========================================
// PUBLIC API ENDPOINTS
// ==========================================

// Check server status
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    supabaseConfigured: !!supabaseUrl && !!supabaseAnonKey,
    adminPrivilegesReady: !!adminSupabase
  });
});

// Setup Initial Admin Endpoint
// This endpoint only runs if there are absolutely NO profiles in the user_profiles table.
// It serves as a fail-safe bootstrap so the user doesn't get locked out or forced to write raw SQL commands.
app.post("/api/setup/bootstrap-admin", async (req, res) => {
  try {
    if (!adminSupabase) {
      return res.status(500).json({ error: "Supabase service role key is not configured yet" });
    }

    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: "Missing required fields (email, password, name)" });
    }

    // Check if any admin profile already exists
    const { count, error: countError } = await adminSupabase
      .from("user_profiles")
      .select("*", { count: "exact", head: true });

    if (countError) {
      return res.status(500).json({ error: "Database communication failure: " + countError.message });
    }

    // If there's already any accounts, refuse boostrapping
    if (count && count > 0) {
      return res.status(400).json({ error: "System is already initialized. Standard login is required." });
    }

    // 1. Create User in Supabase Auth using admin capabilities (auto confirms email)
    const { data: authUser, error: authErr } = await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name }
    });

    if (authErr || !authUser.user) {
      return res.status(500).json({ error: "Failed to create Admin Auth: " + (authErr?.message || "Unknown error") });
    }

    // 2. Create User Profile
    const { error: profileErr } = await adminSupabase
      .from("user_profiles")
      .insert({
        user_id: authUser.user.id,
        name,
        email,
        role: "admin",
        is_active: true
      });

    if (profileErr) {
      // Cleanup created auth user in case of constraint failure
      await adminSupabase.auth.admin.deleteUser(authUser.user.id);
      return res.status(500).json({ error: "Failed to create Admin Profile: " + profileErr.message });
    }

    return res.status(200).json({ success: true, message: "Bootstrap Admin user created successfully! You can now log in." });
  } catch (err: any) {
    return res.status(500).json({ error: "System Bootstrap Error: " + err.message });
  }
});

// Check if System Needs Bootstrapping
app.get("/api/setup/status", async (req, res) => {
  try {
    if (!adminSupabase) {
      return res.json({ needsBootstrap: false, error: "Service role key missing" });
    }

    const { count, error } = await adminSupabase
      .from("user_profiles")
      .select("*", { count: "exact", head: true });

    if (error) {
      return res.json({ needsBootstrap: true, error: "Database fails to yield counts. Run setup SQL first." });
    }

    return res.json({
      needsBootstrap: count === 0,
      defaultAdmin: {
        email: process.env.DEFAULT_ADMIN_EMAIL || "admin@aconsultancy.com",
        name: process.env.DEFAULT_ADMIN_NAME || "Company Admin",
        password: process.env.DEFAULT_ADMIN_PASSWORD || "123456"
      }
    });
  } catch (err: any) {
    return res.json({ needsBootstrap: false, error: err.message });
  }
});


// ==========================================
// SECURE ADMIN ONLY API ROUTER
// ==========================================

// Add Employee / Admins or Accounts Heads
app.post("/api/admin/create-employee", requireAdmin, async (req: any, res: any) => {
  try {
    const { email, password, name, role } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: "Missing required fields (email, password, name)" });
    }

    const assignedRole = role || "employee";
    if (!["employee", "accounts", "admin"].includes(assignedRole)) {
      return res.status(400).json({ error: "Invalid user role specified" });
    }

    let actualPassword = password;
    if (assignedRole === "admin") {
      actualPassword = "123456"; // Initial password of all admins shd be 123456
    }

    if (!adminSupabase) {
      return res.status(500).json({ error: "Supabase service role client is not initialized" });
    }

    // 1. Create Auth User
    const { data: authUser, error: authErr } = await adminSupabase.auth.admin.createUser({
      email,
      password: actualPassword,
      email_confirm: true,
      user_metadata: { name }
    });

    if (authErr || !authUser.user) {
      return res.status(500).json({ error: "Supabase authentication signup failed: " + (authErr?.message || "No user returned") });
    }

    // 2. Create profile
    const { data: profile, error: profileErr } = await adminSupabase
      .from("user_profiles")
      .insert({
        user_id: authUser.user.id,
        name,
        email,
        role: assignedRole,
        is_active: true,
        created_by: req.user.id
      })
      .select()
      .single();

    if (profileErr) {
      // Rollback Auth user creation if database insert fails
      await adminSupabase.auth.admin.deleteUser(authUser.user.id);
      return res.status(500).json({ error: "Database error during profile insertion: " + profileErr.message });
    }

    return res.status(201).json({ success: true, profile });
  } catch (err: any) {
    return res.status(500).json({ error: "Server error: " + err.message });
  }
});

// Delete Employee
app.delete("/api/admin/delete-employee/:userId", requireAdmin, async (req: any, res: any) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ error: "Missing user identity" });
    }

    // Security validation logic for Mutual Admin Deletions
    if (adminSupabase) {
      // 1. Fetch current deleter profile
      const { data: deleterProfile } = await adminSupabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", req.user.id)
        .single();
      
      // 2. Fetch target profile being deleted
      const { data: targetProfile } = await adminSupabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (targetProfile && targetProfile.role === "admin") {
        // "if admin x adds admin y , then admin y shd have the right to remove admin x"
        // Also allow Admin X to delete Admin Y if Admin X added Admin Y
        const wasCreatedByTarget = deleterProfile && deleterProfile.created_by === targetProfile.user_id;
        const wasCreatedByDeleter = targetProfile.created_by === req.user.id;

        if (!wasCreatedByTarget && !wasCreatedByDeleter) {
          return res.status(403).json({
            error: "Security Policy Guard: You are not authorized to delete this Administrator. Mutual Admin Deletion rules state that Admin Y can only remove Admin X if Admin X originally registered Admin Y's account (or vice-versa)."
          });
        }
      }
    }

    const authHeader = req.headers.authorization;
    const token = authHeader ? authHeader.split(" ")[1] : null;

    console.log(`[Delete Employee] Initiating full purge for userId: ${userId}`);

    let expClearErr = null;
    let arcClearErr = null;
    let profileErr = null;

    // 1. Try with adminSupabase (Service Role Client) first, if initialized
    if (adminSupabase) {
      // Clear expenses
      const { error: expErr } = await adminSupabase
        .from("expenses")
        .delete()
        .eq("employee_id", userId);
      if (expErr) expClearErr = expErr;

      // Clear archives
      const { error: arcErr } = await adminSupabase
        .from("expense_archives")
        .delete()
        .eq("employee_id", userId);
      if (arcErr) arcClearErr = arcErr;

      // Clear profile
      const { error: profErr } = await adminSupabase
        .from("user_profiles")
        .delete()
        .eq("user_id", userId);
      if (profErr) profileErr = profErr;
    }

    // 2. Fallback to Admin's personal Token Session client if service role was null or if database deletions had errors
    if ((!adminSupabase || expClearErr || arcClearErr || profileErr) && token) {
      console.log("[Delete Employee] Using personal token-session fallback client for schema cleanup due to service client limits.");
      const fallbackClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      });

      // Retry database deletions
      if (expClearErr || !adminSupabase) {
        const { error: expErr } = await fallbackClient
          .from("expenses")
          .delete()
          .eq("employee_id", userId);
        if (!expErr) expClearErr = null; // Cleared on retry
        else expClearErr = expErr;
      }

      if (arcClearErr || !adminSupabase) {
        const { error: arcErr } = await fallbackClient
          .from("expense_archives")
          .delete()
          .eq("employee_id", userId);
        if (!arcErr) arcClearErr = null; // Cleared on retry
        else arcClearErr = arcErr;
      }

      if (profileErr || !adminSupabase) {
        const { error: profErr } = await fallbackClient
          .from("user_profiles")
          .delete()
          .eq("user_id", userId);
        if (!profErr) profileErr = null; // Cleared on retry
        else profileErr = profErr;
      }
    }

    // 3. Evaluate results of database purges. If profiles couldn't be purged, we return a clear database block error
    if (profileErr) {
      return res.status(500).json({ 
        error: `Database profile deletion blocked: ${profileErr.message}. Ensure there are no foreign-key locks in your Supabase database instance.` 
      });
    }

    // 4. Finally, notify auth user deletion if service role is ready
    let authErrMessage = null;
    if (adminSupabase) {
      try {
        const { error: authErr } = await adminSupabase.auth.admin.deleteUser(userId);
        if (authErr) {
          authErrMessage = authErr.message;
          console.warn(`[Delete Employee] Auth User delete warning (might have already been deleted from auth table): ${authErr.message}`);
        }
      } catch (e: any) {
        authErrMessage = e.message || e;
        console.warn(`[Delete Employee] Exception during Auth User delete: ${authErrMessage}`);
      }
    } else {
      authErrMessage = "Admin service role client (SUPABASE_SERVICE_ROLE_KEY) not configured. Unable to delete login session from Auth tables (database records were purged successfully).";
    }

    return res.status(200).json({ 
      success: true, 
      message: "Employee records and database profiles have been completely purged from the system.",
      authWarning: authErrMessage
    });
  } catch (err: any) {
    console.error(`[Delete Employee] Fatal server error:`, err);
    return res.status(500).json({ error: "Server error during purge operation: " + err.message });
  }
});

// Toggle Active State (Disable/Enable Employee)
app.post("/api/admin/toggle-active", requireAdmin, async (req, res) => {
  try {
    const { userId, isActive } = req.body;
    if (!userId || typeof isActive !== "boolean") {
      return res.status(400).json({ error: "Missing required fields (userId, isActive)" });
    }

    if (!adminSupabase) {
      return res.status(500).json({ error: "Supabase service role client is not initialized" });
    }

    // 1. Update user_profiles representation
    const { data: updatedProfile, error: profileErr } = await adminSupabase
      .from("user_profiles")
      .update({ is_active: isActive })
      .eq("user_id", userId)
      .select()
      .single();

    if (profileErr) {
      return res.status(500).json({ error: "Database error: " + profileErr.message });
    }

    // 2. Call auth.admin function to sync status or terminate their session
    // Supabase Auth doesn't have a direct "disable user" flag, but setting ban_duration to high value locks the user out!
    // If isActive is false, ban user. Else, lift ban.
    if (!isActive) {
      // Ban for 10 years (87600 hours)
      await adminSupabase.auth.admin.updateUserById(userId, { ban_duration: "87600h" });
    } else {
      // Set to "none" to lift the ban
      await adminSupabase.auth.admin.updateUserById(userId, { ban_duration: "none" });
    }

    return res.status(200).json({ success: true, profile: updatedProfile });
  } catch (err: any) {
    return res.status(500).json({ error: "Server error: " + err.message });
  }
});

// Reset Employee Password
app.post("/api/admin/reset-password", requireAdmin, async (req, res) => {
  try {
    const { userId, newPassword } = req.body;
    if (!userId || !newPassword) {
      return res.status(400).json({ error: "Missing user identity or password payload" });
    }

    if (!adminSupabase) {
      return res.status(500).json({ error: "Supabase service role client is not initialized" });
    }

    // Administrative update of employee password directly
    const { error: authErr } = await adminSupabase.auth.admin.updateUserById(userId, {
      password: newPassword
    });

    if (authErr) {
      return res.status(500).json({ error: "Failed to reset password: " + authErr.message });
    }

    return res.status(200).json({ success: true, message: "Password updated successfully by Administrator." });
  } catch (err: any) {
    return res.status(500).json({ error: "Server error: " + err.message });
  }
});

// Bulk Reset & Archive all employees' expenses (Sets all active totals of all employees to zero)
app.post("/api/admin/archive-reset-all", requireAdmin, async (req: any, res: any) => {
  try {
    if (!adminSupabase) {
      return res.status(500).json({ error: "Supabase service role client is not initialized" });
    }

    const { archiveName } = req.body;
    const now = new Date();
    const defaultName = `Reset All - ${now.toLocaleString("default", { month: "long" })} ${now.getFullYear()}`;
    const name = (archiveName || defaultName).trim();

    // 1. Fetch all active (unarchived) expenses
    const { data: activeExpenses, error: fetchErr } = await adminSupabase
      .from("expenses")
      .select("*")
      .eq("is_archived", false);

    if (fetchErr) {
      return res.status(500).json({ error: "Failed to fetch active expenses: " + fetchErr.message });
    }

    if (!activeExpenses || activeExpenses.length === 0) {
      return res.status(400).json({ error: "There are currently no active, unarchived expense claims in the system." });
    }

    // 2. Group expenses by employee_id
    const empGroups: { [empId: string]: any[] } = {};
    activeExpenses.forEach((exp: any) => {
      if (!empGroups[exp.employee_id]) {
        empGroups[exp.employee_id] = [];
      }
      empGroups[exp.employee_id].push(exp);
    });

    const archiveMonthValue = now.getMonth() + 1; // 1-12
    const archiveYearValue = now.getFullYear();

    // 3. Process each employee group: create archive and link expenses (uses Service Role to bypass RLS)
    const results = [];
    for (const employeeId of Object.keys(empGroups)) {
      const groupExps = empGroups[employeeId];
      const sum = Math.round(groupExps.reduce((s: number, e: any) => s + parseFloat(e.amount || 0), 0) * 100) / 100;

      // Create archive record
      const { data: newArchive, error: archError } = await adminSupabase
        .from("expense_archives")
        .insert({
          employee_id: employeeId,
          archive_month: archiveMonthValue,
          archive_year: archiveYearValue,
          archive_name: name,
          total_amount: sum,
          created_by: req.user.id
        })
        .select()
        .single();

      if (archError) {
        throw new Error(`Failed to create archive slot for employee ${employeeId}: ${archError.message}`);
      }

      // Update expenses
      const expIds = groupExps.map((e: any) => e.id);
      const { error: updateError } = await adminSupabase
        .from("expenses")
        .update({
          is_archived: true,
          archive_id: newArchive.id
        })
        .in("id", expIds);

      if (updateError) {
        // Rollback created archive entry
        await adminSupabase.from("expense_archives").delete().eq("id", newArchive.id);
        throw new Error(`Failed to update expenses for employee ${employeeId}: ${updateError.message}`);
      }

      results.push({ employeeId, totalArchived: sum, claimCount: expIds.length });
    }

    return res.json({ success: true, processed: results, archiveName: name });
  } catch (err: any) {
    return res.status(500).json({ error: "Server error during bulk reset: " + err.message });
  }
});

// Reseed Employees with the exact 13 requested ones and remove all existing employee entries and their linked expenses.
app.post("/api/admin/reseed-employees", requireAdmin, async (req, res) => {
  try {
    if (!adminSupabase) {
      return res.status(500).json({ error: "Supabase service role client is not initialized" });
    }

    // 1. Fetch all existing employees
    const { data: existingEmployees, error: getErr } = await adminSupabase
      .from("user_profiles")
      .select("user_id, email, name")
      .eq("role", "employee");

    if (getErr) {
      return res.status(500).json({ error: "Failed to fetch existing profiles: " + getErr.message });
    }

    // 2. Explicitly clean child entries (expenses and archives) for all existing employees to avoid referential locks
    if (existingEmployees && existingEmployees.length > 0) {
      const userIds = existingEmployees.map(emp => emp.user_id);

      // Clean expenses first
      const { error: cleanExpsErr } = await adminSupabase
        .from("expenses")
        .delete()
        .in("employee_id", userIds);
      if (cleanExpsErr) {
        console.warn("Reseed warning (clearing expenses):", cleanExpsErr.message);
      }

      // Clean archives second
      const { error: cleanArcsErr } = await adminSupabase
        .from("expense_archives")
        .delete()
        .in("employee_id", userIds);
      if (cleanArcsErr) {
        console.warn("Reseed warning (clearing archives):", cleanArcsErr.message);
      }

      // Clean profiles third
      const { error: cleanProfsErr } = await adminSupabase
        .from("user_profiles")
        .delete()
        .in("user_id", userIds);
      if (cleanProfsErr) {
        console.warn("Reseed warning (clearing profiles):", cleanProfsErr.message);
      }

      // 3. Delete each existing employee from Auth
      for (const emp of existingEmployees) {
        try {
          await adminSupabase.auth.admin.deleteUser(emp.user_id);
        } catch (deleteErr: any) {
          console.error(`Failed to delete Auth User ${emp.email}:`, deleteErr?.message);
        }
      }
    }

    // 3. Perfect clean list of 13 corporate employees
    const corporateEmployees = [
      { name: "Jai Gondkar", email: "gondkar.aconsultancy@gmail.com" },
      { name: "Sahil Deochake", email: "sahil.aconsultancy@gmail.com" },
      { name: "Nishant S. Vavale", email: "nishant8aconsultancy@gmail.com" },
      { name: "Amey", email: "amey@aconsultancy.marketing" },
      { name: "Prasad", email: "prasad@aconsultancy.marketing" },
      { name: "Saurabh Kulkarni", email: "saurabhkulkarniaconsultancy@gmail.com" },
      { name: "Pratiksha Yeole", email: "pratiksha.aconsultancymarketing@gmail.com" },
      { name: "Vijay Devkar", email: "vijaydevkar.aconsultancy@gmail.com" },
      { name: "Sanika Paste", email: "sanikapaste.aconsultancy1@gmail.com" },
      { name: "Krutika Patil", email: "krutikapatil.aconsultancy@gmail.com" },
      { name: "Pranav Nimbre", email: "aconsultancypranav@gmail.com" },
      { name: "Manish Gaikwad", email: "manish1.aconsultancy@gmail.com" },
      { name: "Tejas Dhebe", email: "tejasdhebe.ai@gmail.com" }
    ];

    const seeded: any[] = [];
    const errors: string[] = [];

    // 4. Create the 13 employees
    for (const emp of corporateEmployees) {
      try {
        // Create user in Auth
        const { data: authUser, error: authErr } = await adminSupabase.auth.admin.createUser({
          email: emp.email,
          password: "123456",
          email_confirm: true,
          user_metadata: { name: emp.name }
        });

        if (authErr || !authUser.user) {
          throw new Error(authErr?.message || "Failed to create Auth User record");
        }

        // Create Profile in public.user_profiles
        const { error: profileErr } = await adminSupabase
          .from("user_profiles")
          .insert({
            user_id: authUser.user.id,
            name: emp.name,
            email: emp.email,
            role: "employee",
            is_active: true
          });

        if (profileErr) {
          // Rollback newly created Auth user
          await adminSupabase.auth.admin.deleteUser(authUser.user.id);
          throw new Error("Profile insert failed: " + profileErr.message);
        }

        seeded.push(emp);
      } catch (err: any) {
        errors.push(`${emp.name} (${emp.email}): ${err.message}`);
      }
    }

    if (errors.length > 0 && seeded.length === 0) {
      return res.status(500).json({ error: "Reseeding failed completely.", details: errors });
    }

    return res.status(200).json({
      success: true,
      message: `Successfully cleared registry and seeded ${seeded.length} new corporate employees!`,
      seeded,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Server reseeding error: " + err.message });
  }
});


// ==========================================
// SECURE ACCOUNTS OPERATIONS API ROUTER
// ==========================================

// Get all expenses for Auditor review (using Service Role to bypass RLS)
app.get("/api/accounts/expenses", requireAccountsOrAdmin, async (req, res) => {
  try {
    if (!adminSupabase) {
      return res.status(500).json({ error: "Supabase service role client is not initialized" });
    }
    const { data, error } = await adminSupabase
      .from("expenses")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return res.status(500).json({ error: "Database error: " + error.message });
    }

    return res.json(data || []);
  } catch (err: any) {
    return res.status(500).json({ error: "Server error: " + err.message });
  }
});

// Get all user profiles for client-side matching (using Service Role to bypass RLS)
app.get("/api/accounts/user-profiles", requireAccountsOrAdmin, async (req, res) => {
  try {
    if (!adminSupabase) {
      return res.status(500).json({ error: "Supabase service role client is not initialized" });
    }
    const { data, error } = await adminSupabase
      .from("user_profiles")
      .select("*");

    if (error) {
      return res.status(500).json({ error: "Database error: " + error.message });
    }

    return res.json(data || []);
  } catch (err: any) {
    return res.status(500).json({ error: "Server error: " + err.message });
  }
});

// Update workflow status of a specific outstanding claim
app.post("/api/accounts/process-claim", requireAccountsOrAdmin, async (req: any, res: any) => {
  try {
    if (!adminSupabase) {
      return res.status(500).json({ error: "Supabase service role client is not initialized" });
    }

    const { id, statusArg, remarks } = req.body;
    if (!id || !statusArg) {
      return res.status(400).json({ error: "Missing required fields (id, statusArg)" });
    }

    if (statusArg !== "approved" && statusArg !== "rejected") {
      return res.status(400).json({ error: "Invalid statusArg" });
    }

    // 1. Recover the exact record
    const { data: item, error: fetchErr } = await adminSupabase
      .from("expenses")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchErr || !item) {
      return res.status(404).json({ error: "Claim record not found: " + (fetchErr?.message || "") });
    }

    const workflowStatus = statusArg === "approved" ? "Approved by Accounts" : "Rejected by Accounts";
    const timestamp = new Date().toISOString();

    let currentHistory = item.approval_history;
    if (!currentHistory || !Array.isArray(currentHistory)) {
      currentHistory = [];
    }

    const updatedHistory = [
      ...currentHistory,
      {
        role: "accounts",
        action: statusArg,
        actor_id: req.user.id,
        actor_name: req.userProfile.name || "Accounts Dept",
        timestamp,
        remarks: (remarks || "").trim() || undefined
      }
    ];

    const { error: updateErr } = await adminSupabase
      .from("expenses")
      .update({
        workflow_status: workflowStatus,
        accounts_status: statusArg,
        accounts_approved_by: req.user.id,
        accounts_approved_at: timestamp,
        accounts_remarks: (remarks || "").trim() || null,
        approval_history: updatedHistory
      })
      .eq("id", id);

    if (updateErr) {
      return res.status(500).json({ error: "Failed to update claim record: " + updateErr.message });
    }

    // Trigger Dynamic Resend Email on status completion
    try {
      const claimantProfile = await getProfileByUserId(item.employee_id);
      const claimantName = claimantProfile?.name || "Employee";
      const claimantEmail = claimantProfile?.email;
      const formattedAmount = Number(item.amount || 0);
      
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const baseUrl = `${protocol}://${req.get('host')}`;
      const loginUrl = `${baseUrl}/login`;

      if (statusArg === "approved") {
        // WORKFLOW 2: ACCOUNTS HEAD APPROVES CLAIM
        const admins = await getAdminEmails();
        const subject = "Expense Claim Approved by Accounts Head - Awaiting Admin Review";
        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
            <h2 style="color: #166534; border-bottom: 2px solid #f1f5f9; padding-bottom: 12px; margin-top: 0;">Expense Claim Approved by Accounts Head</h2>
            <p style="color: #334155; font-size: 14px; line-height: 1.5;">An expense claim has been approved by the Accounts Head and is now awaiting final review and clearing by Admin.</p>
            <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px;">
              <tr>
                <td style="padding: 10px 0; font-weight: bold; color: #475569; width: 40%; border-bottom: 1px solid #f1f5f9;">Employee Name:</td>
                <td style="padding: 10px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${claimantName}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; font-weight: bold; color: #475569; border-bottom: 1px solid #f1f5f9;">Employee Email:</td>
                <td style="padding: 10px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${claimantEmail || 'Not available'}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; font-weight: bold; color: #475569; border-bottom: 1px solid #f1f5f9;">Category:</td>
                <td style="padding: 10px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${item.expense_type}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; font-weight: bold; color: #475569; border-bottom: 1px solid #f1f5f9;">Claim Type:</td>
                <td style="padding: 10px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${item.expense_nature || "Reimbursement"}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; font-weight: bold; color: #475569; border-bottom: 1px solid #f1f5f9;">Amount:</td>
                <td style="padding: 10px 0; font-weight: bold; color: #166534; border-bottom: 1px solid #f1f5f9; font-size: 16px;">₹${formattedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; font-weight: bold; color: #475569; border-bottom: 1px solid #f1f5f9;">Date:</td>
                <td style="padding: 10px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${item.expense_date}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; font-weight: bold; color: #475569; border-bottom: 1px solid #f1f5f9;">Description:</td>
                <td style="padding: 10px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${item.notes || 'No description provided'}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; font-weight: bold; color: #475569; border-bottom: 1px solid #f1f5f9;">Accounts Auditor:</td>
                <td style="padding: 10px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${req.userProfile.name} (${req.user.email || req.userProfile.email})</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; font-weight: bold; color: #475569; border-bottom: 1px solid #f1f5f9;">Approval Notes:</td>
                <td style="padding: 10px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${remarks || 'Approved'}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; font-weight: bold; color: #475569; border-bottom: 1px solid #f1f5f9;">Approved At:</td>
                <td style="padding: 10px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${timestamp}</td>
              </tr>
            </table>
            <div style="margin-top: 30px; text-align: center;">
              <a href="${loginUrl}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">Review in Admin Panel</a>
            </div>
          </div>
        `;
        sendEmail({ to: admins, subject, html }).catch(err => {
          console.error("⚠️ Background email dispatch failed (accounts approve admin notify):", err);
        });

        // NOTIFY EMPLOYEE OF ACCOUNTS DESK APPROVAL
        if (claimantEmail) {
          const empSubject = "Expense Claim Accepted by Accounts - Pending Admin Review";
          const empHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
              <h2 style="color: #166534; border-bottom: 2px solid #f1f5f9; padding-bottom: 12px; margin-top: 0;">Expense Claim Accepted by Accounts 🎉</h2>
              <p style="color: #334155; font-size: 14px; line-height: 1.5;">Hello ${claimantName},</p>
              <p style="color: #334155; font-size: 14px; line-height: 1.5;">Your expense claim has been successfully audited and accepted by the Accounts Head. It has been advanced to the Administrative Panel for final review and payout clearance.</p>
              <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px;">
                <tr>
                  <td style="padding: 10px 0; font-weight: bold; color: #475569; width: 40%; border-bottom: 1px solid #f1f5f9;">Category:</td>
                  <td style="padding: 10px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${item.expense_type}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; font-weight: bold; color: #475569; border-bottom: 1px solid #f1f5f9;">Approved Amount:</td>
                  <td style="padding: 10px 0; font-weight: bold; color: #166534; border-bottom: 1px solid #f1f5f9; font-size: 16px;">₹${formattedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; font-weight: bold; color: #475569; border-bottom: 1px solid #f1f5f9;">Date:</td>
                  <td style="padding: 10px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${item.expense_date}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; font-weight: bold; color: #475569; border-bottom: 1px solid #f1f5f9;">Accounts Remarks:</td>
                  <td style="padding: 10px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${remarks || 'No remarks provided'}</td>
                </tr>
              </table>
              <div style="margin-top: 30px; text-align: center;">
                <a href="${loginUrl}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">Go to Dashboard</a>
              </div>
            </div>
          `;
          sendEmail({ to: claimantEmail, subject: empSubject, html: empHtml }).catch(err => {
            console.error("⚠️ Background email dispatch failed (accounts approve emp notify):", err);
          });
        }
      } else {
        // WORKFLOW 3: ACCOUNTS HEAD REJECTS CLAIM
        if (claimantEmail) {
          const subject = "Expense Claim Rejected by Accounts Department";
          const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
              <h2 style="color: #b91c1c; border-bottom: 2px solid #f1f5f9; padding-bottom: 12px; margin-top: 0;">Expense Claim Rejected</h2>
              <p style="color: #334155; font-size: 14px; line-height: 1.5;">Unfortunately, your expense claim has been rejected during the accounts desk audit phase.</p>
              
              <div style="background-color: #fef2f2; border: 1px solid #fca5a5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; font-weight: bold; color: #991b1b; font-size: 14px;">Rejection Reason:</p>
                <p style="margin: 5px 0 0 0; color: #7f1d1d; font-size: 14px; line-height: 1.4;">${remarks || 'No feedback notes provided by accounts auditor.'}</p>
              </div>

              <h3 style="color: #1e1b4b; font-size: 15px; margin-top: 25px; margin-bottom: 10px;">Claim Reference Particulars:</h3>
              <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <tr>
                  <td style="padding: 10px 0; font-weight: bold; color: #475569; width: 40%; border-bottom: 1px solid #f1f5f9;">Expense Category:</td>
                  <td style="padding: 10px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${item.expense_type}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; font-weight: bold; color: #475569; border-bottom: 1px solid #f1f5f9;">Amount:</td>
                  <td style="padding: 10px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9;">₹${formattedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; font-weight: bold; color: #475569; border-bottom: 1px solid #f1f5f9;">Date:</td>
                  <td style="padding: 10px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${item.expense_date}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; font-weight: bold; color: #475569; border-bottom: 1px solid #f1f5f9;">Audited By:</td>
                  <td style="padding: 10px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${req.userProfile.name}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; font-weight: bold; color: #475569; border-bottom: 1px solid #f1f5f9;">Rejection Date:</td>
                  <td style="padding: 10px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${timestamp}</td>
                </tr>
              </table>
              <div style="margin-top: 30px; text-align: center;">
                <a href="${loginUrl}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">Go to Dashboard</a>
              </div>
            </div>
          `;
          sendEmail({ to: claimantEmail, subject, html }).catch(err => {
            console.error("⚠️ Background email dispatch failed (accounts reject):", err);
          });
        }
      }
    } catch (mailErr: any) {
      console.error("⚠️ Background mailing pipeline failed inside process-claim:", mailErr);
    }

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: "Server error: " + err.message });
  }
});

// Update workflow status of a specific outstanding claim by admin
app.post("/api/admin/process-claim", requireAdmin, async (req: any, res: any) => {
  try {
    if (!adminSupabase) {
      return res.status(500).json({ error: "Supabase service role client is not initialized" });
    }

    const { id, statusArg, remarks } = req.body;
    if (!id || !statusArg) {
      return res.status(400).json({ error: "Missing required fields (id, statusArg)" });
    }

    if (statusArg !== "approved" && statusArg !== "rejected") {
      return res.status(400).json({ error: "Invalid statusArg" });
    }

    // Recover record
    const { data: item, error: fetchErr } = await adminSupabase
      .from("expenses")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchErr || !item) {
      return res.status(404).json({ error: "Claim record not found: " + (fetchErr?.message || "") });
    }

    const workflowStatus = statusArg === "approved" ? "Approved by Admin" : "Rejected by Admin";
    const timestamp = new Date().toISOString();

    let currentHistory = item.approval_history;
    if (!currentHistory || !Array.isArray(currentHistory)) {
      currentHistory = [];
    }

    const updatedHistory = [
      ...currentHistory,
      {
        role: "admin",
        action: statusArg,
        actor_id: req.user.id,
        actor_name: req.userProfile.name || "Administrator",
        timestamp,
        remarks: (remarks || "").trim() || undefined
      }
    ];

    const { error: updateErr } = await adminSupabase
      .from("expenses")
      .update({
        workflow_status: workflowStatus,
        admin_status: statusArg,
        admin_approved_by: req.user.id,
        admin_approved_at: timestamp,
        admin_remarks: (remarks || "").trim() || null,
        approval_history: updatedHistory
      })
      .eq("id", id);

    if (updateErr) {
      return res.status(500).json({ error: "Failed to update claim record (Admin): " + updateErr.message });
    }

    // Trigger Resend email back to claimant Employee or Accounts user
    try {
      const claimantProfile = await getProfileByUserId(item.employee_id);
      const claimantEmail = claimantProfile?.email;
      const formattedAmount = Number(item.amount || 0);

      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const baseUrl = `${protocol}://${req.get('host')}`;
      const loginUrl = `${baseUrl}/login`;

      if (claimantEmail) {
        if (statusArg === "approved") {
          // WORKFLOW 4: ADMIN APPROVES CLAIM
          const subject = "Expense Claim Approved";
          const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
              <h2 style="color: #166534; border-bottom: 2px solid #f1f5f9; padding-bottom: 12px; margin-top: 0;">Expense Claim Approved 🎉</h2>
              <p style="color: #334155; font-size: 14px; line-height: 1.5;">Good news! Your expense claim has received final administrative review, verification, and is officially approved for final payouts and accounting processing.</p>
              
              <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px;">
                <tr>
                  <td style="padding: 10px 0; font-weight: bold; color: #475569; width: 40%; border-bottom: 1px solid #f1f5f9;">Category:</td>
                  <td style="padding: 10px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${item.expense_type}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; font-weight: bold; color: #475569; border-bottom: 1px solid #f1f5f9;">Approved Amount:</td>
                  <td style="padding: 10px 0; font-weight: bold; color: #166534; border-bottom: 1px solid #f1f5f9; font-size: 16px;">₹${formattedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; font-weight: bold; color: #475569; border-bottom: 1px solid #f1f5f9;">Expense Date:</td>
                  <td style="padding: 10px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${item.expense_date}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; font-weight: bold; color: #475569; border-bottom: 1px solid #f1f5f9;">Approved By:</td>
                  <td style="padding: 10px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${req.userProfile.name}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; font-weight: bold; color: #475569; border-bottom: 1px solid #f1f5f9;">Approval Notes:</td>
                  <td style="padding: 10px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${remarks || 'Approved'}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; font-weight: bold; color: #475569; border-bottom: 1px solid #f1f5f9;">Cleared Timestamp:</td>
                  <td style="padding: 10px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${timestamp}</td>
                </tr>
              </table>
              <div style="margin-top: 30px; text-align: center;">
                <a href="${loginUrl}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">Go to Dashboard</a>
              </div>
            </div>
          `;
          sendEmail({ to: claimantEmail, subject, html }).catch(err => {
            console.error("⚠️ Background email dispatch failed (admin approve):", err);
          });
        } else {
          // WORKFLOW 5: ADMIN REJECTS CLAIM
          const subject = "Expense Claim Rejected by Admin";
          const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
              <h2 style="color: #b91c1c; border-bottom: 2px solid #f1f5f9; padding-bottom: 12px; margin-top: 0;">Expense Claim Rejected by Admin</h2>
              <p style="color: #334155; font-size: 14px; line-height: 1.5;">Your expense claim has been rejected upon final Admin Review.</p>
              
              <div style="background-color: #fef2f2; border: 1px solid #fca5a5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; font-weight: bold; color: #991b1b; font-size: 14px;">Rejection Reason:</p>
                <p style="margin: 5px 0 0 0; color: #7f1d1d; font-size: 14px; line-height: 1.4;">${remarks || 'No feedback comments provided by administrator.'}</p>
              </div>

              <h3 style="color: #1e1b4b; font-size: 15px; margin-top: 25px; margin-bottom: 10px;">Claim Reference Particulars:</h3>
              <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <tr>
                  <td style="padding: 10px 0; font-weight: bold; color: #475569; width: 40%; border-bottom: 1px solid #f1f5f9;">Category:</td>
                  <td style="padding: 10px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${item.expense_type}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; font-weight: bold; color: #475569; border-bottom: 1px solid #f1f5f9;">Amount:</td>
                  <td style="padding: 10px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9;">₹${formattedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; font-weight: bold; color: #475569; border-bottom: 1px solid #f1f5f9;">Expense Date:</td>
                  <td style="padding: 10px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${item.expense_date}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; font-weight: bold; color: #475569; border-bottom: 1px solid #f1f5f9;">Rejected By:</td>
                  <td style="padding: 10px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${req.userProfile.name}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; font-weight: bold; color: #475569; border-bottom: 1px solid #f1f5f9;">Rejection Date:</td>
                  <td style="padding: 10px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${timestamp}</td>
                </tr>
              </table>
              <div style="margin-top: 30px; text-align: center;">
                <a href="${loginUrl}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">Go to Dashboard</a>
              </div>
            </div>
          `;
          sendEmail({ to: claimantEmail, subject, html }).catch(err => {
            console.error("⚠️ Background email dispatch failed (admin reject):", err);
          });
        }
      }
    } catch (mailErr: any) {
      console.error("⚠️ Background mailing pipeline failed inside Admin process-claim:", mailErr);
    }

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: "Server error: " + err.message });
  }
});


// ==========================================
// AUTO SETUP & BOOTSTRAP AUTO-SEEDERS
// ==========================================

async function ensureDefaultAdminSeeded() {
  if (!adminSupabase) {
    console.log("⚠️ [Auto-Seed] Supabase service client not ready for admin seeding.");
    return;
  }

  const adminsToSeed = [
    { email: "amey@aconsultancy.marketing", name: "Amey Admin" },
    { email: "prasad@aconsultancy.marketing", name: "Prasad Admin" },
    { email: "admin@aconsultancy.com", name: "Aconsultancy Administrator" }
  ];

  for (const adm of adminsToSeed) {
    try {
      // Check if profile already exists
      const { data: existingProfile, error: profileCheckErr } = await adminSupabase
        .from("user_profiles")
        .select("*")
        .eq("email", adm.email)
        .maybeSingle();

      if (profileCheckErr) {
        console.error(`❌ [Auto-Seed] Error inspecting profile for admin ${adm.email}:`, profileCheckErr.message);
        continue;
      }

      if (existingProfile) {
        console.log(`✅ [Auto-Seed] Admin account is already configured in profiles: ${adm.email}`);
        continue;
      }

      console.log(`🚀 [Auto-Seed] Bootstrapping admin workspace credentials for: ${adm.name} (${adm.email})`);

      // 1. Check/create Auth User
      let authUser: any = null;
      const { data: createdAuth, error: authErr } = await adminSupabase.auth.admin.createUser({
        email: adm.email,
        password: "123456", // Initial password of admins shd be 123456
        email_confirm: true,
        user_metadata: { name: adm.name }
      });

      if (authErr) {
        if (authErr.message.includes("already registered") || authErr.message.includes("already exists")) {
          console.log(`ℹ️ [Auto-Seed] Admin ${adm.email} exists in Auth table. Syncing profile...`);
          const { data: { users }, error: listErr } = await adminSupabase.auth.admin.listUsers();
          if (!listErr && users) {
            const found = (users as any[]).find((u: any) => u.email === adm.email);
            if (found) {
              authUser = { user: found };
            }
          }
        } else {
          console.error(`❌ [Auto-Seed] Failed to secure auth session for admin ${adm.email}:`, authErr.message);
          continue;
        }
      } else {
        authUser = createdAuth;
      }

      if (!authUser || !authUser.user) {
        console.error(`❌ [Auto-Seed] Could not resolve admin auth node for ${adm.email}`);
        continue;
      }

      // 2. Insert profile record in user_profiles
      const { error: profileErr } = await adminSupabase
        .from("user_profiles")
        .insert({
          user_id: authUser.user.id,
          name: adm.name,
          email: adm.email,
          role: "admin",
          is_active: true
        });

      if (profileErr) {
        console.error(`❌ [Auto-Seed] Failed to insert profile for admin ${adm.email}:`, profileErr.message);
      } else {
        console.log(`🎉 [Auto-Seed] Successfully initialized public profile for admin: ${adm.email}`);
      }
    } catch (err: any) {
      console.error(`❌ [Auto-Seed] Exception during admin setup for ${adm.email}:`, err.message || err);
    }
  }
}

async function ensureDefaultAccountsSeeded() {
  if (!adminSupabase) {
    console.log("⚠️ [Auto-Seed] Supabase service client not ready for accounts seeding.");
    return;
  }

  // Seeding requested primary accounts heads representing: paritoshbadave@gmail.com & tanvi.aconsultancy@gmail.com
  const accountsHeads = [
    { email: "paritoshbadave@gmail.com", name: "Paritosh Badave" },
    { email: "tanvi.aconsultancy@gmail.com", name: "Tanvi Accounts" },
    { email: "accounts@comp.com", name: "Accounts Head" }
  ];

  for (const acc of accountsHeads) {
    try {
      const { count, error: countError } = await adminSupabase
        .from("user_profiles")
        .select("*", { count: "exact", head: true })
        .eq("email", acc.email);

      if (countError) {
        console.error(`❌ [Auto-Seed] Failed to query user_profiles for index checking of ${acc.email}:`, countError.message);
        continue;
      }

      if (count && count > 0) {
        console.log(`✅ [Auto-Seed] Accounts head already registered in user_profiles: ${acc.email}. Skipping seed.`);
        continue;
      }

      const accountsEmail = acc.email;
      const accountsPassword = "123456"; // Requested password: 123456
      const accountsName = acc.name;

      console.log(`🚀 [Auto-Seed] Bootstrapping Accounts Head account: ${accountsName} (${accountsEmail})`);

      // 1. Create entry in Auth if not registered
      let authUser: any = null;
      const { data: createdAuth, error: authErr } = await adminSupabase.auth.admin.createUser({
        email: accountsEmail,
        password: accountsPassword,
        email_confirm: true,
        user_metadata: { name: accountsName }
      });

      if (authErr) {
        if (authErr.message.includes("already registered") || authErr.message.includes("already exists")) {
          console.log(`ℹ️ [Auto-Seed] Accounts ${accountsEmail} exist in Auth but has no Public Profile record. Syncing ID...`);
          const { data: { users }, error: listErr } = await adminSupabase.auth.admin.listUsers();
          if (!listErr && users) {
            const found = (users as any[]).find((u: any) => u.email === accountsEmail);
            if (found) {
              authUser = { user: found };
            }
          }
        } else {
          console.error(`❌ [Auto-Seed] Failed to create accounts in auth table for ${accountsEmail}:`, authErr.message);
          continue;
        }
      } else {
        authUser = createdAuth;
      }

      if (!authUser || !authUser.user) {
        console.error(`❌ [Auto-Seed] Could not obtain Accounts auth entity for ${accountsEmail}.`);
        continue;
      }

      // 2. Create entry in public.user_profiles
      const { error: profileErr } = await adminSupabase
        .from("user_profiles")
        .insert({
          user_id: authUser.user.id,
          name: accountsName,
          email: accountsEmail,
          role: "accounts",
          is_active: true
        });

      if (profileErr) {
        console.error(`❌ [Auto-Seed] Failed to populate user_profiles for Accounts Head (${accountsEmail}):`, profileErr.message);
      } else {
        console.log(`🎉 [Auto-Seed] Accounts head ${accountsEmail} workspace profile initialized successfully!`);
      }
    } catch (err: any) {
      console.error(`❌ [Auto-Seed] Exception during Accounts Head (${acc.email}) setup:`, err.message || err);
    }
  }
}

async function ensureCorporateEmployeesSeeded() {
  if (!adminSupabase) {
    console.log("⚠️ [Auto-Seed] Supabase service client not ready for staff seeding.");
    return;
  }

  const corporateEmployees = [
    { name: "Jai Gondkar", email: "gondkar.aconsultancy@gmail.com" },
    { name: "Sahil Deochake", email: "sahil.aconsultancy@gmail.com" },
    { name: "Nishant S. Vavale", email: "nishant8aconsultancy@gmail.com" },
    { name: "Amey", email: "amey@aconsultancy.marketing" },
    { name: "Prasad", email: "prasad@aconsultancy.marketing" },
    { name: "Saurabh Kulkarni", email: "saurabhkulkarniaconsultancy@gmail.com" },
    { name: "Pratiksha Yeole", email: "pratiksha.aconsultancymarketing@gmail.com" },
    { name: "Vijay Devkar", email: "vijaydevkar.aconsultancy@gmail.com" },
    { name: "Sanika Paste", email: "sanikapaste.aconsultancy1@gmail.com" },
    { name: "Krutika Patil", email: "krutikapatil.aconsultancy@gmail.com" },
    { name: "Pranav Nimbre", email: "aconsultancypranav@gmail.com" },
    { name: "Manish Gaikwad", email: "manish1.aconsultancy@gmail.com" },
    { name: "Tejas Dhebe", email: "tejasdhebe.ai@gmail.com" }
  ];

  console.log("⚙️ [Auto-Seed] Checking for missing Corporate Employees...");

  for (const emp of corporateEmployees) {
    try {
      // 1. Check if profile exists by email
      const { data: existingProfile, error: profileCheckErr } = await adminSupabase
        .from("user_profiles")
        .select("user_id")
        .eq("email", emp.email)
        .maybeSingle();

      if (profileCheckErr) {
        console.error(`❌ [Auto-Seed] Checking profile error for ${emp.email}:`, profileCheckErr.message);
        continue;
      }

      if (existingProfile) {
        // Already seeded in user_profiles, skip completely
        continue;
      }

      console.log(`📌 [Auto-Seed] Seeding Corporate Employee: ${emp.name} (${emp.email})`);

      // 2. Setup user in Auth
      let authUser: any = null;
      const { data: createdAuth, error: authErr } = await adminSupabase.auth.admin.createUser({
        email: emp.email,
        password: "123456",
        email_confirm: true,
        user_metadata: { name: emp.name }
      });

      if (authErr) {
        if (authErr.message.includes("already registered") || authErr.message.includes("already exists")) {
          // If already in auth but no profile, clean up the auth user to re-register cleanly
          console.log(`[Auto-Seed] ${emp.email} exists in Auth but has no Profile. Cleansing Auth User to rebuild...`);
          const { data: { users }, error: listErr } = await adminSupabase.auth.admin.listUsers();
          if (!listErr && users) {
            const foundUser = (users as any[]).find((u: any) => u.email === emp.email);
            if (foundUser) {
              await adminSupabase.auth.admin.deleteUser(foundUser.id);
            }
          }
          // Retry createUser
          const { data: authUserRetry, error: retryErr } = await adminSupabase.auth.admin.createUser({
            email: emp.email,
            password: "123456",
            email_confirm: true,
            user_metadata: { name: emp.name }
          });
          if (retryErr || !authUserRetry.user) {
            console.error(`❌ [Auto-Seed] Failed to register auth for ${emp.email} on retry:`, retryErr?.message);
            continue;
          }
          authUser = authUserRetry;
        } else {
          console.error(`❌ [Auto-Seed] Failed to register auth user ${emp.email}:`, authErr.message);
          continue;
        }
      } else {
        authUser = createdAuth;
      }

      if (!authUser || !authUser.user) {
        console.error(`❌ [Auto-Seed] Could not obtain auth record for ${emp.name}`);
        continue;
      }

      // 3. Create entry in public.user_profiles
      const { error: profileErr } = await adminSupabase
        .from("user_profiles")
        .insert({
          user_id: authUser.user.id,
          name: emp.name,
          email: emp.email,
          role: "employee",
          is_active: true
        });

      if (profileErr) {
        console.error(`❌ [Auto-Seed] Profile db insert error for ${emp.name}:`, profileErr.message);
        // Rollback Auth
        await adminSupabase.auth.admin.deleteUser(authUser.user.id);
      } else {
        console.log(`✅ [Auto-Seed] Successfully registered corporate employee: ${emp.name}`);
      }
    } catch (e: any) {
      console.error(`❌ [Auto-Seed] Exception during seeding of ${emp.name}:`, e.message || e);
    }
  }
  console.log("⚙️ [Auto-Seed] Checked all 13 corporate employee slots.");
}


// ==========================================
// VITE OR STATIC ASSETS ROUTING
// ==========================================

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Auto-run bootstrap seeds
  try {
    await ensureDefaultAdminSeeded();
    await ensureDefaultAccountsSeeded();
    await ensureCorporateEmployeesSeeded();
  } catch (seedErr: any) {
    console.error("⚠️ Background startup auto-seed failed:", seedErr.message || seedErr);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
