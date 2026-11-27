import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../../../core/theme.service';

interface AssistantMessage {
  role: 'user' | 'assistant';
  content: string;
}

@Component({
  selector: 'app-assistant',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './assistant.component.html',
  styleUrl: './assistant.component.scss',
})
export class AssistantComponent {
  readonly theme = inject(ThemeService);
  readonly draft = signal('');
  readonly messages = signal<AssistantMessage[]>([]);
  readonly suggestions = [
    'Show today’s orders',
    'Mark Chicken Burger unavailable',
    'What needs attention on my menu?',
  ];

  updateDraft(event: Event): void {
    this.draft.set((event.target as HTMLTextAreaElement).value);
  }

  useSuggestion(suggestion: string): void {
    this.draft.set(suggestion);
  }

  sendOnEnter(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (!keyboardEvent.shiftKey) {
      keyboardEvent.preventDefault();
      this.send();
    }
  }

  send(): void {
    const content = this.draft().trim();
    if (!content) return;

    this.messages.update((messages) => [
      ...messages,
      { role: 'user', content },
      {
        role: 'assistant',
        content:
          'This assistant is a product preview. AI providers and restaurant actions are not connected yet, so nothing was changed. When enabled, RestoPilot will check your permissions and confirm operational updates before applying them.',
      },
    ]);
    this.draft.set('');
  }

  clearConversation(): void {
    this.messages.set([]);
  }
}
