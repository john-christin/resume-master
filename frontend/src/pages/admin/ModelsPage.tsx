import axios from "axios";
import { AlertCircle, Bot, Cpu, Loader2, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import {
  activateModel,
  createModel,
  deactivateModel,
  deleteModel,
  getModels,
  testModel,
  updateModel,
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
import type { AIModelConfig } from "../../types";

export default function ModelsPage() {
  const [models, setModels] = useState<AIModelConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      const res = await getModels();
      setModels(res.data);
    } catch {
      setError("Failed to load models");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

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

  const primary = models.find((m) => m.is_active && m.role === "primary");
  const utility = models.find((m) => m.is_active && m.role === "utility");

  if (loading) return <LoadingSpinner message="Loading AI models..." />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
            <Bot className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">AI Models</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Configure LLM providers for resume generation
            </p>
          </div>
        </div>
        <Button onClick={() => openModal()}>
          <Plus className="h-4 w-4" />
          Add Model
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Active model status */}
      <div className="space-y-2">
        {primary ? (
          <Alert variant="success">
            <Cpu className="h-4 w-4" />
            <AlertDescription>
              <span className="font-semibold">Primary</span> — {primary.display_name}{" "}
              <span className="text-muted-foreground text-xs">
                ({primary.provider} / {primary.model_id})
              </span>
            </AlertDescription>
          </Alert>
        ) : (
          <Alert variant="warning">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>No primary model configured. Using environment variable fallback.</AlertDescription>
          </Alert>
        )}
        {utility ? (
          <Alert variant="info">
            <Cpu className="h-4 w-4" />
            <AlertDescription>
              <span className="font-semibold">Utility</span> — {utility.display_name}{" "}
              <span className="text-muted-foreground text-xs">
                ({utility.provider} / {utility.model_id})
              </span>
            </AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <AlertDescription className="text-muted-foreground">
              No utility model configured — extraction tasks will use the primary model.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {models.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Bot className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">No AI models configured</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {models.map((m) => (
            <Card
              key={m.id}
              className={m.is_active ? "border-emerald-300 dark:border-emerald-700" : ""}
            >
              <CardContent className="pt-4 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      m.role === "primary"
                        ? "bg-emerald-500"
                        : m.role === "utility"
                          ? "bg-blue-500"
                          : "bg-muted-foreground/30"
                    }`}
                  />
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
                      {m.role === "primary" && <Badge variant="success">Primary</Badge>}
                      {m.role === "utility" && <Badge variant="info">Utility</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {m.model_id}
                      {m.endpoint && ` · ${m.endpoint}`}
                      {(m.input_price_per_1k > 0 || m.output_price_per_1k > 0) &&
                        ` · $${m.input_price_per_1k}/1K in, $${m.output_price_per_1k}/1K out`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  {m.role !== "primary" && (
                    <Button
                      size="sm"
                      variant="success"
                      onClick={async () => {
                        try {
                          await activateModel(m.id, "primary");
                          await load();
                        } catch {
                          setError("Failed to set as primary");
                        }
                      }}
                    >
                      Set Primary
                    </Button>
                  )}
                  {m.role !== "utility" && (
                    <Button
                      size="sm"
                      variant="info"
                      onClick={async () => {
                        try {
                          await activateModel(m.id, "utility");
                          await load();
                        } catch {
                          setError("Failed to set as utility");
                        }
                      }}
                    >
                      Set Utility
                    </Button>
                  )}
                  {m.is_active && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={async () => {
                        try {
                          await deactivateModel(m.id);
                          await load();
                        } catch {
                          setError("Failed to deactivate model");
                        }
                      }}
                    >
                      Deactivate
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => openModal(m)}>
                    Edit
                  </Button>
                  {!m.is_active && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={async () => {
                        if (!window.confirm(`Delete model "${m.display_name}"?`)) return;
                        try {
                          await deleteModel(m.id);
                          await load();
                        } catch {
                          setError("Failed to delete model");
                        }
                      }}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
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
