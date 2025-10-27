'use server';
/**
 * @fileOverview A Genkit flow for securely setting custom claims on a Firebase user.
 *
 * - setUserClaims - A function to set custom claims for a given user UID.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

const SetUserClaimsInputSchema = z.object({
  uid: z.string().describe('The UID of the user to set claims for.'),
  claims: z.record(z.any()).describe('An object containing the custom claims to set.'),
});
export type SetUserClaimsInput = z.infer<typeof SetUserClaimsInputSchema>;

export async function setUserClaims(input: SetUserClaimsInput): Promise<{ success: boolean }> {
  return setUserClaimsFlow(input);
}

const setUserClaimsFlow = ai.defineFlow(
  {
    name: 'setUserClaimsFlow',
    inputSchema: SetUserClaimsInputSchema,
    outputSchema: z.object({ success: z.boolean() }),
  },
  async ({ uid, claims }) => {
    try {
      await admin.auth().setCustomUserClaims(uid, claims);
      return { success: true };
    } catch (error) {
      console.error('Error setting custom claims:', error);
      return { success: false };
    }
  }
);
