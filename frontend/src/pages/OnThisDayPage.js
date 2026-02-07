import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "../components/ui/button";

import axios from "axios";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Calendar, Sparkles } from "lucide-react";
import { format } from "date-fns";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function OnThisDayPage() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchOnThisDayNotes();
  }, []);

  const fetchOnThisDayNotes = async () => {
    try {
      const token = localStorage.getItem("memora_token");
      const response = await axios.get(`${API}/notes/on-this-day/list`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotes(response.data);
    } catch (error) {
      toast.error("Failed to fetch memories");
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
          <Calendar className="w-8 h-8 text-primary" />
          On This Day
        </h1>
        <p className="text-muted-foreground">Memories from years past</p>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Looking for memories...</p>
        </div>
      ) : notes.length === 0 ? (
        <Card data-testid="empty-memories" className="glass-card border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)]" style={{
          backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.95)), url('https://images.unsplash.com/photo-1764867178122-fbf55f109e02?crop=entropy&cs=srgb&fm=jpg&q=85')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}>
          <CardContent className="py-16 text-center">
            <Sparkles className="w-20 h-20 text-primary/30 mx-auto mb-4" />
            <p className="text-lg text-muted-foreground mb-2">No memories for today yet</p>
            <p className="text-sm text-muted-foreground">Keep writing, and they'll appear here in the future!</p>
          </CardContent>
        </Card>
      ) : (
        <div data-testid="memories-list" className="grid gap-4">
          {notes.map((note, index) => (
            <motion.div
              key={note.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card
                data-testid={`memory-item-${note.id}`}
                className="glass-card border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] transition-all cursor-pointer overflow-hidden"
                onClick={() => navigate(`/dashboard/note/${note.id}`)}
                style={{
                  backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.95)), url('https://images.unsplash.com/photo-1749501213041-247f2c01c336?crop=entropy&cs=srgb&fm=jpg&q=85')`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="inline-block px-3 py-1 bg-primary/10 rounded-full mb-3">
                        <span className="text-sm font-semibold text-primary">
                          {format(new Date(note.created_at), "yyyy")} - {new Date().getFullYear() - new Date(note.created_at).getFullYear()} years ago
                        </span>
                      </div>
                      <h3 className="text-xl font-serif font-semibold text-foreground mb-2">
                        {note.title}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        <span>
                          {format(new Date(note.created_at), "MMMM d, yyyy")}
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