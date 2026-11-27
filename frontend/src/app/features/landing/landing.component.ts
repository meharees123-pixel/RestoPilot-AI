import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FaqItemComponent } from './components/faq-item.component';
import { FeatureCardData, FeatureTileComponent } from './components/feature-tile.component';

interface ProductPreview {
  name: string;
  metric: string;
  metricLabel: string;
  rows: { title: string; detail: string; value: string; state: string }[];
}

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink, FeatureTileComponent, FaqItemComponent],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
})
export class LandingComponent {
  readonly navOpen = signal(false);
  readonly activePreview = signal(0);

  readonly features: FeatureCardData[] = [
    { icon: '✳', title: 'AI Customer Agent', description: 'Answer menu questions, guide choices and keep every customer conversation moving.', label: 'Customer experience' },
    { icon: '⌘', title: 'AI Operations Manager', description: 'Update availability and manage everyday restaurant tasks in plain language.', label: 'For your team' },
    { icon: '↗', title: 'WhatsApp Ordering', description: 'Meet guests in the messaging app they already use, from discovery to order updates.', label: 'WhatsApp first' },
    { icon: '◷', title: 'Reservations', description: 'Keep booking requests and guest details organized alongside daily service.', label: 'Front of house' },
    { icon: '∿', title: 'Voice Commands', description: 'Speak an operational request and turn a voice note into a clear next step.', label: 'Hands-free' },
    { icon: '♡', title: 'Customer Memory', description: 'Remember useful preferences and returning-guest context with privacy in mind.', label: 'Personalization' },
    { icon: '▦', title: 'Menu Management', description: 'Keep items, prices and availability aligned across the restaurant workspace.', label: 'Always current' },
    { icon: '⌁', title: 'Business Insights', description: 'Bring the signals that matter into focus as reporting capabilities evolve.', label: 'Coming soon' },
  ];

  readonly steps = [
    { number: '01', title: 'Connect WhatsApp', text: 'Bring your restaurant’s customer conversations into one organized workspace.' },
    { number: '02', title: 'Set up your menu', text: 'Add your items, branches and the details your team needs to serve well.' },
    { number: '03', title: 'Chat with AI', text: 'Ask for operational help in natural language, by text or voice.' },
    { number: '04', title: 'Grow with clarity', text: 'Build on a calmer service flow and learn what to improve next.' },
  ];

  readonly previews: ProductPreview[] = [
    {
      name: 'Orders',
      metric: 'QAR 1,840',
      metricLabel: 'Sample service total',
      rows: [
        { title: 'Order #1048', detail: 'Chicken burger · 2 items', value: 'QAR 68', state: 'Preparing' },
        { title: 'Order #1047', detail: 'Karak · 3 items', value: 'QAR 24', state: 'Ready' },
        { title: 'Order #1046', detail: 'Family meal · 4 items', value: 'QAR 126', state: 'New' },
      ],
    },
    {
      name: 'Customers',
      metric: 'Returning guests',
      metricLabel: 'A clearer view of regulars',
      rows: [
        { title: 'Guest profile', detail: 'Favorite: spicy chicken', value: 'Regular', state: 'Known' },
        { title: 'Guest profile', detail: 'Prefers pickup', value: '3 visits', state: 'Returning' },
        { title: 'Guest profile', detail: 'Vegetarian preference', value: 'Saved', state: 'Known' },
      ],
    },
    {
      name: 'Menu',
      metric: 'Menu at a glance',
      metricLabel: 'Availability and updates',
      rows: [
        { title: 'Chicken Burger', detail: 'Main menu · 18 min', value: 'QAR 32', state: 'Available' },
        { title: 'Mango Juice', detail: 'Drinks · 5 min', value: 'QAR 12', state: 'Available' },
        { title: 'Karak Tea', detail: 'Hot drinks · 4 min', value: 'QAR 6', state: 'Popular' },
      ],
    },
    {
      name: 'Reports',
      metric: 'Service overview',
      metricLabel: 'A preview of restaurant reporting',
      rows: [
        { title: 'Weekly sales', detail: 'Compare service periods', value: 'View', state: 'Insight' },
        { title: 'Top items', detail: 'See what guests reorder', value: 'View', state: 'Insight' },
        { title: 'Branch performance', detail: 'Spot differences by location', value: 'View', state: 'Insight' },
      ],
    },
    {
      name: 'Reservations',
      metric: 'Guest bookings',
      metricLabel: 'Requests in one place',
      rows: [
        { title: 'Table request', detail: '2 guests · 7:30 PM', value: 'Today', state: 'Pending' },
        { title: 'Family booking', detail: '5 guests · 8:00 PM', value: 'Today', state: 'Confirmed' },
        { title: 'Weekend table', detail: '4 guests · 6:00 PM', value: 'Friday', state: 'Confirmed' },
      ],
    },
    {
      name: 'AI Insights',
      metric: 'A clearer next move',
      metricLabel: 'Illustrative recommendation',
      rows: [
        { title: 'Popular pairing', detail: 'Burger orders often include a drink', value: 'Review', state: 'Suggestion' },
        { title: 'Availability check', detail: 'Review low-stock menu items', value: 'Review', state: 'Suggestion' },
        { title: 'Service rhythm', detail: 'Compare busy ordering periods', value: 'Review', state: 'Suggestion' },
      ],
    },
  ];

  readonly currentPreview = computed(() => this.previews[this.activePreview()]);

  toggleNavigation(): void {
    this.navOpen.update((open) => !open);
  }

  closeNavigation(): void {
    this.navOpen.set(false);
  }

  selectPreview(index: number): void {
    this.activePreview.set(index);
  }
}
