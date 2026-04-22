import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "admin" | "viewer" | "pending" | null;

type AuthContextType = {
  user: User | null;
  role: AppRole;
  isAdmin: boolean;
  isPending: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  isAdmin: false,
  isPending: false,
  loading: true,
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole>(null);
  const [loading, setLoading] = useState(true);

  const fetchRole = async () => {
    try {
      // Primary: read directly from user_roles (allowed by users_read_own_role policy)
      const { data: rows, error: selErr } = await supabase
        .from("user_roles")
        .select("role")
        .limit(1);

      if (selErr) {
        console.error("user_roles select error:", selErr);
      } else if (rows && rows.length > 0) {
        console.log("Resolved role from user_roles:", rows[0].role);
        setRole(rows[0].role as AppRole);
        return;
      }

      // Fallback: bootstrap via RPC if no row exists yet
      const { data, error } = await supabase.rpc("assign_initial_role");
      if (error) {
        console.error("assign_initial_role error:", error);
        return;
      }
      console.log("Resolved role from assign_initial_role RPC:", data);
      setRole(data as AppRole);
    } catch (err) {
      console.error("fetchRole threw:", err);
    }
  };

  useEffect(() => {
    // 1. Set up listener FIRST — never await inside the callback.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (event === "SIGNED_OUT") {
          setRole(null);
          return;
        }

        if (currentUser) {
          // Defer RPC to avoid deadlocks inside the auth callback.
          setTimeout(() => { fetchRole(); }, 0);
        } else {
          setRole(null);
        }
      }
    );

    // 2. Then fetch existing session.
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        if (currentUser) {
          setTimeout(() => { fetchRole(); }, 0);
        }
      })
      .catch((err) => {
        console.error("getSession error:", err);
      })
      .finally(() => {
        // Always release the loading gate so the UI is never stuck.
        setLoading(false);
      });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      role,
      isAdmin: role === "admin",
      isPending: role === "pending",
      loading,
      signIn,
      signUp,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
