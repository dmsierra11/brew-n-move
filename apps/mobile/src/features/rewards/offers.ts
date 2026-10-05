import type { IllustrationKind } from '../../components/OfferIllustration';

export type Offer = {
  id: string;
  partner: string;
  location: string;
  title: string;
  value: string;
  points: number;
  accent: string;
  illustration: IllustrationKind;
};

export const offers: Offer[] = [
  {
    id: 'brew-lab-flat-white',
    partner: 'Brew Lab',
    location: 'Pearse Street',
    title: 'Flat white',
    value: 'Free coffee · €4.50 value',
    points: 200,
    accent: '#D9E8DF',
    illustration: 'flat-white',
  },
  {
    id: 'canal-coffee-pastry',
    partner: 'Canal Coffee',
    location: 'Portobello',
    title: 'Coffee and pastry',
    value: '€4 off',
    points: 260,
    accent: '#E9DDC7',
    illustration: 'coffee-pastry',
  },
  {
    id: 'oak-and-bean-lunch',
    partner: 'Oak & Bean',
    location: 'Smithfield',
    title: 'Lunch special',
    value: '€5 off',
    points: 340,
    accent: '#DAD8C7',
    illustration: 'lunch',
  },
];

export const selectedOffer = offers[0];
