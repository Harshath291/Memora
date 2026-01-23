import React, { useState, useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import LoginPage from "@/pages/LoginPage";
import SignupPage from "@/pages/SignupPage";
import WelcomePage from "@/pages/WelcomePage";
import DashboardLayout from "@/components/DashboardLayout";
import NewNotePage from "@/pages/NewNotePage";
import PastNotesPage from "@/pages/PastNotesPage";
import NoteDetailPage from "@/pages/NoteDetailPage";
import OnThisDayPage from "@/pages/OnThisDayPage";
import RemindersPage from "@/pages/RemindersPage";
import FriendsPage from "@/pages/FriendsPage";
import CheckboxNotesPage from "@/pages/CheckboxNotesPage";
import FriendProfilePage from "@/pages/FriendProfilePage";


const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem("memora_token");
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route
            path="/welcome"
            element={
              <ProtectedRoute>
                <WelcomePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="new-note" element={<NewNotePage />} />
            <Route path="past-notes" element={<PastNotesPage />} />
            <Route path="note/:noteId" element={<NoteDetailPage />} />
            <Route path="on-this-day" element={<OnThisDayPage />} />
            <Route path="reminders" element={<RemindersPage />} />
            <Route path="friends" element={<FriendsPage />} />
            <Route path="friend/:username" element={<FriendProfilePage />} />
            <Route path="checkbox-notes" element={<CheckboxNotesPage />} />
          </Route>
          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-center" richColors />
    </div>
  );
}

export default App;