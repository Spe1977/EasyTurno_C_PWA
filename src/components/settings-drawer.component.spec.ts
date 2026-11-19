import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { SettingsDrawerComponent } from './settings-drawer.component';
import { AuthService, AuthState } from '../services/auth.service';
import { UserDataService } from '../services/user-data.service';
import { DeviceRecord, DeviceService } from '../services/device.service';
import { TranslationService } from '../services/translation.service';
import { ToastService } from '../services/toast.service';

describe('SettingsDrawerComponent', () => {
  let component: SettingsDrawerComponent;
  let fixture: ComponentFixture<SettingsDrawerComponent>;
  let authState: WritableSignal<AuthState>;
  let devicesSignal: WritableSignal<DeviceRecord[]>;
  let installedCountSignal: WritableSignal<number>;
  let webSessionCountSignal: WritableSignal<number>;
  let removeDeviceMock: jest.Mock;
  let toastService: ToastService;
  let translationService: TranslationService;

  beforeEach(async () => {
    authState = signal<AuthState>({ mode: 'guest' });
    devicesSignal = signal<DeviceRecord[]>([]);
    installedCountSignal = signal(0);
    webSessionCountSignal = signal(0);
    removeDeviceMock = jest.fn().mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [SettingsDrawerComponent],
      providers: [
        TranslationService,
        ToastService,
        DeviceService,
        {
          provide: AuthService,
          useValue: {
            state: authState.asReadonly(),
            isGuest: () => authState().mode === 'guest',
            isAuthenticated: () => authState().mode === 'authenticated',
          },
        },
        {
          provide: UserDataService,
          useValue: {
            devices: devicesSignal.asReadonly(),
            activeDeviceCount: installedCountSignal.asReadonly(),
            installedDeviceCount: installedCountSignal.asReadonly(),
            webSessionCount: webSessionCountSignal.asReadonly(),
            removeDevice: removeDeviceMock,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsDrawerComponent);
    component = fixture.componentInstance;
    toastService = TestBed.inject(ToastService);
    translationService = TestBed.inject(TranslationService);
    fixture.componentRef.setInput('theme', 'light');
    fixture.detectChanges();
  });

  it('should expose authExitLabelKey for guest and authenticated modes', () => {
    expect(component.authExitLabelKey()).toBe('authLoginLink');
    authState.set({ mode: 'authenticated', uid: 'u1', email: 'u@example.com' });
    expect(component.authExitLabelKey()).toBe('authLogout');
  });

  it('switches language and emits themeChange on button clicks', () => {
    const themeSpy = jest.fn();
    component.themeChange.subscribe(themeSpy);

    const host = fixture.nativeElement as HTMLElement;
    (host.querySelector('[data-cy="lang-en-btn"]') as HTMLButtonElement).click();
    expect(translationService.language()).toBe('en');

    (host.querySelector('[data-cy="lang-it-btn"]') as HTMLButtonElement).click();
    expect(translationService.language()).toBe('it');

    (host.querySelector('[data-cy="theme-dark-btn"]') as HTMLButtonElement).click();
    expect(themeSpy).toHaveBeenCalledWith('dark');

    (host.querySelector('[data-cy="theme-light-btn"]') as HTMLButtonElement).click();
    expect(themeSpy).toHaveBeenCalledWith('light');
  });

  it('emits action outputs for statistics, authExit, export, reset, deleteAccount, and close', () => {
    authState.set({ mode: 'authenticated', uid: 'u1', email: 'user@example.com' });
    fixture.detectChanges();

    const statsSpy = jest.fn();
    const exitSpy = jest.fn();
    const exportSpy = jest.fn();
    const deleteAccountSpy = jest.fn();
    const resetSpy = jest.fn();
    const closeSpy = jest.fn();

    component.openStatistics.subscribe(statsSpy);
    component.authExit.subscribe(exitSpy);
    component.exportRequested.subscribe(exportSpy);
    component.deleteAccountRequested.subscribe(deleteAccountSpy);
    component.resetRequested.subscribe(resetSpy);
    component.closed.subscribe(closeSpy);

    const host = fixture.nativeElement as HTMLElement;
    (host.querySelector('[data-cy="statistics-btn"]') as HTMLButtonElement).click();
    (host.querySelector('[data-cy="auth-exit-btn"]') as HTMLButtonElement).click();
    (host.querySelector('[data-cy="export-btn"]') as HTMLButtonElement).click();
    (host.querySelector('[data-cy="delete-account-btn"]') as HTMLButtonElement).click();

    const buttons = Array.from(host.querySelectorAll('button'));
    const resetBtn = buttons.find(b =>
      b.textContent?.includes(translationService.translate('resetAllData'))
    );
    resetBtn?.click();
    buttons[buttons.length - 1]?.click();

    expect(statsSpy).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledTimes(1);
    expect(exportSpy).toHaveBeenCalledTimes(1);
    expect(deleteAccountSpy).toHaveBeenCalledTimes(1);
    expect(resetSpy).toHaveBeenCalledTimes(1);
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  describe('Device Limit & Management', () => {
    it('stays off at 3 installations and turns on at 4', () => {
      installedCountSignal.set(3);
      expect(component.deviceLimitExceeded()).toBe(false);

      installedCountSignal.set(4);
      expect(component.deviceLimitExceeded()).toBe(true);
    });

    it('lists only installed devices excluding web sessions', () => {
      devicesSignal.set([
        { id: 'app-1', platform: 'native', lastActive: null },
        { id: 'app-2', platform: 'pwa-installed', lastActive: 1700000000000 },
        { id: 'web-1', platform: 'web', lastActive: null },
      ]);

      expect(component.installedDevices().map(d => d.id)).toEqual(['app-1', 'app-2']);
      expect(component.formatDeviceLastActive(null)).toBe('');
      expect(component.formatDeviceLastActive(1700000000000)).not.toBe('');
    });

    it('maps each platform to its translation key', () => {
      expect(component.devicePlatformLabelKey('native')).toBe('devicePlatformNative');
      expect(component.devicePlatformLabelKey('pwa-installed')).toBe('devicePlatformInstalled');
      expect(component.devicePlatformLabelKey('web')).toBe('devicePlatformWeb');
    });

    it('removes a device through UserDataService and shows toast', async () => {
      const toastSpy = jest.spyOn(toastService, 'success');

      component.promptRemoveDevice('dev-1');
      expect(component.devicePendingRemoval()).toBe('dev-1');

      component.cancelRemoveDevice();
      expect(component.devicePendingRemoval()).toBeNull();

      component.promptRemoveDevice('dev-1');
      await component.confirmRemoveDevice('dev-1');

      expect(removeDeviceMock).toHaveBeenCalledWith('dev-1');
      expect(component.devicePendingRemoval()).toBeNull();
      expect(toastSpy).toHaveBeenCalledWith(translationService.translate('deviceRemoved'));
    });
  });

  it('triggers file input click on triggerImport and forwards file change events', () => {
    const importSpy = jest.fn();
    component.importFileSelected.subscribe(importSpy);

    const fileInput = (fixture.nativeElement as HTMLElement).querySelector(
      '#importFile'
    ) as HTMLInputElement;
    const clickSpy = jest.spyOn(fileInput, 'click').mockImplementation(() => {});

    component.triggerImport();
    expect(clickSpy).toHaveBeenCalled();

    fileInput.dispatchEvent(new Event('change'));
    expect(importSpy).toHaveBeenCalledTimes(1);
    clickSpy.mockRestore();
  });

  describe('Step 5.4: Accessibility & ARIA', () => {
    it('exposes aria-labelledby on settings dialog, aria-pressed on language/theme toggles, and skips hidden file input on Tab', () => {
      const host = fixture.nativeElement as HTMLElement;
      const dialog = host.querySelector('[role="dialog"]') as HTMLElement;
      const labelledBy = dialog.getAttribute('aria-labelledby');
      expect(labelledBy).toBeTruthy();
      expect(host.querySelector(`#${labelledBy}`)?.textContent).toContain(
        translationService.translate('settings')
      );

      expect(
        (host.querySelector('[data-cy="lang-it-btn"]') as HTMLButtonElement).getAttribute(
          'aria-pressed'
        )
      ).toBe(translationService.language() === 'it' ? 'true' : 'false');
      expect(
        (host.querySelector('[data-cy="theme-light-btn"]') as HTMLButtonElement).getAttribute(
          'aria-pressed'
        )
      ).toBe('true');
      expect((host.querySelector('#importFile') as HTMLInputElement).getAttribute('tabindex')).toBe(
        '-1'
      );
    });
  });
});
