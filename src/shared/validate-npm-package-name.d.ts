/** npm's own rule for a package's name (`validate-npm-package-name`, which ships no types). */
declare module "validate-npm-package-name" {
  const validate: (name: string) => { readonly validForNewPackages: boolean; readonly validForOldPackages: boolean };
  export default validate;
}
