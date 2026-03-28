import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertCircle, Loader2, Eye } from "lucide-react";
import type { IfoxQualityCheck } from "@shared/schema";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

type FilterType = "all" | "passed" | "failed";

export default function QualityChecksTab() {
  const [selectedCheck, setSelectedCheck] = useState<IfoxQualityCheck | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");

  const { data: checks = [], isLoading } = useQuery<IfoxQualityCheck[]>({
    queryKey: ["/api/ifox/ai-management/quality"],
  });

  // Filter checks based on selected filter
  const filteredChecks = checks.filter((check) => {
    if (filter === "all") return true;
    if (filter === "passed") return check.passed;
    if (filter === "failed") return !check.passed;
    return true;
  });

  // Calculate stats
  const totalChecks = checks.length;
  const passedChecks = checks.filter((c) => c.passed).length;
  const failedChecks = checks.filter((c) => !c.passed).length;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي الفحوصات</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-checks">
              {totalChecks}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">فحوصات ناجحة</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-passed-checks">
              {passedChecks}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">فحوصات فاشلة</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="text-failed-checks">
              {failedChecks}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>فحوصات الجودة</CardTitle>
              <CardDescription>مراقبة جودة المحتوى المُولد</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant={filter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("all")}
                data-testid="button-filter-all"
              >
                الكل
              </Button>
              <Button
                variant={filter === "passed" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("passed")}
                data-testid="button-filter-passed"
              >
                ناجح
              </Button>
              <Button
                variant={filter === "failed" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("failed")}
                data-testid="button-filter-failed"
              >
                فاشل
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : filteredChecks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {filter === "all" 
                ? "لا توجد فحوصات جودة بعد"
                : filter === "passed"
                ? "لا توجد فحوصات ناجحة"
                : "لا توجد فحوصات فاشلة"}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>اسم الفحص</TableHead>
                  <TableHead>المقال</TableHead>
                  <TableHead>النتيجة</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>التاريخ</TableHead>
                  <TableHead className="text-left">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredChecks.map((check) => (
                  <TableRow key={check.id} data-testid={`row-check-${check.id}`}>
                    <TableCell className="font-medium">
                      فحص جودة #{check.id.slice(0, 8)}
                    </TableCell>
                    <TableCell>
                      {check.articleId ? (
                        <span className="text-sm text-muted-foreground">
                          مقال #{check.articleId.slice(0, 8)}
                        </span>
                      ) : check.taskId ? (
                        <span className="text-sm text-muted-foreground">
                          مهمة #{check.taskId.slice(0, 8)}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="text-xl font-bold">{check.overallScore}</div>
                        <div className="text-sm text-muted-foreground">/100</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={check.passed ? "default" : "destructive"}
                        data-testid={`badge-status-${check.id}`}
                      >
                        {check.passed ? "ناجح" : "فاشل"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(check.createdAt), "PPp", { locale: ar })}
                    </TableCell>
                    <TableCell className="text-left">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSelectedCheck(check)}
                        data-testid={`button-view-${check.id}`}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={selectedCheck !== null} onOpenChange={() => setSelectedCheck(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تفاصيل الفحص</DialogTitle>
            <DialogDescription>
              عرض تفاصيل فحص الجودة الكامل والتوصيات
            </DialogDescription>
          </DialogHeader>

          {selectedCheck && (
            <div className="space-y-6">
              {/* Overall Score */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <div className="text-sm text-muted-foreground">النتيجة الإجمالية</div>
                  <div className="text-3xl font-bold">{selectedCheck.overallScore}/100</div>
                </div>
                <Badge
                  variant={selectedCheck.passed ? "default" : "destructive"}
                  className="text-lg px-4 py-2"
                >
                  {selectedCheck.passed ? "ناجح" : "فاشل"}
                </Badge>
              </div>

              {/* Individual Scores */}
              <div className="space-y-4">
                <h3 className="font-semibold">درجات العناصر المفحوصة</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {selectedCheck.grammarScore !== null && selectedCheck.grammarScore !== undefined && (
                    <ScoreCard
                      label="النحو والإملاء"
                      score={selectedCheck.grammarScore}
                      testId="score-grammar"
                    />
                  )}
                  {selectedCheck.readabilityScore !== null && selectedCheck.readabilityScore !== undefined && (
                    <ScoreCard
                      label="القابلية للقراءة"
                      score={selectedCheck.readabilityScore}
                      testId="score-readability"
                    />
                  )}
                  {selectedCheck.factualAccuracyScore !== null && selectedCheck.factualAccuracyScore !== undefined && (
                    <ScoreCard
                      label="الدقة الواقعية"
                      score={selectedCheck.factualAccuracyScore}
                      testId="score-factual"
                    />
                  )}
                  {selectedCheck.seoScore !== null && selectedCheck.seoScore !== undefined && (
                    <ScoreCard
                      label="تحسين محركات البحث"
                      score={selectedCheck.seoScore}
                      testId="score-seo"
                    />
                  )}
                  {selectedCheck.biasScore !== null && selectedCheck.biasScore !== undefined && (
                    <ScoreCard
                      label="الحيادية"
                      score={selectedCheck.biasScore}
                      testId="score-bias"
                    />
                  )}
                  {selectedCheck.originalityScore !== null && selectedCheck.originalityScore !== undefined && (
                    <ScoreCard
                      label="الأصالة"
                      score={selectedCheck.originalityScore}
                      testId="score-originality"
                    />
                  )}
                  {selectedCheck.relevanceScore !== null && selectedCheck.relevanceScore !== undefined && (
                    <ScoreCard
                      label="مدى الصلة بالموضوع"
                      score={selectedCheck.relevanceScore}
                      testId="score-relevance"
                    />
                  )}
                </div>
              </div>

              {/* Issues */}
              {selectedCheck.issues && Array.isArray(selectedCheck.issues) && selectedCheck.issues.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold">المشاكل المكتشفة</h3>
                  <div className="space-y-2" data-testid="issues-list">
                    {selectedCheck.issues.map((issue: any, index: number) => (
                      <div
                        key={index}
                        className="flex gap-3 p-3 border rounded-lg"
                        data-testid={`issue-${index}`}
                      >
                        <AlertCircle
                          className={`w-5 h-5 flex-shrink-0 ${
                            issue.severity === "critical"
                              ? "text-red-600"
                              : issue.severity === "high"
                              ? "text-orange-600"
                              : issue.severity === "medium"
                              ? "text-yellow-600"
                              : "text-blue-600"
                          }`}
                        />
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{issue.type}</span>
                            <Badge variant="outline" className="text-xs">
                              {getSeverityLabel(issue.severity)}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{issue.description}</p>
                          {issue.suggestion && (
                            <p className="text-sm text-green-600">
                              💡 {issue.suggestion}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggestions */}
              {selectedCheck.suggestions && Array.isArray(selectedCheck.suggestions) && selectedCheck.suggestions.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold">التوصيات</h3>
                  <ul className="space-y-2" data-testid="suggestions-list">
                    {selectedCheck.suggestions.map((suggestion: any, index: number) => (
                      <li
                        key={index}
                        className="flex gap-2 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg"
                        data-testid={`suggestion-${index}`}
                      >
                        <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <span className="text-sm">{suggestion}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Strengths */}
              {selectedCheck.strengths && Array.isArray(selectedCheck.strengths) && selectedCheck.strengths.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold">نقاط القوة</h3>
                  <ul className="space-y-2" data-testid="strengths-list">
                    {selectedCheck.strengths.map((strength: any, index: number) => (
                      <li
                        key={index}
                        className="flex gap-2 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg"
                        data-testid={`strength-${index}`}
                      >
                        <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="text-sm">{strength}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Metadata */}
              <div className="pt-4 border-t space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">النموذج المستخدم:</span>
                  <span className="font-medium">{selectedCheck.analysisModel}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">مدة الفحص:</span>
                  <span className="font-medium">
                    {selectedCheck.checkDuration 
                      ? `${(selectedCheck.checkDuration / 1000).toFixed(2)} ثانية`
                      : "-"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">تاريخ الفحص:</span>
                  <span className="font-medium">
                    {format(new Date(selectedCheck.createdAt), "PPp", { locale: ar })}
                  </span>
                </div>
                {selectedCheck.humanReviewRequired && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">يتطلب مراجعة بشرية:</span>
                    <Badge variant="outline">نعم</Badge>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ScoreCard({ label, score, testId }: { label: string; score: number; testId: string }) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="p-4 border rounded-lg space-y-2" data-testid={testId}>
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="flex items-baseline gap-2">
        <div className={`text-2xl font-bold ${getScoreColor(score)}`}>{score}</div>
        <div className="text-sm text-muted-foreground">/100</div>
      </div>
      <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
        <div
          className={`h-full ${
            score >= 80
              ? "bg-green-600"
              : score >= 60
              ? "bg-yellow-600"
              : "bg-red-600"
          }`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

function getSeverityLabel(severity: string): string {
  const labels: Record<string, string> = {
    critical: "حرج",
    high: "عالي",
    medium: "متوسط",
    low: "منخفض",
  };
  return labels[severity] || severity;
}
