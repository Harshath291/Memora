import React from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PenLine, FileText, Calendar, Clock, Users, CheckSquare, LogOut, BookHeart } from "lucide-react";
import { toast } from "sonner";

export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { icon: PenLine, label: "New Note", path: "/dashboard/new-note", testId: "nav-new-note" },
    { icon: FileText, label: "Past Notes", path: "/dashboard/past-notes", testId: "nav-past-notes" },
    { icon: Calendar, label: "On This Day", path: "/dashboard/on-this-day", testId: "nav-on-this-day" },
    { icon: Clock, label: "Reminders", path: "/dashboard/reminders", testId: "nav-reminders" },
    { icon: Users, label: "Friends", path: "/dashboard/friends", testId: "nav-friends" },
    { icon: CheckSquare, label: "Checkbox Notes", path: "/dashboard/checkbox-notes", testId: "nav-checkbox-notes" },
  ];

  const handleLogout = () => {
    localStorage.removeItem("memora_token");
    localStorage.removeItem("memora_username");
    toast.success("Logged out successfully");
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-background paper-texture">
      <div className="flex h-screen">
        <motion.aside
          initial={{ x: -100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="w-72 m-4 rounded-2xl glass-card shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col"
          data-testid="dashboard-sidebar"
        >
          <div className="p-6 border-b border-border/50">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <BookHeart className="w-6 h-6 text-primary" />
              </div>
              <h1 className="text-2xl font-serif font-bold text-primary">Memora</h1>
            </div>
            <p className="text-sm text-muted-foreground">Your memory companion</p>
          </div>

          <ScrollArea className="flex-1 px-3 py-4">
            <nav className="space-y-2">
              {menuItems.map((item, index) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <motion.div
                    key={item.path}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Button
                      data-testid={item.testId}
                      variant={isActive ? "default" : "ghost"}
                      className={`w-full justify-start rounded-xl h-12 font-semibold transition-all ${
                        isActive ? "shadow-md" : "hover:bg-primary/10"
                      }`}
                      onClick={() => navigate(item.path)}
                    >
                      <Icon className="mr-3 h-5 w-5" strokeWidth={1.5} />
                      {item.label}
                    </Button>
                  </motion.div>
                );
              })}
            </nav>
          </ScrollArea>

          <div className="p-4 border-t border-border/50">
            <Button
              data-testid="logout-button"
              variant="outline"
              className="w-full rounded-xl h-12 font-semibold hover:bg-destructive hover:text-destructive-foreground"
              onClick={handleLogout}
            >
              <LogOut className="mr-3 h-5 w-5" />
              Logout
            </Button>
          </div>
        </motion.aside>

        <main className="flex-1 overflow-auto">
          <div className="p-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Outlet />
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  );
}