export type PackageCheckSummary = {
  package: string;
  version: string;
  entryCount: number;
  files: string[];
};

export function parsePackOutput(stdout: string): unknown;
export function checkPackage(raw?: string): PackageCheckSummary;
export function main(): void;
