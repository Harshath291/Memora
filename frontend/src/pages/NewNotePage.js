import React, { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import axios from "axios";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function NewNotePage() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem("memora_token");
      await axios.post(
        `${API}/notes`,
        { title, content },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success("Note saved successfully!");
      setTitle("");
      setContent("");
      navigate("/dashboard/past-notes");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save note");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-4xl mx-auto"
    >
      <div className="mb-8">
        <h1 className="text-4xl font-serif font-bold text-foreground mb-2 flex items-center gap-3">
          <Sparkles className="w-8 h-8 text-primary" />
          New Note
        </h1>
        <p className="text-muted-foreground">Capture your thoughts and memories</p>
      </div>

      <Card data-testid="new-note-card" className="glass-card border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        <CardHeader>
          <CardTitle className="text-2xl font-serif">Write Your Story</CardTitle>
          <CardDescription>Every moment deserves to be remembered</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-base font-semibold">Title</Label>
              <Input
                id="title"
                data-testid="note-title-input"
                type="text"
                placeholder="Give your note a title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="rounded-xl h-14 text-lg"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="content" className="text-base font-semibold">Content</Label>
              <Textarea
                id="content"
                data-testid="note-content-input"
                placeholder="Start writing your thoughts..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
                className="rounded-xl min-h-[300px] text-base leading-relaxed"
              />
            </div>
            <Button
              type="submit"
              data-testid="save-note-button"
              size="lg"
              className="w-full rounded-full h-14 text-lg font-bold btn-hover"
              disabled={loading}
            >
              {loading ? "Saving..." : "Save Note"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}