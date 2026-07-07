"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, RotateCw } from "lucide-react";
import { EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { clearHistory, getHistory, removeHistory } from "@/lib/history";
import { useSearchStore } from "@/store/search";
import type { HistoryEntry } from "@/types";

function fmtTime(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function HistoryPage() {
  const router = useRouter();
  const setReplay = useSearchStore((s) => s.setReplay);
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEntries(getHistory());
    setMounted(true);
  }, []);

  function replay(entry: HistoryEntry) {
    setReplay(entry.params); // 首页读取并回填 + 自动执行
    router.push("/");
  }

  function remove(id: string) {
    setEntries(removeHistory(id));
  }

  function clearAll() {
    clearHistory();
    setEntries([]);
  }

  if (!mounted) return null;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">搜索历史</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            最近 {entries.length} 条搜索条件（仅存于本机浏览器）。
          </p>
        </div>
        {entries.length > 0 && (
          <Button variant="outline" size="sm" onClick={clearAll}>
            清空
          </Button>
        )}
      </section>

      {entries.length === 0 ? (
        <EmptyState
          title="暂无搜索历史"
          hint="发起一次搜索后，条件会自动记录在此。"
          action={<Button onClick={() => router.push("/")}>去搜索</Button>}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {entries.map((e) => (
            <Card key={e.id} className="transition-colors hover:border-primary/30">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Clock className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="font-medium">{e.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {fmtTime(e.at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" className="gap-1.5" onClick={() => replay(e)}>
                    <RotateCw className="h-3.5 w-3.5" /> 重新查询
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => remove(e.id)}
                  >
                    删除
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
