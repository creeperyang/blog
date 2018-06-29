import {
  initMixin
} from './init'
import {
  stateMixin
} from './state'
import {
  renderMixin
} from './render'
import {
  eventsMixin
} from './events'
import {
  lifecycleMixin
} from './lifecycle'
import {
  warn
} from '../util/index'

function Vue(options) {
  if (process.env.NODE_ENV !== 'production' &&
    !(this instanceof Vue)
  ) {
    warn('Vue is a constructor and should be called with the `new` keyword')
  }
  // magic发生在 init 函数里。
  this._init(options)
}

/// 在原型上添加一些属性和方法（私有以及public API）
// Vue.prototype._init
initMixin(Vue)
// Vue.prototype. $data/$props/$set/$del/$watch
stateMixin(Vue)
// Vue.prototype. $on/$off/$once/$emit
eventsMixin(Vue)
// Vue.prototype. _update/$forceUpdate/$destroy
lifecycleMixin(Vue)
// Vue.prototype. _render/$nextTick
// 以及一系列render helpers
/*
 * target._o = markOnce
 * target._n = toNumber
 * target._s = toString
 * target._l = renderList
 * target._t = renderSlot
 * target._q = looseEqual
 * target._i = looseIndexOf
 * target._m = renderStatic
 * target._f = resolveFilter
 * target._k = checkKeyCodes
 * target._b = bindObjectProps
 * target._v = createTextVNode
 * target._e = createEmptyVNode
 * target._u = resolveScopedSlots
 * target._g = bindObjectListeners
 */
renderMixin(Vue)

export default Vue
