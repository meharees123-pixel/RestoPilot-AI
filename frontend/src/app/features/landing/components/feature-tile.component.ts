import { Component, input } from '@angular/core';

export interface FeatureCardData {
  icon: string;
  title: string;
  description: string;
  label: string;
}

@Component({
  selector: 'app-feature-tile',
  standalone: true,
  template: `
    <article class="feature-tile">
      <span class="feature-icon" aria-hidden="true">{{ feature().icon }}</span>
      <span class="feature-label">{{ feature().label }}</span>
      <h3>{{ feature().title }}</h3>
      <p>{{ feature().description }}</p>
      <span class="feature-arrow" aria-hidden="true">↗</span>
    </article>
  `,
  styles: `
    :host { display: block; }
    .feature-tile {
      position: relative;
      min-height: 15.5rem;
      padding: 1.4rem;
      border: 1px solid rgb(148 163 184 / 13%);
      border-radius: 1.15rem;
      background: linear-gradient(145deg, rgb(15 23 42 / 72%), rgb(7 13 27 / 84%));
      transition: transform 180ms ease, border-color 180ms ease, background 180ms ease;
    }
    .feature-tile:hover {
      transform: translateY(-4px);
      border-color: rgb(37 211 102 / 36%);
      background: linear-gradient(145deg, rgb(20 34 52 / 90%), rgb(8 17 31 / 96%));
    }
    .feature-icon {
      display: grid;
      width: 2.7rem;
      height: 2.7rem;
      place-items: center;
      border: 1px solid rgb(37 211 102 / 24%);
      border-radius: .85rem;
      background: rgb(37 211 102 / 9%);
      color: #72ed9c;
      font-size: 1.2rem;
      font-weight: 700;
    }
    .feature-label {
      display: block;
      margin-top: 1.3rem;
      color: #73849c;
      font: 500 .64rem 'DM Mono', monospace;
      letter-spacing: .12em;
      text-transform: uppercase;
    }
    h3 { margin: .55rem 0 .45rem; color: #f8fafc; font-size: 1.05rem; letter-spacing: -.03em; }
    p { max-width: 29rem; margin: 0; color: #94a3b8; font-size: .86rem; line-height: 1.7; }
    .feature-arrow { position: absolute; right: 1.3rem; bottom: 1.2rem; color: #53647b; }
    @media (prefers-reduced-motion: reduce) { .feature-tile { transition: none; } }
  `,
})
export class FeatureTileComponent {
  readonly feature = input.required<FeatureCardData>();
}
