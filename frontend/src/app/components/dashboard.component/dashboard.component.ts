import {
  Component, OnInit, OnDestroy, ViewChild, ElementRef,
  computed, effect, signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import Chart from 'chart.js/auto';

import { Api } from '../../services/api';
import { Match } from '../../models/match.model';
import { Player } from '../../models/player.model';
import { Event } from '../../models/event.model';
import { buildSparkline, buckets } from '../../utils/sparkline.util';
import { PlayerModalComponent } from '../player-modal/player-modal';

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
  constructor(private api: Api, private sanitizer: DomSanitizer) {}

  /* ======================== STATE (signals) ======================== */
  match     = signal<Match | null>(null);
  minuteMax = signal(90);
  orderBy   = signal<OrderBy>('rating');
  team      = signal<TeamFilter>('ALL');
  search    = signal('');
  error     = signal<string | null>(null);
  loading   = signal(true);

  selected  = signal<Player | null>(null);
  showModal = signal(false);

  @ViewChild('gaCanvas', { static: false }) gaCanvas?: ElementRef<HTMLCanvasElement>;
  private gaChart?: Chart;

  /* --------- lignes du tableau -------- */
  rows = computed<Player[]>(() => {
    const m = this.match(); if (!m) return [];
    return computeStats(m, this.minuteMax());
  });

  /* --------- filtres --------- */
  filtered = computed<Player[]>(() => {
    const m = this.match(); if (!m) return [];
    const t = this.team();
    const q = this.search().trim().toLowerCase();
    const home = m.homeTeam, away = m.awayTeam;

    return this.rows().filter(p => {
      const teamOk =
        t === 'ALL' ||
        (t === 'HOME' && p.team === home) ||
        (t === 'AWAY' && p.team === away);
      const nameOk = q === '' || p.name.toLowerCase().includes(q);
      return teamOk && nameOk;
    });
  });

  /* --------- tri --------- */
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

  /* --------- pitch map + pass network --------- */
  pitch = computed(() => computePitch(this.match(), this.minuteMax(), this.team(), this.search()));

  /* --------- chart Goals/Assists --------- */
  private dispose = effect(() => {
    const rows = this.sorted();
    queueMicrotask(() => this.renderGAChart(rows));
  });

  ngOnInit() { this.load(); }
  ngOnDestroy() { this.gaChart?.destroy(); }

  /* ========================= DATA LOADING ========================= */
  load() {
    this.loading.set(true);
    this.error.set(null);
    this.api.getMatch().subscribe({
      next: (m) => { this.match.set(m); this.loading.set(false); },
      error: () => { this.error.set('Impossible de charger les données'); this.loading.set(false); }
    });
  }

  /* ========================= UI HANDLERS ========================= */
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

  /* ========================= CHART.JS ========================= */
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

  /* ================== FORMULAIRE D'AJOUT D'ÉVÉNEMENT ================== */
  evtTypes: Array<Event['type']> = ['GOAL','ASSIST','SHOT','TACKLE','PASS'];

  private initialNE = {
    playerId: null as number | null,
    minute: 10,
    type: 'GOAL' as Event['type'],
    assistId: null as number | null,
    targetId: null as number | null,
    x: null as number | null,
    y: null as number | null
  };
  newEvent = signal({ ...this.initialNE });
  postOk = signal(false);
  postError = signal<string | null>(null);

  setNE<K extends keyof typeof this.initialNE>(k: K, v: (typeof this.initialNE)[K]) {
    this.newEvent.update(s => ({ ...s, [k]: v }));
  }
  resetNE() { this.newEvent.set({ ...this.initialNE }); }

  canSubmitNE = computed(() => {
    const ne = this.newEvent();
    if (!ne.playerId || !ne.type || Number.isNaN(ne.minute)) return false;
    if (ne.minute < 0 || ne.minute > 120) return false;
    if (ne.type === 'PASS' && !ne.targetId) return false;
    if ((ne.type === 'GOAL' || ne.type === 'SHOT') &&
        (ne.x == null || ne.y == null || Number.isNaN(ne.x) || Number.isNaN(ne.y))) return false;
    return true;
  });

  submitEvent() {
    this.postOk.set(false); this.postError.set(null);
    const ne = this.newEvent();
    const meta: Record<string, unknown> = {};
    if (ne.assistId) meta['assistId'] = ne.assistId;
    if (ne.targetId) meta['targetPlayerId'] = ne.targetId;
    if (ne.x != null && ne.y != null) { meta['x'] = ne.x; meta['y'] = ne.y; }

    this.api.createEvent({
      playerId: ne.playerId!, minute: ne.minute, type: ne.type, meta
    }).subscribe({
      next: (saved) => {
        const m = this.match();
        if (m) this.match.set({ ...m, events: [...m.events, saved] });
        this.postOk.set(true);
        this.resetNE();
        setTimeout(() => this.postOk.set(false), 1500);
      },
      error: () => this.postError.set('Échec de l’ajout (réseau/API).')
    });
  }
}

/* ============================ UTILS PURS ============================ */

/** Sécurise l’accès au meta (indexé) en respectant noPropertyAccessFromIndexSignature */
function metaOf(e: unknown): Record<string, unknown> | null {
  const m = (e as any)?.meta;
  return m && typeof m === 'object' ? (m as Record<string, unknown>) : null;
}

