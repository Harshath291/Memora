import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";

import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Avatar, AvatarFallback } from "../components/ui/avatar";

import axios from "axios";
import { toast } from "sonner";
import { Users, Plus, UserPlus } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function FriendsPage() {
  const [friends, setFriends] = useState([]);
  const [friendUsername, setFriendUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchFriends();
    fetchUnreadCounts();
    fetchRequests();

    const onStorage = (e) => {
      if (e.key === 'memora_unread_updated') {
        fetchUnreadCounts();
      }
      if (e.key === 'memora_requests_updated') {
        fetchRequests();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const fetchFriends = async () => {
    try {
      const token = localStorage.getItem("memora_token");
      const response = await axios.get(`${API}/friends`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setFriends(response.data);
    } catch (error) {
      toast.error("Failed to fetch friends");
    }
  };

  const fetchUnreadCounts = async () => {
    try {
      const token = localStorage.getItem("memora_token");
      const res = await axios.get(`${API}/messages/unread_counts`, { headers: { Authorization: `Bearer ${token}` } });
      const map = {};
      res.data.forEach(r => {
        map[r.friend_username] = r.count;
      });
      setUnreadCounts(map);
    } catch (e) {
      // ignore errors here
    }
  };

  const handleAddFriend = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem("memora_token");
      await axios.post(
        `${API}/friend-requests`,
        { to_username: friendUsername },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success("Friend request sent!");
      setFriendUsername("");
      setShowForm(false);
      fetchRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to send request");
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (username) => {
    return username.substring(0, 2).toUpperCase();
  };

  const fetchRequests = async () => {
    try {
      const token = localStorage.getItem('memora_token');
      const inc = await axios.get(`${API}/friend-requests?direction=incoming`, { headers: { Authorization: `Bearer ${token}` } });
      const out = await axios.get(`${API}/friend-requests?direction=outgoing`, { headers: { Authorization: `Bearer ${token}` } });
      setIncomingRequests(inc.data);
      setOutgoingRequests(out.data);
    } catch (e) {
      // ignore
    }
  };

  const acceptRequest = async (reqId) => {
    try {
      const token = localStorage.getItem('memora_token');
      await axios.post(`${API}/friend-requests/${reqId}/accept`, {}, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Friend added');
      fetchRequests();
      fetchFriends();
      try { localStorage.setItem('memora_requests_updated', String(Date.now())); } catch (e) {}
    } catch (e) { toast.error('Failed to accept'); }
  };

  const declineRequest = async (reqId) => {
    try {
      const token = localStorage.getItem('memora_token');
      await axios.post(`${API}/friend-requests/${reqId}/decline`, {}, { headers: { Authorization: `Bearer ${token}` } });
      toast('Request declined');
      fetchRequests();
      try { localStorage.setItem('memora_requests_updated', String(Date.now())); } catch (e) {}
    } catch (e) { toast.error('Failed to decline'); }
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
            <Users className="w-8 h-8 text-primary" />
            Friends
          </h1>
          <p className="text-muted-foreground">Your memory community</p>
        </div>
        <Button
          data-testid="add-friend-button"
          onClick={() => setShowForm(!showForm)}
          className="rounded-full btn-hover"
        >
          <Plus className="mr-2 h-5 w-5" />
          Add Friend
        </Button>
      </div>

      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Card data-testid="friend-form" className="glass-card border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <CardHeader>
              <CardTitle className="text-2xl font-serif">Add Friend</CardTitle>
              <CardDescription>Send a friend request — recipient can accept or decline</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddFriend} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="friend-username">Username</Label>
                  <Input
                    id="friend-username"
                    data-testid="friend-username-input"
                    type="text"
                    placeholder="Enter friend's username"
                    value={friendUsername}
                    onChange={(e) => setFriendUsername(e.target.value)}
                    required
                    className="rounded-xl h-12"
                  />
                </div>
                <div className="flex gap-3">
                  <Button
                    type="submit"
                    data-testid="save-friend-button"
                    className="rounded-full btn-hover flex-1"
                    disabled={loading}
                  >
                    {loading ? "Sending..." : "Send Request"}
                  </Button>
                  <Button
                    type="button"
                    data-testid="cancel-friend-button"
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

      <div className="mb-6">
        {incomingRequests.length > 0 && (
          <Card className="mb-4 glass-card border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <CardHeader>
              <CardTitle className="text-lg">Friend Requests</CardTitle>
              <CardDescription>{incomingRequests.length} incoming request(s)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {incomingRequests.map(r => (
                  <div key={r.id} className="flex items-center justify-between p-3 rounded bg-muted/5">
                    <div>
                      <div className="font-semibold">{r.from_username}</div>
                      <div className="text-sm text-muted-foreground">Sent on {new Date(r.created_at).toLocaleDateString()}</div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => acceptRequest(r.id)}>Accept</Button>
                      <Button size="sm" variant="outline" onClick={() => declineRequest(r.id)}>Decline</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {outgoingRequests.length > 0 && (
          <Card className="mb-4 glass-card border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <CardHeader>
              <CardTitle className="text-lg">Pending Requests</CardTitle>
              <CardDescription>{outgoingRequests.length} pending request(s)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {outgoingRequests.map(r => (
                  <div key={r.id} className="flex items-center justify-between p-3 rounded bg-muted/5">
                    <div>
                      <div className="font-semibold">{r.to_username}</div>
                      <div className="text-sm text-muted-foreground">Sent on {new Date(r.created_at).toLocaleDateString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div data-testid="friends-list" className="grid gap-4">
        {friends.length === 0 ? (
          <Card data-testid="empty-friends" className="glass-card border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <CardContent className="py-12 text-center">
              <UserPlus className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-lg text-muted-foreground">No friends yet</p>
            </CardContent>
          </Card>
        ) : (
          friends.map((friend, index) => (
            <motion.div
              key={friend.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card
                data-testid={`friend-item-${friend.id}`}
                className="glass-card border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
              >
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-primary/10 text-primary font-bold">
                        {getInitials(friend.friend_username)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                        {friend.friend_username}
                        {unreadCounts[friend.friend_username] > 0 && (
                          <span className="inline-flex items-center justify-center bg-primary text-white text-xs rounded-full h-6 w-6">{unreadCounts[friend.friend_username]}</span>
                        )}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Friends since {format(new Date(friend.added_at), "MMMM yyyy")}
                      </p>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => navigate(`/dashboard/friend/${friend.friend_username}?tab=profile`)}>View Profile</Button>
                      <Button size="sm" onClick={() => navigate(`/dashboard/friend/${friend.friend_username}?tab=messages`)}>Message</Button>
                      <Button size="sm" variant="destructive" onClick={async () => {
                        const ok = window.confirm(`Remove ${friend.friend_username} from your friends?`);
                        if (!ok) return;
                        try {
                          const token = localStorage.getItem('memora_token');
                          await axios.delete(`${API}/friends/${friend.friend_username}`, { headers: { Authorization: `Bearer ${token}` } });
                          toast.success('Friend removed');
                          fetchFriends();
                        } catch (e) {
                          toast.error(e.response?.data?.detail || 'Failed to remove friend');
                        }
                      }}>Remove</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))
        )}
      </div>
    </motion.div>
  );
}