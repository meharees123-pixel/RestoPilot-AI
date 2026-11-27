import { Component, input } from '@angular/core';

@Component({
  selector: 'app-faq-item',
  standalone: true,
  template: `
    <details class="faq-item">
      <summary>
        <span>{{ question() }}</span>
        <span class="faq-plus" aria-hidden="true">+</span>
      </summary>
      <p>{{ answer() }}</p>
    </details>
  `,
  styles: `
    :host { display: block; }
    .faq-item { border-bottom: 1px solid rgb(148 163 184 / 16%); }
    summary {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 1.2rem 0;
      color: #e7edf5;
      cursor: pointer;
      font-size: .94rem;
      font-weight: 600;
      list-style: none;
    }
    summary::-webkit-details-marker { display: none; }
    .faq-plus { color: #45dc7d; font-size: 1.4rem; font-weight: 400; transition: transform 160ms ease; }
    details[open] .faq-plus { transform: rotate(45deg); }
    p { max-width: 45rem; margin: -.1rem 2rem 1.2rem 0; color: #94a3b8; font-size: .87rem; line-height: 1.75; }
  `,
})
export class FaqItemComponent {
  readonly question = input.required<string>();
  readonly answer = input.required<string>();
}
