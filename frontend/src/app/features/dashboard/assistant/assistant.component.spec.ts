import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AssistantComponent } from './assistant.component';

describe('AssistantComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssistantComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('labels assistant responses as preview-only and never implies an action ran', () => {
    const fixture = TestBed.createComponent(AssistantComponent);
    const component = fixture.componentInstance;
    component.draft.set('Mark Chicken Burger unavailable');

    component.send();

    expect(component.messages().length).toBe(2);
    expect(component.messages()[1].content).toContain('nothing was changed');
    expect(component.draft()).toBe('');
  });

  it('does not create empty messages', () => {
    const fixture = TestBed.createComponent(AssistantComponent);
    fixture.componentInstance.send();

    expect(fixture.componentInstance.messages()).toEqual([]);
  });
});
