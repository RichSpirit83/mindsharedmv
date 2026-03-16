import { useState } from "react";
import { Navigate } from "react-router-dom";
import { LayoutDashboard, ArrowRight, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export default function Login() {
  const { user, isPending, loading, signIn, signUp, signOut } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState<string>("signin");

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (user && isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader className="space-y-3">
            <div className="flex justify-center">
              <div className="rounded-xl bg-muted p-3">
                <Lock className="h-8 w-8 text-muted-foreground" />
              </div>
            </div>
            <CardTitle className="text-xl font-heading">Pending Approval</CardTitle>
            <CardDescription>
              Your account has been created but is waiting for admin approval. You'll be able to access the app once approved.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">{user.email}</p>
            <Button variant="outline" size="sm" onClick={() => signOut()}>
              Sign out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (user && !isPending) {
    return <Navigate to="/admin" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setSubmitting(true);

    if (tab === "signin") {
      const { error } = await signIn(email.trim(), password);
      if (error) {
        toast({ title: "Sign in failed", description: error.message, variant: "destructive" });
      }
    } else {
      const { error } = await signUp(email.trim(), password);
      if (error) {
        toast({ title: "Sign up failed", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Account created", description: "Your account is pending admin approval." });
      }
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="rounded-xl bg-primary/10 p-3">
              <LayoutDashboard className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-heading">Mindshare</CardTitle>
          <CardDescription>Sign in to access the breakout engine</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Please wait…" : tab === "signin" ? "Sign In" : "Request Access"}
                {!submitting && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
              {tab === "signin" && (
                <button
                  type="button"
                  className="w-full text-xs text-muted-foreground hover:text-foreground text-center"
                  onClick={async () => {
                    if (!email.trim()) {
                      toast({ title: "Enter your email first", variant: "destructive" });
                      return;
                    }
                    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
                      redirectTo: `${window.location.origin}/reset-password`,
                    });
                    if (error) {
                      toast({ title: "Error", description: error.message, variant: "destructive" });
                    } else {
                      toast({ title: "Check your email", description: "A password reset link has been sent." });
                    }
                  }}
                >
                  Forgot password?
                </button>
              )}
              {tab === "signup" && (
                <p className="text-xs text-muted-foreground text-center">
                  New accounts require admin approval before access is granted.
                </p>
              )}
            </form>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
