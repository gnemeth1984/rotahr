-- CreateTable
CREATE TABLE "NavProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "wakeTime" TEXT NOT NULL DEFAULT '07:00',
    "sleepTime" TEXT NOT NULL DEFAULT '23:00',
    "workStart" TEXT NOT NULL DEFAULT '09:00',
    "workEnd" TEXT NOT NULL DEFAULT '18:00',
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Dublin',
    "dietary" TEXT,
    "kitchen" TEXT,
    "exercise" TEXT,
    "derailers" TEXT,
    "goals" TEXT,
    "focusMins" INTEGER NOT NULL DEFAULT 50,
    "breakMins" INTEGER NOT NULL DEFAULT 10,
    "onboarded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NavProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NavDayPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "energy" INTEGER,
    "mood" TEXT,
    "availableHours" DOUBLE PRECISION,
    "focusTheme" TEXT,
    "blocks" JSONB,
    "anchor" TEXT,
    "reflection" TEXT,
    "wins" TEXT,
    "friction" TEXT,
    "scoreOutOf5" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NavDayPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NavTask" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "project" TEXT,
    "parentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "priority" TEXT NOT NULL DEFAULT 'important',
    "effortMins" INTEGER,
    "startTrigger" TEXT,
    "dueDate" TIMESTAMP(3),
    "scheduledFor" DATE,
    "order" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NavTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NavHabit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT NOT NULL DEFAULT '*',
    "targetPerWk" INTEGER NOT NULL DEFAULT 7,
    "cue" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NavHabit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NavHabitLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "habitId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "NavHabitLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NavMeal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "slot" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "ingredients" JSONB,
    "prepMins" INTEGER NOT NULL DEFAULT 10,
    "protein" INTEGER,
    "notes" TEXT,
    "eaten" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NavMeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NavGroceryItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "qty" TEXT,
    "category" TEXT NOT NULL DEFAULT 'other',
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NavGroceryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NavWorkout" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'movement',
    "durationMins" INTEGER NOT NULL DEFAULT 10,
    "intensity" TEXT NOT NULL DEFAULT 'easy',
    "steps" JSONB,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NavWorkout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NavFocusSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "taskId" TEXT,
    "plannedMins" INTEGER NOT NULL DEFAULT 50,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "actualMins" INTEGER,
    "distractions" INTEGER NOT NULL DEFAULT 0,
    "outcome" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "NavFocusSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NavCheckin" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "note" TEXT,

    CONSTRAINT "NavCheckin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NavChatMessage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "actions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NavChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NavProfile_userId_key" ON "NavProfile"("userId");

-- CreateIndex
CREATE INDEX "NavDayPlan_userId_date_idx" ON "NavDayPlan"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "NavDayPlan_userId_date_key" ON "NavDayPlan"("userId", "date");

-- CreateIndex
CREATE INDEX "NavTask_userId_status_idx" ON "NavTask"("userId", "status");

-- CreateIndex
CREATE INDEX "NavTask_userId_parentId_idx" ON "NavTask"("userId", "parentId");

-- CreateIndex
CREATE INDEX "NavTask_userId_scheduledFor_idx" ON "NavTask"("userId", "scheduledFor");

-- CreateIndex
CREATE INDEX "NavHabit_userId_active_idx" ON "NavHabit"("userId", "active");

-- CreateIndex
CREATE INDEX "NavHabitLog_userId_date_idx" ON "NavHabitLog"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "NavHabitLog_habitId_date_key" ON "NavHabitLog"("habitId", "date");

-- CreateIndex
CREATE INDEX "NavMeal_userId_date_idx" ON "NavMeal"("userId", "date");

-- CreateIndex
CREATE INDEX "NavGroceryItem_userId_checked_idx" ON "NavGroceryItem"("userId", "checked");

-- CreateIndex
CREATE INDEX "NavWorkout_userId_date_idx" ON "NavWorkout"("userId", "date");

-- CreateIndex
CREATE INDEX "NavFocusSession_userId_startedAt_idx" ON "NavFocusSession"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "NavCheckin_userId_at_idx" ON "NavCheckin"("userId", "at");

-- CreateIndex
CREATE INDEX "NavCheckin_userId_kind_idx" ON "NavCheckin"("userId", "kind");

-- CreateIndex
CREATE INDEX "NavChatMessage_userId_createdAt_idx" ON "NavChatMessage"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "NavHabitLog" ADD CONSTRAINT "NavHabitLog_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "NavHabit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
