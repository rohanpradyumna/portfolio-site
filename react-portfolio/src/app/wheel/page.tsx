import type { Metadata } from 'next';
import { WheelExperience } from '@/components/wheel/WheelExperience';

export const metadata: Metadata = {
  title: 'Pull the Lever · Rohan Pradyumna',
  description:
    'Pull the lever for a random topic across philosophy, history, science, and more. Research it, write your take, and see what others wrote.',
  alternates: {
    canonical: '/wheel',
  },
};

export default function WheelPage() {
  return <WheelExperience />;
}
