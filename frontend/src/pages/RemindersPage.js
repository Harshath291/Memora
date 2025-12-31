import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import axios from "axios";
import { toast } from "sonner";
import { Clock, Plus, Calendar } from "lucide-react";
import { format } from "date-fns";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function RemindersPage() {
  const [reminders, setReminders] = useState([]);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchReminders();
  }, []);

  const fetchReminders = async () => {
    try {
      const token = localStorage.getItem("memora_token");
      const response = await axios.get(`${API}/reminders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setReminders(response.data);
    } catch (error) {
      toast.error("Failed to fetch reminders");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem("memora_token");
      await axios.post(
        `${API}/reminders`,
        { title, date, note: note || null },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success("Reminder created!");
      setTitle("");
      setDate("");
      setNote("");
      setShowForm(false);
      fetchReminders();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create reminder");
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
        <Button
          data-testid="add-reminder-button"
          onClick={() => setShowForm(!showForm)}
          className="rounded-full btn-hover"
        >
          <Plus className="mr-2 h-5 w-5" />
          Add Reminder
        </Button>
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
                    {loading ? "Creating..." : "Create Reminder"}
                  </Button>
                  <Button
                    type="button"
                    data-testid="cancel-reminder-button"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => setShowForm(false)}
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
                    <span>{format(new Date(reminder.date), "MMMM d, yyyy")}</span>
                  </div>
                  {reminder.note && (
                    <p className="text-sm text-muted-foreground mt-2">{reminder.note}</p>
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