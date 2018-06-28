import {
  _Set as Set,
  isObject
} from '../util/index'

import VNode from '../vdom/vnode'

const seenObjects = new Set()

/**
 * Recursively traverse an object to evoke all converted
 * getters, so that every nested property inside the object
 * is collected as a "deep" dependency.
 * 深度收集依赖， 通过 seenObjects 防止重复收集。
 */
export function traverse(val) {
  _traverse(val, seenObjects)
  seenObjects.clear()
}

// 递归遍历 val，深度收集依赖
function _traverse(val, seen) {
  let i, keys
  const isA = Array.isArray(val)
  // 如果不是数组或对象，或者是 VNode，或者frozen，则不再处理。
  if ((!isA && !isObject(val)) || Object.isFrozen(val) || val instanceof VNode) {
    return
  }
  if (val.__ob__) {
    const depId = val.__ob__.dep.id
    // 如果已经收集过，则不再重复处理了。
    if (seen.has(depId)) {
      return
    }
    seen.add(depId)
  }

  // 对数组的每个元素调用 _traverse
  if (isA) {
    i = val.length
    while (i--) _traverse(val[i], seen)
  }
  // 对子属性（val[keys[i]]）访问，即调用 defineReactvie 定义的 getter，收集依赖
  else {
    keys = Object.keys(val)
    i = keys.length
    while (i--) _traverse(val[keys[i]], seen)
  }
}
