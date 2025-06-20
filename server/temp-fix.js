const fs = require('fs');

// Read the file
const filePath = 'routes.ts';
const content = fs.readFileSync(filePath, 'utf8');

// Split into lines
const lines = content.split('\n');

// Replace the specific PDF streaming section at line ~3396-3411
const startLine = 3395;
const endLine = 3411;
const replacementLines = [
  '          // Use the streaming helper function to handle large files with range support',
  '          await streamFileToResponse(',
  '            document.filePath,',
  '            document.title || \'document.pdf\',',
  '            \'application/pdf\',',
  '            req,',
  '            res',
  '          );'
];

// Replace the lines
const newLines = [
  ...lines.slice(0, startLine),
  ...replacementLines,
  ...lines.slice(endLine + 1)
];

// Write the file back
fs.writeFileSync(filePath, newLines.join('\n'));

console.log('File updated successfully');
