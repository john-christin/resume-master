import axios from "axios";
import { AlertCircle, Bot, Loader2, Plus } from "lucide-react";
import PageHeader from "../../components/shared/PageHeader";
import { useEffect, useState } from "react";
import {
  createModel,
  deleteModel,
  getModels,
  getRoleAssignments,
  setRoleAssignment,
  testModel,
  updateModel,
  type AIModelRole,
} from "../../api/admin";
import LoadingSpinner from "../../components/LoadingSpinner";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import type { AIModelConfig, RoleAssignment } from "../../types";

const ROLE_OPTIONS: { value: AIModelRole; label: string }[] = [
  { value: "resume", label: "Resume" },
  { value: "cover_letter", label: "Cover Letter" },
  { value: "jd_parse", label: "JD Parse" },
  { value: "chat", label: "Chat" },
  { value: "utility", label: "Utility" },
];

const ROLE_DOT_COLOR: Record<string, string> = {
  resume: "bg-emerald-500",
  cover_letter: "bg-purple-500",
  jd_parse: "bg-amber-500",
  chat: "bg-blue-500",
  utility: "bg-slate-400",
};

const ROLE_BADGE_VARIANT: Record<string, "success" | "purple" | "warning" | "info" | "secondary"> = {
  resume: "success",
  cover_letter: "purple",
  jd_parse: "warning",
  chat: "info",
  utility: "secondary",
};

