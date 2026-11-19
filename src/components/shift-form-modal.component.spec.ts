import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DatePipe } from '@angular/common';
import { ShiftFormModalComponent, ShiftFormSaveEvent } from './shift-form-modal.component';
import { TranslationService } from '../services/translation.service';
import { ToastService } from '../services/toast.service';
import { Shift } from '../shift.model';

describe('ShiftFormModalComponent', () => {
  let component: ShiftFormModalComponent;
  let fixture: ComponentFixture<ShiftFormModalComponent>;
  let toastService: ToastService;
  let translationService: TranslationService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShiftFormModalComponent],
      providers: [TranslationService, ToastService, DatePipe],
    }).compileComponents();

    fixture = TestBed.createComponent(ShiftFormModalComponent);
    component = fixture.componentInstance;
    toastService = TestBed.inject(ToastService);
    translationService = TestBed.inject(TranslationService);
    fixture.detectChanges();
  });

  it('should create with default new-shift state', () => {
    expect(component).toBeTruthy();
    expect(component.shiftTitle()).toBe('');
    expect(component.shiftColor()).toBe('indigo');
    expect(component.shiftIsRecurring()).toBe(false);
    expect(component.shiftOvertimeHours()).toBe(0);
    expect(component.shiftAllowances()).toEqual([]);
  });

  describe('Populate and Reset', () => {
    it('populates form fields when editingShift input is provided', () => {
      const testShift: Shift = {
        id: 'test-1',
        seriesId: 'test-1',
        title: 'Test Shift',
        start: '2025-10-10T09:00:00',
        end: '2025-10-10T17:00:00',
        color: 'green',
        isRecurring: true,
        repetition: { frequency: 'weeks', interval: 2 },
        notes: 'Test notes',
        overtimeHours: 2,
        allowances: [{ name: 'Meal', amount: 15 }],
      };

      fixture.componentRef.setInput('editingShift', testShift);
      fixture.detectChanges();

      expect(component.shiftTitle()).toBe('Test Shift');
      expect(component.shiftColor()).toBe('green');
      expect(component.shiftIsRecurring()).toBe(true);
      expect(component.shiftRepetition()).toEqual({ frequency: 'weeks', interval: 2 });
      expect(component.shiftNotes()).toBe('Test notes');
      expect(component.shiftOvertimeHours()).toBe(2);
      expect(component.shiftAllowances()).toHaveLength(1);
      expect(component.shiftAllowances()[0].name).toBe('Meal');
      expect(component.shiftAllowances()[0].amount).toBe(15);
      expect(component.shiftAllowances()[0]._id).toBeDefined();
    });

    it('uses ISO fallback in resetForm() when DatePipe.transform returns null', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      jest.spyOn(component['datePipe'], 'transform').mockReturnValue(null);

      component.resetForm();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to format reset dates, using ISO fallback'
      );
      expect(component.shiftStartDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(component.shiftStartTime()).toMatch(/^\d{2}:\d{2}$/);
      expect(component.shiftEndDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(component.shiftEndTime()).toMatch(/^\d{2}:\d{2}$/);
      consoleErrorSpy.mockRestore();
    });

    it('uses ISO fallback when populating editingShift if DatePipe.transform returns null', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      jest.spyOn(component['datePipe'], 'transform').mockReturnValue(null);

      const shift: Shift = {
        id: 'fallback-1',
        seriesId: 'fallback-1',
        title: 'Fallback Edit',
        start: '2025-06-15T10:30:00.000Z',
        end: '2025-06-15T14:30:00.000Z',
        color: 'sky',
        isRecurring: false,
      };

      fixture.componentRef.setInput('editingShift', shift);
      fixture.detectChanges();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to format shift dates, using ISO fallback'
      );
      expect(component.shiftStartDate()).toBe('2025-06-15');
      expect(component.shiftEndDate()).toBe('2025-06-15');
      expect(component.shiftStartTime()).toMatch(/^\d{2}:\d{2}$/);
      expect(component.shiftEndTime()).toMatch(/^\d{2}:\d{2}$/);
      expect(component.shiftTitle()).toBe('Fallback Edit');
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Form Submission and Validation', () => {
    it('emits save with stripped allowances and timezone for valid new shift', () => {
      const emitted: ShiftFormSaveEvent[] = [];
      component.save.subscribe(val => emitted.push(val));

      component.shiftTitle.set('Morning Shift');
      component.shiftStartDate.set('2025-10-15');
      component.shiftStartTime.set('08:00');
      component.shiftEndDate.set('2025-10-15');
      component.shiftEndTime.set('16:00');
      component.shiftColor.set('green');
      component.shiftNotes.set('Important shift');
      component.shiftOvertimeHours.set(1.5);
      component.shiftAllowances.set([{ name: 'Transport', amount: 10, _id: 'test-id-1' }]);

      component.handleFormSubmit();

      expect(emitted).toHaveLength(1);
      expect(emitted[0].editingShift).toBeNull();
      expect(emitted[0].shiftData).toMatchObject({
        title: 'Morning Shift',
        color: 'green',
        notes: 'Important shift',
        overtimeHours: 1.5,
        allowances: [{ name: 'Transport', amount: 10 }],
        isRecurring: false,
      });
      expect(emitted[0].shiftData.timezone).toBeTruthy();
    });

    it('emits save with repetition when recurring is enabled', () => {
      const emitted: ShiftFormSaveEvent[] = [];
      component.save.subscribe(val => emitted.push(val));

      component.shiftTitle.set('Daily');
      component.shiftStartDate.set('2025-10-15');
      component.shiftStartTime.set('08:00');
      component.shiftEndDate.set('2025-10-15');
      component.shiftEndTime.set('16:00');
      component.shiftIsRecurring.set(true);
      component.shiftRepetition.set({ frequency: 'weeks', interval: 2 });

      component.handleFormSubmit();

      expect(emitted).toHaveLength(1);
      expect(emitted[0].shiftData.isRecurring).toBe(true);
      expect(emitted[0].shiftData.repetition).toEqual({ frequency: 'weeks', interval: 2 });
    });

    it('does not submit when title is empty or whitespace', () => {
      const saveSpy = jest.fn();
      const errorSpy = jest.spyOn(toastService, 'error');
      component.save.subscribe(saveSpy);

      component.shiftTitle.set('   ');
      component.shiftStartDate.set('2025-10-15');
      component.shiftStartTime.set('08:00');
      component.shiftEndDate.set('2025-10-15');
      component.shiftEndTime.set('16:00');

      component.handleFormSubmit();

      expect(saveSpy).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith(translationService.translate('titleRequired'));
    });

    it('blocks submission when end date/time is on or before start date/time', () => {
      const saveSpy = jest.fn();
      const errorSpy = jest.spyOn(toastService, 'error');
      component.save.subscribe(saveSpy);

      component.shiftTitle.set('Valid Title');
      component.shiftStartDate.set('2026-05-21');
      component.shiftStartTime.set('12:00');
      component.shiftEndDate.set('2026-05-21');
      component.shiftEndTime.set('11:00');

      component.handleFormSubmit();

      expect(saveSpy).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith(translationService.translate('endMustBeAfterStart'));
    });

    it('throws when dates/times are incomplete', () => {
      component.shiftTitle.set('Test Shift');
      component.shiftStartDate.set('2025-10-15');
      component.shiftStartTime.set('');
      component.shiftEndDate.set('2025-10-15');
      component.shiftEndTime.set('16:00');

      expect(() => component.handleFormSubmit()).toThrow();
    });
  });

  describe('Date/Time & Repetition Sync', () => {
    it('syncs end date when start date changes', () => {
      component.shiftEndDate.set('2025-10-15');
      component.onStartDateChange('2025-10-20');
      expect(component.shiftEndDate()).toBe('2025-10-20');
    });

    it('syncs end time when start time changes', () => {
      component.shiftEndTime.set('16:00');
      component.onStartTimeChange('10:00');
      expect(component.shiftEndTime()).toBe('10:00');
    });

    it('updates repetition frequency and interval, falling back to 1 for unknown frequency', () => {
      component.onFrequencyChange({ target: { value: 'months' } } as unknown as Event);
      expect(component.shiftRepetition()).toEqual({ frequency: 'months', interval: 1 });

      component.onRepetitionIntervalChange({ target: { value: '3' } } as unknown as Event);
      expect(component.shiftRepetition()).toEqual({ frequency: 'months', interval: 3 });

      component.onFrequencyChange({ target: { value: 'quarters' } } as unknown as Event);
      expect(component.shiftRepetition()).toEqual({ frequency: 'quarters' as any, interval: 1 });
    });
  });

  describe('Allowances & Overtime Validation', () => {
    it('adds, updates, and removes allowances with integer flooring and min-w-0 layout', () => {
      component.addAllowance();
      expect(component.shiftAllowances()).toHaveLength(1);

      component.updateAllowanceName(0, { target: { value: 'Transport' } } as unknown as Event);
      component.updateAllowanceAmount(0, { target: { value: '25.99' } } as unknown as Event);
      expect(component.shiftAllowances()[0]).toMatchObject({ name: 'Transport', amount: 25 });

      component.updateAllowanceAmount(0, { target: { value: 'abc' } } as unknown as Event);
      component.updateAllowanceAmount(0, { target: { value: '-3' } } as unknown as Event);
      expect(component.shiftAllowances()[0].amount).toBe(25);

      fixture.detectChanges();
      const nameInput = fixture.nativeElement.querySelector(
        '[data-cy="allowance-name-input"]'
      ) as HTMLInputElement | null;
      expect(nameInput).not.toBeNull();
      expect(nameInput!.classList.contains('min-w-0')).toBe(true);

      component.removeAllowance(0);
      expect(component.shiftAllowances()).toHaveLength(0);
    });

    it('coerces null/NaN/negative overtime to 0 via updateOvertimeHours', () => {
      component.updateOvertimeHours(2.5);
      expect(component.shiftOvertimeHours()).toBe(2.5);

      component.updateOvertimeHours(null);
      expect(component.shiftOvertimeHours()).toBe(0);

      component.updateOvertimeHours(NaN);
      expect(component.shiftOvertimeHours()).toBe(0);

      component.updateOvertimeHours(-1);
      expect(component.shiftOvertimeHours()).toBe(0);
    });
  });

  describe('Action Outputs', () => {
    it('emits cancelled on cancel button click', () => {
      const cancelSpy = jest.fn();
      component.cancelled.subscribe(cancelSpy);

      const buttons = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));
      const cancelBtn = buttons.find(b =>
        b.textContent?.includes(translationService.translate('cancel'))
      );
      cancelBtn?.click();

      expect(cancelSpy).toHaveBeenCalledTimes(1);
    });

    it('emits deleteRequested with editingShift when delete button is clicked', () => {
      const shift: Shift = {
        id: 'del-1',
        seriesId: 'del-1',
        title: 'Delete Me',
        start: '2025-10-10T09:00:00',
        end: '2025-10-10T17:00:00',
        color: 'rose',
        isRecurring: false,
      };
      fixture.componentRef.setInput('editingShift', shift);
      fixture.detectChanges();

      const deleteSpy = jest.fn();
      component.deleteRequested.subscribe(deleteSpy);

      const buttons = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));
      const deleteBtn = buttons.find(b =>
        b.textContent?.includes(translationService.translate('delete'))
      );
      deleteBtn?.click();

      expect(deleteSpy).toHaveBeenCalledWith(shift);
    });
  });

  describe('Step 5.4: Accessibility & ARIA', () => {
    it('associates dialog aria-labelledby, form labels via for/id, color aria-pressed, and allowance remove aria-label', () => {
      component.addAllowance();
      fixture.detectChanges();

      const host = fixture.nativeElement as HTMLElement;
      const dialog = host.querySelector('[role="dialog"]') as HTMLElement;
      expect(dialog.getAttribute('aria-modal')).toBe('true');
      const labelledBy = dialog.getAttribute('aria-labelledby');
      expect(labelledBy).toBeTruthy();
      expect(host.querySelector(`#${labelledBy}`)?.textContent).toContain(
        translationService.translate('newShift')
      );

      const titleInput = host.querySelector('[data-cy="shift-title-input"]') as HTMLInputElement;
      expect(titleInput.id).toBeTruthy();
      expect(host.querySelector(`label[for="${titleInput.id}"]`)).not.toBeNull();

      const indigoBtn = host.querySelector('button[aria-label="indigo"]') as HTMLButtonElement;
      expect(indigoBtn.getAttribute('aria-pressed')).toBe('true');

      const removeAllowanceBtn = host.querySelector(
        '[data-cy="remove-allowance-btn"]'
      ) as HTMLButtonElement;
      expect(removeAllowanceBtn.getAttribute('aria-label')).toBe(
        translationService.translate('remove')
      );
    });
  });
});
