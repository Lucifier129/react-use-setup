import 'jest'
import React from 'react'
import ReactDOM from 'react-dom'
import { act } from 'react-dom/test-utils'
import { reactive, useSetup, ref } from '../src'

const delay = (timeout = 0) => new Promise(resolve => setTimeout(resolve, timeout))

describe('useBistate', () => {
  let container

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    document.body.removeChild(container)
    container = null
  })

  it('basic usage', async () => {
    let setupTest = (initialValue = 0) => {
      let count = reactive({ value: initialValue })

      let incre = () => {
        count.value += 1
      }

      let decre = () => {
        count.value -= 1
      }

      return {
        count,
        incre,
        decre
      }
    }

    let Test = props => {
      let { count, incre, decre } = useSetup(() => setupTest(props.count))
      return (
        <button onClick={incre} onDoubleClick={decre}>
          {count.value}
        </button>
      )
    }

    // tslint:disable-next-line: await-promise
    await act(async () => {
      ReactDOM.render(<Test count={10} />, container)
      await delay()
    })

    let button = container.querySelector('button')

    expect(button.textContent).toBe('10')

    // tslint:disable-next-line: await-promise
    await act(async () => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await delay()
    })

    expect(button.textContent).toBe('11')

    // tslint:disable-next-line: await-promise
    await act(async () => {
      button.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
      await delay()
    })

    expect(button.textContent).toBe('10')
  })
})
