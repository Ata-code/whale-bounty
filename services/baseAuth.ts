/**
 * Base Account authentication (Sign in with Base).
 * @see https://docs.base.org/base-account/guides/authenticate-users
 */

import { createBaseAccountSDK } from '@base-org/account';
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';

const BASE_CHAIN_ID = '0x2105'; // Base Mainnet 8453

const usedNoncesKey = 'whale-bounty-used-nonces';

function getUsedNonces(): Set<string> {
  try {
    const raw = sessionStorage.getItem(usedNoncesKey);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

function addUsedNonce(nonce: string): void {
  const used = getUsedNonces();
  used.add(nonce);
  sessionStorage.setItem(usedNoncesKey, JSON.stringify([...used]));
}

function isNonceUsed(nonce: string): boolean {
  return getUsedNonces().has(nonce);
}

/** Generate a fresh nonce (call before user clicks Sign in to avoid popup blockers). */
export function generateNonce(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().replace(/-/g, '')
    : Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

/** Verify SIWE message signature in-browser (no backend). */
export async function verifySignature(params: {
  address: `0x${string}`;
  message: string;
  signature: `0x${string}`;
}): Promise<boolean> {
  const { address, message, signature } = params;
  const client = createPublicClient({
    chain: base,
    transport: http(),
  });
  return client.verifyMessage({ address, message, signature });
}

/** Extract nonce from SIWE message (e.g. "... nonce: abc123" or "at abc123"). */
function extractNonceFromMessage(message: string): string | null {
  const match = message.match(/(?:nonce:|at)\s*(\w{32,})/i);
  return match ? match[1] : null;
}

export interface SignInResult {
  address: `0x${string}`;
  message: string;
  signature: `0x${string}`;
}

export interface AuthError {
  code: string;
  message: string;
}

/**
 * Run Sign in with Base: switch to Base, wallet_connect with signInWithEthereum, then verify.
 * Uses nonce generated locally; tracks used nonces in sessionStorage to prevent reuse.
 */
export async function signInWithBase(nonce: string): Promise<SignInResult> {
  if (isNonceUsed(nonce)) {
    throw { code: 'NONCE_REUSED', message: 'Invalid or reused nonce' } as AuthError;
  }

  const sdk = createBaseAccountSDK({ appName: 'Whale Bounty' });
  const provider = sdk.getProvider();

  // 1. Switch to Base
  await provider.request({
    method: 'wallet_switchEthereumChain',
    params: [{ chainId: BASE_CHAIN_ID }],
  });

  // 2. Connect and sign in with Ethereum
  let accounts: Array<{
    address: string;
    capabilities?: { signInWithEthereum?: { message: string; signature: string } };
  }>;

  try {
    const result = await provider.request({
      method: 'wallet_connect',
      params: [
        {
          version: '1',
          capabilities: {
            signInWithEthereum: {
              nonce,
              chainId: BASE_CHAIN_ID,
            },
          },
        },
      ],
    });
    accounts = (result as { accounts: typeof accounts }).accounts;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('method_not_supported') || message.includes('not supported')) {
      throw {
        code: 'METHOD_NOT_SUPPORTED',
        message: 'Wallet does not support Sign in with Base. Try Coinbase Wallet or Base in-app browser.',
      } as AuthError;
    }
    throw err;
  }

  if (!accounts?.[0]) {
    throw { code: 'NO_ACCOUNTS', message: 'No accounts returned' } as AuthError;
  }

  const account = accounts[0];
  const { address } = account;
  const signIn = account.capabilities?.signInWithEthereum;

  if (!signIn?.message || !signIn?.signature) {
    throw { code: 'NO_SIGNATURE', message: 'Sign in with Ethereum was not completed' } as AuthError;
  }

  const nonceFromMessage = extractNonceFromMessage(signIn.message);
  if (!nonceFromMessage || nonceFromMessage !== nonce) {
    throw { code: 'INVALID_NONCE', message: 'Invalid nonce in message' } as AuthError;
  }

  addUsedNonce(nonce);

  const valid = await verifySignature({
    address: address as `0x${string}`,
    message: signIn.message,
    signature: signIn.signature as `0x${string}`,
  });

  if (!valid) {
    throw { code: 'INVALID_SIGNATURE', message: 'Signature verification failed' } as AuthError;
  }

  return {
    address: address as `0x${string}`,
    message: signIn.message,
    signature: signIn.signature as `0x${string}`,
  };
}
