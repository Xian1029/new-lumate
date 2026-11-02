"use client";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  return (
    <main className="grid min-h-screen place-items-center bg-background p-5">
      <section className="w-full max-w-sm space-y-5 rounded-2xl border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand/10 text-2xl">🔒</div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">暂不开放自主注册</h1>
          <p className="text-sm leading-6 text-muted-foreground">学习账号由管理员统一创建。如需开通账号，请联系系统管理员。</p>
        </div>
        <button type="button" onClick={() => router.replace("/login")} className="w-full rounded-lg bg-brand p-3 font-semibold text-brand-foreground">返回登录</button>
      </section>
    </main>
  );
}
