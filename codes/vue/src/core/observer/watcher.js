import {
  warn,
  remove,
  isObject,
  parsePath,
  _Set as Set,
  handleError
} from '../util/index'

import {
  traverse
} from './traverse'
import {
  queueWatcher
} from './scheduler'
import Dep, {
  pushTarget,
  popTarget
} from './dep'

let uid = 0

/**
 * A watcher parses an expression, collects dependencies,
 * and fires callback when the expression value changes.
 * This is used for both the $watch() api and directives.
 */
export default class Watcher {
  constructor(
    vm,
    expOrFn,
    cb,
    options,
    isRenderWatcher
  ) {
    this.vm = vm
    if (isRenderWatcher) {
      vm._watcher = this
    }
    vm._watchers.push(this)
    // options
    if (options) {
      this.deep = !!options.deep
      this.user = !!options.user
      this.computed = !!options.computed
      this.sync = !!options.sync
      this.before = options.before
    } else {
      this.deep = this.user = this.computed = this.sync = false
    }
    this.cb = cb
    this.id = ++uid // uid for batching
    this.active = true
    this.dirty = this.computed // for computed watchers
    // 初始化deps相关属性
    this.deps = []
    this.newDeps = []
    this.depIds = new Set()
    this.newDepIds = new Set()
    this.expression = process.env.NODE_ENV !== 'production'
      ? expOrFn.toString()
      : ''
    // parse expression for getter
    // getter 是一个函数，接受 vm 作为参数，返回值
    if (typeof expOrFn === 'function') {
      this.getter = expOrFn
    } else {
      this.getter = parsePath(expOrFn)
      if (!this.getter) {
        this.getter = function () {}
        process.env.NODE_ENV !== 'production' && warn(
          `Failed watching path: "${expOrFn}" ` +
          'Watcher only accepts simple dot-delimited paths. ' +
          'For full control, use a function instead.',
          vm
        )
      }
    }
    // 对 computed 特殊处理，添加一个 dep 让 watcher 可以被依赖
    if (this.computed) {
      this.value = undefined
      this.dep = new Dep()
    }
    // 如果不是computed，初始化 this.value 的值：
    // 1. 通过调用 getter 获取值 value
    // 2. 如果是 deep 依赖，递归访问 value 的所有属性，收集依赖
    else {
      this.value = this.get()
    }
  }

  /**
   * Evaluate the getter, and re-collect dependencies.
   * 执行 getter，并收集依赖
   */
  get() {
    // 设定 Dep.target 为 this（当前 watcher ），
    // 使得 getter 调用和 traverse 调用时当前 watcher 被正确指定为 target。
    pushTarget(this)
    let value
    const vm = this.vm
    try {
      // ⚠️
      // 重点注意，getter执行时，数据的getter会被调用（数据已被observe处理过），
      // 这意味着所依赖的数据对应的依赖已经被收集（非deep，如 data.user 代表 user 已被收集，
      // 但 user.name 不在依赖列表里，需要通过下面的 traverse 收集）。
      value = this.getter.call(vm, vm)
    } catch (e) {
      if (this.user) {
        handleError(e, vm, `getter for watcher "${this.expression}"`)
      } else {
        throw e
      }
    } finally {
      // "touch" every property so they are all tracked as
      // dependencies for deep watching
      if (this.deep) {
        traverse(value)
      }
      // 重置Dep.target
      popTarget()
      this.cleanupDeps()
    }
    return value
  }

  /**
   * Add a dependency to this directive.
   * 被 dep.depend 调用，把 dep 加到 watcher 的 deps 里。
   */
  addDep(dep) {
    const id = dep.id
    // 如果在新一轮依赖收集里没被记录，则记录；
    if (!this.newDepIds.has(id)) {
      this.newDepIds.add(id)
      this.newDeps.push(dep)
      // 如果不在原来的 deps 里，则需要调用 dep.addSub，
      // 把 watcher 添加到 dep 的 subs 里。
      if (!this.depIds.has(id)) {
        dep.addSub(this)
      }
    }
  }

