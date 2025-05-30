#!/usr/bin/env ts-node

/**
 * TypeScript Error Mass Fix Script
 * Systematically fixes the 105+ TypeScript compilation errors
 */

import * as fs from 'fs';
import * as path from 'path';

interface FixStats {
  filesProcessed: number;
  enumFixes: number;
  safeObjectFixes: number;
  mockPatternFixes: number;
  nullSafetyFixes: number;
}

class TypeScriptErrorFixer {
  private stats: FixStats = {
    filesProcessed: 0,
    enumFixes: 0,
    safeObjectFixes: 0,
    mockPatternFixes: 0,
    nullSafetyFixes: 0
  };

  /**
   * Fix enum casing issues
   */
  private fixEnumCasing(content: string): string {
    let fixed = content;
    
    // Fix enablerType enum values
    const enumFixes = [
      { from: /enablerType:\s*['"]Architecture['"]/g, to: "enablerType: 'architecture'" },
      { from: /enablerType:\s*['"]Infrastructure['"]/g, to: "enablerType: 'infrastructure'" },
      { from: /enablerType:\s*['"]Technical_Debt['"]/g, to: "enablerType: 'technical_debt'" },
      { from: /enablerType:\s*['"]Research['"]/g, to: "enablerType: 'research'" }
    ];

    enumFixes.forEach(fix => {
      const matches = fixed.match(fix.from);
      if (matches) {
        this.stats.enumFixes += matches.length;
        fixed = fixed.replace(fix.from, fix.to);
      }
    });

    return fixed;
  }

  /**
   * Fix SAFe object missing properties
   */
  private fixSafeObjects(content: string): string {
    let fixed = content;

    // Fix Epic objects - add missing type, features, attributes
    const epicPattern = /{\s*id:\s*['"][^'"]+['"],\s*title:\s*['"][^'"]+['"],\s*description:\s*['"][^'"]+['"]\s*}/g;
    fixed = fixed.replace(epicPattern, (match) => {
      this.stats.safeObjectFixes++;
      const idMatch = match.match(/id:\s*['"]([^'"]+)['"]/);
      const titleMatch = match.match(/title:\s*['"]([^'"]+)['"]/);
      const descMatch = match.match(/description:\s*['"]([^'"]+)['"]/);
      
      if (idMatch && titleMatch && descMatch) {
        return `{ id: '${idMatch[1]}', type: 'epic', title: '${titleMatch[1]}', description: '${descMatch[1]}', features: [], attributes: {} }`;
      }
      return match;
    });

    // Fix Feature objects - add missing type, stories, enablers, attributes
    const featurePattern = /{\s*id:\s*['"][^'"]+['"],\s*title:\s*['"][^'"]+['"],\s*description:\s*['"][^'"]+['"](?:,\s*epicId:\s*['"][^'"]+['"])?\s*}/g;
    fixed = fixed.replace(featurePattern, (match) => {
      this.stats.safeObjectFixes++;
      const idMatch = match.match(/id:\s*['"]([^'"]+)['"]/);
      const titleMatch = match.match(/title:\s*['"]([^'"]+)['"]/);
      const descMatch = match.match(/description:\s*['"]([^'"]+)['"]/);
      const epicIdMatch = match.match(/epicId:\s*['"]([^'"]+)['"]/);
      
      if (idMatch && titleMatch && descMatch) {
        let result = `{ id: '${idMatch[1]}', type: 'feature', title: '${titleMatch[1]}', description: '${descMatch[1]}', stories: [], enablers: [], attributes: {}`;
        if (epicIdMatch) {
          result += `, epicId: '${epicIdMatch[1]}'`;
        }
        result += ' }';
        return result;
      }
      return match;
    });

    // Fix Story objects - add missing type, acceptanceCriteria, attributes
    const storyPattern = /{\s*id:\s*['"][^'"]+['"],\s*title:\s*['"][^'"]+['"],\s*description:\s*['"][^'"]+['"](?:,\s*featureId:\s*['"][^'"]+['"])?\s*}/g;
    fixed = fixed.replace(storyPattern, (match) => {
      this.stats.safeObjectFixes++;
      const idMatch = match.match(/id:\s*['"]([^'"]+)['"]/);
      const titleMatch = match.match(/title:\s*['"]([^'"]+)['"]/);
      const descMatch = match.match(/description:\s*['"]([^'"]+)['"]/);
      const featureIdMatch = match.match(/featureId:\s*['"]([^'"]+)['"]/);
      
      if (idMatch && titleMatch && descMatch) {
        let result = `{ id: '${idMatch[1]}', type: 'story', title: '${titleMatch[1]}', description: '${descMatch[1]}', acceptanceCriteria: [], attributes: {}`;
        if (featureIdMatch) {
          result += `, featureId: '${featureIdMatch[1]}'`;
        }
        result += ' }';
        return result;
      }
      return match;
    });

    return fixed;
  }

  /**
   * Fix Jest mock patterns
   */
  private fixMockPatterns(content: string): string {
    let fixed = content;

    // Fix mockResolvedValue with objects/arrays
    const mockResolvedPattern = /\.mockResolvedValue\(([^)]+)\)/g;
    fixed = fixed.replace(mockResolvedPattern, (match, value) => {
      // Only fix if it's not a simple primitive
      if (value.includes('{') || value.includes('[') || value.includes('as any')) {
        this.stats.mockPatternFixes++;
        return `.mockImplementation(() => Promise.resolve(${value}))`;
      }
      return match;
    });

    // Fix mockRejectedValue with Error objects
    const mockRejectedPattern = /\.mockRejectedValue\((error[^)]*)\)/g;
    fixed = fixed.replace(mockRejectedPattern, (match, errorVar) => {
      this.stats.mockPatternFixes++;
      return `.mockImplementation(() => Promise.reject(${errorVar}))`;
    });

    return fixed;
  }

  /**
   * Fix null safety issues
   */
  private fixNullSafety(content: string): string {
    let fixed = content;

    // Fix array access without null checks
    const arrayAccessPatterns = [
      /planningDocument\.features\[(\d+)\]/g,
      /planningDocument\.stories\[(\d+)\]/g,
      /planningDocument\.enablers\[(\d+)\]/g
    ];

    arrayAccessPatterns.forEach(pattern => {
      const matches = fixed.match(pattern);
      if (matches) {
        this.stats.nullSafetyFixes += matches.length;
        fixed = fixed.replace(pattern, (match, index) => {
          const arrayName = match.split('[')[0];
          return `${arrayName}?.[${index}]`;
        });
      }
    });

    // Fix property access without null checks
    const propertyAccessPatterns = [
      /\.children\[(\d+)\]\.attributes/g,
      /\.children\[(\d+)\]\.type/g,
      /\.children\[(\d+)\]\.content/g
    ];

    propertyAccessPatterns.forEach(pattern => {
      const matches = fixed.match(pattern);
      if (matches) {
        this.stats.nullSafetyFixes += matches.length;
        fixed = fixed.replace(pattern, (match, index) => {
          return match.replace('.children[', '.children?.[').replace('].', ']?.');
        });
      }
    });

    return fixed;
  }

  /**
   * Process a single file
   */
  private processFile(filePath: string): void {
    console.log(`Processing: ${filePath}`);
    
    const content = fs.readFileSync(filePath, 'utf8');
    let fixed = content;

    // Apply all fixes
    fixed = this.fixEnumCasing(fixed);
    fixed = this.fixSafeObjects(fixed);
    fixed = this.fixMockPatterns(fixed);
    fixed = this.fixNullSafety(fixed);

    // Write back if changed
    if (fixed !== content) {
      fs.writeFileSync(filePath, fixed, 'utf8');
      console.log(`✅ Fixed: ${filePath}`);
    } else {
      console.log(`⏭️  No changes: ${filePath}`);
    }

    this.stats.filesProcessed++;
  }

  /**
   * Find all TypeScript test files
   */
  private findTestFiles(): string[] {
    const testDirs = ['tests', 'src'];
    const files: string[] = [];

    const scanDir = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      
      const entries = fs.readdirSync(dir);
      entries.forEach(entry => {
        const fullPath = path.join(dir, entry);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          scanDir(fullPath);
        } else if (entry.endsWith('.test.ts') || entry.endsWith('.ts')) {
          files.push(fullPath);
        }
      });
    };

    testDirs.forEach(scanDir);
    return files;
  }

  /**
   * Run the mass fix
   */
  public run(): void {
    console.log('🚀 Starting TypeScript Error Mass Fix...\n');

    const files = this.findTestFiles();
    console.log(`Found ${files.length} TypeScript files to process\n`);

    files.forEach(file => this.processFile(file));

    console.log('\n📊 Fix Statistics:');
    console.log(`Files Processed: ${this.stats.filesProcessed}`);
    console.log(`Enum Fixes: ${this.stats.enumFixes}`);
    console.log(`SAFe Object Fixes: ${this.stats.safeObjectFixes}`);
    console.log(`Mock Pattern Fixes: ${this.stats.mockPatternFixes}`);
    console.log(`Null Safety Fixes: ${this.stats.nullSafetyFixes}`);
    console.log(`Total Fixes: ${this.stats.enumFixes + this.stats.safeObjectFixes + this.stats.mockPatternFixes + this.stats.nullSafetyFixes}`);
    
    console.log('\n✅ Mass fix complete! Run `npx tsc --noEmit` to verify.');
  }
}

// Run the script
if (require.main === module) {
  const fixer = new TypeScriptErrorFixer();
  fixer.run();
}
