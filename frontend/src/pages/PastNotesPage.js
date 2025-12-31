import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import axios from "axios";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { FileText, Calendar } from "lucide-react";
import { format } from "date-fns";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function PastNotesPage() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchNotes();
  }, []);

  const fetchNotes = async () => {
    try {
      const token = localStorage.getItem("memora_token");
      const response = await axios.get(`${API}/notes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotes(response.data);
    } catch (error) {
      toast.error("Failed to fetch notes");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-5xl mx-auto"
    >
      <div className="mb-8">
        <h1 className="text-4xl font-serif font-bold text-foreground mb-2 flex items-center gap-3">
          <FileText className="w-8 h-8 text-primary" />
          Past Notes
        </h1>
        <p className="text-muted-foreground">Your collection of memories</p>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading your notes...</p>
        </div>
      ) : notes.length === 0 ? (
        <Card data-testid="empty-notes" className="glass-card border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <CardContent className="py-12 text-center">
            <FileText className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-lg text-muted-foreground">No notes yet. Start writing!</p>
          </CardContent>
        </Card>
      ) : (
        <div data-testid="notes-list" className="grid gap-4">
          {notes.map((note, index) => (
            <motion.div
              key={note.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card
                data-testid={`note-item-${note.id}`}
                className="glass-card border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] transition-all cursor-pointer"
                onClick={() => navigate(`/dashboard/note/${note.id}`)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-xl font-serif font-semibold text-foreground mb-2">
                        {note.title}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        <span>
                          {format(new Date(note.created_at), "MMMM d, yyyy 'at' h:mm a")}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}