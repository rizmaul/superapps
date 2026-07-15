import { useState, useEffect, useRef } from "react";
import { useLoaderData, useSubmit, useFetcher, useSearchParams } from "react-router";
import { format, isToday, isYesterday, getDaysInMonth } from "date-fns";
import {
  Plus,
  Sparkles,
  Trash2,
  Edit3,
  Calendar as CalendarIcon,
  Loader2,
  Receipt,
  Utensils,
  Car,
  Zap,
  ShoppingBag,
  Tv,
  HelpCircle,
  Upload,
  X,
  ChevronDown,
  ChevronUp
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

// DB
import { getDB } from "@/lib/db.server";
import type { Route } from "./+types/spending";

export async function loader({ context }: Route.LoaderArgs) {
  const db = getDB(context.cloudflare.env.DB);

  const logs = await db.spendingLog.findMany({
    orderBy: {
      spentAt: "desc"
    }
  });

  const quotas = await db.monthlyQuota.findMany();

  return { logs, quotas };
}

export async function action({ request, context }: Route.ActionArgs) {
  const db = getDB(context.cloudflare.env.DB);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create-expense" || intent === "update-expense") {
    const amount = parseFloat(formData.get("amount") as string);
    const category = formData.get("category") as string;
    const spentAtStr = formData.get("spentAt") as string;
    const notes = formData.get("notes") as string;
    const useQuota = formData.get("useQuota") !== "false";

    const spentAt = spentAtStr ? new Date(spentAtStr) : new Date();

    if (intent === "create-expense") {
      await db.spendingLog.create({
        data: {
          amount,
          category,
          spentAt,
          notes,
          useQuota
        }
      });
      return { success: true };
    } else {
      const id = formData.get("id") as string;
      await db.spendingLog.update({
        where: { id },
        data: {
          amount,
          category,
          spentAt,
          notes,
          useQuota
        }
      });
      return { success: true };
    }
  }

  if (intent === "delete-expense") {
    const id = formData.get("id") as string;
    await db.spendingLog.delete({
      where: { id }
    });
    return { success: true };
  }

  if (intent === "set-quota") {
    const year = parseInt(formData.get("year") as string);
    const month = parseInt(formData.get("month") as string);
    const amount = parseFloat(formData.get("amount") as string);

    await db.monthlyQuota.upsert({
      where: {
        year_month: { year, month }
      },
      update: { amount },
      create: { year, month, amount }
    });
    return { success: true };
  }

  return { success: false };
}

const CATEGORIES = [
  { value: "food", label: "Food & Beverage", icon: Utensils, colorClass: "bg-rose-50 text-rose-500 border-rose-100" },
  { value: "transport", label: "Transport", icon: Car, colorClass: "bg-blue-50 text-blue-500 border-blue-100" },
  { value: "utilities", label: "Utilities & Bills", icon: Zap, colorClass: "bg-indigo-50 text-indigo-500 border-indigo-100" },
  { value: "shopping", label: "Shopping", icon: ShoppingBag, colorClass: "bg-amber-50 text-amber-500 border-amber-100" },
  { value: "entertainment", label: "Entertainment", icon: Tv, colorClass: "bg-purple-50 text-purple-500 border-purple-100" },
  { value: "others", label: "Others", icon: HelpCircle, colorClass: "bg-gray-50 text-gray-500 border-gray-100" },
];

