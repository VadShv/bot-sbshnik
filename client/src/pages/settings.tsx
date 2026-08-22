import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Header } from "@/components/Header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Check, FlaskConical } from "lucide-react";

const PROMPT_KEYS = ["analyze_system", "wolf_system", "fitguard_system", "aidetector_system", "deepscan_system", "pipeline_system", "chat_system"] as const;
const PROMPT_LABELS: Record<string, string> = {
  analyze_system: "Базовый анализ", wolf_system: "Wolf Detector", fitguard_system: "Team Fit",
  aidetector_system: "AI-детектор", deepscan_system: "GitHub DeepScan", pipeline_system: "Пайплайн", chat_system: "Чат-ассистент",
};
const THRESHOLD_FIELDS: { key: string; label: string }[] = [
  { key: "gapMonths", label: "Перерыв между работами (мес)" },
  { key: "overlapMonths", label: "Нахлест параллельных работ (мес)" },
  { key: "shortStintMonths", label: "Короткий контракт < N мес" },
  { key: "jobHoppingCount", label: "Кол-во коротких контрактов (job-hopping)" },
  { key: "stackInflationCount", label: "Технологий для стек-инфляции" },
  { key: "seniorMinYears", label: "Мин. стаж для senior (лет)" },
  { key: "kpiPercent", label: "Порог KPI (%)" },
  { key: "kpiTimes", label: "Порог KPI «в N раз»" },
  { key: "aiDetectorThreshold", label: "Порог AI-детектора" },
  { key: "csRejectBelow", label: "CS ниже → NOT_RECOMMENDED" },
  { key: "csRecommendAbove", label: "CS выше → RECOMMENDED" },
];
const TOGGLE_FIELDS: { key: string; label: string }[] = [
  { key: "etcVerification", label: "Верификация опыта (резюме × ЭТК)" },
  { key: "detectors", label: "Детерминированные детекторы" },
  { key: "linguistic", label: "Лингвистический аудит" },
  { key: "aiDetector", label: "AI-детектор" },
  { key: "wolfAudit", label: "Wolf Detector" },
  { key: "teamFit", label: "Team Fit" },
  { key: "githubDeepScan", label: "GitHub DeepScan" },
];

function useSettings() {
  return useQuery<any>({ queryKey: ["/api/settings"] });
}

