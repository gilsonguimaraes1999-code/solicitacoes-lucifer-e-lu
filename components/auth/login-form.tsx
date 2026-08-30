"use client";

import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { login } from "@/features/auth/actions";

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);

  return <>
    <form action={login} className="mt-6 grid gap-4">
      <label className="label">E-mail<input className="field" name="email" type="email" autoComplete="email" required /></label>
      <label className="label">Senha<span className="relative"><input className="field pr-11" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required /><button type="button" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} aria-pressed={showPassword} className="absolute inset-y-0 right-0 grid w-11 place-items-center text-white/40 transition-colors hover:text-gold-soft focus-visible:text-gold" onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>
      <button className="button mt-1 w-full" type="submit">Entrar</button>
    </form>
    <div className="mt-5 flex justify-between text-sm text-white/60"><Link className="transition-colors hover:text-gold-soft" href="/register">Criar conta</Link><Link className="transition-colors hover:text-gold-soft" href="/forgot-password">Esqueci a senha</Link></div>
  </>;
}
