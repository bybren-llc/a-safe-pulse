#!/usr/bin/env ts-node

/**
 * Quick syntax fix for the parentheses issues introduced by the mass fix script
 */

import * as fs from 'fs';

const files = [
  'src/safe/pi-planning.test.ts',
  'tests/health-api.test.ts', 
  'tests/resource-monitor.test.ts',
  'tests/sync/change-detector.test.ts',
  'tests/sync/sync-manager.test.ts'
];

files.forEach(file => {
  console.log(`Fixing syntax in: ${file}`);
  
  let content = fs.readFileSync(file, 'utf8');
  
  // Fix the specific syntax issues
  content = content.replace(/\)\)\s*\n\s*}\);/g, ')\n      });');
  content = content.replace(/\)\)\s*\n\s*\}\s*as any\)/g, ')\n      } as any)');
  content = content.replace(/timestamp: Date\.now\(\)\)\s*\n\s*}\);/g, 'timestamp: Date.now()\n      });');
  content = content.replace(/query: jest\.fn\(\)\)\s*\.mockImplementation/g, 'query: jest.fn().mockImplementation');
  content = content.replace(/alerts: \[\]\s*\n\s*}\);/g, 'alerts: []\n    });');
  
  fs.writeFileSync(file, content, 'utf8');
  console.log(`✅ Fixed: ${file}`);
});

console.log('✅ All syntax errors fixed!');
