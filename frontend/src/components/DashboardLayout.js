import React from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PenLine, FileText, Calendar, Clock, Users, CheckSquare, LogOut, BookHeart, Camera } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`; 

export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  // Profile avatar state (stored in localStorage as data URL)
  const [avatar, setAvatar] = React.useState(null);
  const [avatarOpen, setAvatarOpen] = React.useState(false);
  const fileInputRef = React.useRef(null);
  const username = localStorage.getItem("memora_username") || "Friend";
  const usernameInitials = username
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  React.useEffect(() => {
    const token = localStorage.getItem("memora_token");

    // Try server profile first if logged in
    const fetchProfile = async () => {
      if (!token) {
        const stored = localStorage.getItem("memora_avatar");
        if (stored) setAvatar(stored);
        return;
      }

      try {
        const res = await axios.get(`${API}/users/me/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data && res.data.avatar) {
          setAvatar(res.data.avatar);
          localStorage.setItem("memora_avatar", res.data.avatar);
        } else {
          const stored = localStorage.getItem("memora_avatar");
          if (stored) setAvatar(stored);
        }
      } catch (err) {
        const stored = localStorage.getItem("memora_avatar");
        if (stored) setAvatar(stored);
      }
    };

    fetchProfile();
  }, []);

  const handleAvatarUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result;
      setAvatar(dataUrl);
      localStorage.setItem("memora_avatar", dataUrl);

      const token = localStorage.getItem("memora_token");
      if (token) {
        try {
          const res = await axios.post(
            `${API}/users/me/avatar`,
            { avatar: dataUrl },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (res.data && res.data.avatar) {
            setAvatar(res.data.avatar);
            localStorage.setItem("memora_avatar", res.data.avatar);
            toast.success("Profile photo saved to server");
          } else {
            toast.success("Profile photo updated locally");
          }
        } catch (err) {
          toast.error("Failed to upload profile photo to server; saved locally");
        }
      } else {
        toast.success("Profile photo updated");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = async () => {
    const token = localStorage.getItem("memora_token");
    setAvatar(null);
    localStorage.removeItem("memora_avatar");
    if (token) {
      try {
        await axios.delete(`${API}/users/me/avatar`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        toast.success("Profile photo removed");
      } catch (err) {
        toast.error("Failed to remove photo on server, removed locally");
      }
    } else {
      toast.success("Profile photo removed");
    }
  };

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
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <BookHeart className="w-6 h-6 text-primary" />
                </div>
                <h1 className="text-2xl font-serif font-bold text-primary">Memora</h1>
              </div>

              {/* Profile avatar + upload (click to open) */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setAvatarOpen(true)}
                  className="p-0 border-0 bg-transparent rounded-full focus:outline-none"
                  aria-label="View profile photo"
                >
                  {avatar ? (
                    <img src={avatar} alt="Profile" className="w-16 h-16 rounded-full object-cover border" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-lg text-muted-foreground">{usernameInitials}</div>
                  )}
                </button>

                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} data-testid="profile-photo-input" />
                <button
                  type="button"
                  className="absolute -bottom-2 -right-2 bg-white border rounded-full p-2 shadow-sm"
                  onClick={() => fileInputRef.current.click()}
                  aria-label="Upload profile photo"
                >
                  <Camera className="w-4 h-4" />
                </button>

                {/* Avatar viewer dialog */}
                <Dialog open={avatarOpen} onOpenChange={setAvatarOpen}>
                  <DialogContent className="max-w-xl w-full">
                    <DialogHeader>
                      <DialogTitle>Profile Photo</DialogTitle>
                      <DialogDescription>View and manage your profile photo</DialogDescription>
                    </DialogHeader>

                    <div className="flex items-center justify-center py-4">
                      {avatar ? (
                        <img src={avatar} alt="Profile large" className="max-w-full max-h-[48vh] rounded-lg object-contain" />
                      ) : (
                        <div className="w-48 h-48 rounded-lg bg-muted flex items-center justify-center text-3xl text-muted-foreground">{usernameInitials}</div>
                      )}
                    </div>

                    <DialogFooter>
                      <div className="flex items-center gap-2">
                        <Button onClick={() => fileInputRef.current.click()}>Upload</Button>
                        <Button variant="outline" onClick={handleRemoveAvatar}>Remove</Button>
                        <Button variant="ghost" onClick={() => setAvatarOpen(false)}>Close</Button>
                      </div>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

              </div>
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