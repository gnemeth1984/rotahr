// @ts-nocheck
"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import {
  CreditCard, CheckCircle2, AlertCircle, Loader2, ExternalLink,
  Zap, Building2, Star
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { UserRole as Role } from "@/types/roles"

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: "€59",
    period: "/mo",
    description: "Up to 10 staff",
    features: ["Rota & scheduling", "Time off management", "Bookings", "Messaging"],
    icon: Zap,
    color: "text-blue-500",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    border: "border-blue-200 dark:border-blue-800",
  },
  {
    id: "pro",
    name: "Pro",
    price: "€119",
    period: "/mo",
    description: "Up to 30 staff",
    features: ["Everything in Starter", "Payroll & tips", "Bookkeeping", "Stock management", "AI assistant"],
    icon: Star,
    color: "text-purple-500",
    bg: "bg-purple-50 dark:bg-purple-950/30",
    border: "border-purple-200 dark:border-purple-800",
    popular: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "€215",
    period: "/mo",
    description: "Unlimited staff, multi-venue",
    features: ["Everything in Pro", "Multi-venue", "Priority support", "Custom integrations"],
    icon: Building2,
    color: "text-amber-500",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-200 dark:border-amber-800",
  },
]

export default function BillingPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [subscription, setSubscription] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)

  const role = (session?.user as any)?.role

  useEffect(() => {
    if (role && role !== Role.ADMIN && role !== Role.MANAGER) {
      router.replace("/dashboard")
      return
    }
    fetch("/api/billing/subscription")
      .then((r) => r.json())
      .then((d) => setSubscription(d))
      .finally(() => setLoading(false))
  }, [role])

  async function handleCheckout(plan: string) {
    setCheckoutLoading(plan)
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      })
      const { url, error } = await res.json()
      if (error) throw new Error(error)
      window.location.href = url
    } catch (e: any) {
      alert(e.message ?? "Something went wrong")
    } finally {
      setCheckoutLoading(null)
    }
  }

  async function handlePortal() {
    setPortalLoading(true)
    try {
      const res = await fetch("/api/billing/portal")
      const { url, error } = await res.json()
      if (error) throw new Error(error)
      window.open(url, "_blank")
    } catch (e: any) {
      alert(e.message ?? "Something went wrong")
    } finally {
      setPortalLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const currentPlan = subscription?.plan ?? "none"
  const currentStatus = subscription?.status ?? "none"
  const isActive = currentStatus === "active"

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Billing & Subscription</h1>
        <p className="text-muted-foreground mt-1">Manage your Rotahr plan</p>
      </div>

      {/* Current subscription status */}
      {currentPlan !== "none" && (
        <Card className="border-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Current Plan
              </CardTitle>
              <Badge variant={isActive ? "default" : "destructive"} className="capitalize">
                {isActive ? (
                  <><CheckCircle2 className="h-3 w-3 mr-1" />{currentStatus}</>
                ) : (
                  <><AlertCircle className="h-3 w-3 mr-1" />{currentStatus}</>
                )}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Plan</span>
              <span className="font-semibold capitalize">{currentPlan}</span>
            </div>
            {subscription?.renewsAt && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Renews</span>
                <span>{new Date(subscription.renewsAt).toLocaleDateString("en-IE")}</span>
              </div>
            )}
            {subscription?.endsAt && currentStatus === "cancelled" && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Access until</span>
                <span>{new Date(subscription.endsAt).toLocaleDateString("en-IE")}</span>
              </div>
            )}
            <div className="pt-2">
              <Button
                variant="outline"
                onClick={handlePortal}
                disabled={portalLoading}
                className="w-full sm:w-auto"
              >
                {portalLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4 mr-2" />
                )}
                Manage subscription / Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plan cards */}
      <div>
        <h2 className="text-lg font-semibold mb-4">
          {currentPlan === "none" ? "Choose a plan" : "Switch plan"}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map((plan) => {
            const Icon = plan.icon
            const isCurrent = currentPlan === plan.id
            return (
              <Card
                key={plan.id}
                className={`relative border-2 transition-all ${
                  isCurrent ? plan.border : "border-border"
                } ${plan.popular ? "ring-2 ring-purple-400 ring-offset-2" : ""}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-purple-500 text-white text-xs">Most Popular</Badge>
                  </div>
                )}
                <CardHeader className={`rounded-t-lg ${isCurrent ? plan.bg : ""}`}>
                  <div className="flex items-center gap-2">
                    <Icon className={`h-5 w-5 ${plan.color}`} />
                    <CardTitle className="text-base">{plan.name}</CardTitle>
                    {isCurrent && (
                      <Badge variant="outline" className="ml-auto text-xs">Current</Badge>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1 mt-2">
                    <span className="text-3xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground text-sm">{plan.period}</span>
                  </div>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <ul className="space-y-2 text-sm">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full"
                    variant={isCurrent ? "outline" : "default"}
                    disabled={isCurrent && isActive || !!checkoutLoading}
                    onClick={() => !isCurrent && handleCheckout(plan.id)}
                  >
                    {checkoutLoading === plan.id ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Redirecting...</>
                    ) : isCurrent && isActive ? (
                      "Current plan"
                    ) : (
                      "Subscribe"
                    )}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Note */}
      <p className="text-xs text-muted-foreground text-center">
        Payments securely handled by Lemon Squeezy. All prices include 23% Irish VAT.
        Cancel anytime from your billing portal.
      </p>
    </div>
  )
}
