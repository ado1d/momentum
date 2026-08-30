declare module "sql.js/dist/sql-asm.js" {
  const initSqlJs: (config?: Record<string, unknown>) => Promise<any>;
  export default initSqlJs;
}
