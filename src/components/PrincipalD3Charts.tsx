import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { BarChart3, CalendarCheck, TrendingUp } from 'lucide-react';
import type {
  AttendanceRecord,
  DashboardSection,
  GradeRecord,
  SchoolClass,
} from '../types/sims';

interface PrincipalD3ChartsProps {
  attendance: AttendanceRecord[];
  grades: GradeRecord[];
  classes: SchoolClass[];
  onNavigate: (section: DashboardSection) => void;
}

interface MonthlyAttendancePoint {
  monthKey: string;
  label: string;
  hadir: number;
  izin: number;
  sakit: number;
  alpa: number;
  total: number;
  rate: number;
}

interface ClassProgressionPoint {
  className: string;
  homeroomTeacher: string;
  count: number;
  uhAvg: number;
  utsAvg: number;
  uasAvg: number;
  finalAvg: number;
}

const MONTH_NAMES_ID = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

const CLASS_LINE_COLORS = [
  '#065f46',
  '#0284c7',
  '#b45309',
  '#7c3aed',
  '#be123c',
  '#0f766e',
  '#4338ca',
  '#334155',
];

function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-');
  const mIdx = Number(m) - 1;
  const shortYear = y ? y.slice(2) : '';
  const name = MONTH_NAMES_ID[mIdx] || m;
  return `${name} '${shortYear}`;
}

