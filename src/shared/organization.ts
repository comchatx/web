/// <reference path="./validate-npm-package-name.d.ts" />
import validate from "validate-npm-package-name";

/** npm's list of the packages the comchatx organization holds: an object keyed by package name. What makes a package ours. */
export const ORGANIZATION_LIST_URL = "https://registry.npmjs.org/-/org/comchatx/package";

/** What npm says the organization may do with a package it holds: `read` or `write`, as npm's own `npm access` reads the list. */
const PERMISSIONS: readonly unknown[] = ["read", "write"];

/**
 * A name npm takes for a package, by npm's own rule (`validate-npm-package-name`): for a new package, or with `"old"`, for one published
 * before the rule's present form, which may hold a `~` or a core module's name; neither takes a name npm excludes, such as `node_modules`.
 */
export const isNpmPackageName = (name: string, era: "new" | "old" = "new"): boolean => {
  const verdict = validate(name);
  return era === "new" ? verdict.validForNewPackages : verdict.validForOldPackages;
};

/** A name the organization can hold: one npm takes for a new package, bare, as the names published before the scope's rule are, or in our own scope. */
const isOrganizationName = (name: string): boolean => (!name.startsWith("@") || name.startsWith("@comchatx/")) && isNpmPackageName(name);

/**
 * The names the organization's list holds, or nothing when the answer is not that list: an object of package name to permission, and
 * no `error` key, which is how npm answers a read it failed. Anything else, a key that is no name the organization can hold among it,
 * says nothing of what the organization holds.
 */
export function readOrganizationList(body: unknown): ReadonlySet<string> | undefined {
  if (typeof body !== "object" || body === null || Array.isArray(body) || Object.hasOwn(body, "error")) return undefined;
  const entries = Object.entries(body);
  return entries.every(([name, permission]) => isOrganizationName(name) && PERMISSIONS.includes(permission)) ? new Set(entries.map(([name]) => name)) : undefined;
}
