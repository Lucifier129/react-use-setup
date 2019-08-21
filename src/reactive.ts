import { isArray, isObject, merge, createDeferred } from './util'

const INTERNAL = Symbol('INTERNAL')

export const isReactive = (input: any): boolean => {
  return !!(input && input[INTERNAL])
}

export const getState = <T extends object>(input: T): T => {
  if (!isReactive(input)) {
    throw new Error(`Expect ${input} to be reactive`)
  }
  return input[INTERNAL].compute()
}

const createImmutable = <T extends object>(state$: T) => {
  let isArrayType = isArray(state$)
  let immutableTarget = (isArrayType ? [] : {}) as T
  let isDirty = false

  let mark = () => {
    isDirty = true
  }

  let computeArray = () => {
    immutableTarget = [] as T

    for (let i = 0; i < (state$ as any[]).length; i++) {
      let item = state$[i]

      if (isReactive(item)) {
        immutableTarget[i] = getState(item)
      } else {
        immutableTarget[i] = item
      }
    }
  }

  let computeObject = () => {
    immutableTarget = {} as T

    for (let key in state$) {
      let value = state$[key as string]

      if (isReactive(value)) {
        immutableTarget[key as string] = getState(value)
      } else {
        immutableTarget[key as string] = value
      }
    }
  }

  let compute = () => {
    if (!isDirty) return immutableTarget

    isDirty = false

    if (isArrayType) {
      computeArray()
    } else {
      computeObject()
    }

    return immutableTarget
  }

  return {
    mark,
    compute
  }
}

export const reactive = <T extends object>(state: T): T => {
  if (!isObject(state) && !isArray(state)) {
    let message = `Expect state to be array or object, instead of ${state}`
    throw new Error(message)
  }

  let isArrayType = isArray(state)

  let target = isArrayType ? [] : {}

  let connection = {
    parent: null,
    key: null
  }

  let connect = (parent, key) => {
    connection.parent = parent
    connection.key = key
  }

  let disconnect = () => {
    connection.parent = null
    connection.key = null
  }

  let isConnected = () => {
    return !!connection.parent
  }

  let remove = () => {
    if (!connection.parent) return false

    let { parent, key } = connection

    if (isArray(parent)) {
      let index = parent.indexOf(state$)
      parent.splice(index, 1)
    } else {
      delete parent[key]
    }

    return true
  }

  let uid = 0
  let consuming = false
  let deferred = createDeferred<T>()

  let doResolve = (n: number) => {
    if (n !== uid) return
    deferred.resolve(getState(state$))
    deferred = createDeferred<T>()
    consuming = false
  }

  let notify = () => {
    immutable.mark()

    if (consuming) {
      // tslint:disable-next-line: no-floating-promises
      Promise.resolve(++uid).then(doResolve) // debounced by promise
    }

    if (connection.parent) {
      connection.parent[INTERNAL].notify()
    }
  }

  let handlers: ProxyHandler<T> = {
    get(target, key, receiver) {
      if (key === INTERNAL) return internal

      return Reflect.get(target, key, receiver)
    },

    set(target, key, value, receiver) {
      let prevValue = target[key]

      if (prevValue === value) return true

      if (typeof key === 'symbol') {
        return Reflect.set(target, key, value, receiver)
      }

      if (isArrayType && key === 'length' && value < (target as any[]).length) {
        // disconnect coitem when reduce array.length
        for (let i = value; i < (target as any[]).length; i++) {
          let item = target[i]
          if (isReactive(item)) {
            item[INTERNAL].disconnect()
          }
        }
      }

      // connect current value
      if (isReactive(value) && !value[INTERNAL].isConnected()) {
        value[INTERNAL].connect(state$, key)
      } else if (isObject(value) || isArray(value)) {
        value = reactive(value)
        value[INTERNAL].connect(state$, key)
      }

      // disconnect previous value
      if (isReactive(prevValue)) {
        prevValue[INTERNAL].disconnect()
      }

      Reflect.set(target, key, value, receiver)

      notify()

      return true
    },

    deleteProperty(target, key) {
      if (typeof key === 'symbol') {
        return Reflect.deleteProperty(target, key)
      }

      let value = target[key]

      if (isReactive(value)) {
        value[INTERNAL].disconnect()
      }

      Reflect.deleteProperty(target, key)

      notify()

      return true
    }
  }

  let state$ = new Proxy(target, handlers) as T
  let immutable = createImmutable(state$)
  let internal = {
    compute: immutable.compute,
    connect,
    disconnect,
    isConnected,
    notify,
    remove,
    get promise() {
      consuming = true
      return deferred.promise
    }
  }

  merge(state$, state)

  return state$
}

export type Unwatch = () => void
export type Watcher<T> = (state: T) => void

export const watch = <T extends any[] | object = any>(state$: T, watcher: Watcher<T>): Unwatch => {
  if (!isReactive(state$)) {
    throw new Error(`Expected reactive state, but received ${state$}`)
  }

  if (typeof watcher !== 'function') {
    throw new Error(`Expected watcher to be a function, instead of ${watcher}`)
  }

  let unwatched = false

  let consume = state => {
    if (unwatched) return
    watcher(state)
    f()
  }

  let f = () => {
    if (unwatched) return
    state$[INTERNAL].promise.then(consume)
  }

  f()

  return () => {
    unwatched = true
  }
}

export const remove = <T extends any[] | object = any>(state$: T): boolean => {
  if (!isReactive(state$)) {
    throw new Error(`Expected reactive state, but got ${state$}`)
  }
  return state$[INTERNAL].remove()
}

export const ref = current => reactive({ current })
