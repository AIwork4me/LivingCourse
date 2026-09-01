import { scanPublicPackage } from "@livingcourse/workflow";

const result = await scanPublicPackage(process.cwd());
console.log(JSON.stringify(result, null, 2));
if (!result.passed) process.exitCode = 1;