export function computeStats(match: Match, minuteMax = 120): Player[] {
  const goals = new Map<number, number>(),
        assists = new Map<number, number>(),
        tackles = new Map<number, number>(),
        impact = new Map<number, number>();

  for (const e of match.events) {
    if (e.minute > minuteMax) continue;

    if (e.type === 'GOAL') {
      goals.set(e.playerId, (goals.get(e.playerId) ?? 0) + 1);
      const aId = metaOf(e)?.['assistId'] as number | undefined;
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
  for (const e of match.events) {
    if (e.minute > minute) continue;
    if (e.type==='GOAL'   && e.playerId===playerId) g++;
    const aId = metaOf(e)?.['assistId'] as number | undefined;
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

/* ---------------- Pitch Map + Pass Network ---------------- */

type Vec2 = { x: number; y: number; };
const ROLE_Y: Record<string, number> = {
  GK:10, LB:25, CB:40, RB:25, CM:50, DM:58, AM:42, LW:30, RW:70, ST:50
};

function posFor(p: Player, homeTeam: string): Vec2 {
  const isHome = p.team === homeTeam;
  const baseX = isHome ? 65 : 35;   // home à droite pour lecture
  const role = (p.position ?? 'CM').toUpperCase();
  const roleY = ROLE_Y[role] ?? 50;
  const dx = isHome ? 20 : -20;
  const hash = [...p.name].reduce((h, c) => h + c.charCodeAt(0), 0) % 9 - 4;
  const y = Math.max(8, Math.min(92, roleY + hash));
  const attack = ['ST','RW','LW','AM'].includes(role) ? (dx * 0.6) : 0;
  return { x: baseX + attack, y };
}

export function computePitch(match: Match | null, minuteMax: number, tFilter: TeamFilter, search: string) {
  const empty = {
    events: [] as Array<{cx:number;cy:number;cls:string;title:string}>,
    edges:  [] as Array<{x1:number;y1:number;x2:number;y2:number;w:number;title:string}>,
    nodes:  [] as Array<{x:number;y:number;name:string}>
  };
  if (!match) return empty;

  const q = search.trim().toLowerCase();
  const home = match.homeTeam, away = match.awayTeam;
  const teamOk = (teamName: string) =>
    tFilter === 'ALL' ||
    (tFilter === 'HOME' && teamName === home) ||
    (tFilter === 'AWAY' && teamName === away);

  const nameOf = new Map(match.players.map(p => [p.id, p.name]));
  const teamOf = new Map(match.players.map(p => [p.id, p.team]));
  const pos = new Map(match.players.map(p => [p.id, posFor(p, home)]));

  // points: GOAL / SHOT avec coordonnées (meta.x/meta.y)
  const events = match.events.flatMap(e => {
    const meta = metaOf(e);
    const x = meta?.['x'] as number | undefined;
    const y = meta?.['y'] as number | undefined;
    if (e.minute > minuteMax || x == null || y == null) return [];
    if (e.type !== 'GOAL' && e.type !== 'SHOT') return [];
    const tname = teamOf.get(e.playerId) ?? '';
    if (!teamOk(tname)) return [];
    const nm = nameOf.get(e.playerId) || '';
    if (q && !nm.toLowerCase().includes(q)) return [];
    const cls = e.type === 'GOAL' ? 'goal' : 'shot';
    return [{ cx: x, cy: y, cls, title: `${e.type} — ${nm} — ${e.minute}′` }];
  });

  // edges: passes (meta.targetPlayerId)
  const passCounts = new Map<string, number>();
  for (const e of match.events) {
    if (e.type !== 'PASS') continue;
    if (e.minute > minuteMax) continue;
    const dst = metaOf(e)?.['targetPlayerId'] as number | undefined;
    if (dst == null) continue;

    const srcP = match.players.find(p => p.id === e.playerId);
    const dstP = match.players.find(p => p.id === dst);
    if (!srcP || !dstP) continue;
    if (!teamOk(srcP.team) || !teamOk(dstP.team)) continue;

    if (q) {
      const sOk = [srcP.name, dstP.name].some(n => n.toLowerCase().includes(q));
      if (!sOk) continue;
    }
    const key = `${srcP.id}>${dstP.id}`;
    passCounts.set(key, (passCounts.get(key) ?? 0) + 1);
  }

  const edges = Array.from(passCounts.entries()).map(([key, count]) => {
    const [src, dst] = key.split('>').map(n => +n);
    const a = pos.get(src)!, b = pos.get(dst)!;
    return {
      x1: a.x, y1: a.y, x2: b.x, y2: b.y,
      w: 0.8 + Math.min(6, count),
      title: `${nameOf.get(src)} → ${nameOf.get(dst)} : ${count} passes`
    };
  });

  // nodes: joueurs visibles
  const nodes = match.players
    .filter(p => teamOk(p.team) && (!q || p.name.toLowerCase().includes(q)))
    .map(p => {
      const v = pos.get(p.id)!;
      return { x: v.x, y: v.y, name: p.name };
    });

  return { events, edges, nodes };
}
