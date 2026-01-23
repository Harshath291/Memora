import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import axios from "axios";
import { toast } from "sonner";
import { Clock, Plus, Calendar } from "lucide-react";
import { format } from "date-fns";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";
const API = `${BACKEND_URL}/api`;

export default function RemindersPage() {
  const [reminders, setReminders] = useState([]);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [editingId, setEditingId] = useState(null);


  const timersRef = useRef({});
  const acknowledgedRef = useRef(new Set());
  const alarmIntervalRef = useRef(null);
  const [activeAlarm, setActiveAlarm] = useState(null);

  const clearTimers = () => {
    Object.values(timersRef.current).forEach((t) => clearTimeout(t));
    timersRef.current = {};
  };

  const playBeepOnce = () => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(880, ctx.currentTime);
      g.gain.setValueAtTime(0.001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      setTimeout(() => { try { o.stop(); ctx.close(); } catch (e) {} }, 700);
    } catch (e) {}
  };

  const startAlarm = (rem) => {
    setActiveAlarm(rem);
    playBeepOnce();
    if (alarmIntervalRef.current) clearInterval(alarmIntervalRef.current);
    alarmIntervalRef.current = setInterval(() => playBeepOnce(), 2000);
  };

  const stopAlarm = () => {
    if (alarmIntervalRef.current) {
      clearInterval(alarmIntervalRef.current);
      alarmIntervalRef.current = null;
    }
    setActiveAlarm(null);
  };

  const triggerReminder = (rem) => {
    if (acknowledgedRef.current.has(rem.id)) return;
    if (activeAlarm && activeAlarm.id === rem.id) return;

    console.log(`Triggering reminder ${rem.id}`);

    const titleText = rem.title || "Reminder";
    const body = rem.note || (rem.date ? new Date(rem.date).toLocaleString() : "");

    if (window.Notification && Notification.permission === "granted") {
      try { new Notification(titleText, { body }); } catch (e) {}
    }

    // show alarm modal + sound
    startAlarm(rem);

    // In-app toast fallback
    toast.success(`${titleText}${body ? ` — ${body}` : ""}`);
  };

  const scheduleAllReminders = (list) => {
    clearTimers();
    const now = Date.now();
    list.forEach((rem) => {
      if (!rem.date) return;
      const runAt = new Date(rem.date).getTime();
      const ms = runAt - now;
      if (ms <= 0) {
        if (ms > -60000 && !acknowledgedRef.current.has(rem.id)) {
          triggerReminder(rem);
        }
        return;
      }
      try {
        console.log(`Scheduling reminder ${rem.id} in ${ms}ms`);
        const id = setTimeout(() => triggerReminder(rem), ms);
        timersRef.current[rem.id] = id;
      } catch (e) {}
    });
  };

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission !== "granted") {
      Notification.requestPermission().catch(() => {});
    }

    fetchReminders();

    const interval = setInterval(() => {
      fetchReminders();
    }, 60 * 1000);

    return () => {
      clearInterval(interval);
      clearTimers();
    };
  }, []);

  const fetchReminders = async () => {
    try {
      const token = localStorage.getItem("memora_token");
      const response = await axios.get(`${API}/reminders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setReminders(response.data);
      scheduleAllReminders(response.data);
    } catch (error) {
      toast.error("Failed to fetch reminders");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem("memora_token");
      const reminderDate = time ? `${date}T${time}` : date;

      if (editingId) {
        // Update
        await axios.put(
          `${API}/reminders/${editingId}`,
          { title, date: reminderDate, note: note || null },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        toast.success("Reminder updated!");
      } else {
        // Create
        await axios.post(
          `${API}/reminders`,
          { title, date: reminderDate, note: note || null },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        toast.success("Reminder created!");
      }

      setTitle("");
      setDate("");
      setTime("");
      setNote("");
      setShowForm(false);
      setEditingId(null);
      fetchReminders();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save reminder");
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
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-serif font-bold text-foreground mb-2 flex items-center gap-3">
            <Clock className="w-8 h-8 text-primary" />
            Reminders
          </h1>
          <p className="text-muted-foreground">Never forget important moments</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            data-testid="add-reminder-button"
            onClick={() => setShowForm(!showForm)}
            className="rounded-full btn-hover"
          >
            <Plus className="mr-2 h-5 w-5" />
            Add Reminder
          </Button>
          <Button
            data-testid="test-notification-button"
            variant="outline"
            className="rounded-full"
            onClick={() => {
              if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== 'granted') {
                Notification.requestPermission().catch(() => {});
              }
              const testRem = { id: 'test-reminder', title: 'Test Reminder', note: 'This is a test notification' };
              acknowledgedRef.current.delete(testRem.id);
              triggerReminder(testRem);
            }}
          >
            Test Notification
          </Button>
        </div>
      </div>

      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Card data-testid="reminder-form" className="glass-card border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <CardHeader>
              <CardTitle className="text-2xl font-serif">New Reminder</CardTitle>
              <CardDescription>Set a reminder for something important</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {editingId && (
                  <div className="text-sm text-muted-foreground">Editing reminder</div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="reminder-title">Title</Label>
                  <Input
                    id="reminder-title"
                    data-testid="reminder-title-input"
                    type="text"
                    placeholder="What do you want to remember?"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    className="rounded-xl h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reminder-date">Date</Label>
                  <Input
                    id="reminder-date"
                    data-testid="reminder-date-input"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                    className="rounded-xl h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reminder-time">Time (Optional)</Label>
                  <Input
                    id="reminder-time"
                    data-testid="reminder-time-input"
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="rounded-xl h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reminder-note">Note (Optional)</Label>
                  <Textarea
                    id="reminder-note"
                    data-testid="reminder-note-input"
                    placeholder="Add additional details..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
                <div className="flex gap-3">
                  <Button
                    type="submit"
                    data-testid="save-reminder-button"
                    className="rounded-full btn-hover flex-1"
                    disabled={loading}
                  >
                    {loading ? (editingId ? "Saving..." : "Creating...") : (editingId ? "Save Changes" : "Create Reminder")}
                  </Button>
                  <Button
                    type="button"
                    data-testid="cancel-reminder-button"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => { setShowForm(false); setEditingId(null); }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <div data-testid="reminders-list" className="grid gap-4">
        {reminders.length === 0 ? (
          <Card data-testid="empty-reminders" className="glass-card border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <CardContent className="py-12 text-center">
              <Clock className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-lg text-muted-foreground">No reminders yet</p>
            </CardContent>
          </Card>
        ) : (
          reminders.map((reminder, index) => (
            <motion.div
              key={reminder.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card
                data-testid={`reminder-item-${reminder.id}`}
                className="glass-card border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
              >
                <CardContent className="p-6">
                  <h3 className="text-xl font-serif font-semibold text-foreground mb-2">
                    {reminder.title}
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <Calendar className="w-4 h-4" />
                    <span>{format(new Date(reminder.date), "MMMM d, yyyy h:mm a")}</span>
                  </div>
                  {reminder.note && (
                    <p className="text-sm text-muted-foreground mt-2">{reminder.note}</p>
                  )}

                  <div className="mt-4 flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => {
                      // Edit
                      const d = reminder.date || '';
                      let datePart = d;
                      let timePart = '';
                      if (d.includes('T')) {
                        const parts = d.split('T');
                        datePart = parts[0];
                        timePart = parts[1] ? parts[1].slice(0,5) : '';
                      }
                      setTitle(reminder.title || '');
                      setDate(datePart);
                      setTime(timePart);
                      setNote(reminder.note || '');
                      setEditingId(reminder.id);
                      setShowForm(true);
                    }}>Edit</Button>
                    <Button variant="destructive" size="sm" onClick={async () => {
                      if (!confirm('Delete this reminder?')) return;
                      const token = localStorage.getItem('memora_token');
                      if (!token) {
                        toast.error('You must be logged in to delete reminders');
                        return;
                      }
                      try {
                        await axios.delete(`${API}/reminders/${reminder.id}`, { headers: { Authorization: `Bearer ${token}` } });
                        toast.success('Reminder deleted');
                        acknowledgedRef.current.delete(reminder.id);
                        if (timersRef.current[reminder.id]) {
                          clearTimeout(timersRef.current[reminder.id]);
                          delete timersRef.current[reminder.id];
                        }
                        fetchReminders();
                      } catch (e) {
                        const status = e.response?.status;
                        const detail = e.response?.data?.detail || e.message || 'Failed to delete reminder';
                        if (status === 404) {
                          toast.error('Reminder not found — it may have already been removed');
                          fetchReminders();
                        } else if (status === 401) {
                          toast.error('Not authorized — please log in');
                        } else {
                          toast.error(detail);
                        }
                      }
                    }}>Delete</Button>
                  </div>

                {/* Alarm modal (shows when activeAlarm set) */}
                {activeAlarm && activeAlarm.id === reminder.id && (
                  <AlertDialog open={!!activeAlarm} onOpenChange={(v) => { if (!v) { /* user closed via backdrop */ stopAlarm(); }} }>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{activeAlarm.title || 'Reminder'}</AlertDialogTitle>
                      </AlertDialogHeader>
                      <div className="p-4 text-sm">
                        {activeAlarm.note && <p className="mb-2">{activeAlarm.note}</p>}
                        {activeAlarm.date && <p className="text-muted-foreground">{new Date(activeAlarm.date).toLocaleString()}</p>}
                      </div>
                      <div className="flex gap-2 p-4 justify-end">
                        <AlertDialogCancel onClick={() => { stopAlarm(); }}>Close</AlertDialogCancel>
                        <AlertDialogAction onClick={() => { acknowledgedRef.current.add(activeAlarm.id); stopAlarm(); }}>Acknowledge</AlertDialogAction>
                      </div>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                </CardContent>
              </Card>
            </motion.div>
          ))
        )}
      </div>
    </motion.div>
  );
}