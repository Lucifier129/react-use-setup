import React from 'react'
import { reactive, watch, getState } from './reactive'

const { useState, useLayoutEffect, useMemo } = React

export default function useSetup<T extends object>(setup: () => T) {
  let state$ = useMemo<T>(() => reactive(setup()), [])
  let state = useReactive(state$)
  return state
}

const useReactive = <T extends object>(state$: T): T => {
  let [state, setState] = useState(() => getState(state$))
  useLayoutEffect(() => watch(state$, setState), [])
  return state
}
