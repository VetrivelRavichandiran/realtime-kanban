import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

const root = path.resolve(import.meta.dirname, "..");

// 1. Make sure schema.prisma uses the SQLite provider
fs.copyFileSync(
  path.join(root, "prisma", "schema.sqlite.prisma"),
  path.join(root, "prisma", "schema.prisma")
);

// 2. Point apps/api/.env at the local SQLite file so the API works right after setup
const envFile = path.join(root, ".env");
if (fs.existsSync(envFile)) {
  let env = fs.readFileSync(envFile, "utf8");
  env = env.replace(
    /^DATABASE_URL=.*/m,
    'DATABASE_URL="file:./dev.db"'
  );
  fs.writeFileSync(envFile, env);
  console.log("Updated apps/api/.env -> DATABASE_URL=file:./dev.db");
} else {
  fs.writeFileSync(envFile, 'DATABASE_URL="file:./dev.db"\nJWT_SECRET="change-me"\nPORT=4000\nCORS_ORIGIN=http://localhost:3000\n');
  console.log("Created apps/api/.env with SQLite DATABASE_URL");
}

// 3. Push the schema and seed demo data
const env = { ...process.env, DATABASE_URL: "file:./dev.db" };
execFileSync("npx", ["prisma", "db", "push"], {
  cwd: root,
  env,
  stdio: "inherit",
  shell: process.platform === "win32"
});
execFileSync("npx", ["tsx", "prisma/seed.ts"], {
  cwd: root,
  env,
  stdio: "inherit",
  shell: process.platform === "win32"
});

console.log("\nDone. Start the API with: pnpm --filter api dev");