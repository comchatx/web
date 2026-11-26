/**
 * Where the image once kept the packages it carried, each on a root of its own name. The image lays nothing there now — every package
 * installs from npm — but an account made before that keeps the rows its list named there, and the steward still reads the directory.
 */
export const IMAGE_PACKAGE_ROOT = "/opt/comchatx/packages";
export const imageSource = (name: string): string => `${IMAGE_PACKAGE_ROOT}/${name}`;
