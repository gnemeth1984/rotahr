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
  status: "todo" | "doing" | "done" | "parked";
  priority: "urgent" | "important" | "quickwin" | "later";
  effortMins: number | null;
  startTrigger: string | null;
  dueDate: string | null;
  scheduledFor: string | null;
  order: number;
  completedAt: string | null;
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

export type NavState = {
  today: string;
  now: string;
  weekStart: string;
  profile: NavProfile;
  plan: DayPlan | null;
  tasks: Task[];
  doneToday: Task[];
  meals: Meal[];
  workouts: Workout[];
  habits: Habit[];
  habitLogs: HabitLog[];
  grocery: GroceryItem[];
  focus: FocusSession | null;
  lastFocus: FocusSession | null;
  checkins: Checkin[];
  weekPlans: DayPlan[];
};
