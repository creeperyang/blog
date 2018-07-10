> 对一个数据（典型的即Plain Object），要想实现数据变化监听，一般有3种方式：
> - 脏检查，如`angular.js`；
> - 只能用特定方法去更新数据，如`react`的`setState`；
> - getter/setter（`Object.defineProperty`），即`Vue`采用的。

> 本篇文章即聚焦Vue监听数据变化的部分。

# Vue源码解析一：observer

要理解Vue，从observer开使是一个不错的选择。因为从本质上来讲，除去生命周期函数，虚拟DOM，组件系统等以外，
Vue首先建立在数据监测之上，可以收集依赖，并在数据变化时自动通知到Vue的实例。

observer的相关代码在`core/observer`下，数据绑定的逻辑主要集中在`dep/watcher/index/traverse`4个文件中。

## observer工作原理简述

当有一个表达式，我们可以收集它的依赖，并在数据变化时，让依赖反过来去通知表达式这种变化。用一个例子来示意整个工作流程：

1. 首先假设我们有个expOrFn函数，内部返回一个表达式的值：

  ```js
  function expOrFn(vm) {
    return vm.user
  }
  ```

  很显然，expOrFn依赖`vm.user`，当`user`变化时，expOrFn应该自动重新执行。但，怎么知道这种依赖关系呢？

2. Vue引入getter来帮助检查依赖，通过运行一次函数来确定依赖。

  对数据vm来说，假设我们用getter来改写它的所有属性；那么当我们访问`vm.user`的时候，getter函数会执行，
  所以，只要我们执行一次`expOrFn`，它的所有依赖就都知道了！bingo！

  ```js
  const vm = { user: 'creeper' }
  defineGetter(vm)
  let value = expOrFn(vm)
  ```

  一切看起来很简单。然后很自然地，我们加上setter来感知数据的更新。

3. Vue用setter来截获数据更新。

  当vm变化时，我们必须能够感知这种变化，否则收集依赖是完全没有意义的。

  ```js
  const vm = { user: 'creeper' }
  defineGetterAndSetter(vm)
  let value = expOrFn(vm)
  // 然后我们更新数据
  vm.user = 'who?'
  // 因为调用了setter，所以我们可以知道数据更新了！
  ```

  看起来一切都搞定了。但上面的代码只是伪代码，实际开发中，我们必须要解决怎么定义依赖，怎么收集依赖，怎么通知更新的整个流程。

4. Vue定义了依赖（`Dep`），并设计了巧妙的 getter/setter 来收集依赖和通知更新：

  ```js
  // 依赖，作为纽带来用，本身设计的很薄
  class Dep {
    // 添加订阅者——即谁依赖这个依赖
    addSub(sub) { this.subs.push(sub) }
    // 当有变化时，通知订阅者
    notify() { this.subs.forEach(sub => sub.update()) }
    // 很有意思的方法，下一步重点说，或者直接看源代码的注释
    depend() { Dep.target.addDep(this) }
  }
  ```

  接下来看看Dep是怎么用在 getter/setter里的：

  ```js
  // 假设有数据 vm，我们对 vm 的每个属性调用 defineReactive 来设置 getter/setter
  // defineReactive(vm, 'user', 'creeper')
  function defineReactive(obj, key, val) {
    // 每个属性创建一个dep，这是一个一一对应的关系
    const dep = new Dep()

    Object.defineProperty(obj, key, {
      enumerable: true,
      configurable: true,
      get: function reactiveGetter() {
        if (Dep.target) {
          // 收集依赖
          dep.depend()
        }
        return val
      },
      set: function reactiveSetter(newVal) {
        val = newVal
        // 通知数据更新了
        dep.notify()
      }
    })
  }
  ```

  如上，getter/setter 配合对应的dep，可以完成依赖收集和更新通知。下面描述整个流程是怎么工作的
  （比如`dep.depend()`怎么收集依赖的）：

