import { useEffect, useMemo, useRef, useState } from "react";
import { Cell, Pie, PieChart, Sector, type PieSectorShapeProps } from "recharts";

import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { usePrivacyStore } from "@/hooks/use-privacy";
import { useThemeStore } from "@/hooks/use-theme";
import { buildDonutPalette } from "@/utils/colors";
import { formatCurrency } from "@/utils/formatters";
import type { ApiKeyAccountUsage7DayResponse } from "@/features/apis/schemas";

const CHART_SIZE = 152;
const CHART_MARGIN = 4;
const PIE_CX = 72;
const PIE_CY = 72;
const INNER_R = 53;
const OUTER_R = 68;
const ACTIVE_RADIUS_OFFSET = 4;
const LEGEND_VISIBLE_COUNT = 4;
const LEGEND_ROW_HEIGHT_REM = 1.75;
const LEGEND_ROW_GAP_REM = 0;

type ChartDatum = {
  id: string;
  label: string;
  value: number;
  fill: string;
  isEmailDerived: boolean;
};

function getAccountCostDatumId(
  label: string,
  accountId: string | null,
  index: number,
): string {
  return accountId ?? `__account_cost__:${index}:${label}`;
}

type ApiAccountCostDonutProps = {
  usage: ApiKeyAccountUsage7DayResponse | null;
};

export function ApiAccountCostDonut({ usage }: ApiAccountCostDonutProps) {
  const isDark = useThemeStore((s) => s.theme === "dark");
  const blurred = usePrivacyStore((s) => s.blurred);
  const reducedMotion = useReducedMotion();
  const [activeLegendId, setActiveLegendId] = useState<string | null>(null);
  const legendRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const deletedColor = isDark ? "#404040" : "#d3d3d3";

  const chartData = useMemo(() => {
    const accounts = usage?.accounts ?? [];
    const visibleAccounts = accounts.filter((account) => account.totalCostUsd > 0);
    const palette = buildDonutPalette(
      Math.max(
        1,
        visibleAccounts.filter((account) => account.displayName !== "Deleted Account").length,
      ),
      isDark,
    );
    let paletteIndex = 0;

    return visibleAccounts.map((account, index) => {
      const isDeleted = account.displayName === "Deleted Account";
      const fill = isDeleted ? deletedColor : palette[paletteIndex++ % palette.length];
      return {
        id: getAccountCostDatumId(account.displayName, account.accountId, index),
        label: account.displayName,
        value: account.totalCostUsd,
        fill,
        isEmailDerived: account.isEmailDerived,
      } satisfies ChartDatum;
    });
  }, [deletedColor, isDark, usage?.accounts]);

  useEffect(() => {
    if (!activeLegendId) {
      return;
    }
    legendRefs.current[activeLegendId]?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeLegendId]);

  const renderDonutShape = (props: PieSectorShapeProps) => {
    const isHighlighted = (props.payload as ChartDatum | undefined)?.id === activeLegendId;
    const outerRadius =
      typeof props.outerRadius === "number"
        ? props.outerRadius + (isHighlighted ? ACTIVE_RADIUS_OFFSET : 0)
        : OUTER_R + (isHighlighted ? ACTIVE_RADIUS_OFFSET : 0);

    return (
      <Sector
        {...props}
        outerRadius={outerRadius}
        stroke={isHighlighted ? "hsl(var(--background))" : "none"}
        strokeWidth={isHighlighted ? 2 : 0}
      />
    );
  };

  const hasData = chartData.some((entry) => entry.value > 0);
  const displayData = hasData
    ? chartData
    : [
        {
          id: "__empty__",
          label: "No usage",
          value: 1,
          fill: deletedColor,
          isEmailDerived: false,
        } satisfies ChartDatum,
      ];

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-5">
        <h3 className="text-sm font-semibold">Account Cost</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">Last 7 days by routed account.</p>
      </div>

      <div className="flex flex-col items-center gap-3">
        <div className="relative h-[152px] w-[152px] overflow-visible">
          <PieChart
            width={CHART_SIZE}
            height={CHART_SIZE}
            margin={{
              top: CHART_MARGIN,
              right: CHART_MARGIN,
              bottom: CHART_MARGIN,
              left: CHART_MARGIN,
            }}
          >
            <Pie
              data={displayData}
              cx={PIE_CX}
              cy={PIE_CY}
              innerRadius={INNER_R}
              outerRadius={OUTER_R}
              startAngle={90}
              endAngle={-270}
              dataKey="value"
              stroke="none"
              shape={renderDonutShape}
              isAnimationActive={!reducedMotion}
              animationDuration={600}
              animationEasing="ease-out"
              onMouseEnter={(data) => {
                if (typeof data?.id === "string") {
                  setActiveLegendId(data.id);
                }
              }}
              onMouseLeave={() => setActiveLegendId(null)}
              onMouseOut={() => setActiveLegendId(null)}
            >
              {displayData.map((entry) => (
                <Cell key={entry.id} fill={entry.fill} />
              ))}
            </Pie>
          </PieChart>
          <div className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center text-center">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                7-day Cost
              </p>
              <p className="tabular-nums text-base font-semibold">
                {formatCurrency(usage?.totalCostUsd ?? 0)}
              </p>
            </div>
          </div>
        </div>

        <div
          className="w-full overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          data-testid="api-account-cost-legend-list"
          style={{
            maxHeight: `calc(${LEGEND_VISIBLE_COUNT} * ${LEGEND_ROW_HEIGHT_REM}rem + ${(LEGEND_VISIBLE_COUNT - 1) * LEGEND_ROW_GAP_REM}rem)`,
          }}
        >
          {chartData.map((entry, index) => {
            const isActive = activeLegendId === entry.id;
            return (
              <button
                ref={(node) => {
                  legendRefs.current[entry.id] = node;
                }}
                type="button"
                key={entry.id}
                className="animate-fade-in-up flex h-7 w-full items-center justify-between gap-3 rounded-lg border bg-transparent px-1.5 text-xs transition-all"
                style={{
                  animationDelay: `${index * 75}ms`,
                  borderColor: isActive ? entry.fill : "transparent",
                }}
                onMouseEnter={() => setActiveLegendId(entry.id)}
                onMouseLeave={() => setActiveLegendId(null)}
                onFocus={() => setActiveLegendId(entry.id)}
                onBlur={() => setActiveLegendId(null)}
                data-active={isActive ? "true" : "false"}
                data-testid={`api-account-cost-legend-${index}`}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: entry.fill }}
                  />
                  <span
                    className={
                      entry.isEmailDerived && blurred
                        ? "truncate privacy-blur"
                        : "truncate"
                    }
                  >
                    {entry.label}
                  </span>
                </div>
                <span className="tabular-nums text-muted-foreground">
                  {formatCurrency(entry.value)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
