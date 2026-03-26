import { useState } from "react";
import { Navigate } from "react-router-dom";
import { LayoutDashboard, ArrowRight, Lock, Mail, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export default function Login() {
  const { user, isPending, isAdmin, loading, signIn, signUp, signOut } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [usernamePassword, setUsernamePassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState<string>("signin");
  const [loginMode, setLoginMode] = useState<"email" | "username">("email");
  const [magicLinkSent, setMagicLinkSent] = useState(false);

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
              Your account has been created but is waiting for admin approval.
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

  // Redirect based on role
  if (user && !isPending) {
    if (isAdmin) return <Navigate to="/admin" replace />;
    return <Navigate to="/view" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    if (loginMode === "username") {
      if (!username.trim() || !usernamePassword) { setSubmitting(false); return; }
      const fakeEmail = `${username.trim()}@viewer.local`;
      const { error } = await signIn(fakeEmail, usernamePassword);
      if (error) {
        toast({ title: "Sign in failed", description: "Invalid username or password", variant: "destructive" });
      }
      setSubmitting(false);
      return;
    }

    if (!email.trim() || !password) { setSubmitting(false); return; }

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

  const handleMagicLink = async () => {
    if (!email.trim()) {
      toast({ title: "Enter your email first", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setMagicLinkSent(true);
      toast({ title: "Check your email", description: "A login link has been sent to your inbox." });
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
          {magicLinkSent ? (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="rounded-xl bg-primary/10 p-3">
                  <Mail className="h-8 w-8 text-primary" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                We sent a login link to <span className="font-medium text-foreground">{email}</span>.
              </p>
              <Button variant="outline" size="sm" onClick={() => setMagicLinkSent(false)}>
                Back to login
              </Button>
            </div>
          ) : (
            <>
              {/* Login mode toggle */}
              <div className="flex gap-2 mb-4">
                <Button
                  type="button"
                  variant={loginMode === "email" ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setLoginMode("email")}
                >
                  <Mail className="h-4 w-4 mr-1" /> Email
                </Button>
                <Button
                  type="button"
                  variant={loginMode === "username" ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setLoginMode("username")}
                >
                  <User className="h-4 w-4 mr-1" /> Username
                </Button>
              </div>

              {loginMode === "username" ? (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <Input
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""))}
                    required
                    autoFocus
                  />
                  <Input
                    type="password"
                    placeholder="Password"
                    value={usernamePassword}
                    onChange={(e) => setUsernamePassword(e.target.value)}
                    required
                    minLength={6}
                  />
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? "Please wait…" : "Sign In"}
                    {!submitting && <ArrowRight className="ml-2 h-4 w-4" />}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Username accounts are view-only. Contact an admin to get one.
                  </p>
                </form>
              ) : (
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
                      <div className="space-y-2">
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
                        <div className="relative">
                          <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                          <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">or</span></div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full"
                          disabled={submitting}
                          onClick={handleMagicLink}
                        >
                          <Mail className="h-4 w-4 mr-2" />
                          Sign in with email link
                        </Button>
                      </div>
                    )}
                    {tab === "signup" && (
                      <p className="text-xs text-muted-foreground text-center">
                        New accounts require admin approval before access is granted.
                      </p>
                    )}
                  </form>
                </Tabs>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
