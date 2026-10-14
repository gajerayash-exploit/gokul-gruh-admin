"use client";

import * as React from "react";
import { Plus, ChevronLeft, ChevronRight, Sparkles, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface ItemDefinition {
  name: string;
  gujarati: string;
  category?: string;
  color: string;
  defaultPrice?: number;
}

export const GOKUL_ITEMS: ItemDefinition[] = [
  { name: "Kothimba", gujarati: "કોથમીર", color: "from-emerald-500/15 to-emerald-500/5 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" },
  { name: "Guvar", gujarati: "ગુવાર", color: "from-green-500/15 to-green-500/5 text-green-700 dark:text-green-400 border-green-500/30" },
  { name: "Bhinda", gujarati: "ભીંડા", color: "from-teal-500/15 to-teal-500/5 text-teal-700 dark:text-teal-400 border-teal-500/30" },
  { name: "Marcha", gujarati: "મરચાં", color: "from-lime-500/15 to-lime-500/5 text-lime-700 dark:text-lime-400 border-lime-500/30" },
  { name: "Karela", gujarati: "કારેલા", color: "from-amber-500/15 to-amber-500/5 text-amber-700 dark:text-amber-400 border-amber-500/30" },
  { name: "Gunda", gujarati: "ગુંદા", color: "from-sky-500/15 to-sky-500/5 text-sky-700 dark:text-sky-400 border-sky-500/30" },
];

export interface ItemsScrollListProps {
  onSelectItem: (item: ItemDefinition) => void;
  selectedOrderName?: string;
  selectedOrderDocket?: string;
  className?: string;
}

export function ItemsScrollList({
  onSelectItem,
  selectedOrderName,
  selectedOrderDocket,
  className,
}: ItemsScrollListProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(true);

  const checkScroll = React.useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);
  }, []);

  React.useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, [checkScroll]);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const offset = direction === "left" ? -240 : 240;
    scrollRef.current.scrollBy({ left: offset, behavior: "smooth" });
    setTimeout(checkScroll, 350);
  };

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-card/70 px-3 py-1.5 shadow-2xs backdrop-blur-xs",
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
        <div className="flex items-center gap-1.5 pr-1 text-xs font-semibold text-muted-foreground shrink-0">
          <ShoppingBag className="h-3.5 w-3.5 text-primary" />
          <span className="hidden sm:inline">Quick Add:</span>
        </div>

        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="flex items-center gap-1.5 overflow-x-auto py-0.5 scrollbar-none"
        >
          {GOKUL_ITEMS.map((item) => (
            <button
              key={item.name}
              type="button"
              onClick={() => onSelectItem(item)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all hover:scale-[1.02] active:scale-95 shadow-2xs",
                "bg-gradient-to-r",
                item.color
              )}
              title={`Add ${item.name} (${item.gujarati}) to ${selectedOrderName || "active order"}`}
            >
              <Plus className="h-3 w-3 stroke-[3] opacity-75" />
              <span className="font-bold">{item.name}</span>
              <span className="text-[11px] opacity-75 hidden sm:inline">({item.gujarati})</span>
            </button>
          ))}
        </div>
      </div>

      {selectedOrderName && (
        <div className="hidden md:flex items-center gap-1 text-[11px] text-muted-foreground shrink-0 pl-2 border-l border-border/60">
          <span>Target:</span>
          <span className="font-semibold text-foreground truncate max-w-[140px]">{selectedOrderName}</span>
          {selectedOrderDocket && (
            <span className="font-mono text-muted-foreground">#{selectedOrderDocket}</span>
          )}
        </div>
      )}
    </div>
  );
}
