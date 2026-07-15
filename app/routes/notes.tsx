import { useState, useEffect, useRef } from "react";
import { useLoaderData, useFetcher, useSearchParams, useNavigate, useBlocker } from "react-router";
import { format } from "date-fns";
import {
  Plus,
  Trash2,
  Edit2,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  FileText,
  Eye,
  Edit3,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import type { Route } from "./+types/notes";

const PAGE_SIZE = 5;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseMarkdown(text: string) {
  if (!text) return "";
  
  // Escape HTML first to prevent XSS
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Code blocks: ```code```
  html = html.replace(/```([\s\S]*?)```/g, '<pre class="bg-gray-100 p-3 rounded-md my-2 overflow-x-auto font-mono text-xs border border-gray-200">$1</pre>');

  // Inline code: `code`
  html = html.replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded-md font-mono text-xs border border-gray-200">$1</code>');

  // Headers: # Header
  html = html.replace(/^# (.*?)$/gm, '<h1 class="text-xl font-bold mt-4 mb-2">$1</h1>');
  html = html.replace(/^## (.*?)$/gm, '<h2 class="text-lg font-bold mt-3 mb-2">$1</h2>');
  html = html.replace(/^### (.*?)$/gm, '<h3 class="text-md font-bold mt-2 mb-1">$1</h3>');

  // Bold: **text**
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Italics: *text*
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Bullet lists: - item or * item
  html = html.replace(/^\s*[-*]\s+(.*?)$/gm, '<li class="ml-4 list-disc">$1</li>');

  // Blockquotes: > text
  html = html.replace(/^&gt;\s+(.*?)$/gm, '<blockquote class="border-l-4 border-gray-300 pl-3 italic my-2 text-muted-foreground">$1</blockquote>');

  // Links: [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">$1</a>');

  // Newlines handling
  const lines = html.split('\n');
  const processedLines = lines.map(line => {
    if (!line.trim()) return '<div class="h-2"></div>';
    if (line.startsWith('<h') || line.startsWith('<li') || line.startsWith('<pre') || line.startsWith('<blockquote') || line.startsWith('<div')) {
      return line;
    }
    return `<p class="my-1.5 leading-relaxed">${line}</p>`;
  });

  return processedLines.join('\n');
}

// ─── Loader & Action ──────────────────────────────────────────────────────────

export async function loader({ request, context }: Route.LoaderArgs) {
  const db = context.cloudflare.env.DB;
  const url = new URL(request.url);
  
  const search = url.searchParams.get("search") || "";
  const projectId = url.searchParams.get("projectId") || "all";
  const page = parseInt(url.searchParams.get("page") || "1", 10);

  // Fetch available projects
  const { results: rawProjects } = await db
    .prepare("SELECT id, name, color_hex FROM projects WHERE is_archived = 0 ORDER BY name ASC")
    .all();
  const projects = rawProjects || [];

  // Build filter sql for notes count and list
  let whereClause = " WHERE 1=1";
  const params: any[] = [];

  if (search) {
    whereClause += " AND (n.title LIKE ? OR n.content LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }

  if (projectId && projectId !== "all") {
    whereClause += " AND n.project_id = ?";
    params.push(projectId);
  }

  // Count total matching notes
  const countSql = `SELECT COUNT(*) as total FROM notes n${whereClause}`;
  const countResult = await db.prepare(countSql).bind(...params).first();
  const totalNotes = countResult ? (countResult as any).total : 0;
  const totalPages = Math.max(1, Math.ceil(totalNotes / PAGE_SIZE));

  // Fetch paginated notes
  const notesSql = `
    SELECT n.*, p.name as project_name, p.color_hex as project_color 
    FROM notes n 
    LEFT JOIN projects p ON n.project_id = p.id 
    ${whereClause} 
    ORDER BY n.updated_at DESC 
    LIMIT ? OFFSET ?
  `;
  
  const limitParams = [...params, PAGE_SIZE, (page - 1) * PAGE_SIZE];
  const { results: rawNotes } = await db.prepare(notesSql).bind(...limitParams).all();
  const notes = (rawNotes || []).map((n: any) => ({
    id: n.id,
    title: n.title,
    content: n.content,
    projectId: n.project_id,
    projectName: n.project_name,
    projectColor: n.project_color,
    createdAt: n.created_at,
    updatedAt: n.updated_at,
  }));

  return {
    notes,
    projects,
    totalNotes,
    totalPages,
    currentPage: page,
    filters: { search, projectId },
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const db = context.cloudflare.env.DB;
  const formData = await request.formData();
  const intent = formData.get("intent");

  const now = new Date().toISOString();

  if (intent === "create-note") {
    const title = formData.get("title") as string;
    const content = formData.get("content") as string;
    const projectId = formData.get("projectId") as string;
    const noteId = crypto.randomUUID();

    await db
      .prepare(
        "INSERT INTO notes (id, title, content, project_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
      )
      .bind(noteId, title || "Untitled Note", content || "", projectId === "none" ? null : projectId, now, now)
      .run();

    return { success: true, action: "create", noteId };
  }

  if (intent === "update-note") {
    const id = formData.get("id") as string;
    const title = formData.get("title") as string;
    const content = formData.get("content") as string;
    const projectId = formData.get("projectId") as string;

    await db
      .prepare(
        "UPDATE notes SET title = ?, content = ?, project_id = ?, updated_at = ? WHERE id = ?"
      )
      .bind(title || "Untitled Note", content || "", projectId === "none" ? null : projectId, now, id)
      .run();

    return { success: true, action: "update", noteId: id };
  }

  if (intent === "delete-note") {
    const id = formData.get("id") as string;
    await db.prepare("DELETE FROM notes WHERE id = ?").bind(id).run();
    return { success: true, action: "delete" };
  }

  return { success: false };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function NotesRoute() {
  const { notes, projects, totalPages, currentPage, filters } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const fetcher = useFetcher<any>();

  // Search local states (no auto-submit, press Enter to execute)
  const [searchVal, setSearchVal] = useState(filters.search);
  const [selectedProjFilter, setSelectedProjFilter] = useState(filters.projectId);

  // Dialog & Editor states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState<any | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [noteProject, setNoteProject] = useState("none");
  const [editorMode, setEditorMode] = useState<"edit" | "preview">("edit");

  const isSubmitting = fetcher.state === "submitting";

  // Check if form currently has unsaved changes
  const hasUnsavedChanges = isEditing && (
    isCreating
      ? (noteTitle !== "" || noteContent !== "" || noteProject !== "none")
      : (noteTitle !== (selectedNote?.title ?? "") ||
         noteContent !== (selectedNote?.content ?? "") ||
         noteProject !== (selectedNote?.projectId ?? "none"))
  );

  // ── Unload Warning ──
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // ── Navigation Blocker (React Router) ──
  const blocker = useBlocker(
    ({ nextLocation }) => hasUnsavedChanges
  );

  // Sync state if selectedNote updates from server loader data
  useEffect(() => {
    if (selectedNote) {
      const updated = notes.find((n) => n.id === selectedNote.id);
      if (updated) {
        setSelectedNote(updated);
        if (!isEditing) {
          setNoteTitle(updated.title);
          setNoteContent(updated.content);
          setNoteProject(updated.projectId || "none");
        }
      }
    }
  }, [notes, selectedNote, isEditing]);

  // Handle action callbacks
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.success) {
      if (fetcher.data.action === "create") {
        toast.success("Note created!");
        setIsDialogOpen(false);
        setIsCreating(false);
        setIsEditing(false);
        navigate(`/notes?page=1`);
      } else if (fetcher.data.action === "update") {
        toast.success("Note updated!");
        setIsEditing(false);
        setEditorMode("preview");
      } else if (fetcher.data.action === "delete") {
        toast.success("Note deleted.");
        setIsDialogOpen(false);
        setSelectedNote(null);
        setIsCreating(false);
        setIsEditing(false);
      }
    }
  }, [fetcher.state, fetcher.data, navigate]);

  // Sync search local states on parameter changes
  useEffect(() => {
    setSearchVal(filters.search);
    setSelectedProjFilter(filters.projectId);
  }, [filters.search, filters.projectId]);

  const selectNote = (note: any) => {
    setSelectedNote(note);
    setNoteTitle(note.title);
    setNoteContent(note.content);
    setNoteProject(note.projectId || "none");
    setIsEditing(false);
    setIsCreating(false);
    setEditorMode("preview");
    setIsDialogOpen(true);
  };

  const handleStartCreate = () => {
    setSelectedNote(null);
    setNoteTitle("");
    setNoteContent("");
    setNoteProject("none");
    setIsCreating(true);
    setIsEditing(true);
    setEditorMode("edit");
    setIsDialogOpen(true);
  };

  const handleStartEdit = () => {
    setIsEditing(true);
    setEditorMode("edit");
  };

  const handleCancel = () => {
    if (isCreating) {
      setIsCreating(false);
      setIsEditing(false);
      setIsDialogOpen(false);
    } else {
      setIsEditing(false);
      setEditorMode("preview");
      if (selectedNote) {
        setNoteTitle(selectedNote.title);
        setNoteContent(selectedNote.content);
        setNoteProject(selectedNote.projectId || "none");
      }
    }
  };

  const handleSave = () => {
    if (!noteTitle.trim()) {
      toast.error("Please enter a note title.");
      return;
    }
    const fd = new FormData();
    fd.append("intent", isCreating ? "create-note" : "update-note");
    if (!isCreating && selectedNote) {
      fd.append("id", selectedNote.id);
    }
    fd.append("title", noteTitle);
    fd.append("content", noteContent);
    fd.append("projectId", noteProject);

    // Turn off blocker hooks before submitting
    setIsEditing(false);
    setIsCreating(false);

    fetcher.submit(fd, { method: "post", action: "/notes" });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Are you sure you want to delete this note?")) return;
    const fd = new FormData();
    fd.append("intent", "delete-note");
    fd.append("id", id);
    fetcher.submit(fd, { method: "post", action: "/notes" });
  };

  const handleDownload = () => {
    if (!selectedNote) return;
    const blob = new Blob([selectedNote.content], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    
    const safeTitle = selectedNote.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "note";
      
    link.setAttribute("download", `${safeTitle}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Markdown file downloaded!");
  };

  const handleDialogCloseAttempt = () => {
    if (hasUnsavedChanges) {
      if (confirm("You have unsaved changes. Discard changes and close?")) {
        handleCancel();
        setIsDialogOpen(false);
      }
    } else {
      handleCancel();
      setIsDialogOpen(false);
    }
  };

  const applyFilters = (search: string, projId: string) => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (projId && projId !== "all") params.set("projectId", projId);
    params.set("page", "1");
    setSearchParams(params);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(newPage));
    setSearchParams(params);
  };

  return (
    <AppLayout title="Obsidian Notes">
      <div className="max-w-2xl mx-auto space-y-4">
        
        {/* Top Header Actions */}
        <div className="flex flex-row justify-between items-center gap-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">My Notes</h2>
          <Button
            onClick={handleStartCreate}
            className="rounded-md text-xs gap-1.5 h-9 font-semibold"
          >
            <Plus className="w-4 h-4" />
            Create Note
          </Button>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-white border border-gray-200 rounded-md p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Search Input */}
          <div className="space-y-1 relative">
            <Label htmlFor="search-notes" className="text-[10px] uppercase font-bold text-muted-foreground">
              Search (Hit Enter)
            </Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                id="search-notes"
                type="text"
                placeholder="Type & hit Enter..."
                value={searchVal}
                onChange={(e) => setSearchVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    applyFilters(searchVal, selectedProjFilter);
                  }
                }}
                className="pl-8 rounded-md border-gray-200 h-8 text-xs focus:border-primary"
              />
            </div>
          </div>

          {/* Project Filter */}
          <div className="space-y-1">
            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Project Filter</Label>
            <select
              value={selectedProjFilter}
              onChange={(e) => {
                setSelectedProjFilter(e.target.value);
                applyFilters(searchVal, e.target.value);
              }}
              className="w-full text-xs font-semibold bg-white border border-gray-200 rounded-md h-8 px-2.5 outline-none text-foreground cursor-pointer"
            >
              <option value="all">All Projects</option>
              {projects.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Notes List */}
        <div className="space-y-2">
          {notes.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-200 rounded-md py-16 text-center flex flex-col items-center justify-center gap-4">
              <div className="w-12 h-12 bg-muted/40 rounded-full flex items-center justify-center text-muted-foreground">
                <FileText className="w-6 h-6" />
              </div>
              <div className="space-y-1 px-4 max-w-sm">
                <p className="text-sm font-bold text-foreground">No notes found</p>
                <p className="text-xs text-muted-foreground">Change your search queries or create a new markdown note.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {notes.map((note) => {
                const formattedDate = format(new Date(note.updatedAt), "MMM d, yyyy");
                return (
                  <button
                    key={note.id}
                    onClick={() => selectNote(note)}
                    className="w-full text-left bg-white border border-gray-200 rounded-md p-4 flex flex-col gap-2 hover:border-primary/20 hover:bg-gray-50/50 transition-all duration-200"
                  >
                    <div className="flex justify-between items-start gap-2 w-full">
                      <span className="text-sm font-bold text-foreground line-clamp-1 flex-1">
                        {note.title}
                      </span>
                      <span className="text-[10px] text-muted-foreground shrink-0 font-semibold mt-0.5">
                        {formattedDate}
                      </span>
                    </div>

                    {note.content && (
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed font-mono">
                        {note.content.replace(/[#*`>]/g, "")}
                      </p>
                    )}

                    {note.projectName && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: note.projectColor || "#ccc" }}
                        />
                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                          {note.projectName}
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-3 px-1">
              <span className="text-xs text-muted-foreground font-semibold">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="w-8 h-8 border border-gray-200 rounded-md"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => handlePageChange(p)}
                    className={cn(
                      "w-8 h-8 rounded-md text-xs font-semibold transition-colors",
                      p === currentPage
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-gray-100"
                    )}
                  >
                    {p}
                  </button>
                ))}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="w-8 h-8 border border-gray-200 rounded-md"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Pop-Up Dialog: Preview / Editing ── */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) handleDialogCloseAttempt(); }}>
        <DialogContent
          className="max-w-[95vw] sm:max-w-2xl rounded-md p-6 max-h-[90vh] overflow-y-auto flex flex-col gap-4"
        >
          {isEditing ? (
            /* ── EDIT / CREATE MODE ── */
            <>
              <DialogHeader className="flex flex-row items-center justify-between border-b border-gray-200 pb-3">
                <DialogTitle className="text-base font-bold flex items-center gap-2">
                  {isCreating ? "Create Note" : "Edit Note"}
                  {hasUnsavedChanges && (
                    <span className="bg-amber-100 text-amber-800 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse border border-amber-200 shrink-0">
                      Unsaved
                    </span>
                  )}
                </DialogTitle>

                {/* Edit / Preview Tabs toggle */}
                <div className="flex items-center gap-1 border border-gray-200 rounded-md p-0.5 mr-6">
                  <button
                    type="button"
                    onClick={() => setEditorMode("edit")}
                    className={cn(
                      "flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-sm transition-all",
                      editorMode === "edit"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Edit3 className="w-3 h-3" />
                    Type
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorMode("preview")}
                    className={cn(
                      "flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-sm transition-all",
                      editorMode === "preview"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Eye className="w-3 h-3" />
                    Preview
                  </button>
                </div>
              </DialogHeader>

              <div className="space-y-4 flex-1 flex flex-col min-h-[300px]">
                {/* Title Input */}
                <div className="space-y-1.5">
                  <Label htmlFor="note-title" className="text-xs font-semibold text-foreground">
                    Title <span className="text-destructive font-bold">*</span>
                  </Label>
                  <Input
                    id="note-title"
                    value={noteTitle}
                    onChange={(e) => setNoteTitle(e.target.value)}
                    placeholder="Note Title..."
                    className="border-gray-200 focus:border-primary font-bold text-sm h-9 rounded-md w-full"
                  />
                </div>

                {/* Project selector */}
                <div className="space-y-1.5">
                  <Label htmlFor="note-project-select" className="text-xs font-semibold text-foreground">Project (Optional)</Label>
                  <select
                    id="note-project-select"
                    value={noteProject}
                    onChange={(e) => setNoteProject(e.target.value)}
                    className="w-full text-xs font-semibold bg-white border border-gray-200 rounded-md h-9 px-2.5 outline-none text-foreground cursor-pointer"
                  >
                    <option value="none">None</option>
                    {projects.map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Textarea or Preview Workspace */}
                <div className="flex-1 flex flex-col min-h-[220px]">
                  <Label className="text-xs font-semibold text-foreground mb-1.5">Note Content (Markdown)</Label>
                  {editorMode === "edit" ? (
                    <Textarea
                      value={noteContent}
                      onChange={(e) => setNoteContent(e.target.value)}
                      placeholder="Write your note content in markdown format..."
                      className="flex-1 w-full p-4 font-mono text-xs border border-gray-200 rounded-md focus:border-primary resize-y min-h-[180px] h-full"
                    />
                  ) : (
                    <div className="flex-1 w-full p-4 font-mono text-xs border border-gray-200 rounded-md bg-gray-50/50 overflow-y-auto max-h-[300px] min-h-[180px]">
                      {noteContent ? (
                        <div
                          className="prose prose-xs max-w-none break-words"
                          dangerouslySetInnerHTML={{ __html: parseMarkdown(noteContent) }}
                        />
                      ) : (
                        <em className="text-muted-foreground text-xs">Empty note content. Use Type mode to write.</em>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="border-t border-gray-200 pt-4 gap-2 flex-row justify-end mt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleCancel}
                  disabled={isSubmitting}
                  className="rounded-md h-8 text-xs text-muted-foreground hover:bg-gray-100 flex-1 sm:flex-none"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={isSubmitting}
                  className="rounded-md h-8 text-xs font-semibold flex-1 sm:flex-none"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                      Saving...
                    </>
                  ) : (
                    "Save Note"
                  )}
                </Button>
              </DialogFooter>
            </>
          ) : (
            /* ── VIEW / PREVIEW MODE ── */
            <>
              <DialogHeader className="flex flex-row items-center justify-between border-b border-gray-200 pb-3">
                <div className="flex-1 min-w-0 space-y-1 text-left">
                  <DialogTitle className="text-base font-extrabold text-foreground truncate max-w-[80%]">
                    {selectedNote?.title}
                  </DialogTitle>
                  {selectedNote && (
                    <p className="text-[9px] text-muted-foreground font-semibold">
                      Created: {format(new Date(selectedNote.createdAt), "PPP, p")} | Updated: {format(new Date(selectedNote.updatedAt), "PPP, p")}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1.5 mr-6 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleDownload}
                    className="rounded-md h-7 px-2.5 text-[10px] font-semibold gap-1 border-gray-200 text-muted-foreground hover:text-foreground"
                    title="Download Note (.md)"
                  >
                    <Download className="w-3 h-3" />
                    Download MD
                  </Button>
                  <Button
                    type="button"
                    onClick={handleStartEdit}
                    className="rounded-md h-7 px-4 text-[10px] font-semibold gap-1"
                  >
                    <Edit2 className="w-3 h-3" />
                    Edit Note
                  </Button>
                </div>
              </DialogHeader>

              {/* Project Display */}
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold uppercase text-muted-foreground">Project:</span>
                {selectedNote?.projectName ? (
                  <div className="flex items-center gap-1.5 border border-gray-200 rounded-md px-2 py-0.5 bg-gray-50/50">
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: selectedNote.projectColor || "#ccc" }}
                    />
                    <span className="text-[10px] font-bold text-foreground">
                      {selectedNote.projectName}
                    </span>
                  </div>
                ) : (
                  <span className="text-[10px] font-semibold text-muted-foreground">None</span>
                )}
              </div>

              {/* Note Content Markdown rendering */}
              <div className="flex-1 min-h-[220px] flex flex-col">
                <div className="flex-1 w-full p-4 font-mono text-xs border border-gray-200 rounded-md bg-gray-50/30 overflow-y-auto max-h-[400px]">
                  {selectedNote?.content ? (
                    <div
                      className="prose prose-xs max-w-none break-words"
                      dangerouslySetInnerHTML={{ __html: parseMarkdown(selectedNote.content) }}
                    />
                  ) : (
                    <em className="text-muted-foreground text-xs font-sans">Empty note content.</em>
                  )}
                </div>
              </div>

              {/* Bottom footer controls */}
              <DialogFooter className="border-t border-gray-200 pt-4 gap-2 flex-row justify-between items-center mt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => { if (selectedNote) handleDelete(selectedNote.id); }}
                  disabled={isSubmitting}
                  className="rounded-md h-8 px-3 text-xs text-destructive hover:bg-rose-50 hover:text-destructive font-semibold"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  Delete Note
                </Button>
                
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsDialogOpen(false)}
                  className="rounded-md h-8 text-xs border border-gray-200 text-muted-foreground hover:bg-gray-100 flex-1 sm:flex-none"
                >
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── React Router Navigation Blocker Confirmation Dialog ── */}
      <Dialog open={blocker.state === "blocked"} onOpenChange={(open) => { if (!open) blocker.reset?.(); }}>
        <DialogContent className="max-w-sm rounded-md p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">
              Discard Changes?
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 text-xs text-muted-foreground leading-relaxed">
            You have unsaved changes in your note. Are you sure you want to leave this page and discard your changes?
          </div>
          <DialogFooter className="pt-2 gap-2 flex-row justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={() => blocker.reset?.()}
              className="rounded-md h-8 text-xs text-muted-foreground hover:bg-gray-100 flex-1 sm:flex-none"
            >
              Stay and Edit
            </Button>
            <Button
              type="button"
              onClick={() => blocker.proceed?.()}
              className="rounded-md h-8 text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90 flex-1 sm:flex-none"
            >
              Discard & Leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </AppLayout>
  );
}
