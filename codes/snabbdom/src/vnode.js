// ⚠️ 通过 symbol 保证唯一性，用于检测是不是 vnode
const VNODE_TYPE = Symbol('virtual-node')

/**
 * 生成 vnode
 * @param  {String} type     类型，如 'div'
 * @param  {String} key      key
 * @param  {Object} data     data，包括属性，事件等等
 * @param  {Array} children 子 vnode
 * @param  {String} text     文本
 * @param  {Element} elm      对应的 dom
 * @return {Object}          vnode
 */
function vnode(type, key, data, children, text, elm) {
  const element = {
    __type: VNODE_TYPE,
    type, key, data, children, text, elm
  }

  return element
}

/**
 * 校验是不是 vnode，主要检查 __type。
 * @param  {Object}  vnode 要检查的对象
 * @return {Boolean}       是则 true，否则 false
 */
function isVnode(vnode) {
  return vnode && vnode.__type === VNODE_TYPE
}

/**
 * 检查两个 vnode 是不是同一个：key 相同且 type 相同。
 * @param  {Object}  oldVnode 前一个 vnode
 * @param  {Object}  vnode    后一个 vnode
 * @return {Boolean}          是则 true，否则 false
 */
function isSameVnode(oldVnode, vnode) {
  return oldVnode.key === vnode.key && oldVnode.type === vnode.type
}

export default vnode
export {
  isVnode,
  isSameVnode,
  VNODE_TYPE
}
