export interface Credential {
  account: string;
  password: string;
}

export class Entry {
  readonly service: string;
  readonly account: string;

  constructor(service: string, account: string) {
    this.service = service;
    this.account = account;
  }

  getPassword(): string | null {
    return null;
  }

  setPassword(_value: string): void {}

  deletePassword(): boolean {
    return true;
  }
}

export function findCredentials(_service: string): Credential[] {
  return [];
}
