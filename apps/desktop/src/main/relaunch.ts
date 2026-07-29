export function prepareRelaunchEnvironment(
  isPackaged: boolean,
  environment: NodeJS.ProcessEnv = process.env
): void {
  if (!isPackaged) delete environment.ELECTRON_RENDERER_URL
}
