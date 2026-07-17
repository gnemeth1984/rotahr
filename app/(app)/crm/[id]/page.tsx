"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  Mail,
  Phone,
  Calendar,
  Tag,
  FileText,
  Send,
  AlertTriangle,
  Edit2,
  Save,
  X,
  Trash2,
  Clock,
  Users,
  AlertCircle,
  CheckCircle,
  PenLine,
  Gift,
  Sparkles,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { OFFER_PRESETS } from "@/lib/crm/offer-presets";

const TAG_PRESETS = ["VIP", "Regular", "No-show Risk", "Allergy", "Corporate", "Birthday"];
const TAG_COLORS: Record<string, string> = {
  VIP: "bg-yellow-100 text-yellow-800 border-yellow-300",
  Regular: "bg-blue-100 text-blue-800 border-blue-300",
  "No-show Risk": "bg-red-100 text-red-800 border-red-300",
  Allergy: "bg-orange-100 text-orange-800 border-orange-300",
  Corporate: "bg-purple-100 text-purple-800 border-purple-300",
  Birthday: "bg-pink-100 text-pink-800 border-pink-300",
};

const STATUS_STYLES: Record<string, string> = {
  confirmed: "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-700",
  cancelled: "bg-red-100 text-red-700",
  "no-show": "bg-gray-200 text-gray-600",
  completed: "bg-blue-100 text-blue-700",
};

interface Reservation {
  id: string;
  date: string;
  time: string;
  partySize: number;
  status: string;
  notes: string | null;
  occasion: string | null;
}

interface Note {
  id: string;
  note: string;
  createdAt: string;
  author: { name: string | null; email: string };
}

interface EmailLog {
  id: string;
  subject: string;
  preview: string;
  sentAt: string;
  sentBy: { name: string | null; email: string };
}

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  birthday: string | null;
  dietaryNotes: string | null;
  allergies: string | null;
  tags: string[];
  internalNotes: string | null;
  gdprConsent: boolean;
  gdprConsentAt: string | null;
  isAnonymised: boolean;
  createdAt: string;
  reservations: Reservation[];
  crmNotes: Note[];
  crmEmails: EmailLog[];
}

