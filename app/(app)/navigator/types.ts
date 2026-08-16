export type Block = {
  start: string;
  end: string;
  label: string;
  kind: string;
  why?: string;
  taskId?: string;
  done?: boolean;
};

export type DayWindow = { start: string; end: string; note?: string } | null;

export type WeekdayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type WeekPattern = Partial<Record<WeekdayKey, DayWindow>>;

export type NavProfile = {
  id: string;
  wakeTime: string;
  sleepTime: string;
  workStart: string;
  workEnd: string;
  weekPattern: WeekPattern | null;
  energyPattern: string | null;
  timezone: string;
  dietary: string | null;
  kitchen: string | null;
  exercise: string | null;
  derailers: string | null;
  goals: string | null;
  focusMins: number;
  breakMins: number;
  onboarded: boolean;
  coachTone: "warm" | "direct" | "drill" | "clinical";
  bufferShifts: boolean;
  preShiftMins: number;
  postShiftMins: number;
  ritualsEnabled: boolean;
  notifyEnabled: boolean;
  notifyLeadMins: number;
  notifyBlocks: boolean;
  notifyDueToday: boolean;
  notifyOverdue: boolean;
  notifyErrands: boolean;
  notifyStuck: boolean;
  notifyIdle: boolean;
  notifyEvening: boolean;
  notifyDuringShift: boolean;
  quietStart: string;
  quietEnd: string;
  systemAccess: boolean;
  autonomyEnabled: boolean;
};

/** Mirror of SystemPulse in lib/navigator/rotahr/signals.ts. */
export type SystemPulse = {
  generatedAt: string;
  founder: {
    realBusinesses: number;
    listingShells: number;
    payingCustomers: number;
    byPlan: { plan: string; count: number }[];
    mrrEur: number;
    signups: { now: number; prev: number; change: number };
    activeBusinesses7d: number;
    atRisk: number;
  };
  usage: { module: string; total: number; delta: number; tenants: number }[];
  myVenue: {
    bookingsToday: number;
    coversToday: number;
    haccpOverdue: number;
    lowStock: number;
    pendingTimeOff: number;
    expiringCerts: number;
    openRepairs: number;
    unfiledExpenses30d: number;
  };
  growth: {
    blogPosts: number;
    blogPublished7d: number;
    siteScore: number | null;
    siteIssues: number | null;
    siteCritical: number | null;
    auditAgeDays: number | null;
    gscClicks28d: number;
    gscImpressions28d: number;
    gscClicksPrev28d: number;
    leads: number;
    sends30d: number;
    opened30d: number;
    openRate: number;
    unreadInbound: number;
    demandGaps: { query: string; impressions: number; position: number }[];
  };
  build: {
    commits7d: number;
    deploys7d: number;
    lastDeployStatus: string | null;
    daysSinceLastShip: number | null;
    recent: { label: string; status: string | null; at: string }[];
  };
  health: {
    cronRuns24h: number;
    cronFailures24h: number;
    failingJobs: { job: string; fails: number }[];
    seoFailures7d: number;
  };
  myActivity: { action: string; count: number }[];
};

export type SystemResponse = {
  systemAccess: boolean;
  data?: SystemPulse | null;
  refreshedAt?: string | null;
  lastError?: string | null;
  durationMs?: number | null;
  ageMinutes?: number | null;
};

export type DayPlan = {
  id: string;
  date: string;
  energy: number | null;
  mood: string | null;
  availableHours: number | null;
  focusTheme: string | null;
  blocks: Block[] | null;
  anchor: string | null;
  reflection: string | null;
  wins: string | null;
  friction: string | null;
  scoreOutOf5: number | null;
};

export type Task = {
  id: string;
  title: string;
  notes: string | null;
  project: string | null;
  parentId: string | null;
  status: "draft" | "todo" | "doing" | "done" | "parked";
  priority: "urgent" | "important" | "quickwin" | "later";
  effortMins: number | null;
  startTrigger: string | null;
  dueDate: string | null;
  scheduledFor: string | null;
  order: number;
  completedAt: string | null;
  archivedAt: string | null;
};

export type Meal = {
  id: string;
  date: string;
  slot: string;
  title: string;
  ingredients: string[] | null;
  prepMins: number;
  protein: number | null;
  notes: string | null;
  eaten: boolean;
};

export type GroceryItem = {
  id: string;
  name: string;
  qty: string | null;
  category: string;
  checked: boolean;
};

export type Workout = {
  id: string;
  date: string;
  title: string;
  kind: string;
  durationMins: number;
  intensity: string;
  steps: string[] | null;
  completed: boolean;
  notes: string | null;
};

export type Habit = {
  id: string;
  name: string;
  emoji: string;
  targetPerWk: number;
  cue: string | null;
  active: boolean;
  order: number;
};

export type HabitLog = { id: string; habitId: string; date: string; done: boolean };

export type FocusSession = {
  id: string;
  label: string;
  taskId: string | null;
  plannedMins: number;
  startedAt: string;
  endedAt: string | null;
  actualMins: number | null;
  distractions: number;
  outcome: string | null;
  completed: boolean;
};

export type Checkin = {
  id: string;
  at: string;
  kind: string;
  value: number;
  note: string | null;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions?: { tool: string; summary: string }[] | null;
  createdAt: string;
};

export type MomentumBand = "stalled" | "warming" | "moving" | "flying";

export type Momentum = {
  score: number;
  band: MomentumBand;
  delta: number;
  summary: string;
  parts: { label: string; points: number; max: number; detail: string }[];
};

export type TimeDebtBand = "clear" | "light" | "heavy" | "buried";

export type TimeDebt = {
  mins: number;
  label: string;
  band: TimeDebtBand;
  advice: string;
  parts: { label: string; mins: number; detail: string }[];
  firstMove: { taskId: string; title: string; mins: number; startTrigger: string | null } | null;
};

export type RitualId = "morning" | "midday" | "shutdown" | "weekly" | "monthly";

export type Ritual = {
  id: RitualId;
  title: string;
  at: string;
  mins: number;
  cadence: "daily" | "weekly" | "monthly";
  steps: { id: string; label: string; hint?: string }[];
};

export type RitualLog = {
  id: string;
  date: string;
  ritual: RitualId;
  steps: Record<string, boolean> | null;
  completedAt: string | null;
};

export type Nudge = {
  id: string;
  date: string;
  kind: string;
  refKey: string;
  title: string;
  body: string;
  sentAt: string;
};

export type Snooze = {
  id: string;
  kind: string;
  refKey: string;
  until: string;
  condition: string | null;
};

export type NavState = {
  today: string;
  now: string;
  weekStart: string;
  profile: NavProfile;
  plan: DayPlan | null;
  tasks: Task[];
  doneToday: Task[];
  drafts: Task[];
  meals: Meal[];
  workouts: Workout[];
  habits: Habit[];
  habitLogs: HabitLog[];
  grocery: GroceryItem[];
  focus: FocusSession | null;
  lastFocus: FocusSession | null;
  checkins: Checkin[];
  weekPlans: DayPlan[];
  momentum: Momentum;
  timeDebt: TimeDebt;
  todayShift: DayWindow;
  rituals: Ritual[];
  ritualLogs: RitualLog[];
  currentRitual: RitualId | null;
  recentNudges: Nudge[];
  snoozes: Snooze[];
  planStale: boolean;
  staleAfterMins: number;
};
