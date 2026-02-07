import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";

import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";

import axios from "axios";
import { toast } from "sonner";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Calendar } from "lucide-react";
import { format } from "date-fns";

const themesMap = {
  default: "#ffffff",
  rose: "#fff1f0",
  mint: "#f0fff4",
  sky: "#f0f9ff",
  lavender: "#f5f3ff",
};

const fontsMap = {
  system: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial',
  serif: 'Georgia, "Times New Roman", Times, serif',
  sans: "Poppins, Roboto, Inter, system-ui, -apple-system, \"Segoe UI\", Arial",
  poppins: "Poppins, system-ui, -apple-system, Arial",
  roboto: "Roboto, system-ui, -apple-system, Arial",
  merriweather: "Merriweather, Georgia, serif",
  lora: "Lora, Georgia, serif",
  playfair: "Playfair Display, Georgia, serif",
  dancing: "Dancing Script, cursive",
  montserrat: "Montserrat, system-ui, -apple-system, Arial",
  raleway: "Raleway, system-ui, -apple-system, Arial",
  courierprime: "Courier Prime, Monaco, monospace",
  mono: 'Menlo, Monaco, "Courier New", monospace',
};

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function NoteDetailPage() {
  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const { noteId } = useParams();
  const navigate = useNavigate();

  const fetchNote = useCallback(async () => {
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
  }, [noteId, navigate]);

  useEffect(() => {
    fetchNote();
  }, [fetchNote]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Loading note...</p>
      </div>
    );
  }

  if (!note) return null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto">
      <Button
        data-testid="back-to-notes-button"
        variant="ghost"
        className="mb-6 rounded-full"
        onClick={() => navigate("/dashboard/past-notes")}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Notes
      </Button>

      <Card
        data-testid="note-detail-card"
        className="glass-card border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
        style={{ background: note.theme ? themesMap[note.theme] || note.theme : undefined }}
      >
        <CardContent className="p-8">
          <h1
            className="text-4xl font-serif font-bold text-foreground mb-4"
            style={{ fontFamily: fontsMap[note.font] || undefined }}
          >
            {note.title}
          </h1>

          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
            <Calendar className="w-4 h-4" />
            <span>{format(new Date(note.created_at), "MMMM d, yyyy 'at' h:mm a")}</span>
          </div>

          <div
            className="prose prose-lg max-w-none mb-6"
            style={{ fontFamily: fontsMap[note.font] || undefined }}
          >
            <p className="text-base leading-relaxed text-foreground whitespace-pre-wrap">
              {note.content}
            </p>
          </div>

          {note.attachments?.length > 0 && (
            <div className="grid gap-4">
              {note.attachments.map((a, i) => (
                <div key={i}>
                  {a.type === "image" && (
                    <img src={a.url} alt={a.name} className="w-full rounded-md" />
                  )}
                  {a.type === "video" && (
                    <video src={a.url} controls className="w-full rounded-md" />
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
