import {
  Component, OnInit, OnDestroy, ViewChild, ElementRef,
  computed, effect, signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Api } from '../../services/api';
import { Match } from '../../models/match.model';
import { Player } from '../../models/player.model';
import { Event } from '../../models/event.model';
import { buildSparkline, buckets } from '../../utils/sparkline.util';
import { PlayerModalComponent } from '../player-modal/player-modal';
import Chart from 'chart.js/auto';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';


type OrderBy = 'rating'|'goals'|'assists'|'tackles'|'name';
type TeamFilter = 'ALL'|'HOME'|'AWAY';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, PlayerModalComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
  constructor(private api: Api , private sanitizer: DomSanitizer) {}

  /* -------------------- state -------------------- */
  match = signal<Match | null>(null);
  minuteMax = signal(90);
  orderBy   = signal<OrderBy>('rating');
  team      = signal<TeamFilter>('ALL');
  search    = signal('');
  error     = signal<string | null>(null);
  loading   = signal(true);

  selected  = signal<Player & { ratingHistory?: number[] } | null>(null);
  showModal = signal(false);

  @ViewChild('gaCanvas', { static: false }) gaCanvas?: ElementRef<HTMLCanvasElement>;
  private gaChart?: Chart;

  /* computed rows (stats) */
  rows = computed<Player[]>(() => {
    const m = this.match(); if (!m) return [];
    return computeStats(m, this.minuteMax());
  });

  filtered = computed<Player[]>(() => {
    const m = this.match();
    const t = this.team();
    const q = this.search().trim().toLowerCase();
    const home = m?.homeTeam, away = m?.awayTeam;

    return this.rows().filter(p => {
      const teamOk =
        t === 'ALL' ||
        (t === 'HOME' && p.team === home) ||
        (t === 'AWAY' && p.team === away);
      const searchOk = q === '' || p.name.toLowerCase().includes(q);
      return teamOk && searchOk;
    });
  });

  sorted = computed<Player[]>(() => {
    const by = this.orderBy();
    const arr = this.filtered().slice();
    switch (by) {
      case 'goals':   return arr.sort((a,b)=> (b.goals||0)-(a.goals||0) || a.name.localeCompare(b.name));
      case 'assists': return arr.sort((a,b)=> (b.assists||0)-(a.assists||0) || a.name.localeCompare(b.name));
      case 'tackles': return arr.sort((a,b)=> (b.tackles||0)-(a.tackles||0) || a.name.localeCompare(b.name));
      case 'name':    return arr.sort((a,b)=> a.name.localeCompare(b.name));
      case 'rating':
      default:        return arr.sort((a,b)=> (b.rating||0)-(a.rating||0) || a.name.localeCompare(b.name));
    }
  });

  // pass network + pitch layers (pré-calcul pour le template SVG)
  pitch = computed(() => computePitch(this.match(), this.minuteMax(), this.team(), this.search()));

  /* chart update side-effect */
  private dispose = effect(() => {
    const rows = this.sorted();
    queueMicrotask(() => this.renderGAChart(rows));
  });

  ngOnInit() { this.load(); }

  ngOnDestroy() { this.gaChart?.destroy(); }

  load() {
    this.loading.set(true);
    this.error.set(null);
    this.api.getMatch().subscribe({
      next: (m) => { this.match.set(m); this.loading.set(false); },
      error: ()   => { this.error.set('Impossible de charger les données'); this.loading.set(false); }
    });
  }

  /* UI handlers */
  setMinute(v: number) { this.minuteMax.set(v); }
  setOrder(v: OrderBy) { this.orderBy.set(v); }
  setTeam(v: TeamFilter){ this.team.set(v); }
  setSearch(v: string)  { this.search.set(v); }

  openPlayer(p: Player) {
    const m = this.match(); if (!m) return;
    const hist = ratingSeries(m, p.id, this.minuteMax());
    this.selected.set({ ...p, ratingHistory: hist });
    this.showModal.set(true);
  }
  closeModal(){ this.showModal.set(false); }

  /* chart */
  private renderGAChart(rows: Player[]) {
    const ctx = this.gaCanvas?.nativeElement?.getContext('2d'); if (!ctx) return;
    this.gaChart?.destroy();
    this.gaChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: rows.map(p => p.name),
        datasets: [
          { label: 'Goals',   data: rows.map(p => p.goals || 0) },
          { label: 'Assists', data: rows.map(p => p.assists || 0) }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: true }, tooltip: { enabled: true } },
        scales: { x: { ticks: { color: '#c8d2f2' } }, y: { ticks: { color: '#c8d2f2' } } }
      }
    });
  }

  /* inline SVG sparkline (dans le tableau) */
  sparklineOf(p: Player) {
    const m = this.match(); if (!m) return '';
    const series = ratingSeries(m, p.id, this.minuteMax());
    return buildSparkline(series, this.minuteMax());
  }
}