export default function Settings() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="mb-6 text-2xl font-bold">Личный кабинет</h1>
        <Tabs defaultValue="providers">
          <TabsList className="flex flex-wrap">
            <TabsTrigger value="providers">Провайдеры</TabsTrigger>
            <TabsTrigger value="prompts">Промпты</TabsTrigger>
            <TabsTrigger value="thresholds">Пороги</TabsTrigger>
            <TabsTrigger value="toggles">Тогглы</TabsTrigger>
            <TabsTrigger value="jd">Вакансии</TabsTrigger>
            <TabsTrigger value="audit">Журнал</TabsTrigger>
            <TabsTrigger value="test">Тест-прогон</TabsTrigger>
          </TabsList>
          <TabsContent value="providers"><ProvidersTab /></TabsContent>
          <TabsContent value="prompts"><PromptsTab /></TabsContent>
          <TabsContent value="thresholds"><ThresholdsTab /></TabsContent>
          <TabsContent value="toggles"><TogglesTab /></TabsContent>
          <TabsContent value="jd"><JdTab /></TabsContent>
          <TabsContent value="audit"><AuditTab /></TabsContent>
          <TabsContent value="test"><TestRunTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function ProvidersTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useSettings();
  const { toast } = useToast();
  const [form, setForm] = useState({ name: "", protocol: "openai-compatible", endpoint: "", model: "", folderId: "", apiKey: "" });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/settings"] });
  const createMut = useMutation({
    mutationFn: (b: any) => apiRequest("POST", "/api/settings/providers", b).then((r) => r.json()),
    onSuccess: () => { invalidate(); toast({ title: "Провайдер добавлен" }); setForm({ name: "", protocol: "openai-compatible", endpoint: "", model: "", folderId: "", apiKey: "" }); },
    onError: (e: any) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });
  const act = (id: string) => apiRequest("POST", `/api/settings/providers/${id}/activate`, {}).then(() => invalidate());
  const fb = (id: string) => apiRequest("POST", `/api/settings/providers/${id}/fallback`, {}).then(() => invalidate());
  const del = (id: string) => apiRequest("DELETE", `/api/settings/providers/${id}`).then(() => invalidate());

  if (isLoading) return <Loader2 className="animate-spin" />;
  const providers: any[] = data?.providers || [];
  const active = data?.activeProviderId;
  const fallback = data?.fallbackProviderId;

  return (
    <Card className="p-4 space-y-4">
      <div>
        <h2 className="font-semibold mb-2">Провайдеры LLM</h2>
        <div className="space-y-2">
          {providers.length === 0 && <p className="text-sm text-muted-foreground">Нет провайдеров. Добавьте Yandex или Cloud.ru.</p>}
          {providers.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm">
              <span className="font-medium">{p.name}</span>
              <Badge variant="outline">{p.protocol}</Badge>
              <span className="text-muted-foreground">{p.model}</span>
              <span className="font-mono text-xs text-muted-foreground">{p.apiKeyDisplay}</span>
              {p.id === active && <Badge>активный</Badge>}
              {p.id === fallback && <Badge variant="secondary">fallback</Badge>}
              <div className="ml-auto flex gap-1">
                <Button size="sm" variant={p.id === active ? "default" : "outline"} onClick={() => act(p.id)}>Активный</Button>
                <Button size="sm" variant={p.id === fallback ? "default" : "outline"} onClick={() => fb(p.id)}>Fallback</Button>
                <Button size="sm" variant="ghost" onClick={() => del(p.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-md border p-3 space-y-2">
        <h3 className="font-medium text-sm">Новый провайдер</h3>
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="Название (Cloud.ru)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Select value={form.protocol} onValueChange={(v) => setForm({ ...form, protocol: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="openai-compatible">openai-compatible</SelectItem>
              <SelectItem value="yandex-native">yandex-native</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="Endpoint (https://...)" value={form.endpoint} onChange={(e) => setForm({ ...form, endpoint: e.target.value })} />
          <Input placeholder="Модель (yandexgpt / gpt-4o)" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
          <Input placeholder="Folder ID (для Yandex, иначе пусто)" value={form.folderId} onChange={(e) => setForm({ ...form, folderId: e.target.value })} />
          <Input placeholder="API-ключ" type="password" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} />
        </div>
        <Button onClick={() => createMut.mutate({ ...form, folderId: form.folderId || null, apiKey: form.apiKey || undefined })} disabled={createMut.isPending}>
          <Plus className="h-4 w-4 mr-1" /> Добавить
        </Button>
      </div>
    </Card>
  );
}

function PromptsTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [key, setKey] = useState<string>("analyze_system");
  const [content, setContent] = useState("");
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/settings/prompts", key] });
  const versions: any[] = data || [];
  const active = versions.find((v) => v.isActive);

  useEffect(() => {
    if (active) setContent(active.content);
  }, [active?.id]); // eslint-disable-line

  const saveMut = useMutation({
    mutationFn: (c: string) => apiRequest("POST", `/api/settings/prompts/${key}`, { content: c }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/settings/prompts", key] }); toast({ title: "Версия сохранена и активирована" }); },
    onError: (e: any) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });
  const activate = (v: number) => apiRequest("POST", `/api/settings/prompts/${key}/versions/${v}/activate`, {}).then(() => qc.invalidateQueries({ queryKey: ["/api/settings/prompts", key] }));

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Label>Промпт:</Label>
        <Select value={key} onValueChange={setKey}>
          <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PROMPT_KEYS.map((k) => <SelectItem key={k} value={k}>{PROMPT_LABELS[k]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {isLoading ? <Loader2 className="animate-spin" /> : (
        <>
          <Textarea className="font-mono text-xs min-h-[320px]" value={content} onChange={(e) => setContent(e.target.value)} />
          <Button onClick={() => saveMut.mutate(content)} disabled={saveMut.isPending || !content.trim()}>
            <Check className="h-4 w-4 mr-1" /> Сохранить как новую версию
          </Button>
          <div>
            <h3 className="font-medium text-sm mb-1">Версии</h3>
            <div className="space-y-1">
              {versions.map((v) => (
                <div key={v.id} className="flex items-center gap-2 text-sm">
                  <span>v{v.version}</span>
                  {v.isActive && <Badge>активна</Badge>}
                  <span className="text-muted-foreground text-xs">{new Date(v.createdAt).toLocaleString()}</span>
                  {!v.isActive && <Button size="sm" variant="outline" onClick={() => activate(v.version)}>Активировать</Button>}
                </div>
              ))}
              {versions.length === 0 && <p className="text-sm text-muted-foreground">Нет версий — будет использован промпт из кода по умолчанию.</p>}
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

function ThresholdsTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useSettings();
  const { toast } = useToast();
  const [vals, setVals] = useState<Record<string, number>>({});

  useEffect(() => {
    if (data?.thresholds) setVals({ ...data.thresholds });
  }, [data]); // eslint-disable-line

  const saveMut = useMutation({
    mutationFn: (b: any) => apiRequest("PUT", "/api/settings/thresholds", b).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/settings"] }); toast({ title: "Пороги сохранены" }); },
    onError: (e: any) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <Loader2 className="animate-spin" />;
  return (
    <Card className="p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {THRESHOLD_FIELDS.map((f) => (
          <div key={f.key} className="space-y-1">
            <Label className="text-xs">{f.label}</Label>
            <Input type="number" value={vals[f.key] ?? 0} onChange={(e) => setVals({ ...vals, [f.key]: Number(e.target.value) })} />
          </div>
        ))}
      </div>
      <Button onClick={() => saveMut.mutate(vals)} disabled={saveMut.isPending}>Сохранить пороги</Button>
    </Card>
  );
}

function TogglesTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useSettings();
  const { toast } = useToast();
  const [vals, setVals] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (data?.toggles) setVals({ ...data.toggles });
  }, [data]); // eslint-disable-line

  const saveMut = useMutation({
    mutationFn: (b: any) => apiRequest("PUT", "/api/settings/toggles", b).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/settings"] }); toast({ title: "Тогглы сохранены" }); },
    onError: (e: any) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <Loader2 className="animate-spin" />;
  return (
    <Card className="p-4 space-y-3">
      <div className="space-y-2">
        {TOGGLE_FIELDS.map((f) => (
          <div key={f.key} className="flex items-center justify-between rounded-md border p-2">
            <Label>{f.label}</Label>
            <Switch checked={!!vals[f.key]} onCheckedChange={(c) => setVals({ ...vals, [f.key]: c })} />
          </div>
        ))}
      </div>
      <Button onClick={() => saveMut.mutate(vals)} disabled={saveMut.isPending}>Сохранить тогглы</Button>
    </Card>
  );
}

function JdTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useQuery<any[]>({ queryKey: ["/api/settings/jd-templates"] });
  const [form, setForm] = useState({ name: "", content: "" });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/settings/jd-templates"] });
  const createMut = useMutation({
    mutationFn: (b: any) => apiRequest("POST", "/api/settings/jd-templates", b).then((r) => r.json()),
    onSuccess: () => { invalidate(); setForm({ name: "", content: "" }); toast({ title: "Шаблон добавлен" }); },
    onError: (e: any) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });
  const del = (id: string) => apiRequest("DELETE", `/api/settings/jd-templates/${id}`).then(() => invalidate());

  if (isLoading) return <Loader2 className="animate-spin" />;
  return (
    <Card className="p-4 space-y-3">
      <div className="space-y-1">
        {(data || []).map((j) => (
          <div key={j.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
            <span className="font-medium">{j.name}</span>
            <Button size="sm" variant="ghost" onClick={() => del(j.id)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        {(data || []).length === 0 && <p className="text-sm text-muted-foreground">Нет шаблонов.</p>}
      </div>
      <div className="rounded-md border p-3 space-y-2">
        <Input placeholder="Название вакансии" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Textarea placeholder="Требования вакансии (JD)" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
        <Button onClick={() => createMut.mutate(form)} disabled={createMut.isPending || !form.name || !form.content}>
          <Plus className="h-4 w-4 mr-1" /> Добавить шаблон
        </Button>
      </div>
    </Card>
  );
}

function AuditTab() {
  const { data, isLoading } = useQuery<any[]>({ queryKey: ["/api/settings/audit-log"] });
  if (isLoading) return <Loader2 className="animate-spin" />;
  return (
    <Card className="p-4">
      <div className="space-y-1 text-sm">
        {(data || []).map((e) => (
          <div key={e.id} className="rounded-md border p-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{e.action}</Badge>
              <span className="font-mono text-xs">{e.field}</span>
              <span className="ml-auto text-xs text-muted-foreground">{new Date(e.createdAt).toLocaleString()}</span>
            </div>
            <pre className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap break-words">{JSON.stringify(e.diff)}</pre>
          </div>
        ))}
        {(data || []).length === 0 && <p className="text-muted-foreground">Журнал пуст.</p>}
      </div>
    </Card>
  );
}

function TestRunTab() {
  const { toast } = useToast();
  const [resume, setResume] = useState("");
  const [key, setKey] = useState("analyze_system");
  const [runLlm, setRunLlm] = useState(false);
  const [result, setResult] = useState<any>(null);
  const mut = useMutation({
    mutationFn: (b: any) => apiRequest("POST", "/api/settings/test-run", b).then((r) => r.json()),
    onSuccess: setResult,
    onError: (e: any) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Label>Промпт:</Label>
        <Select value={key} onValueChange={setKey}>
          <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent>{PROMPT_KEYS.map((k) => <SelectItem key={k} value={k}>{PROMPT_LABELS[k]}</SelectItem>)}</SelectContent>
        </Select>
        <label className="ml-auto flex items-center gap-2 text-sm">
          <Switch checked={runLlm} onCheckedChange={setRunLlm} /> Вызвать LLM
        </label>
      </div>
      <Textarea placeholder="Вставьте образец резюме…" className="min-h-[160px]" value={resume} onChange={(e) => setResume(e.target.value)} />
      <Button onClick={() => mut.mutate({ resumeText: resume, promptKey: key, runLlm })} disabled={mut.isPending || resume.trim().length < 100}>
        <FlaskConical className="h-4 w-4 mr-1" /> Прогон
      </Button>
      {result && (
        <div className="space-y-2 text-sm">
          <div className="flex gap-3">
            <Badge variant="outline">риски: {result.detectors?.risks}</Badge>
            <Badge variant="outline">накрутка: {result.detectors?.inflation}</Badge>
            <Badge variant="outline">волки: {result.detectors?.wolves}</Badge>
          </div>
          {result.jdTemplate && <div className="text-xs text-muted-foreground">JD: {result.jdTemplate.name}</div>}
          <details><summary className="cursor-pointer font-medium">System-промпт ({result.promptKey})</summary>
            <pre className="mt-1 text-xs whitespace-pre-wrap break-words rounded-md bg-muted p-2">{result.systemPrompt}</pre>
          </details>
          {result.analysis && <details><summary className="cursor-pointer font-medium">LLM-анализ</summary>
            <pre className="mt-1 text-xs whitespace-pre-wrap break-words rounded-md bg-muted p-2">{JSON.stringify(result.analysis, null, 2)}</pre>
          </details>}
        </div>
      )}
    </Card>
  );
}
