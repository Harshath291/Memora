import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Sparkles } from "lucide-react";


export default function WelcomePage() {
  const navigate = useNavigate();
  const username = localStorage.getItem("memora_username") || "Friend";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 paper-texture hero-gradient">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, type: "spring" }}
        className="w-full max-w-2xl"
      >
        <Card data-testid="welcome-card" className="glass-card border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-12 text-center">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-white/50 mb-8">
              <Sparkles className="w-12 h-12 text-primary" />
            </div>
            <h1 className="text-5xl font-serif font-bold text-foreground mb-4" data-testid="welcome-message">
              Welcome, {username}!
            </h1>
            <p className="text-xl text-muted-foreground mb-12">
              Ready to capture your memories and thoughts?
            </p>
            <Button
              data-testid="start-writing-button"
              onClick={() => navigate("/dashboard/new-note")}
              size="lg"
              className="rounded-full px-12 py-6 text-lg font-bold btn-hover shadow-lg"
            >
              Start Writing
            </Button>
          </motion.div>
        </Card>
      </motion.div>
    </div>
  );
}