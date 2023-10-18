export function delayedPromise<T>() {
  const result = {
    resolve: (v: T | PromiseLike<T>) => {},
    reject: (reason?: unknown) => {},
  };
  const promise = new Promise<T>((res, rej) => {
    result.resolve = res;
    result.reject = rej;
  });
  return { ...result, promise };
}
