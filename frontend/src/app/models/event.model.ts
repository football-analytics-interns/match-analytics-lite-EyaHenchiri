export type EventType = 'GOAL' | 'ASSIST' | 'SHOT' | 'TACKLE' | 'PASS';

export interface Event {
  id: number;          // ← number (backend = Long)
  playerId: number;    // ← number
  minute: number;
  type: EventType;

  /** Données libres selon le type (assistId, onTarget, x/y...) */
  meta?: {
    assistId?: number;
    onTarget?: boolean;
    x?: number;  // optionnel: si tu ajoutes coords côté backend (dans meta)
    y?: number;
    [k: string]: unknown;
  };
}
