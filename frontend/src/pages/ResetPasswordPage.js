import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import axios from "axios";
import { toast } from "sonner";
import { BookHeart } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const tokenFromQuery = searchParams.get("token") || "";
  const usernameFromQuery = searchParams.get("username") || "";

  const [token, setToken] = useState(tokenFromQuery);
  const [username, setUsername] = useState(usernameFromQuery);
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // update state if query params change
    setToken(tokenFromQuery);
    setUsername(usernameFromQuery);
  }, [tokenFromQuery, usernameFromQuery]);

  const handleReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API}/auth/reset-password`, {
        username,
        token,
        new_password: newPassword,
      });
      toast.success("Password updated successfully. You can now sign in.");
      navigate("/login");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 paper-texture" style={{
      backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.9)), url('https://images.unsplash.com/photo-1765176355090-06148decf2a3?crop=entropy&cs=srgb&fm=jpg&q=85')`,
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-4"
          >
            <BookHeart className="w-10 h-10 text-primary" />
          </motion.div>
          <h1 className="text-4xl font-serif font-bold text-primary mb-2">Memora</h1>
          <p className="text-muted-foreground">Write today. Remember tomorrow.</p>
        </div>

        <Card className="glass-card border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <CardHeader>
            <CardTitle className="text-2xl font-serif">Reset password</CardTitle>
            <CardDescription>Set a new password for your account</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleReset} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  data-testid="reset-username-input"
                  type="text"
                  placeholder="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="rounded-xl h-12"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="token">Token</Label>
                <Input
                  id="token"
                  data-testid="reset-token-input"
                  type="text"
                  placeholder="reset token"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  required
                  className="rounded-xl h-12"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  data-testid="reset-newpassword-input"
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="rounded-xl h-12"
                />
              </div>

              <Button type="submit" data-testid="reset-submit" className="w-full rounded-full h-12 font-bold btn-hover" disabled={loading}>
                {loading ? "Updating..." : "Update password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
