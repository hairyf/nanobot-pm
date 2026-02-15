export function createTimeout(ms: number) {
  let id: ReturnType<typeof setTimeout>
  const promise = new Promise<void>((resolve) => {
    id = setTimeout(resolve, ms)
  })
  return {
    promise,
    abort() {
      clearTimeout(id)
    },
  }
}

export function createInterval(ms: number, callback: () => void) {
  const id = setInterval(callback, ms)
  return {
    stop() {
      clearInterval(id)
    },
  }
}

export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message?: string,
): Promise<T> {
  const { promise: timeoutPromise, abort } = createTimeout(ms)
  try {
    const result = await Promise.race([
      promise,
      timeoutPromise.then(() => {
        abort()
        throw new Error(message ?? `Operation timed out after ${ms}ms`)
      }),
    ])
    abort()
    return result
  }
  catch (err) {
    abort()
    throw err
  }
}
