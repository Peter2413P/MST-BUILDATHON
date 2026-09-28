'use client';

import { useParams } from 'next/navigation';
import ChatWorkspace from '@/components/ChatWorkspace';

export default function JobPage() {
  const { id } = useParams() as { id: string };
  return <ChatWorkspace initialJobId={id} />;
}
