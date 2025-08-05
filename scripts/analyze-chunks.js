// Simple script to demonstrate chunking process
function chunkText(text, options = {}) {
  const {
    maxChunkSize = 1000,
    overlapSize = 200,
    minChunkSize = 100,
  } = options;

  if (text.length <= maxChunkSize) {
    return [text];
  }

  const chunks = [];
  let start = 0;

  while (start < text.length) {
    let end = start + maxChunkSize;
    
    // If this isn't the last chunk, try to break at a sentence or paragraph boundary
    if (end < text.length) {
      // Look for sentence breaks within the last 200 characters
      const searchStart = Math.max(end - 200, start + minChunkSize);
      const substring = text.substring(searchStart, end);
      
      // Look for paragraph breaks first
      const paragraphBreak = substring.lastIndexOf('\n\n');
      if (paragraphBreak !== -1) {
        end = searchStart + paragraphBreak;
      } else {
        // Look for sentence breaks
        const sentenceBreak = substring.lastIndexOf('. ');
        if (sentenceBreak !== -1) {
          end = searchStart + sentenceBreak + 1;
        }
      }
    }

    const chunk = text.substring(start, end).trim();
    if (chunk.length >= minChunkSize) {
      chunks.push(chunk);
    }

    // Move start position with overlap
    start = end - overlapSize;
    if (start >= text.length) break;
  }

  return chunks;
}

// Clean content like the indexer does
function cleanContent(content) {
  // Remove frontmatter
  let cleaned = content.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '');
  
  // Normalize whitespace
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  cleaned = cleaned.replace(/\s+/g, ' ');
  cleaned = cleaned.trim();
  
  return cleaned;
}

// Example content from index.mdx
const indexContent = `---
title: Acme Corp Documentation v1.0
description: Welcome to Acme Corp's manufacturing documentation system (Legacy Version)
---

# Acme Corp Documentation v1.0

Welcome to Acme Corp's legacy documentation system. This is version 1.0 of our manufacturing documentation.

## About Acme Corp (v1.0)

Acme Corporation is a leading manufacturer specializing in industrial equipment and production systems. Our legacy systems have been serving customers since 2020.

## Available Documentation

- [Production Systems](/production-systems) - Basic manufacturing processes
- [Quality Control](/quality-control) - Standard quality procedures

## Legacy Notice

⚠️ **Note**: This is the legacy v1.0 documentation. For the latest features and updated procedures, please visit our [v2.0 documentation](https://acme.domainname/docs).

## Getting Started

Our v1.0 system focuses on core manufacturing processes with basic quality control measures.

### Quick Links
- Production Line Setup
- Basic Quality Checks
- Inventory Overview`;

// Process the content
const cleaned = cleanContent(indexContent);
const chunks = chunkText(cleaned);

console.log('=== ACME CORP INDEX.MDX CHUNKING ANALYSIS ===\n');
console.log('Original content length:', indexContent.length);
console.log('Cleaned content length:', cleaned.length);
console.log('Number of chunks created:', chunks.length);
console.log('\n=== CLEANED CONTENT ===');
console.log(cleaned);
console.log('\n=== CHUNKS ===');

chunks.forEach((chunk, index) => {
  console.log(`\n--- CHUNK ${index} (${chunk.length} chars) ---`);
  console.log(chunk);
});

console.log('\n=== CHUNK STATISTICS ===');
chunks.forEach((chunk, index) => {
  console.log(`Chunk ${index}: ${chunk.length} characters`);
});

console.log('\n=== OVERLAP ANALYSIS ===');
for (let i = 0; i < chunks.length - 1; i++) {
  const chunk1End = chunks[i].slice(-100);
  const chunk2Start = chunks[i + 1].slice(0, 100);
  console.log(`Overlap between chunk ${i} and ${i + 1}:`);
  console.log(`Chunk ${i} ends with: "...${chunk1End}"`);
  console.log(`Chunk ${i + 1} starts with: "${chunk2Start}..."`);
  console.log('---');
} 