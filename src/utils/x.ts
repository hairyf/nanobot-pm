import { x as _x } from 'tinyexec'

export const x: typeof _x = (command, args, options) => {
  return _x(command, args, {
    ...options,
    nodeOptions: {
      ...options?.nodeOptions,
      stdio: 'inherit',
    },
  })
}
