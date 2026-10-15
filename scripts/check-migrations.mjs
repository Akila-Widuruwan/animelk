/**
 * Checks that every migration in supabase/migrations can be run again.
 *
 * Run: npm run db:check
 *
 * The Supabase SQL editor runs a pasted script in one transaction: one
 * statement that fails rolls the whole thing back. A migration that cannot
 * be re-run is a trap - "policy ... already exists" (SQLSTATE 42710) is the
 * classic one - so every statement that touches an object has to guard
 * itself:
 *
 *   create table  -> if not exists
 *   create index  -> if not exists
 *   create policy -> drop policy if exists, first
 *   create trigger-> drop trigger if exists, first
 *   add column    -> if not exists
 *   create function -> or replace
 *
 * The last check compares supabase/all-migrations.sql with the files it is
 * built from, so the combined file can never drift.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const dir = path.join(root, "supabase", "migrations");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

let problems = 0;

function fail(file, lineNo, text) {
  problems++;
  console.log(`✗ ${file}:${lineNo} ${text}`);
}

/** The last statement that is not a comment or blank. */
function previousStatement(lines, index) {
  for (let j = index - 1; j >= 0; j--) {
    const s = lines[j].trim();
    if (!s || s.startsWith("--")) continue;
    return s;
  }
  return "";
}

for (const file of files) {
  const lines = fs.readFileSync(path.join(dir, file), "utf8").split("\n");

  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith("--")) return;
    const prev = previousStatement(lines, i);

    if (/^create\s+table\s/i.test(line) && !/if\s+not\s+exists/i.test(line)) {
      fail(file, i + 1, `create table without "if not exists"`);
    }

    if (/^create\s+(unique\s+)?index\s/i.test(line) && !/if\s+not\s+exists/i.test(line)) {
      fail(file, i + 1, `create index without "if not exists"`);
    }

    if (/^create\s+trigger\b/i.test(line)) {
      const name = line.match(/^create\s+trigger\s+(\S+)/i)?.[1];
      if (!name || !/^drop\s+trigger\s+if\s+exists\s+/i.test(prev) || !prev.includes(name)) {
        fail(file, i + 1, `create trigger without a "drop trigger if exists" above it`);
      }
    }

    if (/^add\s+column\b/i.test(line) && !/if\s+not\s+exists/i.test(line)) {
      fail(file, i + 1, `add column without "if not exists"`);
    }

    if (/^create\s+(or\s+replace\s+)?function\b/i.test(line) && !/or\s+replace/i.test(line)) {
      fail(file, i + 1, `create function without "or replace"`);
    }

    if (/^create\s+policy\b/i.test(line)) {
      const name = line.match(/^create\s+policy\s+"([^"]+)"/i)?.[1];
      // The table can sit on the same line ("... on public.anime for select")
      // or on the next one (the storage policies).
      const table =
        line.match(/\bon\s+([^\s;]+)/i)?.[1] ??
        lines
          .slice(i + 1)
          .map((l) => l.trim())
          .find((l) => l && !l.startsWith("--"))
          ?.match(/^on\s+([^\s;]+)/i)?.[1];
      if (!name || !table) {
        fail(file, i + 1, `create policy could not be parsed`);
      } else if (!/^drop\s+policy\s+if\s+exists\s+/i.test(prev) || !prev.includes(`"${name}"`) || !prev.includes(table)) {
        fail(file, i + 1, `create policy "${name}" without a matching "drop policy if exists" above it`);
      }
    }
  });
}

// The combined file must match the migrations it is built from.
const combined = path.join(root, "supabase", "all-migrations.sql");
if (fs.existsSync(combined)) {
  const { execFileSync } = await import("node:child_process");
  const before = fs.readFileSync(combined, "utf8");
  execFileSync(process.execPath, [path.join(root, "scripts", "build-migrations.mjs")], {
    stdio: "ignore",
  });
  if (fs.readFileSync(combined, "utf8") !== before) {
    problems++;
    console.log("✗ supabase/all-migrations.sql is out of date - run npm run db:migrations");
  } else {
    console.log("✓ supabase/all-migrations.sql is up to date");
  }
} else {
  problems++;
  console.log("✗ supabase/all-migrations.sql is missing - run npm run db:migrations");
}

if (problems > 0) {
  console.log(`\n${problems} problem(s) found`);
  process.exit(1);
}
console.log(`\nAll ${files.length} migrations can be re-run`);