/* --------------------- Utils (compatibles backend) --------------------- */

export function computeStats(match: Match, minuteMax = 120): Player[] {
  const goals   = new Map<number, number>();
  const assists = new Map<number, number>();
  const tackles = new Map<number, number>();
  const impact  = new Map<number, number>();

  for (const e of match.events as (Event & { meta?: any })[]) {
    if (e.minute > minuteMax) continue;

    if (e.type === 'GOAL') {
      goals.set(e.playerId, (goals.get(e.playerId) ?? 0) + 1);
      const aId: number | undefined =
        e?.meta?.assistId ?? (e as any).assistPlayerId; // tolère anciens mocks
      if (aId != null) {
        assists.set(aId, (assists.get(aId) ?? 0) + 1);
        if (!impact.has(aId)) impact.set(aId, e.minute);
      }
      if (!impact.has(e.playerId)) impact.set(e.playerId, e.minute);
    } else if (e.type === 'ASSIST') {
      assists.set(e.playerId, (assists.get(e.playerId) ?? 0) + 1);
      if (!impact.has(e.playerId)) impact.set(e.playerId, e.minute);
    } else if (e.type === 'TACKLE') {
      tackles.set(e.playerId, (tackles.get(e.playerId) ?? 0) + 1);
      if (!impact.has(e.playerId)) impact.set(e.playerId, e.minute);
    }
  }

  return match.players.map(p => {
    const g = goals.get(p.id) ?? 0;
    const a = assists.get(p.id) ?? 0;
    const t = tackles.get(p.id) ?? 0;
    const rating = Math.min(10, +(6.5 + g*1.5 + a*0.8 + t*0.2).toFixed(1));
    const imp = impact.get(p.id);
    return { ...p, goals: g, assists: a, tackles: t, rating, impact: imp ?? null };
  });
}

export function ratingAtMinute(match: Match, playerId: number, minute: number) {
  let g=0,a=0,t=0;
  for (const e of match.events as (Event & { meta?: any })[]) {
    if (e.minute > minute) continue;
    if (e.type==='GOAL'   && e.playerId===playerId) g++;
    const aId = e?.meta?.assistId;
    if (e.type==='GOAL'   && aId === playerId) a++;
    if (e.type==='ASSIST' && e.playerId===playerId) a++;
    if (e.type==='TACKLE' && e.playerId===playerId) t++;
  }
  return Math.min(10, 6.5 + g*1.5 + a*0.8 + t*0.2);
}

export function ratingSeries(match: Match, playerId: number, minuteMax: number) {
  const pts = buckets().filter(m => m <= minuteMax);
  return pts.map(m => +ratingAtMinute(match, playerId, m).toFixed(2));
}

/* ---- pitch map / pass network (compatibles meta.x/meta.y/meta.targetPlayerId) ---- */

type Vec2 = { x: number; y: number; };

// mapping "rôle" → Y (pas besoin du type PlayerPosition ici)
const ROLE_Y: Record<string, number> = {
  GK:10, LB:25, CB:40, RB:25, CM:50, DM:58, AM:42, LW:30, RW:70, ST:50
};

function posFor(p: Player): Vec2 {
  // On place HOME à droite (attaque) et AWAY à gauche en se basant sur le nom d’équipe
  // Ici on regarde le match courant pour savoir home/away plus tard dans computePitch
  const role = (p.position ?? 'CM').toUpperCase();
  const roleY = ROLE_Y[role] ?? 50;
  const hash = [...p.name].reduce((h, c) => h + c.charCodeAt(0), 0) % 9 - 4;
  const y = Math.max(8, Math.min(92, roleY + hash));
  // X sera recalculé dans computePitch en fonction home/away
  return { x: 50, y };
}

