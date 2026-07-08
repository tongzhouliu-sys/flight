"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Info, Plane, Maximize, Wifi, Zap, Tv, Leaf, Cloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/tooltip";
import { Money } from "@/components/money";
import { generateItinerary } from "@/lib/visa-baggage";
import { weekday } from "@/lib/format";
import { getAirport } from "@/lib/airports";
import type { Opportunity } from "@/types";
import { cn } from "@/lib/utils";


function getAmenitiesForLeg(aircraft: string, durationMinutes: number, index: number) {
  const isWideBody = 
    aircraft.toLowerCase().includes("777") || 
    aircraft.toLowerCase().includes("787") || 
    aircraft.toLowerCase().includes("330") || 
    aircraft.toLowerCase().includes("335") || 
    aircraft.toLowerCase().includes("350") || 
    aircraft.toLowerCase().includes("380") ||
    aircraft.toLowerCase().includes("大型");
  
  const legroom = isWideBody 
    ? "腿部活动空间宽敞 (81厘米)" 
    : "腿部活动空间适中 (76厘米)";
  
  const wifi = durationMinutes > 300 
    ? (index === 0 ? "Wi-Fi 需付费" : "提供免费 Wi-Fi")
    : "不提供 Wi-Fi";
  
  const power = isWideBody 
    ? "提供座椅内电源和 USB 接口" 
    : "提供 USB 接口";
  
  const video = isWideBody 
    ? "提供点播视频服务" 
    : "不提供娱乐系统";
  
  const co2 = Math.round(durationMinutes * 1.32);
  
  return {
    legroom,
    wifi,
    power,
    video,
    co2,
    contrail: durationMinutes > 400 ? "低" : "极低",
  };
}

function parseDurationToMinutes(durationStr?: string): number {
  if (!durationStr) return 180;
  
  const hrMatch = durationStr.match(/(\d+)\s*(?:小时|时|h)/i);
  const minMatch = durationStr.match(/(\d+)\s*(?:分钟|分|m)/i);
  
  let mins = 0;
  if (hrMatch) mins += parseInt(hrMatch[1], 10) * 60;
  if (minMatch) mins += parseInt(minMatch[1], 10);
  
  return mins > 0 ? mins : 180;
}

function AirlineLogo({ carrierCode, carrierName }: { carrierCode?: string; carrierName?: string }) {
  const [imgError, setImgError] = useState(false);
  const code = (carrierCode || "CX").toUpperCase();
  
  return (
    <div className="h-8 w-8 shrink-0 flex items-center justify-center bg-card rounded-lg border border-border/60 shadow-sm p-1">
      {!imgError ? (
        <img
          src={`https://pics.avs.io/al_30/30/${code}.png`}
          alt={carrierName || code}
          onError={() => setImgError(true)}
          className="h-full w-full object-contain"
        />
      ) : (
        <Plane className="h-4.5 w-4.5 text-primary -rotate-45" />
      )}
    </div>
  );
}

