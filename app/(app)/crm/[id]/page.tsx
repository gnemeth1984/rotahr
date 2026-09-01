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
  History,
  MessageSquare,
  Ticket,
  Loader2,
  Receipt,
  Crown,
  Upload,
  Coins,
  Plus,
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

const TIER_STYLES: Record<string, string> = {
  bronze: "bg-amber-100 text-amber-800 border-amber-300",
  silver: "bg-slate-100 text-slate-700 border-slate-300",
  gold: "bg-yellow-100 text-yellow-800 border-yellow-300",
  vip: "bg-purple-100 text-purple-800 border-purple-300",
};

const CURRENCY_SYMBOLS: Record<string, string> = { EUR: "€", GBP: "£", USD: "$", CAD: "$", AUD: "$" };

interface GuestTransaction {
  id: string;
  date: string;
  totalSpend: number;
  covers: number | null;
  items: any;
  itemsText: string | null;
  notes: string | null;
  source: string;
  pointsAwarded: number;
  recordedBy: string | null;
  createdAt: string;
}

interface TierDef {
  key: string;
  name: string;
  minVisits: number;
  minSpend: number;
  perks: string | null;
  colour: string;
  sortOrder: number;
}

interface LoyaltyConfig {
  currency?: string;
  settings: {
    enabled: boolean;
    pointsPerCurrency: number;
    pointValue: number;
    vipSpendThreshold: number;
    autoUpgrade: boolean;
  };
  tiers: TierDef[];
}

