import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import axios from "axios";
import { toast } from "sonner";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";
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
  const tab = searchParams.get('tab') || 'profile';
  const navigate = useNavigate();

  const groupedMessages = React.useMemo(() => {
    const groups = {};
    messages.forEach(m => {
      const key = new Date(m.created_at).toDateString();
      if (!groups[key]) groups[key] = [];
      groups[key].push(m);
    });
    // sort keys chronologically
    const sortedKeys = Object.keys(groups).sort((a,b) => new Date(a) - new Date(b));
    return { groups, sortedKeys };
  }, [messages]);

  useEffect(() => {
    let mounted = true;

    // Fetch profile first. Messages and websocket are only loaded when tab=messages
    const start = async () => {
      const found = await fetchProfile();
      if (!found) return;

      if (tab === 'messages') {
        await fetchMessages();

        // connect websocket for real-time updates
        try {
          const token = localStorage.getItem('memora_token');
          if (!token) return;
          const wsProto = BACKEND_URL.startsWith('https') ? 'wss' : 'ws';
          const host = new URL(BACKEND_URL).host;
          const ws = new WebSocket(`${wsProto}://${host}/ws?token=${token}`);
          wsRef.current = ws;

          ws.onopen = () => {
            if (profile?.user_id) {
              ws.send(JSON.stringify({ event: 'mark_read', friend_user_id: profile.user_id }));
            }
          };

          ws.onmessage = (ev) => {
            try {
              const data = JSON.parse(ev.data);
              if (data.event === 'new_message' && data.payload) {
                const msg = data.payload;
                if ((msg.from_user_id === profile?.user_id && msg.to_user_id === localStorage.getItem('memora_user_id')) ||
                    (msg.from_user_id === localStorage.getItem('memora_user_id') && msg.to_user_id === profile?.user_id)) {
                  setMessages((prev) => [...prev, msg]);
                  setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
                }
              }

              if (data.event === 'messages_read' && data.payload) {
                const { by_user_id } = data.payload;
                if (by_user_id === profile?.user_id) {
                  setMessages((prev) => prev.map(m => {
                    if (m.from_user_id === localStorage.getItem('memora_user_id')) {
                      const read_by = m.read_by || [];
                      if (!read_by.includes(by_user_id)) read_by.push(by_user_id);
                      return { ...m, read_by };
                    }
                    return m;
                  }));
                }
              }
            } catch (e) {
              console.error('Failed to parse ws message', e);
            }
          };

          ws.onclose = () => {
            setTimeout(() => {
              if (mounted) start();
            }, 3000);
          };
        } catch (e) {
          console.error('WebSocket connection failed', e);
        }
      }
    };

    start();

    return () => {
      mounted = false;
      try { wsRef.current?.close(); } catch (e) {}
    };
  }, [username, tab]);

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem("memora_token");
      const res = await axios.get(`${API}/users/${username}`, { headers: { Authorization: `Bearer ${token}` } });
      setProfile(res.data);
      setProfileNotFound(false);
      return true;
    } catch (e) {
      console.error('fetchProfile error', e.response?.status, e.response?.data);
      const msg = e.response?.data?.detail || "Failed to fetch user";
      toast.error(msg);
      if (e.response?.status === 404) {
        setProfile(null);
        setProfileNotFound(true);
        return false;
      }
      return false;
    }
  };

  const fetchMessages = async () => {
    try {
      const token = localStorage.getItem("memora_token");
      const res = await axios.get(`${API}/messages/${username}`, { headers: { Authorization: `Bearer ${token}` } });
      setMessages(res.data);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

      // Mark messages as read on the server and notify via websocket
      try {
        await axios.post(`${API}/messages/${username}/read`, {}, { headers: { Authorization: `Bearer ${token}` } });
        try { localStorage.setItem('memora_unread_updated', String(Date.now())); } catch (e) {}
      } catch (e) {
        // ignore read-mark failures
      }

      try {
        if (wsRef.current && profile?.user_id) {
          wsRef.current.send(JSON.stringify({ event: 'mark_read', friend_user_id: profile.user_id }));
        }
      } catch (e) {
        // ignore websocket send errors
      }

    } catch (e) {
      // Do not spam errors if user is not allowed
      if (e.response?.status === 403) return;
      toast.error(e.response?.data?.detail || "Failed to fetch messages");
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    setLoading(true);
    try {
      const token = localStorage.getItem("memora_token");
      const res = await axios.post(`${API}/messages`, { to_username: username, content }, { headers: { Authorization: `Bearer ${token}` } });
      setContent("");
      // append the sent message locally for instant feedback
      setMessages(prev => [...prev, res.data]);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

      // mark as read (recipient shouldn't need this, but keep consistent behavior)
      try {
        await axios.post(`${API}/messages/${username}/read`, {}, { headers: { Authorization: `Bearer ${token}` } });
        // notify other pages (FriendsPage) to refresh unread counts
        try { localStorage.setItem('memora_unread_updated', String(Date.now())); } catch (e) {}
      } catch (e) {}

    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to send message");
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (u) => u ? u.substring(0,2).toUpperCase() : "";

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-4xl font-serif font-bold text-foreground mb-2">Profile</h1>
        <div className="flex gap-2">
          <Button size="sm" variant={tab === 'profile' ? undefined : 'outline'} onClick={() => navigate(`/dashboard/friend/${username}?tab=profile`)}>Profile</Button>
          <Button size="sm" variant={tab === 'messages' ? undefined : 'outline'} disabled={profileNotFound} onClick={() => navigate(`/dashboard/friend/${username}?tab=messages`)}>Messages</Button>
        </div>
      </div>

      {profileNotFound ? (
        <Card className="mb-6 glass-card border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <CardContent className="p-6">
            <div className="text-lg font-semibold text-foreground mb-2">Profile not found</div>
            <div className="text-sm text-muted-foreground">This user may have deleted their account or the profile is not available.</div>
            <div className="mt-4">
              <Button size="sm" variant="outline" onClick={() => navigate('/dashboard/friends')}>Back to Friends</Button>
            </div>
          </CardContent>
        </Card>
      ) : profile && (
        <Card className="mb-6 glass-card border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <CardContent className="p-6 flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-primary/10 text-primary font-bold">{getInitials(profile.username)}</AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-xl font-semibold">{profile.username}</h2>
              <p className="text-sm text-muted-foreground">Joined {format(new Date(profile.created_at), "MMMM d, yyyy")}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === 'messages' && (
        <Card className="glass-card border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <CardHeader>
            <CardTitle>Messages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[400px] overflow-y-auto mb-4 space-y-3" data-testid="messages-list">
              {groupedMessages.sortedKeys.map((key) => (
                <div key={key} className="space-y-2">
                  <div className="text-center text-xs text-muted-foreground py-1">{
                    (function renderDateHeader(dstr){
                      const date = new Date(dstr);
                      const today = new Date();
                      const yesterday = new Date();
                      yesterday.setDate(yesterday.getDate() - 1);
                      if (date.toDateString() === today.toDateString()) return 'Today';
                      if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
                      return date.toLocaleDateString();
                    })(key)
                  }</div>
                  {groupedMessages.groups[key].map((m) => (
                    <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} className={`p-3 rounded ${m.from_user_id === localStorage.getItem('memora_user_id') ? 'bg-primary/10 self-end' : 'bg-muted/5 self-start flex items-start gap-3'}`}>
                      {m.from_user_id !== localStorage.getItem('memora_user_id') && (
                        <div className="flex-shrink-0">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-primary/10 text-primary font-bold">{profile ? profile.username.substring(0,2).toUpperCase() : '??'}</AvatarFallback>
                          </Avatar>
                        </div>
                      )}
                      <div>
                        <div className="text-sm text-muted-foreground mb-1">{m.from_user_id === localStorage.getItem('memora_user_id') ? 'You' : username} • {new Date(m.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                        <div>{m.content}</div>
                        {m.from_user_id === localStorage.getItem('memora_user_id') && (
                          <div className="text-xs text-muted-foreground mt-1">{(m.read_by || []).includes(profile?.user_id) ? 'Read' : 'Sent'}</div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={sendMessage} className="flex gap-2">
              <input className="flex-1 rounded-xl border px-3 py-2" placeholder="Write a message..." value={content} onChange={(e)=>setContent(e.target.value)} />
              <Button type="submit" disabled={loading}>{loading ? 'Sending...' : 'Send'}</Button>
            </form>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
