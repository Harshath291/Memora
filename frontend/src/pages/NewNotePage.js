import React, { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import axios from "axios";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function NewNotePage() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Theme and attachments
  const themes = [
    { id: "default", label: "Default", bg: "#ffffff" },
    { id: "rose", label: "Rose", bg: "#fff1f0" },
    { id: "mint", label: "Mint", bg: "#f0fff4" },
    { id: "sky", label: "Sky", bg: "#f0f9ff" },
    { id: "lavender", label: "Lavender", bg: "#f5f3ff" },
  ];
  const themesMap = themes.reduce((acc, t) => ({ ...acc, [t.id]: t.bg }), {});
  const [selectedTheme, setSelectedTheme] = useState(themes[0].id);
  const fonts = [
    { id: 'system', label: 'System', css: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial' },
    { id: 'serif', label: 'Serif', css: 'Georgia, "Times New Roman", Times, serif' },
    { id: 'sans', label: 'Sans', css: 'Poppins, Roboto, Inter, system-ui, -apple-system, "Segoe UI", Arial' },
    { id: 'poppins', label: 'Poppins', css: 'Poppins, system-ui, -apple-system, Arial' },
    { id: 'roboto', label: 'Roboto', css: 'Roboto, system-ui, -apple-system, Arial' },
    { id: 'merriweather', label: 'Merriweather', css: 'Merriweather, Georgia, serif' },
    { id: 'lora', label: 'Lora', css: 'Lora, Georgia, serif' },
    { id: 'playfair', label: 'Playfair Display', css: 'Playfair Display, Georgia, serif' },
    { id: 'dancing', label: 'Dancing Script', css: 'Dancing Script, cursive' },
    { id: 'montserrat', label: 'Montserrat', css: 'Montserrat, system-ui, -apple-system, Arial' },
    { id: 'raleway', label: 'Raleway', css: 'Raleway, system-ui, -apple-system, Arial' },
    { id: 'courierprime', label: 'Courier Prime', css: 'Courier Prime, Monaco, monospace' },
    { id: 'mono', label: 'Mono', css: 'Menlo, Monaco, "Courier New", monospace' },
  ];
  const fontsMap = fonts.reduce((acc, f) => ({ ...acc, [f.id]: f.css }), {});
  const [selectedFont, setSelectedFont] = useState(fonts[0].id);
  const [attachments, setAttachments] = useState([]); // {type, name, url}
  const fileInputRef = React.useRef(null);

  const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    const results = await Promise.all(
      files.map(async (f) => {
        const url = await readFileAsDataUrl(f);
        const type = f.type.startsWith("image") ? "image" : f.type.startsWith("video") ? "video" : "other";
        return { type, name: f.name, url };
      }),
    );
    setAttachments((prev) => [...prev, ...results]);
  };

  const removeAttachment = (index) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFileButton = () => fileInputRef.current && fileInputRef.current.click();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem("memora_token");
      await axios.post(
        `${API}/notes`,
        { title, content, theme: selectedTheme, font: selectedFont, attachments },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success("Note saved successfully!");
      setTitle("");
      setContent("");
      setSelectedTheme(themes[0].id);
      setAttachments([]);
      navigate("/dashboard/past-notes");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save note");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-4xl mx-auto"
    >
      <div className="mb-8">
        <h1 className="text-4xl font-serif font-bold text-foreground mb-2 flex items-center gap-3">
          <Sparkles className="w-8 h-8 text-primary" />
          New Note
        </h1>
        <p className="text-muted-foreground">Capture your thoughts and memories</p>
      </div>

      <Card data-testid="new-note-card" className="glass-card border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        <CardHeader>
          <CardTitle className="text-2xl font-serif">Write Your Story</CardTitle>
          <CardDescription>Every moment deserves to be remembered</CardDescription>
        </CardHeader>
        <CardContent>

          {/* Live preview */}
          <div className="mb-6">
            <div className="text-sm text-muted-foreground mb-2">Preview (updates while typing)</div>
            <Card className="border-none shadow-[0_8px_20px_rgb(0,0,0,0.04)]" style={{ background: themesMap[selectedTheme] }}>
              <CardContent className="p-4">
                <h3 className="text-lg font-serif font-semibold mb-2" style={{ fontFamily: fontsMap[selectedFont] }}>{title || "Untitled"}</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap" style={{ fontFamily: fontsMap[selectedFont], fontSize: 14 }}>{content || "Start writing your memory..."}</p>

                {attachments.length > 0 && (
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    {attachments.map((a, i) => (
                      <div key={i} className="rounded overflow-hidden border">
                        {a.type === 'image' ? (
                          <img src={a.url} alt={a.name} className="w-full h-24 object-cover" />
                        ) : a.type === 'video' ? (
                          <video src={a.url} className="w-full h-24 object-cover" controls />
                        ) : (
                          <div className="p-3 text-sm">{a.name}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

              </CardContent>
            </Card>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-base font-semibold">Title</Label>
              <Input
                id="title"
                data-testid="note-title-input"
                type="text"
                placeholder="Give your note a title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="rounded-xl h-14 text-lg"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content" className="text-base font-semibold">Content</Label>
              <Textarea
                id="content"
                data-testid="note-content-input"
                placeholder="Start writing your thoughts..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
                className="rounded-xl min-h-[300px] text-base leading-relaxed"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-base font-semibold">Theme</Label>
              <div className="flex items-center gap-3">
                {themes.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTheme(t.id)}
                    className={`w-10 h-10 rounded-lg border ${selectedTheme === t.id ? 'ring-2 ring-offset-2 ring-primary' : ''}`}
                    style={{ background: t.bg }}
                    aria-label={`Select ${t.label}`}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-base font-semibold">Font</Label>
              <div className="flex items-center gap-3">
                <select
                  aria-label="Select font"
                  className="rounded-lg border px-3 py-2 text-sm"
                  value={selectedFont}
                  onChange={(e) => setSelectedFont(e.target.value)}
                >
                  {fonts.map((f) => (
                    <option key={f.id} value={f.id}>{f.label}</option>
                  ))}
                </select>
                <div className="text-sm text-muted-foreground ml-2" style={{ fontFamily: fontsMap[selectedFont] }}>
                  Sample: The quick brown fox
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-base font-semibold">Attachments</Label>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  ref={fileInputRef}
                  onChange={(e) => handleFiles(e.target.files)}
                  className="hidden"
                />
                <Button type="button" onClick={handleFileButton} variant="outline">Add Images / Videos</Button>
                <span className="text-sm text-muted-foreground">Max recommended size per file: 10MB</span>
              </div>

              <div className="grid grid-cols-3 gap-3 mt-3">
                {attachments.map((a, i) => (
                  <div key={i} className="relative rounded-lg overflow-hidden border">
                    {a.type === 'image' ? (
                      <img src={a.url} alt={a.name} className="w-full h-24 object-cover" />
                    ) : a.type === 'video' ? (
                      <video src={a.url} className="w-full h-24 object-cover" controls />
                    ) : (
                      <div className="p-4">{a.name}</div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeAttachment(i)}
                      className="absolute top-1 right-1 bg-white rounded-full p-1 shadow"
                      aria-label="Remove attachment"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <Button
              type="submit"
              data-testid="save-note-button"
              size="lg"
              className="w-full rounded-full h-14 text-lg font-bold btn-hover"
              disabled={loading}
            >
              {loading ? "Saving..." : "Save Note"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}