interface Redemption {
  id: string;
  points: number;
  reward: string;
  valueAmount: number | null;
  notes: string | null;
  recordedBy: string | null;
  createdAt: string;
}

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  birthday: string | null;
  dietaryNotes: string | null;
  allergies: string | null;
  seatingPreference: string | null;
  tags: string[];
  internalNotes: string | null;
  gdprConsent: boolean;
  gdprConsentAt: string | null;
  smsWhatsappConsent: boolean;
  isAnonymised: boolean;
  loyaltyTier: string;
  loyaltyPoints: number;
  visitCount: number;
  totalSpend: number;
  averageSpend: number;
  lastVisitAt: string | null;
  favouriteDishes: string[];
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
  const [expiresInDays, setExpiresInDays] = useState<number | null>(30);
  const [gmailStatus, setGmailStatus] = useState<{ connected: boolean; email?: string } | null>(null);
  const [messagingStatus, setMessagingStatus] = useState<{ configured: boolean; hasWhatsapp: boolean; hasSms: boolean } | null>(null);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageChannel, setMessageChannel] = useState<"whatsapp" | "sms">("whatsapp");
  const [messageBody, setMessageBody] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [pendingOfferQr, setPendingOfferQr] = useState<string | null>(null);
  // Hosted QR URL for the outbound email. Gmail/Outlook strip data: URIs,
  // so the email must reference a real image URL, not pendingOfferQr.
  const [pendingOfferQrUrl, setPendingOfferQrUrl] = useState<string | null>(null);
  const [pendingOfferCode, setPendingOfferCode] = useState<string | null>(null);

  // GDPR
  const [showAnonymise, setShowAnonymise] = useState(false);
  const [anonymising, setAnonymising] = useState(false);

  // Spend history + loyalty
  const [transactions, setTransactions] = useState<GuestTransaction[]>([]);
  const [loyalty, setLoyalty] = useState<LoyaltyConfig | null>(null);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [showBillModal, setShowBillModal] = useState(false);
  const [billDate, setBillDate] = useState("");
  const [billAmount, setBillAmount] = useState("");
  const [billCovers, setBillCovers] = useState("");
  const [billItems, setBillItems] = useState("");
  const [billNotes, setBillNotes] = useState("");
  const [savingBill, setSavingBill] = useState(false);
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [redeemPoints, setRedeemPoints] = useState("");
  const [redeemReward, setRedeemReward] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importCsv, setImportCsv] = useState("");
  const [importReport, setImportReport] = useState<any>(null);
  const [importing, setImporting] = useState(false);

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
          expiresInDays: expiresInDays ?? undefined,
        }),
      });
      if (res.ok) {
        const { offer, qrDataUri, qrImageUrl } = await res.json();
        setOffers((prev) => [offer, ...prev]);
        setShowOfferModal(false);
        setCustomTitle("");
        setCustomDescription("");
        // Pre-fill the email compose with the offer, ready to send
        setEmailSubject(offer.title);
        setEmailBody(`${offer.description}\n\nYour code: ${offer.code}`);
        setPendingOfferQr(qrDataUri);
        setPendingOfferQrUrl(qrImageUrl);
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
    const { qrDataUri, qrImageUrl } = await res.json();
    setEmailSubject(offer.title);
    setEmailBody(`${offer.description}\n\nYour code: ${offer.code}`);
    setPendingOfferQr(qrDataUri);
    setPendingOfferQrUrl(qrImageUrl);
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

  const fetchSpend = async () => {
    const res = await fetch(`/api/crm/transactions?customerId=${id}`);
    if (res.ok) setTransactions((await res.json()).transactions || []);
  };

  const fetchLoyalty = async () => {
    const [cfgRes, redRes] = await Promise.all([
      fetch("/api/crm/loyalty"),
      fetch(`/api/crm/loyalty/redeem?customerId=${id}`),
    ]);
    if (cfgRes.ok) setLoyalty(await cfgRes.json());
    if (redRes.ok) setRedemptions((await redRes.json()).redemptions || []);
  };

  const openBill = () => {
    setBillDate(new Date().toISOString().split("T")[0]);
    setBillAmount("");
    setBillCovers("");
    setBillItems("");
    setBillNotes("");
    setShowBillModal(true);
  };

  const saveBill = async () => {
    const amount = parseFloat(billAmount.replace(",", "."));
    if (!Number.isFinite(amount) || amount < 0) {
      alert("Enter the bill total");
      return;
    }
    setSavingBill(true);
    try {
      const res = await fetch("/api/crm/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: id,
          date: billDate,
          totalSpend: amount,
          covers: billCovers.trim() ? parseInt(billCovers, 10) : null,
          itemsText: billItems.trim() || null,
          notes: billNotes.trim() || null,
        }),
      });
      if (res.ok) {
        setShowBillModal(false);
        await Promise.all([fetchSpend(), fetchCustomer(), fetchLoyalty()]);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(typeof err.error === "string" ? err.error : "Couldn't save that bill");
      }
    } finally {
      setSavingBill(false);
    }
  };

  const deleteTransaction = async (txId: string) => {
    if (!confirm("Delete this bill? Visits, spend and points are recalculated.")) return;
    const res = await fetch(`/api/crm/transactions?id=${txId}`, { method: "DELETE" });
    if (res.ok) await Promise.all([fetchSpend(), fetchCustomer(), fetchLoyalty()]);
  };

  const redeem = async () => {
    const pts = parseInt(redeemPoints, 10);
    if (!Number.isFinite(pts) || pts < 1) {
      alert("Enter how many points to redeem");
      return;
    }
    if (!redeemReward.trim()) {
      alert("Say what the guest gets for the points");
      return;
    }
    setRedeeming(true);
    try {
      const res = await fetch("/api/crm/loyalty/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: id, points: pts, reward: redeemReward.trim() }),
      });
      if (res.ok) {
        setShowRedeemModal(false);
        await Promise.all([fetchCustomer(), fetchLoyalty()]);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(typeof err.error === "string" ? err.error : "Couldn't redeem those points");
      }
    } finally {
      setRedeeming(false);
    }
  };

  const deleteRedemption = async (redId: string) => {
    if (!confirm("Remove this redemption? The points go back on the guest's balance.")) return;
    const res = await fetch(`/api/crm/loyalty/redeem?id=${redId}`, { method: "DELETE" });
    if (res.ok) await Promise.all([fetchCustomer(), fetchLoyalty()]);
  };

  const runImport = async (dryRun: boolean) => {
    if (!importCsv.trim()) {
      alert("Paste the CSV first");
      return;
    }
    setImporting(true);
    try {
      const res = await fetch("/api/crm/transactions/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: importCsv, dryRun }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(typeof d.error === "string" ? d.error : "Import failed");
        return;
      }
      setImportReport(d);
      if (!dryRun) await Promise.all([fetchSpend(), fetchCustomer(), fetchLoyalty()]);
    } finally {
      setImporting(false);
    }
  };

  useEffect(() => {
    fetchCustomer();
    fetchOffers();
    fetchSpend();
    fetchLoyalty();
    fetch("/api/integrations/gmail/status")
      .then((r) => r.json())
      .then(setGmailStatus)
      .catch(() => {});
    // Only ever shows messaging UI if the business has a real, verified Twilio setup
    fetch("/api/messaging/status")
      .then((r) => r.json())
      .then(setMessagingStatus)
      .catch(() => {});
    fetch(`/api/crm/customers/${id}/messages`)
      .then((r) => (r.ok ? r.json() : { messages: [] }))
      .then((d) => setMessages(d.messages || []))
      .catch(() => {});
  }, [id]);

  const sendGuestMessage = async () => {
    if (!customer || !messageBody.trim()) return;
    setSendingMessage(true);
    try {
      const res = await fetch("/api/messaging/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: customer.id, channel: messageChannel, body: messageBody }),
      });
      if (res.ok) {
        setShowMessageModal(false);
        setMessageBody("");
        fetch(`/api/crm/customers/${id}/messages`)
          .then((r) => (r.ok ? r.json() : { messages: [] }))
          .then((d) => setMessages(d.messages || []));
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to send message");
      }
    } finally {
      setSendingMessage(false);
    }
  };

  const startEdit = () => {
    if (!customer) return;
    setEditForm({
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      birthday: customer.birthday ? customer.birthday.split("T")[0] : null,
      dietaryNotes: customer.dietaryNotes,
      allergies: customer.allergies,
      seatingPreference: customer.seatingPreference,
      tags: [...customer.tags],
      internalNotes: customer.internalNotes,
      gdprConsent: customer.gdprConsent,
      smsWhatsappConsent: customer.smsWhatsappConsent,
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
      // Hosted image URL, never a data: URI — Gmail and Outlook.com drop those
      // silently. The code is repeated as text so the offer still works for
      // anyone who blocks images altogether.
      const qrBlock = pendingOfferQrUrl
        ? `<div style="margin-top:24px;text-align:center;padding:20px;background:#F7F8FA;border-radius:12px;"><img src="${pendingOfferQrUrl}" alt="Offer code ${pendingOfferCode}" width="180" height="180" style="display:block;margin:0 auto;border-radius:8px;" /><p style="font-size:13px;color:#5A6478;margin:12px 0 0;">Show this at the bar or till</p><p style="font-family:monospace;font-size:16px;font-weight:bold;color:#0F1C35;margin:6px 0 0;letter-spacing:1px;">${pendingOfferCode}</p></div>`
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
        setPendingOfferQrUrl(null);
        setPendingOfferCode(null);
        await fetchCustomer();
        if (data.simulated) {
          alert(
            "Demo mode — this email was logged but not actually sent. No real emails go out from demo accounts."
          );
        } else if (data.fellBackToDefault) {
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

  // Bookings still drive the reservation history list below, but the headline
  // counters come from the loyalty rollups (bills + attended past bookings) so
  // they agree with the Spend history card instead of contradicting it.
  const NON_VISIT = ["cancelled", "no-show", "no_show", "noshow"];
  const nowMs = Date.now();
  const visits = customer.reservations.filter(
    (r) => !NON_VISIT.includes(r.status) && new Date(r.date).getTime() <= nowMs
  );
  const noShows = customer.reservations.filter(
    (r) => r.status === "no-show" || r.status === "no_show" || r.status === "noshow"
  );
  const totalVisits = Math.max(customer.visitCount ?? 0, visits.length);
  const cachedLastMs = customer.lastVisitAt ? new Date(customer.lastVisitAt).getTime() : 0;
  const derivedLastMs = visits[0]?.date ? new Date(visits[0].date).getTime() : 0;
  const lastVisitMs = Math.max(cachedLastMs, derivedLastMs);
  const lastVisit = lastVisitMs ? new Date(lastVisitMs).toISOString() : null;

  // Unified activity timeline: notes + emails + reservations + offers, newest first
  type TimelineItem = {
    id: string;
    type: "note" | "email" | "reservation" | "offer";
    date: string;
    title: string;
    subtitle?: string;
  };
  const timeline: TimelineItem[] = [
    ...customer.crmNotes.map((n) => ({
      id: `note-${n.id}`,
      type: "note" as const,
      date: n.createdAt,
      title: n.note,
      subtitle: `Note by ${n.author.name ?? n.author.email}`,
    })),
    ...customer.crmEmails.map((e) => ({
      id: `email-${e.id}`,
      type: "email" as const,
      date: e.sentAt,
      title: e.subject,
      subtitle: `Sent by ${e.sentBy.name ?? e.sentBy.email}`,
    })),
    ...customer.reservations.map((r) => ({
      id: `res-${r.id}`,
      type: "reservation" as const,
      date: r.date,
      title: `${r.partySize} guests · ${r.time}${r.occasion ? ` · ${r.occasion}` : ""}`,
      subtitle: r.status,
    })),
    ...offers.map((o) => ({
      id: `offer-${o.id}`,
      type: "offer" as const,
      date: o.createdAt ?? o.expiresAt ?? new Date().toISOString(),
      title: o.title,
      subtitle: o.redeemed ? "Offer redeemed" : "Offer created",
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const currency = loyalty?.currency ?? "EUR";
  const sym = CURRENCY_SYMBOLS[currency] ?? "€";
  const money = (n: number | null | undefined) => `${sym}${(n ?? 0).toFixed(2)}`;
  const itemsLabel = (items: any): string => {
    if (!Array.isArray(items)) return "";
    return items
      .map((i: any) => (i?.qty && i.qty > 1 ? `${i.qty} x ${i.name}` : i?.name))
      .filter(Boolean)
      .join(", ");
  };
  const tiers = loyalty?.tiers ?? [];
  const currentTier = tiers.find((t) => t.key === customer.loyaltyTier);
  const nextTier = tiers
    .filter((t) => t.sortOrder > (currentTier?.sortOrder ?? -1))
    .sort((a, b) => a.sortOrder - b.sortOrder)[0];
  const pointsWorth = (customer.loyaltyPoints ?? 0) * (loyalty?.settings.pointValue ?? 0);
  const visitsToNext = nextTier ? Math.max(0, nextTier.minVisits - (customer.visitCount ?? 0)) : 0;
  const spendToNext = nextTier ? Math.max(0, nextTier.minSpend - (customer.totalSpend ?? 0)) : 0;

  const TIMELINE_ICON: Record<TimelineItem["type"], React.ReactElement> = {
    note: <PenLine className="h-3.5 w-3.5 text-purple-600" />,
    email: <Mail className="h-3.5 w-3.5 text-indigo-600" />,
    reservation: <Calendar className="h-3.5 w-3.5 text-blue-600" />,
    offer: <Ticket className="h-3.5 w-3.5 text-amber-600" />,
  };
  const TIMELINE_BG: Record<TimelineItem["type"], string> = {
    note: "bg-purple-100",
    email: "bg-indigo-100",
    reservation: "bg-blue-100",
    offer: "bg-amber-100",
  };

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
              {messagingStatus?.configured && customer.phone && customer.smsWhatsappConsent && (
                <Button size="sm" variant="outline" onClick={() => setShowMessageModal(true)} className="gap-1.5">
                  <Send className="h-4 w-4" /> Message
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
          { label: "Total Visits", value: totalVisits, icon: <Users className="h-4 w-4" />, color: "text-indigo-600" },
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
          {/* Loyalty */}
          {loyalty?.settings.enabled && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-1.5">
                <Crown className="h-4 w-4 text-amber-500" /> Loyalty
              </h3>
              <div className="flex items-center gap-2 flex-wrap mb-3">
                <span
                  className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${
                    TIER_STYLES[customer.loyaltyTier] ?? TIER_STYLES.bronze
                  }`}
                >
                  {currentTier?.name ?? customer.loyaltyTier ?? "Bronze"}
                </span>
                <span className="text-sm text-gray-700 font-medium">{customer.loyaltyPoints ?? 0} points</span>
                {pointsWorth > 0 && <span className="text-xs text-gray-400">worth about {money(pointsWorth)}</span>}
              </div>
              {currentTier?.perks && (
                <p className="text-xs text-gray-600 whitespace-pre-line mb-3">{currentTier.perks}</p>
              )}
              {nextTier && (
                <p className="text-xs text-gray-500 mb-3">
                  Next: <span className="font-medium text-gray-700">{nextTier.name}</span> at {nextTier.minVisits} visits
                  and {money(nextTier.minSpend)} lifetime.{" "}
                  {visitsToNext > 0 ? `${visitsToNext} more visits` : "Visits met"},{" "}
                  {spendToNext > 0 ? `${money(spendToNext)} more spend` : "spend met"}.
                </p>
              )}
              {!customer.isAnonymised && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full gap-1.5"
                  disabled={(customer.loyaltyPoints ?? 0) < 1}
                  onClick={() => {
                    setRedeemPoints("");
                    setRedeemReward("");
                    setShowRedeemModal(true);
                  }}
                >
                  <Coins className="h-4 w-4" /> Redeem points
                </Button>
              )}
              {redemptions.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-2 max-h-44 overflow-y-auto">
                  {redemptions.map((r) => (
                    <div key={r.id} className="flex items-start justify-between gap-2 text-xs">
                      <div>
                        <div className="font-medium text-gray-800">{r.reward}</div>
                        <div className="text-gray-400">
                          {r.points} pts
                          {r.valueAmount ? ` · ${money(r.valueAmount)}` : ""} · {formatDate(r.createdAt)}
                        </div>
                      </div>
                      <button
                        onClick={() => deleteRedemption(r.id)}
                        className="text-gray-300 hover:text-red-500 shrink-0"
                        title="Remove redemption"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

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
              {customer.seatingPreference && (
                <div>
                  <dt className="text-xs text-gray-500 font-medium">Seating Preference</dt>
                  <dd className="text-gray-800">{customer.seatingPreference}</dd>
                </div>
              )}
              {(customer.favouriteDishes?.length ?? 0) > 0 && (
                <div>
                  <dt className="text-xs text-gray-500 font-medium">Favourite dishes</dt>
                  <dd className="text-gray-800">{customer.favouriteDishes.join(", ")}</dd>
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
          {/* Spend history */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
              <h3 className="font-semibold text-gray-800 flex items-center gap-1.5">
                <Receipt className="h-4 w-4 text-indigo-600" /> Spend history
              </h3>
              {!customer.isAnonymised && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={openBill}>
                    <Plus className="h-4 w-4" /> Add bill
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => {
                      setImportCsv("");
                      setImportReport(null);
                      setShowImportModal(true);
                    }}
                  >
                    <Upload className="h-4 w-4" /> Import CSV
                  </Button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className="bg-gray-50 rounded-lg px-3 py-2">
                <div className="text-xs text-gray-500">Lifetime spend</div>
                <div className="text-lg font-bold text-gray-900">{money(customer.totalSpend)}</div>
              </div>
              <div className="bg-gray-50 rounded-lg px-3 py-2">
                <div className="text-xs text-gray-500">Average bill</div>
                <div className="text-lg font-bold text-gray-900">{money(customer.averageSpend)}</div>
              </div>
              <div className="bg-gray-50 rounded-lg px-3 py-2">
                <div className="text-xs text-gray-500">Recorded visits</div>
                <div className="text-lg font-bold text-gray-900">{customer.visitCount ?? 0}</div>
              </div>
              <div className="bg-gray-50 rounded-lg px-3 py-2">
                <div className="text-xs text-gray-500">Last visit</div>
                <div className="text-lg font-bold text-gray-900">{formatDate(customer.lastVisitAt ?? null)}</div>
              </div>
            </div>

            {transactions.length === 0 ? (
              <p className="text-sm text-gray-400">
                No bills recorded yet. The POS feed is day level with no guest identity, so per guest spend is added by
                hand or imported from a CSV.
              </p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {transactions.map((t) => (
                  <div key={t.id} className="flex items-start justify-between gap-3 bg-gray-50 rounded-lg px-3 py-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900">
                        {money(t.totalSpend)}
                        <span className="text-xs font-normal text-gray-500"> · {formatDate(t.date)}</span>
                        {t.covers ? (
                          <span className="text-xs font-normal text-gray-500"> · {t.covers} covers</span>
                        ) : null}
                      </div>
                      {(t.itemsText || itemsLabel(t.items)) && (
                        <div className="text-xs text-gray-600 truncate">{t.itemsText || itemsLabel(t.items)}</div>
                      )}
                      {t.notes && <div className="text-xs text-gray-500 truncate">{t.notes}</div>}
                      <div className="text-xs text-gray-400">
                        {t.source === "csv" ? "CSV import" : t.source === "pos" ? "POS" : "Added by hand"}
                        {t.pointsAwarded ? ` · ${t.pointsAwarded} pts` : ""}
                        {t.recordedBy ? ` · ${t.recordedBy}` : ""}
                      </div>
                    </div>
                    {!customer.isAnonymised && (
                      <button
                        onClick={() => deleteTransaction(t.id)}
                        className="text-gray-300 hover:text-red-500 shrink-0"
                        title="Delete bill"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Unified Activity Timeline */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-1.5">
              <History className="h-4 w-4 text-indigo-600" />
              Activity Timeline
              <span className="ml-auto text-xs text-gray-400 font-normal">{timeline.length} events</span>
            </h3>
            {timeline.length === 0 ? (
              <p className="text-sm text-gray-400">No activity yet.</p>
            ) : (
              <div className="space-y-0 max-h-80 overflow-y-auto">
                {timeline.slice(0, 30).map((item, idx) => (
                  <div key={item.id} className="flex gap-3 relative">
                    <div className="flex flex-col items-center">
                      <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 ${TIMELINE_BG[item.type]}`}>
                        {TIMELINE_ICON[item.type]}
                      </div>
                      {idx < Math.min(timeline.length, 30) - 1 && (
                        <div className="w-px flex-1 bg-gray-100 my-0.5" />
                      )}
                    </div>
                    <div className="pb-3 min-w-0 flex-1">
                      <p className="text-sm text-gray-800 truncate">{item.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {item.subtitle ? `${item.subtitle} · ` : ""}{formatDateTime(item.date)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

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
                      <span className={`text-xs ${new Date(o.expiresAt) < new Date() && !o.redeemed ? "font-medium text-red-500" : "text-gray-400"}`}>
                        {new Date(o.expiresAt) < new Date() && !o.redeemed ? "expired " : "expires "}
                        {formatDate(o.expiresAt)}
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

          {/* Message history — only rendered once messaging is verified & configured for this business */}
          {messagingStatus?.configured && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-1.5">
                <Send className="h-4 w-4 text-indigo-600" />
                WhatsApp / SMS History
                {!customer.smsWhatsappConsent && customer.phone && (
                  <span className="ml-2 text-xs text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
                    No SMS/WhatsApp consent — can't send
                  </span>
                )}
                {customer.phone && customer.smsWhatsappConsent && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowMessageModal(true)}
                    className="ml-auto gap-1 text-xs"
                  >
                    <Send className="h-3 w-3" /> Send
                  </Button>
                )}
              </h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {messages.length === 0 && (
                  <p className="text-sm text-gray-400">No messages yet.</p>
                )}
                {messages.map((m) => (
                  <div key={m.id} className={`rounded-lg px-3 py-2 text-sm ${m.direction === "inbound" ? "bg-indigo-50/60" : "bg-gray-50"}`}>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <span className="uppercase font-medium">{m.channel}</span>
                      <span>·</span>
                      <span>{m.direction === "inbound" ? "Received" : "Sent"}</span>
                      <span>·</span>
                      <span className={m.status === "failed" ? "text-red-500" : ""}>{m.status}</span>
                    </div>
                    <div className="text-gray-800 mt-0.5">{m.body}</div>
                    <div className="text-xs text-gray-400 mt-1">{formatDateTime(m.createdAt)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Send WhatsApp/SMS Dialog */}
      <Dialog open={showMessageModal} onOpenChange={setShowMessageModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Message {customer.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Channel</Label>
              <div className="flex gap-2 mt-1">
                {messagingStatus?.hasWhatsapp && (
                  <Button
                    size="sm"
                    variant={messageChannel === "whatsapp" ? "default" : "outline"}
                    onClick={() => setMessageChannel("whatsapp")}
                    className={messageChannel === "whatsapp" ? "bg-indigo-600 hover:bg-indigo-700" : ""}
                  >
                    WhatsApp
                  </Button>
                )}
                {messagingStatus?.hasSms && (
                  <Button
                    size="sm"
                    variant={messageChannel === "sms" ? "default" : "outline"}
                    onClick={() => setMessageChannel("sms")}
                    className={messageChannel === "sms" ? "bg-indigo-600 hover:bg-indigo-700" : ""}
                  >
                    SMS
                  </Button>
                )}
              </div>
            </div>
            <div>
              <Label>Message</Label>
              <Textarea value={messageBody} onChange={(e) => setMessageBody(e.target.value)} rows={4} placeholder="Write your message…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMessageModal(false)}>Cancel</Button>
            <Button onClick={sendGuestMessage} disabled={sendingMessage || !messageBody.trim()} className="bg-indigo-600 hover:bg-indigo-700 gap-1.5">
              {sendingMessage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <div className="pt-2">
              <Label>Expires</Label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {[
                  { label: "7 days", value: 7 },
                  { label: "14 days", value: 14 },
                  { label: "30 days", value: 30 },
                  { label: "90 days", value: 90 },
                  { label: "No expiry", value: null },
                ].map((opt) => (
                  <button
                    key={opt.label}
                    onClick={() => setExpiresInDays(opt.value)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                      expiresInDays === opt.value
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                        : "border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
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
              <Label>Seating Preference</Label>
              <Input value={editForm.seatingPreference ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, seatingPreference: e.target.value || null }))} placeholder="Window table, booth, quiet corner..." />
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
            <div className="flex items-center gap-2">
              <Checkbox
                id="sms-consent-edit"
                checked={editForm.smsWhatsappConsent ?? false}
                onCheckedChange={(v) => setEditForm((f) => ({ ...f, smsWhatsappConsent: !!v }))}
              />
              <Label htmlFor="sms-consent-edit" className="text-sm cursor-pointer">
                SMS/WhatsApp consent
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
              {session?.user?.email?.endsWith("@rotahr.demo")
                ? "Demo mode — this will be logged in the email history but no real email is sent."
                : gmailStatus?.connected
                ? `This email will be sent from your connected Gmail (${gmailStatus.email}) and logged in the email history.`
                : "This email will be sent from Rotahr's shared address (sales@rotahr.com) with your venue's own email as the reply-to, so guest replies come back to you. Connect your own Gmail in Settings > Email to send as yourself instead."}
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

      {/* Add bill Dialog */}
      <Dialog open={showBillModal} onOpenChange={setShowBillModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add a bill for {customer.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Date</Label>
              <Input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Bill total ({sym})</Label>
                <Input
                  inputMode="decimal"
                  placeholder="84.50"
                  value={billAmount}
                  onChange={(e) => setBillAmount(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Covers (optional)</Label>
                <Input
                  inputMode="numeric"
                  placeholder="2"
                  value={billCovers}
                  onChange={(e) => setBillCovers(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">What they had (optional)</Label>
              <Textarea
                rows={2}
                placeholder="2 x Sirloin, Malbec, Sticky toffee"
                value={billItems}
                onChange={(e) => setBillItems(e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-1">Comma separated. This is what builds their favourite dishes.</p>
            </div>
            <div>
              <Label className="text-xs">Notes (optional)</Label>
              <Input
                placeholder="Anniversary, window table"
                value={billNotes}
                onChange={(e) => setBillNotes(e.target.value)}
              />
            </div>
            {loyalty?.settings.enabled && (
              <p className="text-xs text-gray-500">
                Points are awarded at {loyalty.settings.pointsPerCurrency} per {sym}1 and the tier is re-checked on save.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBillModal(false)}>
              Cancel
            </Button>
            <Button onClick={saveBill} disabled={savingBill} className="bg-indigo-600 hover:bg-indigo-700">
              {savingBill ? "Saving…" : "Save bill"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Redeem points Dialog */}
      <Dialog open={showRedeemModal} onOpenChange={setShowRedeemModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Redeem points for {customer.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Balance: <span className="font-semibold text-gray-900">{customer.loyaltyPoints ?? 0} points</span>
              {pointsWorth > 0 && <span className="text-gray-400"> (about {money(pointsWorth)})</span>}
            </p>
            <div>
              <Label className="text-xs">Points to redeem</Label>
              <Input
                inputMode="numeric"
                placeholder="100"
                value={redeemPoints}
                onChange={(e) => setRedeemPoints(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">What the guest gets</Label>
              <Input
                placeholder="Free dessert"
                value={redeemReward}
                onChange={(e) => setRedeemReward(e.target.value)}
              />
            </div>
            <p className="text-xs text-gray-400">
              Redeeming never moves a tier. Tiers are earned on visits and lifetime spend.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRedeemModal(false)}>
              Cancel
            </Button>
            <Button onClick={redeem} disabled={redeeming} className="bg-indigo-600 hover:bg-indigo-700">
              {redeeming ? "Redeeming…" : "Redeem"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV import Dialog */}
      <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import bills from a CSV</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-gray-500">
              Columns read: date, amount or total, email, phone, name, covers, items, reference. Guests are matched on
              email, then phone, then exact name, so one file can cover every guest in the venue. Ambiguous names are
              skipped rather than guessed. Nothing is written until you press Import.
            </p>
            <Textarea
              rows={8}
              className="font-mono text-xs"
              placeholder={"date,email,amount,covers,items\n2026-08-14,jane@example.com,84.50,2,\"2 x Sirloin, Malbec\""}
              value={importCsv}
              onChange={(e) => {
                setImportCsv(e.target.value);
                setImportReport(null);
              }}
            />
            {importReport && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
                <div className="text-sm font-medium text-gray-800">
                  {importReport.imported != null
                    ? `Imported ${importReport.imported} bills across ${importReport.guestsUpdated ?? 0} guests`
                    : `${importReport.matched} of ${importReport.rowsRead} rows ready to import`}
                  {importReport.totalSpend ? ` · ${money(importReport.totalSpend)}` : ""}
                </div>
                {importReport.truncated && (
                  <div className="text-xs text-amber-700">File was truncated at the 2000 row cap.</div>
                )}
                {(importReport.preview || []).length > 0 && (
                  <div className="text-xs text-gray-600">
                    <div className="font-medium mb-1">First rows</div>
                    {importReport.preview.map((p: any, i: number) => (
                      <div key={i}>
                        {p.date} · {p.guest} · {money(p.amount)}
                      </div>
                    ))}
                  </div>
                )}
                {importReport.skipped > 0 && (
                  <div className="text-xs text-gray-600">
                    <div className="font-medium mb-1">{importReport.skipped} skipped</div>
                    <ul className="list-disc pl-4 space-y-0.5 max-h-32 overflow-y-auto">
                      {(importReport.skippedRows || []).slice(0, 20).map((sk: any, i: number) => (
                        <li key={i}>
                          Line {sk.line}: {sk.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportModal(false)}>
              Close
            </Button>
            <Button variant="outline" onClick={() => runImport(true)} disabled={importing || !importCsv.trim()}>
              {importing ? "Checking…" : "Check file"}
            </Button>
            <Button
              onClick={() => runImport(false)}
              disabled={importing || !importReport || !importReport.matched || importReport.imported != null}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              Import{importReport?.matched && importReport.imported == null ? ` ${importReport.matched}` : ""}
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