export function PrincipalD3Charts({
  attendance,
  grades,
  classes,
  onNavigate,
}: PrincipalD3ChartsProps) {
  // Interactive Controls State
  const [attendanceClassFilter, setAttendanceClassFilter] = useState<string>('semua');
  const [attendanceChartMode, setAttendanceChartMode] = useState<'rate' | 'counts'>('rate');

  const [gradeSemesterFilter, setGradeSemesterFilter] = useState<'semua' | 'Ganjil' | 'Genap'>(
    'semua'
  );
  const [gradeChartMode, setGradeChartMode] = useState<'bars' | 'progression'>('bars');
  const [selectedClassName, setSelectedClassName] = useState<string | null>(null);

  // Tooltip States (React-rendered crisp floating tooltips driven by D3 events)
  const [attTooltip, setAttTooltip] = useState<{
    x: number;
    y: number;
    point: MonthlyAttendancePoint;
  } | null>(null);

  const [gradeTooltip, setGradeTooltip] = useState<{
    x: number;
    y: number;
    title: string;
    subtitle: string;
    metrics: Array<{ label: string; value: string }>;
  } | null>(null);

  const attContainerRef = useRef<HTMLDivElement | null>(null);
  const attSvgRef = useRef<SVGSVGElement | null>(null);
  const [attWidth, setAttWidth] = useState<number>(560);

  const gradeContainerRef = useRef<HTMLDivElement | null>(null);
  const gradeSvgRef = useRef<SVGSVGElement | null>(null);
  const [gradeWidth, setGradeWidth] = useState<number>(560);

  // Observe container widths cleanly for responsive D3 rendering
  useEffect(() => {
    const observers: ResizeObserver[] = [];
    if (attContainerRef.current) {
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.contentRect.width > 120) {
            setAttWidth(Math.floor(entry.contentRect.width));
          }
        }
      });
      ro.observe(attContainerRef.current);
      observers.push(ro);
    }
    if (gradeContainerRef.current) {
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.contentRect.width > 120) {
            setGradeWidth(Math.floor(entry.contentRect.width));
          }
        }
      });
      ro.observe(gradeContainerRef.current);
      observers.push(ro);
    }
    return () => observers.forEach((ro) => ro.disconnect());
  }, []);

  // All class options for attendance filter
  const availableAttendanceClasses = useMemo(() => {
    const set = new Set<string>();
    classes.forEach((c) => {
      if (c.name) set.add(c.name);
    });
    attendance.forEach((a) => {
      if (a.className) set.add(a.className);
    });
    return Array.from(set).sort();
  }, [classes, attendance]);

  // Aggregate Monthly Attendance Data
  const monthlyAttendance = useMemo<MonthlyAttendancePoint[]>(() => {
    const filtered =
      attendanceClassFilter === 'semua'
        ? attendance
        : attendance.filter((a) => a.className === attendanceClassFilter);

    const bucket = new Map<
      string,
      { hadir: number; izin: number; sakit: number; alpa: number; total: number }
    >();

    for (const rec of filtered) {
      if (!rec.date || rec.date.length < 7) continue;
      const monthKey = rec.date.slice(0, 7);
      const curr = bucket.get(monthKey) || { hadir: 0, izin: 0, sakit: 0, alpa: 0, total: 0 };
      if (rec.status === 'Hadir') curr.hadir += 1;
      else if (rec.status === 'Izin') curr.izin += 1;
      else if (rec.status === 'Sakit') curr.sakit += 1;
      else if (rec.status === 'Alpa') curr.alpa += 1;
      curr.total += 1;
      bucket.set(monthKey, curr);
    }

    const sortedKeys = Array.from(bucket.keys()).sort();
    return sortedKeys.map((key) => {
      const d = bucket.get(key)!;
      const rate = d.total > 0 ? Number(((d.hadir / d.total) * 100).toFixed(1)) : 0;
      return {
        monthKey: key,
        label: formatMonthLabel(key),
        hadir: d.hadir,
        izin: d.izin,
        sakit: d.sakit,
        alpa: d.alpa,
        total: d.total,
        rate,
      };
    });
  }, [attendance, attendanceClassFilter]);

  const attendanceSummaryStats = useMemo(() => {
    if (monthlyAttendance.length === 0) {
      return { avgRate: 0, totalSessions: 0, latestMonthLabel: '-' };
    }
    const totalSessions = monthlyAttendance.reduce((acc, m) => acc + m.total, 0);
    const totalHadir = monthlyAttendance.reduce((acc, m) => acc + m.hadir, 0);
    const avgRate = totalSessions > 0 ? Number(((totalHadir / totalSessions) * 100).toFixed(1)) : 0;
    return {
      avgRate,
      totalSessions,
      latestMonthLabel: monthlyAttendance[monthlyAttendance.length - 1].label,
    };
  }, [monthlyAttendance]);

  // Aggregate Class Grade Averages & Progression (UH -> UTS -> UAS -> Akhir)
  const classGradeSeries = useMemo<ClassProgressionPoint[]>(() => {
    const filteredGrades =
      gradeSemesterFilter === 'semua'
        ? grades
        : grades.filter((g) => g.semester === gradeSemesterFilter);

    const classMap = new Map<
      string,
      { homeroomTeacher: string; rows: GradeRecord[] }
    >();

    classes.forEach((c) => {
      classMap.set(c.name, {
        homeroomTeacher: c.homeroomTeacherName || '-',
        rows: [],
      });
    });

    filteredGrades.forEach((g) => {
      const cName = g.className || 'Tanpa Rombel';
      const entry = classMap.get(cName) || { homeroomTeacher: '-', rows: [] };
      entry.rows.push(g);
      classMap.set(cName, entry);
    });

    const orderWeight = (name: string) => {
      if (name.startsWith('XII')) return 3;
      if (name.startsWith('XI')) return 2;
      if (name.startsWith('X')) return 1;
      return 4;
    };

    const avgField = (rows: GradeRecord[], getter: (r: GradeRecord) => number | undefined) => {
      const valid = rows.map(getter).filter((v): v is number => typeof v === 'number');
      if (valid.length === 0) return 0;
      return Number((valid.reduce((s, n) => s + n, 0) / valid.length).toFixed(1));
    };

    return Array.from(classMap.entries())
      .sort(([a], [b]) => {
        const wDiff = orderWeight(a) - orderWeight(b);
        return wDiff !== 0 ? wDiff : a.localeCompare(b);
      })
      .map(([className, info]) => {
        const finalAvg = avgField(info.rows, (r) => r.finalScore);
        const uhAvg = avgField(info.rows, (r) => r.uhScore ?? r.finalScore);
        const utsAvg = avgField(info.rows, (r) => r.utsScore ?? r.finalScore);
        const uasAvg = avgField(info.rows, (r) => r.uasScore ?? r.finalScore);
        return {
          className,
          homeroomTeacher: info.homeroomTeacher,
          count: info.rows.length,
          uhAvg,
          utsAvg,
          uasAvg,
          finalAvg,
        };
      });
  }, [classes, grades, gradeSemesterFilter]);

  const activeGradeClassesCount = useMemo(
    () => classGradeSeries.filter((c) => c.count > 0).length,
    [classGradeSeries]
  );

  // D3 Render Effect 1: Monthly Student Attendance Trend
  useEffect(() => {
    const svgEl = attSvgRef.current;
    if (!svgEl) return;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const height = 260;
    const margin = { top: 20, right: 20, bottom: 34, left: 42 };
    const innerWidth = Math.max(180, attWidth - margin.left - margin.right);
    const innerHeight = height - margin.top - margin.bottom;

    svg.attr('viewBox', `0 0 ${attWidth} ${height}`);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    if (monthlyAttendance.length === 0) {
      return;
    }

    const x = d3
      .scaleBand<string>()
      .domain(monthlyAttendance.map((d) => d.label))
      .range([0, innerWidth])
      .padding(0.28);

    if (attendanceChartMode === 'rate') {
      const y = d3.scaleLinear().domain([0, 100]).range([innerHeight, 0]);

      // Horizontal Gridlines
      g.append('g')
        .attr('class', 'grid-lines')
        .selectAll('line')
        .data([0, 25, 50, 75, 100])
        .join('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', (d) => y(d))
        .attr('y2', (d) => y(d))
        .attr('stroke', '#e2e8f0')
        .attr('stroke-dasharray', '3,3');

      // Gradient fill for Area
      const defs = svg.append('defs');
      const grad = defs
        .append('linearGradient')
        .attr('id', 'att-area-grad')
        .attr('x1', '0%')
        .attr('y1', '0%')
        .attr('x2', '0%')
        .attr('y2', '100%');
      grad.append('stop').attr('offset', '0%').attr('stop-color', '#065f46').attr('stop-opacity', 0.24);
      grad.append('stop').attr('offset', '100%').attr('stop-color', '#065f46').attr('stop-opacity', 0.02);

      const xCenter = (label: string) => (x(label) ?? 0) + x.bandwidth() / 2;

      const area = d3
        .area<MonthlyAttendancePoint>()
        .x((d) => xCenter(d.label))
        .y0(innerHeight)
        .y1((d) => y(d.rate))
        .curve(d3.curveMonotoneX);

      const line = d3
        .line<MonthlyAttendancePoint>()
        .x((d) => xCenter(d.label))
        .y((d) => y(d.rate))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(monthlyAttendance)
        .attr('fill', 'url(#att-area-grad)')
        .attr('d', area);

      g.append('path')
        .datum(monthlyAttendance)
        .attr('fill', 'none')
        .attr('stroke', '#065f46')
        .attr('stroke-width', 2.5)
        .attr('d', line);

      // Vertical hover crosshair
      const crosshair = g
        .append('line')
        .attr('y1', 0)
        .attr('y2', innerHeight)
        .attr('stroke', '#94a3b8')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '3,3')
        .style('opacity', 0);

      // Data points + interactive hover targets
      const nodes = g
        .selectAll('g.att-node')
        .data(monthlyAttendance)
        .join('g')
        .attr('class', 'att-node')
        .attr('transform', (d) => `translate(${xCenter(d.label)},${y(d.rate)})`);

      nodes
        .append('circle')
        .attr('r', 4.5)
        .attr('fill', '#ffffff')
        .attr('stroke', '#065f46')
        .attr('stroke-width', 2.2);

      nodes
        .append('text')
        .attr('y', -10)
        .attr('text-anchor', 'middle')
        .attr('fill', '#0f172a')
        .style('font-size', '10px')
        .style('font-weight', '600')
        .style('font-variant-numeric', 'tabular-nums')
        .text((d) => `${d.rate}%`);

      // Wide invisible hit zones per month
      g.selectAll('rect.att-hit')
        .data(monthlyAttendance)
        .join('rect')
        .attr('class', 'att-hit')
        .attr('x', (d) => x(d.label) ?? 0)
        .attr('y', 0)
        .attr('width', x.bandwidth())
        .attr('height', innerHeight)
        .attr('fill', 'transparent')
        .style('cursor', 'pointer')
        .on('mouseenter', function (_event, d) {
          const cx = xCenter(d.label);
          crosshair.attr('x1', cx).attr('x2', cx).style('opacity', 1);
          setAttTooltip({
            x: margin.left + cx,
            y: margin.top + y(d.rate),
            point: d,
          });
        })
        .on('mouseleave', function () {
          crosshair.style('opacity', 0);
          setAttTooltip(null);
        });

      const yAxis = d3
        .axisLeft(y)
        .tickValues([0, 25, 50, 75, 100])
        .tickFormat((v) => `${v}%`);

      g.append('g')
        .call(yAxis)
        .call((ax) => ax.select('.domain').remove())
        .selectAll('text')
        .attr('fill', '#64748b')
        .style('font-size', '10px')
        .style('font-variant-numeric', 'tabular-nums');
    } else {
      // Stacked Monthly Counts mode (Hadir, Izin, Sakit, Alpa)
      const maxTotal = Math.max(4, d3.max(monthlyAttendance, (d) => d.total) || 4);
      const y = d3.scaleLinear().domain([0, maxTotal]).nice().range([innerHeight, 0]);

      g.append('g')
        .selectAll('line')
        .data(y.ticks(4))
        .join('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', (d) => y(d))
        .attr('y2', (d) => y(d))
        .attr('stroke', '#e2e8f0')
        .attr('stroke-dasharray', '3,3');

      const keys: Array<keyof Pick<MonthlyAttendancePoint, 'hadir' | 'izin' | 'sakit' | 'alpa'>> = [
        'hadir',
        'izin',
        'sakit',
        'alpa',
      ];
      const colorMap: Record<string, string> = {
        hadir: '#065f46',
        izin: '#0284c7',
        sakit: '#d97706',
        alpa: '#dc2626',
      };

      const stackGen = d3.stack<MonthlyAttendancePoint>().keys(keys);
      const stackedSeries = stackGen(monthlyAttendance);

      const barGroup = g
        .selectAll('g.stack-layer')
        .data(stackedSeries)
        .join('g')
        .attr('class', 'stack-layer')
        .attr('fill', (d) => colorMap[d.key]);

      barGroup
        .selectAll('rect')
        .data((d) => d)
        .join('rect')
        .attr('x', (d) => x(d.data.label) ?? 0)
        .attr('y', (d) => y(d[1]))
        .attr('height', (d) => Math.max(0, y(d[0]) - y(d[1])))
        .attr('width', Math.min(44, x.bandwidth()))
        .attr('transform', () => {
          const w = Math.min(44, x.bandwidth());
          const offset = (x.bandwidth() - w) / 2;
          return `translate(${offset},0)`;
        })
        .attr('rx', 2)
        .style('cursor', 'pointer')
        .on('mouseenter', function (_event, d) {
          d3.select(this).attr('opacity', 0.85);
          const cx = (x(d.data.label) ?? 0) + x.bandwidth() / 2;
          setAttTooltip({
            x: margin.left + cx,
            y: margin.top + y(d.data.total),
            point: d.data,
          });
        })
        .on('mouseleave', function () {
          d3.select(this).attr('opacity', 1);
          setAttTooltip(null);
        });

      const yAxis = d3.axisLeft(y).ticks(4).tickFormat(d3.format('d'));
      g.append('g')
        .call(yAxis)
        .call((ax) => ax.select('.domain').remove())
        .selectAll('text')
        .attr('fill', '#64748b')
        .style('font-size', '10px')
        .style('font-variant-numeric', 'tabular-nums');
    }

    const xAxis = d3.axisBottom(x).tickSizeOuter(0);
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis)
      .call((ax) => ax.select('.domain').attr('stroke', '#cbd5e1'))
      .selectAll('text')
      .attr('fill', '#475569')
      .style('font-size', '10.5px')
      .style('font-weight', '500');
  }, [monthlyAttendance, attendanceChartMode, attWidth]);

  // D3 Render Effect 2: Class Average Grade & Evaluation Progression Chart
  useEffect(() => {
    const svgEl = gradeSvgRef.current;
    if (!svgEl) return;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const height = 260;
    const margin = { top: 20, right: 20, bottom: 36, left: 42 };
    const innerWidth = Math.max(180, gradeWidth - margin.left - margin.right);
    const innerHeight = height - margin.top - margin.bottom;

    svg.attr('viewBox', `0 0 ${gradeWidth} ${height}`);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    if (classGradeSeries.length === 0 || activeGradeClassesCount === 0) {
      return;
    }

    const y = d3.scaleLinear().domain([0, 100]).range([innerHeight, 0]);

    // Horizontal gridlines
    g.append('g')
      .selectAll('line')
      .data([0, 25, 50, 75, 100])
      .join('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', (d) => y(d))
      .attr('y2', (d) => y(d))
      .attr('stroke', (d) => (d === 75 ? '#d97706' : '#e2e8f0'))
      .attr('stroke-width', (d) => (d === 75 ? 1.2 : 1))
      .attr('stroke-dasharray', (d) => (d === 75 ? '5,4' : '3,3'));

    // KKM 75 indicator label
    g.append('text')
      .attr('x', innerWidth - 2)
      .attr('y', y(75) - 4)
      .attr('text-anchor', 'end')
      .attr('fill', '#b45309')
      .style('font-size', '9.5px')
      .style('font-weight', '600')
      .text('Target KKM 75');

    const yAxis = d3.axisLeft(y).tickValues([0, 25, 50, 75, 100]);
    g.append('g')
      .call(yAxis)
      .call((ax) => ax.select('.domain').remove())
      .selectAll('text')
      .attr('fill', '#64748b')
      .style('font-size', '10px')
      .style('font-variant-numeric', 'tabular-nums');

    if (gradeChartMode === 'bars') {
      const x = d3
        .scaleBand<string>()
        .domain(classGradeSeries.map((d) => d.className))
        .range([0, innerWidth])
        .padding(0.28);

      const barW = Math.min(46, x.bandwidth());

      const bars = g
        .selectAll('g.class-bar')
        .data(classGradeSeries)
        .join('g')
        .attr('class', 'class-bar')
        .attr('transform', (d) => `translate(${(x(d.className) ?? 0) + (x.bandwidth() - barW) / 2},0)`);

      bars
        .append('rect')
        .attr('y', (d) => y(d.finalAvg))
        .attr('width', barW)
        .attr('height', (d) => Math.max(0, innerHeight - y(d.finalAvg)))
        .attr('rx', 4)
        .attr('fill', (d) => {
          if (d.count === 0) return '#e2e8f0';
          if (selectedClassName && selectedClassName !== d.className) {
            return d.finalAvg >= 75 ? '#a7f3d0' : '#fde68a';
          }
          return d.finalAvg >= 75 ? '#065f46' : '#d97706';
        })
        .style('cursor', 'pointer')
        .on('mouseenter', function (_event, d) {
          d3.select(this).attr('opacity', 0.88);
          const cx = (x(d.className) ?? 0) + x.bandwidth() / 2;
          setGradeTooltip({
            x: margin.left + cx,
            y: margin.top + y(d.finalAvg),
            title: `Kelas ${d.className}`,
            subtitle: `Wali Kelas: ${d.homeroomTeacher} (${d.count} data nilai)`,
            metrics: [
              { label: 'Rata-rata UH', value: d.count > 0 ? String(d.uhAvg) : '-' },
              { label: 'Rata-rata UTS', value: d.count > 0 ? String(d.utsAvg) : '-' },
              { label: 'Rata-rata UAS', value: d.count > 0 ? String(d.uasAvg) : '-' },
              { label: 'Nilai Akhir', value: d.count > 0 ? String(d.finalAvg) : '-' },
            ],
          });
        })
        .on('mouseleave', function () {
          d3.select(this).attr('opacity', 1);
          setGradeTooltip(null);
        })
        .on('click', (_event, d) => {
          setSelectedClassName((prev) => (prev === d.className ? null : d.className));
        });

      bars
        .append('text')
        .attr('x', barW / 2)
        .attr('y', (d) => y(d.finalAvg) - 6)
        .attr('text-anchor', 'middle')
        .attr('fill', '#0f172a')
        .style('font-size', '10.5px')
        .style('font-weight', '600')
        .style('font-variant-numeric', 'tabular-nums')
        .text((d) => (d.count > 0 ? d.finalAvg.toFixed(1) : '-'));

      const xAxis = d3.axisBottom(x).tickSizeOuter(0);
      g.append('g')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(xAxis)
        .call((ax) => ax.select('.domain').attr('stroke', '#cbd5e1'))
        .selectAll('text')
        .attr('fill', '#475569')
        .style('font-size', '10.5px')
        .style('font-weight', '500');
    } else {
      // Multi-Line Progression across UH -> UTS -> UAS -> Nilai Akhir
      const stages = ['UH', 'UTS', 'UAS', 'Nilai Akhir'] as const;
      const x = d3
        .scalePoint<string>()
        .domain([...stages])
        .range([18, innerWidth - 18]);

      const activeClasses = classGradeSeries.filter((c) => c.count > 0);
      const lineGen = d3
        .line<{ stage: string; val: number }>()
        .x((d) => x(d.stage) ?? 0)
        .y((d) => y(d.val))
        .curve(d3.curveMonotoneX);

      activeClasses.forEach((cls, idx) => {
        const color = CLASS_LINE_COLORS[idx % CLASS_LINE_COLORS.length];
        const isDimmed = Boolean(selectedClassName && selectedClassName !== cls.className);
        const pts = [
          { stage: 'UH', val: cls.uhAvg },
          { stage: 'UTS', val: cls.utsAvg },
          { stage: 'UAS', val: cls.uasAvg },
          { stage: 'Nilai Akhir', val: cls.finalAvg },
        ];

        g.append('path')
          .datum(pts)
          .attr('fill', 'none')
          .attr('stroke', color)
          .attr('stroke-width', selectedClassName === cls.className ? 3 : 2)
          .attr('opacity', isDimmed ? 0.25 : 0.95)
          .attr('d', lineGen)
          .style('cursor', 'pointer')
          .on('click', () =>
            setSelectedClassName((prev) => (prev === cls.className ? null : cls.className))
          );

        g.selectAll(`circle.pt-${idx}`)
          .data(pts)
          .join('circle')
          .attr('class', `pt-${idx}`)
          .attr('cx', (d) => x(d.stage) ?? 0)
          .attr('cy', (d) => y(d.val))
          .attr('r', selectedClassName === cls.className ? 5 : 4)
          .attr('fill', '#ffffff')
          .attr('stroke', color)
          .attr('stroke-width', 2.2)
          .attr('opacity', isDimmed ? 0.3 : 1)
          .style('cursor', 'pointer')
          .on('mouseenter', function (_event, d) {
            d3.select(this).attr('r', 6.5);
            setGradeTooltip({
              x: margin.left + (x(d.stage) ?? 0),
              y: margin.top + y(d.val),
              title: `Kelas ${cls.className} · ${d.stage}`,
              subtitle: `Wali Kelas: ${cls.homeroomTeacher}`,
              metrics: [
                { label: 'UH', value: String(cls.uhAvg) },
                { label: 'UTS', value: String(cls.utsAvg) },
                { label: 'UAS', value: String(cls.uasAvg) },
                { label: 'Nilai Akhir', value: String(cls.finalAvg) },
              ],
            });
          })
          .on('mouseleave', function () {
            d3.select(this).attr('r', selectedClassName === cls.className ? 5 : 4);
            setGradeTooltip(null);
          })
          .on('click', () =>
            setSelectedClassName((prev) => (prev === cls.className ? null : cls.className))
          );
      });

      const xAxis = d3.axisBottom(x).tickSizeOuter(0);
      g.append('g')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(xAxis)
        .call((ax) => ax.select('.domain').attr('stroke', '#cbd5e1'))
        .selectAll('text')
        .attr('fill', '#475569')
        .style('font-size', '10.5px')
        .style('font-weight', '600');
    }
  }, [
    classGradeSeries,
    activeGradeClassesCount,
    gradeChartMode,
    gradeWidth,
    selectedClassName,
  ]);

  const selectedClassDetail = useMemo(
    () => classGradeSeries.find((c) => c.className === selectedClassName) || null,
    [classGradeSeries, selectedClassName]
  );

  return (
    <div className="grid lg:grid-cols-12 gap-6">
      {/* CHART 1: D3.js TREN KEHADIRAN SISWA PER BULAN */}
      <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs font-medium text-emerald-800 flex items-center gap-1.5">
              <CalendarCheck className="w-3.5 h-3.5" />
              <span>Visualisasi D3.js · Kehadiran Siswa</span>
            </div>
            <h2 className="text-base font-semibold text-slate-950 mt-0.5">
              Tren Kehadiran Siswa per Bulan
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 font-tabular">
              Rata-rata hadir: {attendanceSummaryStats.avgRate}% · Total:{' '}
              {attendanceSummaryStats.totalSessions} catatan
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter rombel kehadiran"
              value={attendanceClassFilter}
              onChange={(e) => setAttendanceClassFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-700"
            >
              <option value="semua">Semua Rombel</option>
              {availableAttendanceClasses.map((cName) => (
                <option key={cName} value={cName}>
                  Kelas {cName}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setAttendanceChartMode('rate')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  attendanceChartMode === 'rate'
                    ? 'bg-white text-slate-950 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Persentase (%)
              </button>
              <button
                type="button"
                onClick={() => setAttendanceChartMode('counts')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  attendanceChartMode === 'counts'
                    ? 'bg-white text-slate-950 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Komposisi Status
              </button>
            </div>
          </div>
        </div>

        {/* Chart Viewport */}
        <div ref={attContainerRef} className="relative w-full min-h-[260px]">
          {monthlyAttendance.length === 0 ? (
            <div className="h-[260px] bg-slate-50 border border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center p-6 text-center space-y-2.5">
              <p className="text-xs text-slate-600 max-w-sm leading-relaxed">
                Belum ada data kehadiran siswa terekam. Mulai pencatatan presensi kelas agar grafik
                tren bulanan D3.js ditampilkan secara interaktif.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('attendance')}
                className="px-3.5 py-1.5 text-xs font-semibold bg-emerald-800 text-white rounded-lg hover:bg-emerald-900"
              >
                Catat Absensi Siswa
              </button>
            </div>
          ) : (
            <>
              <svg
                ref={attSvgRef}
                className="w-full h-[260px] block overflow-visible"
                role="img"
                aria-label="Grafik D3 tren kehadiran siswa per bulan"
              />
              {attTooltip && (
                <div
                  className="pointer-events-none absolute z-20 bg-slate-950 text-white rounded-lg px-3 py-2 text-xs shadow-lg whitespace-nowrap"
                  style={{
                    left: `${Math.min(Math.max(attTooltip.x, 70), Math.max(80, attWidth - 150))}px`,
                    top: `${Math.max(8, attTooltip.y - 78)}px`,
                    transform: 'translateX(-50%)',
                  }}
                >
                  <div className="font-semibold text-emerald-300">
                    {attTooltip.point.label} · {attTooltip.point.rate}% Hadir
                  </div>
                  <div className="text-[11px] font-tabular text-slate-200 mt-0.5 space-x-2">
                    <span>Hadir: {attTooltip.point.hadir}</span>
                    <span>Izin: {attTooltip.point.izin}</span>
                    <span>Sakit: {attTooltip.point.sakit}</span>
                    <span>Alpa: {attTooltip.point.alpa}</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Clean Unboxed Legend */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          {attendanceChartMode === 'rate' ? (
            <div className="flex items-center gap-2">
              <span className="w-3 h-0.5 bg-emerald-800 inline-block" />
              <span>Tingkat Kehadiran Siswa (%) per Bulan</span>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-emerald-800 rounded-xs inline-block" /> Hadir
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-sky-600 rounded-xs inline-block" /> Izin
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-amber-600 rounded-xs inline-block" /> Sakit
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-red-600 rounded-xs inline-block" /> Alpa
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={() => onNavigate('attendance')}
            className="text-xs font-semibold text-emerald-800 hover:underline"
          >
            Buka Rekap Absensi →
          </button>
        </div>
      </div>

      {/* CHART 2: D3.js GRAFIK PERKEMBANGAN NILAI RATA-RATA KELAS */}
      <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs font-medium text-emerald-800 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Visualisasi D3.js · Capaian Akademik</span>
            </div>
            <h2 className="text-base font-semibold text-slate-950 mt-0.5">
              Perkembangan Nilai Rata-Rata Kelas
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 font-tabular">
              {activeGradeClassesCount} dari {classGradeSeries.length} rombel memiliki data nilai
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter semester nilai"
              value={gradeSemesterFilter}
              onChange={(e) =>
                setGradeSemesterFilter(e.target.value as 'semua' | 'Ganjil' | 'Genap')
              }
              className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-700"
            >
              <option value="semua">Semua Semester</option>
              <option value="Ganjil">Semester Ganjil</option>
              <option value="Genap">Semester Genap</option>
            </select>
            <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setGradeChartMode('bars')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1 ${
                  gradeChartMode === 'bars'
                    ? 'bg-white text-slate-950 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BarChart3 className="w-3 h-3" /> Per Kelas
              </button>
              <button
                type="button"
                onClick={() => setGradeChartMode('progression')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  gradeChartMode === 'progression'
                    ? 'bg-white text-slate-950 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tren UH–UAS
              </button>
            </div>
          </div>
        </div>

        {/* Chart Viewport */}
        <div ref={gradeContainerRef} className="relative w-full min-h-[260px]">
          {activeGradeClassesCount === 0 ? (
            <div className="h-[260px] bg-slate-50 border border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center p-6 text-center space-y-2.5">
              <p className="text-xs text-slate-600 max-w-sm leading-relaxed">
                Belum ada nilai akademik siswa yang diinputkan. Tambahkan nilai pada modul Akademik
                &amp; Siswa untuk memantau perkembangan rata-rata tiap rombel dengan D3.js.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('academic')}
                className="px-3.5 py-1.5 text-xs font-semibold bg-emerald-800 text-white rounded-lg hover:bg-emerald-900"
              >
                Input Nilai Siswa
              </button>
            </div>
          ) : (
            <>
              <svg
                ref={gradeSvgRef}
                className="w-full h-[260px] block overflow-visible"
                role="img"
                aria-label="Grafik D3 perkembangan nilai rata-rata kelas"
              />
              {gradeTooltip && (
                <div
                  className="pointer-events-none absolute z-20 bg-slate-950 text-white rounded-lg px-3 py-2 text-xs shadow-lg whitespace-nowrap"
                  style={{
                    left: `${Math.min(Math.max(gradeTooltip.x, 85), Math.max(95, gradeWidth - 155))}px`,
                    top: `${Math.max(8, gradeTooltip.y - 84)}px`,
                    transform: 'translateX(-50%)',
                  }}
                >
                  <div className="font-semibold text-emerald-300">{gradeTooltip.title}</div>
                  <div className="text-[11px] text-slate-300">{gradeTooltip.subtitle}</div>
                  <div className="text-[11px] font-tabular text-slate-100 mt-1 flex items-center gap-2.5">
                    {gradeTooltip.metrics.map((m) => (
                      <span key={m.label}>
                        {m.label}: <strong>{m.value}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Interactive Class Legend / Selection Detail */}
        <div className="pt-3 border-t border-slate-100 space-y-2">
          {gradeChartMode === 'progression' && activeGradeClassesCount > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {classGradeSeries
                .filter((c) => c.count > 0)
                .map((cls, idx) => {
                  const color = CLASS_LINE_COLORS[idx % CLASS_LINE_COLORS.length];
                  const active = selectedClassName === cls.className;
                  return (
                    <button
                      key={cls.className}
                      type="button"
                      onClick={() =>
                        setSelectedClassName((prev) =>
                          prev === cls.className ? null : cls.className
                        )
                      }
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs transition-colors ${
                        active
                          ? 'border-slate-900 bg-slate-100 font-semibold text-slate-950'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-xs inline-block"
                        style={{ backgroundColor: color }}
                      />
                      <span>{cls.className}</span>
                    </button>
                  );
                })}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
            {selectedClassDetail ? (
              <div className="font-tabular text-slate-800">
                <span className="font-semibold text-emerald-900">
                  Kelas {selectedClassDetail.className}
                </span>{' '}
                · UH {selectedClassDetail.uhAvg} · UTS {selectedClassDetail.utsAvg} · UAS{' '}
                {selectedClassDetail.uasAvg} · Akhir{' '}
                <span className="font-semibold">{selectedClassDetail.finalAvg}</span>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-emerald-800 rounded-xs inline-block" /> ≥ 75 (Tuntas)
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-amber-600 rounded-xs inline-block" /> &lt; 75 (Perlu Pembinaan)
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={() => onNavigate('academic')}
              className="text-xs font-semibold text-emerald-800 hover:underline"
            >
              Kelola Nilai &amp; Rombel →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
