// Lemon Squeezy helpers

export const LS_API = "https://api.lemonsqueezy.com/v1"
export const LS_STORE_ID = process.env.LEMONSQUEEZY_STORE_ID!
export const LS_API_KEY = process.env.LEMONSQUEEZY_API_KEY!
export const LS_WEBHOOK_SECRET = process.env.LEMONSQUEEZY_WEBHOOK_SECRET!

export const VARIANT_MAP: Record<string, string> = {
  starter: "1817302",
  pro: "1818421",
  enterprise: "1818423",
}

export const VARIANT_TO_PLAN: Record<string, string> = {
  "1817302": "starter",
  "1818421": "pro",
  "1818423": "enterprise",
}

export function lsHeaders() {
  return {
    Authorization: `Bearer ${LS_API_KEY}`,
    Accept: "application/vnd.api+json",
    "Content-Type": "application/vnd.api+json",
  }
}

export async function lsFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${LS_API}${path}`, {
    ...options,
    headers: { ...lsHeaders(), ...(options?.headers ?? {}) },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`LS API error ${res.status}: ${text}`)
  }
  return res.json()
}

/** Build a checkout URL for a given variant, prefilling email */
export function checkoutUrl(variantId: string, email: string, businessId: string) {
  const base = `https://rotahr.lemonsqueezy.com/checkout/buy/${variantIdToCheckoutId(variantId)}`
  const params = new URLSearchParams({
    "checkout[email]": email,
    "checkout[custom][business_id]": businessId,
  })
  return `${base}?${params.toString()}`
}

// Map variant IDs to their checkout UUIDs (from product buy_now_url)
const CHECKOUT_IDS: Record<string, string> = {
  "1817302": "193c8b0d-63d6-40ee-a654-fec1dfcba1fc", // starter
  "1818421": "69ee8a82-4eaf-4f8d-b0dc-f8d3aca6fcf2", // pro
  "1818423": "2a383bb5-4cad-4a3b-bccf-fa21a69f1995", // enterprise
}

function variantIdToCheckoutId(variantId: string): string {
  return CHECKOUT_IDS[variantId] ?? variantId
}
