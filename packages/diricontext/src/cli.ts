#!/usr/bin/env node

import { pathToFileURL } from "node:url";

import { initDatabase } from "./lib/database.js";

export function runCli(): void {
  const db = initDatabase();
  db.close();
}

const isDirectExecution =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  runCli();
}
