"use client";

import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { login } from "@/features/auth/actions";

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);

  return <>
    <form action={login} className="mt-4 space-y-4">
      <label className="block text-sm text-white">E-mail<input className="calculator-login-field mt-2" name="email" type="email" autoComplete="email" required /></label>
      <label className="block text-sm text-white">Senha<span className="relative mt-2 block"><input className="calculator-login-field pr-11" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required /><button type="button" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} aria-pressed={showPassword} className="absolute inset-y-0 right-0 grid w-10 place-items-center text-white/50 transition-colors hover:text-white focus-visible:text-gold" onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? <EyeOff aria-hidden="true" size={16} /> : <Eye aria-hidden="true" size={16} />}</button></span></label>
      <button className="calculator-login-primary w-full" type="submit">Entrar</button>
      <Link className="calculator-login-ghost w-full" href="/forgot-password">Esqueci minha senha</Link>
    </form>
    <Link className="calculator-login-access mt-3 w-full" href="/register">Solicitar novo acesso</Link>
  </>;
}