export default function ModelsPage() {
  const [models, setModels] = useState<AIModelConfig[]>([]);
  const [assignments, setAssignments] = useState<RoleAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [provider, setProvider] = useState("openai");
  const [displayName, setDisplayName] = useState("");
  const [modelId, setModelId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [apiVersion, setApiVersion] = useState("");
  const [inputPrice, setInputPrice] = useState("");
  const [outputPrice, setOutputPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [testSuccess, setTestSuccess] = useState(false);

  const load = async () => {
    try {
      const [modelsRes, assignmentsRes] = await Promise.all([getModels(), getRoleAssignments()]);
      setModels(modelsRes.data);
      setAssignments(assignmentsRes.data);
    } catch {
      setError("Failed to load models");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleAssign = async (role: AIModelRole, modelConfigId: string | null) => {
    setAssigning(role);
    try {
      await setRoleAssignment(role, modelConfigId);
      await load();
    } catch {
      setError(`Failed to update the ${role} assignment`);
    } finally {
      setAssigning(null);
    }
  };

  const openModal = (m?: AIModelConfig) => {
    setEditingId(m?.id ?? null);
    setProvider(m?.provider ?? "openai");
    setDisplayName(m?.display_name ?? "");
    setModelId(m?.model_id ?? "");
    setApiKey("");
    setEndpoint(m?.endpoint ?? "");
    setApiVersion(m?.api_version ?? "");
    setInputPrice(String(m?.input_price_per_1k ?? ""));
    setOutputPrice(String(m?.output_price_per_1k ?? ""));
    setTestError(null);
    setTestSuccess(false);
    setModalOpen(true);
  };

  const runTest = async () => {
    setTestError(null);
    setTestSuccess(false);
    setTesting(true);
    try {
      await testModel({
        provider,
        display_name: displayName || "test",
        model_id: modelId,
        api_key: apiKey,
        endpoint: endpoint || undefined,
        api_version: apiVersion || undefined,
      });
      setTestSuccess(true);
    } catch (err) {
      let msg = "Connection test failed";
      if (axios.isAxiosError(err) && err.response?.data?.detail)
        msg = String(err.response.data.detail);
      setTestError(msg);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestError(null);
    setTestSuccess(false);

    const shouldTest = !editingId || !!apiKey;
    if (shouldTest) {
      if (!editingId && !apiKey) return;
      setTesting(true);
      try {
        await testModel({
          provider,
          display_name: displayName,
          model_id: modelId,
          api_key: apiKey,
          endpoint: endpoint || undefined,
          api_version: apiVersion || undefined,
        });
      } catch (err) {
        let msg = "Connection test failed";
        if (axios.isAxiosError(err) && err.response?.data?.detail)
          msg = String(err.response.data.detail);
        setTestError(msg);
        setTesting(false);
        return;
      }
      setTesting(false);
    }

    setSaving(true);
    try {
      if (editingId) {
        await updateModel(editingId, {
          display_name: displayName,
          model_id: modelId,
          ...(apiKey ? { api_key: apiKey } : {}),
          endpoint: endpoint || undefined,
          api_version: apiVersion || undefined,
          input_price_per_1k: parseFloat(inputPrice) || 0,
          output_price_per_1k: parseFloat(outputPrice) || 0,
        });
      } else {
        await createModel({
          provider,
          display_name: displayName,
          model_id: modelId,
          api_key: apiKey,
          endpoint: endpoint || undefined,
          api_version: apiVersion || undefined,
          input_price_per_1k: parseFloat(inputPrice) || 0,
          output_price_per_1k: parseFloat(outputPrice) || 0,
        });
      }
      setModalOpen(false);
      setError(null);
      await load();
    } catch {
      setError(editingId ? "Failed to update model" : "Failed to create model");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading AI models..." />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Models"
        description="Configure AI model settings"
        actions={<Button onClick={() => openModal()}><Plus className="h-4 w-4" />Add Model</Button>}
      />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Role assignments — pick which model serves each function. The same
          model can be picked for more than one role. */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <p className="text-sm font-semibold text-foreground">Role Assignments</p>
          {ROLE_OPTIONS.map(({ value, label }) => {
            const a = assignments.find((x) => x.role === value);
            return (
              <div key={value} className="flex items-center gap-3">
                <div className="w-32 shrink-0 flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${ROLE_DOT_COLOR[value]}`} />
                  <span className="text-sm font-medium">{label}</span>
                </div>
                <Select
                  value={a?.ai_model_config_id ?? "none"}
                  disabled={assigning === value}
                  onValueChange={(v) => handleAssign(value, v === "none" ? null : v)}
                >
                  <SelectTrigger className="h-8 text-xs w-[280px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs">
                      None{value !== "resume" ? " — falls back to Resume" : ""}
                    </SelectItem>
                    {models.map((m) => (
                      <SelectItem key={m.id} value={m.id} className="text-xs">
                        {m.display_name}
                        <span className="ml-1.5 text-muted-foreground">· {m.provider}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {models.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Bot className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">No AI models configured</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {models.map((m) => {
            const rolesForModel = assignments.filter((a) => a.ai_model_config_id === m.id);
            return (
              <Card
                key={m.id}
                className={rolesForModel.length > 0 ? "border-emerald-300 dark:border-emerald-700" : ""}
              >
                <CardContent className="pt-4 flex items-center justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{m.display_name}</span>
                      <Badge
                        variant={
                          m.provider === "openai"
                            ? "success"
                            : m.provider === "azure_openai"
                              ? "info"
                              : m.provider === "anthropic"
                                ? "warning"
                                : "purple"
                        }
                      >
                        {m.provider === "azure_openai"
                          ? "Azure OpenAI"
                          : m.provider === "openai"
                            ? "OpenAI"
                            : m.provider === "anthropic"
                              ? "Anthropic"
                              : "Google"}
                      </Badge>
                      {rolesForModel.map((a) => (
                        <Badge key={a.role} variant={ROLE_BADGE_VARIANT[a.role] ?? "secondary"}>
                          {ROLE_OPTIONS.find((r) => r.value === a.role)?.label ?? a.role}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {m.model_id}
                      {m.endpoint && ` · ${m.endpoint}`}
                      {(m.input_price_per_1k > 0 || m.output_price_per_1k > 0) &&
                        ` · $${m.input_price_per_1k}/1K in, $${m.output_price_per_1k}/1K out`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    <Button size="sm" variant="outline" onClick={() => openModal(m)}>
                      Edit
                    </Button>
                    {rolesForModel.length === 0 && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={async () => {
                          if (!window.confirm(`Delete model "${m.display_name}"?`)) return;
                          try {
                            await deleteModel(m.id);
                            await load();
                          } catch (err) {
                            let msg = "Failed to delete model";
                            if (axios.isAxiosError(err) && err.response?.data?.detail)
                              msg = String(err.response.data.detail);
                            setError(msg);
                          }
                        }}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Model" : "Add Model"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Provider</Label>
                <Select
                  value={provider}
                  onValueChange={setProvider}
                  disabled={!!editingId}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="azure_openai">Azure OpenAI</SelectItem>
                    <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                    <SelectItem value="google">Google (Gemini)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Display Name</Label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. GPT-4o"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Model ID</Label>
                <Input
                  value={modelId}
                  onChange={(e) => setModelId(e.target.value)}
                  placeholder="e.g. gpt-4o"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>
                  API Key
                  {editingId && (
                    <span className="text-muted-foreground font-normal">
                      {" "}(leave blank to keep)
                    </span>
                  )}
                </Label>
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={editingId ? "••••••••" : "sk-…"}
                  required={!editingId}
                />
              </div>
            </div>

            <div className={provider === "azure_openai" ? "grid grid-cols-2 gap-4" : ""}>
              <div className="space-y-1.5">
                <Label>
                  Endpoint
                  {provider !== "azure_openai" && (
                    <span className="text-muted-foreground font-normal"> (optional)</span>
                  )}
                </Label>
                <Input
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  placeholder={
                    provider === "azure_openai"
                      ? "https://your-resource.openai.azure.com"
                      : "https://api.openai.com/v1"
                  }
                  required={provider === "azure_openai"}
                />
              </div>
              {provider === "azure_openai" && (
                <div className="space-y-1.5">
                  <Label>API Version</Label>
                  <Input
                    value={apiVersion}
                    onChange={(e) => setApiVersion(e.target.value)}
                    placeholder="2024-10-21"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Input Price / 1K tokens ($)</Label>
                <Input
                  type="number"
                  step="0.0001"
                  min="0"
                  value={inputPrice}
                  onChange={(e) => setInputPrice(e.target.value)}
                  placeholder="0.003"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Output Price / 1K tokens ($)</Label>
                <Input
                  type="number"
                  step="0.0001"
                  min="0"
                  value={outputPrice}
                  onChange={(e) => setOutputPrice(e.target.value)}
                  placeholder="0.015"
                />
              </div>
            </div>

            {testError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-medium">Connection Failed</p>
                  <p className="text-xs mt-1 break-all">{testError}</p>
                </AlertDescription>
              </Alert>
            )}
            {testSuccess && (
              <Alert variant="success">
                <AlertDescription>Connection successful! Model is reachable.</AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={testing || saving || (!apiKey && !editingId)}
                onClick={runTest}
              >
                {testing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Testing…
                  </>
                ) : (
                  "Test Connection"
                )}
              </Button>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || testing}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : editingId ? (
                  "Update"
                ) : (
                  "Add Model"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