  /**
   * Clean up for dependency collection.
   * 清理 wathcer 的依赖：
   * - 更新 deps/depIds；
   * - 清空 newDeps 和 newDepIds，为下次依赖收集做好准备
   */
  cleanupDeps() {
    // 如果原来的 dep 已经不在新 dep 里（说明不再是依赖了），
    // 则用 dep.removeSub 来把当前 watcher 从订阅者列表中清除。
    let i = this.deps.length
    while (i--) {
      const dep = this.deps[i]
      if (!this.newDepIds.has(dep.id)) {
        dep.removeSub(this)
      }
    }
    // 把 newDepIds 设置为 depIds，把 newDeps 设置为 deps，
    // 并清空 this.newDepIds/this.newDeps ，为下次依赖收集做好准备。
    // 这里比较有意思的是用 tmp 作为中间变量，复用了 deps/newDeps，depIds/newDepIds，
    // 提高性能（防止过多GC）。
    let tmp = this.depIds
    this.depIds = this.newDepIds
    this.newDepIds = tmp
    this.newDepIds.clear()
    tmp = this.deps
    this.deps = this.newDeps
    this.newDeps = tmp
    this.newDeps.length = 0
  }

  /**
   * Subscriber interface.
   * Will be called when a dependency changes.
   * dep.notify 通知 watcher，watcher.update 被执行。
   */
  update() {
    /* istanbul ignore else */
    if (this.computed) {
      // A computed property watcher has two modes: lazy and activated.
      // It initializes as lazy by default, and only becomes activated when
      // it is depended on by at least one subscriber, which is typically
      // another computed property or a component's render function.
      if (this.dep.subs.length === 0) {
        // In lazy mode, we don't want to perform computations until necessary,
        // so we simply mark the watcher as dirty. The actual computation is
        // performed just-in-time in this.evaluate() when the computed property
        // is accessed.
        this.dirty = true
      } else {
        // In activated mode, we want to proactively perform the computation
        // but only notify our subscribers when the value has indeed changed.
        this.getAndInvoke(() => {
          this.dep.notify()
        })
      }
    } else if (this.sync) {
      this.run()
    } else {
      queueWatcher(this)
    }
  }

  /**
   * Scheduler job interface.
   * Will be called by the scheduler.
   */
  run() {
    if (this.active) {
      this.getAndInvoke(this.cb)
    }
  }

  // 执行回调，更新 this.value
  getAndInvoke(cb) {
    const value = this.get()
    if (
      value !== this.value ||
      // Deep watchers and watchers on Object/Arrays should fire even
      // when the value is the same, because the value may
      // have mutated.
      isObject(value) ||
      this.deep
    ) {
      // set new value
      const oldValue = this.value
      this.value = value
      this.dirty = false
      if (this.user) {
        try {
          cb.call(this.vm, value, oldValue)
        } catch (e) {
          handleError(e, this.vm, `callback for watcher "${this.expression}"`)
        }
      } else {
        cb.call(this.vm, value, oldValue)
      }
    }
  }

  /**
   * Evaluate and return the value of the watcher.
   * This only gets called for computed property watchers.
   */
  evaluate() {
    if (this.dirty) {
      this.value = this.get()
      this.dirty = false
    }
    return this.value
  }

  /**
   * Depend on this watcher. Only for computed property watchers.
   */
  depend() {
    if (this.dep && Dep.target) {
      this.dep.depend()
    }
  }

  /**
   * Remove self from all dependencies' subscriber list.
   */
  teardown() {
    if (this.active) {
      // remove self from vm's watcher list
      // this is a somewhat expensive operation so we skip it
      // if the vm is being destroyed.
      if (!this.vm._isBeingDestroyed) {
        remove(this.vm._watchers, this)
      }
      let i = this.deps.length
      while (i--) {
        this.deps[i].removeSub(this)
      }
      this.active = false
    }
  }
}
