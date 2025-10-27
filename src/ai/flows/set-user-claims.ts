'use server';
/**
 * @fileOverview A flow for setting custom claims on a Firebase user.
 * 
 * - setUserClaims - Sets custom claims for a given user UID.
 * - SetUserClaimsInput - The input type for the setUserClaims function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const SetUserClaimsInputSchema = z.object({
  uid: z.string().describe('The UID of the user to set claims for.'),
  claims: z.record(z.any()).describe('The custom claims to set on the user account.'),
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
      console.log(`Custom claims set for user ${uid}`, claims);
      return { success: true };
    } catch (error) {
      console.error('Error setting custom claims:', error);
      throw new Error(`Failed to set custom claims for user ${uid}`);
    }
  }
);
