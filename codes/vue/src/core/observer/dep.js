import {
  remove
} from '../util/index'

let uid = 0

/**
 * A dep is an observable that can have multiple
 * directives subscribing to it.
 * 一个 dep 就是一个 observable ，可以有多个指令订阅它。
 */
export default class Dep {
  constructor() {
    this.id = uid++
    this.subs = []
  }

  // 添加订阅者
  addSub(sub) {
    this.subs.push(sub)
  }

  // 删除订阅者
  removeSub(sub) {
    remove(this.subs, sub)
  }

  // 收集依赖（把自身添加到taget的依赖列表里）
  depend() {
    if (Dep.target) {
      Dep.target.addDep(this)
    }
  }

  // 通知订阅者
  notify() {
    // stabilize the subscriber list first
    // 复制当前订阅者列表（slice浅拷贝），防止当前的订阅者列表受
    // add/remove 影响。
    const subs = this.subs.slice()
    // 逐一通知订阅者更新
    for (let i = 0, l = subs.length; i < l; i++) {
      subs[i].update()
    }
  }
}

// the current target watcher being evaluated.
// this is globally unique because there could be only one
// watcher being evaluated at any time.
Dep.target = null
const targetStack = []

export function pushTarget(_target) {
  if (Dep.target) targetStack.push(Dep.target)
  Dep.target = _target
}

export function popTarget() {
  Dep.target = targetStack.pop()
}
