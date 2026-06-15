import React from "react";
import { Link } from "wouter";
import { FileText, ChevronRight, BarChart3, AlertCircle, FileSearch, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useListPolicies, useGetPolicyStats } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function PoliciesHistoryPage() {
  const { data: policies, isLoading: isLoadingPolicies, isError: isErrorPolicies } = useListPolicies();
  const { data: stats, isLoading: isLoadingStats } = useGetPolicyStats();

  const renderDifficultyBadge = (scoreStr: string) => {
    // Basic extraction assuming format "X/10 - Text"
    const score = parseInt(scoreStr.split('/')[0]);
    if (isNaN(score)) return <Badge variant="outline">{scoreStr}</Badge>;
    
    if (score <= 4) return <Badge className="bg-green-100 text-green-800 hover:bg-green-200 border-green-200">{scoreStr}</Badge>;
    if (score <= 7) return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-200">{scoreStr}</Badge>;
    return <Badge className="bg-red-100 text-red-800 hover:bg-red-200 border-red-200">{scoreStr}</Badge>;
  };

  return (
    <Layout>
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">Policy History</h1>
            <p className="text-muted-foreground">All your analyzed insurance documents in one place.</p>
          </div>
          <Link href="/" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
            Upload New Policy
          </Link>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-primary/5 border-primary/10 shadow-sm">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-full text-primary">
                <FileSearch className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Total Analyzed</p>
                <h3 className="text-2xl font-bold">
                  {isLoadingStats ? <Skeleton className="h-8 w-16" /> : stats?.total_policies || 0}
                </h3>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-primary/5 border-primary/10 shadow-sm">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-full text-primary">
                <BarChart3 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Avg. Claim Difficulty</p>
                <h3 className="text-xl font-bold">
                  {isLoadingStats ? <Skeleton className="h-8 w-24" /> : stats?.avg_difficulty_score || "N/A"}
                </h3>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-primary/5 border-primary/10 shadow-sm">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-full text-primary">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Policy Types</p>
                <div className="flex gap-2 flex-wrap mt-1">
                  {isLoadingStats ? (
                    <Skeleton className="h-6 w-full" />
                  ) : (
                    stats?.policy_types?.map(pt => (
                      <span key={pt.type} className="text-xs bg-background border px-2 py-1 rounded-md text-muted-foreground">
                        {pt.type} ({pt.count})
                      </span>
                    )) || <span className="text-sm">None yet</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* List Section */}
        <h2 className="text-xl font-semibold mt-10 mb-4">Analyzed Documents</h2>
        
        {isLoadingPolicies ? (
          <div className="grid gap-4">
            {[1, 2, 3].map(i => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6 flex justify-between items-center">
                  <div className="space-y-3 flex-1">
                    <Skeleton className="h-6 w-1/3" />
                    <Skeleton className="h-4 w-1/4" />
                  </div>
                  <Skeleton className="h-10 w-10 rounded-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : isErrorPolicies ? (
          <Card className="bg-destructive/5 border-destructive/20">
            <CardContent className="flex flex-col items-center justify-center p-10 text-center">
              <AlertCircle className="w-10 h-10 text-destructive mb-4" />
              <h3 className="text-lg font-medium text-destructive mb-2">Failed to load policies</h3>
              <p className="text-muted-foreground">There was an error fetching your history. Please try refreshing.</p>
            </CardContent>
          </Card>
        ) : policies?.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center p-16 text-center">
              <FileText className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
              <h3 className="text-xl font-medium mb-2">No policies yet</h3>
              <p className="text-muted-foreground mb-6 max-w-md">
                You haven't uploaded any insurance policies yet. Upload your first PDF to get a plain-English breakdown.
              </p>
              <Link href="/" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">
                Upload Policy
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {policies?.map((policy) => (
              <Link key={policy.id} href={`/policies/${policy.id}`}>
                <Card className="group cursor-pointer hover:border-primary/50 hover:shadow-md transition-all duration-200">
                  <CardContent className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-muted rounded-lg group-hover:bg-primary/10 group-hover:text-primary transition-colors mt-1 sm:mt-0">
                        <FileText className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold group-hover:text-primary transition-colors">
                          {policy.policy_name}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-muted-foreground">
                          <Badge variant="secondary" className="font-normal">{policy.policy_type}</Badge>
                          <span>•</span>
                          <span>{new Date(policy.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 self-start sm:self-center ml-14 sm:ml-0">
                      <div className="text-right hidden sm:block">
                        <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-semibold">Difficulty</p>
                        {renderDifficultyBadge(policy.claim_difficulty_score)}
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
