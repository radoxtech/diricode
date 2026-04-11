import { vi } from "vitest";

const keychainStore = vi.hoisted(() => new Map<string, string>());

vi.mock("@napi-rs/keyring", () => ({
  Entry: vi.fn().mockImplementation((_service: string, account: string) => ({
    getPassword: vi.fn(() => keychainStore.get(`${_service}:${account}`) ?? null),
    setPassword: vi.fn((value: string) => {
      keychainStore.set(`${_service}:${account}`, value);
    }),
    deletePassword: vi.fn(() => keychainStore.delete(`${_service}:${account}`)),
  })),
  findCredentials: vi.fn((service: string) => {
    const creds: { account: string; password: string }[] = [];
    for (const [key, password] of keychainStore) {
      if (key.startsWith(`${service}:`)) {
        creds.push({ account: key.slice(service.length + 1), password });
      }
    }
    return creds;
  }),
}));

const mockListModels = vi.hoisted(() => vi.fn().mockResolvedValue([]));
const mockStart = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockStop = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("@github/copilot-sdk", () => {
  class MockCopilotClient {
    listModels = mockListModels;
    start = mockStart;
    stop = mockStop;
    createSession = vi.fn();
  }
  return {
    CopilotClient: MockCopilotClient,
    approveAll: vi.fn(),
  };
});
