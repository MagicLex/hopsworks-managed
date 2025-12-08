/**
 * Component Pattern Regression Tests
 *
 * Catches anti-patterns in component usage that cause UI issues.
 * These are static analysis tests that grep through source files.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

function getFilesRecursive(dir: string, ext: string): string[] {
  const files: string[] = []

  try {
    const items = readdirSync(dir)
    for (const item of items) {
      const fullPath = join(dir, item)
      const stat = statSync(fullPath)

      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        files.push(...getFilesRecursive(fullPath, ext))
      } else if (item.endsWith(ext)) {
        files.push(fullPath)
      }
    }
  } catch {
    // Ignore errors
  }

  return files
}

describe('StatusMessage component patterns', () => {
  it('should not use StatusMessage with border-0 or p-0 overrides', () => {
    const srcDir = join(process.cwd(), 'src')
    const tsxFiles = getFilesRecursive(srcDir, '.tsx')

    const violations: string[] = []

    for (const file of tsxFiles) {
      const content = readFileSync(file, 'utf-8')
      const lines = content.split('\n')

      lines.forEach((line, index) => {
        // Check for StatusMessage with border-0 or p-0 in className
        if (line.includes('StatusMessage') &&
            (line.includes('border-0') || line.includes('p-0'))) {
          const relativePath = file.replace(process.cwd(), '')
          violations.push(`${relativePath}:${index + 1}: ${line.trim()}`)
        }
      })
    }

    expect(violations,
      `Found StatusMessage with border-0/p-0 override (causes padding issues):\n${violations.join('\n')}`
    ).toHaveLength(0)
  })

  it('should not wrap StatusMessage in Card with p-0 override', () => {
    const srcDir = join(process.cwd(), 'src')
    const tsxFiles = getFilesRecursive(srcDir, '.tsx')

    const violations: string[] = []

    for (const file of tsxFiles) {
      const content = readFileSync(file, 'utf-8')

      // Look for Card containing StatusMessage with override pattern
      const cardStatusPattern = /<Card[^>]*>\s*<StatusMessage[^>]*className="[^"]*(?:border-0|p-0)[^"]*"/g
      const matches = content.match(cardStatusPattern)

      if (matches) {
        const relativePath = file.replace(process.cwd(), '')
        violations.push(`${relativePath}: Card wrapping StatusMessage with style override`)
      }
    }

    expect(violations,
      `Found Card wrapping StatusMessage with style override (use StatusMessage alone):\n${violations.join('\n')}`
    ).toHaveLength(0)
  })
})

describe('HopsSpinner component patterns', () => {
  it('should use HopsSpinner instead of inline spinner divs', () => {
    const srcDir = join(process.cwd(), 'src')
    const tsxFiles = getFilesRecursive(srcDir, '.tsx')

    const violations: string[] = []

    // Pattern: animate-spin with border-b-2 (the old inline spinner)
    const inlineSpinnerPattern = /animate-spin.*border-b-2|border-b-2.*animate-spin/

    for (const file of tsxFiles) {
      // Skip the HopsSpinner component itself
      if (file.includes('HopsSpinner.tsx')) continue

      const content = readFileSync(file, 'utf-8')
      const lines = content.split('\n')

      lines.forEach((line, index) => {
        if (inlineSpinnerPattern.test(line)) {
          const relativePath = file.replace(process.cwd(), '')
          violations.push(`${relativePath}:${index + 1}: ${line.trim()}`)
        }
      })
    }

    expect(violations,
      `Found inline spinner pattern (use HopsSpinner component instead):\n${violations.join('\n')}`
    ).toHaveLength(0)
  })
})
