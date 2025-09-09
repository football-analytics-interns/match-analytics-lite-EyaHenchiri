export interface Player {
  id: number;
  name: string;
  team: string;          // ex: "Blue FC" / "Red United"
  position?: string;

  // --- stats côté UI (optionnelles) ---
  goals?: number;
  assists?: number;
  tackles?: number;      // <- manquait
  rating?: number;       // mappe formRating backend -> rating UI
  impact?: number | null;
  ratingHistory?: number[];
}
