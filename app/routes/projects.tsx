import { useState, useEffect } from "react";
import { useLoaderData, useSubmit, useFetcher } from "react-router";
import { format, isPast, isToday } from "date-fns";
import { 
  Plus, 
  Edit3, 
  Trash2, 
  Archive, 
  ChevronLeft, 
  Check, 
  ListTodo, 
  FolderKanban, 
  AlertCircle, 
  Calendar as CalendarIcon,
  Loader2,
  Folder
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Layout & UI
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

// DB
import { getDB } from "@/lib/db.server";
import type { Route } from "./+types/projects";

export async function loader({ context }: Route.LoaderArgs) {
  const db = getDB(context.cloudflare.env.DB);
  
  const projects = await db.project.findMany({
    where: { isArchived: false },
    include: {
      tasks: {
        include: {
          tags: {
            include: {
              tag: true
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        }
      }
    },
    orderBy: { name: "asc" }
  });

  return { projects };
}

export async function action({ request, context }: Route.ActionArgs) {
  const db = getDB(context.cloudflare.env.DB);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create-project" || intent === "update-project") {
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const colorHex = formData.get("colorHex") as string || "#739dd1";

    if (intent === "create-project") {
      await db.project.create({
        data: {
          name,
          description,
          colorHex,
          isArchived: false,
        }
      });
      return { success: true };
    } else {
      const id = formData.get("id") as string;
      await db.project.update({
        where: { id },
        data: {
          name,
          description,
          colorHex,
        }
      });
      return { success: true };
    }
  }

  if (intent === "archive-project") {
    const id = formData.get("id") as string;
    await db.project.update({
      where: { id },
      data: { isArchived: true }
    });
    return { success: true };
  }

  if (intent === "create-task") {
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const projectId = formData.get("projectId") as string;
    const dueDateStr = formData.get("dueDate") as string;

    const pId = projectId && projectId !== "none" ? projectId : null;
    const due = dueDateStr ? new Date(dueDateStr) : null;

    await db.task.create({
      data: {
        title,
        description,
        projectId: pId,
        dueDate: due,
        status: "todo",
      }
    });

    return { success: true };
  }

  if (intent === "update-task") {
    const id = formData.get("id") as string;
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const dueDateStr = formData.get("dueDate") as string;

    const due = dueDateStr ? new Date(dueDateStr) : null;

    await db.task.update({
      where: { id },
      data: {
        title,
        description,
        dueDate: due,
      }
    });

    return { success: true };
  }

  if (intent === "toggle-task") {
    const id = formData.get("id") as string;
    const currentStatus = formData.get("status") as string;
    const nextStatus = currentStatus === "done" ? "todo" : "done";

    await db.task.update({
      where: { id },
      data: {
        status: nextStatus
      }
    });

    return { success: true };
  }

  if (intent === "delete-task") {
    const id = formData.get("id") as string;
    await db.task.delete({
      where: { id }
    });

    return { success: true };
  }

  return { success: false };
}

const PRESET_COLORS = [
  "#2e426b", // Twilight Indigo
  "#6fb2f6", // Cool Sky
  "#739dd1", // Wisteria Blue
  "#a6c5ec", // Powder Blue
  "#ff7675", // Coral Red
  "#ffeaa7", // Soft Gold
  "#55efc4", // Mint Green
  "#a29bfe", // Wisteria Purple
];

export default function ProjectsRoute() {
  const { projects } = useLoaderData<typeof loader>();
  const submit = useSubmit();

  // Local Project Detail State
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // Project Modals
  const [isProjectOpen, setIsProjectOpen] = useState(false);
  const [editingProj, setEditingProj] = useState<any>(null);
  const [projName, setProjName] = useState("");
  const [projDesc, setProjDesc] = useState("");
  const [projColor, setProjColor] = useState(PRESET_COLORS[0]);

  // Project archive confirmation
  const [projToArchive, setProjToArchive] = useState<{ id: string; name: string } | null>(null);

  // Inline Task Creation States (within detail view)
  const [isTaskCreateOpen, setIsTaskCreateOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskDue, setTaskDue] = useState<Date | undefined>(undefined);

  // Task Editing States
  const [editingTask, setEditingTask] = useState<any>(null);
  const [editTaskTitle, setEditTaskTitle] = useState("");
  const [editTaskDesc, setEditTaskDesc] = useState("");
  const [editTaskDue, setEditTaskDue] = useState<Date | undefined>(undefined);

  // Custom Delete confirmation state
  const [taskToDelete, setTaskToDelete] = useState<{ id: string; title: string } | null>(null);

  const projectFetcher = useFetcher<{ success: boolean }>();
  const taskCreateFetcher = useFetcher<{ success: boolean }>();
  const taskEditFetcher = useFetcher<{ success: boolean }>();

  // Reset project dialogs on success
  useEffect(() => {
    if (projectFetcher.state === "idle" && projectFetcher.data?.success) {
      setIsProjectOpen(false);
      setProjToArchive(null);
      setEditingProj(null);
      setProjName("");
      setProjDesc("");
      setProjColor(PRESET_COLORS[0]);
      toast.success(editingProj ? "Project updated!" : "Project created!");
    }
  }, [projectFetcher.state, projectFetcher.data, editingProj]);

  // Reset task dialogs on success
  useEffect(() => {
    if (taskCreateFetcher.state === "idle" && taskCreateFetcher.data?.success) {
      setIsTaskCreateOpen(false);
      setTaskTitle("");
      setTaskDesc("");
      setTaskDue(undefined);
      toast.success("Task added to project!");
    }
  }, [taskCreateFetcher.state, taskCreateFetcher.data]);

  useEffect(() => {
    if (taskEditFetcher.state === "idle" && taskEditFetcher.data?.success) {
      setEditingTask(null);
      setEditTaskTitle("");
      setEditTaskDesc("");
      setEditTaskDue(undefined);
      toast.success("Task updated!");
    }
  }, [taskEditFetcher.state, taskEditFetcher.data]);

  // Project events
  const handleOpenCreateProject = () => {
    setEditingProj(null);
    setProjName("");
    setProjDesc("");
    setProjColor(PRESET_COLORS[0]);
    setIsProjectOpen(true);
  };

  const handleOpenEditProject = (project: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProj(project);
    setProjName(project.name);
    setProjDesc(project.description || "");
    setProjColor(project.colorHex || PRESET_COLORS[0]);
    setIsProjectOpen(true);
  };

  const handleTriggerArchive = (project: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setProjToArchive({ id: project.id, name: project.name });
  };

  const handleConfirmArchive = () => {
    if (!projToArchive) return;
    const formData = new FormData();
    formData.append("intent", "archive-project");
    formData.append("id", projToArchive.id);
    submit(formData, { method: "post" });
    setProjToArchive(null);
    toast.success("Project archived");
  };

  // Task events (within Detail View)
  const handleToggleTask = (id: string, currentStatus: string) => {
    const formData = new FormData();
    formData.append("intent", "toggle-task");
    formData.append("id", id);
    formData.append("status", currentStatus);
    submit(formData, { method: "post" });
    
    if (currentStatus === "done") {
      toast.info("Task active");
    } else {
      toast.success("Task completed! 🎉");
    }
  };

  const handleOpenEditTask = (task: any) => {
    setEditingTask(task);
    setEditTaskTitle(task.title);
    setEditTaskDesc(task.description || "");
    setEditTaskDue(task.dueDate ? new Date(task.dueDate) : undefined);
  };

  const handleTriggerDeleteTask = (task: any) => {
    setTaskToDelete({ id: task.id, title: task.title });
  };

  const handleConfirmDeleteTask = () => {
    if (!taskToDelete) return;
    const formData = new FormData();
    formData.append("intent", "delete-task");
    formData.append("id", taskToDelete.id);
    submit(formData, { method: "post" });
    setTaskToDelete(null);
    toast.success("Task deleted");
  };

  // Current selected project details
  const currentProject = projects.find((p) => p.id === selectedProjectId);

  // Group current project tasks by status
  const pendingTasks = currentProject?.tasks.filter((t) => t.status !== "done") || [];
  const completedTasks = currentProject?.tasks.filter((t) => t.status === "done") || [];

  return (
    <AppLayout 
      title={currentProject ? currentProject.name : "Project Boards"}
      actions={
        !currentProject && (
          <Button onClick={handleOpenCreateProject} className="text-xs gap-1.5 h-8 px-3 font-semibold shadow-sm">
            <Plus className="w-3.5 h-3.5" />
            <span>New Project</span>
          </Button>
        )
      }
    >
      <div className="space-y-4">
        
        {/* ---------------- PROJECT DETAILS VIEW ---------------- */}
        {currentProject ? (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Header / Meta Card */}
            <div className="bg-white border border-gray-100 p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2">
                <Button 
                  onClick={() => setSelectedProjectId(null)} 
                  variant="ghost" 
                  size="icon-sm" 
                  className="rounded-full text-muted-foreground hover:text-foreground"
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <div className="flex items-center gap-2">
                  <span 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: currentProject.colorHex || "#739dd1" }}
                  />
                  <h3 className="text-lg font-bold text-foreground leading-none">{currentProject.name}</h3>
                </div>
              </div>

              {currentProject.description ? (
                <p className="text-xs text-muted-foreground leading-relaxed pl-8">
                  {currentProject.description}
                </p>
              ) : (
                <p className="text-xs italic text-muted-foreground/60 pl-8">No description provided</p>
              )}

              {/* Stats row */}
              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-50 pl-8">
                <div className="flex flex-col">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Pending Tasks</span>
                  <span className="text-base font-extrabold text-foreground">{pendingTasks.length}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Completed</span>
                  <span className="text-base font-extrabold text-foreground">{completedTasks.length}</span>
                </div>
              </div>
            </div>

            {/* Tasks list inside Project */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Project Tasks</h4>
                
                <Button 
                  onClick={() => setIsTaskCreateOpen(true)}
                  size="xs" 
                  className="text-[11px] gap-1 h-7 font-bold"
                >
                  <Plus className="w-3 h-3" />
                  Add Task
                </Button>
              </div>

              {currentProject.tasks.length === 0 ? (
                <div className="bg-white border border-dashed border-gray-200 py-10 px-4 text-center flex flex-col items-center justify-center gap-3">
                  <div className="w-12 h-12 bg-muted/40 rounded-full flex items-center justify-center text-muted-foreground">
                    <ListTodo className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">No tasks assigned</p>
                    <p className="text-xs text-muted-foreground">Add a new task directly to this project using the button above.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Pending section */}
                  {pendingTasks.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2">Pending ({pendingTasks.length})</h5>
                      <div className="space-y-2">
                        {pendingTasks.map((task) => (
                          <div 
                            key={task.id}
                            className="bg-white border border-gray-100 p-3.5 shadow-sm flex items-center justify-between gap-4"
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div onClick={() => handleToggleTask(task.id, task.status)} className="cursor-pointer">
                                <div className="w-5 h-5 border border-gray-300 flex items-center justify-center hover:border-primary">
                                  {task.status === "done" && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                </div>
                              </div>
                              <div className="flex flex-col min-w-0 flex-1">
                                <span className="text-xs font-bold text-foreground truncate">{task.title}</span>
                                {task.dueDate && (
                                  <span className="text-[9px] text-muted-foreground mt-0.5">
                                    Due {format(new Date(task.dueDate), "MMM d")}
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-1.5">
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="w-8 h-8 text-muted-foreground hover:text-foreground"
                                onClick={() => handleOpenEditTask(task)}
                              >
                                <Edit3 className="w-4 h-4" />
                              </Button>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="w-8 h-8 text-muted-foreground hover:text-destructive"
                                onClick={() => handleTriggerDeleteTask(task)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Completed section */}
                  {completedTasks.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2">Completed ({completedTasks.length})</h5>
                      <div className="space-y-2">
                        {completedTasks.map((task) => (
                          <div 
                            key={task.id}
                            className="bg-white/60 border border-gray-100 p-3.5 flex items-center justify-between gap-4"
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1 opacity-70">
                              <div onClick={() => handleToggleTask(task.id, task.status)} className="cursor-pointer">
                                <div className="w-5 h-5 bg-primary border border-primary flex items-center justify-center text-primary-foreground">
                                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                                </div>
                              </div>
                              <div className="flex flex-col min-w-0 flex-1">
                                <span className="text-xs font-bold text-foreground line-through truncate">{task.title}</span>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-1.5">
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="w-8 h-8 text-muted-foreground hover:text-destructive"
                                onClick={() => handleTriggerDeleteTask(task)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          
          /* ---------------- PROJECTS LIST VIEW ---------------- */
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in duration-200">
            {projects.length === 0 ? (
              <div className="col-span-full bg-white border border-dashed border-gray-200 py-12 px-4 text-center flex flex-col items-center justify-center gap-3">
                <div className="w-12 h-12 bg-muted/40 rounded-full flex items-center justify-center text-muted-foreground">
                  <FolderKanban className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">No projects yet</p>
                  <p className="text-xs text-muted-foreground">Tap &ldquo;New Project&rdquo; to structure your tasks.</p>
                </div>
              </div>
            ) : (
              projects.map((project) => {
                const total = project.tasks.length;
                const completed = project.tasks.filter((t) => t.status === "done").length;
                const pending = total - completed;

                return (
                  <div
                    key={project.id}
                    onClick={() => setSelectedProjectId(project.id)}
                    className="bg-white border border-gray-100 overflow-hidden shadow-sm flex flex-col cursor-pointer active:bg-gray-50/50 hover:border-gray-200 transition-all duration-200"
                    style={{ borderLeft: `5px solid ${project.colorHex || "#739dd1"}` }}
                  >
                    <div className="p-4 flex flex-col justify-between flex-1 gap-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1 flex-1 min-w-0">
                          <h3 className="text-sm font-bold text-foreground leading-tight truncate">{project.name}</h3>
                          {project.description ? (
                            <p className="text-xs text-muted-foreground leading-normal line-clamp-2">{project.description}</p>
                          ) : (
                            <p className="text-[11px] text-muted-foreground/50 italic">No description</p>
                          )}
                        </div>

                        <div className="flex items-center gap-0.5">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e: React.MouseEvent) => handleOpenEditProject(project, e)}
                            className="w-8 h-8 text-muted-foreground hover:text-foreground"
                            title="Edit Project"
                          >
                            <Edit3 className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e: React.MouseEvent) => handleTriggerArchive(project, e)}
                            className="w-8 h-8 text-muted-foreground hover:text-amber-600"
                            title="Archive Project"
                          >
                            <Archive className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-gray-50 flex items-center justify-between text-[10px] text-muted-foreground font-semibold">
                        <span className="flex items-center gap-1">
                          <Folder className="w-3.5 h-3.5" />
                          {total} total tasks
                        </span>
                        
                        <Badge variant="secondary" className="text-[9px] font-extrabold bg-muted text-primary px-2">
                          {pending} pending
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Project Create / Edit Dialog */}
        <Dialog open={isProjectOpen} onOpenChange={setIsProjectOpen} disablePointerDismissal={true}>
          <DialogContent className="max-w-[90vw] sm:max-w-md p-6">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-foreground">
                {editingProj ? "Edit Project" : "Create Project"}
              </DialogTitle>
            </DialogHeader>

            <projectFetcher.Form method="post" action="/projects" className="space-y-4 pt-2">
              <input type="hidden" name="intent" value={editingProj ? "update-project" : "create-project"} />
              {editingProj && <input type="hidden" name="id" value={editingProj.id} />}

              <div className="space-y-1.5">
                <Label htmlFor="proj-name" className="text-xs font-semibold text-foreground">
                  Project Name <span className="text-destructive font-bold">*</span>
                </Label>
                <Input
                  id="proj-name"
                  name="name"
                  required
                  placeholder="e.g. Work, Personal, Fitness"
                  value={projName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProjName(e.target.value)}
                  className="border-gray-200"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="proj-desc" className="text-xs font-semibold text-foreground">Description</Label>
                <Textarea
                  id="proj-desc"
                  name="description"
                  placeholder="What is this project about?"
                  rows={3}
                  value={projDesc}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setProjDesc(e.target.value)}
                  className="border-gray-200 resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Theme Color</Label>
                <input type="hidden" name="colorHex" value={projColor} />
                
                <div className="flex flex-wrap gap-2.5 pt-1">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setProjColor(color)}
                      className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all duration-200 scale-95 hover:scale-105 active:scale-95",
                        projColor === color ? "border-foreground scale-100" : "border-transparent"
                      )}
                      style={{ backgroundColor: color }}
                    >
                      {projColor === color && (
                        <div className="w-2.5 h-2.5 rounded-full bg-white shadow-sm" />
                      )}
                    </button>
                  ))}
                  
                  <div className="w-full mt-1.5">
                    <Input
                      type="text"
                      placeholder="Or enter custom hex (e.g. #739dd1)"
                      value={projColor}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProjColor(e.target.value)}
                      className="border-gray-200 text-xs font-mono h-8"
                    />
                  </div>
                </div>
              </div>

              <DialogFooter className="pt-2 gap-2 flex-row justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsProjectOpen(false)}
                  className="text-muted-foreground hover:bg-gray-100 flex-1 sm:flex-initial"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={projectFetcher.state === "submitting"}
                  className="bg-primary text-primary-foreground hover:bg-primary/95 flex-1 sm:flex-initial"
                >
                  {projectFetcher.state === "submitting" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save"
                  )}
                </Button>
              </DialogFooter>
            </projectFetcher.Form>
          </DialogContent>
        </Dialog>

        {/* Custom Project Archive Confirmation Dialog */}
        <Dialog open={!!projToArchive} onOpenChange={(open: boolean) => !open && setProjToArchive(null)} disablePointerDismissal={true}>
          <DialogContent className="max-w-[90vw] sm:max-w-md p-6">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-600" />
                Archive Project
              </DialogTitle>
            </DialogHeader>

            <div className="py-2 space-y-2">
              <p className="text-xs text-muted-foreground leading-normal">
                Are you sure you want to archive <span className="font-semibold text-foreground">&ldquo;{projToArchive?.name}&rdquo;</span>? You can still view it in the database but it will no longer display in active lists.
              </p>
            </div>

            <DialogFooter className="pt-2 gap-2 flex-row justify-end">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setProjToArchive(null)}
                className="text-muted-foreground hover:bg-gray-100 flex-1 sm:flex-initial"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleConfirmArchive}
                className="bg-amber-600 text-white hover:bg-amber-700 flex-1 sm:flex-initial"
              >
                Archive Project
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Inline Task Create Dialog inside Project Detail */}
        <Dialog open={isTaskCreateOpen} onOpenChange={setIsTaskCreateOpen} disablePointerDismissal={true}>
          <DialogContent className="max-w-[90vw] sm:max-w-md p-6">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-foreground">Add Task to Project</DialogTitle>
            </DialogHeader>

            <taskCreateFetcher.Form method="post" action="/projects" className="space-y-4 pt-2">
              <input type="hidden" name="intent" value="create-task" />
              <input type="hidden" name="projectId" value={selectedProjectId || ""} />
              
              <div className="space-y-1.5">
                <Label htmlFor="task-title" className="text-xs font-semibold text-foreground">
                  Task Title <span className="text-destructive font-bold">*</span>
                </Label>
                <Input
                  id="task-title"
                  name="title"
                  required
                  value={taskTitle}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTaskTitle(e.target.value)}
                  placeholder="What needs to be done?"
                  className="border-gray-200"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="task-description" className="text-xs font-semibold text-foreground">Description</Label>
                <Textarea
                  id="task-description"
                  name="description"
                  value={taskDesc}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setTaskDesc(e.target.value)}
                  placeholder="Task details..."
                  rows={2}
                  className="border-gray-200 resize-none"
                />
              </div>

              <div className="space-y-1.5 flex flex-col">
                <Label className="text-xs font-semibold text-foreground mb-1.5">Due Date</Label>
                <input
                  type="hidden"
                  name="dueDate"
                  value={taskDue ? taskDue.toISOString() : ""}
                />
                <Popover>
                  <PopoverTrigger
                    render={
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full border-gray-200 justify-start text-left font-normal px-3",
                          !taskDue && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {taskDue ? format(taskDue, "PPP") : <span>Pick a date</span>}
                      </Button>
                    }
                  />
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      selected={taskDue}
                      onSelect={setTaskDue}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <DialogFooter className="pt-2 gap-2 flex-row justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsTaskCreateOpen(false)}
                  className="text-muted-foreground hover:bg-gray-100 flex-1 sm:flex-initial"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={taskCreateFetcher.state === "submitting"}
                  className="bg-primary text-primary-foreground hover:bg-primary/95 flex-1 sm:flex-initial"
                >
                  {taskCreateFetcher.state === "submitting" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    "Add Task"
                  )}
                </Button>
              </DialogFooter>
            </taskCreateFetcher.Form>
          </DialogContent>
        </Dialog>

        {/* Task Edit Dialog */}
        <Dialog open={!!editingTask} onOpenChange={(open: boolean) => !open && setEditingTask(null)} disablePointerDismissal={true}>
          <DialogContent className="max-w-[90vw] sm:max-w-md p-6">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-foreground">Edit Task</DialogTitle>
            </DialogHeader>

            <taskEditFetcher.Form method="post" action="/projects" className="space-y-4 pt-2">
              <input type="hidden" name="intent" value="update-task" />
              <input type="hidden" name="id" value={editingTask?.id || ""} />
              
              <div className="space-y-1.5">
                <Label htmlFor="edit-task-title" className="text-xs font-semibold text-foreground">
                  Task Title <span className="text-destructive font-bold">*</span>
                </Label>
                <Input
                  id="edit-task-title"
                  name="title"
                  required
                  value={editTaskTitle}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditTaskTitle(e.target.value)}
                  className="border-gray-200"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-task-desc" className="text-xs font-semibold text-foreground">Description</Label>
                <Textarea
                  id="edit-task-desc"
                  name="description"
                  value={editTaskDesc}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditTaskDesc(e.target.value)}
                  rows={2}
                  className="border-gray-200 resize-none"
                />
              </div>

              <div className="space-y-1.5 flex flex-col">
                <Label className="text-xs font-semibold text-foreground mb-1.5">Due Date</Label>
                <input
                  type="hidden"
                  name="dueDate"
                  value={editTaskDue ? editTaskDue.toISOString() : ""}
                />
                <Popover>
                  <PopoverTrigger
                    render={
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full border-gray-200 justify-start text-left font-normal px-3",
                          !editTaskDue && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {editTaskDue ? format(editTaskDue, "PPP") : <span>Pick a date</span>}
                      </Button>
                    }
                  />
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      selected={editTaskDue}
                      onSelect={setEditTaskDue}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <DialogFooter className="pt-2 gap-2 flex-row justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setEditingTask(null)}
                  className="text-muted-foreground hover:bg-gray-100 flex-1 sm:flex-initial"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={taskEditFetcher.state === "submitting"}
                  className="bg-primary text-primary-foreground hover:bg-primary/95 flex-1 sm:flex-initial"
                >
                  {taskEditFetcher.state === "submitting" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </DialogFooter>
            </taskEditFetcher.Form>
          </DialogContent>
        </Dialog>

        {/* Custom Task Delete Confirmation Dialog */}
        <Dialog open={!!taskToDelete} onOpenChange={(open: boolean) => !open && setTaskToDelete(null)} disablePointerDismissal={true}>
          <DialogContent className="max-w-[90vw] sm:max-w-md p-6">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-destructive" />
                Delete Task
              </DialogTitle>
            </DialogHeader>

            <div className="py-2 space-y-2">
              <p className="text-xs text-muted-foreground leading-normal">
                Are you sure you want to delete <span className="font-semibold text-foreground">&ldquo;{taskToDelete?.title}&rdquo;</span>? This action cannot be undone.
              </p>
            </div>

            <DialogFooter className="pt-2 gap-2 flex-row justify-end">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setTaskToDelete(null)}
                className="text-muted-foreground hover:bg-gray-100 flex-1 sm:flex-initial"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleConfirmDeleteTask}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/95 flex-1 sm:flex-initial"
              >
                Delete Task
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
