import { Link } from "react-router";
import { 
  ListTodo, 
  Receipt, 
  Wallet, 
  Timer, 
  Users, 
  FileText, 
  Calendar, 
  Flame,
  User,
  FolderKanban
} from "lucide-react";
import { format } from "date-fns";

// Layout & UI
import { AppLayout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Home | Superapp" },
    { name: "description", content: "Superapp launcher menu" },
  ];
}

// Simple loader to provide current date info
export async function loader() {
  return {
    todayStr: format(new Date(), "EEEE, MMMM d")
  };
}

export default function HomeRoute({ loaderData }: Route.ComponentProps) {
  const { todayStr } = loaderData;

  const menuItems = [
    {
      id: "tasks",
      title: "Task Management",
      description: "Track tasks, projects, and deadlines",
      icon: ListTodo,
      href: "/tasks",
      active: true,
      color: "bg-primary text-primary-foreground",
      badge: "Active"
    },
    {
      id: "projects",
      title: "Project Boards",
      description: "Manage custom boards and lists",
      icon: FolderKanban,
      href: "/projects",
      active: true,
      color: "bg-primary text-primary-foreground",
      badge: "Active"
    },
    {
      id: "spending",
      title: "Spending Tracker",
      description: "Log expenses with AI receipt scanner",
      icon: Receipt,
      href: "/spending",
      active: true,
      color: "bg-primary text-primary-foreground",
      badge: "Active"
    },
    {
      id: "money",
      title: "Money Log",
      description: "Monitor accounts and net worth growth",
      icon: Wallet,
      href: "/money-log",
      active: true,
      color: "bg-primary text-primary-foreground",
      badge: "Active"
    },
    {
      id: "pomodoro",
      title: "Pomodoro Timer",
      description: "Focus timer with project tracking",
      icon: Timer,
      href: "#",
      active: false,
      color: "bg-gray-100 text-gray-400",
      badge: "Coming Soon"
    },
    {
      id: "crm",
      title: "Personal CRM",
      description: "Note down details about friends",
      icon: Users,
      href: "#",
      active: false,
      color: "bg-gray-100 text-gray-400",
      badge: "Coming Soon"
    },
    {
      id: "notes",
      title: "Obsidian Notes",
      description: "Markdown personal notes & AI editor",
      icon: FileText,
      href: "/notes",
      active: true,
      color: "bg-primary text-primary-foreground",
      badge: "Active"
    },
    {
      id: "events",
      title: "Life Events",
      description: "Track meetups, calls, and hangouts",
      icon: Calendar,
      href: "#",
      active: false,
      color: "bg-gray-100 text-gray-400",
      badge: "Coming Soon"
    },
    {
      id: "habits",
      title: "Habit Tracker",
      description: "Log daily routines and view stats",
      icon: Flame,
      href: "#",
      active: false,
      color: "bg-gray-100 text-gray-400",
      badge: "Coming Soon"
    }
  ];

  return (
    <AppLayout title="Superapp">
      <div className="space-y-6">
        {/* Welcome Banner */}
        <div className="flex items-center justify-between bg-muted/30 border border-gray-200 p-5 rounded-md">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-primary uppercase tracking-wider">{todayStr}</p>
            <h2 className="text-lg font-extrabold text-foreground">Welcome, Rizki</h2>
            <p className="text-xs text-muted-foreground">Select a feature to get started.</p>
          </div>
          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary">
            <User className="w-5 h-5" />
          </div>
        </div>

        {/* Feature Grid */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">My Dashboard</h3>
          
          <div className="grid grid-cols-1 gap-3">
            {menuItems.map((item) => {
              const Icon = item.icon;
              
              if (item.active) {
                return (
                  <Link 
                    key={item.id} 
                    to={item.href}
                    className="block group"
                  >
                    <Card className="border-gray-200 hover:border-primary/25 active:scale-[0.99] transition-all duration-200 overflow-hidden bg-white rounded-md">
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className={`w-12 h-12 flex items-center justify-center ${item.color} rounded-md`}>
                          <Icon className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-foreground group-hover:text-primary transition-all duration-150">{item.title}</span>
                            <Badge className="text-[9px] font-bold bg-primary/10 text-primary hover:bg-primary/10 py-0.5 border-none">
                              {item.badge}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{item.description}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              }

              return (
                <Card 
                  key={item.id} 
                  className="border-gray-200 opacity-60 bg-gray-50/50 rounded-md"
                >
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className={`w-12 h-12 flex items-center justify-center ${item.color} rounded-md`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-muted-foreground">{item.title}</span>
                        <Badge variant="outline" className="text-[9px] font-bold text-muted-foreground/60 border-gray-200 py-0.5">
                          {item.badge}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground/60 truncate mt-0.5">{item.description}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
