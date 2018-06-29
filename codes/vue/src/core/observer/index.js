import Dep from './dep'
import VNode from '../vdom/vnode'
import {
  arrayMethods
} from './array'
import {
  def,
  warn,
  hasOwn,
  hasProto,
  isObject,
  isPlainObject,
  isPrimitive,
  isUndef,
  isValidArrayIndex,
  isServerRendering
} from '../util/index'

const arrayKeys = Object.getOwnPropertyNames(arrayMethods)

/**
 * In some cases we may want to disable observation inside a component's
 * update computation.
 */
export let shouldObserve = true

export function toggleObserving(value) {
  shouldObserve = value
}

/**
 * Observer class that is attached to each observed
 * object. Once attached, the observer converts the target
 * object's property keys into getter/setters that
 * collect dependencies and dispatch updates.
 * 转化value的属性为getter / setter， 并在里面实现收集依赖和转发更新
 */
export class Observer {
  // number of vms that has this object as root $data
  constructor(value) {
    this.value = value
    // 有什么用？
    // 因为this.walk(value)其实只能把value的每个属性转化为getter/setter，
    // 那么value本身被直接赋值（整个替换）时，怎么通知更新？
    // 所以有个observer实例本身的dep。
    // 另外，我们注意到，Vue通过`data(){}`返回的数据作为rootData，它是不能直接被
    // 覆盖的，我们只能设置它的属性，所以第一层的 dep 不会被用到，这个 dep 怎么
    // 使用的，我们看下面的 defineReactive 里的 childOb.dep.depend。
    this.dep = new Dep()
    this.vmCount = 0
    // 把自身设置到 value 的 __ob__ 属性上（不可枚举）
    def(value, '__ob__', this)
    // 重写 value 的每个属性为 getter/setter，
    // 根据是不是 array 用不同的方式。
    if (Array.isArray(value)) {
      const augment = hasProto ?
        protoAugment :
        copyAugment
      // 特殊处理数组的 push/shift 等等方法，使之可以监测数据变化：
      // 调用value的数组方法时，会调用 value.__ob__.dep.notify()
      augment(value, arrayMethods, arrayKeys)
      this.observeArray(value)
    } else {
      this.walk(value)
    }
  }

  /**
   * Walk through each property and convert them into
   * getter/setters. This method should only be called when
   * value type is Object.
   */
  walk(obj) {
    const keys = Object.keys(obj)
    for (let i = 0; i < keys.length; i++) {
      defineReactive(obj, keys[i])
    }
  }

  /**
   * Observe a list of Array items.
   */
  observeArray(items) {
    for (let i = 0, l = items.length; i < l; i++) {
      observe(items[i])
    }
  }
}

// helpers

/**
 * Augment an target Object or Array by intercepting
 * the prototype chain using __proto__
 */
function protoAugment(target, src, keys) {
  /* eslint-disable no-proto */
  target.__proto__ = src
  /* eslint-enable no-proto */
}

/**
 * Augment an target Object or Array by defining
 * hidden properties.
 */
/* istanbul ignore next */
function copyAugment(target, src, keys) {
  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i]
    def(target, key, src[key])
  }
}

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 * 为value创建对应的observer，或者返回已有的observer。
 */
export function observe(value, asRootData) {
  if (!isObject(value) || value instanceof VNode) {
    return
  }
  let ob
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    ob = value.__ob__
  } else if (
    shouldObserve &&
    !isServerRendering() &&
    (Array.isArray(value) || isPlainObject(value)) &&
    Object.isExtensible(value) &&
    !value._isVue
  ) {
    ob = new Observer(value)
  }
  if (asRootData && ob) {
    ob.vmCount++
  }
  return ob
}

/**
 * Define a reactive property on an Object.
 * 把 property 转化为 getter 和 setter
 * - 创建dep（dep是一个连接器，getter时收集依赖，setter时通知更新）；
 * - 在 getter 里面进行依赖收集，在非shallow时递归收集
 * - 在 setter 里面进行更新通知，在非shallow时重新创建childOb
 */
