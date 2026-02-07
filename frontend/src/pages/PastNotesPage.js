import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "../components/ui/card";
import axios from "axios";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { FileText, Calendar, Edit, Trash } from "lucide-react";
import { format } from "date-fns";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  DialogClose,
} from "../components/ui/dialog";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "../components/ui/alert-dialog";


const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function PastNotesPage() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Edit modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  // Delete confirmation state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

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

  const openEdit = async (note) => {
    try {
      // fetch full note (list endpoint only provides id/title)
      const token = localStorage.getItem("memora_token");
      const res = await axios.get(`${API}/notes/${note.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setEditingNote(res.data);
      setEditTitle(res.data.title || "");
      setEditContent(res.data.content || "");
      setEditOpen(true);
    } catch (err) {
      toast.error("Failed to load note");
    }
  };

  const submitEdit = async () => {
    if (!editingNote) return;
    setEditLoading(true);
    try {
      const token = localStorage.getItem("memora_token");
      const res = await axios.put(
        `${API}/notes/${editingNote.id}`,
        { title: editTitle, content: editContent },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Update notes list
      setNotes((prev) => prev.map((n) => (n.id === editingNote.id ? { ...n, title: res.data.title } : n)));

      toast.success("Note updated");
      setEditOpen(false);
      setEditingNote(null);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to update note");
    } finally {
      setEditLoading(false);
    }
  };

  const openDelete = (noteId) => {
    setDeletingNoteId(noteId);
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingNoteId) return;
    setDeleteLoading(true);
    try {
      const token = localStorage.getItem("memora_token");
      await axios.delete(`${API}/notes/${deletingNoteId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setNotes((prev) => prev.filter((n) => n.id !== deletingNoteId));
      toast.success("Note deleted");
      setDeleteOpen(false);
      setDeletingNoteId(null);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to delete note");
    } finally {
      setDeleteLoading(false);
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

                    <div className="ml-4 flex items-start gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(note);
                        }}
                        aria-label={`Edit ${note.title}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>

                      <AlertDialog open={deleteOpen && deletingNoteId === note.id} onOpenChange={(v)=>{ if (!v) setDeletingNoteId(null); setDeleteOpen(v); }}>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              openDelete(note.id);
                            }}
                            aria-label={`Delete ${note.title}`}
                          >
                            <Trash className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete note?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this note? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <div className="h-4" />
                          <div className="flex justify-end gap-2">
                            <AlertDialogCancel asChild>
                              <Button variant="outline">Cancel</Button>
                            </AlertDialogCancel>
                            <AlertDialogAction asChild>
                              <Button variant="destructive" onClick={confirmDelete} disabled={deleteLoading}>
                                {deleteLoading ? "Deleting..." : "Delete"}
                              </Button>
                            </AlertDialogAction>
                          </div>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(v) => { if (!v) setEditingNote(null); setEditOpen(v); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Note</DialogTitle>
            <DialogDescription>Make changes to your note and save them.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Title</label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="mt-2" />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Content</label>
              <Textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} className="mt-2" />
            </div>
          </div>

          <DialogFooter>
            <div className="w-full flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setEditOpen(false); setEditingNote(null); }}>
                Cancel
              </Button>
              <Button onClick={submitEdit} disabled={editLoading}>
                {editLoading ? "Saving..." : "Save"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </motion.div>
  );
}