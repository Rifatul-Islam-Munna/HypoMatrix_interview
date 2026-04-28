import { randomBytes } from 'crypto';

export function createId(prefix: 'usr' | 'room' | 'msg'): string {
  return `${prefix}_${randomBytes(9).toString('base64url')}`;
}
