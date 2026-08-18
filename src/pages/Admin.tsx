import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  last_checked_at?: string | null;
  last_success_at?: string | null;
  last_status?: number | null;
  last_latency_ms?: number | null;
};

type AiKey = Account & { base_url: string; model: string };

const PASS_KEY = "admin_passcode";

const HEALTH_INTERVAL_MS = 15 * 60 * 1000;

const timeAgo = (iso: string) => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  return `${Math.round(hrs / 24)} d ago`;
};

const statusTone = (status?: number | null) => {
  if (status == null || status === 0) return "destructive" as const;
  if (status < 300) return "secondary" as const;
  return "destructive" as const;
};

const HealthLine = ({ item }: { item: Account }) => (
  <div className="space-y-1">
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <Badge variant={statusTone(item.last_status)}>
        {item.last_status == null
          ? "Not checked"
          : item.last_status === 0
            ? "Network error"
            : `HTTP ${item.last_status}`}
      </Badge>
      {item.last_latency_ms != null && (
        <span className="text-muted-foreground">{item.last_latency_ms} ms</span>
      )}
      <span className="text-muted-foreground">
        {item.last_success_at
          ? `Last verified ${timeAgo(item.last_success_at)} (${new Date(item.last_success_at).toLocaleString()})`
          : "Never verified"}
      </span>
      {item.last_checked_at && (
        <span className="text-muted-foreground">· last checked {timeAgo(item.last_checked_at)}</span>
      )}
    </div>
    {item.last_error && (
      <p className="text-xs text-destructive break-words">{item.last_error}</p>
    )}
  </div>
);

