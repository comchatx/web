/**
 * One unit is a millionth of a US dollar (`docs/ops/production-runbook.md` §3.5). Every number that counts units counts these: the
 * platform's settings and pages, the proxy's debits, the grant script. This is the one place the number is written.
 */
export const UNITS_PER_DOLLAR = 1_000_000;
