import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfirmDialogComponent } from './confirm-dialog.component';
import { TranslationService } from '../services/translation.service';

describe('ConfirmDialogComponent', () => {
  let component: ConfirmDialogComponent;
  let fixture: ComponentFixture<ConfirmDialogComponent>;
  let translationService: TranslationService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfirmDialogComponent],
      providers: [TranslationService],
    }).compileComponents();

    fixture = TestBed.createComponent(ConfirmDialogComponent);
    component = fixture.componentInstance;
    translationService = TestBed.inject(TranslationService);
    fixture.componentRef.setInput('mode', 'deleteConfirm');
    fixture.detectChanges();
  });

  it('emits confirmDelete(false) and closed for single delete confirmation', () => {
    const deleteSpy = jest.fn();
    const closeSpy = jest.fn();
    component.confirmDelete.subscribe(deleteSpy);
    component.closed.subscribe(closeSpy);

    const buttons = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));
    buttons[0].click();
    buttons[1].click();

    expect(deleteSpy).toHaveBeenCalledWith(false);
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it('emits confirmDelete(true) and confirmDelete(false) in deleteSeriesConfirm mode', () => {
    fixture.componentRef.setInput('mode', 'deleteSeriesConfirm');
    fixture.detectChanges();

    const deleteSpy = jest.fn();
    component.confirmDelete.subscribe(deleteSpy);

    const buttons = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));
    buttons[0].click();
    buttons[1].click();

    expect(deleteSpy.mock.calls).toEqual([[true], [false]]);
  });

  it('emits confirmEditSeries(true) and confirmEditSeries(false) in editSeriesConfirm mode', () => {
    fixture.componentRef.setInput('mode', 'editSeriesConfirm');
    fixture.detectChanges();

    const editSpy = jest.fn();
    component.confirmEditSeries.subscribe(editSpy);

    const buttons = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));
    buttons[0].click();
    buttons[1].click();

    expect(editSpy.mock.calls).toEqual([[true], [false]]);
  });

  it('requires typing RESET in Guest resetConfirm mode before emitting confirmReset', () => {
    fixture.componentRef.setInput('mode', 'resetConfirm');
    fixture.componentRef.setInput('isAuthenticated', false);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const resetSpy = jest.fn();
    component.confirmReset.subscribe(resetSpy);

    const keywordInput = host.querySelector('[data-cy="reset-keyword-input"]') as HTMLInputElement;
    const confirmBtn = host.querySelector('[data-cy="reset-confirm-btn"]') as HTMLButtonElement;
    const form = host.querySelector('form')!;

    expect(keywordInput).not.toBeNull();
    expect(host.querySelector('[data-cy="reset-password-input"]')).toBeNull();
    expect(confirmBtn.disabled).toBe(true);

    // Non-matching text keeps confirm disabled and blocks submission
    keywordInput.value = 'reset';
    keywordInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(confirmBtn.disabled).toBe(true);
    form.dispatchEvent(new Event('submit'));
    expect(resetSpy).not.toHaveBeenCalled();

    // Matching RESET enables button and emits trimmed confirmationText
    keywordInput.value = ' RESET ';
    keywordInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(confirmBtn.disabled).toBe(false);
    form.dispatchEvent(new Event('submit'));
    expect(resetSpy).toHaveBeenCalledWith({ confirmationText: 'RESET' });
  });

  it('requires password in Email/Password resetConfirm mode and emits password payload', () => {
    fixture.componentRef.setInput('mode', 'resetConfirm');
    fixture.componentRef.setInput('isAuthenticated', true);
    fixture.componentRef.setInput('hasPasswordProvider', true);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const resetSpy = jest.fn();
    component.confirmReset.subscribe(resetSpy);

    const passwordInput = host.querySelector(
      '[data-cy="reset-password-input"]'
    ) as HTMLInputElement;
    const confirmBtn = host.querySelector('[data-cy="reset-confirm-btn"]') as HTMLButtonElement;
    const form = host.querySelector('form')!;

    expect(passwordInput).not.toBeNull();
    expect(passwordInput.type).toBe('password');
    expect(passwordInput.autocomplete).toBe('current-password');
    expect(host.querySelector('[data-cy="reset-keyword-input"]')).toBeNull();
    expect(confirmBtn.disabled).toBe(true);

    passwordInput.value = 'SecretPass1!';
    passwordInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(confirmBtn.disabled).toBe(false);

    form.dispatchEvent(new Event('submit'));
    expect(resetSpy).toHaveBeenCalledWith({ password: 'SecretPass1!' });
  });

  it('shows Google verification hint and emits empty payload in Google resetConfirm mode', () => {
    fixture.componentRef.setInput('mode', 'resetConfirm');
    fixture.componentRef.setInput('isAuthenticated', true);
    fixture.componentRef.setInput('hasPasswordProvider', false);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const resetSpy = jest.fn();
    component.confirmReset.subscribe(resetSpy);

    expect(host.querySelector('[data-cy="reset-password-input"]')).toBeNull();
    expect(host.querySelector('[data-cy="reset-keyword-input"]')).toBeNull();
    const hint = host.querySelector('[data-cy="reset-google-hint"]');
    expect(hint?.textContent).toContain(translationService.translate('resetConfirmGoogleHint'));

    const confirmBtn = host.querySelector('[data-cy="reset-confirm-btn"]') as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(false);
    expect(confirmBtn.textContent).toContain(
      translationService.translate('resetConfirmGoogleButton')
    );

    const form = host.querySelector('form')!;
    form.dispatchEvent(new Event('submit'));
    expect(resetSpy).toHaveBeenCalledWith({});
  });

  it('disables reset buttons while isResettingData is true and clears inputs when reopening resetConfirm', () => {
    fixture.componentRef.setInput('mode', 'resetConfirm');
    fixture.componentRef.setInput('isAuthenticated', false);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const resetSpy = jest.fn();
    component.confirmReset.subscribe(resetSpy);

    const keywordInput = host.querySelector('[data-cy="reset-keyword-input"]') as HTMLInputElement;
    keywordInput.value = 'RESET';
    keywordInput.dispatchEvent(new Event('input'));
    fixture.componentRef.setInput('isResettingData', true);
    fixture.detectChanges();

    const confirmBtn = host.querySelector('[data-cy="reset-confirm-btn"]') as HTMLButtonElement;
    const cancelBtn = host.querySelector('[data-cy="reset-cancel-btn"]') as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(true);
    expect(cancelBtn.disabled).toBe(true);
    expect(confirmBtn.textContent).toContain(translationService.translate('resettingData'));

    host.querySelector('form')!.dispatchEvent(new Event('submit'));
    expect(resetSpy).not.toHaveBeenCalled();

    fixture.componentRef.setInput('isResettingData', false);
    fixture.componentRef.setInput('mode', 'deleteConfirm');
    fixture.detectChanges();
    fixture.componentRef.setInput('mode', 'resetConfirm');
    fixture.detectChanges();

    const reopenedInput = host.querySelector('[data-cy="reset-keyword-input"]') as HTMLInputElement;
    expect(reopenedInput.value).toBe('');
  });

  it('syncs initialSearchDate and emits searchDateSubmit in searchDate mode', () => {
    fixture.componentRef.setInput('initialSearchDate', '2026-06-15');
    fixture.componentRef.setInput('mode', 'searchDate');
    fixture.detectChanges();

    const searchSpy = jest.fn();
    component.searchDateSubmit.subscribe(searchSpy);

    expect(component.searchDateInput()).toBe('2026-06-15');
    component.searchDateInput.set('2026-07-01');
    const form = (fixture.nativeElement as HTMLElement).querySelector('form')!;
    form.dispatchEvent(new Event('submit'));

    expect(searchSpy).toHaveBeenCalledWith('2026-07-01');
  });

  it('handles deleteAccountWarning and deleteAccountConfirm flows', () => {
    fixture.componentRef.setInput('mode', 'deleteAccountWarning');
    fixture.detectChanges();

    const proceedSpy = jest.fn();
    component.deleteAccountProceed.subscribe(proceedSpy);
    (
      (fixture.nativeElement as HTMLElement).querySelectorAll('button')[0] as HTMLButtonElement
    ).click();
    expect(proceedSpy).toHaveBeenCalledTimes(1);

    fixture.componentRef.setInput('mode', 'deleteAccountConfirm');
    fixture.componentRef.setInput('hasPasswordProvider', true);
    fixture.detectChanges();

    const confirmSpy = jest.fn();
    component.deleteAccountConfirm.subscribe(confirmSpy);
    component.deleteAccountEmailInput.set('user@example.com');
    component.deleteAccountPasswordInput.set('Secret123!');

    const form = (fixture.nativeElement as HTMLElement).querySelector('form')!;
    form.dispatchEvent(new Event('submit'));

    expect(confirmSpy).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'Secret123!',
    });
  });

  it('renders passwordPrompt in export and import modes and emits passwordSubmit', () => {
    fixture.componentRef.setInput('mode', 'passwordPrompt');
    fixture.componentRef.setInput('passwordPromptMode', 'export');
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('[data-cy="password-input"]')).not.toBeNull();
    expect(host.querySelector('[data-cy="password-confirm-input"]')).not.toBeNull();

    const submitSpy = jest.fn();
    component.passwordSubmit.subscribe(submitSpy);

    component.passwordInput.set('twelvechars1');
    component.passwordConfirmInput.set('twelvechars1');
    fixture.detectChanges();

    (host.querySelector('[data-cy="password-confirm-btn"]') as HTMLButtonElement).click();
    expect(submitSpy).toHaveBeenCalledWith({
      password: 'twelvechars1',
      confirmPassword: 'twelvechars1',
    });

    fixture.componentRef.setInput('passwordPromptMode', 'import');
    fixture.detectChanges();
    expect(host.querySelector('[data-cy="password-confirm-input"]')).toBeNull();
  });

  it('renders decryptionError alertdialog and emits reset/keep outputs', () => {
    fixture.componentRef.setInput('mode', 'decryptionError');
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const dialog = host.querySelector('[role="alertdialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain(translationService.translate('decryptionErrorTitle'));

    const resetSpy = jest.fn();
    const keepSpy = jest.fn();
    component.decryptionReset.subscribe(resetSpy);
    component.decryptionKeep.subscribe(keepSpy);

    const buttons = Array.from(host.querySelectorAll('button'));
    buttons[0].click();
    buttons[1].click();

    expect(resetSpy).toHaveBeenCalledTimes(1);
    expect(keepSpy).toHaveBeenCalledTimes(1);
  });

  describe('Step 5.4: Accessibility & ARIA across dialog modes', () => {
    it('wires aria-labelledby and label[for] across searchDate, deleteAccountWarning, deleteAccountConfirm, passwordPrompt, and confirm dialogs', () => {
      const host = fixture.nativeElement as HTMLElement;
      const modes = [
        'deleteConfirm',
        'deleteSeriesConfirm',
        'editSeriesConfirm',
        'resetConfirm',
        'searchDate',
        'deleteAccountWarning',
        'deleteAccountConfirm',
        'passwordPrompt',
        'decryptionError',
      ] as const;

      for (const mode of modes) {
        fixture.componentRef.setInput('mode', mode);
        if (mode === 'deleteAccountConfirm') {
          fixture.componentRef.setInput('hasPasswordProvider', true);
        }
        fixture.detectChanges();

        const dialog = host.querySelector('[role="dialog"], [role="alertdialog"]') as HTMLElement;
        expect(dialog).not.toBeNull();
        expect(dialog.getAttribute('aria-modal')).toBe('true');
        const labelledBy = dialog.getAttribute('aria-labelledby');
        expect(labelledBy).toBeTruthy();
        expect(host.querySelector(`#${labelledBy}`)).not.toBeNull();
      }

      fixture.componentRef.setInput('mode', 'searchDate');
      fixture.detectChanges();
      const searchInput = host.querySelector('input[name="searchDate"]') as HTMLInputElement;
      expect(searchInput.id).toBeTruthy();
      expect(host.querySelector(`label[for="${searchInput.id}"]`)).not.toBeNull();

      fixture.componentRef.setInput('mode', 'resetConfirm');
      fixture.componentRef.setInput('isAuthenticated', false);
      fixture.detectChanges();
      const guestInput = host.querySelector('[data-cy="reset-keyword-input"]') as HTMLInputElement;
      expect(guestInput.id).toBeTruthy();
      expect(host.querySelector(`label[for="${guestInput.id}"]`)).not.toBeNull();

      fixture.componentRef.setInput('isAuthenticated', true);
      fixture.componentRef.setInput('hasPasswordProvider', true);
      fixture.detectChanges();
      const passwordInput = host.querySelector(
        '[data-cy="reset-password-input"]'
      ) as HTMLInputElement;
      expect(passwordInput.id).toBeTruthy();
      expect(host.querySelector(`label[for="${passwordInput.id}"]`)).not.toBeNull();
    });
  });
});
