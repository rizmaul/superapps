import { useState, useEffect } from "react";
import { useLoaderData, useSubmit, useFetcher } from "react-router";
import { format, isPast, isToday } from "date-fns";
import {
  Calendar as CalendarIcon,
  Trash2,
  Edit3,
  Plus,
  Check,
  AlertCircle,
  Tag as TagIcon,
  Filter,
  ListTodo,
  Loader2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Layout & UI
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import type { Route } from "./+types/tasks";

export async function loader({ context }: Route.LoaderArgs) {
  const db = getDB(context.cloudflare.env.DB);

  const tasks = await db.task.findMany({
    include: {
      project: true,
      tags: {
        include: {
          tag: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const projects = await db.project.findMany({
    where: { isArchived: false },
    include: {
      _count: {
        select: {
          tasks: {
            where: {
              status: { not: "done" },
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const tags = await db.tag.findMany({
    include: {
      _count: {
        select: { tasks: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return { tasks, projects, tags };
}

export async function action({ request, context }: Route.ActionArgs) {
  const db = getDB(context.cloudflare.env.DB);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create-task" || intent === "update-task") {
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const projectId = formData.get("projectId") as string;
    const dueDateStr = formData.get("dueDate") as string;
    const tagsInput = (formData.get("tags") as string) || ""; // comma separated

    const pId = projectId && projectId !== "none" ? projectId : null;
    const due = dueDateStr ? new Date(dueDateStr) : null;

    // Process tags
    const tagNames = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    if (intent === "create-task") {
      const task = await db.task.create({
        data: {
          title,
          description,
          projectId: pId,
          dueDate: due,
          status: "todo",
        },
      });

      // Link tags
      if (tagNames.length > 0) {
        for (const name of tagNames) {
          const tag = await db.tag.upsert({
            where: { name },
            create: { name },
            update: {},
          });

          await db.taskTag.create({
            data: {
              taskId: task.id,
              tagId: tag.id,
            },
          });
        }
      }

      return { success: true };
    } else {
      const id = formData.get("id") as string;

      // Update task
      await db.task.update({
        where: { id },
        data: {
          title,
          description,
          projectId: pId,
          dueDate: due,
        },
      });

      // Clear existing tags
      await db.taskTag.deleteMany({
        where: { taskId: id },
      });

      // Relink tags
      if (tagNames.length > 0) {
        for (const name of tagNames) {
          const tag = await db.tag.upsert({
            where: { name },
            create: { name },
            update: {},
          });

          await db.taskTag.create({
            data: {
              taskId: id,
              tagId: tag.id,
            },
          });
        }
      }

      return { success: true };
    }
  }

  if (intent === "toggle-task") {
    const id = formData.get("id") as string;
    const currentStatus = formData.get("status") as string;
    const nextStatus = currentStatus === "done" ? "todo" : "done";

    await db.task.update({
      where: { id },
      data: {
        status: nextStatus,
      },
    });

    return { success: true };
  }

  if (intent === "delete-task") {
    const id = formData.get("id") as string;
    await db.task.delete({
      where: { id },
    });

    return { success: true };
  }

  if (intent === "delete-tag") {
    const id = formData.get("id") as string;
    await db.tag.delete({
      where: { id },
    });
    return { success: true };
  }

  return { success: false };
}

export default function TasksRoute() {
  const { tasks, projects, tags } = useLoaderData<typeof loader>();
  const submit = useSubmit();

  // Internal Navigation Tab
  const [activeSubTab, setActiveSubTab] = useState<"tasks" | "tags">("tasks");

  // Filtering & Grouping state
  const [statusFilter, setStatusFilter] = useState<"all" | "todo" | "done">(
    "todo",
  );
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [groupByProject, setGroupByProject] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  // Custom Delete confirmation pop-up state
  const [taskToDelete, setTaskToDelete] = useState<{
    id: string;
    title: string;
  } | null>(null);

  // Task Create Modal States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createProj, setCreateProj] = useState("none");
  const [createDue, setCreateDue] = useState<Date | undefined>(undefined);
  const [createTagQuery, setCreateTagQuery] = useState("");
  const [createSelectedTags, setCreateSelectedTags] = useState<string[]>([]);
  const [createNotifyEmail, setCreateNotifyEmail] = useState(false);

  // Task Edit Modal States
  const [editingTask, setEditingTask] = useState<any>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editProj, setEditProj] = useState("none");
  const [editDue, setEditDue] = useState<Date | undefined>(undefined);
  const [editTagQuery, setEditTagQuery] = useState("");
  const [editSelectedTags, setEditSelectedTags] = useState<string[]>([]);

  const taskCreateFetcher = useFetcher<{ success: boolean }>();
  const taskEditFetcher = useFetcher<{ success: boolean }>();

  // Reset Task Create dialog on success
  useEffect(() => {
    if (taskCreateFetcher.state === "idle" && taskCreateFetcher.data?.success) {
      setIsCreateOpen(false);
      setCreateTitle("");
      setCreateDesc("");
      setCreateProj("none");
      setCreateDue(undefined);
      setCreateTagQuery("");
      setCreateSelectedTags([]);
      setCreateNotifyEmail(false);
      toast.success("Task created successfully!");
    }
  }, [taskCreateFetcher.state, taskCreateFetcher.data]);

  // Reset Task Edit dialog on success
  useEffect(() => {
    if (taskEditFetcher.state === "idle" && taskEditFetcher.data?.success) {
      setEditingTask(null);
      setEditTagQuery("");
      setEditSelectedTags([]);
      toast.success("Task updated successfully!");
    }
  }, [taskEditFetcher.state, taskEditFetcher.data]);

  // Task events
  const handleOpenEditTask = (task: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTask(task);
    setEditTitle(task.title);
    setEditDesc(task.description || "");
    setEditProj(task.projectId || "none");
    setEditDue(task.dueDate ? new Date(task.dueDate) : undefined);
    setEditSelectedTags(task.tags.map((t: any) => t.tag.name));
    setEditTagQuery("");
  };

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

  // Custom Delete Triggers
  const handleTriggerDelete = (task: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setTaskToDelete({ id: task.id, title: task.title });
  };

  const handleConfirmDelete = () => {
    if (!taskToDelete) return;
    const formData = new FormData();
    formData.append("intent", "delete-task");
    formData.append("id", taskToDelete.id);
    submit(formData, { method: "post" });
    setTaskToDelete(null);
    toast.success("Task deleted");
  };

  const handleDeleteTag = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete tag "#${name}"?`)) {
      const formData = new FormData();
      formData.append("intent", "delete-tag");
      formData.append("id", id);
      submit(formData, { method: "post" });
      toast.success("Tag deleted");
    }
  };

  // Filter tasks list
  const filteredTasks = tasks.filter((task: any) => {
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "todo" && task.status !== "done") ||
      (statusFilter === "done" && task.status === "done");

    const matchesProject =
      projectFilter === "all" ||
      (projectFilter === "none" && !task.projectId) ||
      task.projectId === projectFilter;

    const matchesTag =
      tagFilter === "all" ||
      task.tags.some((tt: any) => tt.tag.name === tagFilter);

    return matchesStatus && matchesProject && matchesTag;
  });

  // Group tasks by project
  const tasksByProject: { [key: string]: { project: any; tasks: any[] } } = {};
  if (groupByProject) {
    projects.forEach((p) => {
      tasksByProject[p.id] = { project: p, tasks: [] };
    });
    tasksByProject["none"] = { project: null, tasks: [] };

    filteredTasks.forEach((task: any) => {
      const key = task.projectId || "none";
      if (!tasksByProject[key]) {
        tasksByProject[key] = { project: task.project, tasks: [] };
      }
      tasksByProject[key].tasks.push(task);
    });
  }

  const completedCount = tasks.filter((t: any) => t.status === "done").length;
  const totalCount = tasks.length;
  const completionRate =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Render a Single Task Card
  const renderTaskCard = (task: any) => {
    const isExpanded = expandedTaskId === task.id;
    const hasDueDate = !!task.dueDate;
    const isOverdue =
      hasDueDate &&
      isPast(new Date(task.dueDate)) &&
      !isToday(new Date(task.dueDate)) &&
      task.status !== "done";
    const isDueToday =
      hasDueDate && isToday(new Date(task.dueDate)) && task.status !== "done";

    return (
      <div
        key={task.id}
        onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
        className={cn(
          "bg-white border border-gray-100 p-4 transition-all duration-200 shadow-sm flex flex-col gap-2 cursor-pointer active:bg-gray-50/50 hover:border-gray-200",
          task.status === "done" && "bg-gray-50/50 border-gray-100 shadow-none",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div
              onClick={(e) => {
                e.stopPropagation();
                handleToggleTask(task.id, task.status);
              }}
              className="pt-0.5"
            >
              <div
                className={cn(
                  "w-5 h-5 border flex items-center justify-center transition-all duration-200 cursor-pointer",
                  task.status === "done"
                    ? "bg-primary border-primary text-primary-foreground"
                    : "border-gray-300 hover:border-primary",
                )}
              >
                {task.status === "done" && (
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                )}
              </div>
            </div>
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <span
                className={cn(
                  "text-sm font-semibold text-foreground transition-all duration-200 leading-tight truncate",
                  task.status === "done" &&
                    "line-through text-muted-foreground",
                )}
              >
                {task.title}
              </span>

              <div className="flex flex-wrap items-center gap-1.5">
                {task.project && (
                  <Badge
                    variant="secondary"
                    className="text-[9px] font-semibold px-2 py-0.5 flex items-center gap-1 bg-muted text-primary"
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{
                        backgroundColor: task.project.colorHex || "#a6c5ec",
                      }}
                    />
                    {task.project.name}
                  </Badge>
                )}

                {task.tags.map((tt: any) => (
                  <Badge
                    key={tt.tag.id}
                    variant="outline"
                    className="text-[9px] px-2 py-0.5 text-muted-foreground border-gray-200"
                  >
                    #{tt.tag.name}
                  </Badge>
                ))}

                {hasDueDate && (
                  <span
                    className={cn(
                      "text-[10px] font-medium flex items-center gap-1",
                      isOverdue && "text-destructive font-semibold",
                      isDueToday && "text-amber-600 font-semibold",
                      !isOverdue && !isDueToday && "text-muted-foreground",
                    )}
                  >
                    {isOverdue && <AlertCircle className="w-3 h-3" />}
                    {format(new Date(task.dueDate), "MMM d")}
                    {isDueToday && " (Today)"}
                    {isOverdue && " (Overdue)"}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={(e: React.MouseEvent) => handleOpenEditTask(task, e)}
              className="w-8 h-8 text-muted-foreground hover:text-foreground"
            >
              <Edit3 className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={(e: React.MouseEvent) => handleTriggerDelete(task, e)}
              className="w-8 h-8 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {isExpanded && (
          <div className="mt-2 pt-3 border-t border-gray-100 flex flex-col gap-2 text-xs text-foreground/80 animate-in fade-in slide-in-from-top-1 duration-200">
            {task.description ? (
              <div className="bg-gray-50/50 p-2.5 text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {task.description}
              </div>
            ) : (
              <span className="text-xs italic text-muted-foreground">
                No description provided
              </span>
            )}

            <div className="flex justify-between items-center text-[10px] text-muted-foreground pt-1">
              <span>Created {format(new Date(task.createdAt), "PPp")}</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <AppLayout title="Task Manager">
      <div className="space-y-4">
        {/* Top Tab Bar for self-contained Navigation */}
        <div className="bg-gray-100 p-1 flex gap-1">
          <button
            onClick={() => setActiveSubTab("tasks")}
            className={cn(
              "flex-1 text-center py-2 text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-1.5",
              activeSubTab === "tasks"
                ? "bg-white text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <ListTodo className="w-3.5 h-3.5" />
            Tasks
          </button>

          <button
            onClick={() => setActiveSubTab("tags")}
            className={cn(
              "flex-1 text-center py-2 text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-1.5",
              activeSubTab === "tags"
                ? "bg-white text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <TagIcon className="w-3.5 h-3.5" />
            Tags
          </button>
        </div>

        {/* ---------------- TASKS VIEW ---------------- */}
        {activeSubTab === "tasks" && (
          <div className="space-y-4">
            {/* Filters Row */}
            <div className="space-y-2">
              <div className="bg-gray-100/80 p-1 flex gap-1">
                <button
                  onClick={() => setStatusFilter("todo")}
                  className={cn(
                    "flex-1 text-center py-2 text-xs font-semibold transition-all duration-200",
                    statusFilter === "todo"
                      ? "bg-white text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Pending
                </button>
                <button
                  onClick={() => setStatusFilter("done")}
                  className={cn(
                    "flex-1 text-center py-2 text-xs font-semibold transition-all duration-200",
                    statusFilter === "done"
                      ? "bg-white text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Completed
                </button>
                <button
                  onClick={() => setStatusFilter("all")}
                  className={cn(
                    "flex-1 text-center py-2 text-xs font-semibold transition-all duration-200",
                    statusFilter === "all"
                      ? "bg-white text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  All
                </button>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                {/* Project Filter */}
                <div className="flex items-center gap-2 bg-white border border-gray-100 px-3 py-1.5 shadow-sm flex-1">
                  <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                  <select
                    value={projectFilter}
                    onChange={(e) => setProjectFilter(e.target.value)}
                    className="text-xs font-medium bg-transparent border-none outline-none text-foreground flex-1 cursor-pointer"
                  >
                    <option value="all">All Projects</option>
                    <option value="none">No Project</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tag Filter */}
                <div className="flex items-center gap-2 bg-white border border-gray-100 px-3 py-1.5 shadow-sm flex-1">
                  <TagIcon className="w-3.5 h-3.5 text-muted-foreground" />
                  <select
                    value={tagFilter}
                    onChange={(e) => setTagFilter(e.target.value)}
                    className="text-xs font-medium bg-transparent border-none outline-none text-foreground flex-1 cursor-pointer"
                  >
                    <option value="all">All Tags</option>
                    {tags.map((t) => (
                      <option key={t.id} value={t.name}>
                        #{t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Task View Header Actions */}
            <div className="bg-white border border-gray-100 p-3 shadow-sm flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Switch
                  id="group-by-project"
                  checked={groupByProject}
                  onCheckedChange={setGroupByProject}
                />
                <Label
                  htmlFor="group-by-project"
                  className="text-xs font-semibold cursor-pointer text-foreground"
                >
                  Group by Project
                </Label>
              </div>

              <Button
                onClick={() => setIsCreateOpen(true)}
                className="text-xs gap-1 h-8 px-3 font-semibold shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Task</span>
              </Button>
            </div>

            {/* Tasks list */}
            <div className="space-y-2.5">
              {filteredTasks.length === 0 ? (
                <div className="bg-white border border-dashed border-gray-200 py-10 px-4 text-center flex flex-col items-center justify-center gap-3">
                  <div className="w-12 h-12 bg-muted/40 rounded-full flex items-center justify-center text-muted-foreground">
                    <ListTodo className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">
                      No tasks found
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Tap &ldquo;New Task&rdquo; to create a task with these
                      filters.
                    </p>
                  </div>
                </div>
              ) : groupByProject ? (
                <div className="space-y-5">
                  {Object.keys(tasksByProject).map((key) => {
                    const { project, tasks: groupTasks } = tasksByProject[key];
                    if (groupTasks.length === 0) return null;

                    return (
                      <div key={key} className="space-y-2">
                        <div className="flex items-center gap-1.5 px-1">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{
                              backgroundColor: project?.colorHex || "#9ca3af",
                            }}
                          />
                          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                            {project ? project.name : "No Project"}
                          </h4>
                          <span className="text-[10px] text-muted-foreground font-bold bg-gray-100 px-1.5 py-0.5">
                            {groupTasks.length}
                          </span>
                        </div>
                        <div className="space-y-2.5">
                          {groupTasks.map((task) => renderTaskCard(task))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredTasks.map((task) => renderTaskCard(task))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ---------------- TAGS VIEW ---------------- */}
        {activeSubTab === "tags" && (
          <div className="bg-white border border-gray-100 p-5 shadow-sm space-y-4">
            <div className="space-y-1.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Active Tags
              </h3>
              <p className="text-xs text-muted-foreground">
                Manage the active tags in your system.
              </p>
            </div>

            {tags.length === 0 ? (
              <p className="text-xs italic text-muted-foreground text-center py-6">
                No tags created yet
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag: any) => (
                  <div
                    key={tag.id}
                    className="flex items-center gap-1.5 pl-3 pr-1.5 py-1 bg-gray-50 border border-gray-100 hover:border-gray-200 transition-all duration-200"
                  >
                    <span className="text-xs font-medium text-foreground">
                      #{tag.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-bold bg-white border border-gray-100 px-1 py-0.5">
                      {tag._count.tasks}
                    </span>
                    <button
                      onClick={() => handleDeleteTag(tag.id, tag.name)}
                      className="w-5 h-5 hover:bg-gray-200 flex items-center justify-center text-muted-foreground hover:text-destructive transition-all duration-150"
                      title="Delete tag"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Task Create Dialog */}
        <Dialog
          open={isCreateOpen}
          onOpenChange={setIsCreateOpen}
          disablePointerDismissal={true}
        >
          <DialogContent className="max-w-[120vw] sm:max-w-2xl p-6">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-foreground">
                Add New Task
              </DialogTitle>
            </DialogHeader>

            <taskCreateFetcher.Form
              method="post"
              action="/tasks"
              className="space-y-4 pt-2"
            >
              <input type="hidden" name="intent" value="create-task" />

              <div className="space-y-1.5">
                <Label
                  htmlFor="create-title"
                  className="text-xs font-semibold text-foreground"
                >
                  Title <span className="text-destructive font-bold">*</span>
                </Label>
                <Input
                  id="create-title"
                  name="title"
                  required
                  value={createTitle}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setCreateTitle(e.target.value)
                  }
                  placeholder="What needs to be done?"
                  className="border-gray-200 focus:border-primary"
                />
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="create-description"
                  className="text-xs font-semibold text-foreground"
                >
                  Description
                </Label>
                <Textarea
                  id="create-description"
                  name="description"
                  value={createDesc}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setCreateDesc(e.target.value)
                  }
                  placeholder="Add details or checklists..."
                  rows={3}
                  className="border-gray-200 focus:border-primary resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="create-project"
                    className="text-xs font-semibold text-foreground"
                  >
                    Project
                  </Label>
                  <Select
                    value={createProj}
                    onValueChange={(val) => setCreateProj(val || "none")}
                    name="projectId"
                  >
                    <SelectTrigger
                      id="create-project"
                      className="border-gray-200"
                    >
                      <SelectValue placeholder="None">
                        {(val) => {
                          if (!val || val === "none") return "None";
                          const proj = projects.find((p: any) => p.id === val);
                          return proj ? (
                            <span className="flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: proj.colorHex || "#ccc" }}
                              />
                              {proj.name}
                            </span>
                          ) : (
                            "None"
                          );
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {projects.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: p.colorHex || "#ccc" }}
                            />
                            {p.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 flex flex-col">
                  <Label className="text-xs font-semibold text-foreground mb-1.5">
                    Due Date
                  </Label>
                  <input
                    type="hidden"
                    name="dueDate"
                    value={createDue ? createDue.toISOString() : ""}
                  />
                  <Popover>
                    <PopoverTrigger
                      render={
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full border-gray-200 justify-start text-left font-normal px-3",
                            !createDue && "text-muted-foreground",
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {createDue ? (
                            format(createDue, "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                        </Button>
                      }
                    />
                    <PopoverContent className="w-auto p-0" align="end">
                      <Calendar
                        mode="single"
                        selected={createDue}
                        onSelect={setCreateDue}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Tag Search Widget */}
              <div className="space-y-1.5 relative">
                <Label className="text-xs font-semibold text-foreground">
                  Tags
                </Label>
                <Input
                  value={createTagQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setCreateTagQuery(e.target.value)
                  }
                  placeholder="Search or create tags..."
                  className="border-gray-200 focus:border-primary"
                />

                {createTagQuery.trim() !== "" && (
                  <div className="absolute left-0 right-0 z-50 mt-1 bg-white border border-gray-200 shadow-lg max-h-40 overflow-y-auto p-1 space-y-0.5">
                    {tags
                      .filter(
                        (t) =>
                          t.name
                            .toLowerCase()
                            .includes(createTagQuery.toLowerCase()) &&
                          !createSelectedTags.includes(t.name),
                      )
                      .map((tag) => (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => {
                            setCreateSelectedTags([
                              ...createSelectedTags,
                              tag.name,
                            ]);
                            setCreateTagQuery("");
                          }}
                          className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 flex items-center justify-between"
                        >
                          <span>#{tag.name}</span>
                          <span className="text-[9px] text-muted-foreground bg-gray-100 px-1 rounded">
                            Existing
                          </span>
                        </button>
                      ))}

                    {!tags.some(
                      (t) =>
                        t.name.toLowerCase() ===
                        createTagQuery.trim().toLowerCase(),
                    ) && (
                      <button
                        type="button"
                        onClick={() => {
                          setCreateSelectedTags([
                            ...createSelectedTags,
                            createTagQuery.trim(),
                          ]);
                          setCreateTagQuery("");
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 text-primary font-semibold flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Create new tag &ldquo;{createTagQuery.trim()}&rdquo;
                      </button>
                    )}
                  </div>
                )}

                {/* Selected Tags wrap */}
                {createSelectedTags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {createSelectedTags.map((t) => (
                      <Badge
                        key={t}
                        variant="secondary"
                        className="pr-1 pl-2.5 py-0.5 text-[10px] font-semibold gap-1 flex items-center bg-gray-100 text-gray-800"
                      >
                        #{t}
                        <button
                          type="button"
                          onClick={() =>
                            setCreateSelectedTags(
                              createSelectedTags.filter((x) => x !== t),
                            )
                          }
                          className="w-3.5 h-3.5 rounded-full flex items-center justify-center hover:bg-gray-200 text-muted-foreground text-xs"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}

                <input
                  type="hidden"
                  name="tags"
                  value={createSelectedTags.join(",")}
                />
              </div>

              <div className="flex items-center justify-between py-2 border-t border-gray-100 mt-2">
                <div className="flex flex-col gap-0.5">
                  <Label
                    htmlFor="notify-email"
                    className="text-xs font-semibold text-foreground"
                  >
                    Email Notification
                  </Label>
                  <span className="text-[10px] text-muted-foreground">
                    Notify me before deadline
                  </span>
                </div>
                <input
                  type="hidden"
                  name="reminderSent"
                  value={createNotifyEmail ? "false" : "true"}
                />
                <Switch
                  id="notify-email"
                  checked={createNotifyEmail}
                  onCheckedChange={setCreateNotifyEmail}
                />
              </div>

              <DialogFooter className="pt-2 gap-2 flex-row justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsCreateOpen(false)}
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
        <Dialog
          open={!!editingTask}
          onOpenChange={(open: boolean) => !open && setEditingTask(null)}
          disablePointerDismissal={true}
        >
          <DialogContent className="max-w-[90vw] sm:max-w-md p-6">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-foreground">
                Edit Task
              </DialogTitle>
            </DialogHeader>

            <taskEditFetcher.Form
              method="post"
              action="/tasks"
              className="space-y-4 pt-2"
            >
              <input type="hidden" name="intent" value="update-task" />
              <input type="hidden" name="id" value={editingTask?.id || ""} />

              <div className="space-y-1.5">
                <Label
                  htmlFor="edit-title"
                  className="text-xs font-semibold text-foreground"
                >
                  Title <span className="text-destructive font-bold">*</span>
                </Label>
                <Input
                  id="edit-title"
                  name="title"
                  required
                  value={editTitle}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setEditTitle(e.target.value)
                  }
                  placeholder="Task title"
                  className="border-gray-200 focus:border-primary"
                />
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="edit-description"
                  className="text-xs font-semibold text-foreground"
                >
                  Description
                </Label>
                <Textarea
                  id="edit-description"
                  name="description"
                  value={editDesc}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setEditDesc(e.target.value)
                  }
                  placeholder="Add details or checklists..."
                  rows={3}
                  className="border-gray-200 focus:border-primary resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="edit-project"
                    className="text-xs font-semibold text-foreground"
                  >
                    Project
                  </Label>
                  <Select
                    value={editProj}
                    onValueChange={(val) => setEditProj(val || "none")}
                    name="projectId"
                  >
                    <SelectTrigger
                      id="edit-project"
                      className="border-gray-200"
                    >
                      <SelectValue placeholder="None">
                        {(val) => {
                          if (!val || val === "none") return "None";
                          const proj = projects.find((p: any) => p.id === val);
                          return proj ? (
                            <span className="flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: proj.colorHex || "#ccc" }}
                              />
                              {proj.name}
                            </span>
                          ) : (
                            "None"
                          );
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {projects.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: p.colorHex || "#ccc" }}
                            />
                            {p.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 flex flex-col">
                  <Label className="text-xs font-semibold text-foreground mb-1.5">
                    Due Date
                  </Label>
                  <input
                    type="hidden"
                    name="dueDate"
                    value={editDue ? editDue.toISOString() : ""}
                  />
                  <Popover>
                    <PopoverTrigger
                      render={
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full border-gray-200 justify-start text-left font-normal px-3",
                            !editDue && "text-muted-foreground",
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {editDue ? (
                            format(editDue, "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                        </Button>
                      }
                    />
                    <PopoverContent className="w-auto p-0" align="end">
                      <Calendar
                        mode="single"
                        selected={editDue}
                        onSelect={setEditDue}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Tag Search Widget for Edit Modal */}
              <div className="space-y-1.5 relative">
                <Label className="text-xs font-semibold text-foreground">
                  Tags
                </Label>
                <Input
                  value={editTagQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setEditTagQuery(e.target.value)
                  }
                  placeholder="Search or create tags..."
                  className="border-gray-200 focus:border-primary"
                />

                {editTagQuery.trim() !== "" && (
                  <div className="absolute left-0 right-0 z-50 mt-1 bg-white border border-gray-200 shadow-lg max-h-40 overflow-y-auto p-1 space-y-0.5">
                    {tags
                      .filter(
                        (t) =>
                          t.name
                            .toLowerCase()
                            .includes(editTagQuery.toLowerCase()) &&
                          !editSelectedTags.includes(t.name),
                      )
                      .map((tag) => (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => {
                            setEditSelectedTags([
                              ...editSelectedTags,
                              tag.name,
                            ]);
                            setEditTagQuery("");
                          }}
                          className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 flex items-center justify-between"
                        >
                          <span>#{tag.name}</span>
                          <span className="text-[9px] text-muted-foreground bg-gray-100 px-1 rounded">
                            Existing
                          </span>
                        </button>
                      ))}

                    {!tags.some(
                      (t) =>
                        t.name.toLowerCase() ===
                        editTagQuery.trim().toLowerCase(),
                    ) && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditSelectedTags([
                            ...editSelectedTags,
                            editTagQuery.trim(),
                          ]);
                          setEditTagQuery("");
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 text-primary font-semibold flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Create new tag &ldquo;{editTagQuery.trim()}&rdquo;
                      </button>
                    )}
                  </div>
                )}

                {/* Selected Tags list */}
                {editSelectedTags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {editSelectedTags.map((t) => (
                      <Badge
                        key={t}
                        variant="secondary"
                        className="pr-1 pl-2.5 py-0.5 text-[10px] font-semibold gap-1 flex items-center bg-gray-100 text-gray-800"
                      >
                        #{t}
                        <button
                          type="button"
                          onClick={() =>
                            setEditSelectedTags(
                              editSelectedTags.filter((x) => x !== t),
                            )
                          }
                          className="w-3.5 h-3.5 rounded-full flex items-center justify-center hover:bg-gray-200 text-muted-foreground text-xs"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}

                <input
                  type="hidden"
                  name="tags"
                  value={editSelectedTags.join(",")}
                />
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
        <Dialog
          open={!!taskToDelete}
          onOpenChange={(open: boolean) => !open && setTaskToDelete(null)}
          disablePointerDismissal={true}
        >
          <DialogContent className="max-w-[90vw] sm:max-w-md p-6">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-destructive" />
                Delete Task
              </DialogTitle>
            </DialogHeader>

            <div className="py-2 space-y-2">
              <p className="text-xs text-muted-foreground leading-normal">
                Are you sure you want to delete{" "}
                <span className="font-semibold text-foreground">
                  &ldquo;{taskToDelete?.title}&rdquo;
                </span>
                ? This action cannot be undone.
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
                onClick={handleConfirmDelete}
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
