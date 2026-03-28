import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Radio, ChevronLeft, Zap } from "lucide-react";
import { Link } from "wouter";

const COUNTRY_FLAGS: Record<string, string> = {
  saudi_arabia: "🇸🇦", uae: "🇦🇪", bahrain: "🇧🇭",
  kuwait: "🇰🇼", qatar: "🇶🇦", oman: "🇴🇲", yemen: "🇾🇪",
};

function timeAgo(dateStr: string) {
  const diffMin = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diffMin < 1) return "الآن";
  if (diffMin < 60) return `قبل ${diffMin} د`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `قبل ${diffHrs} س`;
  return `قبل ${Math.floor(diffHrs / 24)} يوم`;
}

export default function GulfLiveBlock() {
  const { data: events } = useQuery<any[]>({
    queryKey: ["/api/gulf-events/latest"],
    refetchInterval: 30000,
    retry: false,
  });

  if (!Array.isArray(events) || !events.length) return null;

  return (
    <Card className="overflow-hidden" data-testid="gulf-live-block">
      <div className="border-b bg-muted/40 px-4 py-2.5 flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
        </span>
        <Radio className="w-4 h-4 text-muted-foreground" />
        <span className="font-semibold text-sm">تغطية حية</span>
        <span className="text-muted-foreground text-xs hidden sm:inline">· الاعتداءات على دول الخليج</span>
      </div>

      <div className="divide-y">
        {events.slice(0, 3).map((event: any) => (
          <div
            key={event.id}
            className={`px-4 py-3 flex items-start gap-3 ${
              event.priority === "urgent" ? "bg-red-50/50 dark:bg-red-950/10" : ""
            }`}
            data-testid={`live-event-${event.id}`}
          >
            <span className="text-lg flex-shrink-0 mt-0.5">{COUNTRY_FLAGS[event.country] ?? ""}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs text-muted-foreground">{timeAgo(event.publishedAt ?? new Date().toISOString())}</span>
                {event.priority === "urgent" && (
                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                    <Zap className="w-2.5 h-2.5 ml-0.5" />
                    عاجل
                  </Badge>
                )}
              </div>
              <p className="text-sm leading-relaxed line-clamp-2">{event.content}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 py-2.5 bg-muted/30">
        <Link href="/gulf-live" className="w-full">
          <Button variant="ghost" size="sm" className="w-full gap-1" data-testid="button-gulf-live-link">
            تابع التغطية الحية
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </Card>
  );
}
