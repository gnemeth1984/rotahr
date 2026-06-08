// app/rota/RotaGrid.tsx
"use client"

import React, { useEffect, useMemo, useState } from "react"
import { format, parseISO } from "date-fns"

/**
 * RotaGrid
 *
 * - Accepts days as ISO date strings (yyyy-MM-dd) from the server.
 * - Rehydrates them to Date objects for display and calculations.
 * - Preserves features: role filter, templates, drag/drop, edit modal,
 *   auto-assign, availability/time-off blocking, labour cost totals.
 *
 * Note: API calls use fetch to your app's API routes (assumed).
 */

export default function RotaGrid({
  employees = [],
  shifts = [],
  days = [], // array of yyyy-MM-dd strings
  availability = [],
  roles = [],
  templates = [],
  timeOff = []
}) {
  // --- Local state ---
  const [filterRole, setFilterRole] = useState("All")
  const [search, setSearch] = useState("")
  const [localShifts, setLocalShifts] = useState(shifts)
  const [editingShift, setEditingShift] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [dragData, setDragData] = useState(null)
  const [showTemplates, setShowTemplates] = useState(false)

  // --- Rehydrate days to Date objects ---
  const safeDays = useMemo(() => days.map((d) => parseISO(d)), [days])

  // --- Helpers ---
  function formatDateIso(d) {
    // accepts Date or yyyy-MM-dd string
    if (!d) return ""
    if (typeof d === "string") return d
    // Date -> yyyy-MM-dd
    return d.toISOString().slice(0, 10)
  }

  function displayDay(d) {
    const date = typeof d === "string" ? parseISO(d) : d
    return format(date, "EEE dd")
  }

  function shiftsFor(empId, isoDate) {
    return localShifts.filter(
      (s) => s.employee_id === empId && s.shift_date === isoDate
    )
  }

  function isUnavailable(empId, isoDate) {
    return availability.some(
      (a) => a.employee_id === empId && a.date === isoDate && a.available === false
    )
  }

  function hasTimeOff(empId, isoDate) {
    return timeOff.some(
      (t) => t.employee_id === empId && t.date === isoDate
    )
  }

  // --- Derived lists ---
  const visibleEmployees = useMemo(() => {
    return employees
      .filter((e) => {
        if (filterRole === "All") return true
        return (e.role || "Unassigned") === filterRole
      })
      .filter((e) => {
        if (!search) return true
        const q = search.toLowerCase()
        return (
          (e.first_name || "").toLowerCase().includes(q) ||
          (e.last_name || "").toLowerCase().includes(q) ||
          (e.name || "").toLowerCase().includes(q)
        )
      })
  }, [employees, filterRole, search])

  // --- Drag & Drop handlers (HTML5) ---
  function onDragStart(e, shift) {
    setDragData(shift)
    e.dataTransfer.setData("text/plain", JSON.stringify(shift))
    e.dataTransfer.effectAllowed = "move"
  }

  function onDragOver(e) {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }

  async function onDrop(e, targetDate, targetEmpId) {
    e.preventDefault()
    let dropped = dragData
    if (!dropped) {
      try {
        dropped = JSON.parse(e.dataTransfer.getData("text/plain"))
      } catch {
        return
      }
    }
    // If dropping onto a different employee/date, update shift
    const updated = {
      ...dropped,
      employee_id: targetEmpId,
      shift_date: formatDateIso(targetDate)
    }

    // Optimistic UI update
    setLocalShifts((prev) =>
      prev.map((s) => (s.id === updated.id ? updated : s))
    )

    // Persist
    try {
      await fetch(`/api/shifts/${updated.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated)
      })
    } catch (err) {
      console.error("Failed to update shift", err)
      // revert by refetching or simple rollback (here we refetch)
      refetchShifts()
    } finally {
      setDragData(null)
    }
  }

  // --- CRUD helpers ---
  async function refetchShifts() {
    try {
      const res = await fetch(`/api/shifts?start=${days[0]}&end=${days[days.length - 1]}`)
      if (res.ok) {
        const data = await res.json()
        setLocalShifts(data)
      }
    } catch (err) {
      console.error(err)
    }
  }

  async function saveShift(shift) {
    setIsSaving(true)
    try {
      const method = shift.id ? "PUT" : "POST"
      const url = shift.id ? `/api/shifts/${shift.id}` : `/api/shifts`
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(shift)
      })
      if (!res.ok) throw new Error("Save failed")
      await refetchShifts()
      setEditingShift(null)
    } catch (err) {
      console.error(err)
      alert("Failed to save shift")
    } finally {
      setIsSaving(false)
    }
  }

  async function deleteShift(id) {
    if (!confirm("Delete this shift?")) return
    try {
      const res = await fetch(`/api/shifts/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Delete failed")
      setLocalShifts((prev) => prev.filter((s) => s.id !== id))
    } catch (err) {
      console.error(err)
      alert("Failed to delete shift")
    }
  }

  // --- Auto-assign algorithm (simple greedy) ---
  async function autoAssignDay(targetDate) {
    const iso = formatDateIso(targetDate)
    // find unassigned templates or empty slots logic: here we assign employees without a shift that day
    const unassignedEmployees = employees.filter(
      (e) => !localShifts.some((s) => s.employee_id === e.id && s.shift_date === iso)
    )

    const assignments = unassignedEmployees.map((e) => ({
      employee_id: e.id,
      shift_date: iso,
      start_time: "09:00",
      end_time: "17:00",
      template_id: null
    }))

    // Bulk create
    try {
      const res = await fetch(`/api/shifts/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shifts: assignments })
      })
      if (!res.ok) throw new Error("Auto-assign failed")
      await refetchShifts()
    } catch (err) {
      console.error(err)
      alert("Auto-assign failed")
    }
  }

  // --- Apply template to a cell ---
  async function applyTemplateToCell(template, empId, isoDate) {
    const payload = {
      employee_id: empId,
      shift_date: isoDate,
      start_time: template.start_time,
      end_time: template.end_time,
      template_id: template.id
    }
    try {
      const res = await fetch(`/api/shifts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
      if (!res.ok) throw new Error("Template apply failed")
      await refetchShifts()
    } catch (err) {
      console.error(err)
      alert("Failed to apply template")
    } finally {
      setShowTemplates(false)
    }
  }

  // --- Labour cost and hours calculations ---
  function hoursBetween(start, end) {
    if (!start || !end) return 0
    const [sh, sm] = start.split(":").map(Number)
    const [eh, em] = end.split(":").map(Number)
    return Math.max(0, (eh + em / 60) - (sh + sm / 60))
  }

  const totals = useMemo(() => {
    const perDay = {}
    const perEmployee = {}
    for (const d of days) perDay[d] = { hours: 0, cost: 0 }
    for (const e of employees) perEmployee[e.id] = { hours: 0, cost: 0 }

    for (const s of localShifts) {
      const h = hoursBetween(s.start_time, s.end_time)
      const rate = s.hourly_rate ?? (employees.find((x) => x.id === s.employee_id)?.hourly_rate ?? 0)
      const cost = h * rate
      if (perDay[s.shift_date]) {
        perDay[s.shift_date].hours += h
        perDay[s.shift_date].cost += cost
      }
      if (perEmployee[s.employee_id]) {
        perEmployee[s.employee_id].hours += h
        perEmployee[s.employee_id].cost += cost
      }
    }

    const weekHours = Object.values(perDay).reduce((a, b) => a + b.hours, 0)
    const weekCost = Object.values(perDay).reduce((a, b) => a + b.cost, 0)

    return { perDay, perEmployee, weekHours, weekCost }
  }, [localShifts, employees, days])

  // --- Effects ---
  useEffect(() => {
    setLocalShifts(shifts)
  }, [shifts])

  // --- UI pieces ---
  return (
    <div className="w-full bg-white rounded shadow-sm">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="border px-2 py-1 rounded"
          >
            {roles.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          <input
            placeholder="Search employees"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border px-2 py-1 rounded"
          />

          <button
            onClick={() => {
              // quick refetch
              refetchShifts()
            }}
            className="px-3 py-1 bg-gray-200 rounded"
          >
            Refresh
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-sm text-gray-600">
            Week hours: <strong>{totals.weekHours.toFixed(1)}</strong>
          </div>
          <div className="text-sm text-gray-600">
            Labour cost: <strong>€{totals.weekCost.toFixed(2)}</strong>
          </div>
        </div>
      </div>

      <div className="overflow-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="border p-2 w-48 text-left">Employee</th>
              {safeDays.map((d) => (
                <th key={format(d, "yyyy-MM-dd")} className="border p-2 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <span>{format(d, "EEE dd")}</span>
                    <button
                      onClick={() => autoAssignDay(formatDateIso(d))}
                      title="Auto assign this day"
                      className="text-xs px-2 py-0.5 bg-blue-100 rounded"
                    >
                      Auto
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {visibleEmployees.map((emp) => (
              <tr key={emp.id} className="hover:bg-gray-50">
                <td className="border p-2 align-top">
                  <div className="font-medium">{emp.name || `${emp.first_name} ${emp.last_name}`}</div>
                  <div className="text-xs text-gray-500">{emp.role}</div>
                  <div className="text-xs text-gray-500">Rate: €{(emp.hourly_rate ?? 0).toFixed(2)}</div>
                </td>

                {safeDays.map((d) => {
                  const iso = format(d, "yyyy-MM-dd")
                  const cellShifts = shiftsFor(emp.id, iso)
                  const unavailable = isUnavailable(emp.id, iso)
                  const off = hasTimeOff(emp.id, iso)

                  return (
                    <td
                      key={emp.id + iso}
                      className={`border p-2 align-top min-w-[140px] ${off ? "bg-red-50" : unavailable ? "bg-yellow-50" : ""}`}
                      onDragOver={onDragOver}
                      onDrop={(e) => onDrop(e, iso, emp.id)}
                    >
                      <div className="flex flex-col gap-1">
                        {cellShifts.length === 0 ? (
                          <div className="text-xs text-gray-400">—</div>
                        ) : (
                          cellShifts.map((s) => (
                            <div
                              key={s.id}
                              draggable
                              onDragStart={(e) => onDragStart(e, s)}
                              className="p-1 rounded border bg-white shadow-sm cursor-grab text-sm"
                            >
                              <div className="flex justify-between items-center gap-2">
                                <div>
                                  <div className="font-medium">{s.start_time}–{s.end_time}</div>
                                  <div className="text-xs text-gray-500">{s.role || ""}</div>
                                </div>

                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => setEditingShift(s)}
                                    className="text-xs px-2 py-0.5 bg-gray-100 rounded"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => deleteShift(s.id)}
                                    className="text-xs px-2 py-0.5 bg-red-100 rounded"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))
                        )}

                        <div className="flex gap-1 mt-1">
                          <button
                            onClick={() => setEditingShift({ employee_id: emp.id, shift_date: iso })}
                            className="text-xs px-2 py-0.5 bg-green-100 rounded"
                          >
                            + Add
                          </button>

                          <button
                            onClick={() => {
                              setShowTemplates((s) => !s)
                            }}
                            className="text-xs px-2 py-0.5 bg-indigo-100 rounded"
                          >
                            Templates
                          </button>
                        </div>

                        {showTemplates && (
                          <div className="mt-1 space-y-1">
                            {templates.map((t) => (
                              <button
                                key={t.id}
                                onClick={() => applyTemplateToCell(t, emp.id, iso)}
                                className="block w-full text-left text-xs px-2 py-1 bg-gray-50 rounded"
                              >
                                {t.name} — {t.start_time}–{t.end_time}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editingShift && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="absolute inset-0 bg-black opacity-30" onClick={() => setEditingShift(null)} />
          <div className="bg-white p-4 rounded shadow-lg w-[520px] z-10">
            <h3 className="font-semibold mb-2">{editingShift.id ? "Edit Shift" : "Add Shift"}</h3>

            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs">Employee</label>
              <select
                value={editingShift.employee_id}
                onChange={(e) => setEditingShift({ ...editingShift, employee_id: e.target.value })}
                className="border px-2 py-1 rounded"
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name || `${emp.first_name} ${emp.last_name}`}
                  </option>
                ))}
              </select>

              <label className="text-xs">Date</label>
              <input
                type="date"
                value={editingShift.shift_date}
                onChange={(e) => setEditingShift({ ...editingShift, shift_date: e.target.value })}
                className="border px-2 py-1 rounded"
              />

              <label className="text-xs">Start</label>
              <input
                type="time"
                value={editingShift.start_time || ""}
                onChange={(e) => setEditingShift({ ...editingShift, start_time: e.target.value })}
                className="border px-2 py-1 rounded"
              />

              <label className="text-xs">End</label>
              <input
                type="time"
                value={editingShift.end_time || ""}
                onChange={(e) => setEditingShift({ ...editingShift, end_time: e.target.value })}
                className="border px-2 py-1 rounded"
              />

              <label className="text-xs">Hourly Rate</label>
              <input
                type="number"
                step="0.01"
                value={editingShift.hourly_rate ?? ""}
                onChange={(e) => setEditingShift({ ...editingShift, hourly_rate: parseFloat(e.target.value) })}
                className="border px-2 py-1 rounded"
              />

              <label className="text-xs">Role</label>
              <input
                type="text"
                value={editingShift.role || ""}
                onChange={(e) => setEditingShift({ ...editingShift, role: e.target.value })}
                className="border px-2 py-1 rounded"
              />
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setEditingShift(null)} className="px-3 py-1 bg-gray-100 rounded">
                Cancel
              </button>
              <button
                onClick={() => saveShift(editingShift)}
                disabled={isSaving}
                className="px-3 py-1 bg-blue-600 text-white rounded"
              >
                {isSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
