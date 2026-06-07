import { AlertCircle, DollarSign, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { getPricing, recalculateCosts, setPricing } from "../../api/admin";
import LoadingSpinner from "../../components/LoadingSpinner";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Separator } from "../../components/ui/separator";
import type { TokenPricing } from "../../types";

export default function PricingPage() {
  const [pricing, setPricingState] = useState<TokenPricing | null>(null);
  const [inputPrice, setInputPrice] = useState("");
  const [outputPrice, setOutputPrice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recalcMsg, setRecalcMsg] = useState<string | null>(null);

  useEffect(() => {
    getPricing()
      .then((res) => {
        setPricingState(res.data);
        if (res.data) {
          setInputPrice(String(res.data.input_price_per_1k));
          setOutputPrice(String(res.data.output_price_per_1k));
        }
      })
      .catch(() => setError("Failed to load pricing"))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await setPricing(parseFloat(inputPrice), parseFloat(outputPrice));
      setPricingState(res.data);
    } catch {
      setError("Failed to update pricing");
    } finally {
      setSaving(false);
    }
  };

  const handleRecalculate = async () => {
    setRecalculating(true);
    setRecalcMsg(null);
    try {
      const res = await recalculateCosts();
      setRecalcMsg(res.data.detail);
    } catch {
      setError("Failed to recalculate costs");
    } finally {
      setRecalculating(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading pricing..." />;

  return (
    <div className="space-y-6 max-w-lg">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <DollarSign className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold leading-none">Pricing Plans</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage subscription tiers and pricing</p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Current Pricing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {pricing && (
            <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Input</span>
                <span className="font-medium tabular-nums">
                  ${pricing.input_price_per_1k} / 1K tokens
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Output</span>
                <span className="font-medium tabular-nums">
                  ${pricing.output_price_per_1k} / 1K tokens
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t">
                <span className="text-muted-foreground text-xs">Effective from</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(pricing.effective_from).toLocaleString()}
                </span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Input price ($ / 1K tokens)</Label>
                <Input
                  type="number"
                  step="0.0001"
                  min="0"
                  value={inputPrice}
                  onChange={(e) => setInputPrice(e.target.value)}
                  placeholder="0.0030"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Output price ($ / 1K tokens)</Label>
                <Input
                  type="number"
                  step="0.0001"
                  min="0"
                  value={outputPrice}
                  onChange={(e) => setOutputPrice(e.target.value)}
                  placeholder="0.0150"
                  required
                />
              </div>
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Update Pricing"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
            Recalculate Costs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Recompute <code className="text-xs bg-muted px-1 py-0.5 rounded">total_cost</code> for
            all existing applications using the current pricing rates.
          </p>

          <Separator />

          {recalcMsg && (
            <Alert variant="success">
              <AlertDescription>{recalcMsg}</AlertDescription>
            </Alert>
          )}

          <Button variant="warning" disabled={recalculating} onClick={handleRecalculate}>
            {recalculating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Recalculating…
              </>
            ) : (
              "Recalculate All Costs"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
