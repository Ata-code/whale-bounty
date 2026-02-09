/**
 * Base Account authentication (Sign in with Base).
 * @see https://docs.base.org/base-account/guides/authenticate-users
 */

import { createBaseAccountSDK } from '@base-org/account';
import { SiweMessage } from 'siwe';
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';

const BASE_CHAIN_ID = '0x2105'; // Base Mainnet 8453
const BASE_CHAIN_ID_DECIMAL = 8453;

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

  // 2. Connect and sign in with Ethereum (or fallback to personal_sign)
  let address: string;
  let message: string;
  let signature: string;

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
    const accounts = (result as { accounts: Array<{ address: string; capabilities?: { signInWithEthereum?: { message: string; signature: string } } } }).accounts;
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (errMsg.includes('method_not_supported') || errMsg.includes('not supported')) {
      return signInWithSiweFallback(nonce, provider);
    }
    throw err;
  }

  const account = accounts?.[0];
  if (!account?.capabilities?.signInWithEthereum?.message || !account.capabilities.signInWithEthereum.signature) {
    throw { code: 'NO_SIGNATURE', message: 'Sign in with Ethereum was not completed' } as AuthError;
  }
  address = account.address;
  message = account.capabilities.signInWithEthereum.message;
  signature = account.capabilities.signInWithEthereum.signature;

  const nonceFromMessage = extractNonceFromMessage(message);
  if (!nonceFromMessage || nonceFromMessage !== nonce) {
    throw { code: 'INVALID_NONCE', message: 'Invalid nonce in message' } as AuthError;
  }

  addUsedNonce(nonce);

  const valid = await verifySignature({
    address: address as `0x${string}`,
    message,
    signature: signature as `0x${string}`,
  });

  if (!valid) {
    throw { code: 'INVALID_SIGNATURE', message: 'Signature verification failed' } as AuthError;
  }

  return {
    address: address as `0x${string}`,
    message,
    signature: signature as `0x${string}`,
  };
}

/**
 * Fallback SIWE flow using eth_requestAccounts + personal_sign.
 * Used when wallet_connect is not supported (e.g. Base mini app embedded WebView).
 */
async function signInWithSiweFallback(
  nonce: string,
  provider: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> }
): Promise<SignInResult> {
  const accounts = await provider.request({ method: 'eth_requestAccounts', params: [] }) as string[];
  const address = accounts?.[0];
  if (!address) {
    throw { code: 'NO_ACCOUNTS', message: 'No accounts returned' } as AuthError;
  }

  const domain = typeof window !== 'undefined' ? window.location.hostname : 'whale-bounty.vercel.app';
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://whale-bounty.vercel.app';

  const siweMessage = new SiweMessage({
    domain,
    address: address as `0x${string}`,
    statement: 'Sign in to Whale Bounty on Base.',
    uri: origin,
    version: '1',
    chainId: BASE_CHAIN_ID_DECIMAL,
    nonce,
    issuedAt: new Date().toISOString(),
  });

  const messageToSign = siweMessage.prepareMessage();
  const sig = await provider.request({
    method: 'personal_sign',
    params: [messageToSign, address],
  }) as string;

  addUsedNonce(nonce);

  const valid = await verifySignature({
    address: address as `0x${string}`,
    message: messageToSign,
    signature: sig as `0x${string}`,
  });

  if (!valid) {
    throw { code: 'INVALID_SIGNATURE', message: 'Signature verification failed' } as AuthError;
  }

  return {
    address: address as `0x${string}`,
    message: messageToSign,
    signature: sig as `0x${string}`,
  };
}
