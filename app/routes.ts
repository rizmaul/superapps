import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("tasks", "routes/tasks.tsx"),
  route("projects", "routes/projects.tsx"),
  route("spending", "routes/spending.tsx"),
  route("money-log", "routes/money-log.tsx"),
  route("notes", "routes/notes.tsx"),
] satisfies RouteConfig;
