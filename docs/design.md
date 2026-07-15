This design specification establishes a clean, minimalist light-mode architecture for your personal super-app, built entirely on standard **shadcn/ui** primitives without custom component overhead. By mapping your five-color palette directly into Tailwind and shadcn's CSS variable system, the interface achieves visual consistency, readability, and distinct functional hierarchy across all nine core modules.

---

# Design System & Theme Configuration

## Color Palette Mapping

The UI operates strictly in **light mode**, utilizing pure white (`#ffffff`) for primary page backgrounds to maximize contrast and cleanliness. Your five core colors are systematically assigned to shadcn theme tokens to handle hierarchy, interactivity, and structure.

| Color Name | Hex / HSL | shadcn Token Mapping | Usage Context |
| --- | --- | --- | --- |
| **Twilight Indigo** | `#2e426bff`<br>

<br>`hsla(220, 40%, 30%, 1)` | `--primary`<br>

<br>`--ring` | Primary action buttons, active navigation states, key emphasis, focus rings. |
| **Charcoal Blue** | `#313d4cff`<br>

<br>`hsla(213, 22%, 25%, 1)` | `--foreground`<br>

<br>`--card-foreground` | Main body text, headings, icons, primary data typography. |
| **Cool Sky** | `#6fb2f6ff`<br>

<br>`hsla(210, 88%, 70%, 1)` | `--accent`<br>

<br>`--primary-hover` | Hover states, interactive highlights, chart accents, AI feature triggers. |
| **Wisteria Blue** | `#739dd1ff`<br>

<br>`hsla(213, 51%, 64%, 1)` | `--muted-foreground`<br>

<br>`--secondary-foreground` | Secondary text, placeholders, timestamps, inactive icons, metadata. |
| **Powder Blue** | `#a6c5ecff`<br>

<br>`hsla(213, 65%, 79%, 1)` | `--secondary`<br>

<br>`--muted`<br>

<br>`--border` | Card backgrounds, table headers, borders, dividers, badge backgrounds. |

### Tailwind / CSS Variables Setup (`globals.css`)

```css
:root {
  --background: 0 0% 100%;
  --foreground: 213 22% 25%;
  
  --card: 0 0% 100%;
  --card-foreground: 213 22% 25%;
  
  --popover: 0 0% 100%;
  --popover-foreground: 213 22% 25%;
  
  --primary: 220 40% 30%;
  --primary-foreground: 0 0% 100%;
  
  --secondary: 213 65% 79%;
  --secondary-foreground: 220 40% 30%;
  
  --muted: 213 65% 92%; /* Light tint of Powder Blue for subtle backgrounds */
  --muted-foreground: 213 51% 64%;
  
  --accent: 210 88% 70%;
  --accent-foreground: 213 22% 25%;
  
  --destructive: 0 84% 60%;
  --destructive-foreground: 0 0% 100%;
  
  --border: 213 65% 79%;
  --input: 213 65% 79%;
  --ring: 220 40% 30%;
  
  --radius: 0.5rem;
}

```

---

# Application Shell & Layout

The global layout relies on standard navigation components to seamlessly switch between tools while maintaining context.

* **Sidebar (`Sidebar`, `SidebarContent`, `SidebarGroup`, `SidebarItem`):** A persistent left-hand collapsible navigation menu displaying icons and labels for all nine features. Active states use `--secondary` (Powder Blue) backgrounds with `--primary` (Twilight Indigo) text.
* **Top Bar (`Header`, `Breadcrumb`, `Button`):** Contains current page breadcrumbs, a system status indicator, and a trigger button for the Command Palette.
* **Quick Actions (`Command`, `CommandDialog`, `CommandInput`, `CommandList`):** Accessible via `Ctrl+K` / `Cmd+K` or the top bar. Allows instant jumping to features, creating quick tasks, or logging expenses from anywhere in the app.
* **Notifications & Feedback (`Toast`, `Toaster`):** Used globally for system confirmations (e.g., "Expense logged", "AI generating note...", "Email reminder scheduled").

---

# Feature-to-Component Architecture

Every feature is constructed strictly by composing standard shadcn/ui primitives. No custom UI components will be generated; variations are handled via props, utility classes, and standard layout containers.

### 1. Home Dashboard