// Debt calculation logic that carries over month by month
function calculateDebtAndQuotas(
  logs: any[],
  quotas: any[],
  targetYear: number,
  targetMonth: number
) {
  // Find range of months to compute
  let startYear = targetYear;
  let startMonth = targetMonth;

  logs.forEach((log) => {
    const d = new Date(log.spentAt);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    if (y < startYear || (y === startYear && m < startMonth)) {
      startYear = y;
      startMonth = m;
    }
  });

  quotas.forEach((q) => {
    if (q.year < startYear || (q.year === startYear && q.month < startMonth)) {
      startYear = q.year;
      startMonth = q.month;
    }
  });

  let carriedOverDebt = 0;
  const resultsByMonth: { [key: string]: any } = {};

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const currentDay = today.getDate();

  let y = startYear;
  let m = startMonth;

  while (y < targetYear || (y === targetYear && m <= targetMonth)) {
    const monthKey = `${y}-${m}`;
    const quotaObj = quotas.find((q) => q.year === y && q.month === m);
    const monthlyQuotaVal = quotaObj ? quotaObj.amount : 3000000;

    const tempDate = new Date(y, m - 1, 1);
    const daysInMonth = getDaysInMonth(tempDate);
    const dailyQuotaVal = monthlyQuotaVal / daysInMonth;

    const monthLogs = logs.filter((log) => {
      const d = new Date(log.spentAt);
      return d.getFullYear() === y && (d.getMonth() + 1) === m;
    });

    const daySpendingMap: { [key: number]: number } = {};
    monthLogs.forEach((log) => {
      if (log.useQuota !== false) {
        const d = new Date(log.spentAt);
        const day = d.getDate();
        daySpendingMap[day] = (daySpendingMap[day] || 0) + log.amount;
      }
    });

    // Compute active days to calculate debt for the month
    let maxDay = daysInMonth;
    if (y > currentYear || (y === currentYear && m > currentMonth)) {
      maxDay = 0;
    } else if (y === currentYear && m === currentMonth) {
      maxDay = currentDay;
    }

    let runningDebt = carriedOverDebt;
    const dailyDetails = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const spending = daySpendingMap[day] || 0;
      if (day <= maxDay) {
        if (spending > dailyQuotaVal) {
          runningDebt += (spending - dailyQuotaVal);
        } else {
          const remaining = dailyQuotaVal - spending;
          runningDebt = Math.max(0, runningDebt - remaining);
        }
      }
      dailyDetails.push({
        day,
        spending,
        quota: dailyQuotaVal,
        debtAfterDay: runningDebt,
      });
    }

    resultsByMonth[monthKey] = {
      year: y,
      month: m,
      monthlyQuota: monthlyQuotaVal,
      dailyQuota: dailyQuotaVal,
      initialDebt: carriedOverDebt,
      endDebt: runningDebt,
      dailyDetails,
    };

    carriedOverDebt = runningDebt;

    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }

  return resultsByMonth;
}

