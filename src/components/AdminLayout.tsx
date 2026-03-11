import { Outlet } from "react-router-dom";
import { LayoutDashboard, LayoutGrid, LogOut, Users, Shield } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Breakouts", url: "/admin", icon: LayoutGrid, end: true },
  { title: "Lead Pool", url: "/admin/lead-pool", icon: Users, end: false },
  { title: "Users", url: "/admin/users", icon: Shield, end: false },
];

function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { user, signOut } = useAuth();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="px-4 py-5">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <LayoutDashboard className="h-6 w-6 text-sidebar-primary" />
              <span className="font-heading text-lg font-bold text-sidebar-primary-foreground">
                Mindshare
              </span>
            </div>
          )}
          {collapsed && <LayoutDashboard className="h-6 w-6 text-sidebar-primary mx-auto" />}
        </div>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-muted text-xs uppercase tracking-wider">
            {!collapsed && "Admin"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.end}
                      className="hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-3">
        {!collapsed && user && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-sidebar-muted truncate max-w-[140px]">
              {user.email}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-sidebar-muted hover:text-sidebar-primary-foreground hover:bg-sidebar-accent"
              onClick={signOut}
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}
        {collapsed && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 mx-auto text-sidebar-muted hover:text-sidebar-primary-foreground hover:bg-sidebar-accent"
            onClick={signOut}
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

export default function AdminLayout() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center border-b bg-card px-4">
            <SidebarTrigger className="mr-4" />
            <h1 className="font-heading text-sm font-semibold text-muted-foreground">
              Mindshare Breakout Engine
            </h1>
          </header>
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
