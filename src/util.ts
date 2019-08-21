export const isArray = Array.isArray

export const isFunction = (input: any) => typeof input === 'function'

export const isObject = (obj: any) => {
  if (typeof obj !== 'object' || obj === null) return false

  let proto = obj
  while (Object.getPrototypeOf(proto) !== null) {
    proto = Object.getPrototypeOf(proto)
  }

  return Object.getPrototypeOf(obj) === proto
}

export const merge = <T = any>(target: object | Array<T>, source: object | Array<T>) => {
  if (isArray(source) && isArray(target)) {
    for (let i = 0; i < source.length; i++) {
      target[i] = source[i]
    }

    return target
  }

  if (isObject(source) && isObject(target)) {
    for (let key in source) {
      let descriptor = Object.getOwnPropertyDescriptor(source, key)

      // normal value
      if (descriptor.hasOwnProperty('value')) {
        target[key] = descriptor.value
      } else {
        // accessor
        Object.defineProperty(target, key, descriptor)
      }
    }

    return target
  }

  throw new Error(`target and source are not the same type of object or array, ${target} ${source}`)
}

interface Deferred<T = any> {
  promise: Promise<T>
  resolve: (value?: T) => void
  reject: (reason?: any) => void
}

const noop = () => {}

export const createDeferred = <T>(): Deferred<T> => {
  let resolve: Deferred<T>['resolve'] = noop
  let reject: Deferred<T>['reject'] = noop
  let promise: Promise<T> = new Promise((a, b) => {
    resolve = a
    reject = b
  })
  return { resolve, reject, promise }
}
