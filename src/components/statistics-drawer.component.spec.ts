import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DatePipe } from '@angular/common';
import { StatisticsDrawerComponent } from './statistics-drawer.component';
import { TranslationService } from '../services/translation.service';
import { Shift } from '../shift.model';

describe('StatisticsDrawerComponent', () => {
  let component: StatisticsDrawerComponent;
  let fixture: ComponentFixture<StatisticsDrawerComponent>;
  let translationService: TranslationService;

  const sampleShifts: Shift[] = [
    {
      id: 's-1',
      seriesId: 's-1',
      title: 'Shift 1',
      start: '2025-10-01T08:00:00',
      end: '2025-10-01T16:00:00',
      color: 'sky',
      isRecurring: false,
      overtimeHours: 2,
      allowances: [
        { name: 'Meal', amount: 15 },
        { name: 'Transport', amount: 10 },
      ],
    },
    {
      id: 's-2',
      seriesId: 's-2',
      title: 'Shift 2',
      start: '2025-10-05T10:00:00',
      end: '2025-10-05T18:00:00',
      color: 'green',
      isRecurring: false,
      overtimeHours: 1.5,
      allowances: [{ name: 'Meal', amount: 15 }],
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatisticsDrawerComponent],
      providers: [TranslationService, DatePipe],
    }).compileComponents();

    fixture = TestBed.createComponent(StatisticsDrawerComponent);
    component = fixture.componentInstance;
    translationService = TestBed.inject(TranslationService);
    fixture.componentRef.setInput('shifts', sampleShifts);
    component.statsStartDate.set('2025-10-01');
    component.statsEndDate.set('2025-10-31');
    fixture.detectChanges();
  });

  it('should initialize statistics date range to last 30 days', () => {
    const freshFixture = TestBed.createComponent(StatisticsDrawerComponent);
    const fresh = freshFixture.componentInstance;
    const startDate = new Date(fresh.statsStartDate());
    const endDate = new Date(fresh.statsEndDate());
    const diffInDays = Math.floor(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    expect(diffInDays).toBeGreaterThanOrEqual(29);
    expect(diffInDays).toBeLessThanOrEqual(31);
  });

  it('uses ISO fallback in constructor when DatePipe.transform returns null', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [StatisticsDrawerComponent],
      providers: [TranslationService],
    })
      .overrideComponent(StatisticsDrawerComponent, {
        set: { providers: [{ provide: DatePipe, useValue: { transform: () => null } }] },
      })
      .compileComponents();

    const fallbackFixture = TestBed.createComponent(StatisticsDrawerComponent);
    const fallback = fallbackFixture.componentInstance;

    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to format stats dates, using fallback');
    expect(fallback.statsStartDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(fallback.statsEndDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    consoleErrorSpy.mockRestore();
  });

  it('calculates total shifts, hours, overtime, breakdowns, and allowances', () => {
    const stats = component.statsData();
    expect(stats.totalShifts).toBe(2);
    expect(stats.totalHours).toBe(16);
    expect(stats.totalOvertime).toBe(3.5);
    expect(stats.shiftsByTitle).toEqual({ 'Shift 1': 1, 'Shift 2': 1 });
    expect(stats.allowancesByName).toEqual({ Meal: 30, Transport: 10 });
    expect(component.statsShiftTitles()).toEqual(['Shift 1', 'Shift 2']);
    expect(component.statsAllowanceNames()).toEqual(['Meal', 'Transport']);
  });

  it('handles shifts without overtime/allowances and empty date ranges', () => {
    fixture.componentRef.setInput('shifts', [
      {
        id: 'reg',
        seriesId: 'reg',
        title: 'Regular Shift',
        start: '2025-10-10T08:00:00',
        end: '2025-10-10T16:00:00',
        color: 'sky',
        isRecurring: false,
      },
    ]);
    fixture.detectChanges();
    expect(component.statsData().totalOvertime).toBe(0);
    expect(Object.keys(component.statsData().allowancesByName)).toHaveLength(0);

    component.statsStartDate.set('2025-11-01');
    component.statsEndDate.set('2025-11-30');
    expect(component.statsData()).toEqual({
      totalShifts: 0,
      totalHours: 0,
      totalOvertime: 0,
      shiftsByTitle: {},
      allowancesByName: {},
    });
  });

  it('maps shift colors and falls back to indigo', () => {
    expect(component.getShiftColorForTitle('Shift 1')).toBe('sky');
    expect(component.getShiftColorForTitle('Missing')).toBe('indigo');
    expect(component.getShiftStylesForTitle('Shift 2')).toEqual({
      bar: 'bg-emerald-500',
      labelBg: 'bg-emerald-100/70 dark:bg-emerald-950/40',
      text: 'text-emerald-700 dark:text-emerald-300',
    });
    expect(component.getShiftStylesForTitle('Missing')).toEqual({
      bar: 'bg-indigo-500',
      labelBg: 'bg-indigo-100/70 dark:bg-indigo-950/40',
      text: 'text-indigo-700 dark:text-indigo-300',
    });
  });

  it('updates statistics date range from quick presets', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-20T12:00:00.000Z'));
    try {
      component.setStatsPreset('thisMonth');
      expect(component.statsStartDate()).toBe('2026-05-01');
      expect(component.statsEndDate()).toBe('2026-05-31');

      component.setStatsPreset('lastMonth');
      expect(component.statsStartDate()).toBe('2026-04-01');
      expect(component.statsEndDate()).toBe('2026-04-30');

      component.setStatsPreset('last30Days');
      expect(component.statsStartDate()).toBe('2026-04-20');
      expect(component.statsEndDate()).toBe('2026-05-20');

      component.setStatsPreset('thisYear');
      expect(component.statsStartDate()).toBe('2026-01-01');
      expect(component.statsEndDate()).toBe('2026-12-31');
    } finally {
      jest.useRealTimers();
    }
  });

  it('formats allowance amounts as floored integer strings', () => {
    expect(component.formatAllowanceAmount(10)).toBe('10');
    expect(component.formatAllowanceAmount(10.5)).toBe('10');
    expect(component.formatAllowanceAmount(0)).toBe('0');
    expect(component.formatAllowanceAmount(-3)).toBe('0');
    expect(component.formatAllowanceAmount(Number.NaN)).toBe('0');
  });

  it('renders populated and empty states cleanly in EN and IT without hardcoded Italian', () => {
    translationService.setLanguage('en');
    fixture.componentRef.setInput('shifts', [
      ...sampleShifts,
      {
        id: 's-3',
        seriesId: 's-3',
        title: 'Shift 1',
        start: '2025-10-02T08:00:00',
        end: '2025-10-02T16:00:00',
        color: 'sky',
        isRecurring: false,
      },
    ]);
    fixture.detectChanges();

    const modal = (fixture.nativeElement as HTMLElement).querySelector('.modal-fade-in')!;
    const enText = modal.textContent ?? '';
    expect(enText).toContain('Statistics');
    expect(enText).toContain('2 shifts (67%)');
    expect(enText).toContain('1 shift (33%)');
    expect(enText).not.toContain('Analisi e resoconto');
    expect(enText).not.toMatch(/\bturn[oi]\b/i);

    translationService.setLanguage('it');
    fixture.detectChanges();
    expect(modal.textContent).toContain('Analisi e resoconto');
    expect(modal.textContent).toContain('2 turni (67%)');

    fixture.componentRef.setInput('shifts', []);
    fixture.detectChanges();
    expect(modal.textContent).toContain('Non ci sono turni pianificati');
  });

  it('emits closed when close/cancel button is clicked', () => {
    const closeSpy = jest.fn();
    component.closed.subscribe(closeSpy);

    const buttons = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));
    buttons[buttons.length - 1]?.click();

    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  describe('Step 5.4: Accessibility & ARIA', () => {
    it('wires aria-labelledby on statistics dialog, aria-label on close icon button, and label[for] on date inputs', () => {
      const host = fixture.nativeElement as HTMLElement;
      const dialog = host.querySelector('[role="dialog"]') as HTMLElement;
      const labelledBy = dialog.getAttribute('aria-labelledby');
      expect(labelledBy).toBeTruthy();
      expect(host.querySelector(`#${labelledBy}`)?.textContent).toContain(
        translationService.translate('statistics')
      );

      const closeIconBtn = host.querySelector('button') as HTMLButtonElement;
      expect(closeIconBtn.getAttribute('aria-label')).toBe(translationService.translate('cancel'));

      const startInput = host.querySelector('input[name="statsStartDate"]') as HTMLInputElement;
      const endInput = host.querySelector('input[name="statsEndDate"]') as HTMLInputElement;
      expect(startInput.id).toBeTruthy();
      expect(endInput.id).toBeTruthy();
      expect(host.querySelector(`label[for="${startInput.id}"]`)).not.toBeNull();
      expect(host.querySelector(`label[for="${endInput.id}"]`)).not.toBeNull();
    });
  });
});
