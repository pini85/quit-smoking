/**
 * Thin Capacitor platform shim. `@capacitor/core` is safe to import
 * statically — it works (and answers 'web'/false) in a plain browser too,
 * so this file needs no dynamic import or SSR guard.
 */
import { Capacitor } from '@capacitor/core';

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

export function isNativeAndroid(): boolean {
  return Capacitor.getPlatform() === 'android';
}
