import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import axios from "axios";
import { toast } from "sonner";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Calendar } from "lucide-react";
import { format } from "date-fns";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function NoteDetailPage() {
  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const { noteId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    fetchNote();
  }, [noteId]);

  const fetchNote = async () => {
    try {
      const token = localStorage.getItem("memora_token");
      const response = await axios.get(`${API}/notes/${noteId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setNote(response.data);
    } catch (error) {
      toast.error("Failed to fetch note");
      navigate("/dashboard/past-notes");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Loading note...</p>
      </div>
    );
  }

  if (!note) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-4xl mx-auto"
    >
      <Button
        data-testid="back-to-notes-button"
        variant="ghost"
        className="mb-6 rounded-full"
        onClick={() => navigate("/dashboard/past-notes")}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Notes
      </Button>

      <Card data-testid="note-detail-card" className="glass-card border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        <CardContent className="p-8">
          <h1 className="text-4xl font-serif font-bold text-foreground mb-4">
            {note.title}
          </h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
            <Calendar className="w-4 h-4" />
            <span>
              {format(new Date(note.created_at), "MMMM d, yyyy 'at' h:mm a")}
            </span>
          </div>
          <div className="prose prose-lg max-w-none">
            <p className="text-base leading-relaxed text-foreground whitespace-pre-wrap">
              {note.content}
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}