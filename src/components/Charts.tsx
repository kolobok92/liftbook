import { useState } from 'react';
import { View } from 'react-native';
import { BarChart, LineChart } from 'react-native-gifted-charts';
import { fmtDate, fmtVolume } from '@/lib/calc';
import type { Point } from '@/lib/analytics';
import { C, themed } from '@/lib/theme';
import { Txt } from './ui';

const axis = themed(() => ({ color: C.textFaint, fontSize: 10 }));

function useWidth() {
  const [w, setW] = useState(0);
  return [w, (e: { nativeEvent: { layout: { width: number } } }) => setW(e.nativeEvent.layout.width)] as const;
}

/** Line chart of a value over time (e.g. estimated 1RM per session). */
export function TrendLine({ points, format = (v) => String(Math.round(v)), height = 170 }: { points: Point[]; format?: (v: number) => string; height?: number }) {
  const [width, onLayout] = useWidth();
  if (points.length < 2)
    return (
      <View style={{ height: 80, alignItems: 'center', justifyContent: 'center' }}>
        <Txt faint>Log this exercise at least twice to see a trend.</Txt>
      </View>
    );
  const yAxisWidth = 40;
  const plotW = Math.max(0, width - yAxisWidth - 24);
  const spacing = points.length > 1 ? Math.max(8, plotW / (points.length - 1)) : plotW;
  const labelEvery = Math.max(1, Math.ceil(points.length / 5));
  const min = Math.min(...points.map((p) => p.v));
  const max = Math.max(...points.map((p) => p.v));
  const offset = Math.max(0, Math.floor((min - (max - min) * 0.2) / 5) * 5);
  return (
    <View onLayout={onLayout} style={{ marginLeft: -8 }}>
      {width > 0 && (
        <LineChart
          data={points.map((p, i) => ({ value: p.v - offset, label: i % labelEvery === 0 ? fmtDate(p.t) : '', dataPointText: '' }))}
          height={height}
          width={plotW}
          spacing={spacing}
          initialSpacing={6}
          endSpacing={6}
          yAxisOffset={0}
          formatYLabel={(l) => format(Number(l) + offset)}
          yAxisLabelWidth={yAxisWidth}
          noOfSections={4}
          color={C.accent}
          thickness={2.5}
          curved
          areaChart
          startFillColor={C.accent}
          endFillColor={C.accent}
          startOpacity={0.25}
          endOpacity={0.02}
          dataPointsColor={C.accent}
          dataPointsRadius={3}
          rulesColor={C.border}
          rulesType="solid"
          yAxisColor="transparent"
          xAxisColor={C.border}
          yAxisTextStyle={axis}
          xAxisLabelTextStyle={{ ...axis, width: 50 }}
          adjustToWidth
          disableScroll
          pointerConfig={{
            pointerStripColor: C.textFaint,
            pointerColor: C.accent,
            radius: 5,
            pointerLabelWidth: 110,
            pointerLabelHeight: 44,
            activatePointersOnLongPress: false,
            autoAdjustPointerLabelPosition: true,
            pointerLabelComponent: (items: { value: number }[], _s: unknown, idx: number) => (
              <View style={{ backgroundColor: C.surface3, borderRadius: 6, padding: 6 }}>
                <Txt size={12} weight="700">
                  {format(items[0].value + offset)}
                </Txt>
                <Txt size={11} dim>
                  {points[idx] ? fmtDate(points[idx].t, { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                </Txt>
              </View>
            ),
          }}
        />
      )}
    </View>
  );
}

/** Bars of total volume per bucket. */
export function VolumeBars({ points, labelFmt, height = 150 }: { points: Point[]; labelFmt: (t: number) => string; height?: number }) {
  const [width, onLayout] = useWidth();
  const yAxisWidth = 40;
  const n = Math.max(1, points.length);
  const plotW = Math.max(0, width - yAxisWidth - 16);
  const barWidth = Math.max(6, (plotW / n) * 0.6);
  const spacing = Math.max(2, plotW / n - barWidth);
  const labelEvery = Math.max(1, Math.ceil(n / 6));
  return (
    <View onLayout={onLayout} style={{ marginLeft: -8 }}>
      {width > 0 && (
        <BarChart
          data={points.map((p, i) => ({ value: p.v, label: i % labelEvery === 0 ? labelFmt(p.t) : '', frontColor: i === n - 1 ? C.accent : C.orange }))}
          height={height}
          width={plotW}
          barWidth={barWidth}
          spacing={spacing}
          initialSpacing={spacing / 2}
          barBorderRadius={3}
          noOfSections={3}
          yAxisLabelWidth={yAxisWidth}
          formatYLabel={(l) => fmtVolume(Number(l))}
          rulesColor={C.border}
          rulesType="solid"
          yAxisColor="transparent"
          xAxisColor={C.border}
          yAxisTextStyle={axis}
          xAxisLabelTextStyle={{ ...axis, width: 44 }}
          disableScroll
          isAnimated={false}
        />
      )}
    </View>
  );
}
