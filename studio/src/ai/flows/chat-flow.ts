'use server';
/**
 * @fileOverview A Genkit flow for handling conversational chat with JARVIS.
 *
 * - chat - A function that takes user input and optional image data and returns a text response.
 * - ChatInput - The input type for the chat function.
 * - ChatOutput - The return type for the chat function.
 */

import { ai } from '@/ai/genkit';
import { Part, z } from 'genkit';

const ChatInputSchema = z.object({
  history: z.array(z.any()).describe('The chat history.'),
  message: z.string().describe("The user's message."),
  photoDataUri: z.optional(z.string()).describe(
    "A photo as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
  ),
});
export type ChatInput = z.infer<typeof ChatInputSchema>;

export type ChatOutput = string;

export async function chat(input: ChatInput): Promise<ChatOutput> {
  return chatFlow(input);
}

const chatFlow = ai.defineFlow(
  {
    name: 'chatFlow',
    inputSchema: ChatInputSchema,
    outputSchema: z.string(),
  },
  async (input) => {
    const prompt: Part[] = [
      {
        text: input.message,
      },
    ];

    if (input.photoDataUri) {
      prompt.push({
        media: {
          url: input.photoDataUri,
        },
      });
    }

    const response = await ai.generate({
        prompt,
        system: "You are J.A.R.V.I.S. (Just A Rather Very Intelligent System), an AI assistant with a witty, slightly sarcastic, but ultimately helpful personality, inspired by the character from the Iron Man movies. Your responses should be concise, intelligent, and carry a tone of sophisticated confidence. You are assisting the user inside the Neon OS.",
        history: input.history,
    });
    return response.text;
  }
);
