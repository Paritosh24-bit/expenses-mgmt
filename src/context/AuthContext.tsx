import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { AuthContextType, UserProfile } from "../types";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [needsBootstrap, setNeedsBootstrap] = useState(false);

  // Check if system requires initial bootstrap setup
  const checkBootstrapStatus = async () => {
    try {
      const response = await fetch("/api/setup/status");
      const data = await response.json();
      setNeedsBootstrap(!!data.needsBootstrap);
    } catch (err) {
      console.error("Failed to check administrative schema status:", err);
    }
  };

  const fetchProfile = async (uid: string): Promise<UserProfile | null> => {
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", uid)
        .single();
      
      if (error) {
        console.error("Error fetching user profile:", error.message);
        return null;
      }
      return data as UserProfile;
    } catch (err) {
      console.error("Failed to recover user profile info:", err);
      return null;
    }
  };

  const refreshProfile = async () => {
    if (user) {
      const p = await fetchProfile(user.id);
      if (p) {
        if (!p.is_active) {
          // If deactivated, sign out immediately
          await signOut();
          alert("Your account is deactivated. Please contact your system administrator.");
          return;
        }
        setProfile(p);
      }
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      setSessionToken(null);
    } catch (err) {
      console.error("Error signing out:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // 1. Check if the database has any admin users
    checkBootstrapStatus();

    // 2. Load the initial session securely
    const checkUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setUser(session.user);
          setSessionToken(session.access_token);
          
          const p = await fetchProfile(session.user.id);
          if (p) {
            if (!p.is_active) {
              await supabase.auth.signOut();
              setUser(null);
              setProfile(null);
              setSessionToken(null);
            } else {
              setProfile(p);
            }
          }
        }
      } catch (err) {
        console.error("Error initiating session context:", err);
      } finally {
        setIsLoading(false);
      }
    };

    checkUser();

    // 3. Listen to authentication state changes (login, logout, token refreshes)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        setUser(session.user);
        setSessionToken(session.access_token);
        
        const p = await fetchProfile(session.user.id);
        if (p) {
          if (!p.is_active) {
            await supabase.auth.signOut();
            setUser(null);
            setProfile(null);
            setSessionToken(null);
          } else {
            setProfile(p);
          }
        }
      } else {
        setUser(null);
        setProfile(null);
        setSessionToken(null);
      }
      setIsLoading(false);
      checkBootstrapStatus();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isLoading,
        sessionToken,
        needsBootstrap,
        refreshProfile,
        checkBootstrapStatus,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be called inside an AuthProvider");
  }
  return context;
};
