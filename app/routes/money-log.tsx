import { useState, useEffect, useRef } from "react";
import { useLoaderData, useFetcher } from "react-router";
import { format } from "date-fns";
import {
  Plus,
  Trash2,
  Wallet,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  Edit3,
  X,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import type { Route } from "./+types/money-log";

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_ACCOUNTS = [
  "Wallet",
  "BCA",
  "JAGO",
  "Gopay",
  "OVO",
  "Reimbursement",
];

const ACCOUNT_COLORS: Record<string, string> = {
  Wallet: "bg-amber-50 text-amber-600 border-amber-200",
  BCA: "bg-blue-50 text-blue-600 border-blue-200",
  JAGO: "bg-violet-50 text-violet-600 border-violet-200",
  Gopay: "bg-green-50 text-green-600 border-green-200",
  OVO: "bg-purple-50 text-purple-600 border-purple-200",
  Reimbursement: "bg-rose-50 text-rose-600 border-rose-200",
  Other: "bg-gray-50 text-gray-600 border-gray-200",
};

function getAccountColor(account: string): string {
  return ACCOUNT_COLORS[account] ?? ACCOUNT_COLORS["Other"];
}

const PAGE_SIZE = 5;

// ─── Loader & Action ──────────────────────────────────────────────────────────

export async function loader({ context }: Route.LoaderArgs) {
  const db = context.cloudflare.env.DB;

  const { results: rawSnapshots } = await db
    .prepare("SELECT * FROM money_log_snapshots ORDER BY logged_at DESC")
    .all();

  const { results: rawEntries } = await db
    .prepare("SELECT * FROM money_log_entries")
    .all();

  const entriesBySnapshot: Record<string, any[]> = {};
  (rawEntries || []).forEach((e: any) => {
    if (!entriesBySnapshot[e.snapshot_id]) {
      entriesBySnapshot[e.snapshot_id] = [];
    }
    entriesBySnapshot[e.snapshot_id].push({
      id: e.id,
      snapshotId: e.snapshot_id,
      account: e.account,
      amount: e.amount,
    });
  });

  const snapshots = (rawSnapshots || []).map((s: any) => ({
    id: s.id,
    loggedAt: s.logged_at,
    notes: s.notes,
    entries: entriesBySnapshot[s.id] || [],
  }));

  return { snapshots };
}

export async function action({ request, context }: Route.ActionArgs) {
  const db = context.cloudflare.env.DB;
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create-snapshot") {
    const loggedAtStr = formData.get("loggedAt") as string;
    const notes = formData.get("notes") as string;
    const entriesJson = formData.get("entries") as string;

    const loggedAt = loggedAtStr
      ? new Date(loggedAtStr).toISOString()
      : new Date().toISOString();
    const entries: Array<{ account: string; amount: number }> = JSON.parse(
      entriesJson || "[]"
    );

    const snapshotId = crypto.randomUUID();
    await db
      .prepare(
        "INSERT INTO money_log_snapshots (id, logged_at, notes) VALUES (?, ?, ?)"
      )
      .bind(snapshotId, loggedAt, notes || null)
      .run();

    for (const entry of entries) {
      await db
        .prepare(
          "INSERT INTO money_log_entries (id, snapshot_id, account, amount) VALUES (?, ?, ?, ?)"
        )
        .bind(crypto.randomUUID(), snapshotId, entry.account, entry.amount)
        .run();
    }

    return { success: true, action: "create" };
  }

  if (intent === "update-snapshot") {
    const id = formData.get("id") as string;
    const loggedAtStr = formData.get("loggedAt") as string;
    const notes = formData.get("notes") as string;
    const entriesJson = formData.get("entries") as string;

    const loggedAt = loggedAtStr
      ? new Date(loggedAtStr).toISOString()
      : new Date().toISOString();
    const entries: Array<{ account: string; amount: number }> = JSON.parse(
      entriesJson || "[]"
    );

    await db
      .prepare(
        "UPDATE money_log_snapshots SET logged_at = ?, notes = ? WHERE id = ?"
      )
      .bind(loggedAt, notes || null, id)
      .run();

    // Replace all entries
    await db
      .prepare("DELETE FROM money_log_entries WHERE snapshot_id = ?")
      .bind(id)
      .run();

    for (const entry of entries) {
      await db
        .prepare(
          "INSERT INTO money_log_entries (id, snapshot_id, account, amount) VALUES (?, ?, ?, ?)"
        )
        .bind(crypto.randomUUID(), id, entry.account, entry.amount)
        .run();
    }

    return { success: true, action: "update" };
  }

  if (intent === "delete-snapshot") {
    const id = formData.get("id") as string;
    await db
      .prepare("DELETE FROM money_log_snapshots WHERE id = ?")
      .bind(id)
      .run();
    return { success: true, action: "delete" };
  }

  return { success: false };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatIDR(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// ─── Total-only SVG Line Chart ────────────────────────────────────────────────

function TotalLineChart({ snapshots }: { snapshots: any[] }) {
  // Use last 10 snapshots, oldest-first for plotting
  const ordered = [...snapshots].slice(0, 10).reverse();

  if (ordered.length < 2) {
    return (
      <div className="flex items-center justify-center h-32 text-xs text-muted-foreground">
        Add at least 2 snapshots to see the trend chart.
      </div>
    );
  }

  const totals = ordered.map((s) =>
    s.entries.reduce((sum: number, e: any) => sum + e.amount, 0)
  );
  const labels = ordered.map((s) => format(new Date(s.loggedAt), "MMM d"));

  const W = 700;
  const H = 200;
  const PAD = { top: 16, right: 16, bottom: 32, left: 70 };

  const minVal = Math.min(...totals);
  const maxVal = Math.max(...totals);
  const valRange = maxVal - minVal || 1;
  const xStep = (W - PAD.left - PAD.right) / Math.max(totals.length - 1, 1);

  const toX = (i: number) => PAD.left + i * xStep;
  const toY = (v: number) =>
    PAD.top + (1 - (v - minVal) / valRange) * (H - PAD.top - PAD.bottom);

  const points = totals.map((v, i) => `${toX(i)},${toY(v)}`).join(" ");

  // Area fill
  const areaPoints = [
    `${toX(0)},${H - PAD.bottom}`,
    ...totals.map((v, i) => `${toX(i)},${toY(v)}`),
    `${toX(totals.length - 1)},${H - PAD.bottom}`,
  ].join(" ");

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ minWidth: `${Math.max(ordered.length * 60, 300)}px`, height: "180px" }}
      >
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0, 0.5, 1].map((t, i) => {
          const val = minVal + t * valRange;
          const y = toY(val);
          return (
            <g key={i}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y}
                y2={y}
                stroke="#e5e7eb"
                strokeWidth={1}
                strokeDasharray="4,4"
              />
              <text x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize={9} fill="#9ca3af">
                {val >= 1_000_000
                  ? `${(val / 1_000_000).toFixed(1)}M`
                  : val >= 1000
                  ? `${(val / 1000).toFixed(0)}K`
                  : val.toFixed(0)}
              </text>
            </g>
          );
        })}

        {/* X labels */}
        {labels.map((label, i) => (
          <text
            key={i}
            x={toX(i)}
            y={H - PAD.bottom + 16}
            textAnchor="middle"
            fontSize={9}
            fill="#9ca3af"
          >
            {label}
          </text>
        ))}

        {/* Area */}
        <polygon points={areaPoints} fill="url(#areaGrad)" />

        {/* Line */}
        <polyline
          points={points}
          fill="none"
          stroke="#6366f1"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Dots */}
        {totals.map((v, i) => (
          <circle key={i} cx={toX(i)} cy={toY(v)} r={3.5} fill="#6366f1" />
        ))}
      </svg>
    </div>
  );
}

