import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LandingComponent } from './landing.component';

describe('LandingComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LandingComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('renders the product landing page and pilot disclosures', () => {
    const fixture = TestBed.createComponent(LandingComponent);
    fixture.detectChanges();

    const content = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(content).toContain('Run your restaurant');
    expect(content).toContain('WhatsApp');
    expect(content).toContain('Early access is currently invitation-led');
    expect(content).toContain('Product targets shown for direction');
  });

  it('switches product preview tabs and toggles mobile navigation state', () => {
    const fixture = TestBed.createComponent(LandingComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.selectPreview(1);
    component.toggleNavigation();
    fixture.detectChanges();

    expect(component.currentPreview().name).toBe('Customers');
    expect(component.navOpen()).toBeTrue();
    expect((fixture.nativeElement as HTMLElement).querySelector('.main-nav')?.classList.contains('open')).toBeTrue();

    component.closeNavigation();
    expect(component.navOpen()).toBeFalse();
  });
});
