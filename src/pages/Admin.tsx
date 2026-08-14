import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import Seo from "@/components/Seo";

type Account = {
  id: string;
  label: string;
  key_preview: string;
  is_active: boolean;
  priority: number;
  last_used_at: string | null;
  last_error: string | null;
  exhausted_at: string | null;
};

const PASS_KEY = "admin_passcode";

const Admin = () => {
  const [passcode, setPasscode] = useState(() => sessionStorage.getItem(PASS_KEY) ?? "");
  const [authed, setAuthed] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [label, setLabel] = useState("");
  const [apiKey, setApiKey] = useState("");

  const call = async (body: Record<string, unknown>, code = passcode) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-firecrawl", {
        body,
        headers: { "x-admin-passcode": code },
      });
      if (error) throw new Error("Wrong passcode or request failed");
      if ((data as { error?: string })?.error) throw new Error(String((data as { error?: string }).error));
      setAccounts(((data as { accounts?: Account[] })?.accounts) ?? []);
      return data as Record<string, unknown>;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Request failed");
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (code: string) => {
    try {
      await call({ action: "list" }, code);
      sessionStorage.setItem(PASS_KEY, code);
      setPasscode(code);
      setAuthed(true);
    } catch {
      sessionStorage.removeItem(PASS_KEY);
    }
  };

  useEffect(() => {
    const saved = sessionStorage.getItem(PASS_KEY);
    if (saved) signIn(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addAccount = async () => {
    if (!label.trim() || !apiKey.trim()) return toast.error("Add a name and API key");
    await call({ action: "add", label: label.trim(), api_key: apiKey.trim() });
    setLabel("");
    setApiKey("");
    toast.success("Firecrawl account added");
  };

  if (!authed) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <Seo title="Admin — Local News" description="Admin panel" noindex />
        <Card className="w-full max-w-sm p-6 space-y-4">
          <h1 className="text-xl font-semibold">Admin sign in</h1>
          <Input
            type="password"
            placeholder="Admin passcode"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && signIn(passcode)}
          />
          <Button className="w-full" disabled={loading} onClick={() => signIn(passcode)}>
            {loading ? "Checking…" : "Sign in"}
          </Button>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto space-y-6">
      <Seo title="Admin — Firecrawl accounts" description="Manage Firecrawl accounts" noindex />
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Firecrawl accounts</h1>
        <Button
          variant="ghost"
          onClick={() => {
            sessionStorage.removeItem(PASS_KEY);
            setAuthed(false);
          }}
        >
          Sign out
        </Button>
      </header>

      <Card className="p-5 space-y-3">
        <h2 className="font-medium">Add another account</h2>
        <p className="text-sm text-muted-foreground">
          Paste a Firecrawl API key (starts with <code>fc-</code>). News fetching uses the built-in
          account first, then falls back to these when a limit is reached.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input placeholder="Account name" value={label} onChange={(e) => setLabel(e.target.value)} />
          <Input placeholder="fc-..." value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
        </div>
        <Button onClick={addAccount} disabled={loading}>Add account</Button>
      </Card>

      <div className="space-y-3">
        {accounts.length === 0 && (
          <p className="text-sm text-muted-foreground">No backup accounts yet.</p>
        )}
        {accounts.map((a) => (
          <Card key={a.id} className="p-4 flex flex-wrap items-center gap-3 justify-between">
            <div className="space-y-1">
              <div className="font-medium">
                {a.label}{" "}
                <span className="text-xs text-muted-foreground">{a.key_preview}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {a.exhausted_at
                  ? `Limit reached / failed${a.last_error ? ` (${a.last_error})` : ""}`
                  : a.is_active
                    ? "Active"
                    : "Paused"}
                {a.last_used_at && ` · last used ${new Date(a.last_used_at).toLocaleString()}`}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" disabled={loading}
                onClick={async () => {
                  const res = await call({ action: "test", id: a.id });
                  toast[(res as { tested?: boolean })?.tested === false ? "error" : "success"](
                    (res as { tested?: boolean })?.tested === false ? "Key failed" : "Key works",
                  );
                }}>
                Test
              </Button>
              <Button size="sm" variant="secondary" disabled={loading}
                onClick={() => call({ action: "toggle", id: a.id, is_active: !a.is_active })}>
                {a.is_active ? "Pause" : "Enable"}
              </Button>
              {a.exhausted_at && (
                <Button size="sm" variant="secondary" disabled={loading}
                  onClick={() => call({ action: "reset", id: a.id })}>
                  Reset limit
                </Button>
              )}
              <Button size="sm" variant="destructive" disabled={loading}
                onClick={() => call({ action: "delete", id: a.id })}>
                Delete
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </main>
  );
};

export default Admin;
