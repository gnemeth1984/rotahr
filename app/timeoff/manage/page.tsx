import { supabase } from "@/lib/supabaseClient"

export default async function TimeOffManagePage() {
  const { data: requests } = await supabase
    .from("time_off_requests")
    .select("*, employees(first_name,last_name)")
    .order("start_date", { ascending: true })

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-bold">Manage Time Off Requests</h1>

      <div className="space-y-2">
        {requests?.length === 0 && (
          <div className="text-gray-500">No time-off requests yet.</div>
        )}

        {requests?.map((r) => (
          <form
            key={r.id}
            action="/timeoff/update"
            method="post"
            className="border rounded p-3 flex items-center justify-between gap-4 bg-white"
          >
            <input type="hidden" name="id" value={r.id} />

            <div>
              <div className="font-medium">
                {r.employees?.first_name} {r.employees?.last_name}
              </div>

              <div className="text-sm">
                {r.start_date} → {r.end_date}
              </div>

              <div className="text-sm text-gray-600">
                Reason: {r.reason || "—"}
              </div>

              <div className="text-xs mt-1">
                Status:{" "}
                <span
                  className={`font-semibold ${
                    r.status === "approved"
                      ? "text-green-700"
                      : r.status === "rejected"
                      ? "text-red-700"
                      : "text-yellow-700"
                  }`}
                >
                  {r.status}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                name="status"
                value="approved"
                className="px-3 py-1 bg-green-600 text-white rounded text-sm"
              >
                Approve
              </button>

              <button
                name="status"
                value="rejected"
                className="px-3 py-1 bg-red-600 text-white rounded text-sm"
              >
                Reject
              </button>
            </div>
          </form>
        ))}
      </div>
    </div>
  )
}
