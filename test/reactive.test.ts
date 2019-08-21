import 'jest'
import { reactive, getState, isReactive, watch, remove } from '../src/reactive'

const delay = (timeout = 0) => new Promise(resolve => setTimeout(resolve, timeout))

describe('reactive', () => {
  it('can be watched and unwatched', done => {
    let state$ = reactive({ count: 0 })

    let i = 0

    let unwatch = watch(state$, ({ count }) => {
      expect(count).toBe(i)
      if (count >= 2) {
        if (count > 2) throw new Error('unwatch failed')
        unwatch()
        done()
      }
    })

    let timer
    let provider = () => {
      timer = setInterval(() => {
        state$.count = ++i
        if (i >= 4) clearInterval(timer)
      }, 10)
    }

    // tslint:disable-next-line: no-floating-promises
    provider()
  })

  it('should throw error when watch target is not reactive or watcher is not a functionh', () => {
    expect(() => {
      watch({} as any, () => {})
    }).toThrow()

    expect(() => {
      watch(reactive({}), 1 as any)
    }).toThrow()
  })

  it('works correctly with object', async done => {
    let state$ = reactive({ count: 0 })

    let count = 0
    let unwatch = watch(state$, state => {
      count += 1
      expect(state.count).toEqual(count)
      if (count >= 10) {
        unwatch()
        done()
      }
    })

    for (let i = 0; i < 10; i++) {
      await delay()
      state$.count += 1
    }
  })

  it('works correctly with array', async done => {
    let list$ = reactive([] as number[])

    let count = 0
    let unwatch = watch(list$, list => {
      count += 1
      for (let i = 0; i < count; i++) {
        expect(list[i]).toBe(i)
      }

      if (count >= 10) {
        unwatch()
        done()
        return
      }
    })

    for (let i = 0; i < 10; i++) {
      await delay()
      list$.push(i)
    }
  })

  it('works correctly with nest structure', async done => {
    let state$ = reactive({ counts: [] as number[] })

    let count = 0

    let unwatch = watch(state$, state => {
      count += 1

      for (let i = 0; i < count; i++) {
        expect(state.counts[i]).toBe(i)
      }

      if (count >= 10) {
        unwatch()
        done()
        return
      }
    })

    for (let i = 0; i < 10; i++) {
      await delay()
      state$.counts.push(i)
    }
  })

  it('can detect delete object property', done => {
    let state$ = reactive({ a: 1, b: 2 })

    watch(state$, state => {
      expect(state.hasOwnProperty('b')).toBe(false)
      done()
    })

    expect(state$.hasOwnProperty('b')).toBe(true)

    delete state$.b

    expect(state$.hasOwnProperty('b')).toBe(false)
  })

  it('can detect add object property', done => {
    let state$ = reactive<{ a: number; b: number; c?: number }>({ a: 1, b: 2 })

    watch(state$, state => {
      expect(state.hasOwnProperty('c')).toBe(true)
      done()
    })

    expect(state$.hasOwnProperty('c')).toBe(false)

    state$.c = 1

    expect(state$.hasOwnProperty('c')).toBe(true)
  })

  it('should disconnect array item correctly', done => {
    let list$ = reactive([{ value: 1 }, { value: 2 }, { value: 3 }])
    let covalue0 = list$[0]

    list$.length = 0

    watch(list$, list => {
      console.log('list', list)
      throw new Error('disconnect failed')
    })

    covalue0.value += 1

    setTimeout(() => done(), 4)
  })

  it('can detect delete array item', () => {
    let list$ = reactive([1, 2, 3])
    let list0 = getState(list$)

    list$.splice(1, 1)

    let list1 = getState(list$)

    expect(list0).toEqual([1, 2, 3])
    expect(list1).toEqual([1, 3])
  })

  it('should not reuse state$ which is not connected', () => {
    let child$ = reactive({ a: 1, b: 2 })
    let parent$ = reactive({ child1: child$, child2: child$ })

    child$.b -= 1

    expect(getState(child$)).toEqual({
      a: 1,
      b: 1
    })

    let state = getState(parent$)

    expect(reactive(state) === parent$).toBe(false)

    expect(state.child1 === state.child2).toBe(false)

    // child1 was connected first, so child2 had no chance to reuse the same child$
    expect(state).toEqual({
      child1: {
        a: 1,
        b: 1
      },
      child2: {
        a: 1,
        b: 2
      }
    })

    delete parent$.child1

    let state1 = getState(parent$)

    expect(state1).toEqual({
      child2: {
        a: 1,
        b: 2
      }
    })

    parent$.child2.a += 1

    let state2 = getState(parent$)

    expect(state2).toEqual({
      child2: {
        a: 2,
        b: 2
      }
    })
  })

  it('should support debounce', done => {
    let state$ = reactive({ count: 0 })

    watch(state$, state => {
      expect(state.count).toBe(10)
      done()
    })

    for (let i = 0; i < 10; i++) {
      state$.count += 1
    }
  })

  it('can be detected and retrived', () => {
    let state$ = reactive({ count: 0 })
    let state = getState(state$)

    expect(isReactive({ count: 0 })).toBe(false)
    expect(isReactive(state)).toBe(false)
    expect(isReactive(state$)).toBe(true)
    expect(state === getState(state$)).toBe(true)

    expect(state).toEqual({ count: 0 })
  })

  it('should throw error when getState call on non-reactive value', () => {
    expect(() => {
      getState({})
    }).toThrow()
  })

  it('object state derived by state$ should be immutable', () => {
    let state$ = reactive({ a: { value: 1 }, b: { value: 1 }, c: { value: 1 } })
    let state0 = getState(state$)

    state$.a.value += 1
    let state1 = getState(state$)

    state$.b.value += 1
    let state2 = getState(state$)

    state$.c.value += 1
    let state3 = getState(state$)

    expect(state0 !== state1).toBe(true)
    expect(state0 !== state2).toBe(true)
    expect(state0 !== state3).toBe(true)
    expect(state1 !== state2).toBe(true)
    expect(state1 !== state3).toBe(true)
    expect(state2 !== state3).toBe(true)

    expect(state0.a !== state1.a).toBe(true)
    expect(state0.b === state1.b).toBe(true)
    expect(state0.c === state1.c).toBe(true)

    expect(state1.a === state2.a).toBe(true)
    expect(state1.b !== state2.b).toBe(true)
    expect(state1.c === state2.c).toBe(true)

    expect(state2.a === state3.a).toBe(true)
    expect(state2.b === state3.b).toBe(true)
    expect(state2.c !== state3.c).toBe(true)

    expect(state0).toEqual({ a: { value: 1 }, b: { value: 1 }, c: { value: 1 } })
    expect(state1).toEqual({ a: { value: 2 }, b: { value: 1 }, c: { value: 1 } })
    expect(state2).toEqual({ a: { value: 2 }, b: { value: 2 }, c: { value: 1 } })
    expect(state3).toEqual({ a: { value: 2 }, b: { value: 2 }, c: { value: 2 } })
  })

  it('list state derived by state$ should be immutable', () => {
    let list$ = reactive([{ value: 1 }, { value: 1 }, { value: 1 }])
    let list0 = getState(list$)

    list$[0].value += 1
    let list1 = getState(list$)

    list$[1].value += 1
    let list2 = getState(list$)

    list$[2].value += 1
    let list3 = getState(list$)

    expect(list0 !== list1).toBe(true)
    expect(list0 !== list2).toBe(true)
    expect(list0 !== list3).toBe(true)
    expect(list1 !== list2).toBe(true)
    expect(list1 !== list3).toBe(true)
    expect(list2 !== list3).toBe(true)

    expect(list0[0] !== list1[0]).toBe(true)
    expect(list0[1] === list1[1]).toBe(true)
    expect(list0[2] === list1[2]).toBe(true)

    expect(list1[0] === list2[0]).toBe(true)
    expect(list1[1] !== list2[1]).toBe(true)
    expect(list1[2] === list2[2]).toBe(true)

    expect(list2[0] === list3[0]).toBe(true)
    expect(list2[1] === list3[1]).toBe(true)
    expect(list2[2] !== list3[2]).toBe(true)

    expect(list0).toEqual([{ value: 1 }, { value: 1 }, { value: 1 }])
    expect(list1).toEqual([{ value: 2 }, { value: 1 }, { value: 1 }])
    expect(list2).toEqual([{ value: 2 }, { value: 2 }, { value: 1 }])
    expect(list3).toEqual([{ value: 2 }, { value: 2 }, { value: 2 }])

    list$.push({ value: 1 })
    let list4 = getState(list$)

    expect(list4 !== list3).toBe(true)
    expect(list4[0] === list3[0]).toBe(true)
    expect(list4[1] === list3[1]).toBe(true)
    expect(list4[2] === list3[2]).toBe(true)

    expect(list3).toEqual([{ value: 2 }, { value: 2 }, { value: 2 }])
    expect(list4).toEqual([{ value: 2 }, { value: 2 }, { value: 2 }, { value: 1 }])

    list$.pop()
    let list5 = getState(list$)

    expect(list5 !== list3).toBe(true)
    expect(list5[0] === list3[0]).toBe(true)
    expect(list5[1] === list3[1]).toBe(true)
    expect(list5[2] === list3[2]).toBe(true)

    expect(list3).toEqual([{ value: 2 }, { value: 2 }, { value: 2 }])
    expect(list5).toEqual([{ value: 2 }, { value: 2 }, { value: 2 }])
  })

  it('should ignore the change of symbol key', () => {
    let symbol0: any = Symbol('0')
    let symbol1: any = Symbol('1')
    let state$ = reactive({ count: 1, [symbol0]: 1, [symbol1]: 1 })
    let state0 = getState(state$)

    state$[symbol0] += 1

    let state1 = getState(state$)

    expect(state0 === state1).toBe(true)

    delete state$[symbol1]

    let state2 = getState(state$)

    expect(state0 === state2).toBe(true)
  })

  it('should throw error if the arg passing to co is not object or array', () => {
    expect(() => {
      reactive(() => 1)
    }).toThrow()
  })

  it('should disconnect correctly', () => {
    let state$ = reactive({ a: { value: 1 }, b: { value: 2 } })

    state$.a.value += 1

    let state1 = getState(state$)

    expect(state1.a.value).toBe(2)

    let oldA = state$.a

    state$.a = { value: 1 }

    let state2 = getState(state$)

    expect(state2.a.value).toBe(1)

    oldA.value += 1

    expect(getState(oldA)).toEqual({ value: 3 })

    let state3 = getState(state$)

    expect(state3.a).toEqual({ value: 1 })
  })

  it('state$ object can be removed', done => {
    let state$ = reactive({
      a: { value: 1 },
      b: { value: 2 },
      c: { value: 3 },
      d: { value: 4 }
    })
    let state0 = getState(state$)

    watch(state$, state => {
      expect(state === state1).toBe(true)
      done()
    })

    remove(state$.a)
    remove(state$.c)

    let state1 = getState(state$)

    expect(state0).toEqual({ a: { value: 1 }, b: { value: 2 }, c: { value: 3 }, d: { value: 4 } })
    expect(state1).toEqual({ b: { value: 2 }, d: { value: 4 } })
  })

  it('state$ array can be removed', done => {
    let list$ = reactive([{ value: 1 }, { value: 2 }, { value: 3 }, { value: 4 }])
    let list0 = getState(list$)

    watch(list$, list => {
      expect(list === list1).toBe(true)
      done()
    })

    remove(list$[3])
    remove(list$[0])

    let list1 = getState(list$)

    expect(list0).toEqual([{ value: 1 }, { value: 2 }, { value: 3 }, { value: 4 }])
    expect(list1).toEqual([{ value: 2 }, { value: 3 }])
  })

  it('should throw error when remove target is not a state$', () => {
    expect(() => {
      remove(1 as any)
    }).toThrow()
  })

  it('should support accessor', () => {
    let state$ = reactive({
      firstName: 'Jade',
      lastName: 'Gu',
      get fullName() {
        return state$.firstName + ' ' + state$.lastName
      }
    })

    let state0 = getState(state$)

    expect(state0).toEqual({
      firstName: 'Jade',
      lastName: 'Gu',
      fullName: 'Jade Gu'
    })

    state$.firstName = 'Lesley'
    state$.lastName = 'Huang'

    let state1 = getState(state$)

    expect(state1).toEqual({
      firstName: 'Lesley',
      lastName: 'Huang',
      fullName: 'Lesley Huang'
    })
  })
})
