import { config } from 'dotenv';
config();

import '@/ai/flows/generate-initial-image.ts';
import '@/ai/flows/send-webhook.ts';