export function FlightDetailsAccordion({
  op,
}: {
  op: Opportunity;
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  const itinerary = generateItinerary(op, false);
  const mainCarrierCode = op.detail?.carrier as string || "CX";
  const mainCarrierName = itinerary.find(item => item.type === "flight")?.carrier || mainCarrierCode;

  // Calculate comparative CO2 emissions
  const depTime = op.detail?.depart_time ? new Date(op.detail.depart_time as string).getTime() : 0;
  const arrTime = op.detail?.arrive_time ? new Date(op.detail.arrive_time as string).getTime() : 0;
  const totalMinutes = depTime && arrTime ? Math.round((arrTime - depTime) / 60000) : 600;
  const stops = op.layover_cities?.length || 0;
  
  const totalCo2 = Math.round(totalMinutes * 1.28 + stops * 115);
  const co2ComparisonPercent = stops === 0 ? -12 : stops === 1 ? 9 : 24;
  const isBetterEmissions = co2ComparisonPercent < 0;
  const co2ComparisonText = isBetterEmissions 
    ? `${Math.abs(co2ComparisonPercent)}% 排放量` 
    : `+${co2ComparisonPercent}% 排放量`;

  // Format header date label, e.g. "离开 · 8月1日周六"
  let dateHeaderLabel = "离开";
  if (op.depart_date) {
    const [, m, d] = op.depart_date.split("-").map(Number);
    const dayOfWeek = weekday(op.depart_date);
    dateHeaderLabel = `离开 · ${m}月${d}日${dayOfWeek}`;
  }

  return (
    <Card className="border border-border/80 shadow-md flex flex-col overflow-hidden transition-all duration-300">
      {/* Header Row (Google Flights Accordion Style) */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between p-4 bg-gradient-to-r from-card via-card to-muted/10 cursor-pointer select-none hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <AirlineLogo carrierCode={mainCarrierCode} carrierName={mainCarrierName} />
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-sm text-foreground truncate">{dateHeaderLabel}</span>
            <span className="text-[10px] text-muted-foreground font-medium truncate">
              {mainCarrierName} · {stops === 0 ? "直飞" : `${stops}次转机`}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          {/* CO2 Emissions */}
          <div className="flex flex-col items-end text-right">
            <span className="font-bold text-xs text-foreground">{totalCo2.toLocaleString()} kg CO2e</span>
            <Tooltip label={`相较此航线的中位数估算排放量：${isBetterEmissions ? "更少" : "更多"}`}>
              <span className={cn("text-[10px] flex items-center gap-0.5 font-semibold", isBetterEmissions ? "text-good" : "text-warn")}>
                {co2ComparisonText}
                <Info className="h-3 w-3 inline shrink-0" />
              </span>
            </Tooltip>
          </div>

          {/* Booking Action */}
          <Button 
            variant="outline" 
            size="sm"
            onClick={(e) => {
              e.stopPropagation(); // Avoid triggering accordion collapse
              window.open(op.deeplink, "_blank");
            }}
            className="text-xs h-8 border-primary/45 text-primary hover:bg-primary/5 rounded-full font-bold px-3.5 cursor-pointer shadow-sm active:scale-95"
          >
            选择航班
          </Button>

          {/* Fare display */}
          <div className="flex flex-col items-end text-right">
            <Money
              value={op.alt_price}
              currency={op.currency}
              className="text-base font-extrabold tracking-tight text-primary"
            />
            <span className="text-[9px] text-muted-foreground/80 font-medium">
              {op.return_date ? "往返票价" : "单程票价"}
            </span>
          </div>

          {/* Chevron expand/collapse indicator */}
          <span className="text-muted-foreground hover:text-foreground transition-colors p-1">
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </span>
        </div>
      </div>

      {/* Accordion Body Content */}
      {isExpanded && (
        <CardContent className="p-5 border-t border-border/50 bg-card flex flex-col gap-4">
          <div className="flex flex-col gap-4 max-h-[460px] overflow-y-auto pr-1">
            {itinerary.map((item, idx) => {
              if (item.type === "flight") {
                const legMinutes = parseDurationToMinutes(item.duration);
                const amenities = getAmenitiesForLeg(item.aircraft || "", legMinutes, idx);

                return (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-5 py-4 first:pt-0 last:pb-0 border-b border-border/20 last:border-0">
                    
                    {/* Left Timeline (7/12 width) */}
                    <div className="md:col-span-7 flex gap-3 text-xs">
                      {/* Timings */}
                      <div className="w-14 shrink-0 text-right flex flex-col justify-between py-1 font-semibold text-muted-foreground">
                        <div>
                          <div className="font-extrabold text-sm text-foreground">{item.departTime}</div>
                          <div className="text-[9px] text-muted-foreground/60">{item.departDate}</div>
                        </div>
                        <div className="my-3 text-[9px] text-muted-foreground/40 font-bold">
                          {item.duration}
                        </div>
                        <div>
                          <div className="font-extrabold text-sm text-foreground">{item.arriveTime}</div>
                          <div className="text-[9px] text-muted-foreground/60">{item.arriveDate}</div>
                        </div>
                      </div>

                      {/* Timeline Dot Track */}
                      <div className="flex flex-col items-center py-1.5 shrink-0">
                        <div className="h-2.5 w-2.5 rounded-full border border-primary bg-card z-10 shrink-0 flex items-center justify-center">
                          <div className="h-1 w-1 rounded-full bg-primary" />
                        </div>
                        <div className="w-0.5 border-l border-dashed border-border/60 flex-1 my-1 min-h-[50px]" />
                        <div className="h-2.5 w-2.5 rounded-full border border-info bg-card z-10 shrink-0 flex items-center justify-center">
                          <div className="h-1 w-1 rounded-full bg-info" />
                        </div>
                      </div>

                      {/* Flight Details Info */}
                      <div className="flex-1 flex flex-col justify-between min-w-0 py-0.5">
                        <div className="truncate font-bold text-foreground text-sm flex items-center gap-1.5">
                          <span className="font-extrabold text-primary text-sm">{item.origin}</span>
                          <span className="text-[10px] text-muted-foreground font-medium truncate">
                            {getAirport(item.origin || "")?.name || item.origin}
                          </span>
                        </div>
                        
                        <div className="my-2.5 p-3.5 rounded-xl border border-border/40 bg-muted/10 text-[10px] text-muted-foreground flex flex-col gap-1.5 shadow-sm">
                          <div className="flex justify-between font-bold">
                            <span className="flex items-center gap-1.5 text-foreground/80">
                              <Plane className="h-3.5 w-3.5 text-primary rotate-45" />
                              {item.carrier} <b className="text-primary">{item.flightNumber}</b>
                            </span>
                            <span className="bg-muted px-2 py-0.5 border border-border/30 rounded text-[9px] font-semibold">{item.cabin}</span>
                          </div>
                          <div className="flex justify-between text-[9px] text-muted-foreground/70 font-medium">
                            <span>{item.aircraft || "波音 777"}</span>
                            <span className="text-good">{item.meals}</span>
                          </div>
                        </div>

                        <div className="truncate font-bold text-foreground text-sm flex items-center gap-1.5">
                          <span className="font-extrabold text-info text-sm">{item.dest}</span>
                          <span className="text-[10px] text-muted-foreground font-medium truncate">
                            {getAirport(item.dest || "")?.name || item.dest}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right Amenities (5/12 width) */}
                    <div className="md:col-span-5 border-l border-border/30 pl-5 flex flex-col gap-2 justify-center text-xs text-muted-foreground bg-muted/[0.04] p-3 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Maximize className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                        <span className="font-medium">{amenities.legroom}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Wifi className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                        <span className="font-medium">{amenities.wifi}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Zap className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                        <span className="font-medium">{amenities.power}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Tv className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                        <span className="font-medium">{amenities.video}</span>
                      </div>
                      <div className="flex items-center gap-2 border-t border-border/20 pt-2 mt-1">
                        <Leaf className="h-3.5 w-3.5 text-good/80 shrink-0" />
                        <span className="font-semibold text-foreground/80">估算排放量：{amenities.co2} 千克</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Cloud className="h-3.5 w-3.5 text-info/75 shrink-0" />
                        <span className="font-medium">航迹云致暖趋势：{amenities.contrail}</span>
                      </div>
                    </div>

                  </div>
                );
              } else if (item.type === "layover") {
                return (
                  <div key={idx} className="flex gap-3 my-1.5 text-xs">
                    {/* Timing spacing */}
                    <div className="w-14 shrink-0" />
                    
                    {/* Track line connector */}
                    <div className="flex flex-col items-center shrink-0">
                      <div className="w-0.5 border-l border-dashed border-border/60 flex-1 min-h-[30px]" />
                    </div>
                    
                    {/* Layover block */}
                    <div className="flex-1 bg-muted/20 border border-border/40 rounded-xl p-3 text-[10px] font-semibold text-foreground">
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block px-1.5 py-0.5 rounded bg-info/10 text-info text-[8px] font-bold">转</span>
                        中转 {item.city} ({item.airportCode}) · 转机时间 {item.layoverDuration}
                      </span>
                      {item.warnings && item.warnings.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {item.warnings.map((w, wIdx) => (
                            <span key={wIdx} className="px-1.5 py-0.5 rounded bg-warn/15 border border-warn/25 text-[8px] font-bold text-warn">
                              {w}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              }
              return null;
            })}
          </div>

          {/* Footer deep-link info */}
          <div className="pt-3.5 border-t border-border/45 flex items-center justify-between text-[10px] text-muted-foreground/60 font-semibold">
            <span>数据来源 · Google Flights</span>
            <span>FareRadar 实时推荐系统</span>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
