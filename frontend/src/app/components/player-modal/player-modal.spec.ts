import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PlayerModalComponent } from './player-modal';

describe('PlayerModalComponent', () => {
  let c: PlayerModalComponent, f: ComponentFixture<PlayerModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlayerModalComponent]
    }).compileComponents();

    f = TestBed.createComponent(PlayerModalComponent);
    c = f.componentInstance;
    c.player = { id: 1, team: 'HOME', name: 'Test' } as any; // id en number
    f.detectChanges();
  });

  it('should create', () => {
    expect(c).toBeTruthy();
  });
});
