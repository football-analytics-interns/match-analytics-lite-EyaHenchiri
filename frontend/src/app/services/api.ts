import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, catchError, of } from 'rxjs';
import { Match } from '../models/match.model';
import { Event } from '../models/event.model';
import { Player } from '../models/player.model';

/** ---- Types "backend" stricts (ce que renvoie Spring) ---- */
interface MatchInfoApi {
  id: number;
  date: string;         // OffsetDateTime ISO
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
}
interface PlayerApi {
  id: number;
  name: string;
  team: string;
  position?: string;
  goals?: number;
  assists?: number;
  formRating?: number;  // <- nom côté backend
}
interface EventApi {
  id: number;
  playerId: number;
  minute: number;
  type: string;
  meta?: Record<string, unknown>;
}
interface MatchResponseApi {
  match: MatchInfoApi | null;
  players: PlayerApi[];
  events: EventApi[];
}

/** ---- Service ---- */
@Injectable({ providedIn: 'root' })
export class Api {
  private http = inject(HttpClient);
  private base = 'http://localhost:8080/api';

  /** GET /api/match → mappe vers modèle UI Match */
  getMatch() {
  return this.http.get<MatchResponseApi>(`${this.base}/match`).pipe(
    map((res) => {
      const m = res.match;
      if (!m) throw new Error('No match returned');

      const players: Player[] = res.players.map(p => ({
        id: p.id, name: p.name, team: p.team, position: p.position,
        goals: p.goals ?? 0, assists: p.assists ?? 0, rating: p.formRating ?? 0
      }));

      const events: Event[] = res.events.map(e => ({
        id: e.id, playerId: e.playerId, minute: e.minute,
        type: e.type as any, meta: (e.meta ?? {}) as Record<string, unknown>
      }));

      const matchUi: Match = {
        id: m.id,
        dateUtc: m.date,
        homeTeam: m.homeTeam,
        awayTeam: m.awayTeam,
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        players, events
      };
      return matchUi;
    })
  );
}



  /** POST /api/event : meta doit être un OBJET, pas une string */
  createEvent(e: Omit<Event, 'id'>) {
    const payload: Partial<EventApi> = {
      playerId: e.playerId,
      minute: e.minute,
      type: e.type,
      meta: e.meta ?? {}
    };
    return this.http.post<EventApi>(`${this.base}/event`, payload).pipe(
      map(saved => ({
        id: saved.id,
        playerId: saved.playerId,
        minute: saved.minute,
        type: saved.type as any,
        meta: (saved.meta ?? {}) as Record<string, unknown>
      })),
      // fallback local si besoin
      catchError(() => {
        const fake: Event = { id: Math.random(), ...e };
        return of(fake);
      })
    );
  }

  /** GET /api/player/{id} : mappe formRating -> rating */
  getPlayer(id: number) {
    return this.http.get<PlayerApi>(`${this.base}/player/${id}`).pipe(
      map(p => ({
        id: p.id,
        name: p.name,
        team: p.team,
        position: p.position,
        goals: p.goals ?? 0,
        assists: p.assists ?? 0,
        rating: p.formRating ?? 0
      })),
      catchError(() => of<Player>({ id, name: 'Unknown', team: '', rating: 0 }))
    );
  }
}
