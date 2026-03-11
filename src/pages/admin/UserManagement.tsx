import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, CheckCircle2, Clock, XCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type UserWithRole = {
  user_id: string;
  email: string;
  role: string;
  created_at: string;
};

export default function UserManagement() {
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users_with_roles"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_users_with_roles");
      if (error) throw error;
      return (data ?? []) as UserWithRole[];
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: string }) => {
      const { error } = await supabase
        .from("user_roles")
        .update({ role: newRole })
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users_with_roles"] });
      toast({ title: "Role updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const roleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return <Badge className="bg-primary/10 text-primary border-primary/20"><CheckCircle2 className="mr-1 h-3 w-3" />Admin</Badge>;
      case "viewer":
        return <Badge variant="secondary"><CheckCircle2 className="mr-1 h-3 w-3" />Viewer</Badge>;
      case "pending":
        return <Badge variant="outline" className="text-warning border-warning/30"><Clock className="mr-1 h-3 w-3" />Pending</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  const pendingCount = users.filter((u) => u.role === "pending").length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-heading font-bold">User Management</h1>
        {pendingCount > 0 && (
          <Badge variant="destructive">{pendingCount} pending</Badge>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading…</div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No users yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Current Role</TableHead>
                  <TableHead className="w-[180px]">Change Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.user_id} className={u.role === "pending" ? "bg-warning/5" : ""}>
                    <TableCell className="font-medium">{u.email}</TableCell>
                    <TableCell>{roleBadge(u.role)}</TableCell>
                    <TableCell>
                      <Select
                        value={u.role}
                        onValueChange={(val) => updateRoleMutation.mutate({ userId: u.user_id, newRole: val })}
                      >
                        <SelectTrigger className="h-8 w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