export default function SpendingRoute() {
  const { logs, quotas } = useLoaderData<typeof loader>();
  const submit = useSubmit();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Search parameters for Month Selection
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedYear = parseInt(searchParams.get("year") || new Date().getFullYear().toString());
  const selectedMonth = parseInt(searchParams.get("month") || (new Date().getMonth() + 1).toString());

  // Dialog & Form states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isQuotaOpen, setIsQuotaOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<any>(null);

  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("food");
  const [spentAt, setSpentAt] = useState<Date | undefined>(new Date());
  const [notes, setNotes] = useState("");
  const [useQuota, setUseQuota] = useState(true);

  // Quota Management
  const [quotaInput, setQuotaInput] = useState("");

  // Filters expansion, categories and ranges
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [isGrouped, setIsGrouped] = useState(true);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  // AI Mockup scanning state
  const [isScanning, setIsScanning] = useState(false);

  const expenseFetcher = useFetcher<{ success: boolean }>();
  const quotaFetcher = useFetcher<{ success: boolean }>();

  // Resolve calculations
  const monthKey = `${selectedYear}-${selectedMonth}`;
  const calculations = calculateDebtAndQuotas(logs, quotas, selectedYear, selectedMonth);

  // Accumulated debt and carried over debt are mapped to the same value (endDebt)
  const monthData = calculations[monthKey] || {
    monthlyQuota: 3000000,
    dailyQuota: 3000000 / 30,
    initialDebt: 0,
    endDebt: 0,
    dailyDetails: []
  };

  const { monthlyQuota, dailyQuota, endDebt } = monthData;

  useEffect(() => {
    setQuotaInput(monthlyQuota.toString());
  }, [monthlyQuota]);

  // Format IDR Currency
  const formatIDR = (value: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Safe fetcher tracking to prevent loop resetting
  const wasSubmittingExpense = useRef(false);
  const wasSubmittingQuota = useRef(false);

  useEffect(() => {
    if (expenseFetcher.state === "submitting") {
      wasSubmittingExpense.current = true;
    }
    if (expenseFetcher.state === "idle" && wasSubmittingExpense.current) {
      wasSubmittingExpense.current = false;
      if (expenseFetcher.data?.success) {
        const isEdit = !!editingLog;
        setIsFormOpen(false);
        setEditingLog(null);
        setAmount("");
        setCategory("food");
        setSpentAt(new Date());
        setNotes("");
        setUseQuota(true);
        toast.success(isEdit ? "Expense updated!" : "Expense logged!");
      }
    }
  }, [expenseFetcher.state, expenseFetcher.data, editingLog]);

  useEffect(() => {
    if (quotaFetcher.state === "submitting") {
      wasSubmittingQuota.current = true;
    }
    if (quotaFetcher.state === "idle" && wasSubmittingQuota.current) {
      wasSubmittingQuota.current = false;
      if (quotaFetcher.data?.success) {
        setIsQuotaOpen(false);
        toast.success("Monthly quota updated!");
      }
    }
  }, [quotaFetcher.state, quotaFetcher.data]);

  const handleOpenCreate = () => {
    setEditingLog(null);
    setAmount("");
    setCategory("food");
    setSpentAt(new Date());
    setNotes("");
    setUseQuota(true);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (log: any) => {
    setEditingLog(log);
    setAmount(log.amount.toString());
    setCategory(log.category);
    setSpentAt(new Date(log.spentAt));
    setNotes(log.notes || "");
    setUseQuota(log.useQuota !== false);
    setIsFormOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this log?")) {
      const formData = new FormData();
      formData.append("intent", "delete-expense");
      formData.append("id", id);
      submit(formData, { method: "post" });
      toast.success("Expense deleted");
    }
  };

  const handleScanClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setIsScanning(true);
      toast.info("Uploading receipt to DeepSeek AI...");

      setTimeout(() => {
        setIsScanning(false);
        setAmount("85000");
        setCategory("food");
        setSpentAt(new Date());
        setNotes("AI scan: Lunch at Starbucks (Mock)");
        setUseQuota(true);
        setIsFormOpen(true);
        toast.success("DeepSeek parsed Starbucks receipt! Confirm details below.");
      }, 2500);
    }
  };

  // Filter transaction list
  const displayedLogs = logs.filter((log) => {
    const logDate = new Date(log.spentAt);

    // Date range or Monthly default
    if (startDate || endDate) {
      if (startDate && logDate < startDate) return false;
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        if (logDate > endDateTime) return false;
      }
    } else {
      if (logDate.getFullYear() !== selectedYear || (logDate.getMonth() + 1) !== selectedMonth) {
        return false;
      }
    }

    // Category filter
    if (categoryFilter !== "all" && log.category !== categoryFilter) {
      return false;
    }

    return true;
  });

  const getCategoryDetails = (catVal: string) => {
    return CATEGORIES.find((c) => c.value === catVal) || CATEGORIES[5];
  };

  // Generate Month Options dynamically (last 12 months)
  const monthOptions = [];
  const currentDate = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
    monthOptions.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      label: format(d, "MMMM yyyy")
    });
  }

  const headerActions = (
    <div className="flex items-center gap-2">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/*"
      />

      <Button
        onClick={handleScanClick}
        variant="outline"
        disabled={isScanning}
        className="text-xs gap-1.5 h-8 px-3 font-semibold border-primary/20 text-primary hover:bg-primary/5 shadow-sm"
      >
        {isScanning ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Scanning...</span>
          </>
        ) : (
          <>
            <Sparkles className="w-3.5 h-3.5" />
            <span>Scan Receipt</span>
          </>
        )}
      </Button>

      <Button
        onClick={handleOpenCreate}
        className="text-xs gap-1.5 h-8 px-3 font-semibold shadow-sm"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>Add Expense</span>
      </Button>
    </div>
  );

  // Grouped render helper
  const renderGroupedTransactions = () => {
    const groupedLogs: { [key: string]: any[] } = {};
    displayedLogs.forEach((log) => {
      const dateStr = format(new Date(log.spentAt), "yyyy-MM-dd");
      if (!groupedLogs[dateStr]) {
        groupedLogs[dateStr] = [];
      }
      groupedLogs[dateStr].push(log);
    });

    const sortedDates = Object.keys(groupedLogs).sort((a, b) => b.localeCompare(a));

    if (sortedDates.length === 0) {
      return renderEmptyState();
    }

    return sortedDates.map((dateStr) => {
      const dayLogs = groupedLogs[dateStr];
      const parsedDate = new Date(dateStr);
      let dateHeader = format(parsedDate, "EEEE, MMMM d");
      if (isToday(parsedDate)) dateHeader = "Today";
      if (isYesterday(parsedDate)) dateHeader = "Yesterday";

      const dayTotal = dayLogs.reduce((sum, item) => sum + item.amount, 0);

      return (
        <div key={dateStr} className="space-y-2">
          <div className="flex justify-between items-center px-2">
            <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">{dateHeader}</span>
            <span className="text-[10px] font-bold text-foreground/80">{formatIDR(dayTotal)}</span>
          </div>

          <div className="space-y-2">
            {dayLogs.map((log) => renderLogCard(log, false))}
          </div>
        </div>
      );
    });
  };

  const renderFlatTransactions = () => {
    if (displayedLogs.length === 0) {
      return renderEmptyState();
    }

    return (
      <div className="space-y-2">
        {displayedLogs.map((log) => renderLogCard(log, true))}
      </div>
    );
  };

  const renderEmptyState = () => (
    <div className="bg-white border border-dashed border-gray-200 py-12 px-4 text-center flex flex-col items-center justify-center gap-3">
      <div className="w-12 h-12 bg-muted/40 rounded-full flex items-center justify-center text-muted-foreground">
        <Receipt className="w-6 h-6" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">No expenses logged yet</p>
        <p className="text-xs text-muted-foreground">Add an expense manually or tap scan receipt to mockup.</p>
      </div>
    </div>
  );

  const renderLogCard = (log: any, showDate: boolean) => {
    const cat = getCategoryDetails(log.category);
    const CatIcon = cat.icon;

    return (
      <div
        key={log.id}
        onClick={() => handleOpenEdit(log)}
        className="bg-white border border-gray-100 p-3.5 shadow-sm flex items-center justify-between gap-4 cursor-pointer active:bg-gray-50/50 hover:border-primary/10 transition-all duration-200"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn("w-10 h-10 flex items-center justify-center border", cat.colorClass)}>
            <CatIcon className="w-5 h-5" />
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-foreground leading-tight">
                {cat.label}
              </span>
              {log.useQuota === false && (
                <Badge variant="outline" className="text-[8px] px-1 py-0 rounded bg-gray-100 text-gray-500 border-gray-200 uppercase font-bold tracking-wider">
                  Excluded from Quota
                </Badge>
              )}
            </div>
            {showDate && (
              <span className="text-[9px] text-muted-foreground font-semibold mt-0.5">
                {format(new Date(log.spentAt), "MMM d, yyyy")}
              </span>
            )}
            <span className="text-[10px] text-muted-foreground truncate mt-0.5 max-w-[200px] sm:max-w-md">
              {log.notes || "No notes added"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-extrabold text-rose-500 whitespace-nowrap">
            -{formatIDR(log.amount)}
          </span>

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(log.id);
            }}
            className="w-8 h-8 hover:bg-gray-50 flex items-center justify-center text-muted-foreground hover:text-destructive transition-all duration-150"
            title="Delete log"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <AppLayout
      title="Spending Tracker"
      actions={headerActions}
    >
      <div className="space-y-5">
        {/* Accumulated Debt - Big Card */}
        <div className="flex flex-row justify-between gap-4">
          <Card className="border-gray-100 shadow-sm overflow-hidden bg-linear-to-br from-rose-50 to-transparent relative flex-grow">
            <CardContent className="px-6 flex flex-col justify-between">
              <div className="">
                <span className="text-[10px] uppercase font-bold text-rose-600 tracking-wider">Accumulated Debt</span>
                <h3 className="text-3xl font-black text-rose-500 tracking-tight">
                  {formatIDR(endDebt)}
                </h3>
              </div>
            </CardContent>
          </Card>

          {/* Small Cards: Monthly Quota and Daily Quota */}
          <div className="grid grid-cols-2 gap-3.5">
            {/* Monthly Quota Card */}
            <Card className="border-gray-100 shadow-sm bg-gradient-to-br from-primary/5 to-transparent relative">
              <CardContent className="px-4 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] uppercase font-bold text-primary tracking-wider">Monthly Quota</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setIsQuotaOpen(true)}
                    className="w-5 h-5 -mt-1 -mr-1 text-muted-foreground hover:text-primary"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <h3 className="text-base font-extrabold text-foreground tracking-tight">
                  {formatIDR(monthlyQuota)}
                </h3>
              </CardContent>
            </Card>

            {/* Daily Quota Card */}
            <Card className="border-gray-100 shadow-sm bg-gradient-to-br from-blue-50/50 to-transparent">
              <CardContent className="px-4 flex flex-col justify-between">
                <span className="text-[10px] uppercase font-bold text-blue-600 tracking-wider">Daily Quota</span>
                <h3 className="text-base font-extrabold text-foreground tracking-tight">
                  {formatIDR(dailyQuota)}
                  <span className="text-[10px] font-normal text-muted-foreground ml-1">/ day</span>
                </h3>
              </CardContent>
            </Card>
          </div>
        </div>


        {/* Collapsible Filters Card */}
        <div className="bg-white border border-gray-100 shadow-sm overflow-hidden transition-all duration-200">
          <button
            type="button"
            onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-foreground">Filters & Options</span>
              <div className="flex items-center gap-1">
                <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-muted text-foreground">
                  {format(new Date(selectedYear, selectedMonth - 1, 1), "MMM yyyy")}
                </Badge>
                {categoryFilter !== "all" && (
                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-blue-50 text-blue-600">
                    {categoryFilter}
                  </Badge>
                )}
                {(startDate || endDate) && (
                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-amber-50 text-amber-600">
                    Range Active
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs font-semibold text-primary">
              <span>{isFiltersExpanded ? "Hide" : "Show"}</span>
              {isFiltersExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </div>
          </button>

          {isFiltersExpanded && (
            <div className="px-4 pb-4 pt-2 border-t border-gray-100 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Month Selection */}
                <div className="flex items-center gap-2 border border-gray-200 px-3 py-1.5 flex-1 bg-white">
                  <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground" />
                  <select
                    value={`${selectedYear}-${selectedMonth}`}
                    onChange={(e) => {
                      const [y, m] = e.target.value.split("-");
                      setSearchParams({ year: y, month: m });
                    }}
                    className="text-xs font-semibold bg-transparent border-none outline-none text-foreground flex-1 cursor-pointer"
                  >
                    {monthOptions.map((opt) => (
                      <option key={`${opt.year}-${opt.month}`} value={`${opt.year}-${opt.month}`}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Category Filter */}
                <div className="flex items-center gap-2 border border-gray-200 px-3 py-1.5 flex-1 bg-white">
                  <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="text-xs font-semibold bg-transparent border-none outline-none text-foreground flex-1 cursor-pointer"
                  >
                    <option value="all">All Categories</option>
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Grouping Toggle */}
                <div className="flex items-center gap-2.5 px-1 py-1 sm:py-0">
                  <Switch
                    id="group-by-day"
                    checked={isGrouped}
                    onCheckedChange={setIsGrouped}
                  />
                  <Label
                    htmlFor="group-by-day"
                    className="text-xs font-semibold cursor-pointer text-foreground whitespace-nowrap"
                  >
                    Group by Day
                  </Label>
                </div>
              </div>

              {/* Date Range Filter */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider whitespace-nowrap">
                  Date Range:
                </span>
                <div className="flex items-center gap-2 flex-1">
                  {/* Start Date Calendar Picker */}
                  <Popover>
                    <PopoverTrigger
                      render={
                        <Button
                          variant="outline"
                          className={cn(
                            "flex-1 border-gray-200 justify-start text-left font-normal px-3 text-xs h-9 bg-white",
                            !startDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                          {startDate ? format(startDate, "MMM d, yyyy") : <span>Start Date</span>}
                        </Button>
                      }
                    />
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={setStartDate}
                      />
                    </PopoverContent>
                  </Popover>

                  <span className="text-xs text-muted-foreground">to</span>

                  {/* End Date Calendar Picker */}
                  <Popover>
                    <PopoverTrigger
                      render={
                        <Button
                          variant="outline"
                          className={cn(
                            "flex-1 border-gray-200 justify-start text-left font-normal px-3 text-xs h-9 bg-white",
                            !endDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                          {endDate ? format(endDate, "MMM d, yyyy") : <span>End Date</span>}
                        </Button>
                      }
                    />
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={setEndDate}
                      />
                    </PopoverContent>
                  </Popover>

                  {(startDate || endDate) && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setStartDate(undefined);
                        setEndDate(undefined);
                      }}
                      className="w-8 h-8 text-muted-foreground hover:text-destructive hover:bg-rose-50"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Expense List */}
        <div className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {startDate || endDate ? "Filtered Transactions" : "Transactions this Month"}
            </h3>
            <span className="text-xs text-muted-foreground font-semibold">
              Total Spending: {formatIDR(displayedLogs.reduce((sum, item) => sum + item.amount, 0))}
            </span>
          </div>

          {isGrouped ? renderGroupedTransactions() : renderFlatTransactions()}
        </div>

        {/* Add/Edit Expense Dialog */}
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="max-w-[90vw] sm:max-w-md p-6">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-foreground">
                {editingLog ? "Edit Expense" : "Log Expense"}
              </DialogTitle>
            </DialogHeader>

            <expenseFetcher.Form method="post" action="/spending" className="space-y-4 pt-2">
              <input type="hidden" name="intent" value={editingLog ? "update-expense" : "create-expense"} />
              {editingLog && <input type="hidden" name="id" value={editingLog.id} />}

              {/* Amount input */}
              <div className="space-y-1.5">
                <Label htmlFor="amount" className="text-xs font-semibold text-foreground">Amount (IDR)</Label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">Rp</span>
                  <Input
                    id="amount"
                    name="amount"
                    type="number"
                    required
                    value={amount}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
                    placeholder="0"
                    className="pl-9 border-gray-200 focus:border-primary font-bold text-base"
                  />
                </div>
              </div>

              {/* Category input */}
              <div className="space-y-1.5">
                <Label htmlFor="category" className="text-xs font-semibold text-foreground">Category</Label>
                <Select value={category} onValueChange={(val) => setCategory(val || "food")} name="category">
                  <SelectTrigger id="category" className="border-gray-200">
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => {
                      const CatIcon = cat.icon;
                      return (
                        <SelectItem key={cat.value} value={cat.value}>
                          <div className="flex items-center gap-2 text-xs">
                            <CatIcon className="w-4 h-4" />
                            {cat.label}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Date Input */}
              <div className="space-y-1.5 flex flex-col">
                <Label className="text-xs font-semibold text-foreground mb-0.5">Date Spent</Label>
                <input
                  type="hidden"
                  name="spentAt"
                  value={spentAt ? spentAt.toISOString() : ""}
                />
                <Popover>
                  <PopoverTrigger
                    render={
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full border-gray-200 justify-start text-left font-normal px-3 h-9",
                          !spentAt && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {spentAt ? format(spentAt, "PPP") : <span>Pick a date</span>}
                      </Button>
                    }
                  />
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      selected={spentAt}
                      onSelect={setSpentAt}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Notes input */}
              <div className="space-y-1.5">
                <Label htmlFor="notes" className="text-xs font-semibold text-foreground">Notes</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  value={notes}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
                  placeholder="Starbucks coffee, grocery shopping..."
                  rows={2}
                  className="border-gray-200 focus:border-primary resize-none"
                />
              </div>

              {/* Use Quota toggle */}
              <div className="flex items-center justify-between py-2 border-t border-gray-100">
                <div className="flex flex-col gap-0.5">
                  <Label htmlFor="use-quota" className="text-xs font-semibold text-foreground">
                    Use Daily Quota
                  </Label>
                  <span className="text-[10px] text-muted-foreground">
                    Count this expense towards the daily quota and debt calculation
                  </span>
                </div>
                <input
                  type="hidden"
                  name="useQuota"
                  value={useQuota ? "true" : "false"}
                />
                <Switch
                  id="use-quota"
                  checked={useQuota}
                  onCheckedChange={setUseQuota}
                />
              </div>

              <DialogFooter className="pt-2 gap-2 flex-row justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsFormOpen(false)}
                  className="text-muted-foreground hover:bg-gray-100 flex-1 sm:flex-initial"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={expenseFetcher.state === "submitting"}
                  className="bg-primary text-primary-foreground hover:bg-primary/95 flex-1 sm:flex-initial"
                >
                  {expenseFetcher.state === "submitting" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Expense"
                  )}
                </Button>
              </DialogFooter>
            </expenseFetcher.Form>
          </DialogContent>
        </Dialog>

        {/* Set Monthly Quota Dialog */}
        <Dialog open={isQuotaOpen} onOpenChange={setIsQuotaOpen}>
          <DialogContent className="max-w-[90vw] sm:max-w-sm p-6">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-foreground">
                Set Monthly Quota ({format(new Date(selectedYear, selectedMonth - 1, 1), "MMMM yyyy")})
              </DialogTitle>
            </DialogHeader>

            <quotaFetcher.Form method="post" action="/spending" className="space-y-4 pt-2">
              <input type="hidden" name="intent" value="set-quota" />
              <input type="hidden" name="year" value={selectedYear} />
              <input type="hidden" name="month" value={selectedMonth} />

              <div className="space-y-1.5">
                <Label htmlFor="quota-amount" className="text-xs font-semibold text-foreground">
                  Quota Amount (IDR)
                </Label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">Rp</span>
                  <Input
                    id="quota-amount"
                    name="amount"
                    type="number"
                    required
                    value={quotaInput}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuotaInput(e.target.value)}
                    placeholder="3000000"
                    className="pl-9 border-gray-200 focus:border-primary font-bold"
                  />
                </div>
              </div>

              <DialogFooter className="pt-2 gap-2 flex-row justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsQuotaOpen(false)}
                  className="text-muted-foreground hover:bg-gray-100 flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={quotaFetcher.state === "submitting"}
                  className="bg-primary text-primary-foreground hover:bg-primary/95 flex-1"
                >
                  {quotaFetcher.state === "submitting" ? "Saving..." : "Save Quota"}
                </Button>
              </DialogFooter>
            </quotaFetcher.Form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