const Admin = () => {
  const [passcode, setPasscode] = useState(() => sessionStorage.getItem(PASS_KEY) ?? "");
  const [authed, setAuthed] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [aiKeys, setAiKeys] = useState<AiKey[]>([]);
  const [activeAiId, setActiveAiId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [label, setLabel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [aiLabel, setAiLabel] = useState("");
  const [aiApiKey, setAiApiKey] = useState("");
  const [aiBaseUrl, setAiBaseUrl] = useState("https://generativelanguage.googleapis.com/v1beta/openai");
  const [aiModel, setAiModel] = useState("gemini-3.6-flash");

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

  const callAi = async (body: Record<string, unknown>, code = passcode) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-ai-keys", {
        body,
        headers: { "x-admin-passcode": code },
      });
      if (error) throw new Error("Wrong passcode or request failed");
      if ((data as { error?: string })?.error) throw new Error(String((data as { error?: string }).error));
      setAiKeys(((data as { keys?: AiKey[] })?.keys) ?? []);
      setActiveAiId(((data as { activeId?: string | null })?.activeId) ?? null);
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
      await callAi({ action: "list" }, code).catch(() => {});
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

  const runHealthCheck = async (manual = false) => {
    try {
      await Promise.all([
        callAi({ action: "check_all" }),
        call({ action: "check_all" }),
      ]);
      if (manual) toast.success("Health check finished");
    } catch {
      /* errors already toasted */
    }
  };

  // Verify every key/model periodically while the panel is open.
  useEffect(() => {
    if (!authed) return;
    runHealthCheck();
    const id = setInterval(() => runHealthCheck(), HEALTH_INTERVAL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);



  const addAccount = async () => {
    if (!label.trim() || !apiKey.trim()) return toast.error("Add a name and API key");
    await call({ action: "add", label: label.trim(), api_key: apiKey.trim() });
    setLabel("");
    setApiKey("");
    toast.success("Firecrawl account added");
  };

  const addAiKey = async () => {
    if (!aiLabel.trim() || !aiApiKey.trim()) return toast.error("Add a name and API key");
    await callAi({
      action: "add",
      label: aiLabel.trim(),
      api_key: aiApiKey.trim(),
      base_url: aiBaseUrl.trim(),
      model: aiModel.trim(),
    });
    setAiLabel("");
    setAiApiKey("");
    toast.success("AI key added");
  };

  if (!authed) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <Seo title="Admin — Local News" description="Admin panel" path="/admin" lang="en" noindex />
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
      <Seo title="Admin — API accounts" description="Manage API accounts" path="/admin" lang="en" noindex />
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Admin panel</h1>
        <div className="flex items-center gap-2">
          <Button variant="secondary" disabled={loading} onClick={() => runHealthCheck(true)}>
            {loading ? "Checking…" : "Check all keys"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              sessionStorage.removeItem(PASS_KEY);
              setAuthed(false);
            }}
          >
            Sign out
          </Button>
        </div>
      </header>

      <Tabs defaultValue="ai">
        <TabsList>
          <TabsTrigger value="ai">AI keys</TabsTrigger>
          <TabsTrigger value="firecrawl">Firecrawl</TabsTrigger>
        </TabsList>

        <TabsContent value="ai" className="space-y-4 pt-4">
          <Card className="p-5 space-y-3">
            <h2 className="font-medium">Add an AI key</h2>
            <p className="text-sm text-muted-foreground">
              Keys are used top to bottom. When one hits its limit it is marked exhausted and the
              next one takes over automatically. Any OpenAI-compatible provider works — just set its
              base URL and model.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input placeholder="Key name" value={aiLabel} onChange={(e) => setAiLabel(e.target.value)} />
              <Input placeholder="API key" value={aiApiKey} onChange={(e) => setAiApiKey(e.target.value)} />
              <Input placeholder="Base URL" value={aiBaseUrl} onChange={(e) => setAiBaseUrl(e.target.value)} />
              <Input placeholder="Model" value={aiModel} onChange={(e) => setAiModel(e.target.value)} />
            </div>
            <Button onClick={addAiKey} disabled={loading}>Add key</Button>
          </Card>

          {aiKeys.length === 0 && <p className="text-sm text-muted-foreground">No AI keys yet.</p>}
          {aiKeys.map((k) => (
            <Card key={k.id} className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="font-medium flex items-center gap-2">
                    {k.label}
                    <span className="text-xs text-muted-foreground">{k.key_preview}</span>
                    {k.id === activeAiId && <Badge>Currently in use</Badge>}
                    {k.exhausted_at && <Badge variant="destructive">Limit reached</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground break-all">
                    {k.model} · {k.base_url}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {k.is_active ? "Active" : "Paused"}
                    {k.last_used_at && ` · last used ${new Date(k.last_used_at).toLocaleString()}`}
                  </div>
                  <HealthLine item={k} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{k.is_active ? "On" : "Off"}</span>
                  <Switch
                    checked={k.is_active}
                    disabled={loading}
                    onCheckedChange={(v) => callAi({ action: "toggle", id: k.id, is_active: v })}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" disabled={loading}
                  onClick={async () => {
                    const res = (await callAi({ action: "test", id: k.id })) as {
                      tested?: boolean; status?: number; latencyMs?: number; details?: string;
                    };
                    toast[res?.tested ? "success" : "error"](
                      res?.tested
                        ? `Key works · HTTP ${res.status} · ${res.latencyMs} ms`
                        : `Key failed · HTTP ${res?.status ?? 0}`,
                      { description: res?.tested ? undefined : res?.details },
                    );
                  }}>
                  Test
                </Button>
                {k.exhausted_at && (
                  <Button size="sm" variant="secondary" disabled={loading}
                    onClick={() => callAi({ action: "reset", id: k.id })}>
                    Reset limit
                  </Button>
                )}
                <Button size="sm" variant="destructive" disabled={loading}
                  onClick={() => callAi({ action: "delete", id: k.id })}>
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="firecrawl" className="space-y-4 pt-4">
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

          {accounts.length === 0 && (
            <p className="text-sm text-muted-foreground">No backup accounts yet.</p>
          )}
          {accounts.map((a) => (
            <Card key={a.id} className="p-4 flex flex-wrap items-center gap-3 justify-between">
              <div className="space-y-1">
                <div className="font-medium">
                  {a.label} <span className="text-xs text-muted-foreground">{a.key_preview}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {a.exhausted_at ? "Limit reached / failed" : a.is_active ? "Active" : "Paused"}
                  {a.last_used_at && ` · last used ${new Date(a.last_used_at).toLocaleString()}`}
                </div>
                <HealthLine item={a} />
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
        </TabsContent>
      </Tabs>
    </main>
  );
};

export default Admin;
