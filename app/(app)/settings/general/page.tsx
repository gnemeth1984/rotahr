// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  User, Mail, Lock, Bell, ShieldAlert, Loader2, Check, Eye, EyeOff, Globe,
} from "lucide-react";
import PushSubscribeButton from "@/components/PushSubscribeButton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useCurrency } from "@/components/shared/CurrencyProvider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function GeneralSettingsPage() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const { currency: currentCurrency, ready: currencyReady } = useCurrency();
  const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "MANAGER";

  // Business localisation
  const [currency, setCurrency] = useState<"EUR" | "GBP" | "USD" | "CAD" | "AUD">("EUR");
  const [savingLocale, setSavingLocale] = useState(false);
  const [localeMsg, setLocaleMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Profile
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Password
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Notifications
  const [notifShift, setNotifShift] = useState(true);
  const [notifMessage, setNotifMessage] = useState(true);
  const [notifTimeoff, setNotifTimeoff] = useState(true);
  const [notifRota, setNotifRota] = useState(true);
  const [savingNotif, setSavingNotif] = useState(false);
  const [notifMsg, setNotifMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (session?.user) {
      setName(session.user.name ?? "");
      setEmail(session.user.email ?? "");
    }
  }, [session]);

  useEffect(() => {
    if (currencyReady) setCurrency(currentCurrency as "EUR" | "GBP" | "USD" | "CAD" | "AUD");
  }, [currencyReady, currentCurrency]);

  async function saveLocale() {
    setSavingLocale(true);
    setLocaleMsg(null);
    try {
      const country =
        currency === "GBP" ? "GB" :
        currency === "USD" ? "US" :
        currency === "CAD" ? "CA" :
        currency === "AUD" ? "AU" : "IE";
      const res = await fetch("/api/business/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency, country }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setLocaleMsg({ ok: true, text: "Saved. Reload the page to see updated currency throughout the app." });
    } catch (e: any) {
      setLocaleMsg({ ok: false, text: e.message });
    } finally {
      setSavingLocale(false);
    }
  }

  async function saveProfile() {
    if (!name.trim()) return;
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      await update({ name: name.trim() });
      setProfileMsg({ ok: true, text: "Profile updated." });
    } catch (e: any) {
      setProfileMsg({ ok: false, text: e.message });
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword() {
    if (!currentPw || !newPw || !confirmPw) return;
    if (newPw !== confirmPw) {
      setPwMsg({ ok: false, text: "New passwords don't match." });
      return;
    }
    if (newPw.length < 8) {
      setPwMsg({ ok: false, text: "Password must be at least 8 characters." });
      return;
    }
    setSavingPw(true);
    setPwMsg(null);
    try {
      const res = await fetch("/api/user/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setPwMsg({ ok: true, text: "Password changed. You'll be signed out." });
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
      setTimeout(() => signOut({ callbackUrl: "/auth/signin" }), 2000);
    } catch (e: any) {
      setPwMsg({ ok: false, text: e.message });
    } finally {
      setSavingPw(false);
    }
  }

  async function saveNotifications() {
    setSavingNotif(true);
    setNotifMsg(null);
    try {
      const res = await fetch("/api/user/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notifShift, notifMessage, notifTimeoff, notifRota,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setNotifMsg({ ok: true, text: "Notification preferences saved." });
    } catch (e: any) {
      setNotifMsg({ ok: false, text: e.message });
    } finally {
      setSavingNotif(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Account Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage your profile, password and notification preferences</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4 text-blue-600" /> Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="name">Display Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              value={email}
              disabled
              className="bg-slate-50 text-slate-500"
            />
            <p className="text-xs text-slate-400">Email cannot be changed here. Contact your admin.</p>
          </div>
          {profileMsg && (
            <p className={`text-sm ${profileMsg.ok ? "text-green-600" : "text-red-500"}`}>
              {profileMsg.text}
            </p>
          )}
          <Button onClick={saveProfile} disabled={savingProfile || !name.trim()}>
            {savingProfile ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
            Save Profile
          </Button>
        </CardContent>
      </Card>

      {/* Password */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="h-4 w-4 text-blue-600" /> Change Password
          </CardTitle>
          <CardDescription>
            {session?.user?.image ? "Signed in with Google — password changes not available." : "Choose a strong password of at least 8 characters."}
          </CardDescription>
        </CardHeader>
        {!session?.user?.image && (
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="current-pw">Current Password</Label>
              <div className="relative">
                <Input
                  id="current-pw"
                  type={showPw ? "text" : "password"}
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  placeholder="Current password"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-pw">New Password</Label>
              <div className="relative">
                <Input
                  id="new-pw"
                  type={showPw ? "text" : "password"}
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  placeholder="New password"
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  onClick={() => setShowPw((v) => !v)}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="confirm-pw">Confirm New Password</Label>
              <Input
                id="confirm-pw"
                type={showPw ? "text" : "password"}
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="Confirm new password"
              />
            </div>
            {pwMsg && (
              <p className={`text-sm ${pwMsg.ok ? "text-green-600" : "text-red-500"}`}>
                {pwMsg.text}
              </p>
            )}
            <Button
              onClick={changePassword}
              disabled={savingPw || !currentPw || !newPw || !confirmPw}
              variant="destructive"
            >
              {savingPw ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Lock className="h-4 w-4 mr-2" />}
              Change Password
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4 text-blue-600" /> Notification Preferences
          </CardTitle>
          <CardDescription>Choose what triggers in-app notifications for you.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <p className="text-sm font-medium text-slate-900">Browser push notifications</p>
              <p className="text-xs text-slate-500">Get notified even when the app isn&apos;t open.</p>
            </div>
            <PushSubscribeButton />
          </div>
          {[
            { label: "New or changed shifts", desc: "When your shift is created, updated or cancelled", val: notifShift, set: setNotifShift },
            { label: "Messages", desc: "When you receive a new direct or group message", val: notifMessage, set: setNotifMessage },
            { label: "Time off updates", desc: "When your time off request is approved or rejected", val: notifTimeoff, set: setNotifTimeoff },
            { label: "Rota published", desc: "When a manager publishes the week's rota", val: notifRota, set: setNotifRota },
          ].map(({ label, desc, val, set }) => (
            <div key={label} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-900">{label}</p>
                <p className="text-xs text-slate-500">{desc}</p>
              </div>
              <Switch checked={val} onCheckedChange={set} />
            </div>
          ))}
          {notifMsg && (
            <p className={`text-sm ${notifMsg.ok ? "text-green-600" : "text-red-500"}`}>
              {notifMsg.text}
            </p>
          )}
          <Button onClick={saveNotifications} disabled={savingNotif}>
            {savingNotif ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
            Save Preferences
          </Button>
        </CardContent>
      </Card>

      {/* Business Localisation — managers/admins only */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-4 w-4 text-blue-600" /> Business Localisation
            </CardTitle>
            <CardDescription>
              Set the currency and region for your business. Affects all money formatting across the app.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-sm font-medium text-slate-900">Currency & Region</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {currency === "GBP" && "British Pound (£) — UK, 20% VAT"}
                  {currency === "EUR" && "Euro (€) — Ireland, 23% VAT"}
                  {currency === "USD" && "US Dollar ($) — United States, sales tax varies by state"}
                  {currency === "CAD" && "Canadian Dollar (C$) — Canada, GST/HST varies by province"}
                  {currency === "AUD" && "Australian Dollar (A$) — Australia, 10% GST"}
                </p>
              </div>
              <Select
                value={currency}
                onValueChange={(v) => {
                  setCurrency(v as typeof currency);
                  setLocaleMsg(null);
                }}
              >
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EUR">€ EUR — Ireland</SelectItem>
                  <SelectItem value="GBP">£ GBP — United Kingdom</SelectItem>
                  <SelectItem value="USD">$ USD — United States</SelectItem>
                  <SelectItem value="CAD">C$ CAD — Canada</SelectItem>
                  <SelectItem value="AUD">A$ AUD — Australia</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {localeMsg && (
              <p className={`text-sm ${localeMsg.ok ? "text-green-600" : "text-red-500"}`}>
                {localeMsg.text}
              </p>
            )}

            <Button onClick={saveLocale} disabled={savingLocale}>
              {savingLocale ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
              Save
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Danger zone */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-red-600">
            <ShieldAlert className="h-4 w-4" /> Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600 mb-3">
            Signing out will end your current session on this device.
          </p>
          <Button
            variant="outline"
            className="border-red-200 text-red-600 hover:bg-red-50"
            onClick={() => signOut({ callbackUrl: "/" })}
          >
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
