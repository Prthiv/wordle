"use client";

import { useState } from 'react';
import PuzzleView from '@/components/puzzle-view';
import ChatView from '@/components/chat-view';

export default function Home() {
  const [isUnlocked, setIsUnlocked] = useState(false);

  return (
    <main className="h-[100dvh] bg-background pb-2">
      {isUnlocked ? (
        <ChatView />
      ) : (
        <PuzzleView onSuccess={() => setIsUnlocked(true)} />
      )}
    </main>
  );
}