function formatRupiahInput(val: string): string {
  const digits = val.replace(/\D/g, "");
  if (!digits) return "";
  return new Intl.NumberFormat("id-ID").format(parseInt(digits, 10));
}

// ─── Snapshot Form Dialog ─────────────────────────────────────────────────────

type EntryRow = { id: string; account: string; amount: string; isCustom: boolean };

interface SnapshotDialogProps {
  open: boolean;
  onClose: () => void;
  editingSnapshot: any | null; // null = create mode
  fetcher: ReturnType<typeof useFetcher<any>>;
}

function SnapshotDialog({ open, onClose, editingSnapshot, fetcher }: SnapshotDialogProps) {
  const [loggedAt, setLoggedAt] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [notes, setNotes] = useState("");
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [customInput, setCustomInput] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  const wasSubmitting = useRef(false);

  // Seed form when editing
  useEffect(() => {
    if (open) {
      if (editingSnapshot) {
        setLoggedAt(format(new Date(editingSnapshot.loggedAt), "yyyy-MM-dd'T'HH:mm"));
        setNotes(editingSnapshot.notes ?? "");
        setEntries(
          editingSnapshot.entries.map((e: any) => ({
            id: e.id,
            account: e.account,
            amount: formatRupiahInput(String(e.amount)),
            isCustom: !DEFAULT_ACCOUNTS.includes(e.account),
          }))
        );
      } else {
        setLoggedAt(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
        setNotes("");
        setEntries([]);
      }
      setCustomInput("");
      setShowCustom(false);
    }
  }, [open, editingSnapshot]);

  useEffect(() => {
    if (fetcher.state === "submitting") {
      wasSubmitting.current = true;
    }
    if (fetcher.state === "idle" && wasSubmitting.current) {
      wasSubmitting.current = false;
      if (fetcher.data?.success) {
        onClose();
        toast.success(
          fetcher.data.action === "update"
            ? "Snapshot updated!"
            : "Snapshot saved!"
        );
      }
    }
  }, [fetcher.state, fetcher.data, onClose]);

  const selectedNames = new Set(entries.map((e) => e.account));
  const availableDefaults = DEFAULT_ACCOUNTS.filter((a) => !selectedNames.has(a));

  function addAccount(account: string) {
    if (selectedNames.has(account)) { toast.info(`${account} already added.`); return; }
    setEntries((p) => [...p, { id: crypto.randomUUID(), account, amount: "", isCustom: false }]);
  }

  function addCustom() {
    const name = customInput.trim();
    if (!name) return;
    if (selectedNames.has(name)) { toast.info(`${name} already added.`); return; }
    setEntries((p) => [...p, { id: crypto.randomUUID(), account: name, amount: "", isCustom: true }]);
    setCustomInput("");
    setShowCustom(false);
  }

  function handleSubmit() {
    const valid = entries
      .filter((e) => e.account && e.amount !== "")
      .map((e) => ({ account: e.account, amount: parseFloat(e.amount.replace(/\D/g, "")) || 0 }));

    if (valid.length === 0) { toast.error("Add at least one account entry."); return; }

    const fd = new FormData();
    fd.append("intent", editingSnapshot ? "update-snapshot" : "create-snapshot");
    if (editingSnapshot) fd.append("id", editingSnapshot.id);
    fd.append("loggedAt", new Date(loggedAt).toISOString());
    fd.append("notes", notes);
    fd.append("entries", JSON.stringify(valid));
    fetcher.submit(fd, { method: "post", action: "/money-log" });
  }

  const total = entries.reduce((sum, e) => sum + (parseFloat(e.amount.replace(/\D/g, "")) || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg rounded-md p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">
            {editingSnapshot ? "Edit Snapshot" : "Log Money Snapshot"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Date/time */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Date & Time</Label>
            <Input
              type="datetime-local"
              value={loggedAt}
              onChange={(e) => setLoggedAt(e.target.value)}
              className="rounded-md border-gray-200 text-sm"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., After salary payout, end of month..."
              rows={2}
              className="rounded-md border-gray-200 resize-none text-sm"
            />
          </div>

          {/* Account entries */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Account Balances</Label>

            {entries.length === 0 && (
              <p className="text-[11px] text-muted-foreground px-1">
                Add accounts below to start logging.
              </p>
            )}

            {entries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-2 bg-gray-50 rounded-md px-3 py-2.5"
              >
                <div
                  className={cn(
                    "text-[10px] font-bold px-2 py-1 rounded-md border whitespace-nowrap",
                    getAccountColor(entry.account)
                  )}
                >
                  {entry.account}
                </div>
                <div className="flex-1 relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-muted-foreground">
                    Rp
                  </span>
                  <Input
                    type="text"
                    value={entry.amount}
                    onChange={(e) =>
                      setEntries((p) =>
                        p.map((r) => r.id === entry.id ? { ...r, amount: formatRupiahInput(e.target.value) } : r)
                      )
                    }
                    placeholder="0"
                    className="rounded-md border-gray-200 pl-7 h-8 text-sm font-bold"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setEntries((p) => p.filter((r) => r.id !== entry.id))}
                  className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-200 text-muted-foreground hover:text-destructive transition-all"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            {/* Quick-add defaults */}
            {availableDefaults.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {availableDefaults.map((acc) => (
                  <button
                    key={acc}
                    type="button"
                    onClick={() => addAccount(acc)}
                    className="text-[10px] font-bold px-2 py-1 rounded-md border border-dashed border-gray-300 text-muted-foreground hover:text-foreground hover:border-gray-400 hover:bg-gray-50 transition-all"
                  >
                    + {acc}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setShowCustom((v) => !v)}
                  className="text-[10px] font-bold px-2 py-1 rounded-md border border-dashed border-gray-300 text-muted-foreground hover:text-foreground hover:border-gray-400 hover:bg-gray-50 transition-all"
                >
                  + Other
                </button>
              </div>
            )}

            {showCustom && (
              <div className="flex gap-2 items-center animate-in fade-in slide-in-from-top-1 duration-150">
                <Input
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
                  placeholder="Account name..."
                  className="rounded-md border-gray-200 h-8 text-sm flex-1"
                  autoFocus
                />
                <Button type="button" size="sm" onClick={addCustom} className="rounded-md h-8 px-3 text-xs">
                  Add
                </Button>
                <button
                  type="button"
                  onClick={() => { setShowCustom(false); setCustomInput(""); }}
                  className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-100 text-muted-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Total preview */}
          {entries.length > 0 && (
            <div className="flex items-center justify-between bg-primary/5 border border-primary/10 rounded-md px-4 py-2.5">
              <span className="text-xs font-bold text-primary">Total</span>
              <span className="text-sm font-extrabold text-primary">{formatIDR(total)}</span>
            </div>
          )}
        </div>

        <DialogFooter className="pt-4 gap-2 flex-row justify-end">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="rounded-md text-muted-foreground hover:bg-gray-100 flex-1 sm:flex-none"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={fetcher.state === "submitting"}
            className="rounded-md bg-primary text-primary-foreground flex-1 sm:flex-none"
          >
            {fetcher.state === "submitting" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : editingSnapshot ? (
              "Save Changes"
            ) : (
              "Save Snapshot"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MoneyLogRoute() {
  const { snapshots } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<{ success: boolean; action?: string }>();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSnapshot, setEditingSnapshot] = useState<any | null>(null);
  const [expandedSnapshot, setExpandedSnapshot] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const deleteFetcher = useFetcher<{ success: boolean }>();
  const wasDeleting = useRef(false);

  useEffect(() => {
    if (deleteFetcher.state === "submitting") wasDeleting.current = true;
    if (deleteFetcher.state === "idle" && wasDeleting.current) {
      wasDeleting.current = false;
      if (deleteFetcher.data?.success) toast.success("Snapshot deleted.");
    }
  }, [deleteFetcher.state, deleteFetcher.data]);

  function openCreate() {
    setEditingSnapshot(null);
    setDialogOpen(true);
  }

  function openEdit(snap: any) {
    setEditingSnapshot(snap);
    setDialogOpen(true);
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this snapshot?")) return;
    const fd = new FormData();
    fd.append("intent", "delete-snapshot");
    fd.append("id", id);
    deleteFetcher.submit(fd, { method: "post", action: "/money-log" });
  }

  // ── Derived ──
  const latestSnapshot = snapshots[0] ?? null;
  const latestTotal = latestSnapshot
    ? latestSnapshot.entries.reduce((sum: number, e: any) => sum + e.amount, 0)
    : 0;

  const prevTotal = snapshots[1]
    ? snapshots[1].entries.reduce((sum: number, e: any) => sum + e.amount, 0)
    : null;
  const trend = prevTotal !== null ? latestTotal - prevTotal : null;

  // Pagination
  const totalPages = Math.max(1, Math.ceil(snapshots.length / PAGE_SIZE));
  const pagedSnapshots = snapshots.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <AppLayout
      title="Money Log"
      actions={
        <Button
          onClick={openCreate}
          className="rounded-md text-xs gap-1.5 h-8 px-3 font-semibold"
        >
          <Plus className="w-3.5 h-3.5" />
          Log Snapshot
        </Button>
      }
    >
      <div className="space-y-5">
        {/* ── Net Worth Card ── */}
        <Card className="rounded-md border-gray-200 overflow-hidden bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="p-5 flex flex-col justify-between min-h-[110px]">
            <span className="text-[10px] uppercase font-bold text-primary tracking-wider">
              Total Net Worth
            </span>
            <div className="flex items-end gap-3 mt-2">
              <h2 className="text-3xl font-black text-foreground tracking-tight">
                {latestSnapshot ? formatIDR(latestTotal) : "—"}
              </h2>
              {trend !== null && (
                <div
                  className={cn(
                    "flex items-center gap-1 text-xs font-bold mb-0.5",
                    trend >= 0 ? "text-emerald-500" : "text-rose-500"
                  )}
                >
                  {trend >= 0 ? (
                    <TrendingUp className="w-3.5 h-3.5" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5" />
                  )}
                  {trend >= 0 ? "+" : ""}
                  {formatIDR(trend)}
                </div>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              {latestSnapshot
                ? `Last logged ${format(new Date(latestSnapshot.loggedAt), "PPP")}`
                : "No snapshots yet. Log your first one!"}
            </p>
          </CardContent>
        </Card>

        {/* ── Total Balance Trend Chart ── */}
        {snapshots.length > 0 && (
          <div className="bg-white rounded-md border border-gray-200 p-4 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Total Balance Trend
            </h3>
            <TotalLineChart snapshots={snapshots} />
          </div>
        )}

        {/* ── Snapshot History ── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Snapshot History
            </h3>
            {snapshots.length > 0 && (
              <span className="text-[10px] text-muted-foreground font-medium">
                {snapshots.length} snapshot{snapshots.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {snapshots.length === 0 ? (
            <div className="bg-white rounded-md border border-dashed border-gray-200 py-12 flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12 bg-muted/40 rounded-md flex items-center justify-center text-muted-foreground">
                <Wallet className="w-6 h-6" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-semibold text-foreground">No snapshots yet</p>
                <p className="text-xs text-muted-foreground">
                  Tap "Log Snapshot" to record your first money log entry.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {pagedSnapshots.map((snap: any) => {
                  const total = snap.entries.reduce(
                    (sum: number, e: any) => sum + e.amount,
                    0
                  );
                  const isExpanded = expandedSnapshot === snap.id;

                  return (
                    <div
                      key={snap.id}
                      className="bg-white rounded-md border border-gray-200 overflow-hidden"
                    >
                      {/* Row header */}
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedSnapshot(isExpanded ? null : snap.id)
                        }
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
                      >
                        <div className="flex flex-col items-start gap-0.5 text-left">
                          <span className="text-xs font-bold text-foreground">
                            {format(new Date(snap.loggedAt), "PPP, p")}
                          </span>
                          {snap.notes && (
                            <span className="text-[10px] text-muted-foreground">
                              {snap.notes}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-extrabold text-foreground">
                            {formatIDR(total)}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                      </button>

                      {/* Expanded detail */}
                      {isExpanded && (
                        <div className="border-t border-gray-200 px-4 pb-4 pt-3 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                          {/* Bullet list of accounts */}
                          <ul className="space-y-1.5">
                            {snap.entries.map((entry: any) => (
                              <li
                                key={entry.id}
                                className="flex items-center justify-between text-xs"
                              >
                                <span className="flex items-center gap-2 text-muted-foreground">
                                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
                                  {entry.account}
                                </span>
                                <span className="font-bold text-foreground">
                                  {formatIDR(entry.amount)}
                                </span>
                              </li>
                            ))}
                          </ul>

                          {/* Actions */}
                          <div className="flex items-center justify-end gap-2 pt-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(snap)}
                              className="rounded-md h-7 px-3 text-xs text-muted-foreground hover:bg-gray-100"
                            >
                              <Edit3 className="w-3.5 h-3.5 mr-1.5" />
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(snap.id)}
                              className="rounded-md h-7 px-3 text-xs text-destructive hover:bg-rose-50 hover:text-destructive"
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* ── Pagination ── */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2 px-1">
                  <span className="text-[10px] text-muted-foreground font-medium">
                    Page {page} of {totalPages}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => { setPage((p) => Math.max(1, p - 1)); setExpandedSnapshot(null); }}
                      disabled={page === 1}
                      className="w-7 h-7 rounded-md"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        onClick={() => { setPage(p); setExpandedSnapshot(null); }}
                        className={cn(
                          "w-7 h-7 rounded-md text-xs font-semibold transition-colors",
                          p === page
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
                      onClick={() => { setPage((p) => Math.min(totalPages, p + 1)); setExpandedSnapshot(null); }}
                      disabled={page === totalPages}
                      className="w-7 h-7 rounded-md"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Dialog (create / edit) ── */}
      <SnapshotDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        editingSnapshot={editingSnapshot}
        fetcher={fetcher}
      />
    </AppLayout>
  );
}
