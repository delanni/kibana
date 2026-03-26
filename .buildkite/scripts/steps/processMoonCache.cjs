/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

const { readdirSync, readFileSync, existsSync, statSync } = require('fs');
const { join, basename } = require('path');

async function processMoonCache(cacheDir) {
  const hashesDir = join(cacheDir, 'hashes');
  const outputsDir = join(cacheDir, 'outputs');

  // Read all hash JSON files
  const hashFiles = readdirSync(hashesDir).filter((f) => f.endsWith('.json'));

  const results = [];

  for (const hashFile of hashFiles) {
    const hash = basename(hashFile, '.json');
    const hashPath = join(hashesDir, hashFile);
    const outputPath = join(outputsDir, `${hash}.tar.gz`);

    try {
      // Read hash file
      const hashContent = JSON.parse(readFileSync(hashPath, 'utf8'));
      const command = hashContent[0]?.command;
      const args = hashContent[0]?.args;
      const target = hashContent[0]?.target;

      // Get output file size
      if (existsSync(outputPath)) {
        const stats = statSync(outputPath);
        let commandName = args ? `${command} ${args.join(' ')}` : command;
        if (target) {
          commandName += ` (${target})`;
        }
        results.push({
          command: commandName,
          hashPath,
          size: stats.size,
          sizeReadable: formatBytes(stats.size),
        });
      }
    } catch (err) {
      console.error(`Error processing ${hashFile}:`, err.message);
    }
  }

  // Display results
  console.log('Moon Cache Processing Results:\n');
  results.forEach((r) => {
    console.log(`${r.hashPath}:\n${r.command}\n  Size: ${r.sizeReadable} (${r.size} bytes)\n`);
  });

  return results;
}

function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIdx = 0;
  while (size >= 1024 && unitIdx < units.length - 1) {
    size /= 1024;
    unitIdx++;
  }
  return `${size.toFixed(2)} ${units[unitIdx]}`;
}

// Main execution
const cacheDir = process.argv[2];
if (!cacheDir) {
  console.error('Usage: node processMoonCache.js <cache-directory>');
  process.exit(1);
}

processMoonCache(cacheDir).catch(console.error);
