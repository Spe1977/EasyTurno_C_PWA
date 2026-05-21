import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ToastContainerComponent } from './toast-container.component';
import { ToastService } from '../services/toast.service';
import { signal } from '@angular/core';

describe('ToastContainerComponent', () => {
  let component: ToastContainerComponent;
  let fixture: ComponentFixture<ToastContainerComponent>;
  let mockToastService: any;

  beforeEach(async () => {
    mockToastService = {
      toasts: signal([
        { id: '1', message: 'Test success', type: 'success' },
        { id: '2', message: 'Test error', type: 'error' },
        { id: '3', message: 'Test warning', type: 'warning' },
        { id: '4', message: 'Test info', type: 'info' },
      ]),
      dismiss: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ToastContainerComponent],
      providers: [{ provide: ToastService, useValue: mockToastService }],
    }).compileComponents();

    fixture = TestBed.createComponent(ToastContainerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render toasts and support dismissing them', () => {
    const dismissButtons = fixture.nativeElement.querySelectorAll('button');
    expect(dismissButtons.length).toBe(4);

    dismissButtons[0].click();
    expect(mockToastService.dismiss).toHaveBeenCalledWith('1');
  });
});
