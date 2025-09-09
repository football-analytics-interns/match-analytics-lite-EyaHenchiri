import {
  Component, EventEmitter, Input, Output,
  ViewChild, ElementRef, OnChanges, SimpleChanges, AfterViewInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Player } from '../../models/player.model';
import { Event as Ev } from '../../models/event.model';
import Chart from 'chart.js/auto';

@Component({
  selector: 'app-player-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './player-modal.html',
  styleUrls: ['./player-modal.scss']
})
export class PlayerModalComponent implements OnChanges, AfterViewInit {
  @Input({ required: true }) player!: Player;
  @Input() events: Ev[] = [];
  @Input() minuteMax = 90;
  @Input() open = false;

  @Output() closed = new EventEmitter<void>();
  @ViewChild('formCanvas') formCanvas?: ElementRef<HTMLCanvasElement>;

  private chart?: Chart;
  private readonly BUCKETS = [0,15,30,45,60,75,90,105,120];

  ngAfterViewInit() {
    this.render();     // rendu initial une fois le canvas disponible
  }
  ngOnChanges(_: SimpleChanges) {
    // Lorsqu'on change de joueur / minute / open → re-rendu
    queueMicrotask(() => this.render());
  }

  close() { this.closed.emit(); }

  /* -------------------------- Chart rendering --------------------------- */
  private render() {
    // si modal fermée, on nettoie et on sort
    if (!this.open) { this.destroyChart(); return; }
    const ctx = this.formCanvas?.nativeElement?.getContext('2d');
    if (!ctx || !this.player) return;

    // calcule la série de rating jusqu’à minuteMax
    const xs = this.BUCKETS.filter(m => m <= this.minuteMax);
    const ys = xs.map(m => +this.ratingAtMinute(this.events, this.player.id, m).toFixed(2));

    this.destroyChart();
    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: xs.map(m => `${m}′`),
        datasets: [
          { label: 'Rating', data: ys, fill: false }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: true } },
        scales: {
          x: { ticks: { color: '#c8d2f2' } },
          y: {
            ticks: { color: '#c8d2f2' },
            suggestedMin: 6,
            suggestedMax: 10
          }
        },
        elements: { point: { radius: 2 } }
      }
    });
  }

  private destroyChart() {
    this.chart?.destroy();
    this.chart = undefined;
  }

  /* ----------------------- Rating helpers (local) ----------------------- */
  private ratingAtMinute(events: Ev[], playerId: number, minute: number): number {
    let g = 0, a = 0, t = 0;
    for (const e of events) {
      if (e.minute > minute) continue;
      if (e.type === 'GOAL' && e.playerId === playerId) g++;
      // assist sur GOAL via meta.assistId (backend)
      const aId = (e as any)?.meta?.assistId;
      if (e.type === 'GOAL' && aId === playerId) a++;
      if (e.type === 'ASSIST' && e.playerId === playerId) a++;
      if (e.type === 'TACKLE' && e.playerId === playerId) t++;
    }
    return Math.min(10, 6.5 + g * 1.5 + a * 0.8 + t * 0.2);
  }
}
