import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogAction,
  AlertDialogCancel,
} from "../components/ui/alert-dialog";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
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
  const [time, setTime] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const timersRef = useRef({});
  const acknowledgedRef = useRef(new Set());
  const alarmIntervalRef = useRef(null);
  const activeAlarmRef = useRef(null);
  const [activeAlarm, setActiveAlarm] = useState(null);

  const clearTimers = useCallback(() => {
    Object.values(timersRef.current).forEach(clearTimeout);
    timersRef.current = {};
  }, []);

  const playBeepOnce = () => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(880, ctx.currentTime);
      g.gain.setValueAtTime(0.001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      setTimeout(() => {
        try {
          o.stop();
          ctx.close();
        } catch {}
      }, 700);
    } catch {}
  };

  const startAlarm = useCallback((rem) => {
    activeAlarmRef.current = rem;
    setActiveAlarm(rem);
    playBeepOnce();

    if (alarmIntervalRef.current) clearInterval(alarmIntervalRef.current);
    alarmIntervalRef.current = setInterval(playBeepOnce, 2000);
  }, []);

  const stopAlarm = useCallback(() => {
    if (alarmIntervalRef.current) {
      clearInterval(alarmIntervalRef.current);
      alarmIntervalRef.current = null;
    }
    activeAlarmRef.current = null;
    setActiveAlarm(null);
  }, []);

  const triggerReminder = useCallback((rem) => {
    if (acknowledgedRef.current.has(rem.id)) return;
    if (activeAlarmRef.current?.id === rem.id) return;

    if (window.Notification && Notification.permission === "granted") {
      try {
        new Notification(rem.title || "Reminder", {
          body: rem.note || "",
        });
      } catch {}
    }

    startAlarm(rem);
    toast.success(rem.title || "Reminder");
  }, [startAlarm]);

  const scheduleAllReminders = useCallback((list) => {
    clearTimers();
    const now = Date.now();

    list.forEach((rem) => {
      if (!rem.date) return;

      const runAt = new Date(rem.date).getTime();
      const ms = runAt - now;

      if (ms <= 0) {
        if (ms > -60000) triggerReminder(rem);
        return;
      }

      timersRef.current[rem.id] = setTimeout(
        () => triggerReminder(rem),
        ms
      );
    });
  }, [clearTimers, triggerReminder]);

  const fetchReminders = useCallback(async () => {
    try {
      const token = localStorage.getItem("memora_token");
      const res = await axios.get(`${API}/reminders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setReminders(res.data);
      scheduleAllReminders(res.data);
    } catch {
      toast.error("Failed to fetch reminders");
    }
  }, [scheduleAllReminders]);

  useEffect(() => {
    if ("Notification" in window && Notification.permission !== "granted") {
      Notification.requestPermission().catch(() => {});
    }

    fetchReminders();
    const interval = setInterval(fetchReminders, 60000);

    return () => {
      clearInterval(interval);
      clearTimers();
      stopAlarm();
    };
  }, [fetchReminders, clearTimers, stopAlarm]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem("memora_token");
      const reminderDate = time ? `${date}T${time}` : date;

      if (editingId) {
        await axios.put(
          `${API}/reminders/${editingId}`,
          { title, date: reminderDate, note: note || null },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success("Reminder updated!");
      } else {
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
      setEditingId(null);
      setShowForm(false);
      fetchReminders();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to save reminder");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-5xl mx-auto">
      {/* UI unchanged */}
    </motion.div>
  );
}