export function defineReactive(
  obj,
  key,
  val,
  customSetter,
  shallow
) {
  const dep = new Dep()

  const property = Object.getOwnPropertyDescriptor(obj, key)
  if (property && property.configurable === false) {
    return
  }

  // cater for pre-defined getter/setters
  const getter = property && property.get
  const setter = property && property.set
  if ((!getter || setter) && arguments.length === 2) {
    val = obj[key]
  }

  // ⚠️
  // 大部分情况shallow默认是false的，即默认递归observe。
  // - 当val是数组时，childOb被用来向当前watcher收集依赖
  // - 当val是普通对象时，set/del函数也会用childOb来通知val的属性添加/删除
  let childOb = !shallow && observe(val)
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    // watcher 初始化时调用自己的 watcher.get()，最终调用这个 getter，
    // 而 dep.depend 执行，把 watcher 放到了自己的 subs 里；所以当
    // set 执行时，watcher 被通知更新。
    get: function reactiveGetter() {
      const value = getter ? getter.call(obj) : val
      if (Dep.target) {
        dep.depend()
        // ⚠️ 现在问题是为什么要依赖 childOb 呢？
        // （1）考虑到如果 value 是数组，那么 value 的 push/shift 之类的操作，
        // 是触发不了下面的 setter 的，即 dep.depend 在这种情况不会被调用。
        // 此时，childOb 即value这个数组对应的 ob，数组的操作会通知到childOb，
        // 所以可以替代 dep 来通知 watcher。
        // （2）Vue.set/Vue.del API(即下面的set/del函数)中，如果直接把一个对象
        // 设置成其它值，或者删除某个对象的key，这个时候也依赖 childOb 来通知。
        if (childOb) {
          childOb.dep.depend()
          // 同时，对数组元素的操作，需要通过 dependArray(value) 来建立依赖。
          if (Array.isArray(value)) {
            dependArray(value)
          }
        }
      }
      return value
    },
    set: function reactiveSetter(newVal) {
      const value = getter ? getter.call(obj) : val
      /* eslint-disable no-self-compare */
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return
      }
      /* eslint-enable no-self-compare */
      if (process.env.NODE_ENV !== 'production' && customSetter) {
        customSetter()
      }
      if (setter) {
        setter.call(obj, newVal)
      } else {
        val = newVal
      }
      // 对新val重新创建childOb
      childOb = !shallow && observe(newVal)
      // 通知更新
      dep.notify()
    }
  })
}

/**
 * Set a property on an object. Adds the new property and
 * triggers change notification if the property doesn't
 * already exist.
 */
export function set(target, key, val) {
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot set reactive property on undefined, null, or primitive value: ${(target     )}`)
  }
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.length = Math.max(target.length, key)
    target.splice(key, 1, val)
    return val
  }
  if (key in target && !(key in Object.prototype)) {
    target[key] = val
    return val
  }
  const ob = (target).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid adding reactive properties to a Vue instance or its root $data ' +
      'at runtime - declare it upfront in the data option.'
    )
    return val
  }
  if (!ob) {
    target[key] = val
    return val
  }
  defineReactive(ob.value, key, val)
  ob.dep.notify()
  return val
}

/**
 * Delete a property and trigger change if necessary.
 */
export function del(target, key) {
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot delete reactive property on undefined, null, or primitive value: ${(target     )}`)
  }
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.splice(key, 1)
    return
  }
  const ob = (target).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid deleting properties on a Vue instance or its root $data ' +
      '- just set it to null.'
    )
    return
  }
  if (!hasOwn(target, key)) {
    return
  }
  delete target[key]
  if (!ob) {
    return
  }
  ob.dep.notify()
}

/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.
 */
function dependArray(value) {
  for (let e, i = 0, l = value.length; i < l; i++) {
    e = value[i]
    e && e.__ob__ && e.__ob__.dep.depend()
    if (Array.isArray(e)) {
      dependArray(e)
    }
  }
}
