import { TestBed } from '@angular/core/testing';
import { DashboardComponent } from './dashboard.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('DashboardComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, DashboardComponent]
    }).compileComponents();
  });

  it('should create', () => {
    const f = TestBed.createComponent(DashboardComponent);
    expect(f.componentInstance).toBeTruthy();
  });
});
