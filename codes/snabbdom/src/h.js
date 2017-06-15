import { isArray, isPrimitive, flattenArray } from './utils'
import vnode from './vnode'

const hasOwnProperty = Object.prototype.hasOwnProperty
const RESERVED_PROPS = {
  key: true,
  __self: true,
  __source: true
}

export default h

function hasValidKey(config) {
  return config.key !== undefined
}

function h(type, config, ...children) {
  const props = {}

  let key = null

  // 获取 key，填充 props 对象
  if (config != null) {
    if (hasValidKey(config)) {
      key = '' + config.key
    }

    for (let propName in config) {
      if (hasOwnProperty.call(config, propName) && !RESERVED_PROPS[propName]) {
        props[propName] = config[propName]
      }
    }
  }

  return vnode(
    type,
    key,
    props,
    flattenArray(children).map(c => {
      return isPrimitive(c) ? vnode(undefined, undefined, undefined, undefined, c) : c
    })
  )
}
