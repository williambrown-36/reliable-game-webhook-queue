import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const runInBand = args.includes("--runInBand");
const forwardedArgs = args.filter((arg) => arg !== "--runInBand");

if (runInBand) {
  forwardedArgs.push("--maxWorkers=1", "--minWorkers=1");
}

const vitest = fileURLToPath(new URL("../node_modules/vitest/vitest.mjs", import.meta.url));
const result = spawnSync(process.execPath, [vitest, "run", ...forwardedArgs], {
  stdio: "inherit",
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
