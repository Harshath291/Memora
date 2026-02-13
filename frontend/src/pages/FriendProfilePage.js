import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";

import { Button } from "./button"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";

import axios from "axios";
import { toast } from "sonner";

import { useParams, useSearchParams, useNavigate } from "react-router-dom";

import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { format } from "date-fns";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function FriendProfilePage() {
  const { username } = useParams();
  const [profile, setProfile] = useState(null);
  const [profileNotFound, setProfileNotFound] = useState(false);
  const [messages, setMessages] = useState([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  const messagesEndRef = useRef(null);
  const wsRef = useRef(null);

  const [searchParams] = useSearchParams();
  const tab = searchParams.get("tab") || "profile";
  const navigate = useNavigate();

  const groupedMessages = React.useMemo(() => {
    const groups = {};
    messages.forEach((m) => {
      const key = new Date(m.created_at).toDateString();
      if (!groups[key]) groups[key] = [];
      groups[key].push(m);
    });
    const sortedKeys = Object.keys(groups).sort(
      (a, b) => new Date(a) - new Date(b)
    );
    return { groups, sortedKeys };
  }, [messages]);

  const fetchProfile = useCallback(async () => {
    try {
      const token = localStorage.getItem("memora_token");
      const res = await axios.get(`${API}/users/${username}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProfile(res.data);
      setProfileNotFound(false);
      return res.data;
    } catch (e) {
      const msg = e.response?.data?.detail || "Failed to fetch user";
      toast.error(msg);
      if (e.response?.status === 404) {
        setProfile(null);
        setProfileNotFound(true);
      }
      return null;
    }
  }, [username]);

  const fetchMessages = useCallback(async (userId) => {
    try {
      const token = localStorage.getItem("memora_token");
      const res = await axios.get(`${API}/messages/${username}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessages(res.data);

      setTimeout(
        () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }),
        50
      );

      try {
        await axios.post(
          `${API}/messages/${username}/read`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        localStorage.setItem("memora_unread_updated", String(Date.now()));
      } catch {}

      if (wsRef.current && userId) {
        wsRef.current.send(
          JSON.stringify({
            event: "mark_read",
            friend_user_id: userId,
          })
        );
      }
    } catch (e) {
      if (e.response?.status !== 403) {
        toast.error(e.response?.data?.detail || "Failed to fetch messages");
      }
    }
  }, [username]);

  useEffect(() => {
    let mounted = true;

    const start = async () => {
      const profileData = await fetchProfile();
      if (!profileData || tab !== "messages") return;

      const userId = profileData.user_id;
      await fetchMessages(userId);

      try {
        const token = localStorage.getItem("memora_token");
        if (!token) return;

        const wsProto = BACKEND_URL.startsWith("https") ? "wss" : "ws";
        const host = new URL(BACKEND_URL).host;
        const ws = new WebSocket(`${wsProto}://${host}/ws?token=${token}`);
        wsRef.current = ws;

        ws.onopen = () => {
          ws.send(
            JSON.stringify({
              event: "mark_read",
              friend_user_id: userId,
            })
          );
        };

        ws.onmessage = (ev) => {
          try {
            const data = JSON.parse(ev.data);
            if (data.event === "new_message" && data.payload) {
              setMessages((prev) => [...prev, data.payload]);
              setTimeout(
                () =>
                  messagesEndRef.current?.scrollIntoView({
                    behavior: "smooth",
                  }),
                50
              );
            }
          } catch {}
        };

        ws.onclose = () => {
          if (mounted) setTimeout(start, 3000);
        };
      } catch {}
    };

    start();

    return () => {
      mounted = false;
      try {
        wsRef.current?.close();
      } catch {}
    };
  }, [fetchProfile, fetchMessages, tab]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;

    setLoading(true);
    try {
      const token = localStorage.getItem("memora_token");
      const res = await axios.post(
        `${API}/messages`,
        { to_username: username, content },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setContent("");
      setMessages((prev) => [...prev, res.data]);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to send message");
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (u) => (u ? u.substring(0, 2).toUpperCase() : "");

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto">
      {/* UI unchanged */}
    </motion.div>
  );
}
