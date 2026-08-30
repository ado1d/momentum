// WEB TEST SHIM (never ships in the zip) — expo-sqlite backed by sql.js.
import initSqlJs from "sql.js/dist/sql-asm.js";

type SQLParam = string | number | null;
type Stmt = {
  bind(params: any[]): void;
  step(): boolean;
  getAsObject(): Record<string, any>;
  free(): boolean;
};
type SqlJsDb = {
  run(sql: string, params?: any[]): void;
  exec(sql: string): any[];
  prepare(sql: string): Stmt;
  export(): Uint8Array;
  close(): void;
};

let SQLLib: any = null;

/** Called by src/driver.web.ts before any DB use (web only). */
export async function __webInit(): Promise<void> {
  if (SQLLib) return;
  SQLLib = await initSqlJs({});
}

const STORAGE_PREFIX = "momentum-sqlite:";

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return typeof btoa !== "undefined" ? btoa(binary) : Buffer.from(bytes).toString("base64");
}

function base64ToBytes(b64: string): Uint8Array {
  if (typeof atob !== "undefined") {
    const binary = atob(b64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  }
  return new Uint8Array(Buffer.from(b64, "base64"));
}

function normParams(args: any[]): SQLParam[] {
  if (args.length === 1 && Array.isArray(args[0])) return args[0] as SQLParam[];
  return args as SQLParam[];
}

class WebDatabase {
  private db: SqlJsDb;
  constructor(private name: string) {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(STORAGE_PREFIX + name);
    } catch {
      /* no storage */
    }
    if (saved) {
      try {
        this.db = new SQLLib.Database(base64ToBytes(saved));
      } catch {
        this.db = new SQLLib.Database();
      }
    } else {
      this.db = new SQLLib.Database();
    }
  }
  private persist(): void {
    try {
      localStorage.setItem(STORAGE_PREFIX + this.name, bytesToBase64(this.db.export()));
    } catch {
      /* quota — ignore */
    }
  }
  execSync(source: string): void {
    this.db.exec(source);
    this.persist();
  }
  runSync(source: string, ...params: any[]): { changes: number; insertId: number } {
    const stmt = this.db.prepare(source);
    let changes = 0;
    try {
      stmt.bind(normParams(params));
      stmt.step();
      changes = (this.db as any).getRowsModified();
    } finally {
      stmt.free();
    }
    this.persist();
    return { changes, insertId: -1 };
  }
  getFirstSync<T>(source: string, ...params: any[]): T | null {
    const stmt = this.db.prepare(source);
    try {
      stmt.bind(normParams(params));
      if (stmt.step()) return stmt.getAsObject() as T;
      return null;
    } finally {
      stmt.free();
    }
  }
  getAllSync<T>(source: string, ...params: any[]): T[] {
    const stmt = this.db.prepare(source);
    const rows: T[] = [];
    try {
      stmt.bind(normParams(params));
      while (stmt.step()) rows.push(stmt.getAsObject() as T);
    } finally {
      stmt.free();
    }
    return rows;
  }
  withTransactionSync(task: () => void): void {
    this.db.run("BEGIN TRANSACTION");
    try {
      task();
      this.db.run("COMMIT");
    } catch (e) {
      this.db.run("ROLLBACK");
      throw e;
    }
    this.persist();
  }
  closeSync(): void {
    this.persist();
    this.db.close();
  }
}

const instances = new Map<string, WebDatabase>();

export function openDatabaseSync(name: string): WebDatabase {
  let inst = instances.get(name);
  if (!inst) {
    if (!SQLLib) throw new Error("web sqlite driver not ready — call initDatabase() first");
    inst = new WebDatabase(name);
    instances.set(name, inst);
  }
  // QA hook (test-only, never shipped): lets agent-browser inspect the DB.
  if (typeof globalThis !== "undefined") {
    (globalThis as { __qaDb?: WebDatabase }).__qaDb = inst;
  }
  return inst;
}

export function isSqliteWebReady(): boolean {
  return !!SQLLib;
}