5. Vue用`Watcher`来串联整个流程。

  ```js
  class Watcher {
    // vm 是数据，expOrFn 是表达式，cb 是更新时的回调
    constructor(vm, expOrFn, cb) {
      this.vm = vm
      // 用于收集依赖
      this.deps = []
      // 收集依赖
      this.value = this.get()
    }
    get() {
      // 设置Dep.target，方便依赖收集时 dep.depend 可以正确调用
      Dep.target = this
      // 调用 expOrFn 来收集依赖
      const val = this.expOrFn.call(this.vm, this.vm)
    }
    // 联系上面的 dep.depend，是不是恍然大悟？
    addDep(dep) {
      this.deps.push(dep)
      dep.addSub(this)
    },
    // 联系上面的 dep.notify，是不是懂了？
    update() {
      this.cb.call(this, this.get(), this.value)
    }
  }

  const vm = { user: 'creeper' }
  // 设置 getter/setter
  observe(vm)
  const exp = vm => vm.user
  // 让exp可以监测数据变化
  new Watcher(vm, exp, function updateCb() {})
  ```

  以上即整个observer流程，当然，里面简化了很多细节，详细的可看代码注释和下面的核心代码解读。

## 核心代码解读

### `observe`函数和`Observer`类

`observe(value, asRootData)`方法用于为value创建getter/setter，从而实现对数据变化的监听；该方法会为value创建对应的Observer实例，而observer则是实际转化value的属性为getter/setter，收集依赖和转发更新的地方。

observer相关的核心代码是`defineReactive`来创建getter/setter，下面是相关注释：

```js
/**
 * 把 property 转化为 getter 和 setter
 * - 创建dep（dep是一个纽带，连接watcher和数据，getter时收集依赖，setter时通知更新）；
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
```

### 入口`Watcher`

observer核心入口是`Watcher`，创建一个watcher可以监测数据的变化，并在变化时执行回调。

下面是 traverse 的代码：

```js
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
```

## 测试和代码执行过程简述

下面是一些测试代码，帮助理解observer的运行。

```js
const { observe } = require('./dist/core/observer')
const Watcher = require('./dist/core/observer/watcher').default

function createWather(data, expOrFn, cb, options) {
  const vm = {
    data: data || {},
    _watchers: []
  }
  observe(vm.data, true)
  return new Watcher(vm, expOrFn, cb, options)
}

const raw = {
  s: 'hi',
  n: 100,
  o: {x: 1, arr: [1, 2]},
  arr: [8, 9]
}

const w = createWather(raw, function expOrFn() {
  // 1
  return this.data.o
}, (a, b) => {
  console.log('--->', a, b)
}, {
  deep: false,
  sync: true
})

// 2
raw.o.x = 2
```

我在设置getter的地方加了一些输出语句：

```js
    get: function reactiveGetter() {
      const value = getter ? getter.call(obj) : val;
      console.log('call getter --->', key, val, !!_dep.default.target)
      if (_dep.default.target) {
        dep.depend();

        if (childOb) {
          childOb.dep.depend();
          console.log('call childOb.dep.depend')
          if (Array.isArray(value)) {
            dependArray(value);
          }
        }
      }

      return value;
    },
```

并且测试代码中，序号1和2下面的一行代码会替换来测试不同的情况，测试结果如下：

```
1. retrun this.data.o   2. raw.o.x = 101
call getter ---> o { x: [Getter/Setter], arr: [Getter/Setter] } true
call childOb.dep.depend
call getter ---> o { x: [Getter/Setter], arr: [Getter/Setter] } false


1. retrun this.data.o   2. raw.o = 101
call getter ---> o { x: [Getter/Setter], arr: [Getter/Setter] } true
call childOb.dep.depend
call getter ---> o 101 true
---> 101 { x: [Getter/Setter], arr: [Getter/Setter] }


1. retrun this.data.arr   2. raw.arr.push(10)
call getter ---> arr [ 8, 9 ] true
call childOb.dep.depend // 因为child depend，数组的操作可以被监测。
call getter ---> arr [ 8, 9 ] false // push 产生的 getter
call getter ---> arr [ 8, 9, 10 ] true // 调用回调时调用了 this.get()
call childOb.dep.depend
---> [ 8, 9, 10 ] [ 8, 9, 10 ]
```

## 更多

本篇的分析尽量不把Vue其它部分牵扯进来，所以遗留了 `computed` 型watcher和 scheduler 没有涉及。下一篇将解析
instance部分，会把遗留的补上。
