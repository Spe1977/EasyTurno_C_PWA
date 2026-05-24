import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DatePipe } from '@angular/common';
import { ShiftListItemComponent } from './shift-list-item.component';
import { TranslationService } from '../services/translation.service';
import { Shift } from '../shift.model';

describe('ShiftListItemComponent', () => {
  let component: ShiftListItemComponent;
  let fixture: ComponentFixture<ShiftListItemComponent>;

  const mockShift: Shift = {
    id: 'shift-1',
    seriesId: 'series-1',
    title: 'Morning Shift',
    start: '2026-05-14T09:00:00',
    end: '2026-05-14T17:00:00',
    color: 'sky',
    isRecurring: false,
    notes: 'A test note',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShiftListItemComponent],
      providers: [TranslationService, DatePipe],
    }).compileComponents();

    fixture = TestBed.createComponent(ShiftListItemComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('shift', mockShift);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Output emitters (T7)', () => {
    it('shows a subtle recurring-series indicator for recurring shifts', () => {
      fixture.componentRef.setInput('shift', { ...mockShift, isRecurring: true });
      fixture.detectChanges();

      const titleRow = fixture.nativeElement.querySelector(
        '[data-cy="shift-title-row"]'
      ) as HTMLElement | null;
      const indicator = fixture.nativeElement.querySelector(
        '[data-cy="recurring-series-indicator"]'
      ) as HTMLElement | null;
      const icon = indicator?.querySelector('svg') as SVGElement | null;

      expect(titleRow?.classList.contains('gap-[15px]')).toBe(true);
      expect(indicator).toBeTruthy();
      expect(indicator?.getAttribute('aria-label')).toBe('Recurring shift');
      expect(indicator?.classList.contains('h-7')).toBe(true);
      expect(indicator?.classList.contains('w-7')).toBe(true);
      expect(indicator?.classList.contains('bg-indigo-100')).toBe(true);
      expect(indicator?.classList.contains('text-indigo-700')).toBe(true);
      expect(indicator?.classList.contains('dark:bg-indigo-300')).toBe(true);
      expect(indicator?.classList.contains('dark:text-indigo-950')).toBe(true);
      expect(icon?.classList.contains('h-4')).toBe(true);
      expect(icon?.classList.contains('w-4')).toBe(true);
    });

    it('does not show the recurring-series indicator for one-off shifts', () => {
      const indicator = fixture.nativeElement.querySelector(
        '[data-cy="recurring-series-indicator"]'
      ) as HTMLElement | null;

      expect(indicator).toBeNull();
    });

    it('should emit `view` with the shift when the card container is clicked', () => {
      const viewSpy = jest.fn();
      component.view.subscribe(viewSpy);

      const card = fixture.nativeElement.querySelector('div.cursor-pointer') as HTMLElement;
      expect(card).toBeTruthy();
      card.click();

      expect(viewSpy).toHaveBeenCalledTimes(1);
      expect(viewSpy).toHaveBeenCalledWith(mockShift);
    });

    it('should emit `edit` with the shift when the edit button is clicked', () => {
      const editSpy = jest.fn();
      component.edit.subscribe(editSpy);

      const editBtn = fixture.nativeElement.querySelector(
        '[data-cy="edit-shift-btn"]'
      ) as HTMLButtonElement;
      expect(editBtn).toBeTruthy();
      editBtn.click();

      expect(editSpy).toHaveBeenCalledTimes(1);
      expect(editSpy).toHaveBeenCalledWith(mockShift);
    });

    it('should emit `deleteShift` with the shift when the delete button is clicked', () => {
      const deleteSpy = jest.fn();
      component.deleteShift.subscribe(deleteSpy);

      const deleteBtn = fixture.nativeElement.querySelector(
        '[data-cy="delete-shift-btn"]'
      ) as HTMLButtonElement;
      expect(deleteBtn).toBeTruthy();
      deleteBtn.click();

      expect(deleteSpy).toHaveBeenCalledTimes(1);
      expect(deleteSpy).toHaveBeenCalledWith(mockShift);
    });

    it('should NOT emit `view` when the edit button is clicked (stopPropagation)', () => {
      const viewSpy = jest.fn();
      const editSpy = jest.fn();
      component.view.subscribe(viewSpy);
      component.edit.subscribe(editSpy);

      const editBtn = fixture.nativeElement.querySelector(
        '[data-cy="edit-shift-btn"]'
      ) as HTMLButtonElement;
      editBtn.click();

      expect(editSpy).toHaveBeenCalledTimes(1);
      expect(viewSpy).not.toHaveBeenCalled();
    });

    it('should NOT emit `view` when the delete button is clicked (stopPropagation)', () => {
      const viewSpy = jest.fn();
      const deleteSpy = jest.fn();
      component.view.subscribe(viewSpy);
      component.deleteShift.subscribe(deleteSpy);

      const deleteBtn = fixture.nativeElement.querySelector(
        '[data-cy="delete-shift-btn"]'
      ) as HTMLButtonElement;
      deleteBtn.click();

      expect(deleteSpy).toHaveBeenCalledTimes(1);
      expect(viewSpy).not.toHaveBeenCalled();
    });

    it('should emit the updated shift reference when the input changes between clicks', () => {
      const viewSpy = jest.fn();
      component.view.subscribe(viewSpy);

      const card = fixture.nativeElement.querySelector('div.cursor-pointer') as HTMLElement;
      card.click();

      const updatedShift: Shift = { ...mockShift, id: 'shift-2', title: 'Evening Shift' };
      fixture.componentRef.setInput('shift', updatedShift);
      fixture.detectChanges();
      card.click();

      expect(viewSpy).toHaveBeenCalledTimes(2);
      expect(viewSpy.mock.calls[0][0]).toEqual(mockShift);
      expect(viewSpy.mock.calls[1][0]).toEqual(updatedShift);
    });
  });
});
