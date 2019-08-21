import React from 'react'
import { reactive, watch, getState } from './reactive'

const { useState, useLayoutEffect, useMemo } = React

export default function useSetup(setup) {
  let state$ = useMemo(() => reactive(setup()), [])
  let state = useReactive(state$)
  return state
}

const useReactive = state$ => {
  let [state, setState] = useState(() => getState(state$))
  useLayoutEffect(() => watch(state$, setState), [])
  return state
}
