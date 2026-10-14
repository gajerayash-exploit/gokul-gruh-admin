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
  { name: "Kothimba", gujarati: "કોથમીર", color: "from-emerald-500/15 to-emerald-500/5 text-emerald-700 dark:text-emerald-400 border-emerald-500/30", defaultPrice: 40 },
  { name: "Guvar", gujarati: "ગુવાર", color: "from-green-500/15 to-green-500/5 text-green-700 dark:text-green-400 border-green-500/30", defaultPrice: 60 },
  { name: "Bhinda", gujarati: "ભીંડા", color: "from-teal-500/15 to-teal-500/5 text-teal-700 dark:text-teal-400 border-teal-500/30", defaultPrice: 70 },
  { name: "Marcha", gujarati: "મરચાં", color: "from-lime-500/15 to-lime-500/5 text-lime-700 dark:text-lime-400 border-lime-500/30", defaultPrice: 50 },
  { name: "Karela", gujarati: "કારેલા", color: "from-amber-500/15 to-amber-500/5 text-amber-700 dark:text-amber-400 border-amber-500/30", defaultPrice: 60 },
  { name: "Gunda", gujarati: "ગુંદા", color: "from-sky-500/15 to-sky-500/5 text-sky-700 dark:text-sky-400 border-sky-500/30", defaultPrice: 80 },
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
        "rounded-xl border border-border/80 bg-gradient-to-r from-card via-card to-card p-2.5 shadow-xs",
        className
      )}
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className="grid h-6 w-6 place-items-center rounded-md bg-brand-soft text-primary">
            <ShoppingBag className="h-3.5 w-3.5" />
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Quick Item Picker
            </span>
            <span className="ml-2 text-xs font-medium text-brand-navy dark:text-foreground">
              {selectedOrderName ? (
                <>
                  Adding to: <span className="text-primary font-bold">{selectedOrderName}</span>
                  {selectedOrderDocket ? ` (Docket ${selectedOrderDocket})` : ""}
                </>
              ) : (
                "Tap item to add to customer order"
              )}
            </span>
          </div>
        </div>

        {/* Scroll navigation arrows */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => scroll("left")}
            disabled={!canScrollLeft}
            aria-label="Scroll items left"
            className={cn(
              "grid h-6 w-6 place-items-center rounded-md border border-border bg-card text-muted-foreground transition-colors",
              canScrollLeft ? "hover:bg-secondary hover:text-foreground" : "opacity-40 cursor-not-allowed"
            )}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => scroll("right")}
            disabled={!canScrollRight}
            aria-label="Scroll items right"
            className={cn(
              "grid h-6 w-6 place-items-center rounded-md border border-border bg-card text-muted-foreground transition-colors",
              canScrollRight ? "hover:bg-secondary hover:text-foreground" : "opacity-40 cursor-not-allowed"
            )}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Scrollable container of items */}
      <div
        ref={scrollRef}
        onScroll={checkScroll}
        className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent scroll-smooth focus:outline-none"
        style={{ scrollbarWidth: "thin" }}
      >
        {GOKUL_ITEMS.map((item) => (
          <button
            key={item.name}
            type="button"
            onClick={() => onSelectItem(item)}
            className={cn(
              "group relative flex shrink-0 items-center gap-2.5 rounded-lg border bg-gradient-to-b px-3 py-2 text-left transition-all hover:scale-[1.02] hover:shadow-xs active:scale-[0.98]",
              item.color
            )}
            title={`Add ${item.name} (${item.gujarati}) to customer order`}
          >
            <div className="flex flex-col">
              <span className="text-xs font-bold leading-tight">{item.name}</span>
              <span className="text-[10px] opacity-80 font-medium">{item.gujarati}</span>
            </div>
            <div className="ml-1 grid h-5 w-5 place-items-center rounded-full bg-background/80 shadow-2xs group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              <Plus className="h-3 w-3 stroke-[3]" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
