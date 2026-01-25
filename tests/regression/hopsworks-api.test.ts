/**
 * Hopsworks API Regression Tests
 *
 * Tests wrapper functions to ensure they call the underlying function,
 * not themselves (preventing infinite recursion bugs like f2ef6c0).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HOPSWORKS_API_BASE, ADMIN_API_BASE } from '@/lib/hopsworks-api';

describe('fetchWithTimeout', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('calls native fetch, not itself (no infinite recursion)', { timeout: 2000 }, async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response('ok'));
    global.fetch = mockFetch;

    // Dynamic import to get fresh module with mocked fetch
    const { createHopsworksOAuthUser } = await import('@/lib/hopsworks-api');

    // This will timeout if fetchWithTimeout calls itself
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000);

    try {
      await createHopsworksOAuthUser(
        { apiUrl: 'https://test.hopsworks.ai', apiKey: 'test-key' },
        'test@example.com',
        'Test',
        'User',
        'auth0|123',
        1
      );
    } catch {
      // Expected to fail (mock response), but should NOT timeout
    } finally {
      clearTimeout(timeoutId);
    }

    // If we got here without timeout, fetch was called (not infinite recursion)
    expect(mockFetch).toHaveBeenCalled();
  });
});

describe('API endpoint constants', () => {
  it('uses correct API base paths', () => {
    expect(HOPSWORKS_API_BASE).toBe('/hopsworks-api/api');
    expect(ADMIN_API_BASE).toBe('/hopsworks-api/api/admin');
  });

  it('admin base includes hopsworks-api base', () => {
    expect(ADMIN_API_BASE.startsWith(HOPSWORKS_API_BASE.replace('/api', ''))).toBe(true);
  });
});

describe('wrapper function patterns', () => {
  it('no wrapper functions call themselves in hopsworks-api', async () => {
    // Static analysis check: read the source and verify no self-calls
    const fs = await import('fs');
    const path = await import('path');

    const sourceFile = path.join(process.cwd(), 'src/lib/hopsworks-api.ts');
    const source = fs.readFileSync(sourceFile, 'utf-8');

    // Find all function definitions with "WithTimeout" or "WithRetry" pattern
    const wrapperPattern = /(?:async\s+)?function\s+(\w+With\w+)\s*\(/g;
    const matches = [...source.matchAll(wrapperPattern)];

    for (const match of matches) {
      const funcName = match[1];
      // Check if this function calls itself (bad) vs the base function (good)
      const funcBodyStart = source.indexOf(match[0]);
      const funcBodyEnd = source.indexOf('\n}', funcBodyStart);
      const funcBody = source.slice(funcBodyStart, funcBodyEnd);

      // Count self-references (excluding the definition itself)
      const selfCallPattern = new RegExp(`await\\s+${funcName}\\s*\\(`, 'g');
      const selfCalls = [...funcBody.matchAll(selfCallPattern)];

      expect(
        selfCalls.length,
        `${funcName} should not call itself (found ${selfCalls.length} self-calls)`
      ).toBe(0);
    }
  });

  it('no API functions have hardcoded URLs', async () => {
    const fs = await import('fs');
    const path = await import('path');

    const sourceFile = path.join(process.cwd(), 'src/lib/hopsworks-api.ts');
    const source = fs.readFileSync(sourceFile, 'utf-8');

    // Should not have hardcoded hopsworks URLs in fetch calls
    const hardcodedUrls = source.match(/fetch\s*\(\s*['"`]https?:\/\/[^'"`]+hopsworks/gi);
    expect(hardcodedUrls, 'Found hardcoded Hopsworks URLs in fetch calls').toBeNull();
  });
});
