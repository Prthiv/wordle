'use server';

/**
 * @fileOverview Generates an abstract image for new users when they first open the app.
 *
 * - generateInitialImage - A function that returns a static placeholder image.
 * - GenerateInitialImageInput - The input type for the generateInitialImage function (currently empty).
 * - GenerateInitialImageOutput - The return type for the generateInitialImage function (the image data URI).
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

const GenerateInitialImageInputSchema = z.object({});
export type GenerateInitialImageInput = z.infer<typeof GenerateInitialImageInputSchema>;

const GenerateInitialImageOutputSchema = z.object({
  imageDataUri: z
    .string()
    .describe(
      "A data URI containing the generated image data.  It must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type GenerateInitialImageOutput = z.infer<typeof GenerateInitialImageOutputSchema>;

export async function generateInitialImage(
  input: GenerateInitialImageInput
): Promise<GenerateInitialImageOutput> {
  return generateInitialImageFlow(input);
}

const generateInitialImageFlow = ai.defineFlow(
  {
    name: 'generateInitialImageFlow',
    inputSchema: GenerateInitialImageInputSchema,
    outputSchema: GenerateInitialImageOutputSchema,
  },
  async () => {
    // Return a static placeholder image URL instead of generating one.
    // This is a workaround for the "Imagen API is only accessible to billed users" error.
    return {
      imageDataUri: 'https://picsum.photos/seed/ephemeral-chat/1200/800',
    };
  }
);
