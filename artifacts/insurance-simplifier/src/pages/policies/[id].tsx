import { useState, useRef, useCallback } from "react";
import { useParams, Link } from "wouter";
import { useGetPolicy, getGetPolicyQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowLeft, CheckCircle2, XCircle, Info, FileText, FileWarning, HelpCircle, Volume2, VolumeX, Loader2 } from "lucide-react";

const LANGUAGES = [
  { code: "en", label: "English", speechLang: "en-IN" },
  { code: "hi", label: "हिंदी", speechLang: "hi-IN" },
  { code: "mr", label: "मराठी", speechLang: "mr-IN" },
];

function VoiceExplainer({ policyId }: { policyId: number }) {
  const [selectedLang, setSelectedLang] = useState("en");
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  const listen = useCallback(async () => {
    if (isSpeaking) { stop(); return; }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/policies/${policyId}/explain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: selectedLang }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Failed to generate explanation");
      }

      const data = await res.json() as { text: string; language: string };

      const lang = LANGUAGES.find(l => l.code === selectedLang);
      const utterance = new SpeechSynthesisUtterance(data.text);
      utterance.lang = lang?.speechLang ?? "en-IN";
      utterance.rate = 0.9;
      utterance.pitch = 1;

      // Try to find a matching voice
      const voices = window.speechSynthesis.getVoices();
      const match = voices.find(v => v.lang.startsWith(lang?.speechLang?.split("-")[0] ?? "en"));
      if (match) utterance.voice = match;

      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      utteranceRef.current = utterance;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
      setIsSpeaking(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }, [isSpeaking, selectedLang, policyId, stop]);

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-primary text-base">
          <Volume2 className="w-5 h-5" />
          Listen to Explanation
        </CardTitle>
        <CardDescription>
          Get a spoken summary of this policy in your preferred language
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Language selector */}
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map(lang => (
            <button
              key={lang.code}
              data-testid={`lang-${lang.code}`}
              onClick={() => { setSelectedLang(lang.code); stop(); setError(null); }}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
                selectedLang === lang.code
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>

        {/* Play/stop button */}
        <div className="flex items-center gap-3">
          <Button
            data-testid="btn-listen"
            onClick={listen}
            disabled={isLoading}
            className="gap-2"
            variant={isSpeaking ? "outline" : "default"}
          >
            {isLoading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
            ) : isSpeaking ? (
              <><VolumeX className="w-4 h-4" /> Stop</>
            ) : (
              <><Volume2 className="w-4 h-4" /> Listen</>
            )}
          </Button>

          {isSpeaking && (
            <div className="flex items-center gap-1.5 text-sm text-primary">
              <span className="flex gap-0.5 items-end h-4">
                {[...Array(4)].map((_, i) => (
                  <span
                    key={i}
                    className="w-1 bg-primary rounded-sm animate-pulse"
                    style={{ height: `${40 + i * 20}%`, animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </span>
              Speaking…
            </div>
          )}
        </div>

        {error && (
          <p className="text-sm text-destructive flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function PolicyDetailPage() {
  const params = useParams();
  const policyId = params.id ? parseInt(params.id) : 0;

  const { data: policy, isLoading, isError } = useGetPolicy(policyId, {
    query: {
      enabled: !!policyId,
      queryKey: getGetPolicyQueryKey(policyId),
    },
  });

  if (!policyId) {
    return (
      <Layout>
        <div className="text-center py-20">
          <h2 className="text-2xl font-bold mb-4">Invalid Policy ID</h2>
          <Link href="/policies" className="text-primary hover:underline flex items-center justify-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to History
          </Link>
        </div>
      </Layout>
    );
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-6 animate-pulse">
          <Skeleton className="h-8 w-32 mb-8" />
          <div className="bg-card rounded-xl p-8 border">
            <Skeleton className="h-10 w-2/3 mb-4" />
            <Skeleton className="h-6 w-1/4 mb-8" />
            <Skeleton className="h-24 w-full" />
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <Skeleton className="h-64 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        </div>
      </Layout>
    );
  }

  if (isError || !policy) {
    return (
      <Layout>
        <div className="text-center py-20">
          <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Policy not found</h2>
          <p className="text-muted-foreground mb-6">We couldn't find the requested policy analysis.</p>
          <Link href="/policies" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to History
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">

        {/* Navigation */}
        <Link href="/policies" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to all policies
        </Link>

        {/* Header Hero Section */}
        <div className="bg-gradient-to-br from-primary/10 to-transparent rounded-3xl p-8 md:p-12 border border-primary/10 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <FileText className="w-48 h-48" />
          </div>
          <div className="relative z-10 flex flex-col md:flex-row gap-8 justify-between items-start md:items-center">
            <div className="space-y-4 max-w-2xl">
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="bg-background/80 backdrop-blur text-sm py-1 px-3">
                  {policy.policy_type}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {new Date(policy.created_at).toLocaleDateString()}
                </span>
              </div>
              <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-foreground leading-tight">
                {policy.policy_name}
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
                {policy.simple_explanation}
              </p>
            </div>
            <Card className="bg-background/80 backdrop-blur-md border-primary/20 shrink-0 w-full md:w-auto">
              <CardContent className="p-6 text-center">
                <p className="text-sm text-muted-foreground font-semibold uppercase tracking-wider mb-2">Claim Difficulty</p>
                <div className="text-3xl font-bold text-foreground">
                  {policy.claim_difficulty_score}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Voice Explainer */}
        <VoiceExplainer policyId={policyId} />

        {/* Important Warnings Banner */}
        {policy.important_warnings && policy.important_warnings.length > 0 && (
          <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-amber-800 dark:text-amber-500 flex items-center gap-2 text-lg">
                <FileWarning className="w-5 h-5" />
                Important Warnings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {policy.important_warnings.map((warning, idx) => (
                  <li key={idx} className="flex gap-3 text-amber-900/80 dark:text-amber-200/80 leading-relaxed">
                    <span className="text-amber-500 mt-1">•</span>
                    <span>{warning}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Coverage + Exclusions */}
        <div className="grid md:grid-cols-2 gap-8">
          <Card className="shadow-sm border-primary/5 flex flex-col">
            <CardHeader className="bg-green-50/50 dark:bg-green-950/10 border-b pb-4">
              <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-500">
                <CheckCircle2 className="w-5 h-5" />
                What's Covered
              </CardTitle>
              <CardDescription>The main situations where this policy protects you.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 flex-1">
              {policy.coverage && policy.coverage.length > 0 ? (
                <ul className="space-y-4">
                  {policy.coverage.map((item, idx) => (
                    <li key={idx} className="flex gap-3 text-foreground leading-relaxed">
                      <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground italic">No coverage details found.</p>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-primary/5 flex flex-col">
            <CardHeader className="bg-red-50/50 dark:bg-red-950/10 border-b pb-4">
              <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-500">
                <XCircle className="w-5 h-5" />
                What's NOT Covered (Exclusions)
              </CardTitle>
              <CardDescription>Pay attention to these. The insurer will not pay for these scenarios.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 flex-1">
              {policy.exclusions && policy.exclusions.length > 0 ? (
                <ul className="space-y-4">
                  {policy.exclusions.map((item, idx) => (
                    <li key={idx} className="flex gap-3 text-foreground leading-relaxed">
                      <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground italic">No exclusions found.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Claim Process + Waiting Periods */}
        <div className="grid md:grid-cols-5 gap-8">
          <Card className="md:col-span-3 shadow-sm border-primary/5">
            <CardHeader className="bg-primary/5 border-b pb-4">
              <CardTitle className="flex items-center gap-2 text-primary">
                <Info className="w-5 h-5" />
                How to Claim
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {policy.claim_process && policy.claim_process.length > 0 ? (
                <div className="relative border-l-2 border-primary/20 ml-3 pl-6 space-y-8 py-2">
                  {policy.claim_process.map((step, idx) => (
                    <div key={idx} className="relative">
                      <div className="absolute -left-[35px] bg-background border-2 border-primary text-primary w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">
                        {idx + 1}
                      </div>
                      <p className="text-foreground leading-relaxed pt-0.5">{step}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground italic">No claim process details found.</p>
              )}
            </CardContent>
          </Card>

          <Card className="md:col-span-2 shadow-sm border-primary/5">
            <CardHeader className="bg-primary/5 border-b pb-4">
              <CardTitle className="flex items-center gap-2 text-primary">
                <HelpCircle className="w-5 h-5" />
                Waiting Periods
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {policy.waiting_periods && policy.waiting_periods.length > 0 ? (
                <ul className="space-y-4">
                  {policy.waiting_periods.map((item, idx) => (
                    <li key={idx} className="flex gap-3 text-foreground leading-relaxed bg-muted/50 p-3 rounded-lg border border-border/50">
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex flex-col items-center justify-center text-center h-full text-muted-foreground p-4">
                  <CheckCircle2 className="w-8 h-8 text-green-500 mb-2 opacity-50" />
                  <p>No waiting periods found. Your coverage likely starts immediately.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </Layout>
  );
}
