import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";

import { Button } from "./button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Checkbox } from "../components/ui/checkbox";

import axios from "axios";
import { toast } from "sonner";
import { CheckSquare, Plus, X } from "lucide-react";


const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function CheckboxNotesPage() {
  const [notes, setNotes] = useState([]);
  const [title, setTitle] = useState("");
  const [items, setItems] = useState([{ text: "", checked: false }]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchNotes();
  }, []);

  const fetchNotes = async () => {
    try {
      const token = localStorage.getItem("memora_token");
      const response = await axios.get(`${API}/checkbox-notes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotes(response.data);
    } catch (error) {
      toast.error("Failed to fetch checkbox notes");
    }
  };

  const handleAddItem = () => {
    setItems([...items, { text: "", checked: false }]);
  };

  const handleRemoveItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index, value) => {
    const newItems = [...items];
    newItems[index].text = value;
    setItems(newItems);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const validItems = items.filter((item) => item.text.trim() !== "");
    if (validItems.length === 0) {
      toast.error("Please add at least one item");
      setLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem("memora_token");
      await axios.post(
        `${API}/checkbox-notes`,
        { title, items: validItems },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success("Checkbox note created!");
      setTitle("");
      setItems([{ text: "", checked: false }]);
      setShowForm(false);
      fetchNotes();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create note");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleItem = async (noteId, itemIndex, currentItems) => {
    try {
      const token = localStorage.getItem("memora_token");
      const updatedItems = currentItems.map((item, i) =>
        i === itemIndex ? { ...item, checked: !item.checked } : item
      );

      const note = notes.find((n) => n.id === noteId);
      await axios.put(
        `${API}/checkbox-notes/${noteId}`,
        { title: note.title, items: updatedItems },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      fetchNotes();
    } catch (error) {
      toast.error("Failed to update item");
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
            <CheckSquare className="w-8 h-8 text-primary" />
            Checkbox Notes
          </h1>
          <p className="text-muted-foreground">Track your tasks and goals</p>
        </div>
        <Button
          data-testid="add-checkbox-note-button"
          onClick={() => setShowForm(!showForm)}
          className="rounded-full btn-hover"
        >
          <Plus className="mr-2 h-5 w-5" />
          New List
        </Button>
      </div>

      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Card data-testid="checkbox-note-form" className="glass-card border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <CardHeader>
              <CardTitle className="text-2xl font-serif">New Checkbox Note</CardTitle>
              <CardDescription>Create a checklist for your tasks</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="checkbox-note-title">Title</Label>
                  <Input
                    id="checkbox-note-title"
                    data-testid="checkbox-note-title-input"
                    type="text"
                    placeholder="Give your list a title..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    className="rounded-xl h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Items</Label>
                  {items.map((item, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        data-testid={`checkbox-item-input-${index}`}
                        type="text"
                        placeholder={`Item ${index + 1}`}
                        value={item.text}
                        onChange={(e) => handleItemChange(index, e.target.value)}
                        className="rounded-xl h-12"
                      />
                      {items.length > 1 && (
                        <Button
                          type="button"
                          data-testid={`remove-item-button-${index}`}
                          variant="outline"
                          size="icon"
                          onClick={() => handleRemoveItem(index)}
                          className="rounded-xl"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    data-testid="add-item-button"
                    variant="outline"
                    onClick={handleAddItem}
                    className="w-full rounded-xl"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Item
                  </Button>
                </div>
                <div className="flex gap-3">
                  <Button
                    type="submit"
                    data-testid="save-checkbox-note-button"
                    className="rounded-full btn-hover flex-1"
                    disabled={loading}
                  >
                    {loading ? "Creating..." : "Create List"}
                  </Button>
                  <Button
                    type="button"
                    data-testid="cancel-checkbox-note-button"
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

      <div data-testid="checkbox-notes-list" className="grid gap-4">
        {notes.length === 0 ? (
          <Card data-testid="empty-checkbox-notes" className="glass-card border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <CardContent className="py-12 text-center">
              <CheckSquare className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-lg text-muted-foreground">No checkbox notes yet</p>
            </CardContent>
          </Card>
        ) : (
          notes.map((note, index) => (
            <motion.div
              key={note.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card
                data-testid={`checkbox-note-item-${note.id}`}
                className="glass-card border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
              >
                <CardContent className="p-6">
                  <h3 className="text-xl font-serif font-semibold text-foreground mb-4">
                    {note.title}
                  </h3>
                  <div className="space-y-3">
                    {note.items.map((item, itemIndex) => (
                      <div
                        key={itemIndex}
                        className="flex items-center space-x-3"
                        data-testid={`checkbox-item-${note.id}-${itemIndex}`}
                      >
                        <Checkbox
                          data-testid={`checkbox-${note.id}-${itemIndex}`}
                          checked={item.checked}
                          onCheckedChange={() =>
                            handleToggleItem(note.id, itemIndex, note.items)
                          }
                          className="rounded-md"
                        />
                        <span
                          className={`text-base ${
                            item.checked
                              ? "line-through text-muted-foreground"
                              : "text-foreground"
                          }`}
                        >
                          {item.text}
                        </span>
                      </div>
                    ))}
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