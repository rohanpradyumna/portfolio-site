import type { Metadata } from 'next';
import { WheelExperience } from '@/components/wheel/WheelExperience';
import { findTopicById } from '@/data/wheelTopics';

type Search = Promise<{ [key: string]: string | string[] | undefined }>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export async function generateMetadata({ searchParams }: { searchParams: Search }): Promise<Metadata> {
  const topic = findTopicById(one((await searchParams).t) ?? '');
  return {
    title: topic ? `${topic.text} · Rabbit holes` : 'Rabbit holes · Rohan Pradyumna',
    description: 'Pull the lever for a random topic and a way to learn it, then take the prompt to your AI.',
    alternates: { canonical: '/wheel' },
  };
}

export default async function WheelPage({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;
  return <WheelExperience topicId={one(params.t)} modeId={one(params.m)} />;
}
