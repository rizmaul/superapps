import { Link, NavLink, useLocation } from "react-router";
import { 
  Home, 
  ListTodo, 
  ChevronLeft,
  Receipt,
  Wallet,
  Timer,
  Users,
  FileText,
  Calendar,
  Flame,
  FolderKanban
} from "lucide-react";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  actions?: React.ReactNode;
}

const comingSoonItems = [
  { id: "money", title: "Money Log", icon: Wallet },
  { id: "pomodoro", title: "Pomodoro Focus", icon: Timer },
  { id: "crm", title: "Personal CRM", icon: Users },
  { id: "notes", title: "Obsidian Notes", icon: FileText },
  { id: "events", title: "Life Events", icon: Calendar },
  { id: "habits", title: "Habit Tracker", icon: Flame },
];

export function AppLayout({ children, title = "Superapp", actions }: LayoutProps) {
  const location = useLocation();
  const isHome = location.pathname === "/";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Sidebar - Desktop Only */}
      <aside className="hidden md:flex md:w-64 bg-white border-r border-gray-100 flex-col h-screen sticky top-0 select-none">
        <div className="p-5 border-b border-gray-100 flex flex-col">
          <h1 className="text-xl font-bold tracking-tight text-foreground">Superapp</h1>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">Personal Assistant</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          <NavLink
            to="/"
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                isActive ? "text-primary bg-muted font-bold" : "text-muted-foreground hover:text-foreground hover:bg-gray-50"
              )
            }
          >
            <Home className="w-5 h-5" />
            Home
          </NavLink>

          <NavLink
            to="/tasks"
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                isActive ? "text-primary bg-muted font-bold" : "text-muted-foreground hover:text-foreground hover:bg-gray-50"
              )
            }
          >
            <ListTodo className="w-5 h-5" />
            Tasks
          </NavLink>

          <NavLink
            to="/projects"
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                isActive ? "text-primary bg-muted font-bold" : "text-muted-foreground hover:text-foreground hover:bg-gray-50"
              )
            }
          >
            <FolderKanban className="w-5 h-5" />
            Projects
          </NavLink>

          <NavLink
            to="/spending"
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                isActive ? "text-primary bg-muted font-bold" : "text-muted-foreground hover:text-foreground hover:bg-gray-50"
              )
            }
          >
            <Receipt className="w-5 h-5" />
            Spending
          </NavLink>

          <div className="pt-4 pb-2 px-3 text-[10px] uppercase font-bold text-muted-foreground/60 tracking-wider">
            More Features
          </div>
          
          {comingSoonItems.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                className="flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground/40 cursor-not-allowed select-none"
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5" />
                  <span>{item.title}</span>
                </div>
                <span className="text-[9px] bg-gray-100 text-gray-400 font-bold px-1.5 py-0.5 rounded-md">
                  Soon
                </span>
              </div>
            );
          })}
        </nav>
      </aside>

      {/* Main Panel */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Header Bar */}
        <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-2">
            {/* Back Chevron for mobile screens when not on home */}
            {!isHome && (
              <Link
                to="/"
                className="md:hidden w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 text-muted-foreground hover:text-foreground transition-all"
                aria-label="Back to menu"
              >
                <ChevronLeft className="w-5 h-5" />
              </Link>
            )}
            
            <div className="flex flex-col">
              <h2 className="text-base md:text-lg font-bold tracking-tight text-foreground leading-tight">{title}</h2>
              <p className="hidden md:block text-[9px] text-muted-foreground uppercase tracking-widest font-semibold mt-0.5">Superapp Module</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {actions}
          </div>
        </header>

        {/* Responsive Content Container */}
        <main className="flex-1 p-4 md:p-6 max-w-5xl w-full mx-auto pb-12">
          {children}
        </main>
      </div>
    </div>
  );
}