export function computePitch(
  match: Match | null, minuteMax: number, team: TeamFilter, search: string
) {
  if (!match) {
    return {
      events: [] as Array<{cx:number;cy:number;cls:string;title:string}>,
      edges:  [] as Array<{x1:number;y1:number;x2:number;y2:number;w:number;title:string}>,
      nodes:  [] as Array<{x:number;y:number;name:string}>
    };
  }

  const q = search.trim().toLowerCase();
  const nameOf = new Map(match.players.map(p => [p.id, p.name]));
  const teamName = (pid: number) => match.players.find(p => p.id === pid)?.team;
  const home = match.homeTeam, away = match.awayTeam;

  // positions : place HOME côté droit, AWAY côté gauche
  const basePos = new Map(match.players.map(p => [p.id, posFor(p)]));
  const pos = new Map<number, Vec2>();
  for (const p of match.players) {
    const base = basePos.get(p.id)!;
    const isHome = p.team === home;
    const x = isHome ? 65 + (['ST','RW','LW','AM'].includes((p.position ?? '').toUpperCase()) ? 12 : 0)
                     : 35 - (['ST','RW','LW','AM'].includes((p.position ?? '').toUpperCase()) ? 12 : 0);
    pos.set(p.id, { x, y: base.y });
  }

  // events (GOAL/SHOT), coordonnées stockées dans meta.x/meta.y si présentes
  const events = (match.events as (Event & { meta?: any })[]).flatMap(e => {
    if (e.minute > minuteMax) return [];
    if (e.type !== 'GOAL' && e.type !== 'SHOT') return [];
    const tname = teamName(e.playerId);
    if (team !== 'ALL' && ((team === 'HOME' && tname !== home) || (team === 'AWAY' && tname !== away))) return [];
    const nm = nameOf.get(e.playerId) || '';
    if (q && !nm.toLowerCase().includes(q)) return [];

    const cx = (e.meta?.x ?? null) as number | null;
    const cy = (e.meta?.y ?? null) as number | null;
    if (cx == null || cy == null) return []; // ignore si pas de coords

    const cls = e.type === 'GOAL' ? 'goal' : 'shot';
    return [{ cx, cy, cls, title: `${e.type} — ${nm} — ${e.minute}′` }];
  });

  // passes (edges) : targetPlayerId dans meta.targetPlayerId
  const passCounts = new Map<string, number>();
  for (const e of match.events as (Event & { meta?: any })[]) {
    if (e.type !== 'PASS') continue;
    if (e.minute > minuteMax) continue;
    const dstId: number | undefined = e.meta?.targetPlayerId;
    if (dstId == null) continue;

    const srcP = match.players.find(p => p.id === e.playerId);
    const dstP = match.players.find(p => p.id === dstId);
    if (!srcP || !dstP) continue;

    if (team === 'HOME' && (srcP.team !== home || dstP.team !== home)) continue;
    if (team === 'AWAY' && (srcP.team !== away || dstP.team !== away)) continue;

    const nmSrc = nameOf.get(srcP.id)!, nmDst = nameOf.get(dstP.id)!;
    if (q && ![nmSrc, nmDst].some(n => n.toLowerCase().includes(q))) continue;

    const key = `${srcP.id}>${dstP.id}`;
    passCounts.set(key, (passCounts.get(key) ?? 0) + 1);
  }

  const edges = Array.from(passCounts.entries()).map(([key, count]) => {
    const [src, dst] = key.split('>').map(Number);
    const a = pos.get(src)!, b = pos.get(dst)!;
    return {
      x1: a.x, y1: a.y, x2: b.x, y2: b.y,
      w: 0.8 + Math.min(6, count),
      title: `${nameOf.get(src)} → ${nameOf.get(dst)} : ${count} passes`
    };
  });

  // nodes (players)
  const nodes = match.players
    .filter(p =>
      (team === 'ALL') ||
      (team === 'HOME' && p.team === home) ||
      (team === 'AWAY' && p.team === away)
    )
    .filter(p => !q || p.name.toLowerCase().includes(q))
    .map(p => {
      const v = pos.get(p.id)!;
      return { x: v.x, y: v.y, name: p.name };
    });

  return { events, edges, nodes };
}
