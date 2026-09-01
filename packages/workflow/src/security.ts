import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export interface SecurityFinding {
  code: "LC-SECURITY-001";
  path: string;
  line: number;
  pattern: string;
}

export interface SecurityScanResult { passed: boolean; scannedFiles: number; findings: SecurityFinding[] }

const textExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".md", ".yaml", ".yml", ".txt", ".toml", ".xml"]);
const ignoredDirectories = new Set(["node_modules", ".git", ".livingcourse", "coverage"]);
const patterns = [
  { name: "api-key", expression: /(?:api[_-]?key|secret)[\s"']*[:=][\s"']*[A-Za-z0-9_\-]{20,}/iu },
  { name: "bearer-token", expression: /Bearer\s+[A-Za-z0-9._\-]{20,}/iu },
  { name: "raw-credential", expression: /(?:password|credential|access[_-]?token)\s*[:=]\s*["']?[A-Za-z0-9._\-]{16,}/iu },
  { name: "signed-temporary-url", expression: /[?&](?:X-Amz-Signature|Signature|sig)=[A-Fa-f0-9%]{16,}/iu },
  { name: "private-key", expression: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u },
  { name: "private-customer-record", expression: /(?:customer|client)[_-]?(?:id|name|record)\s*[:=]\s*["']?(?!example|synthetic|test)[A-Za-z0-9._\-]{8,}/iu },
  { name: "government-id", expression: /\b\d{17}[\dXx]\b/u }
] as const;

const walk = async (root: string): Promise<string[]> => {
  const files: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) files.push(...await walk(path.join(root, entry.name)));
    } else if (textExtensions.has(path.extname(entry.name).toLowerCase())) files.push(path.join(root, entry.name));
  }
  return files;
};

export const scanPublicPackage = async (root: string): Promise<SecurityScanResult> => {
  const resolvedRoot = path.resolve(root);
  const files = await walk(resolvedRoot);
  const findings: SecurityFinding[] = [];
  for (const file of files) {
    const lines = (await readFile(file, "utf8")).split(/\r?\n/u);
    for (const [index, line] of lines.entries()) {
      for (const pattern of patterns) {
        if (pattern.expression.test(line)) findings.push({ code: "LC-SECURITY-001", path: path.relative(resolvedRoot, file).replaceAll("\\", "/"), line: index + 1, pattern: pattern.name });
      }
    }
  }
  return { passed: findings.length === 0, scannedFiles: files.length, findings };
};
