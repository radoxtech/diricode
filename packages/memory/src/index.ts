export { getDatabase } from "./db/client.js";
export { getDbPath } from "./db/path.js";
export { runMigrations } from "./db/migrations/runner.js";
export { getCurrentVersion, getAllVersions } from "./db/schema/version.js";
export type { Migration } from "./db/migrations/runner.js";
export { ModelScoreRepository } from "./db/repositories/ModelScoreRepository.js";
export { TaskRepository } from "./db/repositories/TaskRepository.js";
export type { TaskRecord, TaskStatus } from "./db/repositories/TaskRepository.js";
export { ContextBusRepository } from "./db/repositories/ContextBusRepository.js";
export type { ContextBusEntry } from "./db/repositories/ContextBusRepository.js";
export { BackgroundTaskRepository } from "./db/repositories/BackgroundTaskRepository.js";
export type {
  BackgroundTaskRecord,
  BackgroundTaskStatus,
  TaskPayload,
  ContextSnapshot,
  ResultPayload,
  ErrorDetails,
  TaskPriority,
} from "./db/repositories/BackgroundTaskRepository.js";