export default function CustomerProfilePage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { data: session } = useSession();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Customer>>({});
  const [saving, setSaving] = useState(false);

  // Notes
  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  // Email
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);

  // Promo Offers
  const [offers, setOffers] = useState<any[]>([]);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>("birthday");
  const [customTitle, setCustomTitle] = useState("");
  const [customDescription, setCustomDescription] = useState("");
  const [generatingOffer, setGeneratingOffer] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [gmailStatus, setGmailStatus] = useState<{ connected: boolean; email?: string } | null>(null);
  const [pendingOfferQr, setPendingOfferQr] = useState<string | null>(null);
  const [pendingOfferCode, setPendingOfferCode] = useState<string | null>(null);

  // GDPR
  const [showAnonymise, setShowAnonymise] = useState(false);
  const [anonymising, setAnonymising] = useState(false);

  const fetchOffers = async () => {
    const res = await fetch(`/api/crm/customers/${id}/offers`);
    if (res.ok) setOffers((await res.json()).offers);
  };

  const generateOffer = async () => {
    setGeneratingOffer(true);
    try {
      const preset = OFFER_PRESETS.find((p) => p.id === selectedPreset)!;
      const res = await fetch(`/api/crm/customers/${id}/offers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offerType: selectedPreset,
          title: selectedPreset === "custom" ? customTitle : undefined,
          description: selectedPreset === "custom" ? customDescription : undefined,
          expiresInDays: 30,
        }),
      });
      if (res.ok) {
        const { offer, qrDataUri } = await res.json();
        setOffers((prev) => [offer, ...prev]);
        setShowOfferModal(false);
        setCustomTitle("");
        setCustomDescription("");
        // Pre-fill the email compose with the offer, ready to send
        setEmailSubject(offer.title);
        setEmailBody(`${offer.description}\n\nYour code: ${offer.code}`);
        setPendingOfferQr(qrDataUri);
        setPendingOfferCode(offer.code);
        setShowEmailModal(true);
      } else {
        const err = await res.json();
        alert(err.error?.formErrors?.[0] || err.error || "Couldn't generate offer");
      }
    } finally {
      setGeneratingOffer(false);
    }
  };

  const toggleRedeemed = async (offerId: string, redeemed: boolean) => {
    const res = await fetch(`/api/crm/offers/${offerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ redeemed }),
    });
    if (res.ok) fetchOffers();
  };

  const deleteOffer = async (offerId: string) => {
    if (!confirm("Delete this offer code?")) return;
    const res = await fetch(`/api/crm/offers/${offerId}`, { method: "DELETE" });
    if (res.ok) fetchOffers();
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1500);
  };

  const insertOfferIntoEmail = async (offer: any) => {
    const res = await fetch(`/api/crm/offers/${offer.id}`);
    if (!res.ok) return;
    const { qrDataUri } = await res.json();
    setEmailSubject(offer.title);
    setEmailBody(`${offer.description}\n\nYour code: ${offer.code}`);
    setPendingOfferQr(qrDataUri);
    setPendingOfferCode(offer.code);
    setShowEmailModal(true);
  };

  const fetchCustomer = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/crm/customers/${id}`);
      if (res.ok) setCustomer(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomer();
    fetchOffers();
    fetch("/api/integrations/gmail/status")
      .then((r) => r.json())
      .then(setGmailStatus)
      .catch(() => {});
  }, [id]);

  const startEdit = () => {
    if (!customer) return;
    setEditForm({
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      birthday: customer.birthday ? customer.birthday.split("T")[0] : null,
      dietaryNotes: customer.dietaryNotes,
      allergies: customer.allergies,
      tags: [...customer.tags],
      internalNotes: customer.internalNotes,
      gdprConsent: customer.gdprConsent,
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/crm/customers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        await fetchCustomer();
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const addNote = async () => {
    if (!noteText.trim()) return;
    setAddingNote(true);
    try {
      const res = await fetch(`/api/crm/customers/${id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: noteText }),
      });
      if (res.ok) {
        setNoteText("");
        await fetchCustomer();
      }
    } finally {
      setAddingNote(false);
    }
  };

  const sendEmail = async () => {
    if (!emailSubject || !emailBody) return;
    setSendingEmail(true);
    try {
      const qrBlock = pendingOfferQr
        ? `<div style="margin-top:16px;text-align:center;"><img src="${pendingOfferQr}" alt="Scan to redeem" width="180" height="180" /><p style="font-size:12px;color:#94a3b8;margin-top:4px;">Scan to redeem, or show code ${pendingOfferCode} in person</p></div>`
        : "";
      const res = await fetch(`/api/crm/customers/${id}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: emailSubject, body: `<p>${emailBody.replace(/\n/g, "<br>")}</p>${qrBlock}` }),
      });
      if (res.ok) {
        const data = await res.json();
        setShowEmailModal(false);
        setEmailSubject("");
        setEmailBody("");
        setPendingOfferQr(null);
        setPendingOfferCode(null);
        await fetchCustomer();
        if (data.fellBackToDefault) {
          alert(
            "Email sent, but your connected Gmail account failed (check Settings > Email), so it went out from Rotahr's address instead."
          );
        }
      } else {
        const err = await res.json();
        alert(err.error);
      }
    } finally {
      setSendingEmail(false);
    }
  };

  const anonymise = async () => {
    setAnonymising(true);
    try {
      const res = await fetch(`/api/crm/customers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anonymise: true }),
      });
      if (res.ok) {
        setShowAnonymise(false);
        router.push("/crm");
      }
    } finally {
      setAnonymising(false);
    }
  };

  const toggleTag = (tag: string) => {
    setEditForm((f) => ({
      ...f,
      tags: f.tags?.includes(tag) ? f.tags.filter((t) => t !== tag) : [...(f.tags ?? []), tag],
    }));
  };

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" });
  };

  const formatDateTime = (d: string) =>
    new Date(d).toLocaleString("en-IE", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  if (!["ADMIN", "MANAGER"].includes(session?.user?.role ?? "")) {
    return <div className="p-8 text-gray-500">Access restricted.</div>;
  }

  if (loading) return <div className="p-8 text-gray-400">Loading…</div>;
  if (!customer) return <div className="p-8 text-gray-500">Customer not found.</div>;

  const visits = customer.reservations.filter((r) => r.status !== "no-show" && r.status !== "cancelled");
  const noShows = customer.reservations.filter((r) => r.status === "no-show");
  const lastVisit = visits[0]?.date ?? null;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Back */}
      <button
        onClick={() => router.push("/crm")}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to CRM
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {customer.email && (
              <span className="flex items-center gap-1 text-sm text-gray-600">
                <Mail className="h-3.5 w-3.5" /> {customer.email}
              </span>
            )}
            {customer.phone && (
              <span className="flex items-center gap-1 text-sm text-gray-600">
                <Phone className="h-3.5 w-3.5" /> {customer.phone}
              </span>
            )}
            {customer.birthday && (
              <span className="flex items-center gap-1 text-sm text-gray-600">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(customer.birthday).toLocaleDateString("en-IE", { day: "numeric", month: "long" })}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {customer.tags.map((t) => (
              <span key={t} className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${TAG_COLORS[t] ?? "bg-gray-100 text-gray-700 border-gray-200"}`}>
                {t}
              </span>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          {!customer.isAnonymised && (
            <>
              {customer.email && customer.gdprConsent && (
                <Button size="sm" variant="outline" onClick={() => setShowEmailModal(true)} className="gap-1.5">
                  <Send className="h-4 w-4" /> Send Email
                </Button>
              )}
              <Button size="sm" onClick={startEdit} className="gap-1.5 bg-indigo-600 hover:bg-indigo-700">
                <Edit2 className="h-4 w-4" /> Edit
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Visits", value: visits.length, icon: <Users className="h-4 w-4" />, color: "text-indigo-600" },
          { label: "No-shows", value: noShows.length, icon: <AlertCircle className="h-4 w-4" />, color: noShows.length > 0 ? "text-red-600" : "text-gray-400" },
          { label: "Last Visit", value: formatDate(lastVisit), icon: <Clock className="h-4 w-4" />, color: "text-gray-700" },
          { label: "Customer Since", value: formatDate(customer.createdAt), icon: <Calendar className="h-4 w-4" />, color: "text-gray-700" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-200 px-4 py-3 shadow-sm">
            <div className={`flex items-center gap-1.5 text-xs font-medium mb-1 ${stat.color}`}>
              {stat.icon} {stat.label}
            </div>
            <div className="text-xl font-bold text-gray-900">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: details + notes */}
        <div className="lg:col-span-1 space-y-5">
          {/* Details card */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-indigo-600" /> Details
            </h3>
            <dl className="space-y-2 text-sm">
              {customer.dietaryNotes && (
                <div>
                  <dt className="text-xs text-gray-500 font-medium">Dietary</dt>
                  <dd className="text-gray-800">{customer.dietaryNotes}</dd>
                </div>
              )}
              {customer.allergies && (
                <div>
                  <dt className="text-xs text-gray-500 font-medium flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 text-orange-500" /> Allergies
                  </dt>
                  <dd className="text-orange-700 font-medium">{customer.allergies}</dd>
                </div>
              )}
              {customer.internalNotes && (
                <div>
                  <dt className="text-xs text-gray-500 font-medium">Internal Notes</dt>
                  <dd className="text-gray-700 whitespace-pre-line">{customer.internalNotes}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-gray-500 font-medium">GDPR Consent</dt>
                <dd className={customer.gdprConsent ? "text-green-600 font-medium" : "text-gray-400"}>
                  {customer.gdprConsent ? `✓ Consented ${customer.gdprConsentAt ? formatDate(customer.gdprConsentAt) : ""}` : "No consent"}
                </dd>
              </div>
            </dl>

            {/* GDPR Erasure */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-400 mb-2">GDPR data minimisation</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowAnonymise(true)}
                className="text-red-600 border-red-200 hover:bg-red-50 gap-1.5 w-full"
              >
                <Trash2 className="h-4 w-4" /> Request Erasure
              </Button>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-1.5">
              <PenLine className="h-4 w-4 text-indigo-600" /> Manager Notes
            </h3>
            <div className="space-y-2 mb-3 max-h-60 overflow-y-auto">
              {customer.crmNotes.length === 0 && (
                <p className="text-sm text-gray-400">No notes yet.</p>
              )}
              {customer.crmNotes.map((n) => (
                <div key={n.id} className="bg-gray-50 rounded-lg p-3 text-sm">
                  <p className="text-gray-800">{n.note}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {n.author.name ?? n.author.email} · {formatDateTime(n.createdAt)}
                  </p>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Add a note…"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addNote()}
                className="text-sm"
              />
              <Button size="sm" onClick={addNote} disabled={addingNote || !noteText.trim()} className="bg-indigo-600 hover:bg-indigo-700 shrink-0">
                {addingNote ? "…" : "Add"}
              </Button>
            </div>
          </div>
        </div>

        {/* Right column: reservations + emails */}
        <div className="lg:col-span-2 space-y-5">
          {/* Reservation history */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-indigo-600" />
              Reservation History
              <span className="ml-auto text-xs text-gray-400 font-normal">{customer.reservations.length} total</span>
            </h3>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {customer.reservations.length === 0 && (
                <p className="text-sm text-gray-400">No reservations linked yet.</p>
              )}
              {customer.reservations.map((r) => (
                <div key={r.id} className="flex items-start justify-between text-sm rounded-lg bg-gray-50 px-3 py-2 gap-2">
                  <div>
                    <div className="font-medium text-gray-800">
                      {formatDate(r.date)} · {r.time}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {r.partySize} guests{r.occasion ? ` · ${r.occasion}` : ""}
                      {r.notes ? ` · ${r.notes}` : ""}
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_STYLES[r.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {r.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Why email this customer — info callout */}
          {customer.email && customer.gdprConsent && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3.5 text-xs text-indigo-900">
              <p className="font-medium flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" /> Why email this customer?
              </p>
              <p className="mt-1 text-indigo-800/80">
                A quick, personal email costs nothing but a few minutes — and something small like a free
                drink or coffee is usually cheaper than what it'd cost to bring in a brand-new customer.
                Good moments to send one: it's their <strong>birthday</strong>, they haven't been back in a
                while (<strong>win-back</strong>), they're one of your <strong>regulars</strong> you want to
                thank, or they just visited for the <strong>first time</strong>. Use the Promo Offers below
                to generate a ready-made code for any of these in one click.
              </p>
            </div>
          )}

          {/* Promo Offers */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-1.5">
              <Gift className="h-4 w-4 text-indigo-600" />
              Promo Offers
              {customer.email && customer.gdprConsent && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowOfferModal(true)}
                  className="ml-auto gap-1 text-xs"
                >
                  <Sparkles className="h-3 w-3" /> New offer
                </Button>
              )}
            </h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {offers.length === 0 && (
                <p className="text-sm text-gray-400">
                  No offer codes yet — generate a birthday drink, win-back offer, or VIP thank-you above.
                </p>
              )}
              {offers.map((o) => (
                <div key={o.id} className={`rounded-lg px-3 py-2 text-sm ${o.redeemed ? "bg-gray-50 opacity-60" : "bg-indigo-50/60"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium text-gray-800">{o.title}</div>
                    {o.redeemed && (
                      <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full shrink-0">
                        Redeemed
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">{o.description}</div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <code className="text-xs font-mono bg-white border border-gray-200 rounded px-1.5 py-0.5">
                      {o.code}
                    </code>
                    <button onClick={() => copyCode(o.code)} className="text-gray-400 hover:text-gray-600">
                      {copiedCode === o.code ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                    {o.expiresAt && (
                      <span className="text-xs text-gray-400">
                        expires {formatDate(o.expiresAt)}
                      </span>
                    )}
                    <div className="ml-auto flex gap-2">
                      {!o.redeemed && customer.email && customer.gdprConsent && (
                        <button
                          onClick={() => insertOfferIntoEmail(o)}
                          className="text-xs text-indigo-600 hover:underline"
                        >
                          Email this
                        </button>
                      )}
                      <button
                        onClick={() => toggleRedeemed(o.id, !o.redeemed)}
                        className="text-xs text-indigo-600 hover:underline"
                      >
                        {o.redeemed ? "Mark unredeemed" : "Mark redeemed"}
                      </button>
                      <button onClick={() => deleteOffer(o.id)} className="text-xs text-red-500 hover:underline">
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Email log */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-1.5">
              <Mail className="h-4 w-4 text-indigo-600" />
              Email History
              {!customer.gdprConsent && customer.email && (
                <span className="ml-2 text-xs text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
                  No GDPR consent — can't send
                </span>
              )}
              {customer.email && customer.gdprConsent && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowEmailModal(true)}
                  className="ml-auto gap-1 text-xs"
                >
                  <Send className="h-3 w-3" /> Send
                </Button>
              )}
            </h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {customer.crmEmails.length === 0 && (
                <p className="text-sm text-gray-400">No emails sent yet.</p>
              )}
              {customer.crmEmails.map((e) => (
                <div key={e.id} className="bg-gray-50 rounded-lg px-3 py-2 text-sm">
                  <div className="font-medium text-gray-800">{e.subject}</div>
                  <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">{e.preview}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    Sent by {e.sentBy.name ?? e.sentBy.email} · {formatDateTime(e.sentAt)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Generate Offer Dialog */}
      <Dialog open={showOfferModal} onOpenChange={setShowOfferModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Generate a promo offer for {customer.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {OFFER_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => setSelectedPreset(preset.id)}
                className={`w-full text-left rounded-lg border p-3 transition ${
                  selectedPreset === preset.id
                    ? "border-indigo-500 bg-indigo-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="font-medium text-sm text-gray-800">{preset.label}</div>
                <div className="text-xs text-gray-500 mt-0.5">{preset.why}</div>
              </button>
            ))}
            {selectedPreset === "custom" && (
              <div className="space-y-2 pt-1">
                <div>
                  <Label>Title</Label>
                  <Input value={customTitle} onChange={(e) => setCustomTitle(e.target.value)} placeholder="E.g. Sorry we missed the mark" />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea value={customDescription} onChange={(e) => setCustomDescription(e.target.value)} rows={3} placeholder="E.g. Enjoy 20% off your next visit" />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOfferModal(false)}>Cancel</Button>
            <Button
              onClick={generateOffer}
              disabled={generatingOffer || (selectedPreset === "custom" && (!customTitle || !customDescription))}
              className="bg-indigo-600 hover:bg-indigo-700 gap-1.5"
            >
              <Gift className="h-4 w-4" /> {generatingOffer ? "Generating…" : "Generate & draft email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editing} onOpenChange={(v) => { if (!v) setEditing(false); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Name *</Label>
                <Input value={editForm.name ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={editForm.email ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value || null }))} />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={editForm.phone ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value || null }))} />
              </div>
              <div>
                <Label>Birthday</Label>
                <Input type="date" value={editForm.birthday ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, birthday: e.target.value || null }))} />
              </div>
            </div>
            <div>
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {TAG_PRESETS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleTag(t)}
                    className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-all ${
                      editForm.tags?.includes(t)
                        ? TAG_COLORS[t] + " ring-2 ring-indigo-400 ring-offset-1"
                        : "bg-gray-100 text-gray-600 border-gray-200"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Dietary Notes</Label>
              <Input value={editForm.dietaryNotes ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, dietaryNotes: e.target.value || null }))} />
            </div>
            <div>
              <Label>Allergies</Label>
              <Input value={editForm.allergies ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, allergies: e.target.value || null }))} />
            </div>
            <div>
              <Label>Internal Notes</Label>
              <Textarea value={editForm.internalNotes ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, internalNotes: e.target.value || null }))} rows={3} />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="gdpr-edit"
                checked={editForm.gdprConsent ?? false}
                onCheckedChange={(v) => setEditForm((f) => ({ ...f, gdprConsent: !!v }))}
              />
              <Label htmlFor="gdpr-edit" className="text-sm cursor-pointer">
                Marketing consent (GDPR)
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Email Dialog */}
      <Dialog open={showEmailModal} onOpenChange={setShowEmailModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Send Email to {customer.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Subject</Label>
              <Input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} placeholder="E.g. Special offer for you" />
            </div>
            <div>
              <Label>Message</Label>
              <Textarea value={emailBody} onChange={(e) => setEmailBody(e.target.value)} rows={6} placeholder="Write your message…" />
            </div>
            {pendingOfferQr && (
              <div className="flex items-center gap-3 rounded-lg border border-indigo-100 bg-indigo-50/60 p-3">
                <img src={pendingOfferQr} alt="Offer QR code" className="h-16 w-16 rounded border border-white" />
                <div className="text-xs text-indigo-800">
                  <p className="font-medium">Scannable QR code will be included</p>
                  <p className="text-indigo-800/70">Scans straight to a redemption page staff can confirm on the spot.</p>
                  <button onClick={() => setPendingOfferQr(null)} className="mt-1 text-indigo-600 underline">
                    Remove
                  </button>
                </div>
              </div>
            )}
            <p className="text-xs text-gray-400">
              {gmailStatus?.connected
                ? `This email will be sent from your connected Gmail (${gmailStatus.email}) and logged in the email history.`
                : "This email will be sent from Rotahr's shared address (no-reply@rotahr.com). Connect your own Gmail in Settings > Email to send as yourself instead."}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowEmailModal(false); setPendingOfferQr(null); setPendingOfferCode(null); }}>Cancel</Button>
            <Button onClick={sendEmail} disabled={sendingEmail || !emailSubject || !emailBody} className="bg-indigo-600 hover:bg-indigo-700 gap-1.5">
              <Send className="h-4 w-4" /> {sendingEmail ? "Sending…" : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* GDPR Anonymise Dialog */}
      <Dialog open={showAnonymise} onOpenChange={setShowAnonymise}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> GDPR Erasure Request
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-700 py-2">
            This will permanently anonymise <strong>{customer.name}</strong>'s personal data (name, email, phone, birthday, dietary, allergies). Reservation history is kept for audit. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAnonymise(false)}>Cancel</Button>
            <Button onClick={anonymise} disabled={anonymising} className="bg-red-600 hover:bg-red-700">
              {anonymising ? "Anonymising…" : "Confirm Erasure"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
