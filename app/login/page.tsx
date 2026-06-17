"use client"

import { signIn } from "next-auth/react"
import { useState } from "react"

export default function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  async function handleLogin() {
    await signIn("credentials", {
      email,
      password,
      callbackUrl: "/rota"
    })
  }

  return (
    <div className="p-6 max-w-sm mx-auto">
      <input
        className="border p-2 w-full mb-3 rounded"
        placeholder="Email"
        onChange={e => setEmail(e.target.value)}
      />
      <input
        className="border p-2 w-full mb-3 rounded"
        placeholder="Password"
        type="password"
        onChange={e => setPassword(e.target.value)}
      />
      <button
        className="bg-blue-600 text-white p-2 rounded w-full"
        onClick={handleLogin}
      >
        Login
      </button>
    </div>
  )
}
