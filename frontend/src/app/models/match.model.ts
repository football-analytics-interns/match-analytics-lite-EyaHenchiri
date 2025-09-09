import { Player } from './player.model';
import { Event } from './event.model';

/** Modèle UI utilisé par tes composants (match + players + events ensemble) */
export interface Match {
  id: number;
  dateUtc: string;      // backend renvoie 'date' (OffsetDateTime ISO) → mappé ici
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  players: Player[];
  events: Event[];
}
