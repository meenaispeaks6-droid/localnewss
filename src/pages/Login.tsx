import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import Seo from "@/components/Seo";

/** Only allow same-origin relative redirect targets. */
const safeNext = (value: string | null) =>
  value && value.startsWith("/") && !value.startsWith("//") ? value : "/";

const Login = () => {
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) window.location.href = next;
    });
  }, [next]);

  const submit = async () => {
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}${next}` },
        });
        if (error) throw error;
        toast.success("Check your email to confirm your account.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = next;
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}${next}` },
    });
    if (error) toast.error(error.message);
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <Seo title="Sign in — Local News" description="Sign in to Local News" path="/login" lang="en" noindex />
      <Card className="w-full max-w-sm p-6 space-y-4">
        <h1 className="text-xl font-semibold">
          {mode === "signin" ? "Sign in" : "Create an account"}
        </h1>
        <Input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
        <Input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
        />
        <Button className="w-full" disabled={busy} onClick={submit}>
          {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Sign up"}
        </Button>
        <Button className="w-full" variant="secondary" onClick={google}>
          Continue with Google
        </Button>
        <button
          className="text-sm text-muted-foreground underline w-full"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        >
          {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
        </button>
      </Card>
    </main>
  );
};

export default Login;
