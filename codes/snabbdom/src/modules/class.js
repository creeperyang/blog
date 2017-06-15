/**
 * class 模块：支持 vnode 使用 className 来操作 html class。
 */

import { isArray } from '../utils'

function updateClassName(oldVnode, vnode) {
  const oldName = oldVnode.data.className
  const newName = vnode.data.className

  if (!oldName && !newName) return
  if (oldName === newName) return

  const elm = vnode.elm
  if (typeof newName === 'string' && newName) {
    elm.className = newName.toString()
  } else if (isArray(newName)) {
    elm.className = ''
    newName.forEach(v => {
      elm.classList.add(v)
    })
  } else {
    // 所有不合法的值或者空值，都把 className 设为 ''
    elm.className = ''
  }
}

export const classModule = {
  create: updateClassName,
  update: updateClassName
}
export default classModule
