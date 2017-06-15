/**
 * props 模块：支持 vnode 使用 props 来操作其它属性。
 */
function filterKeys(obj) {
  return Object.keys(obj).filter(k => {
    return k !== 'style' && k !== 'id' && k !== 'class'
  })
}

function updateProps(oldVnode, vnode) {
  let oldProps = oldVnode.data.props
  let props = vnode.data.props
  const elm = vnode.elm
  let key, cur, old

  if (!oldProps && !props) return
  if (oldProps === props) return
  oldProps = oldProps || {}
  props = props || {}

  filterKeys(oldProps).forEach(key => {
    if (!props[key]) {
      delete elm[key]
    }
  })
  filterKeys(props).forEach(key => {
    cur = props[key]
    old = oldProps[key]
    if (old !== cur && (key !== 'value' || elm[key] !== cur)) {
      elm[key] = cur
    }
  })
}

export const propsModule = {create: updateProps, update: updateProps}
export default propsModule