* **Layout:** Standard CSS Grid wrapping shadcn `Card` components.
* **Shortcuts:** `Card`, `CardHeader`, `CardTitle`, and `Button` configured as outline or ghost variants for quick navigation to frequent tasks (e.g., "Start Pomodoro", "Log Expense").
* **System Summary:** Small `Card` widgets pulling summary data from other modules (e.g., today's spending total, pending tasks due today, current habit streak).

### 2. Spending Tracking (with DeepSeek AI Autofill)

* **Data Display:** `Table`, `TableHeader`, `TableRow`, `TableHead`, `TableCell` to list daily expenditures with `Badge` components for categorization.
* **Manual Entry:** Triggered via `Dialog` containing standard `Form`, `Input`, `Select` (for categories), and `DatePicker` (`Popover` + `Calendar`).
* **AI Photo Autofill:**
* A primary `Button` labeled "Scan Receipt (AI)" featuring an upload icon.
* Uses a standard file `<input type="file">` visually hidden and triggered by the shadcn `Button`.
* **Loading State:** Standard `Button` disabled state with a Lucide spinner icon and text "DeepSeek AI Extracting...".
* Once processed, the system automatically populates the `Dialog` form inputs for user verification before saving.



### 3. Money Log (Account Net Worth)

* **Overview:** `Grid` of `Card` components displaying individual balances for bank accounts, cash, or e-wallets.
* **Visualizing Growth:** Shadcn `Chart` (built on Recharts) using an Area Chart or Bar Chart styled with `--cool-sky` and `--twilight-indigo` gradients to show total net worth over time.
* **Logging Entries:** A simple `Sheet` (slide-over panel from the right) with `Input` fields for each existing account to append periodic balance checkpoints.

### 4. Pomodoro Timer

* **Timer Display:** A large centered `Card` containing bold typography for the countdown time.
* **Mode Switching:** `Tabs`, `TabsList`, `TabsTrigger` to switch cleanly between **Pomodoro**, **Short Break**, and **Long Break**.
* **Controls:** Standard large `Button` components for Start (Primary/Twilight Indigo), Pause (Accent/Cool Sky), and Reset (Outline/Powder Blue border).
* **Project Tagging:** A `Select` dropdown placed directly below the timer controls to assign the current session to an active project or tag.
* **Monitoring & Reports:** A secondary tab or collapsible `Accordion` revealing a shadcn Bar `Chart` detailing focus hours completed per day/week and a `Table` of logged sessions.

### 5. Personal CRM (Friends & Contacts)

* **Contact Directory:** A responsive grid of `Card` elements. Each card features an `Avatar`, `AvatarImage`, and `AvatarFallback` displaying initials, alongside contact names and relationship `Badge` tags.
* **Detailed View:** Clicking a contact opens a `Sheet` revealing full descriptions, linked notes, interaction history, and contact details.
* **Management:** `Dialog` containing `Input`, `Textarea` (for personal context/descriptions), and file upload for avatar photos.

### 6. Task Management

* **Task List:** Composed using `Table` or structured vertical `Card` lists.
* **Interactivity:** Shadcn `Checkbox` for marking completion, styling completed rows with strikethrough typography and `--muted-foreground` color.
* **Organization:** `Badge` components for project tags. `HoverCard` to preview long task descriptions without opening a modal.
* **Deadlines & Email Alerts:**
* Due dates set via `Calendar` inside a `Popover`.
* Email notification preferences configured inside the task creation `Dialog` using a `Switch` component labeled "Notify via Email before deadline".



### 7. Notes (Markdown & AI Generation)

* **Interface:** A two-column layout using `ResizablePanelGroup`, `ResizablePanel`, and `ResizableHandle`. Left panel holds a searchable list of note `Card` previews; right panel holds the active editor.
* **Editor:** Styled `Textarea` for raw Markdown input, or standard typography classes applied to a rendered preview view, toggled via `ToggleGroup`.
* **Metadata:** `Input` for titles, `Select` for linking to Projects/CRM friends, and standard `Button` attachments for images.
* **DeepSeek AI Assistant:** A dropdown `DropdownMenu` triggered by a "Sparkle" `Button` in the editor toolbar, offering quick AI prompts: *"Summarize Note"*, *"Generate Action Items"*, or *"Expand Thoughts"*. Results stream directly into the text area.

### 8. Events

* **View Modes:** `Tabs` switching between a chronological `Table` list view and a visual calendar view using shadcn's `Calendar` component.
* **Event Creation:** A `Dialog` form featuring `Input` for location/title, `DatePicker` with time selection, and standard file attachment inputs for photos.
* **CRM Integration:** A `Combobox` (built using `Command` and `Popover`) allowing multi-select tagging of friends from the Personal CRM database to associate them with the event.

### 9. Habit Tracker

* **Daily Logging Matrix:** A dense `Table` where rows represent habits and columns represent days of the current week/month. Cells contain interactive shadcn `Checkbox` primitives to log completion.
* **Habit Creation:** A simple `Dialog` prompting for habit name, frequency, and target goal.
* **Statistics & Analytics:** Dedicated analytical section using shadcn `Chart`:
* **Line Chart:** Tracking completion percentage over time using `--cool-sky`.
* **Progress Bars:** Standard shadcn `Progress` component showing monthly completion rates for each individual habit.



---

# AI & Asynchronous State Handling

To ensure a seamless user experience while interacting with DeepSeek AI or Cloudflare D1 database operations, strict state guidelines apply using existing library primitives:

1. **Loading States:** Whenever an AI generation or data fetch occurs, UI elements must display shadcn `Skeleton` loaders matching the exact dimensions of the expected content (e.g., skeleton rows for tables, skeleton text blocks for AI note generation).
2. **Form Submission:** Any `Button` triggering an asynchronous API call (like DeepSeek receipt parsing or Nodemailer email scheduling) must immediately disable and prefix its label with a Lucide `<Loader2 className="mr-2 h-4 w-4 animate-spin"/>` icon.
3. **Error Handling:** Failed API requests or email dispatch errors will surface immediately via shadcn destructive `Toast` notifications (`variant="destructive"`), ensuring the user is never left guessing whether a background task succeeded.

---

Which feature module would you like to begin implementing first, or should we start by setting up the Cloudflare D1 and Prisma database schema bindings for this layout?
