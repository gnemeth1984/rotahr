// Lemon Squeezy helpers

export const LS_API = "https://api.lemonsqueezy.com/v1"
export const LS_STORE_ID = process.env.LEMONSQUEEZY_STORE_ID!
export const LS_API_KEY = process.env.LEMONSQUEEZY_API_KEY!
export const LS_WEBHOOK_SECRET = process.env.LEMONSQUEEZY_WEBHOOK_SECRET!

export const VARIANT_MAP: Record<string, string> = {
  starter: "1883638",
  pro: "1883789",
  enterprise: "1883902",
}

export const VARIANT_TO_PLAN: Record<string, string> = {
  "1883638": "starter",
  "1883789": "pro",
  "1883902": "enterprise",
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
  "1883638": "3c0f7992-3b73-4b80-96b4-ed019c8e1fc7", // starter
  "1883789": "0f85962f-cbab-4454-aa76-906b77343c19", // pro
  "1883902": "d1187409-d725-4da4-906e-13ef14cf6f98", // enterprise
}

function variantIdToCheckoutId(variantId: string): string {
  return CHECKOUT_IDS[variantId] ?? variantId
}
