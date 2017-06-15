/**
 * style 模块：支持 vnode 使用 style 来操作内连样式。
 */

const raf = (typeof window !== 'undefined' && window.requestAnimationFrame) || setTimeout

const nextFrame = function(fn) {
  raf(function() { raf(fn) })
}

function setNextFrame(obj, prop, val) {
  nextFrame(function() {
    obj[prop] = val
  })
}

function updateStyle(oldVnode, vnode) {
  let oldStyle = oldVnode.data.style
  let style = vnode.data.style
  const elm = vnode.elm
  let name, cur
  
  if (!oldStyle && !style) return
  if (oldStyle === style) return
  oldStyle = oldStyle || {}
  style = style || {}

  let oldHasDel = 'delayed' in oldStyle

  // 删除 style 中没有而 oldStyle 中有的属性
  for (name in oldStyle) {
    if (!style[name]) {
      if (name[0] === '-' && name[1] === '-') {
        elm.style.removeProperty(name)
      } else {
        elm.style[name] = ''
      }
    }
  }
  // 更新 style
  for (name in style) {
    cur = style[name]
    // delayed
    if (name === 'delayed') {
      for (name in style.delayed) {
        cur = style.delayed[name]
        if (!oldHasDel || cur !== oldStyle.delayed[name]) {
          setNextFrame(elm.style, name, cur)
        }
      }
    }
    // 普通
    else if (name !== 'remove' && cur !== oldStyle[name]) {
      if (name[0] === '-' && name[1] === '-') {
        elm.style.setProperty(name, cur)
      } else {
        elm.style[name] = cur
      }
    }
  }
}

export const styleModule = {
  create: updateStyle,
  update: updateStyle
}
export default styleModule
